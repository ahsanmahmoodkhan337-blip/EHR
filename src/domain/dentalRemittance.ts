/**
 * Dental 835 remittance, its balance rule, and the posting that makes money
 * move — `specs/task-5-posting-denials-ar.md` items 1, 3, 5 and 13, following
 * the medical money-cycle slice 2 (`src/domain/adjudication.ts`,
 * `src/domain/ledger.ts`).
 *
 * Inspired by: the X12 835 an ADA claim comes back on — the electronic
 * remittance advice a dental biller posts in Dentrix, Open Dental or an
 * Eaglesoft clearinghouse portal. Before this file the dental remittance was a
 * read-only sample: the payer answered, and nothing reached the patient's
 * account.
 *
 * Three things live here on purpose, so the screen, the posting step and the
 * tests cannot drift apart:
 *
 *  1. `buildDentalClaimRemittance()` turns an adjudicated dental claim into its
 *     OWN 835 — one line per CDT code, with group code + CARC per adjustment.
 *     The sample ERAs (ERA-01…ERA-03) stay practice material and are never
 *     postable.
 *  2. `dentalLineBalances()` is the ONLY definition of "does this line balance":
 *     charged = paid + contractual write-off + provider adjustment + patient.
 *  3. `postDentalRemittanceToLedger()` turns that 835 into ledger entries, and
 *     `dentalLedgerAgreesWithRemittance()` proves the result matches the 835.
 *
 * Owner's money rule, applied at both ends (2026-11-20, "same as medical"):
 *   CO (contractual) → a write-off; the patient balance on that line is 0.
 *   OA (other payer) → never lands on the patient; the patient owes 0.
 *   PR (patient responsibility) → posts no entry. It IS the balance left after
 *     the charge, the payment and the write-off, so posting it would count the
 *     same money twice.
 */

import type {
  CoverageResult,
  DentalDenial,
  EraClaimLine,
  EraLineAdjustment,
  EraRemittance,
} from "../data/dental";
import { ledgerBalance, type LedgerEntry } from "./ledger";

/** Dollars to cents, and back — the data layer keeps dollars, the ledger cents. */
function cents(usd: number): number {
  return Math.round(usd * 100);
}

function round2(usd: number): number {
  return Math.round(usd * 100) / 100;
}

function money(usd: number): string {
  return `$${round2(usd).toFixed(2)}`;
}

/** "PR-119" → "119". The group letter is carried separately on the adjustment. */
function carcNumber(carc: string): string {
  const parts = carc.split("-");
  return parts.length > 1 ? parts[parts.length - 1] : carc;
}

/**
 * A CO-59 on a paid line is the alternate-benefit downgrade: the difference
 * between the all-ceramic crown and the metal allowance is the patient's
 * upgrade, and it is already inside `patientOwesUsd`. It is NOT a write-off, so
 * it must never become a ledger adjustment.
 */
function isDowngradeAdjustment(adjustment: EraLineAdjustment): boolean {
  return adjustment.groupCode === "CO" && adjustment.reasonCode === "59";
}

// ─── Building the claim's own 835 ──────────────────────────────────

/** One adjudicated claim line, as the claim queue holds it. */
export interface DentalRemittanceLineInput {
  /** 1-based claim line number. */
  line: number;
  code: string;
  tooth?: string;
  dateOfService: string;
  result: CoverageResult;
  /** The denial record behind a blocked line, where one blocked it. */
  denial?: DentalDenial;
}

export interface DentalRemittanceInput {
  claimNumber: string;
  payerPlanId: string;
  patientName: string;
  /** ISO date the payer would print on the remittance. */
  remittanceDate: string;
  lines: DentalRemittanceLineInput[];
}

/**
 * Build this claim's 835 from its adjudication. Every figure comes from the
 * coverage result — nothing is estimated here, and the four money columns are
 * forced to add up to the charge:
 *
 *   writeOff  = charge above the contracted allowance (only when the patient is
 *               liable for the line; a CO/OA denial writes the whole charge off)
 *   providerAdj = whatever is left after the payment and the patient's share —
 *               the CO/OA denial amount, never billable to the patient
 *   patientOwes = the coverage engine's own figure
 */
