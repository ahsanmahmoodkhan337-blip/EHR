/**
 * Dental Case Scenarios — Graded Teaching Cases for the Dental RCM Track
 *
 * Three cases of increasing difficulty, each written to run through the same
 * seven-stage spine as the medical track: registration, eligibility and
 * predetermination, clinical charting, coding, claim submission, review and
 * accounts receivable follow-up.
 *
 * Every case carries deliberate traps. The traps are not tricks — each one is
 * a mistake that costs real dental practices real money every week, and each
 * is scored so the student sees which habit they need to change.
 *
 * CONTENT NOTES
 * - All patients, employers, dentists and payers are fictional.
 * - Plans referenced here are the fictional teaching plans in benefitRules.ts.
 * - Fees and allowances are illustrative teaching figures, not a real fee
 *   schedule and not a real payer's allowable.
 * - Procedure descriptions are original teaching text; no CDT nomenclature or
 *   descriptor is reproduced anywhere in this file.
 */

import type { DenialOutcome } from "./denialReasons";

export type CaseDifficulty = "beginner" | "intermediate" | "advanced";

export type RcmStage =
  | "registration"
  | "eligibility"
  | "clinical"
  | "coding"
  | "claim"
  | "predetermination"
  | "ar-follow-up";

export interface CasePatient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  ageAtServiceDate: number;
  gender: string;
  phone: string;
  address: string;
  /** Subscriber details, which differ from the patient on dependent cases. */
  subscriberName: string;
  relationshipToSubscriber: "self" | "spouse" | "child";
  memberId: string;
  coverageEffectiveDate: string;
  /** Months of continuous coverage on the date of service — drives waiting periods. */
  monthsCoveredAtServiceDate: number;
  secondaryCoverage?: {
    planId: string;
    subscriberName: string;
    memberId: string;
    subscriberDateOfBirth: string;
  };
}

export interface CaseProcedure {
  /** Line reference so grading can point at a specific claim line. */
  line: number;
  code: string;
  /** Universal tooth designation, where the code needs one. */
  tooth?: string;
  surfaces?: string;
  /** Area of the oral cavity, where the code needs one. */
  quadrant?: "00" | "01" | "02" | "03" | "04" | "10" | "20";
  dateOfService: string;
  /** Practice's charged fee. Illustrative. */
  feeUsd: number;
  /** What the student should have on the line; used for grading. */
  expectedNote: string;
}

export interface CaseTrap {
  id: string;
  stage: RcmStage;
  title: string;
  /** The wrong move most students make. */
  commonMistake: string;
  /** Why it is wrong, in plain language. */
  whyItIsWrong: string;
  /** The correct handling. */
  correctAction: string;
  /** Denial id from denialReasons.ts that the mistake produces. */
  producesDenialId?: string;
  pointsAtStake: number;
}

export interface ExpectedLineOutcome {
  line: number;
  code: string;
  chargedUsd: number;
  /** Contracted allowance. Illustrative teaching figure. */
  allowedUsd: number;
  /** Difference between charge and allowance; not billable to the patient in network. */
  contractualWriteOffUsd: number;
  planPaysUsd: number;
  patientOwesUsd: number;
  /**
   * Allowance of the downgrade benchmark, where an alternate benefit applies.
   * Illustrative teaching figure — fed to `evaluateClaim()` so the downgrade
   * maths reproduces this line exactly. Absent where no downgrade applies.
   */
  alternateBenefitAllowedUsd?: number;
  /** Denial or adjustment applied, if any. */
  denialId?: string;
  explanation: string;
}

export interface CaseGradingCriterion {
  stage: RcmStage;
  criterion: string;
  points: number;
}

export interface DentalCaseScenario {
  id: string;
  title: string;
  difficulty: CaseDifficulty;
  estimatedMinutes: number;
  planId: string;
  patient: CasePatient;
  /** Short setup shown to the student before they start. */
  briefing: string;
  /** What the front desk actually captured, including any errors to be caught. */
  registrationNotes: string[];
  /** What an eligibility check returns for this patient. */
  eligibilitySnapshot: {
    status: string;
    remainingAnnualMaximumUsd: number | null;
    deductibleMetUsd: number;
    paidHistory: { code: string; tooth?: string; quadrant?: string; date: string; note: string }[];
    representativeNotes: string[];
  };
  clinicalNote: {
    chiefComplaint: string;
    findings: string[];
    periodontalSummary?: string;
    radiographicFindings: string[];
    diagnosisNarrative: string;
    treatmentPerformed: string[];
    providerNarrativeForPayer?: string;
  };
  procedures: CaseProcedure[];
  predetermination?: {
    required: boolean;
    reason: string;
    attachmentsExpected: string[];
    expectedTurnaroundDays: number;
  };
  traps: CaseTrap[];
  expectedOutcome: ExpectedLineOutcome[];
  expectedTotals: {
    chargedUsd: number;
    allowedUsd: number;
    planPaysUsd: number;
    patientOwesUsd: number;
    writeOffUsd: number;
  };
  arFollowUp?: {
    scenario: string;
    outcome: DenialOutcome;
    callObjectives: string[];
  };
  gradingRubric: {
    maxPoints: number;
    passingPoints: number;
    criteria: CaseGradingCriterion[];
  };
  instructorKey: string[];
}

