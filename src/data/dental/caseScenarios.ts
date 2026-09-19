/**
 * Dental Case Scenarios — Graded Teaching Cases for the Dental RCM Track
 *
 * Seven graded cases of increasing difficulty, each written to run through the
 * same seven-stage spine as the medical track: registration, eligibility and
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

/* =================================================================== */
/* CASE 4 — INTERMEDIATE: restorative downgrade + aged-out fluoride     */
/* =================================================================== */

const CASE_POSTERIOR_COMPOSITE_DOWNGRADE: DentalCaseScenario = {
  id: "DCASE-004",
  title: "A tooth-coloured filling that pays like a metal one — plus a fluoride benefit that has aged out",
  difficulty: "intermediate",
  estimatedMinutes: 30,
  planId: "PLAN-CASCADIA-PPO",
  patient: {
    id: "DPT-1004",
    firstName: "Zara",
    lastName: "Abbasi",
    dateOfBirth: "2010-08-21",
    ageAtServiceDate: 16,
    gender: "Female",
    phone: "(555) 0133-274",
    address: "211 Cedar Lane, Riverbend, ST 00000",
    subscriberName: "Abbasi, Sana (mother)",
    relationshipToSubscriber: "child",
    memberId: "CDG550118902",
    coverageEffectiveDate: "2021-01-01",
    monthsCoveredAtServiceDate: 74,
  },
  briefing:
    "A teenager returns from orthodontics with decay on a lower back tooth. The parent wants a tooth-coloured filling and assumes it is paid in full. Two plan rules change that arithmetic before a single impression is taken: a posterior composite is paid at the metal-filling allowance, and the fluoride the hygienist recommends is past the plan's age cap.",
  registrationNotes: [
    "Dependent child; the subscriber is her mother. Claim must carry the subscriber's details.",
    "Orthodontic treatment completed last year; patient now in retainers.",
    "The parent states the family has never had a filling denied before and expects the visit to be fully covered.",
  ],
  eligibilitySnapshot: {
    status: "Active. Dependent child, eligible through the end of the month in which she turns 26.",
    remainingAnnualMaximumUsd: 1500,
    deductibleMetUsd: 0,
    paidHistory: [
      { code: "D1110", date: "2026-09-15", note: "Recall cleaning six months ago; no fluoride that visit." },
    ],
    representativeNotes: [
      "Basic services pay at 80 percent after the 50 dollar deductible.",
      "Posterior tooth-coloured fillings are paid at the matching amalgam allowance under an alternate benefit provision.",
      "Fluoride is covered to age 15 inclusive. The patient is 16 on the date of service.",
    ],
  },
  clinicalNote: {
    chiefComplaint: "Routine recall, plus a spot the orthodontist asked us to watch on the lower right.",
    findings: [
      "Lower right first molar: an active cavity on the biting surface and the side facing the cheek, confirmed clinically.",
      "No other new decay. Existing fillings intact.",
      "High caries risk due to completed orthodontic treatment and a history of decalcification during treatment.",
      "Probing depths within normal limits.",
    ],
    radiographicFindings: [
      "Bitewing images show a two-surface cavity on the lower right first molar, into dentin but not near the nerve.",
    ],
    diagnosisNarrative:
      "Two-surface decay on the lower right first molar requiring a tooth-coloured filling. Fluoride varnish indicated as a preventive measure for orthodontic decalcification risk.",
    treatmentPerformed: [
      "Two-surface tooth-coloured filling placed on the lower right first molar.",
      "Fluoride varnish applied to reduce decalcification risk.",
    ],
  },
  procedures: [
    {
      line: 1,
      code: "D2392",
      tooth: "30",
      surfaces: "MO",
      dateOfService: "2027-03-04",
      feeUsd: 248,
      expectedNote:
        "Two-surface posterior composite actually delivered. Bill the composite, not the amalgam; expect the allowance at the metal-filling level.",
    },
    {
      line: 2,
      code: "D1206",
      dateOfService: "2027-03-04",
      feeUsd: 44,
      expectedNote: "Fluoride varnish. Clinically indicated, but the patient is past the plan's age cap — quote it before it is applied.",
    },
  ],
  traps: [
    {
      id: "TRAP-4A",
      stage: "coding",
      title: "Reporting the amalgam code to match the downgrade",
      commonMistake: "Knowing the plan pays at the metal-filling level, the student bills the amalgam code instead of the composite.",
      whyItIsWrong:
        "The claim must describe the filling actually placed. Reporting an amalgam that was not placed misstates the record and hides the upgrade difference from the parent.",
      correctAction: "Bill the composite code, expect the reduced allowance, and bill the difference to the patient as an upgrade.",
      producesDenialId: "DEN-ALT-BENEFIT",
      pointsAtStake: 20,
    },
    {
      id: "TRAP-4B",
      stage: "coding",
      title: "Overstating the surfaces to offset the downgrade",
      commonMistake: "The student lists three surfaces on the claim because the filling felt large and they want to soften the downgrade.",
      whyItIsWrong:
        "The surfaces on the claim must match the clinical note. Two surfaces were restored; a third listed surface is upcoding, and it is exactly what a restorative audit checks first.",
      correctAction: "Code the surfaces from the note, not from the desired fee.",
      producesDenialId: "DEN-SURFACE-MISMATCH",
      pointsAtStake: 15,
    },
    {
      id: "TRAP-4C",
      stage: "eligibility",
      title: "Quoting the visit as fully covered",
      commonMistake: "The student tells the parent preventive and basic are both 'covered', so nothing is owed.",
      whyItIsWrong:
        "Covered is not the same as free. The composite is paid at the amalgam allowance with a deductible and 20 percent coinsurance, and the fluoride is not covered at all past the age cap.",
      correctAction: "Run the downgrade arithmetic and the age check before the appointment and quote the patient's share in writing.",
      producesDenialId: "DEN-ALT-BENEFIT",
      pointsAtStake: 15,
    },
    {
      id: "TRAP-4D",
      stage: "ar-follow-up",
      title: "Appealing the fluoride denial on clinical grounds",
      commonMistake: "The student writes an appeal arguing the fluoride was indicated for orthodontic decalcification risk.",
      whyItIsWrong:
        "The payer is not disputing the indication. The benefit stops at an age the patient has passed, and no clinical argument changes an age cap.",
      correctAction: "Move the fluoride balance to the patient, and flag the account so the next over-age patient is quoted in advance.",
      producesDenialId: "DEN-AGE-LIMIT",
      pointsAtStake: 10,
    },
  ],
  expectedOutcome: [
    {
      line: 1,
      code: "D2392",
      chargedUsd: 248,
      allowedUsd: 210,
      alternateBenefitAllowedUsd: 180,
      contractualWriteOffUsd: 38,
      planPaysUsd: 104,
      patientOwesUsd: 106,
      denialId: "DEN-ALT-BENEFIT",
      explanation:
        "Covered, but benefited at the two-surface amalgam allowance of 180 under the plan's alternate benefit provision. The 50 dollar deductible is taken first: 180 less 50 leaves 130, paid at 80 percent, which is 104. The patient owes the deductible plus the 20 percent coinsurance plus the difference between the composite and amalgam allowances.",
    },
    {
      line: 2,
      code: "D1206",
      chargedUsd: 44,
      allowedUsd: 40,
      contractualWriteOffUsd: 4,
      planPaysUsd: 0,
      patientOwesUsd: 40,
      denialId: "DEN-AGE-LIMIT",
      explanation:
        "Past the plan's fluoride age cap of 15 — the patient is 16 on the date of service. Not payable at any percentage, and no clinical argument changes an age cap. Patient responsibility, quoted beforehand.",
    },
  ],
  expectedTotals: {
    chargedUsd: 292,
    allowedUsd: 250,
    planPaysUsd: 104,
    patientOwesUsd: 146,
    writeOffUsd: 42,
  },
  arFollowUp: {
    scenario:
      "The parent calls, confused that a routine visit produced a bill after she was told the plan 'covers' fillings and fluoride. Nothing was miscoded — two rules were simply not explained in advance.",
    outcome: "bill-patient",
    callObjectives: [
      "Explain the alternate benefit: the filling was covered, just at the metal-filling allowance, and the difference is the patient's upgrade.",
      "Distinguish the downgrade (a covered service at a lower allowance) from the fluoride (not covered at all past the age cap).",
      "Show the parent the two specific plan rules that produced the balance.",
      "Record both rules on the account so the next visit is quoted correctly before treatment.",
    ],
  },
  gradingRubric: {
    maxPoints: 100,
    passingPoints: 70,
    criteria: [
      { stage: "eligibility", criterion: "Identified the posterior composite downgrade before treatment", points: 20 },
      { stage: "eligibility", criterion: "Identified the fluoride age cap before treatment", points: 15 },
      { stage: "coding", criterion: "Billed the composite actually delivered, not the amalgam code", points: 20 },
      { stage: "coding", criterion: "Coded the surfaces to match the clinical note", points: 15 },
      { stage: "claim", criterion: "Submitted a clean claim with the correct surfaces and tooth number", points: 10 },
      { stage: "ar-follow-up", criterion: "Did not appeal the fluoride age cap; posted both balances correctly", points: 20 },
    ],
  },
  instructorKey: [
    "This case isolates the downgrade from the age cap so students learn to tell the two apart on one remittance.",
    "Have students write out the composite arithmetic by hand: allowance 180, less 50 deductible, times 80 percent.",
    "The surface-count trap is the line between a billing correction and fraud — reinforce that the note drives the code.",
  ],
};

