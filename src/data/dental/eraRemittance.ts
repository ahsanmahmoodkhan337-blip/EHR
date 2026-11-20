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
 *   2. `DENIAL_SCENARIOS` — ten denial situations wired to existing CDT codes
 *      and plans, each showing the expected adjudication lines: missing
 *      attachment, coordination of benefits, non-covered service, and the
 *      seven denials the seeded dental cases earn (radiograph frequency, age
 *      limit, alternate benefit, crown frequency, annual maximum, waiting
 *      period, not eligible).
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

/* ======================================================================= */
/* Denial scenarios for the denials the seeded dental cases actually earn   */
/* ======================================================================= */

const DENIAL_SCEN_FREQ_XRAY: DentalDenialScenario = {
  id: "DEN-SCEN-FREQ-XRAY",
  denialId: "DEN-FREQ-XRAY",
  title: "Radiograph frequency limit — a bitewing set taken too soon",
  planId: "PLAN-CASCADIA-PPO",
  procedureCodes: ["D0274"],
  situation:
    "A recall patient has a four-film bitewing set on the same day as the examination and cleaning. The payer's records show a set already paid to another practice nine months earlier, against a once-per-twelve-months allowance. The images were clinically reasonable; they were simply inside the window.",
  expectedLines: [
    {
      line: 1,
      code: "D0274",
      chargedUsd: 74,
      allowedUsd: 68,
      paidUsd: 0,
      patientOwesUsd: 0,
      writeOffUsd: 6,
      providerAdjustmentUsd: 68,
      adjustments: [
        { groupCode: "CO", reasonCode: "45", amountUsd: 6, note: "Contractual write-off: charge above the contracted allowance." },
        {
          groupCode: "CO",
          reasonCode: "119",
          amountUsd: 68,
          denialId: "DEN-FREQ-XRAY",
          note: "Frequency limit: the payer's last paid set is nine months old. The whole allowance is a provider write-off, not a patient balance.",
        },
      ],
      disposition: "denied",
      note: "A frequency limit caps what the plan buys. The participating agreement does not let the practice bill the patient for the difference.",
    },
  ],
  correctAction: [
    "Ask the payer for the last date of service it has for this procedure type before the films are taken, not after the denial.",
    "Compare the payer's date with the practice's own history. If the practice's date is the later one, the payer is wrong.",
    "If the payer is right, write the line off with the CO group code — a frequency limit is a contractual limitation, so the patient owes nothing.",
    "Appeal only where a genuine diagnostic emergency required the images, with the narrative and the presenting symptom attached.",
  ],
  teachingPoint:
    "A CO-119 frequency denial is a provider adjustment with a patient balance of 0 — the same money rule as an age limit. The fix is prevention at eligibility, not collection at the front desk.",
};

const DENIAL_SCEN_AGE_LIMIT: DentalDenialScenario = {
  id: "DEN-SCEN-AGE-LIMIT",
  denialId: "DEN-AGE-LIMIT",
  title: "Age limit — fluoride applied past the plan's cap",
  planId: "PLAN-CASCADIA-PPO",
  procedureCodes: ["D1206"],
  situation:
    "A sixteen-year-old attends for a recall and receives fluoride varnish. The plan funds fluoride only up to the fifteenth birthday, so the varnish is a benefit the patient had already aged out of. Nothing about the coding or the clinical need is in question.",
  expectedLines: [
    {
      line: 1,
      code: "D1206",
      chargedUsd: 44,
      allowedUsd: 40,
      paidUsd: 0,
      patientOwesUsd: 0,
      writeOffUsd: 4,
      providerAdjustmentUsd: 40,
      adjustments: [
        { groupCode: "CO", reasonCode: "45", amountUsd: 4, note: "Contractual write-off: charge above the contracted allowance." },
        {
          groupCode: "CO",
          reasonCode: "6",
          amountUsd: 40,
          denialId: "DEN-AGE-LIMIT",
          note: "Benefit limited by the member's age on the date of service. Past the plan's fluoride cap, so the allowance is a provider write-off.",
        },
      ],
      disposition: "denied",
      note: "An age cap is a benefit limit, not a patient balance. The charge is absorbed by the practice.",
    },
  ],
  correctAction: [
    "Check the patient's age against the plan's stated cap on the date of service, before the varnish is opened.",
    "Confirm the birth date on file matches the payer's record — a wrong birth date produces a false age denial and is fixable.",
    "If the patient has genuinely aged out, write the line off with the CO group code and leave the patient balance at 0.",
    "Do not file a clinical appeal: no clinical argument changes an age cap, and the resubmission will deny again.",
  ],
  teachingPoint:
    "CO-6 is a benefit limitation, so the practice absorbs it — patient balance 0. The decision belongs at eligibility, before treatment, which is the only place it can still change the outcome.",
};