/* =================================================================== */
/* CASE 1 — BEGINNER                                                    */
/* =================================================================== */

const CASE_HYGIENE_RECALL: DentalCaseScenario = {
  id: "DCASE-001",
  title: "Hygiene recall that does not pay the way the patient expects",
  difficulty: "beginner",
  estimatedMinutes: 20,
  planId: "PLAN-CASCADIA-PPO",
  patient: {
    id: "DPT-1001",
    firstName: "Hina",
    lastName: "Farooq",
    dateOfBirth: "2010-02-14",
    ageAtServiceDate: 16,
    gender: "Female",
    phone: "(555) 0142-889",
    address: "48 Willow Court, Riverbend, ST 00000",
    subscriberName: "Farooq, Imran (father)",
    relationshipToSubscriber: "child",
    memberId: "CDG884120901",
    coverageEffectiveDate: "2022-01-01",
    monthsCoveredAtServiceDate: 61,
  },
  briefing:
    "A teenage patient of record arrives for her six-month hygiene visit. The parent believes preventive care is fully covered and has said so at the desk. Two of the four services will not pay. Your job is to find out which ones before the appointment, not after the explanation of benefits arrives.",
  registrationNotes: [
    "Patient is a dependent child; the subscriber is her father. The claim must carry the subscriber's details, not the patient's.",
    "Address and phone confirmed unchanged from the last visit.",
    "Date of birth on file matches the payer record — worth confirming, because a wrong birth date fakes an age denial.",
    "The parent mentions the family was seen at a different practice last spring while travelling.",
  ],
  eligibilitySnapshot: {
    status: "Active. Dependent child, eligible through the end of the month in which she turns 26.",
    remainingAnnualMaximumUsd: 1500,
    deductibleMetUsd: 0,
    paidHistory: [
      {
        code: "D0274",
        date: "2026-05-09",
        note: "Bitewing set paid to a different practice nine months before this visit. The practice's own chart does not show it.",
      },
      { code: "D1110", date: "2026-05-09", note: "Cleaning paid to the other practice." },
      { code: "D0120", date: "2026-05-09", note: "Evaluation paid to the other practice." },
    ],
    representativeNotes: [
      "Preventive services are paid at 100 percent of the contracted allowance with no deductible.",
      "Bitewings: one set per twelve months, counted from the last date taken.",
      "Fluoride: covered to age 15 inclusive.",
      "Two evaluations and two cleanings per calendar year.",
    ],
  },
  clinicalNote: {
    chiefComplaint: "Routine six-month check-up. No pain or sensitivity reported.",
    findings: [
      "Generalised light plaque, mild marginal inflammation at the lower front teeth.",
      "No new decay detected on examination.",
      "Orthodontic treatment completed last year; retainer worn nightly.",
      "Probing depths 1 to 3 mm throughout, no bleeding on probing beyond the lower anterior region.",
    ],
    radiographicFindings: [
      "Four bitewing images taken today; no interproximal decay identified.",
      "Bone levels within normal limits.",
    ],
    diagnosisNarrative:
      "Healthy dentition with localised gingivitis in the lower anterior region. Continue six-month recall and reinforce flossing technique.",
    treatmentPerformed: [
      "Routine examination for a patient of record.",
      "Four-image cavity-detection radiograph set.",
      "Adult-level cleaning above the gumline.",
      "Fluoride varnish applied at the hygienist's recommendation for orthodontic decalcification risk.",
    ],
  },
  procedures: [
    {
      line: 1,
      code: "D0120",
      dateOfService: "2027-02-11",
      feeUsd: 62,
      expectedNote:
        "Patient of record on a recall visit. The comprehensive evaluation code does not belong here — she has been a patient for years.",
    },
    {
      line: 2,
      code: "D0274",
      dateOfService: "2027-02-11",
      feeUsd: 74,
      expectedNote: "Four-image set. Check the payer's last-taken date before this is exposed, not after.",
    },
    {
      line: 3,
      code: "D1110",
      dateOfService: "2027-02-11",
      feeUsd: 108,
      expectedNote: "Patient is 16, so the adult cleaning code is correct on this plan.",
    },
    {
      line: 4,
      code: "D1206",
      dateOfService: "2027-02-11",
      feeUsd: 44,
      expectedNote: "Clinically reasonable, but past the plan's age cap. It must be quoted to the parent before it is applied.",
    },
  ],
  traps: [
    {
      id: "TRAP-1A",
      stage: "eligibility",
      title: "Checking the practice's chart instead of the payer's history",
      commonMistake:
        "The student sees no bitewings in the practice chart within the last year and assumes the frequency benefit is available.",
      whyItIsWrong:
        "The frequency clock follows the patient, not the practice. Images paid to another dentist nine months ago still count, and only the payer knows about them.",
      correctAction:
        "Ask the payer for the last date of service for bitewings during the eligibility call, then tell the parent before the images are taken.",
      producesDenialId: "DEN-FREQ-XRAY",
      pointsAtStake: 20,
    },
    {
      id: "TRAP-1B",
      stage: "eligibility",
      title: "Assuming preventive means free",
      commonMistake:
        "The student tells the parent the visit is fully covered because preventive services pay at 100 percent.",
      whyItIsWrong:
        "One hundred percent applies only to services that are covered at all. Fluoride on a 16-year-old is outside the age cap, so the percentage never comes into play.",
      correctAction:
        "Check the age limit against the patient's age on the date of service and quote the fluoride fee in advance, or offer to skip it.",
      producesDenialId: "DEN-AGE-LIMIT",
      pointsAtStake: 20,
    },
    {
      id: "TRAP-1C",
      stage: "coding",
      title: "Reaching for the comprehensive evaluation",
      commonMistake:
        "The student chooses the comprehensive evaluation code because the hygienist did a thorough check.",
      whyItIsWrong:
        "This is a routine recall for an established patient. The comprehensive code is limited to once every three years and using it here burns the allowance and invites a denial.",
      correctAction: "Use the routine recall evaluation code for a patient of record.",
      producesDenialId: "DEN-FREQ-EXAM",
      pointsAtStake: 15,
    },
    {
      id: "TRAP-1D",
      stage: "coding",
      title: "Child cleaning code on a 16-year-old",
      commonMistake: "The student uses the child cleaning code because the patient is a dependent.",
      whyItIsWrong:
        "The code boundary is age, not dependent status. This plan expects the adult code from the patient's fourteenth birthday.",
      correctAction: "Select the cleaning code by the patient's age on the date of service.",
      pointsAtStake: 10,
    },
    {
      id: "TRAP-1E",
      stage: "ar-follow-up",
      title: "Appealing a denial that cannot be appealed",
      commonMistake:
        "The student writes an appeal arguing the fluoride was clinically indicated for orthodontic decalcification risk.",
      whyItIsWrong:
        "The payer is not disputing that it was indicated. The benefit stops at an age the patient has passed, and no clinical argument changes an age cap.",
      correctAction:
        "Move the balance to the patient with an explanation, and fix the process so the next teenager is quoted in advance.",
      producesDenialId: "DEN-AGE-LIMIT",
      pointsAtStake: 15,
    },
  ],
  expectedOutcome: [
    {
      line: 1,
      code: "D0120",
      chargedUsd: 62,
      allowedUsd: 58,
      contractualWriteOffUsd: 4,
      planPaysUsd: 58,
      patientOwesUsd: 0,
      explanation: "Covered preventive evaluation, paid at 100 percent of the allowance with no deductible.",
    },
    {
      line: 2,
      code: "D0274",
      chargedUsd: 74,
      allowedUsd: 68,
      contractualWriteOffUsd: 6,
      planPaysUsd: 0,
      patientOwesUsd: 68,
      denialId: "DEN-FREQ-XRAY",
      explanation:
        "Denied on frequency: a set was paid to another practice nine months earlier. Under most participating agreements the patient owes the contracted amount rather than the full fee — confirm the specific contract before billing.",
    },
    {
      line: 3,
      code: "D1110",
      chargedUsd: 108,
      allowedUsd: 95,
      contractualWriteOffUsd: 13,
      planPaysUsd: 95,
      patientOwesUsd: 0,
      explanation:
        "First cleaning of this calendar year — the May visit fell in the previous benefit period, so the allowance is intact. Covered in full at the contracted amount.",
    },
    {
      line: 4,
      code: "D1206",
      chargedUsd: 44,
      allowedUsd: 40,
      contractualWriteOffUsd: 4,
      planPaysUsd: 0,
      patientOwesUsd: 40,
      denialId: "DEN-AGE-LIMIT",
      explanation: "Past the plan's fluoride age cap. Patient responsibility, and it should have been quoted beforehand.",
    },
  ],
  expectedTotals: {
    chargedUsd: 288,
    allowedUsd: 261,
    planPaysUsd: 153,
    patientOwesUsd: 108,
    writeOffUsd: 27,
  },
  arFollowUp: {
    scenario:
      "The parent calls three weeks later, upset that a preventive visit produced a bill. Nothing was miscoded — the practice simply failed to check two rules in advance.",
    outcome: "bill-patient",
    callObjectives: [
      "Explain the difference between a service that is not covered and a service that was coded wrongly.",
      "Show the parent the two specific plan rules that produced the balance.",
      "Offer to schedule the next bitewings after the frequency window reopens.",
      "Record the fluoride age cap on the account so it is quoted before the next visit.",
    ],
  },
  gradingRubric: {
    maxPoints: 100,
    passingPoints: 70,
    criteria: [
      { stage: "registration", criterion: "Subscriber details captured correctly for a dependent child", points: 10 },
      { stage: "eligibility", criterion: "Requested the payer's last-taken date for bitewings", points: 20 },
      { stage: "eligibility", criterion: "Identified the fluoride age cap before treatment", points: 20 },
      { stage: "coding", criterion: "Selected the routine recall evaluation, not the comprehensive code", points: 15 },
      { stage: "coding", criterion: "Selected the cleaning code matching the patient's age", points: 10 },
      { stage: "claim", criterion: "Submitted a clean claim with no missing data", points: 10 },
      { stage: "ar-follow-up", criterion: "Correctly classified both balances as patient responsibility rather than appealing", points: 15 },
    ],
  },
  instructorKey: [
    "The whole case turns on two questions asked during eligibility. Neither is clinical.",
    "Students who appeal the fluoride denial should be shown that an exclusion by age has no clinical remedy.",
    "Use this case to introduce the difference between the charged fee, the contracted allowance and the write-off.",
  ],
};

