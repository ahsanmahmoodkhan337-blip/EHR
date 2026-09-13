/**
 * Dental Benefit Rules — Payer Plan Data for the Dental RCM Track
 *
 * Dental insurance is not small medical insurance. It behaves like a
 * capped spending account with usage rules attached, and the logic below is
 * the part students actually get hired to understand:
 *
 *   annual maximum  ..... a hard ceiling on what the plan pays per year
 *   deductible ......... paid before benefits start, often waived on preventive
 *   coinsurance class .. preventive / basic / major, each paid at its own rate
 *   frequency limits ... how often a service is payable regardless of need
 *   waiting periods .... months of coverage before a class becomes payable
 *   missing tooth clause  teeth lost before the plan started are not replaced
 *   alternate benefit .. the plan pays for a cheaper adequate treatment
 *
 * FICTIONAL PAYERS — IMPORTANT
 * Every plan below is invented for this simulator. The payer names, plan
 * names, group numbers and rule values do not describe any real insurer's
 * policy and must never be presented as one. They are modelled on the SHAPE
 * of common US dental PPO, DHMO and self-funded designs so that students
 * learn the mechanics; the numbers themselves are illustrative teaching
 * values. In real work, every one of these values is read off the specific
 * patient's plan documents or verified by an eligibility call.
 */

import type { BenefitClass } from "./cdtCodes";

export type PlanType = "PPO" | "DHMO" | "Indemnity" | "Discount";
export type BenefitPeriod = "calendar-year" | "plan-year-anniversary";
export type FrequencyScope = "per-patient" | "per-tooth" | "per-quadrant" | "per-arch" | "per-surface";
export type CoordinationMethod = "standard" | "non-duplication" | "maintenance-of-benefits" | "not-applicable";

export interface FrequencyLimit {
  /** Stable key referenced from CDTCode.frequencyRuleKey. */
  key: string;
  label: string;
  /** Codes the rule is measured against, as a group. */
  appliesToCodes: string[];
  /** How many times the service is payable inside the window. */
  timesAllowed: number;
  /** Length of the look-back window in months. */
  windowMonths: number;
  scope: FrequencyScope;
  /**
   * Whether the window runs from the last date of service (rolling) or
   * resets with the benefit period. This distinction decides whether a
   * 6-month recall patient outruns a 12-month allowance.
   */
  basis: "rolling-from-last-service" | "benefit-period";
  studentNote: string;
}

export interface AgeLimit {
  key: string;
  label: string;
  appliesToCodes: string[];
  /** Benefit stops at the end of the plan's defined age boundary. */
  maxAgeInclusive?: number;
  minAgeInclusive?: number;
  studentNote: string;
}

export interface AlternateBenefitProvision {
  id: string;
  label: string;
  /** Codes that trigger the downgrade. */
  triggerCodes: string[];
  /** Code whose allowance the plan will actually pay to. */
  paidAtCode: string;
  /** Narrow the trigger to specific teeth, e.g. posterior only. */
  appliesTo: "all-teeth" | "posterior-only" | "anterior-only";
  explanation: string;
  /** What the student must do about it, in order. */
  studentAction: string[];
}

export interface MissingToothClause {
  applies: boolean;
  /**
   * Some plans drop the clause once the member has been continuously
   * covered for a stated number of months.
   */
  waivedAfterContinuousMonths?: number;
  explanation: string;
  studentNote: string;
}

export interface WaitingPeriods {
  preventiveMonths: number;
  basicMonths: number;
  majorMonths: number;
  orthodonticMonths: number;
  /** Some employer groups waive waiting periods for the initial enrolment window. */
  note: string;
}

export interface DhmoCopay {
  code: string;
  patientCopayUsd: number;
}

