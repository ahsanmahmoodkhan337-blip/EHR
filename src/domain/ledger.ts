/**
 * The patient ledger — money that actually moved (money-cycle items 5 and 13,
 * `specs/task-5-posting-denials-ar.md`), slice 2 of the money cycle.
 *
 * Inspiration: the account ledger every practice management system keeps under a
 * patient — Epic's account activity, eClinicalWorks' patient ledger, Dentrix's
 * ledger tab — one append-only list of charges, insurance payments, adjustments,
 * patient payments, refunds and transfers, each with a date, a code and the user
 * who posted it.
 *
 * This file is the fix for the product's biggest hole. Before it, posting wrote
 * to no ledger: `ERAPosting.tsx` held three invented remittances, the patient
 * ledger was a mock card form, and `resolveDenial` only relabelled a row. Here a
 * posted 835 becomes real entries, and every balance on screen is summed from
 * them — never stored, never typed, never invented.
 *
 * Sign convention, one rule for the whole ledger:
 *   charge                +
 *   insurance payment     −
 *   adjustment (CO / OA)  −
 *   patient payment       −
 *   refund                +
 *   transfer              + / − (the two sides of the same move)
 * so the **patient balance is the sum of every entry**. A CO write-off reduces
 * that balance to zero; a PR adjustment never appears as an entry, because the
 * patient's responsibility *is* what is left after the charge, the payment and
 * the write-off — posting it as a second entry would count it twice.
 *
 * No React, no store, no clock of its own: the caller hands in one timestamp.
 */

import type { Remittance835 } from "./adjudication";
import { localDay } from "../utils/localDay";

// ─── Entries ───────────────────────────────────────────────────────

export type LedgerEntryType =
  | "charge"
  | "insurance_payment"
  | "adjustment"
  | "patient_payment"
  | "refund"
  | "transfer";

export const LEDGER_ENTRY_LABELS: Record<LedgerEntryType, string> = {
  charge: "Charge",
  insurance_payment: "Insurance payment",
  adjustment: "Adjustment",
  patient_payment: "Patient payment",
  refund: "Refund",
  transfer: "Transfer",
};

export interface LedgerEntry {
  /** Deterministic: `LEDG-<claim>-<type>-<line>-<code>`, so a re-post is a no-op. */
  id: string;
  patientId: string | null;
  claimNumber: string;
  /** ISO date the money moved (the 835's payment date). */
  date: string;
  type: LedgerEntryType;
  /** CPT on a charge, group+CARC on an adjustment, "PAYER-PMT" on a payment. */
  code: string;
  description: string;
  /** Signed cents — see the sign convention in the file header. */
  amountCents: number;
  /** The student's phone, or "system". */
  userId: string;
  /** The 835 this entry was posted from. */
  eraId?: string;
  checkNumber?: string;
  /** The claim line this entry prices, 1-based. */
  lineNumber?: number;
  /**
   * Date of service behind a charge, where the posting knew it. Optional and
   * additive: the dental ledger ages its balance by service date, while the
   * medical entries written before this field existed simply have none.
   */
  serviceDate?: string;
}

// ─── Posting an 835 ────────────────────────────────────────────────

export interface PostContext {
  patientId: string | null;
  userId: string;
  /** One clock read for the whole posting. */
  at?: string;
  /**
   * The claim is a corrected claim or appeal whose charge is already on the
   * ledger as the transfer-in from the denied claim. Its 835 posts the payment
   * and the adjustments only — posting the charge again would bill it twice.
   */
  chargeCarried?: boolean;
}

/**
 * Turn a posted 835 into ledger entries. Pure and deterministic: posting the
 * same 835 twice produces the same ids, so the store's idempotency check can
 * refuse the second write instead of doubling the money.
 *
 * Per line: the charge, the insurance payment when the plan paid anything, and
 * one entry per CO/OA adjustment. A PR adjustment posts nothing — it is the
 * patient's balance, which is the sum of what is left.
 */
