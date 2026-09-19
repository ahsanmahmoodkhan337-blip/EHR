/**
 * Dental ERA (835) Remittance Samples & Denial-Depth Scenarios
 *
 * The structured, UI-consumable half of "make dental billing better": teaching
 * students to read an electronic remittance advice (the 835 / ERA) line by
 * line, and to recognise the denial patterns that live behind the adjustment
 * codes.
 *
 * Two parts:
 *   1. `ERA_REMITTANCES` — three sample remittances with line-level
 *      adjudication, each line carrying CAS adjustment group+reason codes that
 *      resolve to `denialReasons.ts`, plus a claim-level (PLB) adjustment where
 *      relevant.
 *   2. `DENIAL_SCENARIOS` — three denial situations (missing attachment,
 *      coordination of benefits, non-covered service) wired to existing CDT
 *      codes and plans, each showing the expected adjudication lines.
 *
 * COPYRIGHT NOTE — READ BEFORE EDITING
 * The CDT Code set and its official nomenclature and descriptors are copyright
 * of the American Dental Association. Nothing here reproduces ADA nomenclature
 * or descriptors; every description string is original teaching text, and code
 * identifiers (D2740, …) are references only.
 *
 * ACCURACY NOTE
 * Fees and allowances are illustrative teaching figures, not a fee schedule.
 * CARC/group-code pairings are the standard X12 values already used in
 * denialReasons.ts, whose surrounding text is original. The `payerRemark`-style
 * notes are written for this simulator, not quoted from any real payer.
 */

/** X12 claim adjustment group code. */
export type EraAdjustmentGroupCode = "CO" | "PR" | "OA" | "PI";

/** One CAS (Claim Adjustment Segment) entry on a service line. */
export interface EraLineAdjustment {
  groupCode: EraAdjustmentGroupCode;
  /** X12 Claim Adjustment Reason Code, e.g. "59". */
  reasonCode: string;
  /** Dollar amount the adjustment moves. */
  amountUsd: number;
  /** Denial id in denialReasons.ts this adjustment corresponds to. */
  denialId?: string;
  /** Original plain-language reading of what the adjustment is doing. */
  note: string;
}

/** A claim-level (PLB) adjustment — signed; negative means a recovery/takeback. */
export interface EraClaimLevelAdjustment {
  reasonCode: string;
  amountUsd: number;
  description: string;
  note: string;
}

export type EraLineDisposition = "paid" | "paid-with-adjustment" | "denied";

export interface EraClaimLine {
  line: number;
  code: string;
  tooth?: string;
  chargedUsd: number;
  /** Contracted allowance. Illustrative teaching figure. */
  allowedUsd: number;
  /** What the payer actually paid on this line. */
  paidUsd: number;
  /** Deductible + coinsurance + patient-responsibility denials + upgrade. */
  patientOwesUsd: number;
  /** Contractual write-off: charge above allowance. Not billable to patient. */
  writeOffUsd: number;
  /** Money neither paid nor billable to the patient (CO denials, bundling). */
  providerAdjustmentUsd: number;
  adjustments: EraLineAdjustment[];
  disposition: EraLineDisposition;
  note: string;
}

export interface EraRemittance {
  id: string;
  title: string;
  payerPlanId: string;
  patientName: string;
  claimControlNumber: string;
  remittanceDate: string;
  /** Net the payer paid on this remittance, after any claim-level adjustment. */
  totalPaidUsd: number;
  lines: EraClaimLine[];
  claimLevelAdjustments?: EraClaimLevelAdjustment[];
  summary: string;
  teachingPoints: string[];
}

/** A denial situation with the expected adjudication lines it produces. */
export interface DentalDenialScenario {
  id: string;
  denialId: string;
  title: string;
  planId: string;
  procedureCodes: string[];
  /** What happened at the desk, in the chart, or on the claim. */
  situation: string;
  expectedLines: EraClaimLine[];
  correctAction: string[];
  teachingPoint: string;
}

/* ======================================================================= */
/* Remittance 1 — mixed: a clean line and a downgraded line                 */
/* ======================================================================= */