export interface DentalPlan {
  id: string;
  /** Fictional payer. Not a real company. */
  payerName: string;
  planName: string;
  planType: PlanType;
  /** Fictional identifiers for claim-form practice. */
  payerId: string;
  groupNumber: string;
  claimsAddress: string;
  benefitPeriod: BenefitPeriod;
  /** Plan pays nothing further once this is exhausted. Orthodontics is separate. */
  annualMaximumUsd: number | null;
  deductible: {
    individualUsd: number;
    familyUsd: number;
    appliesToClasses: BenefitClass[];
    waivedForPreventive: boolean;
  };
  /** Percentage the PLAN pays after deductible. The patient owes the remainder. */
  coinsurancePlanPaysPct: Record<"Preventive" | "Basic" | "Major" | "Orthodontic", number>;
  orthodontics: {
    covered: boolean;
    lifetimeMaximumUsd?: number;
    dependentAgeLimitInclusive?: number;
    adultCovered: boolean;
    paymentPattern: string;
  };
  waitingPeriods: WaitingPeriods;
  missingToothClause: MissingToothClause;
  alternateBenefits: AlternateBenefitProvision[];
  frequencyLimits: FrequencyLimit[];
  ageLimits: AgeLimit[];
  coordinationOfBenefits: CoordinationMethod;
  /** Services the plan does not cover at all. */
  exclusions: string[];
  /** Services that require a predetermination before treatment. */
  predeterminationRequiredOver: number | null;
  predeterminationNote: string;
  /** Copay schedule for DHMO-style plans; empty for PPO. */
  copaySchedule: DhmoCopay[];
  teachingSummary: string;
}

/* ------------------------------------------------------------------ */
/* Shared frequency rules used by more than one fictional plan.        */
/* ------------------------------------------------------------------ */

const STANDARD_FREQUENCIES: FrequencyLimit[] = [
  {
    key: "exam-routine",
    label: "Routine evaluations",
    appliesToCodes: ["D0120", "D0140", "D0150", "D0180"],
    timesAllowed: 2,
    windowMonths: 12,
    scope: "per-patient",
    basis: "benefit-period",
    studentNote:
      "All evaluation types share one allowance on this plan. A patient who uses both routine visits and then comes in for an emergency exam has no evaluation benefit left.",
  },
  {
    key: "exam-comprehensive",
    label: "Comprehensive evaluation",
    appliesToCodes: ["D0150", "D0180"],
    timesAllowed: 1,
    windowMonths: 36,
    scope: "per-patient",
    basis: "rolling-from-last-service",
    studentNote:
      "Once every three years per provider. A returning patient of record normally gets the routine evaluation code instead.",
  },
  {
    key: "prophy",
    label: "Routine cleanings",
    appliesToCodes: ["D1110", "D1120", "D4910"],
    timesAllowed: 2,
    windowMonths: 12,
    scope: "per-patient",
    basis: "benefit-period",
    studentNote:
      "Cleanings and periodontal maintenance draw on the same two-per-year pool here. Alternating the codes does not create a third or fourth paid visit.",
  },
  {
    key: "perio-maintenance",
    label: "Periodontal maintenance",
    appliesToCodes: ["D4910"],
    timesAllowed: 2,
    windowMonths: 12,
    scope: "per-patient",
    basis: "benefit-period",
    studentNote:
      "Counted together with routine cleanings on this plan. Patients on a three-month perio recall will be paying out of pocket for two of the four visits.",
  },
  {
    key: "radiograph-bitewing",
    label: "Bitewing radiographs",
    appliesToCodes: ["D0272", "D0274", "D0277"],
    timesAllowed: 1,
    windowMonths: 12,
    scope: "per-patient",
    basis: "rolling-from-last-service",
    studentNote:
      "Rolling from the last date taken, not from January. A set taken on 3 March last year is not payable again until 3 March this year, even though the benefit year rolled over.",
  },
  {
    key: "radiograph-fmx",
    label: "Full-mouth series or panoramic",
    appliesToCodes: ["D0210", "D0330"],
    timesAllowed: 1,
    windowMonths: 60,
    scope: "per-patient",
    basis: "rolling-from-last-service",
    studentNote:
      "The full-mouth series and the panoramic share one allowance. Taking a panoramic two years after a full-mouth series means the panoramic is the patient's cost.",
  },
  {
    key: "fluoride",
    label: "Topical fluoride",
    appliesToCodes: ["D1206", "D1208"],
    timesAllowed: 2,
    windowMonths: 12,
    scope: "per-patient",
    basis: "benefit-period",
    studentNote: "Read the age limit alongside this one — frequency is irrelevant if the patient is over the age cap.",
  },
  {
    key: "sealant",
    label: "Sealants",
    appliesToCodes: ["D1351"],
    timesAllowed: 1,
    windowMonths: 36,
    scope: "per-tooth",
    basis: "rolling-from-last-service",
    studentNote:
      "Per tooth, not per visit. Six sealants on six teeth on the same day are six separate allowances, each with its own three-year clock.",
  },
  {
    key: "srp",
    label: "Scaling and root planing",
    appliesToCodes: ["D4341", "D4342"],
    timesAllowed: 1,
    windowMonths: 24,
    scope: "per-quadrant",
    basis: "rolling-from-last-service",
    studentNote:
      "Per quadrant. All four quadrants can be treated in the same benefit period, but the same quadrant cannot be re-treated inside the window without an appeal.",
  },
  {
    key: "crown-replacement",
    label: "Crown and onlay replacement",
    appliesToCodes: ["D2740", "D2750", "D2751", "D2790", "D6750"],
    timesAllowed: 1,
    windowMonths: 60,
    scope: "per-tooth",
    basis: "rolling-from-last-service",
    studentNote:
      "Measured per tooth from the seat date of the last crown — including one placed by a previous dentist. Ask the patient, and check the payer's history during eligibility.",
  },
  {
    key: "prosthetic-replacement",
    label: "Denture, partial and bridge replacement",
    appliesToCodes: ["D5110", "D5120", "D5211", "D5213", "D5214", "D6240", "D6245", "D6750", "D5750"],
    timesAllowed: 1,
    windowMonths: 60,
    scope: "per-arch",
    basis: "rolling-from-last-service",
    studentNote:
      "Five years from the last placement. This is the question to ask at check-in, because the patient rarely volunteers that their current denture is three years old.",
  },
  {
    key: "occlusal-guard",
    label: "Occlusal guard",
    appliesToCodes: ["D9944"],
    timesAllowed: 1,
    windowMonths: 60,
    scope: "per-arch",
    basis: "rolling-from-last-service",
    studentNote: "Where guards are covered at all, once every five years is a common limit.",
  },
];

