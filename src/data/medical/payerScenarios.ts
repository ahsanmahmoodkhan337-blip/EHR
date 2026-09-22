/**
 * Medical Payer & Benefit Scenarios — Educational Content for the Medical RCM Track
 *
 * Fictional payer plans that give each teaching case a distinct adjudication
 * outcome: a clean paid claim, a medical-necessity denial, a prior-authorisation
 * trigger, a bundling / claim-edit rejection and a benefit-exhausted stop.
 *
 * CONTENT NOTES
 * - Every payer here is fictional. None of these names is a real insurer, and
 *   none of the policy values is a real payer's published policy. They are
 *   modelled on the *shape* of common US plan designs so the mechanics are
 *   learnable, and each `carc` is an X12 Claim Adjustment Reason Code string
 *   whose surrounding text is original wording for this simulator.
 * - Fees, deductibles and visit limits are illustrative teaching figures, not a
 *   fee schedule and not any real payer's allowable. They are flagged as such.
 * - Prior-authorisation and bundling rules are presented as the fictional
 *   payer's own policy, not as a statement of any national edit or real plan.
 */

export type MedicalPlanType = "Commercial PPO" | "Medicare Advantage HMO" | "Medicaid MCO";

/** A same-day pair the payer's claim edits treat as one service. */
export interface MedicalCciEdit {
  /** The CPT the payer considers a component and will not pay separately. */
  componentCode: string;
  /** The CPT the component is considered part of. */
  comprehensiveCode: string;
  /** CARC shown on the remittance when the pair is billed together. */
  carc: string;
  /** Plain-language explanation of what the edit is doing. */
  explanation: string;
  /** The single right move when the edit fires. */
  correctHandling: string;
}

/** A per-category service limit (illustrative). */
export interface MedicalPlanBenefitLimit {
  serviceCategory: string;
  /** Illustrative visit / unit allowance per calendar year. */
  limitPerYear: number;
  /** CARC shown once the limit is exhausted. */
  carc: string;
  note: string;
}

export interface MedicalPlan {
  id: string;
  name: string;
  planType: MedicalPlanType;
  network: "in-network only" | "in-network preferred";
  /** Illustrative annual individual deductible, in dollars. */
  deductibleUsd: number;
  /** Plan's share of the allowed amount after the deductible, as a whole percent. */
  planCoinsurancePercent: number;
  /** Whether preventive services are paid at 100% with no deductible. */
  preventivePaidInFull: boolean;
  /** CPT codes this fictional plan requires prior authorisation for. */
  priorAuthCptCodes: string[];
  cciEdits: MedicalCciEdit[];
  benefitLimits: MedicalPlanBenefitLimit[];
  notes: string;
}