export function postRemittanceToLedger(remittance: Remittance835, ctx: PostContext): LedgerEntry[] {
  const date = localDay(ctx.at ?? remittance.paymentDate);
  const entries: LedgerEntry[] = [];

  for (const line of remittance.lines) {
    const base = {
      patientId: ctx.patientId,
      claimNumber: remittance.claimNumber,
      date,
      userId: ctx.userId,
      eraId: remittance.id,
      checkNumber: remittance.checkOrEftNumber,
      lineNumber: line.lineNumber,
    };

    if (!ctx.chargeCarried) entries.push({
      ...base,
      id: `LEDG-${remittance.claimNumber}-charge-${line.lineNumber}-${line.cpt}`,
      type: "charge",
      code: line.cpt,
      description: `Charge — CPT ${line.cpt}${line.modifiers.length ? ` (${line.modifiers.join(", ")})` : ""}, ${line.units} unit${line.units === 1 ? "" : "s"}`,
      amountCents: line.billedCents,
    });

    if (line.paidCents > 0) {
      entries.push({
        ...base,
        id: `LEDG-${remittance.claimNumber}-pay-${line.lineNumber}`,
        type: "insurance_payment",
        code: "PAYER-PMT",
        description: `Insurance payment — ${remittance.payerName}, EFT ${remittance.checkOrEftNumber}`,
        amountCents: -line.paidCents,
      });
    }

    for (const adj of line.adjustments) {
      if (adj.group !== "CO" && adj.group !== "OA") continue;
      entries.push({
        ...base,
        id: `LEDG-${remittance.claimNumber}-adj-${line.lineNumber}-${adj.carc}`,
        type: "adjustment",
        code: adj.carc,
        description: `${adj.carc} ${adj.description}`.trim(),
        amountCents: -adj.amountCents,
      });
    }
  }

  return entries;
}

// ─── Balances, summed from the entries ─────────────────────────────

export interface LedgerBalance {
  /** Everything billed. */
  chargesCents: number;
  /** Insurance money received (positive). */
  insurancePaidCents: number;
  /** Contractual and other-payer write-offs (positive). */
  adjustmentsCents: number;
  /** Patient money received (positive). */
  patientPaidCents: number;
  refundsCents: number;
  /** What the patient still owes: the sum of every entry. */
  patientBalanceCents: number;
  /**
   * What insurance still owes: money moved onto a corrected claim or an appeal
   * that the payer has not answered yet (`awaitingPayerCents`). A posted 835
   * settles it.
   */
  insuranceBalanceCents: number;
}

/**
 * The balance of a set of entries. Every figure on the ledger screen comes from
 * here — nothing adds money up on its own.
 */
export function ledgerBalance(entries: LedgerEntry[] | null | undefined): LedgerBalance {
  const list = entries ?? [];
  const sumOf = (type: LedgerEntryType) =>
    list.filter((e) => e.type === type).reduce((sum, e) => sum + e.amountCents, 0);

  const chargesCents = sumOf("charge");
  const insurancePaidCents = -sumOf("insurance_payment") || 0;
  const adjustmentsCents = -sumOf("adjustment") || 0;
  const patientPaidCents = -sumOf("patient_payment") || 0;
  const refundsCents = sumOf("refund");
  const insuranceBalanceCents = awaitingPayerCents(list);
  const patientBalanceCents = list.reduce((sum, e) => sum + e.amountCents, 0) - insuranceBalanceCents;

  return {
    chargesCents,
    insurancePaidCents,
    adjustmentsCents,
    patientPaidCents,
    refundsCents,
    patientBalanceCents,
    insuranceBalanceCents,
  };
}

/**
 * Money the payer still owes on a corrected claim or an appeal: the claim
 * carries a REBILL / APPEAL transfer-in and no 835 has been posted to it yet.
 * Until then it is not the patient's balance — the payer has been asked again.
 */
export function awaitingPayerCents(entries: LedgerEntry[]): number {
  const byClaim = new Map<string, LedgerEntry[]>();
  for (const e of entries) {
    const list = byClaim.get(e.claimNumber) ?? [];
    list.push(e);
    byClaim.set(e.claimNumber, list);
  }
  let cents = 0;
  for (const list of byClaim.values()) {
    const transferredIn = list.some(
      (e) => e.type === "transfer" && e.amountCents > 0 && (e.code === "REBILL" || e.code === "APPEAL"),
    );
    if (!transferredIn || list.some((e) => e.eraId)) continue;
    cents += list.reduce((sum, e) => sum + e.amountCents, 0);
  }
  return Math.max(0, cents);
}