const STANDARD_AGE_LIMITS: AgeLimit[] = [
  {
    key: "fluoride-age",
    label: "Fluoride benefit age cap",
    appliesToCodes: ["D1206", "D1208"],
    maxAgeInclusive: 15,
    studentNote:
      "The single most common surprise balance in a hygiene practice. The patient turning 16 loses the fluoride benefit mid-year, and nobody notices until the explanation of benefits arrives.",
  },
  {
    key: "sealant-age",
    label: "Sealant benefit age cap",
    appliesToCodes: ["D1351"],
    maxAgeInclusive: 15,
    studentNote: "Sealants on an adult are usually the patient's cost even though they are clinically sound care.",
  },
  {
    key: "prophy-child-age",
    label: "Child cleaning code boundary",
    appliesToCodes: ["D1120"],
    maxAgeInclusive: 13,
    studentNote:
      "From the patient's fourteenth birthday this plan expects the adult cleaning code. Submitting the child code afterwards gets the line changed or denied.",
  },
  {
    key: "space-maintainer-age",
    label: "Space maintainer age cap",
    appliesToCodes: ["D1510"],
    maxAgeInclusive: 13,
    studentNote: "Tied to the mixed dentition; not payable once the permanent teeth are in.",
  },
];

/* ------------------------------------------------------------------ */
/* Fictional plans                                                     */
/* ------------------------------------------------------------------ */

