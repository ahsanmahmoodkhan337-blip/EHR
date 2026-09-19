/**
 * Medical RCM Data Layer — barrel export
 *
 * Import from `~/data/medical` rather than reaching into individual files, so
 * that the medical content mirrors the dental content layer and both sit behind
 * a single import path per specialty.
 *
 * Contents:
 *   payerScenarios.ts  Fictional payer plans and the five benefit scenarios
 *                      (clean-paid, medical-necessity, prior-auth, bundling,
 *                      benefit-exhausted) the cases exercise.
 *   caseScenarios.ts   Seven graded medical cases with deliberate teaching
 *                      traps, expected adjudication and grading rubrics.
 *
 * The medical track's code repositories (CPT and ICD-10) and denial-code
 * reference still live beside their stages under `src/components/`:
 *   - CPT teaching subset:  src/components/CodingQueue/cptData.ts
 *   - ICD-10 teaching subset: src/components/CodingQueue/icd10Data.ts
 *   - Denial codes / CMS-1500 / POS: src/components/BillingLedger/claimData.ts
 *   - AR call scripts / scenarios: src/components/ARVoiceSimulator/arData.ts
 *
 * See README.md in this directory for the copyright rules that govern any
 * edit to this content.
 */

export type {
  MedicalPlan,
  MedicalPlanType,
  MedicalCciEdit,
  MedicalPlanBenefitLimit,
  BenefitScenarioKind,
  MedicalBenefitScenario,
} from "./payerScenarios";
export {
  MEDICAL_PLANS,
  MEDICAL_PLAN_INDEX,
  MEDICAL_BENEFIT_SCENARIOS,
  MEDICAL_BENEFIT_SCENARIO_INDEX,
  findPlan,
  scenariosByKind,
} from "./payerScenarios";

export type {
  MedicalCaseScenario,
  MedicalCaseDifficulty,
  MedicalCasePatient,
  MedicalDiagnosis,
  MedicalProcedure,
  MedicalCaseTrap,
  MedicalExpectedLineOutcome,
  MedicalRcmStage,
} from "./caseScenarios";
export {
  MEDICAL_CASE_SCENARIOS,
  MEDICAL_CASE_INDEX,
  findCase,
  casesByDifficulty,
  trapsForStage,
} from "./caseScenarios";
export type {
  NoteSection,
  DotPhrase,
  TemplateDiagnosisField,
  ChiefComplaintTemplate,
} from "./scribeTemplates";
export {
  DOT_PHRASES,
  DOT_PHRASE_INDEX,
  CHIEF_COMPLAINT_TEMPLATES,
  CHIEF_COMPLAINT_TEMPLATE_INDEX,
  findDotPhrase,
  dotPhrasesBySection,
  findChiefComplaintTemplate,
  templateForCase,
} from "./scribeTemplates";