export function buildDentalClaimRemittance(input: DentalRemittanceInput): EraRemittance {
  const lines: EraClaimLine[] = input.lines.map((line) => {
    const result = line.result;
    const charged = round2(result.chargedUsd);
    const allowed = round2(result.allowedUsd);
    const paid = round2(result.planPaysUsd);
    const patientOwes = round2(result.patientOwesUsd);
    const writeOff = result.patientLiable ? round2(Math.max(0, charged - allowed)) : 0;
    const providerAdjustment = round2(Math.max(0, charged - writeOff - paid - patientOwes));

    const adjustments: EraLineAdjustment[] = [];
    if (writeOff > 0) {
      adjustments.push({
        groupCode: "CO",
        reasonCode: "45",
        amountUsd: writeOff,
        note: "Contractual write-off: the part of the charge above the contracted allowance. Never billed to the patient.",
      });
    }

    const denial = line.denial;
    if (denial) {
      const amount = denial.groupCode === "PR" ? patientOwes : providerAdjustment;
      if (amount > 0) {
        adjustments.push({
          groupCode: denial.groupCode,
          reasonCode: carcNumber(denial.carc),
          amountUsd: amount,
          denialId: denial.id,
          note: denial.plainLanguage,
        });
      }
    }

    if (result.alternateBenefit) {
      const upgrade = round2(
        Math.max(0, patientOwes - result.coinsurancePatientUsd - result.deductibleAppliedUsd),
      );
      if (upgrade > 0) {
        adjustments.push({
          groupCode: "CO",
          reasonCode: "59",
          amountUsd: upgrade,
          denialId: denial?.id,
          note: "Alternate benefit: paid at the plan's lower allowance. The difference is the patient's upgrade — money, but not a write-off and not a denial.",
        });
      }
    }

    return {
      line: line.line,
      code: line.code,
      ...(line.tooth ? { tooth: line.tooth } : {}),
      dateOfService: line.dateOfService,
      chargedUsd: charged,
      allowedUsd: allowed,
      paidUsd: paid,
      patientOwesUsd: patientOwes,
      writeOffUsd: writeOff,
      providerAdjustmentUsd: providerAdjustment,
      adjustments,
      disposition: !result.payable
        ? "denied"
        : result.alternateBenefit
          ? "paid-with-adjustment"
          : "paid",
      note: result.summary,
    };
  });

  const totalPaid = round2(lines.reduce((sum, line) => sum + line.paidUsd, 0));
  const totalPatient = round2(lines.reduce((sum, line) => sum + line.patientOwesUsd, 0));
  const totalWrittenOff = round2(
    lines.reduce((sum, line) => sum + line.writeOffUsd + line.providerAdjustmentUsd, 0),
  );
  const denied = lines.filter((line) => line.disposition === "denied").length;

  const teachingPoints: string[] = [
    "A CO adjustment is contractual: it is written off and the patient is never billed it. A PR adjustment is the opposite — it is the patient's balance.",
    "A downgrade shows as CO-59 on a paid line. It is money, but it is the patient's upgrade, not a write-off and not a denial.",
  ];
  for (const line of input.lines) {
    if (line.denial) {
      teachingPoints.push(`${line.denial.id} (${line.denial.carc}): ${line.denial.teachingPoint}`);
    }
  }

  return {
    id: `ERA-${input.claimNumber}`,
    title: `835 for claim ${input.claimNumber} — ${lines.length} line${lines.length === 1 ? "" : "s"}`,
    payerPlanId: input.payerPlanId,
    patientName: input.patientName,
    claimControlNumber: input.claimNumber,
    remittanceDate: input.remittanceDate,
    totalPaidUsd: totalPaid,
    lines,
    summary:
      `${lines.length} line${lines.length === 1 ? "" : "s"} adjudicated against ${input.payerPlanId}: the plan pays ${money(totalPaid)}, ` +
      `${money(totalWrittenOff)} is written off and never billable, and the patient owes ${money(totalPatient)}` +
      `${denied > 0 ? ` (${denied} line${denied === 1 ? "" : "s"} denied outright)` : ""}.`,
    teachingPoints,
  };
}

// ─── The balance rule (one definition, used everywhere) ────────────

export interface DentalLineBalanceCheck {
  balances: boolean;
  /** charged − (paid + write-off + provider adjustment + patient). */
  differenceUsd: number;
}

/**
 * Does this line balance? **This is the only place the rule is written.** The
 * screen, the posting step and the tests all call it.
 *
 * charged = paid + contractual write-off + provider adjustment + patient owes
 */
export function dentalLineBalances(
  line: Pick<
    EraClaimLine,
    "chargedUsd" | "paidUsd" | "writeOffUsd" | "providerAdjustmentUsd" | "patientOwesUsd"
  >,
): DentalLineBalanceCheck {
  const accounted =
    line.paidUsd + line.writeOffUsd + line.providerAdjustmentUsd + line.patientOwesUsd;
  const differenceUsd = round2(line.chargedUsd - accounted);
  return { balances: Math.abs(differenceUsd) < 0.005, differenceUsd };
}

/** True when every line of the remittance balances. */
export function dentalRemittanceBalances(remittance: EraRemittance): boolean {
  return remittance.lines.every((line) => dentalLineBalances(line).balances);
}

// ─── Posting the 835 ───────────────────────────────────────────────