export const DENTAL_PLANS: DentalPlan[] = [
  {
    id: "PLAN-CASCADIA-PPO",
    payerName: "Cascadia Dental Guard",
    planName: "Cascadia Classic PPO 1500",
    planType: "PPO",
    payerId: "CDG-0091",
    groupNumber: "GRP-44821",
    claimsAddress: "Cascadia Dental Guard, Claims Unit, PO Box 4821, Riverbend, ST 00000 (fictional)",
    benefitPeriod: "calendar-year",
    annualMaximumUsd: 1500,
    deductible: {
      individualUsd: 50,
      familyUsd: 150,
      appliesToClasses: ["Basic", "Major"],
      waivedForPreventive: true,
    },
    coinsurancePlanPaysPct: { Preventive: 100, Basic: 80, Major: 50, Orthodontic: 0 },
    orthodontics: {
      covered: false,
      adultCovered: false,
      paymentPattern: "Not a covered benefit under this plan design.",
    },
    waitingPeriods: {
      preventiveMonths: 0,
      basicMonths: 0,
      majorMonths: 12,
      orthodonticMonths: 0,
      note: "Major services are not payable until the member has twelve months of continuous coverage. Treatment can still be done — it is simply the patient's cost until the waiting period is satisfied.",
    },
    missingToothClause: {
      applies: true,
      explanation:
        "The plan does not pay to replace a tooth that was already missing on the day the member's coverage began, no matter how the replacement is done — bridge, partial or implant.",
      studentNote:
        "Ask for the extraction date at treatment planning, not at claim time. If the tooth came out before the coverage effective date, the replacement is patient responsibility and must be quoted that way up front.",
    },
    alternateBenefits: [
      {
        id: "ALT-POSTERIOR-COMPOSITE",
        label: "Posterior composite paid at the amalgam allowance",
        triggerCodes: ["D2391", "D2392", "D2393", "D2394"],
        paidAtCode: "D2150",
        appliesTo: "posterior-only",
        explanation:
          "On back teeth the plan considers a metal filling an adequate restoration, so it pays the matching amalgam allowance for the same number of surfaces and the patient owes the difference.",
        studentAction: [
          "Bill the composite code that was actually performed — never substitute the amalgam code.",
          "Expect the payment to come back reduced with an adjustment, not denied.",
          "Quote the difference to the patient before treatment and document that you did.",
        ],
      },
      {
        id: "ALT-POSTERIOR-CERAMIC-CROWN",
        label: "Posterior ceramic crown paid at the full cast metal allowance",
        triggerCodes: ["D2740"],
        paidAtCode: "D2790",
        appliesTo: "posterior-only",
        explanation:
          "The plan treats a cast metal crown as sufficient on back teeth. An all-ceramic crown is still covered, but only up to the metal crown allowance.",
        studentAction: [
          "Send a predetermination so the patient sees the downgrade in writing before the tooth is prepared.",
          "Bill the crown that was delivered.",
          "Post the plan's reduced payment and bill the balance as a patient upgrade, not as a write-off.",
        ],
      },
      {
        id: "ALT-IMPLANT-TO-BRIDGE",
        label: "Implant benefit limited to the conventional alternative",
        triggerCodes: ["D6010", "D6058"],
        paidAtCode: "D6240",
        appliesTo: "all-teeth",
        explanation:
          "Where an implant is covered at all, the plan pays no more than it would have paid toward a conventional bridge or partial for the same space.",
        studentAction: [
          "Get the allowance confirmed in a written predetermination before surgery.",
          "Check the missing tooth clause at the same time — it is applied first, and it can remove the benefit entirely.",
        ],
      },
    ],
    frequencyLimits: STANDARD_FREQUENCIES,
    ageLimits: STANDARD_AGE_LIMITS,
    coordinationOfBenefits: "standard",
    exclusions: [
      "Cosmetic treatment, including whitening and veneers placed for appearance",
      "Three-dimensional cone beam imaging",
      "Nitrous oxide for patients aged 16 and over",
      "Charges for missed or late-cancelled appointments",
      "Treatment started before the coverage effective date",
    ],
    predeterminationRequiredOver: 500,
    predeterminationNote:
      "The plan asks for a predetermination on any treatment plan above the stated amount. It is not a guarantee of payment — eligibility is re-checked on the date of service, and the remaining annual maximum can change between the estimate and the visit.",
    copaySchedule: [],
    teachingSummary:
      "The workhorse teaching plan: a modest annual maximum, a 100/80/50 split, a twelve-month major waiting period, an active missing tooth clause and two alternate benefit provisions. Most teaching traps in the dental track can be built on this plan alone.",
  },

  {
    id: "PLAN-MERIDIAN-DHMO",
    payerName: "Meridian Smile Choice",
    planName: "Meridian Select DHMO",
    planType: "DHMO",
    payerId: "MSC-0220",
    groupNumber: "GRP-70113",
    claimsAddress: "Meridian Smile Choice, Encounter Processing, PO Box 220, Fairmont, ST 00000 (fictional)",
    benefitPeriod: "calendar-year",
    annualMaximumUsd: null,
    deductible: {
      individualUsd: 0,
      familyUsd: 0,
      appliesToClasses: [],
      waivedForPreventive: true,
    },
    coinsurancePlanPaysPct: { Preventive: 100, Basic: 100, Major: 100, Orthodontic: 0 },
    orthodontics: {
      covered: true,
      lifetimeMaximumUsd: undefined,
      dependentAgeLimitInclusive: 18,
      adultCovered: true,
      paymentPattern:
        "Orthodontics is handled as a fixed patient copay for the whole case rather than a percentage, and only at the assigned office or an authorised specialist.",
    },
    waitingPeriods: {
      preventiveMonths: 0,
      basicMonths: 0,
      majorMonths: 0,
      orthodonticMonths: 0,
      note: "No waiting periods. The trade-off is that the member must be treated at the dental office they are assigned to.",
    },
    missingToothClause: {
      applies: false,
      explanation: "This plan design does not apply a missing tooth clause; the copay schedule governs instead.",
      studentNote:
        "Copay plans replace percentage maths with a fixed price list. The skill shifts from estimating coinsurance to confirming assignment and referral before the patient is seated.",
    },
    alternateBenefits: [],
    frequencyLimits: [
      {
        key: "prophy",
        label: "Routine cleanings",
        appliesToCodes: ["D1110", "D1120"],
        timesAllowed: 2,
        windowMonths: 12,
        scope: "per-patient",
        basis: "benefit-period",
        studentNote: "Additional cleanings are available at the listed copay rather than being denied outright.",
      },
      {
        key: "radiograph-bitewing",
        label: "Bitewing radiographs",
        appliesToCodes: ["D0272", "D0274"],
        timesAllowed: 1,
        windowMonths: 12,
        scope: "per-patient",
        basis: "rolling-from-last-service",
        studentNote: "Same rolling window logic as a PPO, even though the money works differently.",
      },
    ],
    ageLimits: [
      {
        key: "fluoride-age",
        label: "Fluoride benefit age cap",
        appliesToCodes: ["D1206", "D1208"],
        maxAgeInclusive: 18,
        studentNote: "A higher age cap than the teaching PPO — which is exactly why students must read each plan instead of memorising one.",
      },
    ],
    coordinationOfBenefits: "not-applicable",
    exclusions: [
      "Any treatment performed outside the member's assigned office without an approved referral",
      "Specialty care without a referral from the assigned general dentist",
      "Cosmetic treatment",
    ],
    predeterminationRequiredOver: null,
    predeterminationNote:
      "Predeterminations are not used in the same way as a PPO. What matters instead is confirming the member is assigned to this office on the date of service, and that specialty referrals are approved in advance.",
    copaySchedule: [
      { code: "D0120", patientCopayUsd: 0 },
      { code: "D0150", patientCopayUsd: 0 },
      { code: "D0274", patientCopayUsd: 0 },
      { code: "D1110", patientCopayUsd: 0 },
      { code: "D1120", patientCopayUsd: 0 },
      { code: "D1351", patientCopayUsd: 22 },
      { code: "D2140", patientCopayUsd: 38 },
      { code: "D2150", patientCopayUsd: 52 },
      { code: "D2391", patientCopayUsd: 65 },
      { code: "D2392", patientCopayUsd: 88 },
      { code: "D2740", patientCopayUsd: 495 },
      { code: "D2950", patientCopayUsd: 95 },
      { code: "D3330", patientCopayUsd: 475 },
      { code: "D4341", patientCopayUsd: 115 },
      { code: "D4342", patientCopayUsd: 72 },
      { code: "D4910", patientCopayUsd: 65 },
      { code: "D5213", patientCopayUsd: 720 },
      { code: "D7140", patientCopayUsd: 45 },
      { code: "D7210", patientCopayUsd: 95 },
      { code: "D7240", patientCopayUsd: 265 },
    ],
    teachingSummary:
      "A copay-schedule plan with no annual maximum and no deductible, used to teach that 'no maximum' does not mean 'no cost' and that assignment and referral rules are what break these claims.",
  },

  {
    id: "PLAN-NORTHWIND-TRUST",
    payerName: "Northwind Union Dental Trust",
    planName: "Northwind Members Plan A",
    planType: "Indemnity",
    payerId: "NWT-0450",
    groupNumber: "GRP-11907",
    claimsAddress: "Northwind Union Dental Trust, Benefits Office, PO Box 1190, Harbor City, ST 00000 (fictional)",
    benefitPeriod: "plan-year-anniversary",
    annualMaximumUsd: 2500,
    deductible: {
      individualUsd: 25,
      familyUsd: 75,
      appliesToClasses: ["Basic", "Major"],
      waivedForPreventive: true,
    },
    coinsurancePlanPaysPct: { Preventive: 100, Basic: 90, Major: 60, Orthodontic: 50 },
    orthodontics: {
      covered: true,
      lifetimeMaximumUsd: 2000,
      dependentAgeLimitInclusive: 19,
      adultCovered: false,
      paymentPattern:
        "Roughly a quarter of the covered case amount is released at banding and the rest is paid in monthly instalments while treatment is active. Payments stop if the patient leaves treatment or loses eligibility.",
    },
    waitingPeriods: {
      preventiveMonths: 0,
      basicMonths: 0,
      majorMonths: 6,
      orthodonticMonths: 12,
      note: "A shorter major waiting period than the teaching PPO, but orthodontics has its own twelve-month wait that students routinely miss.",
    },
    missingToothClause: {
      applies: true,
      waivedAfterContinuousMonths: 24,
      explanation:
        "Teeth missing before the coverage start date are excluded from replacement benefits until the member has been continuously covered for twenty-four months, after which the exclusion drops away.",
      studentNote:
        "This variant teaches the useful front-desk question: how long has this patient been on the plan? The same treatment plan can be a full denial this month and a covered service next month.",
    },
    alternateBenefits: [
      {
        id: "ALT-BRIDGE-TO-PARTIAL",
        label: "Multi-unit bridge paid at the partial denture allowance",
        triggerCodes: ["D6240", "D6245", "D6750"],
        paidAtCode: "D5213",
        appliesTo: "all-teeth",
        explanation:
          "Where several teeth are missing in the same arch, the trust pays what a removable partial would have cost rather than a long span of bridgework.",
        studentAction: [
          "Predetermine before starting. The difference on a three-unit case is large enough that a patient who was not warned will dispute the bill.",
          "Document the patient's acceptance of the upgrade cost in writing.",
        ],
      },
    ],
    frequencyLimits: [
      ...STANDARD_FREQUENCIES.filter((f) => f.key !== "prophy" && f.key !== "perio-maintenance"),
      {
        key: "prophy",
        label: "Routine cleanings",
        appliesToCodes: ["D1110", "D1120"],
        timesAllowed: 2,
        windowMonths: 12,
        scope: "per-patient",
        basis: "benefit-period",
        studentNote: "Cleanings are counted separately from periodontal maintenance on this plan, which is the more generous design.",
      },
      {
        key: "perio-maintenance",
        label: "Periodontal maintenance",
        appliesToCodes: ["D4910"],
        timesAllowed: 4,
        windowMonths: 12,
        scope: "per-patient",
        basis: "benefit-period",
        studentNote:
          "Four maintenance visits per year, counted separately from routine cleanings. Compare this against the teaching PPO to see how much the same clinical schedule can differ in price to the patient.",
      },
    ],
    ageLimits: STANDARD_AGE_LIMITS,
    coordinationOfBenefits: "non-duplication",
    exclusions: [
      "Implant placement and implant-supported restorations",
      "Cosmetic treatment",
      "Adult orthodontics",
      "Services covered by a workers' compensation claim",
    ],
    predeterminationRequiredOver: 300,
    predeterminationNote:
      "The trust reviews any plan above the stated amount, and periodontal surgery is reviewed at any amount with a full pocket chart attached.",
    copaySchedule: [],
    teachingSummary:
      "A richer self-funded plan used to teach contrast: higher maximum, better coinsurance, separate perio maintenance counts, an orthodontic lifetime maximum with an age cap, non-duplication coordination of benefits, and a missing tooth clause that expires.",
  },
];

