/**
 * The AR work queue — money-cycle slice 3 (`specs/task-5-posting-denials-ar.md`
 * items 5, 6, 7 and 13).
 *
 * Inspiration: the AR follow-up worklist every practice management system keeps
 * behind the ledger — Epic's claim workqueue, eClinicalWorks' AR worklist,
 * athenahealth's denial queue. A biller does not "work a claim"; they work an
 * *item*: one denied line the payer refused, or one balance the patient still
 * owes. Each item has an age, and clearing it has to move money.
 *
 * Three rules this file exists to keep:
 *
 *  1. **An item exists only where money exists.** A denial item comes from a
 *     line of a *posted* 835 — its amount is the group+CARC money the payer
 *     refused, and nothing else. A balance item comes from the patient ledger's
 *     own sum. No item is invented, and no amount is typed.
 *  2. **Clearing an item writes ledger entries, not a label.** Rebill and
 *     appeal move the money off the denied claim onto the corrected or appealed
 *     claim; transfer-to-patient puts it on the patient; a contractual
 *     write-off reduces the patient balance — never below zero, because the
 *     patient cannot owe less than nothing.
 *  3. **Pure.** No React, no store, no clock of its own: the caller hands in the
 *     sources and one timestamp. Entry ids are deterministic, so resolving the
 *     same item twice cannot double the money.
 *
 * What an item can never do: invent a figure. A CO-denied line was written off
 * the moment its 835 posted, so writing it off again writes nothing — and the
 * panel says so rather than showing a number that came from nowhere.
 */

import type { AdjustmentGroup, Remittance835 } from "./adjudication";
import { ledgerBalance, ledgerEntriesForClaim, type LedgerEntry } from "./ledger";
import { localDay } from "../utils/localDay";

// ─── Vocabulary ────────────────────────────────────────────────────

/**
 * denial  — a line the payer refused on a posted 835;
 * balance — the patient's share left after posting;
 * appeal  — the payer's answer to an appeal the student filed.
 */
export type ArItemKind = "denial" | "balance" | "appeal";

/** The four ways a biller clears an item. Each one moves money. */
export type ArAction =
  | "rebill"
  | "appeal"
  | "transfer_to_patient"
  | "write_off"
  | "patient_statement"
  | "patient_payment";

export type ArItemStatus = "open" | "in-progress" | "escalated" | "resolved";

/** Aging buckets, `specs/task-5-posting-denials-ar.md` item 15. */
export type AgingBucket = "0-30" | "31-60" | "61-90" | "91-120" | "120+";

export const AGING_BUCKETS: AgingBucket[] = ["0-30", "31-60", "61-90", "91-120", "120+"];

export const AR_ACTION_LABELS: Record<ArAction, string> = {
  rebill: "Correct and resubmit",
  appeal: "Appeal",
  transfer_to_patient: "Transfer to patient",
  write_off: "Contractual write-off",
  patient_statement: "Send patient statement",
  patient_payment: "Post patient payment",
};

/**
 * What each action does to the money, in one plain sentence. This is the
 * mechanism, not the answer: which action is *right* for this item is the
 * student's call, and the debrief comes after they commit.
 */
export const AR_ACTION_EFFECTS: Record<ArAction, string> = {
  rebill:
    "Moves the refused money off this claim onto a corrected claim (…-R1). The payer still owes it; the patient's balance does not change.",
  appeal:
    "Moves the refused money off this claim onto an appeal record (…-A1). The payer still owes it; the patient's balance does not change.",
  transfer_to_patient:
    "Adds the refused money to the patient's balance. The patient now owes it, and the practice has given up on the payer.",
  write_off:
    "Reduces the patient's balance by the amount written off, and never below zero. The practice stops trying to collect it.",
  patient_statement:
    "Bills the patient for their share (deductible, coinsurance or copay the 835 assigned with group code PR). No money moves yet; the balance now sits with patient billing until they pay.",
  patient_payment:
    "Records the patient's payment of their share. The patient balance falls by the amount paid and the claim closes when it reaches zero.",
};

