/**
 * railPages.ts — the pure builders behind the five money-cycle rail pages
 *
 * Spec `eleven-rail-pages.md` (owner decisions, 2026-11-20). Coding, Claims,
 * Payments, Denials and AR, and Reports are real pages now, and each one shows
 * only records the student produced. This module holds the counting and reading
 * rules: no React, no store, no DOM, so every rule below is tested directly
 * (`tests/rail-pages.test.ts`).
 *
 * Three rules, applied to every builder here:
 *
 *  1. **No figure is invented.** A count or a dollar is summed from a record the
 *     student's own work wrote — an encounter's `statusEvents`, its `remittances`
 *     and its `ledger`, or the AR queue derived from them. When the record holds
 *     nothing, the builder returns no row and the page says which stage produces
 *     the first one.
 *  2. **One row, one control.** Every row carries the single target that opens
 *     the stage where its work is done, so a row can never be a dead end.
 *  3. **The dental track is shown as it is.** Dental posting stops at the ledger
 *     (no 835 is posted there), so the dental rows read the ledger and the
 *     adjudication and say so, rather than pretending to have an 835.
 */

import { findCase, findPlan } from "../data/dental";
import { adjudicateDentalClaim } from "../components/dental/adjudication";
import type { DentalTrackState } from "../components/dental/DentalTrackStore";
import {
  AGING_BUCKETS,
  AR_ACTION_LABELS,
  type AgingBucket,
  type ArWorkItem,
} from "./arWorkQueue";
import { CLAIM_STATUS_LABELS, type ClaimStatus } from "./claimStatus";
import { buildCodingQueue } from "./codingQueue";
import { claimRowTitle, isOrphanClaim } from "./dataScoping";
import { formatWhen, usd } from "./homeWorkQueues";
import type { PipelineEncounter, Role } from "../store/pipelineEncounter";

// ─── The shape every page renders ──────────────────────────────────

/** Where a row's work is done. One target, so a row is never a dead end. */
export type RailTarget =
  | {
      kind: "medical";
      patientId: string | null;
      role: Role;
      /**
       * The encounter stage the row opens, when it has one: the row becomes the
       * address `/encounter/<patientId>/<stage>` instead of switching the chart's
       * role. Set by the Coding queue, whose rows open that patient's Coding.
       */
      stage?: string;
    }
  | { kind: "dental"; caseId: string; stage: string };

export interface RailField {
  label: string;
  value: string;
}

export interface RailRow {
  id: string;
  /** The claim number and the patient — what the row is about. */
  title: string;
  /** The facts behind the row, each one read off a saved record. */
  fields: RailField[];
  /** The one control on the row, named for what it opens. */
  action: string;
  target: RailTarget;
}

export type NameForPatient = (
  patientId: string | null | undefined,
  fallback?: string | null,
) => string;

/** "no payer captured" beats an empty cell that looks like a missing record. */
function orNone(value: string | null | undefined, none = "not captured"): string {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : none;
}

// ─── Coding ────────────────────────────────────────────────────────

/**
 * Encounters with a **signed and locked note and no submitted codes yet**,
 * newest first. The signature is the encounter's own `NOTE_SIGNED` timeline
 * entry — the same event Sign & Lock writes — so a note that was never signed
 * cannot appear here, and nothing is read from a draft.
 */
export function buildCodingRows({
  encounters,
  nameForPatient,
}: {
  encounters: PipelineEncounter[];
  nameForPatient: NameForPatient;
}): RailRow[] {
  // One rule, one module: `domain/codingQueue.ts` decides which encounters the
  // coder is waiting on. This builder is the older, single-list view of it.
  return buildCodingQueue({ encounters, nameForPatient }).signedNotCoded;
}