export const DENTAL_PLAN_INDEX: Record<string, DentalPlan> = Object.fromEntries(
  DENTAL_PLANS.map((p) => [p.id, p]),
);

export function findPlan(planId: string): DentalPlan | undefined {
  return DENTAL_PLAN_INDEX[planId];
}

/** Find the frequency rule that governs a code under a given plan, if any. */
export function frequencyRuleFor(plan: DentalPlan, code: string): FrequencyLimit | undefined {
  return plan.frequencyLimits.find((f) => f.appliesToCodes.includes(code));
}

/** Find the age rule that governs a code under a given plan, if any. */
export function ageRuleFor(plan: DentalPlan, code: string): AgeLimit | undefined {
  return plan.ageLimits.find((a) => a.appliesToCodes.includes(code));
}

/** Find an alternate benefit provision that would downgrade a code under a plan. */
export function alternateBenefitFor(
  plan: DentalPlan,
  code: string,
  toothIsPosterior?: boolean,
): AlternateBenefitProvision | undefined {
  return plan.alternateBenefits.find((a) => {
    if (!a.triggerCodes.includes(code)) return false;
    if (a.appliesTo === "posterior-only") return toothIsPosterior !== false;
    if (a.appliesTo === "anterior-only") return toothIsPosterior !== true;
    return true;
  });
}

