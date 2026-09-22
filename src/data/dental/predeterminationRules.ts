/**
 * Dental Predetermination Scenarios — Teaching Content
 *
 * Three scenarios where a predetermination of benefits (a "pre-treatment
 * estimate") is requested before treatment, the payer returns a line-by-line
 * estimate, and the student has to read it and decide how to proceed.
 *
 * The scenarios deliberately cover the four estimate verdicts a dental biller
 * meets in real life — allowed, downgraded, excluded and frequency-limited —
 * and each carries a trap about WHEN to request a predetermination versus
 * submitting the claim directly.
 *
 * COPYRIGHT NOTE — READ BEFORE EDITING
 * The CDT Code set and its official nomenclature and descriptors are copyright
 * of the American Dental Association. Nothing in this file reproduces ADA
 * nomenclature or descriptors. Every description string is original teaching
 * text; code identifiers (D2740, D6010, …) are references only.
 *
 * ACCURACY NOTE
 * Fees and allowances are illustrative teaching figures, not a fee schedule
 * and not a real payer's allowable. Plans referenced are the fictional plans in
 * benefitRules.ts. Denial ids reference denialReasons.ts. The arithmetic in
 * each estimate is internally consistent so `evaluateClaim()`-style checks can
 * reproduce it, but no figure here should be quoted to a student as real.
 */

export type PredeterminationVerdict = "allowed" | "downgraded" | "excluded" | "frequency-limited";

export interface PredeterminationEstimateLine {
  line: number;
  code: string;
  /** Original plain-language description of the planned service. */
  description: string;
  tooth?: string;
  chargedUsd: number;
  /** Contracted allowance. Illustrative teaching figure. */
  allowedUsd: number;
  /**
   * Allowance of the downgrade benchmark, where an alternate benefit applies.
   * Absent where no downgrade applies.
   */
  paidAtAllowedUsd?: number;
  planPaysUsd: number;
  patientOwesUsd: number;
  /** Charge minus allowance; not billable to the patient in network. */
  writeOffUsd: number;
  verdict: PredeterminationVerdict;
  denialId?: string;
  note: string;
}

export interface PredeterminationScenario {
  id: string;
  title: string;
  planId: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedMinutes: number;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    memberId: string;
  };
  /** What the provider is planning to do. */
  plannedTreatment: string;
  /** Whether a predetermination is warranted before starting treatment. */
  shouldPredetermine: boolean;
  predeterminationRationale: string;
  /** The headline of the payer's written estimate. */
  estimateSummary: string;
  estimate: PredeterminationEstimateLine[];
  estimateTotals: {
    chargedUsd: number;
    allowedUsd: number;
    planPaysUsd: number;
    patientOwesUsd: number;
    writeOffUsd: number;
  };
  trap: {
    title: string;
    mistake: string;
    consequence: string;
    correctAction: string;
    producesDenialId?: string;
  };
  teachingPoint: string;
  instructorKey: string[];
}

/* ======================================================================= */
/* SCENARIO 1 — DOWGRADED: posterior all-ceramic crown                     */
/* ======================================================================= */