/** A dental case sitting on its Coding stage with no coded lines yet. */
export function buildDentalCodingRow(
  dental: DentalTrackState,
  caseLabel: string,
): RailRow | null {
  if (!dental.caseId || dental.completedAt !== null) return null;
  if (dental.stage !== "coding" || dental.lines.length > 0) return null;
  return {
    id: `coding-${dental.caseId}`,
    title: caseLabel,
    fields: [
      { label: "Stage", value: "Coding" },
      { label: "Coded lines", value: "none yet" },
      { label: "Claim", value: dental.claimNumber ?? "not built yet" },
    ],
    action: "Open the coding stage",
    target: { kind: "dental", caseId: dental.caseId, stage: "coding" },
  };
}

// ─── Claims ────────────────────────────────────────────────────────

export interface ClaimRow extends RailRow {
  claimNumber: string;
  /** Null only for a claim record whose status was never written. */
  statusKey: ClaimStatus | null;
  statusLabel: string;
  payer: string;
  dateOfService: string;
  billedCents: number;
}

/** The payer the claim's own paper or its 835 names. Never guessed from a CPT. */
function payerFor(enc: PipelineEncounter): string {
  const fromPaper = (enc.claimForm?.payerName ?? "").trim();
  if (fromPaper) return fromPaper;
  const remittance = enc.remittances[enc.remittances.length - 1];
  return (remittance?.payerName ?? "").trim();
}

/** The first date of service the claim's lines carry. */
function dateOfServiceFor(enc: PipelineEncounter): string {
  const line = enc.claimForm?.serviceLines.find((l) => (l.dateOfService ?? "").trim());
  if (line) return line.dateOfService;
  const posted = enc.statusEvents.find((e) => e.reasonCode === "SUBMITTED_837P");
  return posted ? posted.at.slice(0, 10) : "";
}

/** The claim's own total charge (box 28), or the sum of its coded lines. */
function billedCentsFor(enc: PipelineEncounter): number {
  if (enc.claimForm && Number.isFinite(enc.claimForm.totalCharge) && enc.claimForm.totalCharge > 0) {
    return Math.round(enc.claimForm.totalCharge * 100);
  }
  const cents = enc.codingLines.reduce((sum, line) => sum + Math.round((line.charge ?? 0) * 100), 0);
  return cents > 0 ? cents : 0;
}

/** What a claim row says when the patient it names has no chart to open. */
const MISSING_CHART_LABEL = "patient record missing — this claim has no chart to open";

/**
 * Every claim the student has — one row per claim number, with the status the
 * claim's own timeline last recorded. A claim with no status yet reads as
 * **Draft**, which is what a claim record with no recorded transition is.
 *
 * TWO ROWS THE PAGE NO LONGER PRINTS (owner's student-experience work order,
 * 2026-11-21, item 4: "fix or remove claims showing 'No patient attached'"):
 *
 *  - a **claim with no patient** — a record an earlier build wrote into the
 *    bucket for work with no chart (audit item 5). It cannot be billed, coded,
 *    opened or traced to anything, so it is not listed as a claim of the
 *    student's. The record itself is **kept in the store, never deleted**; only
 *    the list leaves it out.
 *  - a claim whose patient id names **no chart on file** is still listed, because
 *    the claim is real work, but it says `patient record missing` instead of
 *    pretending a name. It never prints "No patient attached".
 */