/** The appeal window this simulation teaches, counted from the 835's date. */
export const APPEAL_WINDOW_DAYS = 120;

// ─── Stored per-item state (the encounter carries it) ──────────────

/**
 * What the student has done to one queue item. The queue itself is derived from
 * the 835 and the ledger on every render; only the *work done on it* is stored,
 * so a resolved item can never disagree with the money.
 */
export interface ArItemState {
  /** Matches the derived item's id, so the two can never drift apart. */
  id: string;
  claimNumber: string;
  status: ArItemStatus;
  /** The action that cleared it, when it is resolved. */
  action?: ArAction;
  /** The CARC a write-off was taken under. */
  reasonCode?: string;
  note?: string;
  assignedTo?: string;
  /** When the student last touched it. One clock read, ISO. */
  at?: string;
  /** The student's phone, or "system". */
  by?: string;
}

// ─── The derived item ──────────────────────────────────────────────

export interface ArWorkItem {
  /** Deterministic: `AR-<claim>-L<line>-<carc>` or `AR-<claim>-BAL`. */
  id: string;
  kind: ArItemKind;
  patientId: string | null;
  patientName: string | null;
  claimNumber: string;
  payerName: string;
  /** Denial items only: the claim line (CMS-1500 box 24). */
  lineNumber?: number;
  cpt?: string;
  /** Denial items only: the group letter and CARC the payer used. */
  group?: AdjustmentGroup;
  carc?: string;
  carcDescription?: string;
  /** The money this item is about, in cents — refused, or owed by the patient. */
  amountCents: number;
  /** The claim's patient balance right now, summed from the ledger. */
  patientBalanceCents: number;
  /** What posting already wrote off for this line, so nothing is written twice. */
  alreadyWrittenOffCents: number;
  /**
   * The part of this item's money that is the patient's. A CO denial leaves the
   * patient owing nothing, so a write-off against it writes nothing; a PR line
   * leaves the patient owing all of it.
   */
  patientPortionCents: number;
  /** The 835's payment date (denial) or the posting date (balance). */
  datedAt: string;
  ageDays: number;
  bucket: AgingBucket;
  /** `datedAt` + the appeal window. */
  appealDeadline: string;
  status: ArItemStatus;
  action?: ArAction;
  reasonCode?: string;
  note?: string;
  assignedTo?: string;
  resolvedAt?: string;
  /** What may be done to this item. A patient balance cannot be re-billed. */
  actions: ArAction[];
}

/** The one source of queue items: a patient's encounter, as the store holds it. */
export interface ArQueueSource {
  patientId: string | null;
  patientName?: string | null;
  claimNumber: string | null;
  remittances: Remittance835[];
  ledger: LedgerEntry[];
  arItems?: ArItemState[];
}

// ─── Dates and aging ───────────────────────────────────────────────

const DAY_MS = 86_400_000;

/** A calendar day as a UTC-midnight number, so day arithmetic has no clock in it. */
function calendarDayMs(value: string): number {
  const day = localDay(value);
  const m = day.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : Number.NaN;
}

/**
 * Whole calendar days from one date to another, never negative. Both ends are
 * read as the student's own calendar dates, so a remittance posted after
 * midnight is 0 days old, not -1 or 1.
 */
export function daysBetween(fromIso: string, nowIso: string): number {
  const from = calendarDayMs(fromIso);
  const now = calendarDayMs(nowIso);
  if (!Number.isFinite(from) || !Number.isFinite(now)) return 0;
  return Math.max(0, Math.round((now - from) / DAY_MS));
}

/** The bucket an age in days falls in. */
export function agingBucketFor(days: number): AgingBucket {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  if (days <= 120) return "91-120";
  return "120+";
}