const PRED_CERAMIC_CROWN_DOWNGRADE: PredeterminationScenario = {
  id: "PRED-01",
  title: "A posterior all-ceramic crown that pays at the metal allowance",
  planId: "PLAN-CASCADIA-PPO",
  difficulty: "beginner",
  estimatedMinutes: 15,
  patient: {
    id: "PD-1001",
    firstName: "Marcus",
    lastName: "Bell",
    memberId: "CCH-9911-3327",
  },
  plannedTreatment:
    "A core build-up and an all-ceramic crown on the lower left first molar (#19).",
  shouldPredetermine: true,
  predeterminationRationale:
    "The all-ceramic crown is a posterior tooth. This plan's alternate-benefit rule pays a posterior ceramic crown at the base-metal crown allowance, so the patient's share is much higher than the fee alone suggests. A predetermination puts that number in writing before the tooth is prepared.",
  estimateSummary:
    "Both lines are covered, but the crown is downgraded to the base-metal allowance. The build-up pays normally; the crown pays at the lower metal level and the difference is the patient's upgrade.",
  estimate: [
    {
      line: 1,
      code: "D2950",
      description: "Core build-up on #19",
      tooth: "19",
      chargedUsd: 288,
      allowedUsd: 240,
      planPaysUsd: 120,
      patientOwesUsd: 120,
      writeOffUsd: 48,
      verdict: "allowed",
      note: "Paid at 50% of the allowance (Major) with the deductible already met. The radiograph and narrative were attached, so the build-up was not bundled into the crown.",
    },
    {
      line: 2,
      code: "D2740",
      description: "All-ceramic crown on #19 (posterior)",
      tooth: "19",
      chargedUsd: 1320,
      allowedUsd: 1100,
      paidAtAllowedUsd: 980,
      planPaysUsd: 490,
      patientOwesUsd: 610,
      writeOffUsd: 220,
      verdict: "downgraded",
      denialId: "DEN-ALT-BENEFIT",
      note: "The plan treats a base-metal crown as adequate on a back tooth. It pays 50% of the base-metal allowance (980), leaving the ceramic upgrade as the patient's responsibility.",
    },
  ],
  estimateTotals: { chargedUsd: 1608, allowedUsd: 1340, planPaysUsd: 610, patientOwesUsd: 730, writeOffUsd: 268 },
  trap: {
    title: "Submitting directly and discovering the downgrade on the remittance",
    mistake: "The student sends the crown claim without a predetermination and quotes the patient only the 50% coinsurance on the full crown fee.",
    consequence:
      "The claim pays at the base-metal level. The patient owes the ceramic upgrade they were never told about, and now it looks like a surprise balance rather than a planned upgrade.",
    correctAction:
      "Send a predetermination first, show the patient the written downgrade, and get the upgrade balance acknowledged before the tooth is prepared.",
    producesDenialId: "DEN-ALT-BENEFIT",
  },
  teachingPoint:
    "A downgrade is an adjustment, not a denial. The code was correct — the plan simply pays a lower allowance for it. The mistake is not the coding, it is failing to put the reduced payment in front of the patient before treatment.",
  instructorKey: [
    "The biller must know which teeth the plan treats as posterior before quoting any ceramic crown.",
    "Drill the distinction: a downgrade leaves money on the table for the patient; a denial removes it for the provider. They are handled differently.",
  ],
};

/* ======================================================================= */
/* SCENARIO 2 — EXCLUDED: implant + missing-tooth clause                   */
/* ======================================================================= */

const PRED_IMPLANT_EXCLUDED: PredeterminationScenario = {
  id: "PRED-02",
  title: "An implant the plan will not pay for — the missing-tooth clause",
  planId: "PLAN-CASCADIA-PPO",
  difficulty: "advanced",
  estimatedMinutes: 25,
  patient: {
    id: "PD-1002",
    firstName: "Elena",
    lastName: "Reyes",
    memberId: "CCH-2204-1188",
  },
  plannedTreatment:
    "Surgical placement of an implant body and an abutment-supported ceramic crown to replace the upper right first molar (#3).",
  shouldPredetermine: true,
  predeterminationRationale:
    "This plan limits an implant to what it would have paid toward a conventional bridge, and — more importantly — it carries an active missing-tooth clause. If #3 was extracted before coverage began, the benefit is removed entirely, no matter how the space is replaced.",
  estimateSummary:
    "The estimate comes back 'not covered'. The missing-tooth clause applies: tooth #3 was extracted before the member's coverage began, so the plan pays nothing toward replacing it — implant body and crown alike.",
  estimate: [
    {
      line: 1,
      code: "D6010",
      description: "Surgical placement of the implant body at #3",
      tooth: "3",
      chargedUsd: 2250,
      allowedUsd: 2250,
      planPaysUsd: 0,
      patientOwesUsd: 2250,
      writeOffUsd: 0,
      verdict: "excluded",
      denialId: "DEN-MISSING-TOOTH",
      note: "The missing-tooth clause removes the benefit for the replacement entirely. The implant's conventional-alternative limit never comes into play because the clause is applied first.",
    },
    {
      line: 2,
      code: "D6058",
      description: "Abutment-supported ceramic crown at #3",
      tooth: "3",
      chargedUsd: 1845,
      allowedUsd: 1845,
      planPaysUsd: 0,
      patientOwesUsd: 1845,
      writeOffUsd: 0,
      verdict: "excluded",
      denialId: "DEN-MISSING-TOOTH",
      note: "The crown is the replacement tooth, so the clause applies to it too — not just to the fixture.",
    },
  ],
  estimateTotals: { chargedUsd: 4095, allowedUsd: 4095, planPaysUsd: 0, patientOwesUsd: 4095, writeOffUsd: 0 },
  trap: {
    title: "Quoting the implant as if it were covered",
    mistake: "The student quotes the patient the implant fee minus a typical 50% coinsurance, without checking the missing-tooth clause or sending a predetermination.",
    consequence:
      "The patient commits to a $4,095 treatment believing insurance will cover half. The estimate shows nothing is covered, and the practice either eats the balance or breaks trust with the patient.",
    correctAction:
      "Ask for the extraction date at treatment planning, send a predetermination, and confirm the missing-tooth clause in writing before any surgery is scheduled.",
    producesDenialId: "DEN-MISSING-TOOTH",
  },
  teachingPoint:
    "The missing-tooth clause is the single most expensive surprise in dental RCM, and it is knowable before the patient is ever seated. The predetermination is the tool that surfaces it.",
  instructorKey: [
    "The clause applies to the whole replacement — bridge, partial, or implant — not just to one code.",
    "The extraction date is a registration question, not a claim-time question.",
  ],
};