const ERA_MIXED_DOWNGRADE: EraRemittance = {
  id: "ERA-01",
  title: "Mixed remittance — a clean build-up and a downgraded crown",
  payerPlanId: "PLAN-CASCADIA-PPO",
  patientName: "Marcus Bell",
  claimControlNumber: "CASC-2027-004882",
  remittanceDate: "2027-04-20",
  totalPaidUsd: 560,
  lines: [
    {
      line: 1,
      code: "D2950",
      tooth: "19",
      chargedUsd: 288,
      allowedUsd: 240,
      paidUsd: 120,
      patientOwesUsd: 120,
      writeOffUsd: 48,
      providerAdjustmentUsd: 0,
      adjustments: [
        { groupCode: "CO", reasonCode: "45", amountUsd: 48, note: "Contractual write-off: charge above the contracted allowance." },
      ],
      disposition: "paid",
      note: "Core build-up paid at 50% of the allowance (Major). The radiograph and narrative were attached, so it was not bundled into the crown.",
    },
    {
      line: 2,
      code: "D2740",
      tooth: "19",
      chargedUsd: 1320,
      allowedUsd: 1100,
      paidUsd: 490,
      patientOwesUsd: 610,
      writeOffUsd: 220,
      providerAdjustmentUsd: 0,
      adjustments: [
        { groupCode: "CO", reasonCode: "45", amountUsd: 220, note: "Contractual write-off: charge above the contracted allowance." },
        {
          groupCode: "CO",
          reasonCode: "59",
          amountUsd: 120,
          denialId: "DEN-ALT-BENEFIT",
          note: "Alternate benefit: a posterior all-ceramic crown is paid at the base-metal allowance. The 120 difference is the patient's upgrade, not a write-off.",
        },
      ],
      disposition: "paid-with-adjustment",
      note: "The crown is paid — but at the lower metal allowance. This is a downgrade rendered as paid-at-allowed, not a denial.",
    },
  ],
  claimLevelAdjustments: [
    {
      reasonCode: "CS",
      amountUsd: -50,
      description: "Recovery of prior overpayment",
      note: "A takeback of 50 from an earlier claim is netted out of this check, which is why the remittance total is lower than the two line payments combined.",
    },
  ],
  summary:
    "One line pays clean; the second is paid but reduced by an alternate-benefit downgrade, and a 50 recovery is netted out at the claim level. The student must read the 59 adjustment as money, not as a denial.",
  teachingPoints: [
    "A downgrade shows up as a CO-59 adjustment on a paid line. The line is not denied — it is paid at a lower allowance.",
    "The 59 amount is the patient's upgrade, and it must be quoted and collected, not written off.",
    "The claim-level recovery (PLB) is why the check does not equal the sum of the line payments.",
  ],
};

/* ======================================================================= */
/* Remittance 2 — denied: missing documentation + frequency                */
/* ======================================================================= */

const ERA_MISSING_DOC_FREQUENCY: EraRemittance = {
  id: "ERA-02",
  title: "Denied remittance — missing chart and a too-soon crown",
  payerPlanId: "PLAN-CASCADIA-PPO",
  patientName: "Priya Shah",
  claimControlNumber: "CASC-2027-005511",
  remittanceDate: "2027-04-21",
  totalPaidUsd: 0,
  lines: [
    {
      line: 1,
      code: "D4341",
      chargedUsd: 312,
      allowedUsd: 312,
      paidUsd: 0,
      patientOwesUsd: 0,
      writeOffUsd: 0,
      providerAdjustmentUsd: 312,
      adjustments: [
        {
          groupCode: "CO",
          reasonCode: "16",
          amountUsd: 312,
          denialId: "DEN-DOC-MISSING",
          note: "Claim lacks required information: the periodontal chart with probing depths was not attached. Nothing is billable to the patient — the claim just needs the attachment and a resubmit.",
        },
      ],
      disposition: "denied",
      note: "Scaling and root planing denied for missing documentation. The chart exists in the record; it simply never reached the claim.",
    },
    {
      line: 2,
      code: "D2740",
      tooth: "30",
      chargedUsd: 1320,
      allowedUsd: 1100,
      paidUsd: 0,
      patientOwesUsd: 0,
      writeOffUsd: 220,
      providerAdjustmentUsd: 1100,
      adjustments: [
        { groupCode: "CO", reasonCode: "45", amountUsd: 220, note: "Contractual write-off: charge above the contracted allowance." },
        {
          groupCode: "CO",
          reasonCode: "119",
          amountUsd: 1100,
          denialId: "DEN-FREQ-CROWN",
          note: "Crown replacement within the five-year window. The prior crown on #30 was placed by a previous dentist three years ago.",
        },
      ],
      disposition: "denied",
      note: "The crown is correctly coded but the replacement frequency is exhausted. This is a provider adjustment — not billable to the patient.",
    },
  ],
  summary:
    "Both lines deny for different reasons: one is a free-to-fix documentation failure (resubmit), the other is a frequency limitation that could have been caught at eligibility. Neither balance is billable to the patient.",
  teachingPoints: [
    "A CO-16 missing-information denial is the cheapest denial to fix: attach the document and resubmit. It should never happen twice.",
    "A CO-119 frequency denial is a provider adjustment — the patient does not pay it. The fix is prevention, not collection.",
  ],
};

