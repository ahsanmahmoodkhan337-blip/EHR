/**
 * Medical Case Scenarios — Graded Teaching Cases for the Medical RCM Track
 *
 * Seven graded cases that run the same clinical-to-financial spine as the
 * dental track: registration, eligibility, charting, coding, (conditional)
 * prior authorisation, claim submission and AR follow-up.
 *
 * Each case carries deliberate traps. Two of the traps re-use mechanics that
 * already ship in the medical UI so the cases exercise them rather than
 * duplicate them:
 *   - the Modifier 25 trap (MCASE-004) — an E/M and a procedure on the same
 *     day, where the E/M must carry modifier 25 or the claim is denied; and
 *   - the conditional prior-authorisation trigger (MCASE-005) — a CPT code on
 *     the plan's PA list that routes the encounter to the PA stage.
 *
 * CONTENT NOTES
 * - All patients, employers, providers and payers are fictional. The plans
 *   referenced are the fictional teaching plans in payerScenarios.ts.
 * - Fees and allowances are illustrative teaching figures, not a fee schedule
 *   and not a real payer's allowable.
 * - ICD-10 and CPT descriptions are original teaching text; no official code
 *   nomenclature or descriptor is reproduced anywhere in this file. Code
 *   identifiers (for example "99213", "E11.22") are used as references only.
 * - Denials are referenced by X12 Claim Adjustment Reason Code strings whose
 *   surrounding text is original wording written for this simulator.
 */

export type MedicalCaseDifficulty = "beginner" | "intermediate" | "advanced";

export type MedicalRcmStage =
  | "registration"
  | "eligibility"
  | "clinical"
  | "coding"
  | "prior-auth"
  | "claim"
  | "ar-follow-up";

export interface MedicalCasePatient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  ageAtServiceDate: number;
  gender: string;
  subscriberName: string;
  relationshipToSubscriber: "self" | "spouse" | "child";
  memberId: string;
}

export interface MedicalDiagnosis {
  code: string;
  /** Diagnosis priority on the claim — 1 is primary and linked to most services. */
  priority: number;
  /** Diagnosis pointer letter used in box 24 of the CMS-1500. */
  pointer: string;
  expectedNote: string;
}

export interface MedicalProcedure {
  line: number;
  code: string;
  /** CPT modifier the line must carry, where one applies (for example "25"). */
  modifier?: string;
  units: number;
  dateOfService: string;
  /** Practice's charged fee. Illustrative. */
  chargedUsd: number;
  linkedDiagnosisPointer: string;
  expectedNote: string;
}

export interface MedicalCaseTrap {
  id: string;
  stage: MedicalRcmStage;
  title: string;
  commonMistake: string;
  whyItIsWrong: string;
  correctAction: string;
  /** CARC the mistake produces on the remittance. */
  producesDenialCarc?: string;
  /** True when this trap is the existing Modifier 25 mechanic. */
  exercisesModifier25?: boolean;
  /** True when this trap is the existing conditional prior-auth mechanic. */
  exercisesConditionalPa?: boolean;
  pointsAtStake: number;
}

export interface MedicalExpectedLineOutcome {
  line: number;
  code: string;
  modifier?: string;
  chargedUsd: number;
  /** Contracted allowance. Illustrative teaching figure. */
  allowedUsd: number;
  planPaysUsd: number;
  patientOwesUsd: number;
  /** Charge minus allowance; not billable to the patient in network. */
  writeOffUsd: number;
  /** CARC the line carries, or absent when the line pays. */
  carcCode?: string;
  explanation: string;
}