/* =================================================================== */
/* CASE 5 — INTERMEDIATE: endo sequence with an appealable frequency    */
/* =================================================================== */

const CASE_ENDO_CROWN_FREQUENCY: DentalCaseScenario = {
  id: "DCASE-005",
  title: "Root canal through an old crown: the replacement crown is denied, and this time it is worth appealing",
  difficulty: "intermediate",
  estimatedMinutes: 40,
  planId: "PLAN-CASCADIA-PPO",
  patient: {
    id: "DPT-1005",
    firstName: "Kamran",
    lastName: "Malik",
    dateOfBirth: "1982-01-20",
    ageAtServiceDate: 45,
    gender: "Male",
    phone: "(555) 0149-206",
    address: "44 Harbor Road, Riverbend, ST 00000",
    subscriberName: "Malik, Kamran",
    relationshipToSubscriber: "self",
    memberId: "CDG880214633",
    coverageEffectiveDate: "2022-06-01",
    monthsCoveredAtServiceDate: 57,
  },
  briefing:
    "A patient presents in pain from a lower molar that already carries a crown placed by a previous dentist. The tooth needs a root canal, a post and core, and a new crown. The practice's own chart shows no crown history, but the payer's does. The root canal and post will pay; the crown will come back denied on frequency — and because the failure is new decay rather than normal wear, that denial is appealable.",
  registrationNotes: [
    "Patient states he has had the crown 'for years' but cannot remember the dentist or the exact date.",
    "The practice's chart does not show the crown because it was placed elsewhere.",
    "Pre-operative radiograph will be needed to show the decay under the crown.",
  ],
  eligibilitySnapshot: {
    status: "Active. Fifty-seven months of continuous coverage.",
    remainingAnnualMaximumUsd: 1500,
    deductibleMetUsd: 0,
    paidHistory: [
      {
        code: "D2740",
        tooth: "30",
        date: "2024-02-28",
        note: "Crown paid on tooth 30 by a previous dentist. The practice's own chart does not show it.",
      },
    ],
    representativeNotes: [
      "Major services pay at 50 percent after the 50 dollar deductible, once the twelve-month waiting period is satisfied.",
      "Crowns are limited to one per tooth every sixty months, measured from the seat date of the prior crown — including one placed by another dentist.",
      "The plan uses the cementation date as the date of service for crowns.",
      "A predetermination is requested for any plan above 500 dollars.",
    ],
  },
  clinicalNote: {
    chiefComplaint: "Dull ache and cold sensitivity in the lower right back tooth, worse over the last week.",
    findings: [
      "Lower right first molar carries a full-coverage crown with a small gap at the margin on the cheek side.",
      "Tooth responds to cold with lingering pain and is tender to percussion.",
      "No swelling and no sinus tract.",
    ],
    radiographicFindings: [
      "New decay visible beneath the crown margin, approaching the nerve chamber.",
      "The nerve chamber shows no prior root canal fill material — the tooth was crowned without root canal treatment.",
      "Bone around the root tips within normal limits.",
    ],
    diagnosisNarrative:
      "Irreversible pulpitis of the lower right first molar secondary to decay under an existing crown. Root canal therapy indicated, followed by a post and core and a replacement crown. The prior crown has failed because of new decay, not normal wear.",
    treatmentPerformed: [
      "10 March: root canal therapy completed on the lower right first molar, post and core placed, temporary crown fitted.",
      "14 April: permanent all-ceramic crown fitted and cemented.",
    ],
    providerNarrativeForPayer:
      "Pre-operative radiograph demonstrates new decay extending under the margin of the existing crown into the pulp. The tooth had not previously had root canal treatment. The prior crown failed due to recurrent decay, not wear; replacement is required to restore the tooth.",
  },
  procedures: [
    {
      line: 1,
      code: "D3330",
      tooth: "30",
      dateOfService: "2027-03-10",
      feeUsd: 1285,
      expectedNote: "Molar root canal. Pre- and post-operative radiographs attached.",
    },
    {
      line: 2,
      code: "D2954",
      tooth: "30",
      dateOfService: "2027-03-10",
      feeUsd: 315,
      expectedNote: "Prefabricated post and core on a root-canal-treated tooth. Do not also bill a core buildup on the same tooth.",
    },
    {
      line: 3,
      code: "D2740",
      tooth: "30",
      dateOfService: "2027-04-14",
      feeUsd: 1320,
      expectedNote:
        "Replacement crown on the cementation date. Expect a frequency denial — the prior crown was paid three years ago — and prepare the appeal with the decay radiograph.",
    },
  ],
  predetermination: {
    required: true,
    reason:
      "The combined treatment plan exceeds the plan's review threshold, and the crown history needs to be confirmed in writing before the patient is quoted.",
    attachmentsExpected: [
      "Pre-operative radiograph showing the decay under the existing crown",
      "Narrative stating the prior crown failed from new decay, not wear",
      "Post-operative radiograph of the completed root canal",
    ],
    expectedTurnaroundDays: 14,
  },
  traps: [
    {
      id: "TRAP-5A",
      stage: "eligibility",
      title: "Checking only the practice's chart for a prior crown",
      commonMistake: "The student sees no crown in the practice chart and assumes the replacement benefit is available.",
      whyItIsWrong:
        "The replacement clock follows the tooth, not the dentist. The payer paid for a crown on this tooth three years ago, and only the payer knows about it.",
      correctAction: "Ask the payer for the crown history on the specific tooth during the eligibility call, then quote accordingly.",
      producesDenialId: "DEN-FREQ-CROWN",
      pointsAtStake: 20,
    },
    {
      id: "TRAP-5B",
      stage: "coding",
      title: "Billing a core buildup and a post and core together",
      commonMistake: "The student bills both the buildup and the post and core on the same tooth, treating them as separate steps.",
      whyItIsWrong:
        "On a root-canal-treated tooth the post and core is the definitive rebuild. Payers pay one or the other on the same tooth, not both.",
      correctAction: "Bill the post and core alone on a root-canal-treated tooth; reserve the core buildup for a vital tooth.",
      producesDenialId: "DEN-BUNDLE-BUILDUP",
      pointsAtStake: 15,
    },
    {
      id: "TRAP-5C",
      stage: "ar-follow-up",
      title: "Treating the crown frequency denial as final",
      commonMistake: "The student sees 'replacement within the interval' and moves the whole crown balance to the patient without appealing.",
      whyItIsWrong:
        "Frequency denials are appealable when the restoration failed because of new decay or fracture rather than normal wear. The pre-operative radiograph here shows exactly that.",
      correctAction: "Appeal with the radiograph showing the new decay and a narrative describing the failure, within the payer's appeal window.",
      producesDenialId: "DEN-FREQ-CROWN",
      pointsAtStake: 20,
    },
    {
      id: "TRAP-5D",
      stage: "claim",
      title: "Submitting the root canal without the post-operative film",
      commonMistake: "The student submits the root canal line with only the pre-operative image, assuming that is enough.",
      whyItIsWrong:
        "Root canal claims are judged on the final fill. Without the post-operative film the payer has no evidence the treatment was completed and the line stalls or denies for missing documentation.",
      correctAction: "Attach both the pre-operative and the post-operative films on the first submission.",
      producesDenialId: "DEN-DOC-MISSING",
      pointsAtStake: 15,
    },
  ],
  expectedOutcome: [
    {
      line: 1,
      code: "D3330",
      chargedUsd: 1285,
      allowedUsd: 1150,
      contractualWriteOffUsd: 135,
      planPaysUsd: 550,
      patientOwesUsd: 600,
      explanation:
        "Molar root canal, covered as a major service. The 50 dollar deductible is taken first: 1150 less 50 leaves 1100, paid at 50 percent, which is 550. The patient owes the deductible plus the other half.",
    },
    {
      line: 2,
      code: "D2954",
      chargedUsd: 315,
      allowedUsd: 280,
      contractualWriteOffUsd: 35,
      planPaysUsd: 140,
      patientOwesUsd: 140,
      explanation:
        "Prefabricated post and core on a root-canal-treated tooth, supported by the films and narrative. Deductible already satisfied, so 280 is paid at 50 percent, which is 140.",
    },
    {
      line: 3,
      code: "D2740",
      chargedUsd: 1320,
      allowedUsd: 1100,
      contractualWriteOffUsd: 220,
      planPaysUsd: 0,
      patientOwesUsd: 1100,
      denialId: "DEN-FREQ-CROWN",
      explanation:
        "Denied on frequency: the plan paid for a crown on this tooth less than five years ago, and the replacement clock follows the tooth, not the dentist. Appealable because the prior crown failed from new decay — the pre-operative radiograph is the evidence.",
    },
  ],
  expectedTotals: {
    chargedUsd: 2920,
    allowedUsd: 2530,
    planPaysUsd: 690,
    patientOwesUsd: 1840,
    writeOffUsd: 390,
  },
  arFollowUp: {
    scenario:
      "The remittance shows the root canal and post paid, and the crown denied on frequency. A student who stops there leaves a four-figure balance on the patient that a documented appeal would likely reverse.",
    outcome: "appeal-with-documentation",
    callObjectives: [
      "Confirm on the remittance which lines paid and which denied, and note the denial reason for the crown.",
      "Recognise that this frequency denial is appealable because the failure was new decay.",
      "Assemble the appeal package: the pre-operative decay radiograph and a narrative in the dentist's own words.",
      "Confirm the appeal address and deadline with the payer and get a reference number.",
    ],
  },
  gradingRubric: {
    maxPoints: 130,
    passingPoints: 91,
    criteria: [
      { stage: "eligibility", criterion: "Requested the payer's crown history for tooth 30", points: 20 },
      { stage: "eligibility", criterion: "Confirmed the major waiting period was satisfied", points: 10 },
      { stage: "predetermination", criterion: "Submitted a predetermination with the decay radiograph and narrative", points: 15 },
      { stage: "coding", criterion: "Billed the post and core without a duplicate buildup", points: 15 },
      { stage: "claim", criterion: "Attached pre- and post-operative films for the root canal", points: 15 },
      { stage: "claim", criterion: "Used the cementation date for the crown", points: 15 },
      { stage: "ar-follow-up", criterion: "Recognised the denial as appealable and prepared the appeal", points: 20 },
      { stage: "ar-follow-up", criterion: "Did not bill the frequency denial to the patient before appealing", points: 20 },
    ],
  },
  instructorKey: [
    "The replacement clock is per tooth and follows the patient across dentists — this is the single most expensive thing a practice forgets to check.",
    "Contrast this appealable frequency denial with the fluoride age cap in Case 4, which cannot be appealed. The difference is whether new clinical evidence can change the answer.",
    "The post-and-core versus buildup distinction is a frequent audit trigger; have students name which one belongs on a root-canal-treated tooth.",
  ],
};