export function buildClaimRows({
  encounters,
  nameForPatient,
}: {
  encounters: PipelineEncounter[];
  nameForPatient: NameForPatient;
}): ClaimRow[] {
  const rows: ClaimRow[] = [];
  for (const enc of encounters) {
    if (!enc.claimNumber) continue;
    // No patient, no claim on this page. Kept in the record, not printed here.
    if (isOrphanClaim(enc)) continue;
    const statusKey = enc.claimStatus;
    const billedCents = billedCentsFor(enc);
    const named = nameForPatient(enc.patientId, enc.displayName).trim();
    const patientLabel = named.length > 0 && named !== "No patient attached" ? named : MISSING_CHART_LABEL;
    rows.push({
      id: `claim-${enc.claimNumber}`,
      claimNumber: enc.claimNumber,
      title: claimRowTitle(enc.claimNumber, patientLabel, false),
      statusKey,
      statusLabel: statusKey ? CLAIM_STATUS_LABELS[statusKey] : "Draft",
      payer: payerFor(enc),
      dateOfService: dateOfServiceFor(enc),
      billedCents,
      fields: [
        { label: "Status", value: statusKey ? CLAIM_STATUS_LABELS[statusKey] : "Draft" },
        { label: "Payer", value: orNone(payerFor(enc)) },
        { label: "Date of service", value: orNone(dateOfServiceFor(enc)) },
        {
          label: "Billed",
          value: billedCents > 0 ? usd(billedCents) : "no charge coded yet",
        },
      ],
      action: "Open this claim",
      target: { kind: "medical", patientId: enc.patientId, role: "biller" },
    });
  }
  return rows.sort((a, b) => (a.claimNumber < b.claimNumber ? 1 : -1));
}

/**
 * The claims list for the track the student is working in (owner item 4:
 * "/claims: filter claims by the active track"). A medical claim never appears
 * under the dental track and the dental case's ADA claim never appears under the
 * medical one — the two use different code sets and different claim papers, so a
 * mixed list taught the wrong thing.
 */
export function claimRowsForTrack({
  track,
  medical,
  dental,
}: {
  track: "medical" | "dental";
  medical: ClaimRow[];
  dental: ClaimRow | null;
}): ClaimRow[] {
  if (track === "dental") return dental ? [dental] : [];
  return medical;
}

/** A dental case's own ADA claim, when it has transmitted one. */
export function buildDentalClaimRow(
  dental: DentalTrackState,
  caseLabel: string,
): ClaimRow | null {
  if (!dental.caseId || !dental.claimNumber) return null;
  const activeCase = findCase(dental.caseId);
  const chargedCents = dental.lines.reduce((sum, line) => sum + Math.round(line.feeUsd * 100), 0);
  const submitted = dental.statusEvents.find((e) => e.reasonCode === "SUBMITTED_837P");
  const dos = dental.lines[0]?.dateOfService ?? (submitted ? submitted.at.slice(0, 10) : "");
  const statusKey = dental.claimStatus;
  return {
    id: `claim-${dental.claimNumber}`,
    claimNumber: dental.claimNumber,
    title: `${dental.claimNumber} · ${caseLabel}`,
    statusKey,
    statusLabel: statusKey ? CLAIM_STATUS_LABELS[statusKey] : "Draft",
    payer: "",
    dateOfService: dos,
    billedCents: chargedCents,
    fields: [
      { label: "Status", value: statusKey ? CLAIM_STATUS_LABELS[statusKey] : "Draft" },
      { label: "Payer", value: orNone(findPlan(activeCase?.planId ?? "")?.payerName ?? "") },
      { label: "Date of service", value: orNone(dos) },
      { label: "Billed", value: chargedCents > 0 ? usd(chargedCents) : "no charge coded yet" },
    ],
    action: "Open the claim stage",
    target: { kind: "dental", caseId: dental.caseId, stage: "claim" },
  };
}

export interface ClaimFilters {
  /** "" means every status. */
  status: string;
  /** "" means every payer. */
  payer: string;
  /** "" means every date; otherwise an exact date of service (YYYY-MM-DD). */
  date: string;
}

export const EMPTY_CLAIM_FILTERS: ClaimFilters = { status: "", payer: "", date: "" };

/** The three filters the owner asked for: status, payer and date. */
export function filterClaimRows(rows: ClaimRow[], filters: ClaimFilters): ClaimRow[] {
  return rows.filter((row) => {
    if (filters.status && row.statusKey !== filters.status) return false;
    if (filters.payer && row.payer !== filters.payer) return false;
    if (filters.date && row.dateOfService !== filters.date) return false;
    return true;
  });
}

