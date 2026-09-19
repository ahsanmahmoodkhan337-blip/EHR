/**
 * Dental ERA (835) Remittance — teaching data + schema
 *
 * A structured model of an electronic remittance advice (the X12 835) so the
 * dental biller can learn to read and reconcile a payer's remittance against the
 * claim they sent. This file holds BOTH the TypeScript schema the UI renders and
 * a small set of sample remittances.
 *
 * ── WHO OWNS THIS FILE ─────────────────────────────────────────────────────
 * This file was authored by the Frontend Engineer as a REFERENCE schema + two
 * sample remittances so the `DentalEraRemittance` UI could be built and demoed.
 * The RCM Content Specialist owns the RICHER content (more samples + the
 * denial-scenario depth task). PLEASE:
 *   - extend the samples (add remittances), but keep the exported type names and
 *     the `EraServiceLine.status` union stable unless you update the UI too;
 *   - keep the "downgrade is not a denial" rule intact: an alternate-benefit
 *     line is `status: "downgraded"` with `paidAtAllowedUsd`, never `"denied"`.
 *
 * ── COPYRIGHT NOTE ─────────────────────────────────────────────────────────
 * CDT code identifiers (D2740, D6010, …) are references only. No ADA
 * nomenclature or descriptor is reproduced. CAS reason codes are from the X12
 * standard set; the plain-language notes here are original teaching text.
 *
 * ── ACCURACY NOTE ──────────────────────────────────────────────────────────
 * Fees, allowances and payment amounts are illustrative teaching figures — not a
 * fee schedule and not any real payer's allowable. Payers are the fictional
 * plans from benefitRules.ts.
 */

/** CAS adjustment group: CO = contractual obligation, PR = patient responsibility,
 *  OA = other adjustment, PI = payer-initiated reduction. */
export type EraAdjustmentGroup = "CO" | "PR" | "OA" | "PI";

export interface EraAdjustment {
  group: EraAdjustmentGroup;
  /** X12 Claim Adjustment Reason Code (e.g. "45", "16", "96"). */
  reasonCode: string;
  amountUsd: number;
  /** denialReasons.ts id this reason maps to, for cross-reference teaching. */
  denialId?: string;
  /** Original plain-language note of what this adjustment means. */
  note: string;
}

export type EraLineStatus = "paid" | "downgraded" | "denied";

export interface EraServiceLine {
  line: number;
  code: string;
  tooth?: string;
  chargedUsd: number;
  /** Contracted allowance. Illustrative. */
  allowedUsd: number;
  /**
   * Allowance of the downgrade benchmark where an alternate benefit applies.
   * Present only on `downgraded` lines — the UI renders it as "paid at $X",
   * an adjustment, never a denial.
   */
  paidAtAllowedUsd?: number;
  /** What the payer actually paid on this line. */
  paidUsd: number;
  /** Member's responsibility (deductible / coinsurance / non-covered). */
  patientResponsibilityUsd: number;
  adjustments: EraAdjustment[];
  status: EraLineStatus;
}

export interface EraClaim {
  /** Payer's claim control number (from the remittance, not ours). */
  payerClaimControlNumber: string;
  /** Our patient control number (claim reference). */
  patientControlNumber: string;
  patientName: string;
  memberId: string;
  /** CLP-02 style status: "1" processed / "4" denied / "2" secondary. */
  claimStatus: "processed" | "denied" | "secondary";
  totalChargedUsd: number;
  totalPaidUsd: number;
  totalPatientResponsibilityUsd: number;
  serviceLines: EraServiceLine[];
}

export interface EraRemittance {
  id: string;
  planId: string;
  payerName: string;
  payeeName: string;
  paymentMethod: "EFT" | "CHK";
  paymentDate: string;
  /** Payment/check/EFT trace number (TRN segment). */
  traceNumber: string;
  /** Dollar amount of this payment (BPR-02). */
  totalPaymentUsd: number;
  claims: EraClaim[];
  /** One-line teaching summary of what this remittance teaches. */
  teachingSummary: string;
}

/* ======================================================================= */
/* SAMPLE 1 — a clean, fully-paid remittance                               */
/* ======================================================================= */