/* ======================================================================= */
/* Remittance 3 — denied: non-covered service                              */
/* ======================================================================= */

const ERA_NON_COVERED: EraRemittance = {
  id: "ERA-03",
  title: "Denied remittance — implants are not a covered benefit",
  payerPlanId: "PLAN-CASCADIA-PPO",
  patientName: "Elena Reyes",
  claimControlNumber: "CASC-2027-006003",
  remittanceDate: "2027-04-22",
  totalPaidUsd: 0,
  lines: [
    {
      line: 1,
      code: "D6010",
      tooth: "3",
      chargedUsd: 2250,
      allowedUsd: 2250,
      paidUsd: 0,
      patientOwesUsd: 2250,
      writeOffUsd: 0,
      providerAdjustmentUsd: 0,
      adjustments: [
        {
          groupCode: "PR",
          reasonCode: "204",
          amountUsd: 2250,
          denialId: "DEN-NOT-COVERED",
          note: "Implants are excluded from this plan. The balance is patient responsibility, and the group code says so.",
        },
      ],
      disposition: "denied",
      note: "The implant body is not a covered benefit. The patient owes the full charge.",
    },
    {
      line: 2,
      code: "D6058",
      tooth: "3",
      chargedUsd: 1845,
      allowedUsd: 1845,
      paidUsd: 0,
      patientOwesUsd: 1845,
      writeOffUsd: 0,
      providerAdjustmentUsd: 0,
      adjustments: [
        {
          groupCode: "PR",
          reasonCode: "204",
          amountUsd: 1845,
          denialId: "DEN-NOT-COVERED",
          note: "The implant crown is excluded along with the fixture.",
        },
      ],
      disposition: "denied",
      note: "The implant crown is not covered either. The patient owes the full charge on both lines.",
    },
  ],
  summary:
    "Both implant lines are non-covered (PR-204), so the entire balance is patient responsibility. The lesson is that this was knowable from the plan's exclusion list before surgery — a predetermination would have surfaced it.",
  teachingPoints: [
    "A PR-204 non-covered denial is patient billable — the group code is the signal.",
    "A plan exclusion is not appealable on clinical grounds. The fix is quoting it up front, not arguing it after.",
  ],
};

export const ERA_REMITTANCES: EraRemittance[] = [
  ERA_MIXED_DOWNGRADE,
  ERA_MISSING_DOC_FREQUENCY,
  ERA_NON_COVERED,
];

export const ERA_REMITTANCE_INDEX: Record<string, EraRemittance> = Object.fromEntries(
  ERA_REMITTANCES.map((r) => [r.id, r]),
);

export function findEraRemittance(id: string): EraRemittance | undefined {
  return ERA_REMITTANCE_INDEX[id];
}

/* ======================================================================= */
/* Denial-depth scenarios                                                   */
/* ======================================================================= */

const DENIAL_SCEN_MISSING_ATTACHMENT: DentalDenialScenario = {
  id: "DEN-SCEN-ATTACHMENT",
  denialId: "DEN-DOC-MISSING",
  title: "Missing attachment — root planing sent without the perio chart",
  planId: "PLAN-CASCADIA-PPO",
  procedureCodes: ["D4341"],
  situation:
    "The practice submits a quadrant of scaling and root planing, but the claim goes out without the periodontal chart that shows four or more teeth in that quadrant actually have disease.",
  expectedLines: [
    {
      line: 1,
      code: "D4341",
      chargedUsd: 312,
      allowedUsd: 312,
      paidUsd: 0,
      patientOwesUsd: 0,
      writeOffUsd: 0,
      providerAdjustmentUsd: 312,
      adjustments: [
        {
          groupCode: "CO",
          reasonCode: "16",
          amountUsd: 312,
          denialId: "DEN-DOC-MISSING",
          note: "Missing the periodontal chart with probing depths. Correct and resubmit.",
        },
      ],
      disposition: "denied",
      note: "Documentation denial — the chart exists, it just never reached the claim.",
    },
  ],
  correctAction: [
    "Attach the periodontal chart with per-tooth probing depths.",
    "Confirm the tooth count in that quadrant matches the four-or-more code.",
    "Resubmit as a corrected claim inside the timely filing window.",
  ],
  teachingPoint:
    "An attachment-required denial is a process failure, not a coverage decision. The document was in the chart all along — the claim just left without it.",
};