/* =================================================================== */
/* CASE 2 — INTERMEDIATE                                                */
/* =================================================================== */

const CASE_CROWN_DOWNGRADE: DentalCaseScenario = {
  id: "DCASE-002",
  title: "Crown on a lower molar: downgrade, buildup and a date that crosses the benefit year",
  difficulty: "intermediate",
  estimatedMinutes: 35,
  planId: "PLAN-CASCADIA-PPO",
  patient: {
    id: "DPT-1002",
    firstName: "Daniyal",
    lastName: "Sheikh",
    dateOfBirth: "1992-08-03",
    ageAtServiceDate: 34,
    gender: "Male",
    phone: "(555) 0177-402",
    address: "1207 Grove Street, Apt 3B, Riverbend, ST 00000",
    subscriberName: "Sheikh, Daniyal",
    relationshipToSubscriber: "self",
    memberId: "CDG771205488",
    coverageEffectiveDate: "2025-11-01",
    monthsCoveredAtServiceDate: 14,
  },
  briefing:
    "A patient fractures a cusp on a lower right first molar in December. The tooth is prepared on 18 December and the crown is cemented on 8 January. There is a core buildup, a downgrade provision, and a benefit year boundary sitting in the middle of the case. Get the sequence right and the practice is paid on the first submission.",
  registrationNotes: [
    "Insurance card photographed; the group number on the card matches the eligibility record.",
    "The patient's previous dentist practised overseas and his records list the tooth as 46 in the two-digit system. Our chart must record it in the designation the payer expects.",
    "Patient states he has never had a crown before. Verify against the payer's paid history rather than taking this at face value.",
  ],
  eligibilitySnapshot: {
    status: "Active since 1 November 2025. Fourteen months of continuous coverage on the seat date.",
    remainingAnnualMaximumUsd: 1500,
    deductibleMetUsd: 0,
    paidHistory: [
      { code: "D1110", date: "2026-06-12", note: "Cleaning paid in the prior benefit year." },
      { code: "D0120", date: "2026-06-12", note: "Evaluation paid in the prior benefit year." },
    ],
    representativeNotes: [
      "Major services pay at 50 percent after a 50 dollar deductible, once the twelve-month waiting period is satisfied. It was satisfied on 1 November 2026.",
      "All-ceramic crowns on posterior teeth are benefited at the full cast metal allowance.",
      "Crowns are limited to one per tooth every sixty months.",
      "The plan uses the cementation date as the date of service for crowns.",
      "A predetermination is requested for any plan above 500 dollars.",
    ],
  },
  clinicalNote: {
    chiefComplaint: "Sharp pain when biting on the lower right side since chewing on a date stone two days ago.",
    findings: [
      "Lower right first molar: fractured lingual cusp with the fragment mobile; a large old filling occupies the middle of the tooth.",
      "Estimated remaining sound tooth structure after removing the old filling and the fracture: approximately one third of the crown.",
      "No swelling, no sinus tract. Tooth responds within normal limits to cold and is not tender to percussion at the root tip.",
      "Probing depths around the tooth 2 to 3 mm with no bleeding.",
    ],
    radiographicFindings: [
      "Pre-operative image shows a wide existing restoration approaching but not entering the nerve chamber.",
      "No widening at the root tip and no bone loss around the tooth.",
    ],
    diagnosisNarrative:
      "Fractured cusp on a heavily restored lower molar. The remaining structure will not support another direct filling. Full-coverage restoration indicated, with a rebuild first because too little tooth remains to hold a crown on its own.",
    treatmentPerformed: [
      "18 December: old filling and fractured segment removed, rebuild placed to restore the missing walls, tooth prepared for full coverage, temporary crown fitted.",
      "8 January: temporary removed, permanent all-ceramic crown fitted, adjusted and cemented.",
    ],
    providerNarrativeForPayer:
      "After removing the failed restoration and the fractured lingual cusp, roughly two thirds of the clinical crown was missing, including the entire lingual wall. A rebuild was required to establish retention before the tooth could be prepared for full coverage. Pre-operative image attached.",
  },
  procedures: [
    {
      line: 1,
      code: "D2950",
      tooth: "30",
      dateOfService: "2027-01-08",
      feeUsd: 288,
      expectedNote:
        "Rebuild. Submitted with the crown on the cementation date, supported by the narrative and the pre-operative image.",
    },
    {
      line: 2,
      code: "D2740",
      tooth: "30",
      dateOfService: "2027-01-08",
      feeUsd: 1320,
      expectedNote:
        "All-ceramic crown actually delivered. Bill what was done; expect the allowance to be set at the metal crown level.",
    },
  ],
  predetermination: {
    required: true,
    reason:
      "The treatment plan exceeds the plan's review threshold, and the downgrade provision means the patient's share cannot be quoted accurately without a written estimate.",
    attachmentsExpected: [
      "Pre-operative radiograph of the tooth",
      "Narrative describing how much sound structure remained after the fracture was removed",
      "Treatment plan with the proposed codes and fees",
    ],
    expectedTurnaroundDays: 14,
  },
  traps: [
    {
      id: "TRAP-2A",
      stage: "coding",
      title: "Tooth designation carried over from the two-digit system",
      commonMistake: "The student enters tooth 46 on the claim because that is what the previous records say.",
      whyItIsWrong:
        "Forty-six is a valid designation in the two-digit international system but not in the Universal system the claim uses, where teeth are numbered 1 to 32. The claim will reject before anyone reads it.",
      correctAction: "Convert to the Universal designation for the lower right first molar, which is 30.",
      producesDenialId: "DEN-TOOTH-ELIGIBILITY",
      pointsAtStake: 15,
    },
    {
      id: "TRAP-2B",
      stage: "claim",
      title: "Billing the crown on the preparation date",
      commonMistake: "The student submits the crown with the 18 December preparation date because that is when the work was done.",
      whyItIsWrong:
        "This plan uses the cementation date. Submitting December pulls the claim into the prior benefit year, where the deductible and the maximum are in a different state, and the patient estimate the practice gave will be wrong.",
      correctAction:
        "Submit with the 8 January cementation date and calculate the patient's share against the new benefit year.",
      pointsAtStake: 20,
    },
    {
      id: "TRAP-2C",
      stage: "coding",
      title: "Downgrading the code instead of letting the payer downgrade the allowance",
      commonMistake:
        "Knowing the plan pays at the metal crown level, the student submits the metal crown code to match.",
      whyItIsWrong:
        "The claim must describe the service actually delivered. Reporting a crown that was not placed misstates the record, and it strips the patient of the written evidence they need to understand their own bill.",
      correctAction:
        "Bill the ceramic crown that was delivered, expect a reduced allowance, and bill the difference to the patient as an upgrade.",
      producesDenialId: "DEN-ALT-BENEFIT",
      pointsAtStake: 20,
    },
    {
      id: "TRAP-2D",
      stage: "claim",
      title: "Sending the buildup without support",
      commonMistake: "The student submits the rebuild alongside the crown with no radiograph and no narrative.",
      whyItIsWrong:
        "Rebuilds are among the most reviewed codes in dentistry. Without evidence of how much tooth was missing, the payer treats the rebuild as part of preparing the tooth and pays nothing for it.",
      correctAction:
        "Attach the pre-operative image and the narrative on the first submission. This case has the documentation; use it.",
      producesDenialId: "DEN-BUNDLE-BUILDUP",
      pointsAtStake: 20,
    },
    {
      id: "TRAP-2E",
      stage: "eligibility",
      title: "Treating the predetermination as a guarantee",
      commonMistake: "The student quotes the predetermination amount to the patient as the final figure.",
      whyItIsWrong:
        "A predetermination is an estimate based on the benefits as they stood that day. Eligibility, the remaining maximum and the deductible are all re-tested on the date of service.",
      correctAction:
        "Quote it as an estimate, re-verify eligibility on the cementation date, and say plainly that the final amount depends on benefits at that time.",
      pointsAtStake: 10,
    },
  ],
  expectedOutcome: [
    {
      line: 1,
      code: "D2950",
      chargedUsd: 288,
      allowedUsd: 240,
      contractualWriteOffUsd: 48,
      planPaysUsd: 95,
      patientOwesUsd: 145,
      explanation:
        "Approved on the strength of the narrative and the image. The 50 dollar deductible for the new benefit year is taken from this line first: 240 less 50 leaves 190, paid at 50 percent, which is 95. The patient owes the 50 dollar deductible plus the other half of the balance.",
    },
    {
      line: 2,
      code: "D2740",
      chargedUsd: 1320,
      allowedUsd: 1100,
      alternateBenefitAllowedUsd: 980,
      contractualWriteOffUsd: 220,
      planPaysUsd: 490,
      patientOwesUsd: 610,
      denialId: "DEN-ALT-BENEFIT",
      explanation:
        "Covered, but benefited at the full cast metal allowance of 980 under the plan's alternate benefit provision. The deductible was already taken on the first line, so 980 is paid at 50 percent, which is 490. The patient owes the rest of the 1100 contracted allowance, which includes the upgrade difference.",
    },
  ],
  expectedTotals: {
    chargedUsd: 1608,
    allowedUsd: 1340,
    planPaysUsd: 585,
    patientOwesUsd: 755,
    writeOffUsd: 268,
  },
  arFollowUp: {
    scenario:
      "The remittance arrives showing the crown paid at a lower allowance than billed. A student who did not read the predetermination assumes it was underpaid and starts an appeal.",
    outcome: "bill-patient",
    callObjectives: [
      "Recognise from the remittance that this is an alternate benefit, not an underpayment or a denial.",
      "Confirm the remaining annual maximum after this claim so the next treatment is quoted correctly.",
      "Verify that the buildup was paid rather than bundled, and note what documentation achieved that.",
      "Post the patient balance with a clear explanation of the upgrade difference.",
    ],
  },
  gradingRubric: {
    maxPoints: 120,
    passingPoints: 84,
    criteria: [
      { stage: "registration", criterion: "Tooth recorded in the designation the claim expects", points: 15 },
      { stage: "eligibility", criterion: "Confirmed the waiting period was satisfied before the seat date", points: 10 },
      { stage: "eligibility", criterion: "Identified the posterior crown downgrade and quoted it in advance", points: 20 },
      { stage: "predetermination", criterion: "Submitted a predetermination with radiograph and narrative", points: 15 },
      { stage: "coding", criterion: "Billed the crown actually delivered rather than the downgrade code", points: 20 },
      { stage: "claim", criterion: "Used the cementation date as the date of service", points: 20 },
      { stage: "claim", criterion: "Attached buildup documentation on the first submission", points: 10 },
      { stage: "ar-follow-up", criterion: "Read the remittance correctly and did not appeal the alternate benefit", points: 10 },
    ],
  },
  instructorKey: [
    "Run the benefit year boundary explicitly on the whiteboard: the same two lines produce different patient balances depending on which year they land in.",
    "The buildup is approved here only because the note supports it. Ask students what they would do if the note simply said 'buildup placed'.",
    "Students frequently confuse the alternate benefit with a denial. Have them point to the line on the remittance that shows the service was covered.",
  ],
};