/* ======================================================================= */
/* SCENARIO 3 — FREQUENCY-LIMITED: crown replacement inside five years     */
/* ======================================================================= */

const PRED_CROWN_FREQUENCY: PredeterminationScenario = {
  id: "PRED-03",
  title: "The second crown on the same tooth — frequency-limited",
  planId: "PLAN-CASCADIA-PPO",
  difficulty: "intermediate",
  estimatedMinutes: 20,
  patient: {
    id: "PD-1003",
    firstName: "David",
    lastName: "Okafor",
    memberId: "CCH-7755-0021",
  },
  plannedTreatment:
    "A new crown on the lower right first molar (#30), which was already crowned three years ago and has since fractured.",
  shouldPredetermine: true,
  predeterminationRationale:
    "The crown-replacement frequency on this plan is one crown per tooth per five years. The patient's history shows #30 was crowned three years ago, so the benefit for a replacement crown on that tooth is already used. This is knowable from the payer's history during eligibility — a predetermination makes it official.",
  estimateSummary:
    "The replacement crown is frequency-limited: the plan has already paid for a crown on #30 within the five-year window, so this one pays nothing.",
  estimate: [
    {
      line: 1,
      code: "D2740",
      description: "All-ceramic crown on #30 (replacement)",
      tooth: "30",
      chargedUsd: 1320,
      allowedUsd: 1100,
      planPaysUsd: 0,
      patientOwesUsd: 1100,
      writeOffUsd: 220,
      verdict: "frequency-limited",
      denialId: "DEN-FREQ-CROWN",
      note: "The plan pays one crown per tooth per five years. #30 was crowned three years ago, so the frequency is exhausted. The contracted write-off still applies in network; the patient owes the allowance.",
    },
  ],
  estimateTotals: { chargedUsd: 1320, allowedUsd: 1100, planPaysUsd: 0, patientOwesUsd: 1100, writeOffUsd: 220 },
  trap: {
    title: "Submitting the replacement crown without checking the frequency history",
    mistake: "The student assumes a crown is a covered Major service and submits directly, quoting the usual 50% coinsurance.",
    consequence:
      "The claim comes back denied for frequency. The patient owes the full allowance on a service they were told would be half-covered.",
    correctAction:
      "Check the payer's crown history during eligibility — or send a predetermination — before quoting. A first-time crown on a virgin tooth would have come back 'allowed' at 50%; a replacement inside five years will not.",
    producesDenialId: "DEN-FREQ-CROWN",
  },
  teachingPoint:
    "The frequency rule is per tooth and rolls from the last seat date, including a crown placed by a previous dentist. A clean first-time crown and a frequency-limited replacement look identical on the treatment plan — only the history tells them apart.",
  instructorKey: [
    "Contrast the two paths: a first-time crown on #30 returns 'allowed' at 50% (plan pays 550 of the 1100 allowance); a replacement inside five years returns 'frequency-limited' and pays nothing.",
    "The frequency question belongs at eligibility/check-in, not after the remittance arrives.",
  ],
};

