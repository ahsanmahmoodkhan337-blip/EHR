/**
 * Dental RCM Data Layer — barrel export
 *
 * Import from `~/data/dental` rather than reaching into individual files, so
 * that the specialty refactor can swap the medical and dental content layers
 * behind a single import path.
 *
 * Contents:
 *   cdtCodes.ts       CDT teaching subset with original descriptions
 *   benefitRules.ts   Fictional payer plans: maximums, frequencies, waiting
 *                     periods, missing tooth clause, alternate benefits
 *   denialReasons.ts  Dental denials with ordered corrective actions
 *   caseScenarios.ts  Seven graded cases with deliberate teaching traps
 *   toothNotation.ts  Universal / FDI / Palmer cross-reference and surfaces
 *
 * See README.md in this directory for the copyright rules that govern any
 * edit to this content.
 */

export type { CDTCode, CDTCategory, BenefitClass, CDTRequirement } from "./cdtCodes";
export {
  CDT_CODES,
  CDT_CODE_INDEX,
  CDT_CATEGORY_ORDER,
  findCDT,
  cdtByCategory,
  searchCDT,
  validateSurfaceCount,
} from "./cdtCodes";

export type {
  DentalPlan,
  PlanType,
  BenefitPeriod,
  FrequencyLimit,
  FrequencyScope,
  AgeLimit,
  AlternateBenefitProvision,
  MissingToothClause,
  WaitingPeriods,
  DhmoCopay,
  CoordinationMethod,
} from "./benefitRules";
export {
  DENTAL_PLANS,
  DENTAL_PLAN_INDEX,
  ADJUDICATION_ORDER,
  COB_EXPLANATIONS,
  findPlan,
  frequencyRulesFor,
  frequencyRuleFor,
  ageRuleFor,
  alternateBenefitFor,
} from "./benefitRules";

export type { DentalDenial, DenialCategory, DenialOutcome } from "./denialReasons";
export {
  DENTAL_DENIALS,
  DENTAL_DENIAL_INDEX,
  AR_CALL_GUIDANCE,
  findDenial,
  denialsForCode,
  denialsByCategory,
} from "./denialReasons";

export type {
  DentalCaseScenario,
  CaseDifficulty,
  CasePatient,
  CaseProcedure,
  CaseTrap,
  ExpectedLineOutcome,
  CaseGradingCriterion,
  RcmStage,
} from "./caseScenarios";
export {
  DENTAL_CASE_SCENARIOS,
  DENTAL_CASE_INDEX,
  findCase,
  casesByDifficulty,
  trapsForStage,
} from "./caseScenarios";

export type { ToothRef, ToothSurface, SurfaceCode, QuadrantRef, Arch, Side, ToothType, Dentition } from "./toothNotation";
export {
  PERMANENT_TEETH,
  PRIMARY_TEETH,
  ALL_TEETH,
  TOOTH_SURFACES,
  QUADRANTS,
  ORAL_CAVITY_AREAS,
  NOTATION_TEACHING_POINTS,
  findTooth,
  universalToFdi,
  fdiToUniversal,
  validateSurfaces,
} from "./toothNotation";

export type {
  CoverageInput,
  CoverageResult,
  CoverageStepResult,
  CoveragePatient,
  PaidHistoryEntry,
  ToothContext,
  StepVerdict,
  ClaimLineInput,
  ClaimEvaluationResult,
} from "./coverage";
export { evaluateCoverage, evaluateClaim } from "./coverage";
export type {
  AttachmentType,
  AttachmentWhen,
  AttachmentRequirement,
  PredeterminationDriver,
  PredeterminationCandidate,
} from "./attachmentRequirements";
export {
  ATTACHMENT_TYPE_LABELS,
  ATTACHMENT_REQUIREMENTS,
  ATTACHMENT_REQUIREMENTS_BY_CODE,
  PREDETERMINATION_CANDIDATES,
  PREDETERMINATION_CANDIDATE_INDEX,
  attachmentsForCode,
  attachmentTypesFor,
  isPredeterminationCandidate,
  predeterminationDriverFor,
} from "./attachmentRequirements";
export type {
  PredeterminationVerdict,
  PredeterminationEstimateLine,
  PredeterminationScenario,
} from "./predeterminationRules";
export {
  PREDETERMINATION_SCENARIOS,
  PREDETERMINATION_SCENARIO_INDEX,
  findPredeterminationScenario,
  predeterminationScenariosByVerdict,
} from "./predeterminationRules";