/* =================================================================== */
/* CASE 3 — ADVANCED                                                    */
/* =================================================================== */

const CASE_PERIO_IMPLANT: DentalCaseScenario = {
  id: "DCASE-003",
  title: "Periodontal therapy and a replacement tooth: quadrant counts, a missing tooth clause and a second plan that pays nothing",
  difficulty: "advanced",
  estimatedMinutes: 50,
  planId: "PLAN-NORTHWIND-TRUST",
  patient: {
    id: "DPT-1003",
    firstName: "Rubina",
    lastName: "Qadir",
    dateOfBirth: "1968-11-22",
    ageAtServiceDate: 58,
    gender: "Female",
    phone: "(555) 0198-731",
    address: "9 Marine Drive, Harbor City, ST 00000",
    subscriberName: "Qadir, Rubina",
    relationshipToSubscriber: "self",
    memberId: "NWT560112774",
    coverageEffectiveDate: "2025-12-01",
    monthsCoveredAtServiceDate: 14,
    secondaryCoverage: {
      planId: "PLAN-CASCADIA-PPO",
      subscriberName: "Qadir, Tariq (spouse)",
      memberId: "CDG669301255",
      subscriberDateOfBirth: "1965-04-02",
    },
  },
  briefing:
    "A new patient presents with moderate periodontal disease and a gap where a lower left first molar was extracted four years ago. She wants an implant. She has coverage through her own employer and secondary coverage through her husband. Three separate rules will decide what gets paid, and only one of them is about the treatment itself.",
  registrationNotes: [
    "Two insurance cards presented. Establish which plan is primary before anything is submitted — her own employer's plan is primary for her, and her husband's plan is secondary.",
    "The secondary plan coordinates on a non-duplication basis, which changes what the patient should be told to expect.",
    "The patient says the lower left molar 'came out years ago'. The exact date matters more than she realises; ask for the year and the treating dentist.",
    "Coverage under the primary plan began 1 December 2025, fourteen months before the date of service.",
  ],
  eligibilitySnapshot: {
    status: "Active. Fourteen months of continuous coverage.",
    remainingAnnualMaximumUsd: 2500,
    deductibleMetUsd: 0,
    paidHistory: [],
    representativeNotes: [
      "Basic services pay at 90 percent after a 25 dollar deductible; major services at 60 percent.",
      "Scaling and root planing is limited to one treatment per quadrant every twenty-four months and is reviewed with a current pocket chart at any amount.",
      "Implants and implant-supported restorations are excluded from this plan entirely.",
      "Teeth missing before the coverage effective date are excluded from replacement benefits until the member has twenty-four months of continuous coverage.",
      "Periodontal maintenance is allowed four times per benefit period and is counted separately from routine cleanings.",
    ],
  },
  clinicalNote: {
    chiefComplaint:
      "Bleeding gums, food packing on the lower left, and a wish to replace the missing back tooth so she can chew evenly.",
    findings: [
      "Upper right quadrant: pocket depths of 5 to 7 mm with bleeding on probing at the second premolar, first molar, second molar, canine and first premolar — five teeth involved.",
      "Lower left quadrant: pocket depths of 5 to 6 mm at the second premolar, second molar and canine — three teeth involved. Remaining teeth in that quadrant probe at 3 mm or less.",
      "Upper left and lower right quadrants probe within normal limits with no bleeding.",
      "Lower left first molar absent; the space has partially closed and the opposing upper tooth has over-erupted slightly.",
      "Moderate calculus deposits below the gumline in both affected quadrants.",
    ],
    periodontalSummary:
      "Localised moderate periodontitis affecting two quadrants, with clear differences in the number of teeth involved in each. Full six-point pocket chart recorded today.",
    radiographicFindings: [
      "Horizontal bone loss of roughly 30 percent in the upper right posterior region and around the lower left second molar.",
      "Healed extraction site at the lower left first molar with adequate bone height for an implant.",
      "No decay requiring restoration at this visit.",
    ],
    diagnosisNarrative:
      "Localised moderate periodontitis requiring non-surgical therapy in two quadrants, followed by re-evaluation. Separately, a long-standing missing lower left first molar for which the patient requests an implant.",
    treatmentPerformed: [
      "12 February: deep cleaning below the gumline of the upper right quadrant, five teeth involved, under local anaesthetic.",
      "12 February: deep cleaning below the gumline of the lower left quadrant, three teeth involved, under local anaesthetic.",
      "Implant discussed and treatment planned; nothing surgical performed at this visit pending benefit review.",
    ],
    providerNarrativeForPayer:
      "Six-point pocket charting recorded on the date of service is attached, with the involved teeth identified per quadrant. Radiographs demonstrating bone loss in both treated quadrants are attached. Non-surgical therapy was completed in two quadrants; re-evaluation scheduled at six weeks.",
  },
  procedures: [
    {
      line: 1,
      code: "D4341",
      quadrant: "01",
      dateOfService: "2027-02-12",
      feeUsd: 312,
      expectedNote: "Upper right quadrant, five qualifying teeth documented. The four-or-more code is correct here.",
    },
    {
      line: 2,
      code: "D4342",
      quadrant: "03",
      dateOfService: "2027-02-12",
      feeUsd: 198,
      expectedNote:
        "Lower left quadrant, only three qualifying teeth documented. The limited code is correct, and billing the higher one would be upcoding.",
    },
  ],
  predetermination: {
    required: true,
    reason:
      "Periodontal therapy is reviewed with a pocket chart at any amount under this plan, and the implant treatment plan needs a written benefit determination before the patient can decide anything.",
    attachmentsExpected: [
      "Six-point periodontal chart dated the day of treatment, with the involved teeth marked per quadrant",
      "Radiographs showing bone loss in the treated quadrants",
      "For the implant plan: the extraction date of the lower left first molar and a radiograph of the healed site",
    ],
    expectedTurnaroundDays: 21,
  },
  traps: [
    {
      id: "TRAP-3A",
      stage: "coding",
      title: "Same scaling code for both quadrants",
      commonMistake:
        "The student bills the four-or-more-teeth code for both quadrants because both appointments took the same time and the same effort.",
      whyItIsWrong:
        "The code is chosen by the number of diseased teeth documented in that quadrant, not by chair time. The lower left has three, so the higher code is unsupported — and the pocket chart the practice itself attached proves it.",
      correctAction:
        "Count the qualifying teeth per quadrant from the chart and code each quadrant on its own merits.",
      producesDenialId: "DEN-SRP-TOOTH-COUNT",
      pointsAtStake: 25,
    },
    {
      id: "TRAP-3B",
      stage: "eligibility",
      title: "Quoting the implant without testing the exclusion first",
      commonMistake:
        "The student calculates an implant estimate at the major services percentage and gives the patient a number.",
      whyItIsWrong:
        "The primary plan excludes implants outright. A percentage of a service that is not covered is not a smaller payment, it is nothing. Two separate rules bar it here — the exclusion and the missing tooth clause — and the estimate was never possible.",
      correctAction:
        "Check the exclusion list before doing any arithmetic, then quote the implant as a full self-pay fee and explain both rules.",
      producesDenialId: "DEN-NOT-COVERED",
      pointsAtStake: 20,
    },
    {
      id: "TRAP-3C",
      stage: "eligibility",
      title: "Missing the missing tooth clause on the fall-back option",
      commonMistake:
        "Told the implant is excluded, the student proposes a partial denture instead and assumes it will be covered at the major rate.",
      whyItIsWrong:
        "The missing tooth clause applies to any replacement of a tooth lost before coverage began, whatever form the replacement takes. The tooth came out four years ago and she has fourteen months of coverage, so the clause still bites. It drops away at twenty-four months.",
      correctAction:
        "Establish the extraction date, apply the clause to every replacement option, and tell the patient the date the clause expires so she can make an informed choice about timing.",
      producesDenialId: "DEN-MISSING-TOOTH",
      pointsAtStake: 25,
    },
    {
      id: "TRAP-3D",
      stage: "claim",
      title: "Promising that the secondary plan will cover the rest",
      commonMistake:
        "The student tells the patient that whatever the primary leaves, the husband's plan will pick up.",
      whyItIsWrong:
        "The secondary coordinates on a non-duplication basis: it pays only the amount by which its own benefit would have exceeded what the primary already paid. With the primary paying at 90 percent on basic services, there is usually nothing left for it to pay.",
      correctAction:
        "Explain non-duplication before treatment, still submit to the secondary with the primary remittance attached, and expect little or nothing.",
      pointsAtStake: 20,
    },
    {
      id: "TRAP-3E",
      stage: "ar-follow-up",
      title: "Booking the follow-up hygiene visit as a routine cleaning",
      commonMistake:
        "After the deep cleaning, the student books the three-month review as a routine cleaning because it is cheaper for the patient.",
      whyItIsWrong:
        "Once active periodontal therapy is complete, the recall is periodontal maintenance. Choosing the hygiene code by price rather than by diagnosis contradicts the chart and is exactly the pattern payer audits look for.",
      correctAction:
        "Book periodontal maintenance. On this plan it is allowed four times a year and counted separately from routine cleanings, so the correct code is also the better-covered one.",
      producesDenialId: "DEN-PERIO-MAINT-CONFLICT",
      pointsAtStake: 15,
    },
    {
      id: "TRAP-3F",
      stage: "predetermination",
      title: "Sending the perio claim without the chart",
      commonMistake: "The student submits both scaling lines with no periodontal charting attached.",
      whyItIsWrong:
        "This plan reviews periodontal therapy at any amount. Without the chart there is no evidence of disease, and the claim is denied as unsupported even though the treatment was appropriate.",
      correctAction: "Attach the dated six-point chart and the radiographs on the first submission.",
      producesDenialId: "DEN-MED-NEC",
      pointsAtStake: 15,
    },
  ],
  expectedOutcome: [
    {
      line: 1,
      code: "D4341",
      chargedUsd: 312,
      allowedUsd: 265,
      contractualWriteOffUsd: 47,
      planPaysUsd: 216,
      patientOwesUsd: 49,
      explanation:
        "Five qualifying teeth documented in the upper right quadrant, so the four-or-more code is supported. The 25 dollar deductible is taken from this line: 265 less 25 leaves 240, paid at 90 percent, which is 216. The patient owes the deductible plus 24.",
    },
    {
      line: 2,
      code: "D4342",
      chargedUsd: 198,
      allowedUsd: 175,
      contractualWriteOffUsd: 23,
      planPaysUsd: 157.5,
      patientOwesUsd: 17.5,
      explanation:
        "Three qualifying teeth in the lower left quadrant, so the limited code is the correct one. Deductible already satisfied, so 175 is paid at 90 percent.",
    },
  ],
  expectedTotals: {
    chargedUsd: 510,
    allowedUsd: 440,
    planPaysUsd: 373.5,
    patientOwesUsd: 66.5,
    writeOffUsd: 70,
  },
  arFollowUp: {
    scenario:
      "The secondary plan returns its remittance paying nothing under non-duplication. The patient calls believing she has two insurances and should owe nothing at all. Separately, the implant predetermination comes back denied on two grounds.",
    outcome: "no-recourse-educate-patient",
    callObjectives: [
      "Explain non-duplication coordination in one plain sentence the patient can repeat to her husband.",
      "Confirm with the primary payer the exact date the missing tooth clause expires for this member.",
      "Establish whether the implant exclusion is a plan design decision rather than a clinical one, so the patient understands there is nothing to appeal.",
      "Present the options honestly: self-pay now, or wait until the clause expires and revisit a covered replacement option.",
      "Document the call reference numbers and set a follow-up task for the month the clause expires.",
    ],
  },
  gradingRubric: {
    maxPoints: 150,
    passingPoints: 105,
    criteria: [
      { stage: "registration", criterion: "Identified the correct primary and secondary plans", points: 15 },
      { stage: "registration", criterion: "Captured the extraction date of the missing tooth", points: 15 },
      { stage: "eligibility", criterion: "Found the implant exclusion before estimating anything", points: 20 },
      { stage: "eligibility", criterion: "Applied the missing tooth clause to every replacement option", points: 25 },
      { stage: "coding", criterion: "Coded each quadrant by its own documented tooth count", points: 25 },
      { stage: "predetermination", criterion: "Attached the dated pocket chart and radiographs", points: 15 },
      { stage: "claim", criterion: "Set correct expectations for the non-duplication secondary", points: 20 },
      { stage: "ar-follow-up", criterion: "Booked the follow-up as periodontal maintenance, matching the diagnosis", points: 15 },
    ],
  },
  instructorKey: [
    "Ask students to write the two scaling codes before they see the pocket chart, then again after. The gap between the two answers is the lesson.",
    "This case has two independent reasons the implant is not payable. Students who find only one have not finished the verification.",
    "Non-duplication coordination is the most commonly mis-explained concept at the front desk. Have each student say it out loud in one sentence.",
    "The missing tooth clause expires here at twenty-four months of coverage. A patient who understands that can make a genuine financial choice, which is the whole point of doing this work well.",
  ],
};

export const DENTAL_CASE_SCENARIOS: DentalCaseScenario[] = [
  CASE_HYGIENE_RECALL,
  CASE_CROWN_DOWNGRADE,
  CASE_PERIO_IMPLANT,
];

export const DENTAL_CASE_INDEX: Record<string, DentalCaseScenario> = Object.fromEntries(
  DENTAL_CASE_SCENARIOS.map((c) => [c.id, c]),
);

export function findCase(id: string): DentalCaseScenario | undefined {
  return DENTAL_CASE_INDEX[id];
}

export function casesByDifficulty(difficulty: CaseDifficulty): DentalCaseScenario[] {
  return DENTAL_CASE_SCENARIOS.filter((c) => c.difficulty === difficulty);
}

/** Traps for one stage across all cases — useful for a stage-level drill mode. */
export function trapsForStage(stage: RcmStage): CaseTrap[] {
  return DENTAL_CASE_SCENARIOS.flatMap((c) => c.traps.filter((t) => t.stage === stage));
}