export const MEDICAL_PLANS: MedicalPlan[] = [
  {
    id: "PLAN-CASCADIA-HEALTH-PPO",
    name: "Cascadia Health PPO",
    planType: "Commercial PPO",
    network: "in-network preferred",
    deductibleUsd: 0,
    planCoinsurancePercent: 80,
    preventivePaidInFull: true,
    priorAuthCptCodes: [],
    cciEdits: [
      {
        componentCode: "11102",
        comprehensiveCode: "17000",
        carc: "CO-236",
        explanation:
          "When a skin spot is sampled and then treated in the same visit, the payer's edit treats the sample as part of the treatment and will not pay for both on the same spot and date.",
        correctHandling:
          "Bill only the service that describes what actually happened to that spot. If a separate, distinct spot was sampled, report it with modifier 59 and a note identifying the second site.",
      },
    ],
    benefitLimits: [],
    notes:
      "Commercial PPO used for the clean-paid and documentation-driven cases. Preventive care pays in full; office and procedure visits pay at 80 percent of the contracted allowance with no deductible in this teaching plan.",
  },
  {
    id: "PLAN-MERIDIAN-ADVANTAGE",
    name: "Meridian Advantage HMO",
    planType: "Medicare Advantage HMO",
    network: "in-network only",
    deductibleUsd: 0,
    planCoinsurancePercent: 80,
    preventivePaidInFull: true,
    priorAuthCptCodes: ["72141", "71250", "27447"],
    cciEdits: [],
    benefitLimits: [],
    notes:
      "Medicare Advantage-style HMO used for the prior-authorisation case. Advanced imaging and joint replacement require a prior authorisation that must be on file before the claim is submitted; a missing authorisation denies the claim even when the service is otherwise covered.",
  },
  {
    id: "PLAN-NORTHWIND-MEDICAID",
    name: "Northwind State Medicaid",
    planType: "Medicaid MCO",
    network: "in-network only",
    deductibleUsd: 0,
    planCoinsurancePercent: 100,
    preventivePaidInFull: true,
    priorAuthCptCodes: [],
    cciEdits: [],
    benefitLimits: [
      {
        serviceCategory: "Physical / occupational therapy",
        limitPerYear: 20,
        carc: "CO-97",
        note: "Therapy visits beyond the annual allowance stop paying; the visit was covered, the money for that category is gone.",
      },
    ],
    notes:
      "Medicaid managed-care plan used for the benefit-exhausted case. No deductible and full coinsurance, but hard per-category visit limits mean a covered service can still pay nothing once the limit is reached.",
  },
  {
    id: "PLAN-ATLAS-SELECT-PPO",
    name: "Atlas Select PPO",
    planType: "Commercial PPO",
    network: "in-network preferred",
    deductibleUsd: 1500,
    planCoinsurancePercent: 70,
    preventivePaidInFull: true,
    priorAuthCptCodes: [],
    cciEdits: [],
    benefitLimits: [],
    notes:
      "Narrow-network commercial PPO with a real deductible and lower coinsurance than the teaching baseline. A 1,500-dollar individual deductible must be met before most services pay, after which the plan covers 70 percent of the allowance. The plan also excludes cosmetic services such as removing a benign growth for appearance alone. All figures are illustrative teaching values, not a real payer's schedule.",
  },
  {
    id: "PLAN-VANGUARD-HMO",
    name: "Vanguard Gatekeeper HMO",
    planType: "Medicare Advantage HMO",
    network: "in-network only",
    deductibleUsd: 0,
    planCoinsurancePercent: 80,
    preventivePaidInFull: true,
    priorAuthCptCodes: ["99205", "72141", "71250", "27447"],
    cciEdits: [],
    benefitLimits: [],
    notes:
      "Gatekeeper HMO that requires a primary-care referral before specialist care or advanced imaging is covered. Modelled through the prior-authorisation list: a high-level new-patient visit, advanced imaging and joint replacement all trigger a referral check, and a missing referral denies the claim the same way a missing authorisation does. Fictional payer; rule values are teaching placeholders, not any real plan's policy.",
  },
];

export const MEDICAL_PLAN_INDEX: Record<string, MedicalPlan> = Object.fromEntries(
  MEDICAL_PLANS.map((p) => [p.id, p]),
);

export function findPlan(id: string): MedicalPlan | undefined {
  return MEDICAL_PLAN_INDEX[id];
}

/* ======================================================================= */
/* Benefit scenarios — one per required adjudication outcome.               */
/* ======================================================================= */

export type BenefitScenarioKind =
  | "clean-paid"
  | "medical-necessity-denial"
  | "prior-auth-triggered"
  | "bundling-cci-edit"
  | "benefit-exhausted"
  | "deductible-coinsurance"
  | "non-covered-service";

export interface MedicalBenefitScenario {
  id: string;
  kind: BenefitScenarioKind;
  planId: string;
  /** The case id in caseScenarios.ts that exercises this scenario. */
  caseId: string;
  description: string;
  exampleCodes: { icd: string; cpt: string };
  /** CARC the remittance carries, or null when the claim pays. */
  resultingCarc: string | null;
  teachingPoint: string;
}