/** The payers the student's own claims name — so no filter offers a phantom. */
export function payerOptions(rows: ClaimRow[]): string[] {
  return [...new Set(rows.map((row) => row.payer).filter((payer) => payer.length > 0))].sort();
}

/** The statuses the student's own claims are in, in the ladder's order. */
export function statusOptions(rows: ClaimRow[]): { value: ClaimStatus; label: string }[] {
  const present = new Set<ClaimStatus>();
  for (const row of rows) if (row.statusKey) present.add(row.statusKey);
  return [...present]
    .sort((a, b) => CLAIM_STATUS_LABELS[a].localeCompare(CLAIM_STATUS_LABELS[b]))
    .map((status) => ({ value: status, label: CLAIM_STATUS_LABELS[status] }));
}

// ─── Payments ──────────────────────────────────────────────────────

export interface PaymentRow extends RailRow {
  payer: string;
  paymentDate: string;
  amountCents: number;
  lines: number;
}

/**
 * 835 remittances waiting to be posted — a payer answered, and the money has
 * not reached the ledger yet. A posted 835 is not on this page: it is on the
 * ledger, and its unpaid lines are AR work.
 */
export function buildPaymentRows({
  encounters,
  nameForPatient,
}: {
  encounters: PipelineEncounter[];
  nameForPatient: NameForPatient;
}): PaymentRow[] {
  const rows: (PaymentRow & { receivedAt: string })[] = [];
  for (const enc of encounters) {
    for (const remittance of enc.remittances) {
      if (remittance.postedAt) continue;
      rows.push({
        id: `payment-${remittance.id}`,
        title: `${remittance.claimNumber} · ${nameForPatient(enc.patientId, enc.displayName)}`,
        payer: remittance.payerName,
        paymentDate: remittance.paymentDate,
        amountCents: remittance.totals.paidCents,
        lines: remittance.lines.length,
        receivedAt: remittance.receivedAt,
        fields: [
          { label: "Payer", value: orNone(remittance.payerName) },
          { label: "Payment date", value: orNone(remittance.paymentDate) },
          { label: "Amount", value: usd(remittance.totals.paidCents) },
          { label: "Lines to post", value: String(remittance.lines.length) },
        ],
        action: "Post this 835",
        target: { kind: "medical", patientId: enc.patientId, role: "biller" },
      });
    }
  }
  return rows
    .sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : a.receivedAt > b.receivedAt ? -1 : 0))
    .map(({ receivedAt: _receivedAt, ...row }) => row);
}

export interface DentalPaymentRow extends RailRow {
  date: string;
  amountCents: number;
}

/**
 * The dental track posts no 835 (spec § honest limits): what it holds is the
 * ledger, so that is what this page shows for it — the insurance payments the
 * ledger actually records, each naming its own claim.
 */
export function buildDentalPaymentRows(dental: DentalTrackState, caseLabel: string): DentalPaymentRow[] {
  if (!dental.caseId) return [];
  return dental.ledger
    .filter((entry) => entry.type === "insurance_payment")
    .map((entry) => ({
      id: `dental-payment-${entry.id}`,
      title: `${entry.claimNumber} · ${caseLabel}`,
      date: entry.date,
      amountCents: entry.amountCents,
      fields: [
        { label: "Payer", value: "posted by hand — no 835 in the dental track" },
        { label: "Date", value: entry.date },
        { label: "Amount", value: usd(entry.amountCents) },
        { label: "Claim", value: entry.claimNumber },
      ],
      action: "Open the ledger stage",
      target: { kind: "dental", caseId: dental.caseId ?? "", stage: "remittance" },
    }));
}

// ─── Denials and AR ────────────────────────────────────────────────

export interface DenialRow extends RailRow {
  group: string;
  carc: string;
  carcDescription: string;
  rarc: string;
  payer: string;
  amountCents: number;
  appealDeadline: string;
  bucket: AgingBucket;
  appealed: boolean;
  resolved: boolean;
}