/**
 * The order a payer's system actually applies benefit rules. Students who
 * learn this sequence can explain almost any dental explanation of benefits.
 */
export const ADJUDICATION_ORDER: { step: number; rule: string; explanation: string }[] = [
  {
    step: 1,
    rule: "Eligibility on the date of service",
    explanation:
      "Was the patient covered on the day of treatment? Coverage that ended last week makes every later question irrelevant.",
  },
  {
    step: 2,
    rule: "Is the service a covered benefit at all?",
    explanation: "Plan exclusions are absolute. An excluded service is not reduced, it is simply not paid.",
  },
  {
    step: 3,
    rule: "Waiting period",
    explanation: "Covered services in a class the member has not yet qualified for are the patient's cost.",
  },
  {
    step: 4,
    rule: "Age limit",
    explanation: "Age-capped benefits are tested against the patient's age on the date of service, not their age at enrolment.",
  },
  {
    step: 5,
    rule: "Frequency and history",
    explanation: "The payer checks its own paid history, including services paid to a previous dentist.",
  },
  {
    step: 6,
    rule: "Missing tooth clause",
    explanation: "Applied to replacement services before any allowance is calculated.",
  },
  {
    step: 7,
    rule: "Alternate benefit",
    explanation: "The allowance is set to the cheaper adequate treatment. The service is still covered — it is paid at a lower base.",
  },
  {
    step: 8,
    rule: "Contracted allowance",
    explanation: "In-network fees are written down to the contracted amount; the write-off is not billable to the patient.",
  },
  {
    step: 9,
    rule: "Deductible",
    explanation: "Taken from the allowed amount, in the order claims are processed — which is why claim order changes who owes what.",
  },
  {
    step: 10,
    rule: "Coinsurance by class",
    explanation: "The plan's percentage is applied to what remains after the deductible.",
  },
  {
    step: 11,
    rule: "Annual maximum",
    explanation:
      "Applied last. A service can pass every other rule and still pay nothing because the yearly ceiling was already reached.",
  },
  {
    step: 12,
    rule: "Coordination of benefits",
    explanation: "Only then does a secondary plan look at what is left, and non-duplication plans often leave nothing.",
  },
];

/**
 * Plain-language explanations of coordination methods, since the wrong
 * assumption here produces confidently wrong patient estimates.
 */
export const COB_EXPLANATIONS: Record<CoordinationMethod, string> = {
  standard:
    "The secondary plan pays up to what it would have paid on its own, so between the two plans the patient can end up owing nothing.",
  "non-duplication":
    "The secondary plan pays only the amount by which its own benefit exceeds what the primary already paid. If the primary paid as much or more, the secondary pays nothing.",
  "maintenance-of-benefits":
    "The secondary calculates its normal benefit, then subtracts what the primary paid, so the patient usually still owes something.",
  "not-applicable": "Coordination does not apply to this plan design.",
};