/** The appeal deadline the simulation teaches: the 835 date plus the window. */
export function appealDeadlineFor(datedAt: string): string {
  const start = calendarDayMs(datedAt);
  if (!Number.isFinite(start)) return datedAt;
  // Calendar arithmetic in UTC, then printed as that same calendar date.
  return new Date(start + APPEAL_WINDOW_DAYS * DAY_MS).toISOString().slice(0, 10);
}

// ─── Deriving the queue ────────────────────────────────────────────

/**
 * The adjustments that are part of a *normal* adjudication, not a denial:
 * CO-45 is the contracted allowance difference every covered line carries, and
 * PR-1 / PR-2 / PR-3 are the routine deductible, coinsurance and copay split
 * that the patient balance item already represents. Everything else — CO-197
 * for a missing authorisation, CO-236 for a same-day edit, PR-96 for a service
 * the plan excludes — is money the payer refused and a biller has to work.
 */
const ROUTINE_ADJUSTMENTS = new Set(["CO-45", "PR-1", "PR-2", "PR-3"]);

/** A routine adjustment (contractual CO-45, or the PR deductible / coinsurance / copay) — not a denial. */
export function isRoutineAdjustmentCode(carc: string): boolean {
  return ROUTINE_ADJUSTMENTS.has(carc);
}

function isDenialAdjustment(adj: { group: AdjustmentGroup; carc: string }): boolean {
  if (ROUTINE_ADJUSTMENTS.has(adj.carc)) return false;
  return adj.group === "CO" || adj.group === "OA" || adj.group === "PR";
}

/** The actions a queue item accepts. A patient balance is not the payer's. */
export function actionsFor(kind: ArItemKind): ArAction[] {
  if (kind === "appeal") return ["rebill", "write_off"];
  return kind === "denial"
    ? ["rebill", "appeal", "transfer_to_patient", "write_off"]
    : // Patient responsibility (PR) is the patient's to pay: bill it or post
      // their payment. A contractual write-off is the payer's CO money, and
      // routinely writing off a patient's coinsurance is not allowed.
      ["patient_statement", "patient_payment"];
}

/**
 * Build the whole work queue from every patient's encounter. Sorted oldest
 * first, because that is the order a biller works it: the money closest to the
 * appeal deadline is the money at risk.
 */