/**
 * The RARC a denial's 835 carries, when it carries one. The app ships no RARC
 * list (`data/claims/carc.ts`), so this reads the remark the 835 itself holds
 * and says "none on this 835" when there is not one — it never invents a code.
 */
export function rarcFor(encounters: PipelineEncounter[], item: ArWorkItem): string {
  for (const enc of encounters) {
    for (const remittance of enc.remittances) {
      if (remittance.claimNumber !== item.claimNumber) continue;
      for (const line of remittance.lines) {
        if (line.lineNumber !== item.lineNumber) continue;
        const adjustment = line.adjustments.find((a) => a.carc === item.carc);
        const remark = (adjustment?.remark ?? "").trim();
        if (remark) return remark;
      }
    }
  }
  return "none on this 835";
}

/** Every denied line of a posted 835, with the money and the appeal deadline. */
export function buildDenialRows({
  items,
  encounters,
  nameForPatient,
}: {
  items: ArWorkItem[];
  encounters: PipelineEncounter[];
  nameForPatient: NameForPatient;
}): DenialRow[] {
  return items
    .filter((item) => item.kind === "denial")
    .map((item) => {
      const rarc = rarcFor(encounters, item);
      return {
        id: item.id,
        title: `${item.claimNumber} · ${nameForPatient(item.patientId, item.patientName)}`,
        group: item.group ?? "CO",
        carc: item.carc ?? "",
        carcDescription: item.carcDescription ?? "",
        rarc,
        payer: item.payerName,
        amountCents: item.amountCents,
        appealDeadline: item.appealDeadline,
        bucket: item.bucket,
        appealed: item.action === "appeal",
        resolved: item.status === "resolved",
        fields: [
          { label: "Group / CARC", value: `${item.group ?? "CO"}-${item.carc ?? ""}` },
          { label: "RARC", value: rarc },
          { label: "Payer", value: orNone(item.payerName) },
          { label: "Amount", value: usd(item.amountCents) },
          { label: "Appeal deadline", value: item.appealDeadline },
          { label: "Line", value: item.lineNumber ? `${item.lineNumber}${item.cpt ? ` · ${item.cpt}` : ""}` : "claim level" },
        ],
        action: "Work this denial",
        target: { kind: "medical" as const, patientId: item.patientId, role: "ar-voice" as const },
      };
    });
}

/** Not worked yet, versus appealed and waiting on the payer's answer. */
export function splitDenialRows(rows: DenialRow[]): { toWork: DenialRow[]; appealed: DenialRow[] } {
  return {
    toWork: rows.filter((row) => !row.appealed),
    appealed: rows.filter((row) => row.appealed),
  };
}

export interface ArRow extends RailRow {
  kind: "denial" | "balance";
  bucket: AgingBucket;
  ageDays: number;
  followUp: string;
  lastAction: string;
  note: string;
  amountCents: number;
  resolved: boolean;
}

/**
 * The AR worklist: one row per item the queue derives from posted money, with
 * its age, its bucket, its follow-up date and the work the student has recorded
 * against it. Only the work is stored; the queue itself is derived.
 */
export function buildArRows({
  items,
  nameForPatient,
}: {
  items: ArWorkItem[];
  nameForPatient: NameForPatient;
}): ArRow[] {
  return items.map((item) => {
    const lastAction = item.action
      ? AR_ACTION_LABELS[item.action]
      : item.status === "resolved"
        ? "resolved"
        : item.status === "open"
          ? "not worked yet"
          : item.status;
    return {
      id: item.id,
      kind: item.kind,
      title: `${item.claimNumber} · ${nameForPatient(item.patientId, item.patientName)}`,
      bucket: item.bucket,
      ageDays: item.ageDays,
      followUp: item.appealDeadline,
      lastAction,
      note: item.note ?? "no note yet",
      amountCents: item.amountCents,
      resolved: item.status === "resolved",
      fields: [
        { label: "Age", value: `${item.ageDays} days · ${item.bucket}` },
        { label: "Follow-up", value: item.appealDeadline },
        { label: "Last action", value: lastAction },
        { label: "Amount", value: usd(item.amountCents) },
        { label: "Assigned to", value: item.assignedTo ?? "nobody yet" },
        { label: "Note", value: item.note ?? "no note yet" },
      ],
      action: "Open this AR item",
      target: { kind: "medical", patientId: item.patientId, role: "ar-voice" },
    };
  });
}

