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
  const date = (ctx.at ?? remittance.paymentDate).slice(0, 10);
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

    entries.push({
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
   * What insurance still owes. A posted 835 settles the payer's share, so this
   * is zero once the claim is adjudicated; it is here for the entries written
   * before posting, and for the next slice's secondary claims.
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
  const patientBalanceCents = list.reduce((sum, e) => sum + e.amountCents, 0);

  return {
    chargesCents,
    insurancePaidCents,
    adjustmentsCents,
    patientPaidCents,
    refundsCents,
    patientBalanceCents,
    insuranceBalanceCents: 0,
  };
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