const DENIAL_SCEN_ALT_BENEFIT: DentalDenialScenario = {
  id: "DEN-SCEN-ALT-BENEFIT",
  denialId: "DEN-ALT-BENEFIT",
  title: "Alternate benefit — a composite paid at the metal-filling allowance",
  planId: "PLAN-CASCADIA-PPO",
  procedureCodes: ["D2392"],
  situation:
    "A two-surface posterior composite is placed on tooth 30 and correctly reported. The plan benchmarks posterior restorations to the amalgam allowance, so it pays to that level and treats the difference as the patient's upgrade. The service is covered; the benefit is simply reduced.",
  expectedLines: [
    {
      line: 1,
      code: "D2392",
      tooth: "30",
      chargedUsd: 248,
      allowedUsd: 210,
      paidUsd: 104,
      patientOwesUsd: 106,
      writeOffUsd: 38,
      providerAdjustmentUsd: 0,
      adjustments: [
        { groupCode: "CO", reasonCode: "45", amountUsd: 38, note: "Contractual write-off: charge above the contracted allowance." },
        {
          groupCode: "PR",
          reasonCode: "45",
          amountUsd: 30,
          denialId: "DEN-ALT-BENEFIT",
          note: "Alternate benefit: the plan paid at the 180 amalgam allowance rather than the 210 composite allowance. The 30 difference is the patient's upgrade.",
        },
        { groupCode: "PR", reasonCode: "1", amountUsd: 50, note: "Deductible, taken from the alternate-benefit allowance before the percentage applies." },
        { groupCode: "PR", reasonCode: "2", amountUsd: 26, note: "Coinsurance: 20 percent of the 130 left after the deductible." },
      ],
      disposition: "paid-with-adjustment",
      note: "Paid, not denied. The line pays at the downgraded allowance and the balance splits into a contractual write-off and a patient upgrade.",
    },
  ],
  correctAction: [
    "Read the remittance as a reduction: the plan paid at the alternate allowance rather than refusing the service.",
    "Never rebill using the cheaper code — the claim must state the restoration that was actually placed.",
    "Bill the patient the upgrade difference, which is theirs under the contract, and show the arithmetic on the estimate.",
    "Warn the patient about the downgrade before treatment wherever the plan's alternate-benefit clause is known.",
  ],
  teachingPoint:
    "Alternate benefit is money split three ways: payer share, contractual write-off, and a patient upgrade that is legitimately billable. It is the one dental downgrade the patient does owe.",
};

const DENIAL_SCEN_FREQ_CROWN: DentalDenialScenario = {
  id: "DEN-SCEN-FREQ-CROWN",
  denialId: "DEN-FREQ-CROWN",
  title: "Crown frequency — the tooth already carries a paid crown",
  planId: "PLAN-CASCADIA-PPO",
  procedureCodes: ["D2740"],
  situation:
    "Tooth 30 needs a replacement crown. The practice's own chart shows no crown history, but the payer paid for a crown on that tooth three years ago and the plan allows one replacement every sixty months. The crown is correctly coded and clinically necessary; the replacement clock has not run.",
  expectedLines: [
    {
      line: 1,
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
          note: "Replacement inside the plan's sixty-month window. The clock follows the tooth, including a crown placed by a previous dentist.",
        },
      ],
      disposition: "denied",
      note: "A provider adjustment while the appeal runs. Nothing is billable to the patient for a frequency limitation.",
    },
  ],
  correctAction: [
    "Ask the payer for the paid date and the servicing provider on the prior crown — the practice's chart cannot answer this.",
    "Appeal where the old restoration failed from new decay or fracture rather than normal wear, attaching the pre-operative radiograph and a narrative.",
    "Treat the line as a CO write-off while the appeal is open and do not move the balance to the patient.",
    "If the window simply has not elapsed, the replacement is not payable until it does — quote the patient before the seat appointment.",
  ],
  teachingPoint:
    "The replacement clock follows the tooth across dentists, and only the payer knows the date. A CO-119 crown denial stays a provider write-off while it is appealed — never a patient balance.",
};