export function buildArWorkQueue(sources: ArQueueSource[], nowIso: string): ArWorkItem[] {
  const items: ArWorkItem[] = [];

  for (const source of sources) {
    const claimNumber = source.claimNumber;
    if (!claimNumber) continue;
    const claimEntries = ledgerEntriesForClaim(source.ledger, claimNumber);
    if (claimEntries.length === 0) continue; // nothing has been posted: nothing to work
    const patientBalanceCents = ledgerBalance(claimEntries).patientBalanceCents;
    const states = source.arItems ?? [];
    const stateFor = (id: string) => states.find((s) => s.id === id);

    const posted = source.remittances.filter((r) => r.postedAt && r.claimNumber === claimNumber);

    for (const remittance of posted) {
      const datedAt = remittance.paymentDate || (remittance.postedAt ? localDay(remittance.postedAt) : "");
      for (const line of remittance.lines) {
        const denials = line.adjustments.filter(isDenialAdjustment);
        if (denials.length === 0) continue;
        // The largest refusal names the item; every refusal is summed into it,
        // because that is the money the payer kept for this line.
        const primary = denials.reduce((max, a) => (a.amountCents > max.amountCents ? a : max), denials[0]);
        const amountCents = denials.reduce((sum, a) => sum + a.amountCents, 0);
        if (amountCents <= 0) continue;

        const id = `AR-${claimNumber}-L${line.lineNumber}-${primary.carc}`;
        const state = stateFor(id);
        const ageDays = daysBetween(datedAt, nowIso);
        items.push({
          id,
          kind: "denial",
          patientId: source.patientId,
          patientName: source.patientName ?? null,
          claimNumber,
          payerName: remittance.payerName,
          lineNumber: line.lineNumber,
          cpt: line.cpt,
          group: primary.group,
          carc: primary.carc,
          carcDescription: primary.description,
          amountCents,
          patientBalanceCents,
          alreadyWrittenOffCents: line.writeOffCents,
          patientPortionCents: line.patientRespCents,
          datedAt,
          ageDays,
          bucket: agingBucketFor(ageDays),
          appealDeadline: appealDeadlineFor(datedAt),
          status: state?.status ?? "open",
          action: state?.action,
          reasonCode: state?.reasonCode,
          note: state?.note,
          assignedTo: state?.assignedTo,
          resolvedAt: state?.status === "resolved" ? state.at : undefined,
          actions: actionsFor("denial"),
        });
      }
    }

    // An appeal the student filed: the payer answers it here. The money sits on
    // the appeal record (…-A1) as owed by the payer until the student acts on
    // the decision — correct and resubmit, or write it off.
    const appealIn = claimEntries.find((e) => e.type === "transfer" && e.code === "APPEAL" && e.amountCents > 0);
    const appealOwed = claimEntries.reduce((sum, e) => sum + e.amountCents, 0);
    if (appealIn && !claimEntries.some((e) => e.eraId) && appealOwed > 0) {
      const original = originalClaimNumberOf(claimNumber);
      const filed = states.find((st) => st.action === "appeal" && st.claimNumber === original);
      const carc = filed?.id.match(/-((?:CO|PR|OA|PI)-\d+)$/)?.[1];
      const decision = appealDecisionFor(carc);
      const id = `AR-${claimNumber}-APPEAL`;
      const state = stateFor(id);
      const datedAt = appealIn.date;
      const ageDays = daysBetween(datedAt, nowIso);
      items.push({
        id,
        kind: "appeal",
        patientId: source.patientId,
        patientName: source.patientName ?? null,
        claimNumber,
        payerName: posted[posted.length - 1]?.payerName ?? source.remittances.find((r) => r.claimNumber === original)?.payerName ?? "",
        lineNumber: appealIn.lineNumber,
        carc,
        carcDescription: decision.why,
        amountCents: appealOwed,
        patientBalanceCents: 0,
        alreadyWrittenOffCents: 0,
        // A write-off of an upheld appeal writes off the whole refused amount.
        patientPortionCents: appealOwed,
        datedAt,
        ageDays,
        bucket: agingBucketFor(ageDays),
        appealDeadline: appealDeadlineFor(datedAt),
        status: state?.status ?? "open",
        action: state?.action,
        reasonCode: state?.reasonCode,
        note: state?.note,
        assignedTo: state?.assignedTo,
        resolvedAt: state?.status === "resolved" ? state.at : undefined,
        actions: actionsFor("appeal"),
      });
    }

    // The patient's side of the same claim. Its own item, its own total — the
    // queue never adds the two together, because they are different money.
    if (patientBalanceCents > 0) {
      const firstPost = posted
        .map((r) => r.postedAt)
        .filter((v): v is string => Boolean(v))
        .sort()[0];
      const datedAt = firstPost ?? (claimEntries[0]?.date || "");
      const id = `AR-${claimNumber}-BAL`;
      const state = stateFor(id);
      const ageDays = daysBetween(datedAt, nowIso);
      const lastRemittance = posted[posted.length - 1];
      items.push({
        id,
        kind: "balance",
        patientId: source.patientId,
        patientName: source.patientName ?? null,
        claimNumber,
        payerName: lastRemittance?.payerName ?? "",
        amountCents: patientBalanceCents,
        patientBalanceCents,
        alreadyWrittenOffCents: 0,
        patientPortionCents: patientBalanceCents,
        datedAt,
        ageDays,
        bucket: agingBucketFor(ageDays),
        appealDeadline: appealDeadlineFor(datedAt),
        status: state?.status ?? "open",
        action: state?.action,
        reasonCode: state?.reasonCode,
        note: state?.note,
        assignedTo: state?.assignedTo,
        resolvedAt: state?.status === "resolved" ? state.at : undefined,
        actions: actionsFor("balance"),
      });
    }
  }

  return items.sort((a, b) => b.ageDays - a.ageDays || a.id.localeCompare(b.id));
}