export interface DentalPostContext {
  patientId: string | null;
  /** The student's phone, or "system". */
  userId: string;
  /** One clock read for the whole posting. */
  at?: string;
}

/**
 * Turn a posted dental 835 into ledger entries. Pure and deterministic: the
 * same 835 always produces the same entry ids, so a second press is refused by
 * the store instead of doubling the money.
 *
 * Per line: the charge, the insurance payment when the plan paid anything, and
 * one entry per CO / OA / PI adjustment. A PR adjustment posts nothing — it is
 * the patient's balance, which is what is left.
 */
export function postDentalRemittanceToLedger(
  remittance: EraRemittance,
  ctx: DentalPostContext,
): LedgerEntry[] {
  const date = (ctx.at ?? remittance.remittanceDate).slice(0, 10);
  const entries: LedgerEntry[] = [];

  for (const line of remittance.lines) {
    const base = {
      patientId: ctx.patientId,
      claimNumber: remittance.claimControlNumber,
      date,
      userId: ctx.userId,
      eraId: remittance.id,
      lineNumber: line.line,
      serviceDate: line.dateOfService,
    };

    entries.push({
      ...base,
      id: `LEDG-${remittance.claimControlNumber}-dental-charge-${line.line}-${line.code}`,
      type: "charge",
      code: line.code,
      description: `Charge — CDT ${line.code}${line.tooth ? ` on tooth ${line.tooth}` : ""}`,
      amountCents: cents(line.chargedUsd),
    });

    if (line.paidUsd > 0) {
      entries.push({
        ...base,
        id: `LEDG-${remittance.claimControlNumber}-dental-pay-${line.line}`,
        type: "insurance_payment",
        code: "PAYER-PMT",
        description: `Insurance payment — ${remittance.payerPlanId}, 835 ${remittance.id}`,
        amountCents: -cents(line.paidUsd),
      });
    }

    // CO, OA and PI move money off the patient's account. PR does not appear at
    // all: the patient's responsibility is what remains. A CO-59 downgrade is
    // excluded — it is the patient's upgrade, already inside their balance.
    let postedAdjustmentUsd = 0;
    for (const adjustment of line.adjustments) {
      if (adjustment.groupCode === "PR" || isDowngradeAdjustment(adjustment)) continue;
      if (adjustment.amountUsd <= 0) continue;
      postedAdjustmentUsd = round2(postedAdjustmentUsd + adjustment.amountUsd);
      entries.push({
        ...base,
        id: `LEDG-${remittance.claimControlNumber}-dental-adj-${line.line}-${adjustment.groupCode}-${adjustment.reasonCode}`,
        type: "adjustment",
        code: `${adjustment.groupCode}-${adjustment.reasonCode}`,
        description: `${adjustment.groupCode}-${adjustment.reasonCode} ${adjustment.note}`.trim(),
        amountCents: -cents(adjustment.amountUsd),
      });
    }

    // Safety net: the ledger must agree with the 835's own write-off and
    // provider-adjustment columns. If an adjustment was recorded on the line
    // under a group that posts nothing, the difference is posted here from the
    // 835's figures — no money is invented, and the balance rule still holds.
    const required = round2(line.writeOffUsd + line.providerAdjustmentUsd);
    const residual = round2(required - postedAdjustmentUsd);
    if (Math.abs(residual) >= 0.005) {
      entries.push({
        ...base,
        id: `LEDG-${remittance.claimControlNumber}-dental-adj-${line.line}-balance`,
        type: "adjustment",
        code: "CO",
        description: `Contractual adjustment on line ${line.line}, taken from the 835's write-off and provider-adjustment columns.`,
        amountCents: -cents(residual),
      });
    }
  }

  return entries;
}

/** The entries posted from one claim. */
export function dentalLedgerForClaim(
  entries: LedgerEntry[] | null | undefined,
  claimNumber: string | null | undefined,
): LedgerEntry[] {
  if (!claimNumber) return [];
  return (entries ?? []).filter((entry) => entry.claimNumber === claimNumber);
}

/**
 * True when the ledger agrees with the 835 it was posted from: the patient's
 * balance equals the patient responsibility the payer reported, and the
 * insurance money equals what the plan paid. The posting screen shows the
 * result, so a rounding or double-post defect is visible at once.
 */
export function dentalLedgerAgreesWithRemittance(
  entries: LedgerEntry[] | null | undefined,
  remittance: EraRemittance,
): boolean {
  const balance = ledgerBalance(dentalLedgerForClaim(entries, remittance.claimControlNumber));
  const patientOwesUsd = round2(
    remittance.lines.reduce((sum, line) => sum + line.patientOwesUsd, 0),
  );
  return (
    Math.abs(balance.patientBalanceCents - cents(patientOwesUsd)) < 1 &&
    Math.abs(balance.insurancePaidCents - cents(remittance.totalPaidUsd)) < 1
  );
}