const DENIAL_SCEN_ANNUAL_MAX: DentalDenialScenario = {
  id: "DEN-SCEN-ANNUAL-MAX",
  denialId: "DEN-ANNUAL-MAX",
  title: "Annual maximum — the second partial pays nothing",
  planId: "PLAN-NORTHWIND-TRUST",
  procedureCodes: ["D5213", "D5214"],
  situation:
    "Two cast partial dentures are delivered in the same benefit period with only 300 dollars of the annual maximum left. The first partial exhausts what remained; the second pays nothing even though every other rule passed. The maximum is applied last, after coverage, frequency, documentation and predetermination.",
  expectedLines: [
    {
      line: 1,
      code: "D5213",
      chargedUsd: 1925,
      allowedUsd: 1650,
      paidUsd: 300,
      patientOwesUsd: 1350,
      writeOffUsd: 275,
      providerAdjustmentUsd: 0,
      adjustments: [
        { groupCode: "CO", reasonCode: "45", amountUsd: 275, note: "Contractual write-off: charge above the contracted allowance." },
        {
          groupCode: "PR",
          reasonCode: "119",
          amountUsd: 1350,
          denialId: "DEN-ANNUAL-MAX",
          note: "Benefit maximum reached: the plan pays the 300 that was left and the remainder of the allowance is patient responsibility.",
        },
      ],
      disposition: "paid-with-adjustment",
      note: "Covered at the major-service percentage but capped by the maximum — the payment stops at 300.",
    },
    {
      line: 2,
      code: "D5214",
      chargedUsd: 1925,
      allowedUsd: 1650,
      paidUsd: 0,
      patientOwesUsd: 1650,
      writeOffUsd: 275,
      providerAdjustmentUsd: 0,
      adjustments: [
        { groupCode: "CO", reasonCode: "45", amountUsd: 275, note: "Contractual write-off: charge above the contracted allowance." },
        {
          groupCode: "PR",
          reasonCode: "119",
          amountUsd: 1650,
          denialId: "DEN-ANNUAL-MAX",
          note: "The annual maximum is now exhausted, so the whole allowance falls to the patient.",
        },
      ],
      disposition: "denied",
      note: "Nothing is left in the maximum. The plan paid what it owed, and the balance is billable to the patient against the signed estimate.",
    },
  ],
  correctAction: [
    "Check the remaining annual maximum at every eligibility verification and quote from that number, not from the percentage alone.",
    "Sequence large treatment plans across two benefit periods where it is clinically safe, and put the sequencing in the estimate.",
    "Do not appeal a true maximum denial — the plan paid what it owed, and there is nothing to review.",
    "Bill the patient the balance against the pre-treatment estimate they signed, and offer to defer anything unscheduled.",
  ],
  teachingPoint:
    "The annual maximum is applied last and it is patient responsibility (PR group), not a write-off. A perfectly coded, pre-authorised claim can still pay nothing, which is why the remaining maximum is a quoting input.",
};

const DENIAL_SCEN_WAITING: DentalDenialScenario = {
  id: "DEN-SCEN-WAITING",
  denialId: "DEN-WAITING",
  title: "Waiting period — a crown in the first year of coverage",
  planId: "PLAN-CASCADIA-PPO",
  procedureCodes: ["D2740"],
  situation:
    "Tooth 19 needs a full-coverage crown. The patient is eligible and the crown is correctly coded, but major services carry a twelve-month waiting period and the member has five months of continuous coverage. The plan is not disputing the treatment — it is disputing the tenure.",
  expectedLines: [
    {
      line: 1,
      code: "D2740",
      tooth: "19",
      chargedUsd: 1320,
      allowedUsd: 1100,
      paidUsd: 0,
      patientOwesUsd: 1100,
      writeOffUsd: 220,
      providerAdjustmentUsd: 0,
      adjustments: [
        { groupCode: "CO", reasonCode: "45", amountUsd: 220, note: "Contractual write-off: charge above the contracted allowance." },
        {
          groupCode: "PR",
          reasonCode: "26",
          amountUsd: 1100,
          denialId: "DEN-WAITING",
          note: "Service rendered before the major-service waiting period was completed. The allowance is patient responsibility.",
        },
      ],
      disposition: "denied",
      note: "Eligible is not the same as payable. The contracted allowance is billable to the patient, and only the charge above it is written off.",
    },
  ],
  correctAction: [
    "Confirm the coverage effective date and the waiting-period length from the eligibility record, and note the date the period ends.",
    "Ask whether prior continuous coverage should credit toward the waiting period, and appeal with proof of that coverage if it should.",
    "If the waiting period stands, either schedule after it ends where that is clinically safe or get a self-pay agreement signed before the appointment.",
    "Explain to the patient that the denial is about how long they have held the plan, not about whether the crown was needed.",
  ],
  teachingPoint:
    "A waiting period is tenure, not treatment: no clinical appeal can shorten it. The balance is the patient's, and the only defence is the estimate the patient agreed to beforehand.",
};