/** The queue totals, kept apart: refused money is not patient money. */
export interface ArQueueTotals {
  denialCount: number;
  denialCents: number;
  balanceCount: number;
  balanceCents: number;
}

export function arQueueTotals(items: ArWorkItem[]): ArQueueTotals {
  const open = items.filter((i) => i.status !== "resolved");
  const sum = (kind: ArItemKind) =>
    open.filter((i) => i.kind === kind).reduce((total, i) => total + i.amountCents, 0);
  // An upheld appeal is still the payer's refused money, so it counts with the denials.
  return {
    denialCount: open.filter((i) => i.kind === "denial" || i.kind === "appeal").length,
    denialCents: sum("denial") + sum("appeal"),
    balanceCount: open.filter((i) => i.kind === "balance").length,
    balanceCents: sum("balance"),
  };
}

// ─── Clearing an item: the money that moves ────────────────────────

export interface ArResolutionContext {
  /** The patient whose ledger the entries land on. */
  patientId: string | null;
  /** The student's phone, or "system". */
  userId: string;
  /** One clock read for the whole resolution. */
  at: string;
  /** A write-off needs a reason code — the CARC it is taken under. */
  reasonCode?: string;
}

/** The claim number a rebill or an appeal moves the money to. */
export function successorClaimNumber(claimNumber: string, action: ArAction): string {
  // Always counted from the original claim: a corrected claim of an appeal is
  // CLM-…-R1, and a second correction is R2 rather than CLM-…-R1-R1.
  const m = claimNumber.match(/^(.*?)-(R|A)(\d+)$/);
  const base = m ? m[1] : claimNumber;
  const letter = action === "rebill" ? "R" : "A";
  const n = m && m[2] === letter ? Number(m[3]) + 1 : 1;
  return `${base}-${letter}${n}`;
}

/** The claim a corrected claim or appeal descends from (`CLM-…-A1` → `CLM-…`). */
export function originalClaimNumberOf(claimNumber: string): string {
  return claimNumber.replace(/-(R|A)\d+$/, "");
}

/**
 * The payer's decision on an appeal. The denials this simulation produces are
 * all errors on the claim itself — the payer could not match the member
 * (CO-31), Box 23 had no authorisation (CO-197), or a same-day edit bundled the
 * code (CO-236) — and a payer upholds an appeal of a claim that is still wrong.
 * The fix is a corrected claim (or, when nothing can be corrected, a write-off).
 */
export function appealDecisionFor(carc: string | undefined): { upheld: true; why: string } {
  const why: Record<string, string> = {
    "CO-31":
      "Appeal upheld: the payer still cannot match the member. A name mismatch is fixed by correcting Box 4 to the name the payer holds and sending a corrected claim, not by appealing.",
    "CO-197":
      "Appeal upheld: there is still no authorisation number on the claim. If an authorisation was obtained, put it in Box 23 and send a corrected claim; if none was obtained, the service is a contractual write-off.",
    "CO-236":
      "Appeal upheld: the same-day edit still applies. If the service was truly separate, add the supporting modifier (59 / XS) and send a corrected claim; otherwise it is a contractual write-off.",
  };
  return {
    upheld: true,
    why:
      (carc && why[carc]) ??
      "Appeal upheld: the payer stands by its decision. Correct what it refused and send a corrected claim, or write the line off.",
  };
}

/**
 * The ledger entries one action writes. Deterministic ids keyed on the item, so
 * a second press appends nothing (`appendLedgerEntries` drops the duplicates)
 * and the store refuses an already-resolved item first.
 *
 * Sign convention is the ledger's own: a transfer out is negative, a transfer
 * in positive, an adjustment negative, so the patient balance stays the sum of
 * every entry.
 */