export interface MedicalCaseScenario {
  id: string;
  title: string;
  specialty: string;
  difficulty: MedicalCaseDifficulty;
  estimatedMinutes: number;
  planId: string;
  patient: MedicalCasePatient;
  /** Short setup shown to the student before they start. */
  briefing: string;
  registrationNotes: string[];
  eligibilitySnapshot: {
    status: string;
    remainingDeductibleUsd: number;
    priorAuthRequired: boolean;
    priorAuthStatus?: string;
    benefitUsage?: { category: string; used: number; limit: number }[];
    representativeNotes: string[];
  };
  clinicalNote: {
    chiefComplaint: string;
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  diagnoses: MedicalDiagnosis[];
  procedures: MedicalProcedure[];
  traps: MedicalCaseTrap[];
  expectedOutcome: MedicalExpectedLineOutcome[];
  expectedTotals: {
    chargedUsd: number;
    allowedUsd: number;
    planPaysUsd: number;
    patientOwesUsd: number;
    writeOffUsd: number;
  };
  arFollowUp?: {
    scenario: string;
    outcome: string;
    callObjectives: string[];
  };
  gradingRubric: {
    maxPoints: number;
    passingPoints: number;
    criteria: { stage: MedicalRcmStage; criterion: string; points: number }[];
  };
  instructorKey: string[];
}

/* =================================================================== */
/* CASE 1 — BEGINNER: clean-paid established E/M                        */
/* =================================================================== */

const CASE_HTN_FOLLOWUP: MedicalCaseScenario = {
  id: "MCASE-001",
  title: "A routine hypertension follow-up that should pay on the first pass",
  specialty: "Primary Care / Internal Medicine",
  difficulty: "beginner",
  estimatedMinutes: 15,
  planId: "PLAN-CASCADIA-HEALTH-PPO",
  patient: {
    id: "MPT-2001",
    firstName: "Amir",
    lastName: "Khan",
    dateOfBirth: "1974-03-12",
    ageAtServiceDate: 52,
    gender: "Male",
    subscriberName: "Khan, Amir",
    relationshipToSubscriber: "self",
    memberId: "CCH-4412-8871",
  },
  briefing:
    "An established patient returns for his quarterly blood-pressure check. Everything is stable and nothing is being added or changed today. Your job is to code the visit at the right level and link the right diagnosis, so the claim clears without anyone touching it twice.",
  registrationNotes: [
    "Insurance is unchanged; the card on file matches the eligibility record.",
    "The patient is the subscriber, so the claim carries his own details.",
    "No copay collected at the desk — confirm whether the plan has one during eligibility.",
  ],
  eligibilitySnapshot: {
    status: "Active. Established patient, no prior authorisation required for an office visit.",
    remainingDeductibleUsd: 0,
    priorAuthRequired: false,
    representativeNotes: [
      "Office visits pay at 80 percent of the contracted allowance with no deductible in this teaching plan.",
      "No prior authorisation is required for evaluation and management visits.",
    ],
  },
  clinicalNote: {
    chiefComplaint: "Three-month follow-up for high blood pressure. No new complaints.",
    subjective: "Feels well. Taking his blood-pressure medicine once a day without side effects. Home readings have been in the low 130s over 80s.",
    objective: "Blood pressure 132/84 sitting. Heart rate 74 and regular. Remainder of the exam unremarkable. Weight stable.",
    assessment: "Essential hypertension, controlled on current medication.",
    plan: "Continue the current medicine. Home monitoring diary reviewed. Return in three months; basic labs if any change.",
  },
  diagnoses: [
    { code: "I10", priority: 1, pointer: "A", expectedNote: "Essential hypertension — the definitive diagnosis that supports the visit." },
  ],
  procedures: [
    {
      line: 1,
      code: "99213",
      units: 1,
      dateOfService: "2027-04-02",
      chargedUsd: 155,
      linkedDiagnosisPointer: "A",
      expectedNote: "Established-patient visit at moderate complexity. The level matches a stable chronic condition check.",
    },
  ],
  traps: [
    {
      id: "MTRAP-1A",
      stage: "coding",
      title: "Upcoding a stable visit",
      commonMistake: "The student reaches for 99214 because the patient has a chronic condition.",
      whyItIsWrong:
        "Level 99214 needs more than a routine stable recheck — more complexity, data review, or risk. Choosing it because the diagnosis is chronic invites an audit and teaches a harmful habit.",
      correctAction: "Select 99213, which matches a stable chronic-condition follow-up with no medication change.",
      pointsAtStake: 15,
    },
    {
      id: "MTRAP-1B",
      stage: "coding",
      title: "Coding the symptom instead of the diagnosis",
      commonMistake: "The student codes an elevated blood-pressure reading as the reason for the visit rather than the hypertension itself.",
      whyItIsWrong:
        "A reading is a finding, not the diagnosis. The payer needs the diagnosis that establishes medical necessity for the management visit.",
      correctAction: "Code I10 (essential hypertension), the definitive diagnosis the visit is managing.",
      producesDenialCarc: "CO-50",
      pointsAtStake: 10,
    },
  ],
  expectedOutcome: [
    {
      line: 1,
      code: "99213",
      chargedUsd: 155,
      allowedUsd: 140,
      planPaysUsd: 112,
      patientOwesUsd: 28,
      writeOffUsd: 15,
      explanation:
        "Clean paid. Allowed at 140, paid at 80 percent (112), the patient owes the 20 percent coinsurance (28), and the charge-above-allowance (15) is a contractual write-off.",
    },
  ],
  expectedTotals: { chargedUsd: 155, allowedUsd: 140, planPaysUsd: 112, patientOwesUsd: 28, writeOffUsd: 15 },
  arFollowUp: {
    scenario: "The remittance returns paid in full. There is nothing to work; the lesson is that most claims should look like this.",
    outcome: "clean-paid",
    callObjectives: [
      "Confirm the paid amount and coinsurance match the benefit quoted in advance.",
      "Post the patient coinsurance and close the claim.",
      "Note the clean coding pattern on the account for future visits.",
    ],
  },
  gradingRubric: {
    maxPoints: 60,
    passingPoints: 42,
    criteria: [
      { stage: "coding", criterion: "Selected 99213, not 99214", points: 15 },
      { stage: "coding", criterion: "Linked I10 as the primary diagnosis", points: 10 },
      { stage: "claim", criterion: "Submitted a clean claim with the diagnosis pointer correct", points: 15 },
      { stage: "ar-follow-up", criterion: "Posted the coinsurance and closed the claim", points: 10 },
    ],
  },
  instructorKey: [
    "This is the baseline: a clean claim is the absence of the traps in the other six cases.",
    "Have students defend the 99213 level in one sentence — that is the whole E/M level-selection habit.",
  ],
};

/* =================================================================== */
/* CASE 2 — BEGINNER: clean-paid preventive visit + screening           */
/* =================================================================== */

const CASE_PREVENTIVE_SCREENING: MedicalCaseScenario = {
  id: "MCASE-002",
  title: "A preventive visit and a screening study, paid at 100 percent",
  specialty: "Preventive Medicine",
  difficulty: "beginner",
  estimatedMinutes: 18,
  planId: "PLAN-CASCADIA-HEALTH-PPO",
  patient: {
    id: "MPT-2002",
    firstName: "Priya",
    lastName: "Sharma",
    dateOfBirth: "1971-09-25",
    ageAtServiceDate: 55,
    gender: "Female",
    subscriberName: "Sharma, Priya",
    relationshipToSubscriber: "self",
    memberId: "CCH-3301-2290",
  },
  briefing:
    "A 55-year-old woman comes in for her annual physical and a routine screening mammogram. Both are preventive, and on this plan both pay in full. The trap is in how they are coded: a preventive code is not the same as a problem visit, and a screening study is not the same as a diagnostic one.",
  registrationNotes: [
    "Patient is the subscriber. No other coverage on file; confirm this annually.",
    "The mammogram order was written at the visit; the study is performed at the same facility later the same day.",
    "The patient mentions her knees ache sometimes but does not want to address it today.",
  ],
  eligibilitySnapshot: {
    status: "Active. Preventive services pay at 100 percent with no deductible.",
    remainingDeductibleUsd: 0,
    priorAuthRequired: false,
    representativeNotes: [
      "The annual preventive exam and the screening mammogram are both preventive and pay in full.",
      "No prior authorisation is required for a screening mammogram.",
    ],
  },
  clinicalNote: {
    chiefComplaint: "Annual physical. No acute concerns.",
    subjective: "Feels well overall. Occasional knee aches but declines to address them today. Up to date on recommended screening.",
    objective: "Well-appearing. Vitals normal. Exam unremarkable for age. Screening mammogram ordered.",
    assessment: "Routine preventive examination; otherwise healthy.",
    plan: "Annual labs drawn. Screening mammogram ordered. Return in one year.",
  },
  diagnoses: [
    { code: "Z00.00", priority: 1, pointer: "A", expectedNote: "General adult examination without abnormal findings — the preventive visit code." },
    { code: "Z12.31", priority: 2, pointer: "B", expectedNote: "Screening mammogram for breast cancer — a screening, not a diagnostic study." },
  ],
  procedures: [
    {
      line: 1,
      code: "99396",
      units: 1,
      dateOfService: "2027-04-05",
      chargedUsd: 218,
      linkedDiagnosisPointer: "A",
      expectedNote: "Periodic preventive visit, 40–64 years. Preventive, so no modifier and no coinsurance on this plan.",
    },
    {
      line: 2,
      code: "77067",
      units: 1,
      dateOfService: "2027-04-05",
      chargedUsd: 225,
      linkedDiagnosisPointer: "B",
      expectedNote: "Screening mammogram, bilateral. Linked to the screening diagnosis, not a symptom.",
    },
  ],
  traps: [
    {
      id: "MTRAP-2A",
      stage: "coding",
      title: "Coding the preventive visit as a problem visit",
      commonMistake: "The student bills 99213 for the annual physical because the patient is established.",
      whyItIsWrong:
        "A preventive visit has its own code family. Billing a problem-oriented E/M for a purely preventive encounter misstates the service and, on many plans, changes what the patient owes.",
      correctAction: "Use the preventive code (99396) for the preventive visit.",
      pointsAtStake: 15,
    },
    {
      id: "MTRAP-2B",
      stage: "coding",
      title: "Coding a screening study as diagnostic",
      commonMistake: "The student links the mammogram to a symptom or vague finding because the patient mentioned knee aches.",
      whyItIsWrong:
        "There is no breast symptom here. A screening study is coded with the screening Z code; coding it as diagnostic is misrepresentation and changes coverage.",
      correctAction: "Link the screening mammogram to Z12.31 and keep the knee complaint out of this claim.",
      producesDenialCarc: "CO-50",
      pointsAtStake: 15,
    },
    {
      id: "MTRAP-2C",
      stage: "claim",
      title: "Adding a same-day problem visit without a modifier",
      commonMistake: "The student adds a 99213 for the knee ache alongside the preventive visit with no modifier.",
      whyItIsWrong:
        "A separately identifiable problem visit on the same day as a preventive visit needs a modifier, and this patient declined to address the knee today — so there is no separate problem visit to bill at all.",
      correctAction: "Bill only the preventive service; there was no separately identifiable problem service performed.",
      pointsAtStake: 10,
    },
  ],
  expectedOutcome: [
    {
      line: 1,
      code: "99396",
      chargedUsd: 218,
      allowedUsd: 190,
      planPaysUsd: 190,
      patientOwesUsd: 0,
      writeOffUsd: 28,
      explanation: "Preventive visit paid at 100 percent of the allowance with no deductible and no coinsurance.",
    },
    {
      line: 2,
      code: "77067",
      chargedUsd: 225,
      allowedUsd: 200,
      planPaysUsd: 200,
      patientOwesUsd: 0,
      writeOffUsd: 25,
      explanation: "Screening mammogram paid in full as a preventive service.",
    },
  ],
  expectedTotals: { chargedUsd: 443, allowedUsd: 390, planPaysUsd: 390, patientOwesUsd: 0, writeOffUsd: 53 },
  gradingRubric: {
    maxPoints: 60,
    passingPoints: 42,
    criteria: [
      { stage: "coding", criterion: "Used the preventive visit code, not a problem E/M", points: 15 },
      { stage: "coding", criterion: "Linked the mammogram to the screening Z code", points: 15 },
      { stage: "claim", criterion: "Did not append a same-day problem visit with no modifier", points: 10 },
    ],
  },
  instructorKey: [
    "Preventive, problem and screening are three different coding intentions; this case is the contrast to Cases 1 and 3.",
    "The knee complaint that the patient declines to address is the trap — a service not performed cannot be billed.",
  ],
};

/* =================================================================== */
/* CASE 3 — INTERMEDIATE: medical-necessity denial (symptom vs dx)      */
/* =================================================================== */

const CASE_DIABETES_CKD: MedicalCaseScenario = {
  id: "MCASE-003",
  title: "A complex chronic visit that dies when coded as a symptom",
  specialty: "Endocrinology / Nephrology",
  difficulty: "intermediate",
  estimatedMinutes: 30,
  planId: "PLAN-CASCADIA-HEALTH-PPO",
  patient: {
    id: "MPT-2003",
    firstName: "Fatima",
    lastName: "Hussain",
    dateOfBirth: "1961-07-08",
    ageAtServiceDate: 65,
    gender: "Female",
    subscriberName: "Hussain, Fatima",
    relationshipToSubscriber: "self",
    memberId: "CCH-7788-1145",
  },
  briefing:
    "A diabetic patient with early kidney disease returns for a high-complexity management visit. Three chronic conditions are being managed and the labs are reviewed. The visit genuinely supports a level-four E/M — but only if the claim carries the chronic diagnoses. Code the symptom and the payer will deny the higher level for medical necessity.",
  registrationNotes: [
    "Patient is the subscriber. Insurance unchanged.",
    "Labs drawn two weeks ago are in the chart and were reviewed at this visit.",
    "The patient reports feeling tired, which is what brought the visit forward.",
  ],
  eligibilitySnapshot: {
    status: "Active. Office visits pay at 80 percent after no deductible in this teaching plan.",
    remainingDeductibleUsd: 0,
    priorAuthRequired: false,
    representativeNotes: [
      "Higher-level visits are reviewed for medical necessity; the diagnoses on the claim must support the level billed.",
    ],
  },
  clinicalNote: {
    chiefComplaint: "Increasing fatigue; follow-up of diabetes and kidney disease.",
    subjective: "Feels more tired over the past month. Taking diabetes and blood-pressure medicines as prescribed. No chest pain or shortness of breath.",
    objective: "Blood pressure 138/86. Labs reviewed: HbA1c 8.1, creatinine elevated with an estimated filtration rate of 44. Urine protein present. Exam otherwise unremarkable.",
    assessment: "Type 2 diabetes with diabetic chronic kidney disease, stage 3; fatigue under evaluation.",
    plan: "Adjust diabetes regimen. Repeat renal labs in six weeks. Counsel on diet and blood-pressure control.",
  },
  diagnoses: [
    { code: "E11.22", priority: 1, pointer: "A", expectedNote: "Type 2 diabetes with diabetic chronic kidney disease — the combined code for the primary condition." },
    { code: "N18.3", priority: 2, pointer: "B", expectedNote: "Chronic kidney disease, stage 3 — adds the severity that supports the higher-level visit." },
  ],
  procedures: [
    {
      line: 1,
      code: "99214",
      units: 1,
      dateOfService: "2027-04-09",
      chargedUsd: 225,
      linkedDiagnosisPointer: "A",
      expectedNote: "Established visit at high complexity, supported by the two chronic diagnoses and the lab review.",
    },
  ],
  traps: [
    {
      id: "MTRAP-3A",
      stage: "coding",
      title: "Coding the symptom instead of the chronic conditions",
      commonMistake: "The student codes only the fatigue because that is what the patient reported.",
      whyItIsWrong:
        "Fatigue is a symptom. The payer cannot see why a level-four visit was needed from a symptom code, so it denies the service as not medically necessary.",
      correctAction: "Code the definitive chronic conditions (E11.22 and N18.3) that the visit actually managed, and keep the symptom secondary if at all.",
      producesDenialCarc: "CO-50",
      pointsAtStake: 25,
    },
    {
      id: "MTRAP-3B",
      stage: "coding",
      title: "Under-coding the diabetes",
      commonMistake: "The student codes E11.9 (diabetes without complications) because the combination code is unfamiliar.",
      whyItIsWrong:
        "The patient has documented kidney disease. E11.9 understates the condition and undercuts the medical necessity of the higher-level visit.",
      correctAction: "Use E11.22 (diabetes with diabetic chronic kidney disease) plus N18.3 for the stage.",
      pointsAtStake: 15,
    },
  ],
  expectedOutcome: [
    {
      line: 1,
      code: "99214",
      chargedUsd: 225,
      allowedUsd: 200,
      planPaysUsd: 160,
      patientOwesUsd: 40,
      writeOffUsd: 25,
      explanation:
        "Clean paid once the chronic diagnoses are on the claim. Allowed at 200, paid at 80 percent (160), patient owes 40.",
    },
  ],
  expectedTotals: { chargedUsd: 225, allowedUsd: 200, planPaysUsd: 160, patientOwesUsd: 40, writeOffUsd: 25 },
  arFollowUp: {
    scenario: "A correctly coded version of this visit pays. A symptom-coded version comes back denied CO-50 and must be corrected, not appealed.",
    outcome: "correct-and-resubmit",
    callObjectives: [
      "Read the denial remark to confirm it is a medical-necessity denial from the diagnosis, not the procedure.",
      "Correct the claim with the chronic diagnoses that were in the note all along.",
      "Resubmit as a corrected claim inside the filing window.",
    ],
  },
  gradingRubric: {
    maxPoints: 70,
    passingPoints: 49,
    criteria: [
      { stage: "coding", criterion: "Coded E11.22 as the primary diagnosis", points: 20 },
      { stage: "coding", criterion: "Added N18.3 for the CKD stage", points: 10 },
      { stage: "coding", criterion: "Did not code only the fatigue symptom", points: 15 },
      { stage: "claim", criterion: "Linked the level-four visit to the chronic diagnoses", points: 10 },
      { stage: "ar-follow-up", criterion: "Corrected and resubmitted rather than appealed a coding error", points: 15 },
    ],
  },
  instructorKey: [
    "The note already had the right answer — the chronic diagnoses were documented. The trap is purely in what reaches the claim.",
    "Contrast a symptom (what the patient felt) with a diagnosis (what the provider is managing). Medical necessity turns on the diagnosis.",
  ],
};

/* =================================================================== */
/* CASE 4 — INTERMEDIATE: Modifier 25 (E/M + same-day procedure)        */
/* =================================================================== */

const CASE_MODIFIER_25_INJECTION: MedicalCaseScenario = {
  id: "MCASE-004",
  title: "An office visit and a knee injection on the same day — the Modifier 25 case",
  specialty: "Orthopedics / Family Medicine",
  difficulty: "intermediate",
  estimatedMinutes: 30,
  planId: "PLAN-CASCADIA-HEALTH-PPO",
  patient: {
    id: "MPT-2004",
    firstName: "Daniyal",
    lastName: "Raza",
    dateOfBirth: "1958-11-02",
    ageAtServiceDate: 68,
    gender: "Male",
    subscriberName: "Raza, Daniyal",
    relationshipToSubscriber: "self",
    memberId: "CCH-5502-6673",
  },
  briefing:
    "A patient with arthritis of both knees is scheduled for a knee injection, but during the visit the provider also evaluates a separate, newly-worsening problem and manages it. Both services are billable — but the office visit is only payable if it carries modifier 25. Miss it, and the claim comes back denied.",
  registrationNotes: [
    "The appointment was booked as a procedure (injection), not an office visit.",
    "The provider documented a separately identifiable evaluation and management service beyond the injection itself.",
  ],
  eligibilitySnapshot: {
    status: "Active. Office visits and joint injections pay at 80 percent of the allowance with no deductible in this teaching plan.",
    remainingDeductibleUsd: 0,
    priorAuthRequired: false,
    representativeNotes: [
      "A same-day E/M is separately payable only when a significant, separately identifiable service was performed — the claim must say so with modifier 25.",
    ],
  },
  clinicalNote: {
    chiefComplaint: "Knee pain for a scheduled injection; new foot swelling noticed this week.",
    subjective: "Both knees ache, worse on stairs. Over the past week the left ankle has swollen and is warm, unrelated to the knees.",
    objective: "Both knees tender with crepitus. Left ankle swollen and warm with limited range. The rest of the exam is unremarkable.",
    assessment: "Bilateral knee osteoarthritis; new left ankle swelling of unclear cause, evaluated separately from the injection visit.",
    plan: "Inject both knees with corticosteroid. Order ankle imaging and bloodwork for the new swelling. Recheck in one week.",
  },
  diagnoses: [
    { code: "M17.0", priority: 1, pointer: "A", expectedNote: "Bilateral knee osteoarthritis — supports the injection." },
    { code: "M25.572", priority: 2, pointer: "B", expectedNote: "Pain and swelling in the left ankle — the separately evaluated problem that supports the E/M." },
  ],
  procedures: [
    {
      line: 1,
      code: "99213",
      modifier: "25",
      units: 1,
      dateOfService: "2027-04-12",
      chargedUsd: 155,
      linkedDiagnosisPointer: "B",
      expectedNote: "The separately identifiable E/M, linked to the new ankle problem and carrying modifier 25.",
    },
    {
      line: 2,
      code: "20610",
      units: 1,
      dateOfService: "2027-04-12",
      chargedUsd: 120,
      linkedDiagnosisPointer: "A",
      expectedNote: "Therapeutic injection of a large joint. No modifier of its own — modifier 25 belongs on the E/M, not the procedure.",
    },
  ],
  traps: [
    {
      id: "MTRAP-4A",
      stage: "coding",
      title: "Billing both services without modifier 25",
      commonMistake: "The student submits the office visit and the injection together with no modifier.",
      whyItIsWrong:
        "On a same-day procedure, the payer treats the evaluation as part of the procedure unless modifier 25 says otherwise. The E/M line is denied.",
      correctAction: "Append modifier 25 to the E/M line, and only to the E/M line, with a separate diagnosis pointing to the separately identified problem.",
      producesDenialCarc: "CO-16",
      exercisesModifier25: true,
      pointsAtStake: 25,
    },
    {
      id: "MTRAP-4B",
      stage: "coding",
      title: "Putting the modifier on the procedure instead",
      commonMistake: "The student puts modifier 25 on the injection, reasoning that any modifier on the claim fixes it.",
      whyItIsWrong:
        "Modifier 25 describes a separately identifiable E/M service. It does not belong on a procedure code and does nothing there.",
      correctAction: "Keep modifier 25 on the E/M line only.",
      pointsAtStake: 15,
    },
  ],
  expectedOutcome: [
    {
      line: 1,
      code: "99213",
      modifier: "25",
      chargedUsd: 155,
      allowedUsd: 140,
      planPaysUsd: 112,
      patientOwesUsd: 28,
      writeOffUsd: 15,
      explanation: "Paid separately because modifier 25 documents a significant, separately identifiable service beyond the injection.",
    },
    {
      line: 2,
      code: "20610",
      chargedUsd: 120,
      allowedUsd: 100,
      planPaysUsd: 80,
      patientOwesUsd: 20,
      writeOffUsd: 20,
      explanation: "Joint injection paid at 80 percent of the allowance.",
    },
  ],
  expectedTotals: { chargedUsd: 275, allowedUsd: 240, planPaysUsd: 192, patientOwesUsd: 48, writeOffUsd: 35 },
  arFollowUp: {
    scenario: "A claim sent without modifier 25 comes back with the E/M denied. The fix is a corrected claim with the modifier, not an appeal.",
    outcome: "correct-and-resubmit",
    callObjectives: [
      "Confirm the denial is on the E/M line and names the missing modifier.",
      "Add modifier 25 to the E/M and link it to the separate ankle diagnosis.",
      "Resubmit as a corrected claim inside the filing window.",
    ],
  },
  gradingRubric: {
    maxPoints: 70,
    passingPoints: 49,
    criteria: [
      { stage: "coding", criterion: "Applied modifier 25 to the E/M line", points: 25 },
      { stage: "coding", criterion: "Left the injection without modifier 25", points: 15 },
      { stage: "coding", criterion: "Linked the E/M to the separately evaluated diagnosis", points: 10 },
      { stage: "claim", criterion: "Submitted both lines with correct diagnosis pointers", points: 10 },
    ],
  },
  instructorKey: [
    "The single most-tested modifier in outpatient coding. Drill the rule: modifier 25 goes on the E/M, never on the procedure.",
    "Have students find the line in the note that proves a separately identifiable service happened — without it, modifier 25 is not justified either.",
  ],
};

/* =================================================================== */
/* CASE 5 — ADVANCED: conditional prior authorisation (advanced imaging) */
/* =================================================================== */

const CASE_MRI_PRIOR_AUTH: MedicalCaseScenario = {
  id: "MCASE-005",
  title: "A lumbar MRI that needs prior authorisation before it is billed",
  specialty: "Neurology / Orthopedic Spine",
  difficulty: "advanced",
  estimatedMinutes: 35,
  planId: "PLAN-MERIDIAN-ADVANTAGE",
  patient: {
    id: "MPT-2005",
    firstName: "Sana",
    lastName: "Baig",
    dateOfBirth: "1979-06-30",
    ageAtServiceDate: 47,
    gender: "Female",
    subscriberName: "Baig, Sana",
    relationshipToSubscriber: "self",
    memberId: "MAD-9910-3327",
  },
  briefing:
    "A patient with weeks of low back pain and new leg symptoms needs an MRI of the lumbar spine. On this plan, that study requires a prior authorisation. The coder's queue flags the procedure code and routes the encounter to the prior-authorisation stage. Skip the authorisation and the claim denies even though the study is appropriate.",
  registrationNotes: [
    "The imaging order was written after a failed course of conservative care.",
    "The patient's plan requires prior authorisation for advanced imaging — this is a plan rule, not a clinical decision.",
  ],
  eligibilitySnapshot: {
    status: "Active. Advanced imaging requires prior authorisation before the study.",
    remainingDeductibleUsd: 0,
    priorAuthRequired: true,
    priorAuthStatus: "not-yet-obtained",
    representativeNotes: [
      "MRI of the lumbar spine requires a prior authorisation on file before the claim will process.",
      "The authorisation must match the CPT code and the diagnosis on the claim.",
    ],
  },
  clinicalNote: {
    chiefComplaint: "Low back pain radiating into the right leg for six weeks.",
    subjective: "Six weeks of low back pain with pain shooting down the right leg to the calf. Failed a course of therapy and anti-inflammatory medicine. No bowel or bladder changes.",
    objective: "Positive straight-leg raise on the right. Reduced right ankle reflex. Strength otherwise intact.",
    assessment: "Lumbar disc disorder with right-sided radiculopathy; MRI indicated to confirm level and plan treatment.",
    plan: "MRI of the lumbar spine without contrast. Prior authorisation to be obtained before the study.",
  },
  diagnoses: [
    { code: "M51.16", priority: 1, pointer: "A", expectedNote: "Lumbar disc disorder with radiculopathy — the indication that justifies the MRI." },
  ],
  procedures: [
    {
      line: 1,
      code: "72141",
      units: 1,
      dateOfService: "2027-04-16",
      chargedUsd: 460,
      linkedDiagnosisPointer: "A",
      expectedNote: "MRI of the lumbar spine without contrast — on this plan's prior-authorisation list.",
    },
  ],
  traps: [
    {
      id: "MTRAP-5A",
      stage: "prior-auth",
      title: "Billing without the prior authorisation",
      commonMistake: "The student routes the MRI straight to billing and submits without an authorisation.",
      whyItIsWrong:
        "The plan requires prior authorisation for this study. Without one, the claim denies regardless of how well documented the order is.",
      correctAction: "Obtain the prior authorisation first, match its CPT and diagnosis to the claim, and reference the authorisation number.",
      producesDenialCarc: "CO-119",
      exercisesConditionalPa: true,
      pointsAtStake: 25,
    },
    {
      id: "MTRAP-5B",
      stage: "prior-auth",
      title: "Authorising the wrong study",
      commonMistake: "The student submits an authorisation for a different code (a CT, or the wrong body part) and assumes it covers the MRI.",
      whyItIsWrong:
        "An authorisation is specific to the service. A mismatched authorisation number does not satisfy the requirement.",
      correctAction: "Match the authorisation to the exact CPT code and diagnosis being billed.",
      producesDenialCarc: "CO-119",
      pointsAtStake: 15,
    },
  ],
  expectedOutcome: [
    {
      line: 1,
      code: "72141",
      chargedUsd: 460,
      allowedUsd: 400,
      planPaysUsd: 320,
      patientOwesUsd: 80,
      writeOffUsd: 60,
      explanation:
        "Paid after a matching prior authorisation is on file. Allowed at 400, paid at 80 percent (320), patient owes 80.",
    },
  ],
  expectedTotals: { chargedUsd: 460, allowedUsd: 400, planPaysUsd: 320, patientOwesUsd: 80, writeOffUsd: 60 },
  arFollowUp: {
    scenario: "A claim submitted without the authorisation returns denied CO-119. The fix is retrospective review or an appeal with the clinical urgency, not a corrected claim alone.",
    outcome: "appeal-with-documentation",
    callObjectives: [
      "Confirm the authorisation requirement and whether the payer accepts retrospective review.",
      "Submit the clinical package showing the failed conservative care and the radiculopathy.",
      "Record the authorisation number once granted, and reference it on the corrected claim.",
    ],
  },
  gradingRubric: {
    maxPoints: 70,
    passingPoints: 49,
    criteria: [
      { stage: "prior-auth", criterion: "Recognised the MRI as a prior-authorisation service", points: 20 },
      { stage: "prior-auth", criterion: "Obtained the authorisation before billing", points: 20 },
      { stage: "claim", criterion: "Referenced the authorisation number and matched the CPT and diagnosis", points: 15 },
      { stage: "ar-follow-up", criterion: "Pursued retrospective review rather than resubmitting unchanged", points: 15 },
    ],
  },
  instructorKey: [
    "The prior-authorisation requirement lives on the procedure, not the patient. This case is the trigger for the conditional-PA interstitial in the coder queue.",
    "The authorisation must match the exact code and diagnosis; a near-miss authorisation is still a denial.",
  ],
};

/* =================================================================== */
/* CASE 6 — ADVANCED: CCI / bundling edit (two procedures, one spot)    */
/* =================================================================== */

const CASE_CCI_BUNDLING: MedicalCaseScenario = {
  id: "MCASE-006",
  title: "A sampled and treated skin spot billed twice — the bundling case",
  specialty: "Dermatology",
  difficulty: "advanced",
  estimatedMinutes: 30,
  planId: "PLAN-CASCADIA-HEALTH-PPO",
  patient: {
    id: "MPT-2006",
    firstName: "Kamran",
    lastName: "Ahmed",
    dateOfBirth: "1955-05-17",
    ageAtServiceDate: 72,
    gender: "Male",
    subscriberName: "Ahmed, Kamran",
    relationshipToSubscriber: "self",
    memberId: "CCH-1123-9087",
  },
  briefing:
    "A patient has a suspicious sun spot on his forearm. The provider samples it and, in the same visit, treats it. The claim must describe what actually happened to that one spot — the payer's claim edits will not pay for two procedures on the same spot and date. Bill both and one line comes back denied as bundled.",
  registrationNotes: [
    "The lesion is on the left forearm and was both sampled and treated at this visit.",
    "The note records a single spot; there is no second, distinct lesion documented.",
  ],
  eligibilitySnapshot: {
    status: "Active. Office procedures pay at 80 percent of the allowance with no deductible in this teaching plan.",
    remainingDeductibleUsd: 0,
    priorAuthRequired: false,
    representativeNotes: [
      "The payer's claim edits consider a sample of a lesion part of the treatment when both happen on the same spot and date.",
    ],
  },
  clinicalNote: {
    chiefComplaint: "A rough spot on the forearm that will not heal.",
    subjective: "The spot has been there for months, slightly scaly and occasionally tender. No bleeding.",
    objective: "A single scaly, erythematous spot on the left forearm. It is sampled and then treated with cryotherapy in the same visit.",
    assessment: "Actinic keratosis of the forearm, sampled and treated.",
    plan: "Treat the spot; monitor for recurrence. Biopsy result will guide any further step.",
  },
  diagnoses: [
    { code: "L57.0", priority: 1, pointer: "A", expectedNote: "Actinic keratosis — the sun-damaged, pre-cancerous spot being treated." },
  ],
  procedures: [
    {
      line: 1,
      code: "17000",
      units: 1,
      dateOfService: "2027-04-18",
      chargedUsd: 145,
      linkedDiagnosisPointer: "A",
      expectedNote: "Destruction of the pre-cancerous spot. This is the definitive service for the single spot.",
    },
  ],
  traps: [
    {
      id: "MTRAP-6A",
      stage: "coding",
      title: "Billing the sample and the treatment together",
      commonMistake: "The student bills a skin sample (11102) and the destruction (17000) on the same spot and date.",
      whyItIsWrong:
        "The payer's edit treats the sample as part of the treatment when both happen to the same spot on the same day, and denies the sample as bundled.",
      correctAction: "Bill the definitive service (17000) for the single spot. If a separate, distinct spot was also sampled, report it with modifier 59 and a note naming the second site.",
      producesDenialCarc: "CO-236",
      pointsAtStake: 25,
    },
    {
      id: "MTRAP-6B",
      stage: "ar-follow-up",
      title: "Appealing a bundling edit as if it were an error",
      commonMistake: "The student writes an appeal arguing both services were performed and therefore both should pay.",
      whyItIsWrong:
        "The payer is not disputing that both happened. The edit is a coverage rule: on the same spot and date, one is included in the other.",
      correctAction: "Write off the bundled line as a contractual adjustment, and fix the coding habit so it does not recur.",
      pointsAtStake: 15,
    },
  ],
  expectedOutcome: [
    {
      line: 1,
      code: "17000",
      chargedUsd: 145,
      allowedUsd: 120,
      planPaysUsd: 96,
      patientOwesUsd: 24,
      writeOffUsd: 25,
      explanation: "The destruction pays at 80 percent of the allowance. The sample is not separately payable on the same spot and date.",
    },
  ],
  expectedTotals: { chargedUsd: 145, allowedUsd: 120, planPaysUsd: 96, patientOwesUsd: 24, writeOffUsd: 25 },
  arFollowUp: {
    scenario: "A claim with both lines returns one line denied as bundled. The correct response is a write-off, not an appeal.",
    outcome: "write-off-contractual",
    callObjectives: [
      "Confirm the edit is a bundling rule, not a documentation problem.",
      "Close the bundled line as a contractual write-off.",
      "Note the same-day pair on the account so it is not billed together again.",
    ],
  },
  gradingRubric: {
    maxPoints: 60,
    passingPoints: 42,
    criteria: [
      { stage: "coding", criterion: "Billed only the definitive service for the single spot", points: 25 },
      { stage: "claim", criterion: "Did not append a bundled second line", points: 15 },
      { stage: "ar-follow-up", criterion: "Wrote off the bundled line instead of appealing", points: 15 },
    ],
  },
  instructorKey: [
    "A bundling edit fires before a human reads the claim. The lesson is to read the note and ask how many distinct services actually happened.",
    "Modifier 59 is only justified when the note describes a second, separate site. Here it does not.",
  ],
};

/* =================================================================== */
/* CASE 7 — ADVANCED: benefit-exhausted (therapy visit limit)           */
/* =================================================================== */

const CASE_THERAPY_LIMIT: MedicalCaseScenario = {
  id: "MCASE-007",
  title: "The 21st therapy visit that pays nothing — benefit exhausted",
  specialty: "Physical Therapy / Rehabilitation",
  difficulty: "advanced",
  estimatedMinutes: 30,
  planId: "PLAN-NORTHWIND-MEDICAID",
  patient: {
    id: "MPT-2007",
    firstName: "Nadia",
    lastName: "Yousaf",
    dateOfBirth: "1990-01-19",
    ageAtServiceDate: 37,
    gender: "Female",
    subscriberName: "Yousaf, Nadia",
    relationshipToSubscriber: "self",
    memberId: "NWM-4477-0081",
  },
  briefing:
    "A patient with low back pain has been in physical therapy twice a week. This is her 21st visit of the calendar year, and the plan pays for 20. The visit is correctly coded and genuinely needed — the benefit for therapy is simply exhausted. The skill is catching that before the visit, not after the remittance arrives.",
  registrationNotes: [
    "The therapy authorisation (if any) was for the medical necessity of the plan of care, not for an unlimited number of visits.",
    "The front desk should confirm remaining therapy visits at every eligibility check.",
  ],
  eligibilitySnapshot: {
    status: "Active. Therapy visits are capped at 20 per calendar year.",
    remainingDeductibleUsd: 0,
    priorAuthRequired: false,
    benefitUsage: [{ category: "Physical / occupational therapy", used: 20, limit: 20 }],
    representativeNotes: [
      "The plan pays for 20 therapy visits per calendar year. This would be the 21st.",
      "Beyond the limit the visit is the patient's responsibility or requires a coverage decision for additional visits.",
    ],
  },
  clinicalNote: {
    chiefComplaint: "Ongoing low back pain; continuing the established therapy plan.",
    subjective: "Back pain improving slowly with therapy. Wants to continue the current exercise program.",
    objective: "Range of motion improved since the start of care. Strength and mobility progressing toward goals.",
    assessment: "Mechanical low back pain, improving. Continued therapy indicated to reach functional goals.",
    plan: "Continue therapeutic exercise; reassess in two weeks.",
  },
  diagnoses: [
    { code: "M54.5", priority: 1, pointer: "A", expectedNote: "Low back pain — the diagnosis supporting the therapy visit." },
  ],
  procedures: [
    {
      line: 1,
      code: "97110",
      units: 1,
      dateOfService: "2027-04-21",
      chargedUsd: 38,
      linkedDiagnosisPointer: "A",
      expectedNote: "Therapeutic exercise, one 15-minute unit. Correctly coded — the issue is the benefit limit, not the code.",
    },
  ],
  traps: [
    {
      id: "MTRAP-7A",
      stage: "eligibility",
      title: "Not checking remaining visits before the appointment",
      commonMistake: "The student books and performs the visit without confirming how many therapy visits the plan still pays for.",
      whyItIsWrong:
        "The plan capped therapy at 20 visits a year. The 21st is covered in name only — the money for that category is gone, and the patient should have been told before the visit.",
      correctAction: "Check the remaining benefit at the eligibility step, tell the patient the visit will be self-pay, and offer the choice before the service.",
      producesDenialCarc: "CO-97",
      pointsAtStake: 25,
    },
    {
      id: "MTRAP-7B",
      stage: "ar-follow-up",
      title: "Appealing a benefit-exhausted denial on necessity grounds",
      commonMistake: "The student writes an appeal arguing the therapy is medically necessary.",
      whyItIsWrong:
        "The plan is not disputing necessity. The benefit for the category is exhausted, and no clinical argument changes a visit limit.",
      correctAction: "Move the balance to the patient, and pursue a coverage decision for additional visits only if the plan offers one.",
      producesDenialCarc: "CO-97",
      pointsAtStake: 20,
    },
  ],
  expectedOutcome: [
    {
      line: 1,
      code: "97110",
      chargedUsd: 38,
      allowedUsd: 30,
      planPaysUsd: 0,
      patientOwesUsd: 30,
      writeOffUsd: 8,
      carcCode: "CO-97",
      explanation:
        "Covered service, but the 20-visit therapy allowance is exhausted. The plan pays nothing on this line; the patient owes the contracted amount, and the charge-above-allowance is written off.",
    },
  ],
  expectedTotals: { chargedUsd: 38, allowedUsd: 30, planPaysUsd: 0, patientOwesUsd: 30, writeOffUsd: 8 },
  arFollowUp: {
    scenario: "The patient is surprised the visit is not covered and wants it appealed. Nothing was coded wrong — the benefit limit was reached.",
    outcome: "bill-patient",
    callObjectives: [
      "Show the patient the 20-visit limit and where her usage reached it.",
      "Explain that a benefit-exhausted denial is not appealable on necessity grounds.",
      "Offer the choice: self-pay the remaining visits, or pause and pursue a coverage decision for additional visits.",
    ],
  },
  gradingRubric: {
    maxPoints: 60,
    passingPoints: 42,
    criteria: [
      { stage: "eligibility", criterion: "Checked remaining therapy visits before the appointment", points: 25 },
      { stage: "claim", criterion: "Coded the visit correctly (the issue was the limit, not the code)", points: 10 },
      { stage: "ar-follow-up", criterion: "Did not appeal a benefit-exhausted denial; explained it and moved the balance", points: 20 },
    ],
  },
  instructorKey: [
    "This is the medical mirror of the dental annual-maximum case: a covered, correctly coded service that pays nothing.",
    "The 21st visit is where the front desk and the therapy schedule have to talk to each other. Eligibility is a per-visit task, not an annual one.",
  ],
};

export const MEDICAL_CASE_SCENARIOS: MedicalCaseScenario[] = [
  CASE_HTN_FOLLOWUP,
  CASE_PREVENTIVE_SCREENING,
  CASE_DIABETES_CKD,
  CASE_MODIFIER_25_INJECTION,
  CASE_MRI_PRIOR_AUTH,
  CASE_CCI_BUNDLING,
  CASE_THERAPY_LIMIT,
];

export const MEDICAL_CASE_INDEX: Record<string, MedicalCaseScenario> = Object.fromEntries(
  MEDICAL_CASE_SCENARIOS.map((c) => [c.id, c]),
);

export function findCase(id: string): MedicalCaseScenario | undefined {
  return MEDICAL_CASE_INDEX[id];
}

export function casesByDifficulty(difficulty: MedicalCaseDifficulty): MedicalCaseScenario[] {
  return MEDICAL_CASE_SCENARIOS.filter((c) => c.difficulty === difficulty);
}

/** Traps for one stage across all cases — useful for a stage-level drill mode. */
export function trapsForStage(stage: MedicalRcmStage): MedicalCaseTrap[] {
  return MEDICAL_CASE_SCENARIOS.flatMap((c) => c.traps.filter((t) => t.stage === stage));
}