/* =================================================================== */
/* CASE 6 — ADVANCED: removable prosthodontics + annual maximum         */
/* =================================================================== */

const CASE_ANNUAL_MAX_DENTURES: DentalCaseScenario = {
  id: "DCASE-006",
  title: "Two partials and one annual maximum: the second one pays nothing",
  difficulty: "advanced",
  estimatedMinutes: 45,
  planId: "PLAN-NORTHWIND-TRUST",
  patient: {
    id: "DPT-1006",
    firstName: "Fatima",
    lastName: "Noor",
    dateOfBirth: "1965-06-15",
    ageAtServiceDate: 62,
    gender: "Female",
    phone: "(555) 0167-980",
    address: "77 Bayview Avenue, Harbor City, ST 00000",
    subscriberName: "Noor, Fatima",
    relationshipToSubscriber: "self",
    memberId: "NWT440118772",
    coverageEffectiveDate: "2024-05-01",
    monthsCoveredAtServiceDate: 36,
  },
  briefing:
    "A patient needs upper and lower partial dentures after a crown and periodontal work earlier in the year consumed most of her annual maximum. The first partial will pay up to what remains; the second will pass every other rule and still pay nothing. The lesson is sequencing: which partial you submit first changes who owes what, and whether to defer one into the next benefit period.",
  registrationNotes: [
    "The patient lost several back teeth over the past two years — after her coverage began, so the missing tooth clause does not apply.",
    "She had a crown and deep cleaning earlier this benefit year that already drew on the annual maximum.",
    "The treatment plan will need a predetermination; both partials sit above the plan's review threshold.",
  ],
  eligibilitySnapshot: {
    status: "Active. Thirty-six months of continuous coverage.",
    remainingAnnualMaximumUsd: 300,
    deductibleMetUsd: 0,
    paidHistory: [
      { code: "D2740", tooth: "14", date: "2027-02-01", note: "Crown paid earlier this benefit year." },
      { code: "D4341", quadrant: "01", date: "2027-02-01", note: "Scaling and root planing paid earlier this benefit year." },
    ],
    representativeNotes: [
      "Major services pay at 60 percent after a 25 dollar deductible.",
      "Prosthetic replacement is limited to once every sixty months per arch.",
      "The plan uses an anniversary benefit period, not a calendar year.",
      "A predetermination is requested for any plan above 300 dollars.",
    ],
  },
  clinicalNote: {
    chiefComplaint: "Difficulty chewing evenly after losing several back teeth, and discomfort from the gaps.",
    findings: [
      "Upper arch: first and second molars on both sides missing, first premolars and canines remaining.",
      "Lower arch: first and second molars missing on both sides.",
      "Remaining teeth are periodontally stable after earlier therapy.",
      "Ridge contours adequate for removable partials.",
    ],
    radiographicFindings: [
      "Healed extraction sites in both arches; adequate bone height.",
      "No pathology at the remaining teeth.",
    ],
    diagnosisNarrative:
      "Multiple missing posterior teeth in both arches with functional difficulty. Upper and lower cast metal partial dentures indicated to restore chewing function.",
    treatmentPerformed: [
      "20 May: impressions taken for both arches, bite registration recorded.",
      "Both partial dentures delivered and adjusted at a later visit.",
    ],
    providerNarrativeForPayer:
      "Cast metal partial dentures for the upper and lower arches to replace missing posterior teeth. All replacement teeth are listed on the claim; the teeth were extracted after the member's coverage effective date.",
  },
  procedures: [
    {
      line: 1,
      code: "D5213",
      quadrant: "10",
      dateOfService: "2027-05-20",
      feeUsd: 1925,
      expectedNote: "Upper cast metal partial. List every tooth replaced; the missing tooth clause does not apply because the teeth were lost after coverage began.",
    },
    {
      line: 2,
      code: "D5214",
      quadrant: "20",
      dateOfService: "2027-05-20",
      feeUsd: 1925,
      expectedNote: "Lower cast metal partial. The annual maximum is nearly gone — sequence this line carefully and consider deferring it.",
    },
  ],
  predetermination: {
    required: true,
    reason:
      "Both partials sit above the plan's review threshold, and the remaining annual maximum must be confirmed in writing before the patient is quoted.",
    attachmentsExpected: [
      "Radiographs showing the healed extraction sites",
      "List of every tooth being replaced, with extraction dates",
      "Treatment plan with the proposed codes and fees",
    ],
    expectedTurnaroundDays: 21,
  },
  traps: [
    {
      id: "TRAP-6A",
      stage: "eligibility",
      title: "Quoting without checking the remaining annual maximum",
      commonMistake: "The student estimates both partials at the major services percentage and gives the patient a single number.",
      whyItIsWrong:
        "The annual maximum is applied last and caps the whole claim. With only 300 dollars left, the arithmetic the student used is simply wrong, and the patient is quoted a figure the plan can never pay.",
      correctAction: "Check the remaining maximum on the eligibility call, then sequence the plan across the current and next benefit period.",
      producesDenialId: "DEN-ANNUAL-MAX",
      pointsAtStake: 25,
    },
    {
      id: "TRAP-6B",
      stage: "ar-follow-up",
      title: "Appealing the annual maximum denial",
      commonMistake: "The student writes an appeal arguing the partials were medically necessary.",
      whyItIsWrong:
        "The plan is not disputing necessity. The annual maximum was reached, the plan paid what it owed, and there is nothing to appeal.",
      correctAction: "Bill the patient against the signed estimate, and offer to defer any unscheduled treatment into the next benefit period.",
      producesDenialId: "DEN-ANNUAL-MAX",
      pointsAtStake: 20,
    },
    {
      id: "TRAP-6C",
      stage: "eligibility",
      title: "Skipping the missing tooth clause on a partial",
      commonMistake: "The student assumes the missing tooth clause only matters for implants and never checks the extraction dates.",
      whyItIsWrong:
        "The clause applies to any replacement of a tooth lost before coverage began — bridge, partial or implant. Here the teeth were lost after coverage, but the student must still establish that rather than assume it.",
      correctAction: "Ask for the extraction dates, apply the clause to every replacement option, and document the answer.",
      producesDenialId: "DEN-MISSING-TOOTH",
      pointsAtStake: 20,
    },
    {
      id: "TRAP-6D",
      stage: "claim",
      title: "Billing the partial without listing every replaced tooth",
      commonMistake: "The student submits the partial line with the arch but no tooth list.",
      whyItIsWrong:
        "The missing tooth clause is applied tooth by tooth. Without the list the claim cannot be adjudicated, and it stalls for missing information.",
      correctAction: "List every tooth being replaced on the claim, with extraction dates where the payer asks for them.",
      producesDenialId: "DEN-DOC-MISSING",
      pointsAtStake: 15,
    },
  ],
  expectedOutcome: [
    {
      line: 1,
      code: "D5213",
      chargedUsd: 1925,
      allowedUsd: 1650,
      contractualWriteOffUsd: 275,
      planPaysUsd: 300,
      patientOwesUsd: 1350,
      denialId: "DEN-ANNUAL-MAX",
      explanation:
        "Covered major service, but only 300 of the annual maximum remained. The 25 dollar deductible is taken first, then 60 percent would be 975, but the plan caps payment at the 300 that was left. The patient owes the balance of the 1650 allowance.",
    },
    {
      line: 2,
      code: "D5214",
      chargedUsd: 1925,
      allowedUsd: 1650,
      contractualWriteOffUsd: 275,
      planPaysUsd: 0,
      patientOwesUsd: 1650,
      denialId: "DEN-ANNUAL-MAX",
      explanation:
        "The annual maximum is now fully exhausted, so this second partial pays nothing even though every other rule passed. There is nothing to appeal — the plan paid what it owed. Offer to defer into the next benefit period.",
    },
  ],
  expectedTotals: {
    chargedUsd: 3850,
    allowedUsd: 3300,
    planPaysUsd: 300,
    patientOwesUsd: 3000,
    writeOffUsd: 550,
  },
  arFollowUp: {
    scenario:
      "The patient is shocked that the second partial pays nothing despite being 'covered'. She believes the office made an error and wants it appealed.",
    outcome: "bill-patient",
    callObjectives: [
      "Show the patient, line by line, how the annual maximum capped the first partial and then paid nothing on the second.",
      "Explain that the annual maximum is applied last and is not appealable.",
      "Offer to defer the second partial into the next benefit period if it is clinically safe.",
      "Document the remaining maximum and set a task to re-verify eligibility when the new period opens.",
    ],
  },
  gradingRubric: {
    maxPoints: 120,
    passingPoints: 84,
    criteria: [
      { stage: "eligibility", criterion: "Checked the remaining annual maximum before quoting", points: 25 },
      { stage: "eligibility", criterion: "Established the extraction dates and applied the missing tooth clause", points: 20 },
      { stage: "predetermination", criterion: "Submitted a predetermination with the tooth list and extraction dates", points: 15 },
      { stage: "claim", criterion: "Listed every replaced tooth on the claim", points: 15 },
      { stage: "claim", criterion: "Sequenced the partials correctly and considered deferring one", points: 15 },
      { stage: "ar-follow-up", criterion: "Did not appeal the annual maximum; explained it and offered to defer", points: 30 },
    ],
  },
  instructorKey: [
    "The annual maximum is step eleven. Walk the class through the same two lines with the maximum exhausted versus with 300 remaining, and have them explain why the patient's share changes.",
    "Sequencing is the hidden skill here: which partial is submitted first changes which line the remaining maximum lands on.",
    "The missing tooth clause is tested on partials too, not just implants. Students who only check it on implant cases will miss it.",
  ],
};