export function arResolutionEntries(item: ArWorkItem, action: ArAction, ctx: ArResolutionContext): LedgerEntry[] {
  if (item.status === "resolved") return [];
  const date = localDay(ctx.at || undefined);
  const base = {
    patientId: ctx.patientId ?? item.patientId,
    claimNumber: item.claimNumber,
    date,
    userId: ctx.userId,
    ...(item.lineNumber !== undefined ? { lineNumber: item.lineNumber } : {}),
  };
  const money = (cents: number) => `$${(Math.abs(cents) / 100).toFixed(2)}`;
  const idBase = `LEDG-${item.claimNumber}-ar-${item.id}`;

  if (action === "rebill" || action === "appeal") {
    const successor = successorClaimNumber(item.claimNumber, action);
    const verb = action === "rebill" ? "corrected claim" : "appeal";
    const code = action === "rebill" ? "REBILL" : "APPEAL";
    // The 835 posted the refusal as an adjustment that took the money off the
    // claim. Reverse it first, so the transfer moves money that is really
    // there; otherwise the denied claim goes into credit and the corrected
    // claim's payment can never reconcile.
    const reversal: LedgerEntry[] =
      item.kind === "denial" && item.carc
        ? [
            {
              ...base,
              id: `${idBase}-${action}-reverse`,
              type: "adjustment",
              code: item.carc,
              description: `${item.carc} reversed — the refusal is being worked on the ${verb} ${successor}, not written off`,
              amountCents: item.amountCents,
            },
          ]
        : [];
    return [
      ...reversal,
      {
        ...base,
        id: `${idBase}-${action}-out`,
        type: "transfer",
        code,
        description: `Transfer out — ${money(item.amountCents)} (${item.carc ?? "patient balance"}) leaves ${item.claimNumber} for the ${verb} ${successor}`,
        amountCents: -item.amountCents,
      },
      {
        ...base,
        id: `${idBase}-${action}-in`,
        claimNumber: successor,
        type: "transfer",
        code,
        description: `Transfer in — the ${verb} ${successor} carries ${money(item.amountCents)} still owed by ${item.payerName || "the payer"}`,
        amountCents: item.amountCents,
      },
    ];
  }

  if (action === "transfer_to_patient") {
    return [
      {
        ...base,
        id: `${idBase}-patient`,
        type: "transfer",
        code: "PATIENT",
        description: `Transfer to patient — ${money(item.amountCents)} refused under ${item.carc ?? "the payer's rule"} is now the patient's balance`,
        amountCents: item.amountCents,
      },
    ];
  }

  if (action === "patient_statement") return [];

  if (action === "patient_payment") {
    const paidCents = Math.max(0, item.patientPortionCents || item.amountCents);
    if (paidCents <= 0) return [];
    return [
      {
        ...base,
        id: `${idBase}-patient-payment`,
        type: "patient_payment",
        code: "PT-PMT",
        description: `Patient payment — ${money(paidCents)} received against ${item.claimNumber}`,
        amountCents: -paidCents,
      },
    ];
  }

  // Contractual write-off: capped by the patient's own money on this item,
  // because a write-off can neither give the patient a credit nor write off
  // money a CO adjustment already removed from their balance.
  const amountCents = Math.min(item.amountCents, Math.max(0, item.patientPortionCents));
  if (amountCents <= 0) return [];
  const reason = (ctx.reasonCode ?? item.carc ?? "CO-45").trim();
  return [
    {
      ...base,
      id: `${idBase}-writeoff-${reason}`,
      type: "adjustment",
      code: reason,
      description: `Write-off ${reason} — ${money(amountCents)} of ${item.claimNumber} written off contractually`,
      amountCents: -amountCents,
    },
  ];
}

/** Where a claim stands after each action, and the reason code it records. */
export interface ArResolutionOutcome {
  to: "replaced" | "appeal_pending" | "patient_responsibility" | "written_off" | "closed";
  reasonCode:
    | "CORRECTED_CLAIM_FILED"
    | "APPEAL_FILED"
    | "PATIENT_BALANCE_CREATED"
    | "WRITE_OFF_APPROVED"
    | "PATIENT_PAID";
}