/* ======================================================================= */
/* SCENARIO 4 — DOWNGRADED: a quadrant of posterior composites             */
/* ======================================================================= */
const PRED_QUADRANT_COMPOSITE_DOWNGRADE: PredeterminationScenario = {
  id: "PRED-04",
  title: "Three posterior composites that pay at the amalgam allowance",
  planId: "PLAN-CASCADIA-PPO",
  difficulty: "intermediate",
  estimatedMinutes: 20,
  patient: {
    id: "PD-1004",
    firstName: "Priya",
    lastName: "Nair",
    memberId: "CCH-6610-4402",
  },
  plannedTreatment:
    "Three two-surface tooth-coloured fillings across the upper right and lower left back teeth (#3, #4 and #19).",
  shouldPredetermine: true,
  predeterminationRationale:
    "The plan's alternate-benefit rule pays a posterior tooth-coloured filling at the silver (amalgam) allowance. Three downgrades on one treatment plan add up to a much larger patient share than the composite fee alone suggests, so the patient needs the written estimate before any tooth is prepared.",
  estimateSummary:
    "All three fillings are covered, but each is downgraded to the two-surface amalgam allowance of 180. The plan pays 80 percent of that; the difference between the composite and amalgam allowances is the patient's upgrade on every line.",
  estimate: [
    {
      line: 1,
      code: "D2392",
      description: "Two-surface tooth-coloured filling on #3",
      tooth: "3",
      chargedUsd: 248,
      allowedUsd: 210,
      paidAtAllowedUsd: 180,
      planPaysUsd: 144,
      patientOwesUsd: 66,
      writeOffUsd: 38,
      verdict: "downgraded",
      denialId: "DEN-ALT-BENEFIT",
      note: "The plan treats silver filling as adequate on a back tooth. It pays 80% of the 180 amalgam allowance (144); the patient owes the upgrade and coinsurance (66).",
    },
    {
      line: 2,
      code: "D2392",
      description: "Two-surface tooth-coloured filling on #4",
      tooth: "4",
      chargedUsd: 248,
      allowedUsd: 210,
      paidAtAllowedUsd: 180,
      planPaysUsd: 144,
      patientOwesUsd: 66,
      writeOffUsd: 38,
      verdict: "downgraded",
      denialId: "DEN-ALT-BENEFIT",
      note: "Same downgrade as line 1 — the alternate-benefit rule applies per tooth, so every posterior composite is reduced to the amalgam level.",
    },
    {
      line: 3,
      code: "D2392",
      description: "Two-surface tooth-coloured filling on #19",
      tooth: "19",
      chargedUsd: 248,
      allowedUsd: 210,
      paidAtAllowedUsd: 180,
      planPaysUsd: 144,
      patientOwesUsd: 66,
      writeOffUsd: 38,
      verdict: "downgraded",
      denialId: "DEN-ALT-BENEFIT",
      note: "A lower molar, so the same posterior downgrade applies. Three downgrades are a pattern, not three accidents.",
    },
  ],
  estimateTotals: { chargedUsd: 744, allowedUsd: 630, planPaysUsd: 432, patientOwesUsd: 198, writeOffUsd: 114 },
  trap: {
    title: "Presenting the composite fee as if it were the covered amount",
    mistake: "The student quotes the patient the composite fee with an 80 percent benefit, treating the composite as the covered service.",
    consequence:
      "The estimate shows the plan only ever pays against the amalgam allowance. Across three teeth the patient owes 198 dollars more than they were led to expect, and the practice absorbs the trust deficit.",
    correctAction:
      "Send a predetermination, show the patient the per-tooth downgrade, and offer the silver alternative at no upgrade — or get the composite upgrade acknowledged in writing.",
    producesDenialId: "DEN-ALT-BENEFIT",
  },
  teachingPoint:
    "An alternate-benefit downgrade is an adjustment, not a denial — and it compounds. Three downgraded fillings are still three covered services; they just pay at the level the plan deems adequate, and the upgrade is the patient's choice.",
  instructorKey: [
    "The downgrade applies per tooth and per surface. Do the arithmetic for every line, not once for the whole plan.",
    "Always present the amalgam option alongside the composite so the patient is choosing the upgrade, not discovering it.",
  ],
};