/* =================================================================== */
/* CASE 7 — BEGINNER: DHMO copay schedule + oral surgery                */
/* =================================================================== */

const CASE_DHMO_IMPACTION: DentalCaseScenario = {
  id: "DCASE-007",
  title: "A copay plan with no annual maximum — and the patient still owes for the extraction",
  difficulty: "beginner",
  estimatedMinutes: 25,
  planId: "PLAN-MERIDIAN-DHMO",
  patient: {
    id: "DPT-1007",
    firstName: "Bilal",
    lastName: "Hassan",
    dateOfBirth: "2003-04-10",
    ageAtServiceDate: 24,
    gender: "Male",
    phone: "(555) 0188-115",
    address: "5 Lighthouse Way, Fairmont, ST 00000",
    subscriberName: "Hassan, Bilal",
    relationshipToSubscriber: "self",
    memberId: "MSC110734908",
    coverageEffectiveDate: "2025-01-01",
    monthsCoveredAtServiceDate: 29,
  },
  briefing:
    "A young adult on a copay plan needs a deeply impacted lower third molar removed. The plan has no annual maximum and no deductible, so the front desk assumes nothing is owed. The copay schedule says otherwise, and a specialty referral must be approved before the surgeon is even booked.",
  registrationNotes: [
    "Member is assigned to this office under the DHMO plan.",
    "A referral from the assigned general dentist to an in-network oral surgeon is required before the extraction.",
    "The patient assumed 'no annual maximum' means no out-of-pocket cost.",
  ],
  eligibilitySnapshot: {
    status: "Active. Assigned to this office on the date of service.",
    remainingAnnualMaximumUsd: null,
    deductibleMetUsd: 0,
    paidHistory: [],
    representativeNotes: [
      "This is a copay plan: the patient pays a fixed amount per service from the copay schedule, and the plan pays the rest of the contracted amount.",
      "There is no annual maximum and no deductible.",
      "Specialty care requires an approved referral from the assigned general dentist.",
    ],
  },
  clinicalNote: {
    chiefComplaint: "Intermittent pain and swelling at the back of the lower left jaw.",
    findings: [
      "Lower left third molar is deeply impacted against the second molar, not visible in the mouth.",
      "Mild swelling of the gum tissue over the site.",
      "Remaining teeth are healthy.",
    ],
    radiographicFindings: [
      "Panoramic image shows the lower left third molar fully encased in bone, angled toward the second molar.",
    ],
    diagnosisNarrative:
      "Completely bony impaction of the lower left third molar causing recurrent pain. Surgical removal indicated, performed by the referred oral surgeon.",
    treatmentPerformed: [
      "Comprehensive evaluation by the assigned general dentist.",
      "Referral to the in-network oral surgeon, approved in advance.",
      "Surgical removal of the completely bony impacted lower left third molar by the oral surgeon.",
    ],
    providerNarrativeForPayer:
      "Completely bony impaction of tooth 17 confirmed on panoramic imaging. Referral from the assigned general dentist was approved prior to surgery.",
  },
  procedures: [
    {
      line: 1,
      code: "D0150",
      dateOfService: "2027-06-08",
      feeUsd: 108,
      expectedNote: "Comprehensive evaluation for a new patient. Copay is 0 on this schedule.",
    },
    {
      line: 2,
      code: "D7240",
      tooth: "17",
      dateOfService: "2027-06-08",
      feeUsd: 575,
      expectedNote: "Completely bony impaction. The impaction level is read from the radiograph, and the fixed copay applies regardless of the fee.",
    },
  ],
  traps: [
    {
      id: "TRAP-7A",
      stage: "eligibility",
      title: "Assuming no annual maximum means no cost",
      commonMistake: "The student tells the patient the visit is free because the plan has no annual maximum.",
      whyItIsWrong:
        "A copay plan has no annual maximum but a fixed price list instead. The patient owes the copay for each covered service, whatever the fee.",
      correctAction: "Read the copay schedule for each planned code and quote the patient's total before treatment.",
      pointsAtStake: 20,
    },
    {
      id: "TRAP-7B",
      stage: "eligibility",
      title: "Skipping the assignment and referral check",
      commonMistake: "The student books the oral surgeon without confirming the member is assigned to this office and the referral is approved.",
      whyItIsWrong:
        "Under this plan, specialty care without an approved referral from the assigned general dentist is not covered at all, and the whole surgical fee becomes the patient's cost.",
      correctAction: "Confirm assignment and get the referral approved in writing before the surgical visit.",
      producesDenialId: "DEN-NOT-COVERED",
      pointsAtStake: 25,
    },
    {
      id: "TRAP-7C",
      stage: "coding",
      title: "Choosing the impaction level without the radiograph",
      commonMistake: "The student bills the completely bony impaction code because the surgery was difficult, without checking what the image actually shows.",
      whyItIsWrong:
        "The impaction level is judged from the radiograph, not the surgeon's effort. If the image shows a lower level of impaction, the payer pays the lower code.",
      correctAction: "Match the impaction code to the bone coverage shown on the radiograph, and attach the image.",
      producesDenialId: "DEN-DOWNCODE-SURGICAL",
      pointsAtStake: 20,
    },
    {
      id: "TRAP-7D",
      stage: "ar-follow-up",
      title: "Appealing the copay as if it were a denial",
      commonMistake: "The patient questions the copay and the student starts an appeal.",
      whyItIsWrong:
        "A copay is a plan design, not a denial. There is nothing to appeal — the fixed amount is what the member agreed to under the plan.",
      correctAction: "Explain the copay schedule plainly, confirm the amount is correct for the code, and move the balance to the patient.",
      pointsAtStake: 15,
    },
  ],
  expectedOutcome: [
    {
      line: 1,
      code: "D0150",
      chargedUsd: 108,
      allowedUsd: 108,
      contractualWriteOffUsd: 0,
      planPaysUsd: 108,
      patientOwesUsd: 0,
      explanation: "Copay plan: the comprehensive exam carries a 0 dollar patient copay, so the plan pays the full contracted amount.",
    },
    {
      line: 2,
      code: "D7240",
      chargedUsd: 575,
      allowedUsd: 575,
      contractualWriteOffUsd: 0,
      planPaysUsd: 310,
      patientOwesUsd: 265,
      explanation:
        "Copay plan: removal of a completely bony impaction carries a 265 dollar fixed patient copay regardless of the fee. No annual maximum does not mean no cost — the copay schedule is the price list, and the patient owes it even though the service is covered.",
    },
  ],
  expectedTotals: {
    chargedUsd: 683,
    allowedUsd: 683,
    planPaysUsd: 418,
    patientOwesUsd: 265,
    writeOffUsd: 0,
  },
  arFollowUp: {
    scenario:
      "The patient calls after the surgery: 'I have dental insurance, why do I owe 265 dollars?' He was told the plan had no annual maximum and assumed everything was free.",
    outcome: "bill-patient",
    callObjectives: [
      "Explain in one sentence what a copay plan is: a fixed price per service instead of percentages and a maximum.",
      "Point to the specific copay line for the impaction code on the schedule.",
      "Confirm the referral and assignment were in order so the patient knows the service was covered.",
      "Record the copay schedule on the account so the next estimate is quoted from it.",
    ],
  },
  gradingRubric: {
    maxPoints: 90,
    passingPoints: 63,
    criteria: [
      { stage: "eligibility", criterion: "Confirmed the member's assignment to this office", points: 20 },
      { stage: "eligibility", criterion: "Obtained the specialty referral approval before surgery", points: 25 },
      { stage: "eligibility", criterion: "Quoted the copay schedule rather than assuming no cost", points: 20 },
      { stage: "coding", criterion: "Matched the impaction code to the radiograph", points: 15 },
      { stage: "ar-follow-up", criterion: "Explained the copay without treating it as an appealable denial", points: 10 },
    ],
  },
  instructorKey: [
    "This is the contrast case to the PPO work: no annual maximum, no deductible, no percentage — but a fixed price list that still produces a patient bill.",
    "The assignment and referral rules are what break DHMO claims, not the clinical documentation.",
    "Use it to teach students to read the plan type before doing any arithmetic, because the arithmetic is entirely different.",
  ],
};

export const DENTAL_CASE_SCENARIOS: DentalCaseScenario[] = [
  CASE_HYGIENE_RECALL,
  CASE_CROWN_DOWNGRADE,
  CASE_PERIO_IMPLANT,
  CASE_POSTERIOR_COMPOSITE_DOWNGRADE,
  CASE_ENDO_CROWN_FREQUENCY,
  CASE_ANNUAL_MAX_DENTURES,
  CASE_DHMO_IMPACTION,
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