export function arResolutionOutcome(action: ArAction): ArResolutionOutcome {
  switch (action) {
    case "rebill":
      return { to: "replaced", reasonCode: "CORRECTED_CLAIM_FILED" };
    case "appeal":
      return { to: "appeal_pending", reasonCode: "APPEAL_FILED" };
    case "transfer_to_patient":
      return { to: "patient_responsibility", reasonCode: "PATIENT_BALANCE_CREATED" };
    case "write_off":
      return { to: "written_off", reasonCode: "WRITE_OFF_APPROVED" };
    case "patient_statement":
      return { to: "patient_responsibility", reasonCode: "PATIENT_BALANCE_CREATED" };
    case "patient_payment":
      return { to: "closed", reasonCode: "PATIENT_PAID" };
  }
}

/**
 * One sentence for the claim timeline, saying what moved and where to. Written
 * after the entries exist, so every figure in it is one of them.
 */
export function arResolutionReason(
  item: ArWorkItem,
  action: ArAction,
  entries: LedgerEntry[],
): string {
  const money = (cents: number) => `$${(Math.abs(cents) / 100).toFixed(2)}`;
  const written = entries
    .filter((e) => e.type === "adjustment")
    .reduce((sum, e) => sum + Math.abs(e.amountCents), 0);
  const moved = entries
    .filter((e) => e.type === "transfer")
    .reduce((sum, e) => sum + Math.abs(e.amountCents), 0);

  if (action === "rebill") {
    return `Corrected claim ${successorClaimNumber(item.claimNumber, "rebill")} filed: ${money(
      moved / 2,
    )} moved off ${item.claimNumber} onto the corrected claim. The patient's balance is unchanged.`;
  }
  if (action === "appeal") {
    return `Appeal ${successorClaimNumber(item.claimNumber, "appeal")} filed against ${
      item.payerName || "the payer"
    }: ${money(moved / 2)} moved onto the appeal record. The patient's balance is unchanged.`;
  }
  if (action === "transfer_to_patient") {
    return `${money(moved)} refused under ${item.carc ?? "the payer's rule"} transferred to the patient's balance on ${item.claimNumber}.`;
  }
  if (action === "patient_statement") {
    return `Statement sent: the patient owes ${money(item.patientPortionCents || item.amountCents)} on ${item.claimNumber} (patient responsibility from the 835).`;
  }
  if (action === "patient_payment") {
    const paid = entries.filter((e) => e.type === "patient_payment").reduce((sum, e) => sum + Math.abs(e.amountCents), 0);
    return `Patient payment of ${money(paid)} posted to ${item.claimNumber}; the patient balance fell by the same amount.`;
  }
  if (written <= 0) {
    return `Write-off recorded against ${item.claimNumber}: nothing further was written off — the 835's own ${
      item.carc ?? "CO"
    } adjustment already removed this money from the patient's balance.`;
  }
  return `Write-off recorded against ${item.claimNumber}: ${money(written)} written off contractually. The patient balance fell by the same amount.`;
}


/**
 * The corrected claim a rebill opens on the biller's desk: the same paper with
 * Box 22 set to resubmission code 7 (replacement of a prior claim) and the
 * original claim number, so the payer replaces the denied claim rather than
 * reading the new one as a duplicate (CO-18).
 */
export function correctedClaimForm<T extends { resubmissionCode: string; originalClaimNumber: string }>(
  form: T,
  originalClaimNumber: string,
): T {
  return { ...form, resubmissionCode: "7", originalClaimNumber };
}

/** What the timeline tells the biller to do with the corrected claim. */
export function correctedClaimInstruction(successor: string, original: string, carc: string | undefined, howToFix: string | null): string {
  return `Corrected claim ${successor} is on Billing / Claim, replacing ${original} (Box 22: code 7, original ref ${original}). ${
    carc ? `Fix what ${carc} refused${howToFix ? ` — ${howToFix}` : ""}` : "Fix what was refused"
  } Then Validate and Submit it.`;
}