/** The 0-30 / 31-60 / 61-90 / 91-120 / 120+ totals, refused money and patient money apart. */
export function arAgingTotals(
  items: ArWorkItem[],
): { bucket: AgingBucket; count: number; cents: number }[] {
  const open = items.filter((item) => item.status !== "resolved");
  return AGING_BUCKETS.map((bucket) => {
    const inBucket = open.filter((item) => item.bucket === bucket);
    return {
      bucket,
      count: inBucket.length,
      cents: inBucket.reduce((sum, item) => sum + item.amountCents, 0),
    };
  });
}

// ─── Reports ───────────────────────────────────────────────────────

export interface ReportMoney {
  postedRemittances: number;
  billedCents: number;
  allowedCents: number;
  paidCents: number;
  adjustedCents: number;
  patientRespCents: number;
}

export interface ReportTotals {
  claimCount: number;
  claimsByStatus: { status: ClaimStatus; label: string; count: number }[];
  /** Null until at least one 835 has been posted — nothing is estimated. */
  money: ReportMoney | null;
  denialsByCode: { code: string; description: string; count: number; cents: number }[];
  aging: { bucket: AgingBucket; count: number; cents: number }[];
  arOpenCount: number;
}

/**
 * The student's own numbers. Every dollar is summed from a **posted** 835's own
 * totals — the money that reached the ledger — and every count from a record
 * that exists. Nothing here is sampled, projected or trended.
 */
export function buildReportTotals({
  encounters,
  items,
}: {
  encounters: PipelineEncounter[];
  items: ArWorkItem[];
}): ReportTotals {
  const statusCounts = new Map<ClaimStatus, number>();
  let claimCount = 0;
  for (const enc of encounters) {
    if (!enc.claimNumber) continue;
    claimCount += 1;
    const status = enc.claimStatus ?? "draft";
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
  }

  let money: ReportMoney | null = null;
  for (const enc of encounters) {
    for (const remittance of enc.remittances) {
      if (!remittance.postedAt) continue;
      money ??= {
        postedRemittances: 0,
        billedCents: 0,
        allowedCents: 0,
        paidCents: 0,
        adjustedCents: 0,
        patientRespCents: 0,
      };
      money.postedRemittances += 1;
      money.billedCents += remittance.totals.billedCents;
      money.allowedCents += remittance.totals.allowedCents;
      money.paidCents += remittance.totals.paidCents;
      money.adjustedCents += remittance.totals.writeOffCents;
      money.patientRespCents += remittance.totals.patientRespCents;
    }
  }

  const denialMap = new Map<string, { code: string; description: string; count: number; cents: number }>();
  for (const item of items) {
    if (item.kind !== "denial") continue;
    const code = `${item.group ?? "CO"}-${item.carc ?? ""}`;
    const entry = denialMap.get(code) ?? {
      code,
      description: item.carcDescription ?? "",
      count: 0,
      cents: 0,
    };
    entry.count += 1;
    entry.cents += item.amountCents;
    denialMap.set(code, entry);
  }

  return {
    claimCount,
    claimsByStatus: [...statusCounts.entries()]
      .sort((a, b) => CLAIM_STATUS_LABELS[a[0]].localeCompare(CLAIM_STATUS_LABELS[b[0]]))
      .map(([status, count]) => ({ status, label: CLAIM_STATUS_LABELS[status], count })),
    money,
    denialsByCode: [...denialMap.values()].sort((a, b) => b.cents - a.cents),
    aging: arAgingTotals(items),
    arOpenCount: items.filter((item) => item.status !== "resolved").length,
  };
}