const DENIAL_SCEN_NOT_ELIGIBLE: DentalDenialScenario = {
  id: "DEN-SCEN-NOT-ELIGIBLE",
  denialId: "DEN-NOT-ELIGIBLE",
  title: "Not eligible — coverage began after the date of service",
  planId: "PLAN-CASCADIA-PPO",
  procedureCodes: ["D0120", "D1110"],
  situation:
    "A routine examination and adult prophylaxis are delivered and submitted. The eligibility check passed on the day it was run, but the plan's coverage effective date falls after the date of service, so no coverage existed on the day the patient was treated. Both lines were coded correctly.",
  expectedLines: [
    {
      line: 1,
      code: "D0120",
      chargedUsd: 62,
      allowedUsd: 62,
      paidUsd: 0,
      patientOwesUsd: 62,
      writeOffUsd: 0,
      providerAdjustmentUsd: 0,
      adjustments: [
        {
          groupCode: "PR",
          reasonCode: "27",
          amountUsd: 62,
          denialId: "DEN-NOT-ELIGIBLE",
          note: "Expenses incurred outside the member's period of coverage. No contracted allowance applies, so the full charge is patient responsibility.",
        },
      ],
      disposition: "denied",
      note: "No coverage on the date of service, so there is no allowance to write down.",
    },
    {
      line: 2,
      code: "D1110",
      chargedUsd: 108,
      allowedUsd: 108,
      paidUsd: 0,
      patientOwesUsd: 108,
      writeOffUsd: 0,
      providerAdjustmentUsd: 0,
      adjustments: [
        {
          groupCode: "PR",
          reasonCode: "27",
          amountUsd: 108,
          denialId: "DEN-NOT-ELIGIBLE",
          note: "Same coverage gap applies to the cleaning. The full charge is patient responsibility.",
        },
      ],
      disposition: "denied",
      note: "The practice did real work for an uncovered patient; the balance is legitimately theirs.",
    },
  ],
  correctAction: [
    "Compare the coverage effective and termination dates with the date of service, not with today's date.",
    "Check whether the patient had other coverage active on that date and bill that payer instead.",
    "If the dates are correct and no other coverage applies, bill the patient the full charge — it is not a write-off.",
    "Ask why the gap was not caught at check-in, and change the verification step so the next patient is told before treatment.",
  ],
  teachingPoint:
    "Eligibility is a question about the date of service. A PR-27 balance is the patient's to pay, and the practice's mistake was silence before the appointment, not the claim.",
};

export const DENIAL_SCENARIOS: DentalDenialScenario[] = [
  DENIAL_SCEN_MISSING_ATTACHMENT,
  DENIAL_SCEN_COB,
  DENIAL_SCEN_NON_COVERED,
  DENIAL_SCEN_FREQ_XRAY,
  DENIAL_SCEN_AGE_LIMIT,
  DENIAL_SCEN_ALT_BENEFIT,
  DENIAL_SCEN_FREQ_CROWN,
  DENIAL_SCEN_ANNUAL_MAX,
  DENIAL_SCEN_WAITING,
  DENIAL_SCEN_NOT_ELIGIBLE,
];

export const DENIAL_SCENARIO_INDEX: Record<string, DentalDenialScenario> = Object.fromEntries(
  DENIAL_SCENARIOS.map((s) => [s.id, s]),
);

export function findDenialScenario(id: string): DentalDenialScenario | undefined {
  return DENIAL_SCENARIO_INDEX[id];
}