export const MEDICAL_BENEFIT_SCENARIOS: MedicalBenefitScenario[] = [
  {
    id: "SCEN-CLEAN-PAID",
    kind: "clean-paid",
    planId: "PLAN-CASCADIA-HEALTH-PPO",
    caseId: "MCASE-001",
    description:
      "A straightforward established-patient office visit for a chronic condition, correctly coded and correctly linked to a diagnosis. The claim scrubs clean and pays on the first submission.",
    exampleCodes: { icd: "I10", cpt: "99213" },
    resultingCarc: null,
    teachingPoint:
      "Most denials are caused at the desk or the keyboard, not by the patient. A clean claim is the absence of the mistakes this simulator exists to teach.",
  },
  {
    id: "SCEN-MEDICAL-NECESSITY",
    kind: "medical-necessity-denial",
    planId: "PLAN-CASCADIA-HEALTH-PPO",
    caseId: "MCASE-003",
    description:
      "A chronic-disease follow-up is coded with a symptom instead of the definitive diagnosis, so the payer cannot see why the higher-level visit was needed and denies for medical necessity.",
    exampleCodes: { icd: "R53.1", cpt: "99214" },
    resultingCarc: "CO-50",
    teachingPoint:
      "Code the definitive diagnosis, not the symptom that led the patient in. The symptom tells the payer what the patient felt; the diagnosis tells it why the service was needed.",
  },
  {
    id: "SCEN-PRIOR-AUTH",
    kind: "prior-auth-triggered",
    planId: "PLAN-MERIDIAN-ADVANTAGE",
    caseId: "MCASE-005",
    description:
      "An advanced imaging study hits the plan's prior-authorisation requirement. The coder's queue flags the CPT code, routes the encounter to the prior-authorisation stage, and a missing authorisation denies the claim.",
    exampleCodes: { icd: "M51.16", cpt: "72141" },
    resultingCarc: "CO-119",
    teachingPoint:
      "The prior-authorisation requirement lives on the procedure, not the patient. A perfectly documented MRI still denies if the authorisation was never obtained.",
  },
  {
    id: "SCEN-CCI-BUNDLING",
    kind: "bundling-cci-edit",
    planId: "PLAN-CASCADIA-HEALTH-PPO",
    caseId: "MCASE-006",
    description:
      "Two procedures performed on the same spot and date are billed together, but the payer's claim edit considers one a component of the other and denies the component line.",
    exampleCodes: { icd: "L57.0", cpt: "11102" },
    resultingCarc: "CO-236",
    teachingPoint:
      "A claim edit rejects the pair before a human reads it. If the note does not describe a truly separate service, only the definitive one belongs on the claim.",
  },
  {
    id: "SCEN-BENEFIT-EXHAUSTED",
    kind: "benefit-exhausted",
    planId: "PLAN-NORTHWIND-MEDICAID",
    caseId: "MCASE-007",
    description:
      "A therapy visit is correctly coded and covered, but the patient has already used the plan's annual therapy allowance, so the visit stops paying. The claim is not wrong; the benefit is simply gone.",
    exampleCodes: { icd: "M54.5", cpt: "97110" },
    resultingCarc: "CO-97",
    teachingPoint:
      "Benefit-exhausted is not a coding error and not appealable on necessity grounds. The plan paid what it owed; the remaining visits are the patient's or a coverage decision.",
  },
  {
    id: "SCEN-DEDUCTIBLE-COINSURANCE",
    kind: "deductible-coinsurance",
    planId: "PLAN-ATLAS-SELECT-PPO",
    caseId: "MCASE-008",
    description:
      "A visit is covered, but the plan has a real deductible and a 70 percent coinsurance. The claim pays — just not at the no-deductible 80 percent the front desk assumed when it quoted the patient.",
    exampleCodes: { icd: "J06.9", cpt: "99203" },
    resultingCarc: null,
    teachingPoint:
      "Coinsurance and a deductible are not denials. The claim pays what the benefit design says; the patient responsibility is real and should have been quoted before the visit.",
  },
  {
    id: "SCEN-NON-COVERED-SERVICE",
    kind: "non-covered-service",
    planId: "PLAN-ATLAS-SELECT-PPO",
    caseId: "MCASE-009",
    description:
      "A service the plan excludes outright — here a benign growth removed for appearance — is billed to insurance and returns a non-covered denial. The service was done, the claim was not wrong, and the balance is the patient's.",
    exampleCodes: { icd: "D23.9", cpt: "17110" },
    resultingCarc: "CO-96",
    teachingPoint:
      "An exclusion is absolute. It is not reduced, not downgraded, and not appealable on clinical grounds — the only correct move is to quote the patient before the service.",
  },
];

export const MEDICAL_BENEFIT_SCENARIO_INDEX: Record<string, MedicalBenefitScenario> =
  Object.fromEntries(MEDICAL_BENEFIT_SCENARIOS.map((s) => [s.id, s]));

export function scenariosByKind(kind: BenefitScenarioKind): MedicalBenefitScenario[] {
  return MEDICAL_BENEFIT_SCENARIOS.filter((s) => s.kind === kind);
}