export interface DentalReportTotals {
  claimNumber: string | null;
  claimStatusLabel: string | null;
  /** Ledger money by entry type — what the dental track actually holds. */
  ledger: { label: string; count: number; cents: number }[];
  deniedLines: number;
  patientOwesCents: number;
}

/**
 * The dental track's own numbers, read from its ledger and its adjudication.
 * No 835 is posted there, so no allowed/paid split is claimed.
 */
export function buildDentalReportTotals(dental: DentalTrackState): DentalReportTotals {
  const labels: Record<string, string> = {
    charge: "Charges",
    insurance_payment: "Insurance payments",
    adjustment: "Adjustments",
    patient_payment: "Patient payments",
    refund: "Refunds",
    transfer: "Transfers",
  };
  const byType = new Map<string, { label: string; count: number; cents: number }>();
  for (const entry of dental.ledger) {
    const entryBucket = byType.get(entry.type) ?? {
      label: labels[entry.type] ?? entry.type,
      count: 0,
      cents: 0,
    };
    entryBucket.count += 1;
    entryBucket.cents += entry.amountCents;
    byType.set(entry.type, entryBucket);
  }

  const activeCase = dental.caseId ? findCase(dental.caseId) : undefined;
  const adjudication = activeCase ? adjudicateDentalClaim(dental.lines, activeCase) : null;
  const deniedLines = adjudication
    ? adjudication.lines.filter((line) => line.denial && !dental.lineResolutions[line.lineId]).length
    : 0;
  const patientOwesCents = adjudication
    ? Math.round(adjudication.totals.patientOwesUsd * 100)
    : 0;

  return {
    claimNumber: dental.claimNumber,
    claimStatusLabel: dental.claimStatus ? CLAIM_STATUS_LABELS[dental.claimStatus] : null,
    ledger: [...byType.values()],
    deniedLines,
    patientOwesCents,
  };
}

// ─── Dental denials ────────────────────────────────────────────────

export interface DentalDenialRow extends RailRow {
  code: string;
  denialId: string;
  denialTitle: string;
  patientOwesCents: number;
}

/** Denied dental lines with no decision recorded against them yet. */
export function buildDentalDenialRows(
  dental: DentalTrackState,
  caseLabel: string,
): DentalDenialRow[] {
  if (!dental.caseId) return [];
  const activeCase = findCase(dental.caseId);
  if (!activeCase || dental.lines.length === 0) return [];
  const adjudication = adjudicateDentalClaim(dental.lines, activeCase);
  const rows: DentalDenialRow[] = [];
  for (const line of adjudication.lines) {
    if (!line.denial) continue; // a downgrade is covered, never a denial
    if (dental.lineResolutions[line.lineId]) continue; // already decided
    const patientOwesCents = Math.round(line.result.patientOwesUsd * 100);
    rows.push({
      id: `dental-denial-${line.lineId}`,
      title: `${line.code} · ${caseLabel}`,
      code: line.code,
      denialId: line.denial.id,
      denialTitle: line.denial.title,
      patientOwesCents,
      fields: [
        { label: "Denial", value: `${line.denial.id} — ${line.denial.title}` },
        { label: "Patient share", value: usd(patientOwesCents) },
        { label: "Claim", value: dental.claimNumber ?? "not transmitted yet" },
      ],
      action: "Work this denial",
      target: { kind: "dental", caseId: dental.caseId, stage: "ar" },
    });
  }
  return rows;
}

// ─── Small helpers the pages share ─────────────────────────────────

/** The label a dental case is known by in a row: `D-1001 · Ada Lovelace`. */
export function dentalCaseLabel(dental: DentalTrackState): string {
  const activeCase = dental.caseId ? findCase(dental.caseId) : undefined;
  if (!activeCase || !dental.caseId) return "No dental case open";
  return `${dental.caseId} · ${activeCase.patient.firstName} ${activeCase.patient.lastName}`;
}