const DENIAL_SCEN_COB: DentalDenialScenario = {
  id: "DEN-SCEN-COB",
  denialId: "DEN-COB-PRIMARY",
  title: "Coordination of benefits — billed the wrong payer first",
  planId: "PLAN-CASCADIA-PPO",
  procedureCodes: ["D0120"],
  situation:
    "A child covered by both parents is seen for a recall exam. The practice bills one plan directly, but under the birthday rule the other parent's plan is primary, and that plan returns the claim.",
  expectedLines: [
    {
      line: 1,
      code: "D0120",
      chargedUsd: 62,
      allowedUsd: 62,
      paidUsd: 0,
      patientOwesUsd: 0,
      writeOffUsd: 0,
      providerAdjustmentUsd: 62,
      adjustments: [
        {
          groupCode: "CO",
          reasonCode: "22",
          amountUsd: 62,
          denialId: "DEN-COB-PRIMARY",
          note: "Another plan may be primary. This claim must go to the primary payer first.",
        },
      ],
      disposition: "denied",
      note: "Returned so the primary plan can be billed first; the secondary then receives the primary's remittance.",
    },
  ],
  correctAction: [
    "Establish which plan is primary. For dependent children, most plans use the birthday rule: the parent whose birthday falls earlier in the year is primary.",
    "Bill the primary plan first and wait for its remittance.",
    "Submit to the secondary with the primary's payment attached.",
  ],
  teachingPoint:
    "A CO-22 coordination-of-benefits return is not a lost claim — it is a routing error. Nothing is billable to the patient; the claim goes to the other payer first.",
};

const DENIAL_SCEN_NON_COVERED: DentalDenialScenario = {
  id: "DEN-SCEN-NON-COVERED",
  denialId: "DEN-NOT-COVERED",
  title: "Non-covered service — an implant on a plan that excludes implants",
  planId: "PLAN-CASCADIA-PPO",
  procedureCodes: ["D6010"],
  situation:
    "The plan excludes implants entirely. The practice placed an implant and submitted the claim, and the remittance returns it as non-covered.",
  expectedLines: [
    {
      line: 1,
      code: "D6010",
      tooth: "3",
      chargedUsd: 2250,
      allowedUsd: 2250,
      paidUsd: 0,
      patientOwesUsd: 2250,
      writeOffUsd: 0,
      providerAdjustmentUsd: 0,
      adjustments: [
        {
          groupCode: "PR",
          reasonCode: "204",
          amountUsd: 2250,
          denialId: "DEN-NOT-COVERED",
          note: "Service excluded under this plan. Patient responsibility.",
        },
      ],
      disposition: "denied",
      note: "The implant is an exclusion, not a documentation problem. The patient owes the full charge.",
    },
  ],
  correctAction: [
    "Confirm against the plan's exclusion list that this is a true exclusion.",
    "Do not appeal a plan exclusion on clinical grounds.",
    "Bill the patient, and feed the exclusion into the verification checklist for the next patient.",
  ],
  teachingPoint:
    "An exclusion is patient responsibility (PR group code). The expensive surprise is avoided by checking the exclusion list before treatment, not by arguing the claim after.",
};

export const DENIAL_SCENARIOS: DentalDenialScenario[] = [
  DENIAL_SCEN_MISSING_ATTACHMENT,
  DENIAL_SCEN_COB,
  DENIAL_SCEN_NON_COVERED,
];

export const DENIAL_SCENARIO_INDEX: Record<string, DentalDenialScenario> = Object.fromEntries(
  DENIAL_SCENARIOS.map((s) => [s.id, s]),
);

export function findDenialScenario(id: string): DentalDenialScenario | undefined {
  return DENIAL_SCENARIO_INDEX[id];
}