const ERA_CLEAN_PAID: EraRemittance = {
  id: "ERA-001",
  planId: "PLAN-CASCADIA-PPO",
  payerName: "Cascadia Dental Guard",
  payeeName: "Healthcare Hustlers Dental",
  paymentMethod: "EFT",
  paymentDate: "2027-03-04",
  traceNumber: "835-20270304-000117",
  totalPaymentUsd: 131.2,
  teachingSummary:
    "A clean remittance: both lines paid at allowance. Reconcile it by checking that plan-pays + write-off + patient-share add back up to the charged amount.",
  claims: [
    {
      payerClaimControlNumber: "CCH-2027-0117A",
      patientControlNumber: "PCN-D001",
      patientName: "Nadia Qureshi",
      memberId: "CCH-9911-3327",
      claimStatus: "processed",
      totalChargedUsd: 164,
      totalPaidUsd: 131.2,
      totalPatientResponsibilityUsd: 32.8,
      serviceLines: [
        {
          line: 1,
          code: "D0120",
          chargedUsd: 59,
          allowedUsd: 59,
          paidUsd: 47.2,
          patientResponsibilityUsd: 11.8,
          status: "paid",
          adjustments: [
            {
              group: "PR",
              reasonCode: "2",
              amountUsd: 11.8,
              note: "Member coinsurance (20%) on the periodic exam.",
            },
          ],
        },
        {
          line: 2,
          code: "D1110",
          chargedUsd: 105,
          allowedUsd: 105,
          paidUsd: 84,
          patientResponsibilityUsd: 21,
          status: "paid",
          adjustments: [
            {
              group: "PR",
              reasonCode: "2",
              amountUsd: 21,
              note: "Member coinsurance (20%) on the prophylaxis.",
            },
          ],
        },
      ],
    },
  ],
};

/* ======================================================================= */
/* SAMPLE 2 — a downgrade and a denial on the same remittance               */
/* ======================================================================= */

const ERA_DOWNGRADE_AND_DENIAL: EraRemittance = {
  id: "ERA-002",
  planId: "PLAN-CASCADIA-PPO",
  payerName: "Cascadia Dental Guard",
  payeeName: "Healthcare Hustlers Dental",
  paymentMethod: "CHK",
  paymentDate: "2027-03-11",
  traceNumber: "835-20270311-000224",
  totalPaymentUsd: 610,
  teachingSummary:
    "Two teaching hits in one remittance: the crown is a downgrade (covered at the base-metal allowance — an adjustment, NOT a denial), and the implant is excluded by the missing-tooth clause (a true denial).",
  claims: [
    {
      payerClaimControlNumber: "CCH-2027-0224B",
      patientControlNumber: "PCN-D002",
      patientName: "Marcus Bell",
      memberId: "CCH-2204-1188",
      claimStatus: "processed",
      totalChargedUsd: 1608,
      totalPaidUsd: 610,
      totalPatientResponsibilityUsd: 730,
      serviceLines: [
        {
          line: 1,
          code: "D2950",
          tooth: "19",
          chargedUsd: 288,
          allowedUsd: 240,
          paidUsd: 120,
          patientResponsibilityUsd: 120,
          status: "paid",
          adjustments: [
            { group: "CO", reasonCode: "45", amountUsd: 48, note: "Charge exceeds the contracted allowance (write-off)." },
            { group: "PR", reasonCode: "2", amountUsd: 120, note: "Member coinsurance on the core build-up." },
          ],
        },
        {
          line: 2,
          code: "D2740",
          tooth: "19",
          chargedUsd: 1320,
          allowedUsd: 1100,
          paidAtAllowedUsd: 980,
          paidUsd: 490,
          patientResponsibilityUsd: 610,
          status: "downgraded",
          adjustments: [
            { group: "CO", reasonCode: "45", amountUsd: 220, note: "Charge exceeds the contracted allowance (write-off)." },
            {
              group: "CO",
              reasonCode: "45",
              amountUsd: 120,
              denialId: "DEN-ALT-BENEFIT",
              note: "Alternate benefit: a posterior all-ceramic crown is covered only up to the base-metal crown allowance (980). The difference is the patient's upgrade — an adjustment, not a denial.",
            },
            { group: "PR", reasonCode: "2", amountUsd: 610, note: "Member coinsurance plus the documented upgrade balance." },
          ],
        },
        {
          line: 3,
          code: "D6010",
          tooth: "3",
          chargedUsd: 2250,
          allowedUsd: 2250,
          paidUsd: 0,
          patientResponsibilityUsd: 2250,
          status: "denied",
          adjustments: [
            {
              group: "CO",
              reasonCode: "96",
              amountUsd: 2250,
              denialId: "DEN-MISSING-TOOTH",
              note: "Non-covered: the missing-tooth clause applies — tooth #3 was lost before coverage began, so the replacement benefit is removed.",
            },
          ],
        },
      ],
    },
  ],
};

export const ERA_REMITTANCES: EraRemittance[] = [ERA_CLEAN_PAID, ERA_DOWNGRADE_AND_DENIAL];

export const ERA_REMITTANCE_INDEX: Record<string, EraRemittance> = Object.fromEntries(
  ERA_REMITTANCES.map((e) => [e.id, e]),
);

export function findEraRemittance(id: string): EraRemittance | undefined {
  return ERA_REMITTANCE_INDEX[id];
}

export function eraRemittancesForPlan(planId: string): EraRemittance[] {
  return ERA_REMITTANCES.filter((e) => e.planId === planId);
}