/* ======================================================================= */
/* SCENARIO 5 — MIXED: a molar rebuild with endo, build-up and crown       */
/* ======================================================================= */
const PRED_MOLAR_REBUILD: PredeterminationScenario = {
  id: "PRED-05",
  title: "A molar rebuild: root canal, build-up and crown",
  planId: "PLAN-CASCADIA-PPO",
  difficulty: "advanced",
  estimatedMinutes: 25,
  patient: {
    id: "PD-1005",
    firstName: "Tomás",
    lastName: "Vera",
    memberId: "CCH-8812-0054",
  },
  plannedTreatment:
    "A full reconstruction of the lower right first molar (#30): a root canal, a core build-up, and an all-ceramic crown.",
  shouldPredetermine: true,
  predeterminationRationale:
    "This is a three-service Major plan where two lines pay cleanly at 50 percent but the crown is downgraded to the base-metal allowance. A predetermination separates the covered portion from the ceramic upgrade so the patient signs for the real total before treatment starts.",
  estimateSummary:
    "The root canal and build-up pay at 50 percent of their allowances. The crown is downgraded to the base-metal allowance and pays 50 percent of that; the ceramic difference is the patient's upgrade.",
  estimate: [
    {
      line: 1,
      code: "D3330",
      description: "Root canal on a back tooth (#30)",
      tooth: "30",
      chargedUsd: 1285,
      allowedUsd: 1150,
      planPaysUsd: 575,
      patientOwesUsd: 575,
      writeOffUsd: 135,
      verdict: "allowed",
      note: "Paid at 50 percent of the allowance (Major). The clinical note and radiograph support the treatment, so the endo is not downcoded.",
    },
    {
      line: 2,
      code: "D2950",
      description: "Core build-up on #30",
      tooth: "30",
      chargedUsd: 288,
      allowedUsd: 240,
      planPaysUsd: 120,
      patientOwesUsd: 120,
      writeOffUsd: 48,
      verdict: "allowed",
      note: "Paid at 50 percent of the allowance (Major). The narrative and radiograph keep the build-up from being bundled into the crown.",
    },
    {
      line: 3,
      code: "D2740",
      description: "All-ceramic crown on #30 (posterior)",
      tooth: "30",
      chargedUsd: 1320,
      allowedUsd: 1100,
      paidAtAllowedUsd: 980,
      planPaysUsd: 490,
      patientOwesUsd: 610,
      writeOffUsd: 220,
      verdict: "downgraded",
      denialId: "DEN-ALT-BENEFIT",
      note: "Downgraded to the base-metal allowance on a back tooth. The plan pays 50 percent of 980 (490); the ceramic upgrade and the coinsurance are the patient's.",
    },
  ],
  estimateTotals: { chargedUsd: 2893, allowedUsd: 2490, planPaysUsd: 1185, patientOwesUsd: 1305, writeOffUsd: 403 },
  trap: {
    title: "Quoting the whole rebuild at 50 percent of the full fee",
    mistake: "The student treats all three lines as clean Major services and quotes 50 percent of each full fee.",
    consequence:
      "The crown pays at the metal allowance, not the ceramic fee. The patient owes the ceramic upgrade on top of the 50 percent they were quoted, and the written estimate did not prepare them for it.",
    correctAction:
      "Send a predetermination so each line's verdict is in writing, then present the metal-versus-ceramic choice before the crown is fabricated.",
    producesDenialId: "DEN-ALT-BENEFIT",
  },
  teachingPoint:
    "A treatment plan can mix clean and downgraded lines. The estimate must break each service out separately — a single blended percentage hides the one line (the crown) where the plan pays a lower allowance.",
  instructorKey: [
    "Contrast the clean endo and build-up (50 percent of their own allowances) with the downgraded crown (50 percent of the metal allowance).",
    "Teach students to read an estimate line by line, not as a single bottom-line number.",
  ],
};

export const PREDETERMINATION_SCENARIOS: PredeterminationScenario[] = [
  PRED_CERAMIC_CROWN_DOWNGRADE,
  PRED_IMPLANT_EXCLUDED,
  PRED_CROWN_FREQUENCY,
  PRED_QUADRANT_COMPOSITE_DOWNGRADE,
  PRED_MOLAR_REBUILD,
];

export const PREDETERMINATION_SCENARIO_INDEX: Record<string, PredeterminationScenario> =
  Object.fromEntries(PREDETERMINATION_SCENARIOS.map((s) => [s.id, s]));

export function findPredeterminationScenario(id: string): PredeterminationScenario | undefined {
  return PREDETERMINATION_SCENARIO_INDEX[id];
}

export function predeterminationScenariosByVerdict(
  verdict: PredeterminationVerdict,
): PredeterminationScenario[] {
  return PREDETERMINATION_SCENARIOS.filter((s) =>
    s.estimate.some((line) => line.verdict === verdict),
  );
}