/** Is this claim a corrected claim or appeal whose charge came in as a transfer? */
export function chargeCarriedByTransfer(entries: LedgerEntry[] | null | undefined, claimNumber: string): boolean {
  return (entries ?? []).some(
    (e) =>
      e.claimNumber === claimNumber &&
      e.type === "transfer" &&
      e.amountCents > 0 &&
      (e.code === "REBILL" || e.code === "APPEAL"),
  );
}

/** The entries posted from one claim, oldest first. */
export function ledgerEntriesForClaim(
  entries: LedgerEntry[] | null | undefined,
  claimNumber: string | null | undefined,
): LedgerEntry[] {
  if (!claimNumber) return [];
  return (entries ?? []).filter((e) => e.claimNumber === claimNumber);
}

/**
 * True when the ledger agrees with the 835 it was posted from: the patient's
 * balance equals the patient responsibility the payer reported. This is the
 * check the posting screen runs, so a rounding or double-post defect is visible
 * immediately instead of months later.
 */
export function ledgerAgreesWithRemittance(
  entries: LedgerEntry[] | null | undefined,
  remittance: Remittance835,
): boolean {
  const balance = ledgerBalance(ledgerEntriesForClaim(entries, remittance.claimNumber));
  return (
    balance.patientBalanceCents === remittance.totals.patientRespCents &&
    balance.insurancePaidCents === remittance.totals.paidCents
  );
}

/** Add entries, refusing any whose id is already on the ledger. */
export function appendLedgerEntries(
  existing: LedgerEntry[] | null | undefined,
  incoming: LedgerEntry[],
): LedgerEntry[] {
  const list = existing ?? [];
  const known = new Set(list.map((e) => e.id));
  const fresh = incoming.filter((e) => !known.has(e.id));
  return fresh.length === 0 ? list : [...list, ...fresh];
}

// ─── One patient's ledger, across every visit ──────────────────────

/** One row of the patient ledger: the entry and the balance after it. */
export interface PatientLedgerRow {
  entry: LedgerEntry;
  /**
   * The patient's balance once this entry was posted, in signed cents. The
   * newest row's balance is the patient's balance — it is the same sum
   * `ledgerBalance` returns, shown step by step so a student can trace it.
   */
  balanceCents: number;
}

/**
 * Every entry posted against one patient, newest first
 * (`specs/patient-hub.md` § Ledger). An entry with no patient id belongs to no
 * chart and is never shown under one.
 *
 * Entries posted the same day keep the order they were posted in, so the
 * running balance reads down the screen the way the money moved.
 */
export function ledgerEntriesForPatient(
  entries: LedgerEntry[] | null | undefined,
  patientId: string | null | undefined,
): LedgerEntry[] {
  if (!patientId) return [];
  return (entries ?? []).filter((entry) => entry.patientId === patientId).reverse();
}

/**
 * The patient ledger with the running balance, newest first. The balance on
 * each row is the sum of every entry posted up to and including it, in posting
 * order — never a figure typed or stored anywhere.
 */
export function patientLedgerRows(
  entries: LedgerEntry[] | null | undefined,
  patientId: string | null | undefined,
): PatientLedgerRow[] {
  const mine = (entries ?? []).filter((entry) => patientId && entry.patientId === patientId);
  const rows: PatientLedgerRow[] = [];
  let running = 0;
  for (const entry of mine) {
    running += entry.amountCents;
    rows.push({ entry, balanceCents: running });
  }
  return rows.reverse();
}

/** What this patient still owes, summed from their own entries. */
export function patientBalanceCents(
  entries: LedgerEntry[] | null | undefined,
  patientId: string | null | undefined,
): number {
  return ledgerBalance(ledgerEntriesForPatient(entries, patientId)).patientBalanceCents;
}
