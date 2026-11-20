/**
 * Dental AR practice bench — premade AR scenarios
 *
 * Inspired by: the AR work-queue training benches real billing schools run
 * beside their production system — a pool of ready-made denials a student can
 * work without having to code and submit a claim first.
 *
 * Every scenario here is a claim that has ALREADY been adjudicated: the denied
 * lines, their CARC/group codes and their money are the remittance the student
 * would receive. The bench renders `components/dental/DentalAR.tsx` against
 * these lines, so the AR workspace, the per-line actions and the call log are
 * the same code path the graded cases use.
 *
 * HOW THE DENIALS ARE PRODUCED
 * - Where the real engine can reach the denial (frequency, age cap, exclusion)
 *   the scenario seeds only the coded lines and `adjudicateDentalClaim` decides
 *   — see `adjudicatePracticeScenario()` in `components/dental/adjudication.ts`.
 * - Where the engine has no step for it (documentation, surface coding,
 *   coordination of benefits, timely filing) the line carries `seedDenialId`,
 *   which takes precedence over the engine's own result. The engine still runs,
 *   so every other rule it knows is still applied to the other lines.
 *
 * RULE 6
 * `lines[].key` is the answer key. It is never rendered until the student has
 * committed that line — the picker and the working card show only the facts of
 * the remittance and what the scenario practises, never the action to take.
 *
 * All payers, patients, claim numbers and fees are fictional (STANDING-RULES 1).
 */

import type { CasePatient, DentalAdjudicationContext } from "./caseScenarios";
import { findDenial, type DentalAppealOutcome, type DentalDenial } from "./denialReasons";
import type { CarcGroup } from "../claims/carc";

/** The six per-line actions the AR workspace offers, plus "not handled". */
export type PracticeLineResolution =
  | "not-handled"
  | "appealed"
  | "resubmitted"
  | "billed-patient"
  | "write-off"
  | "closed";

/** One coded line on the claim, with the answer key held beside it. */
export interface DentalPracticeLine {
  id: string;
  code: string;
  tooth?: string;
  surfaces?: string;
  quadrant?: "00" | "01" | "02" | "03" | "04" | "10" | "20";
  dateOfService: string;
  /** Practice's charged fee. Illustrative. */
  feeUsd: number;
  /** Contracted allowance the payer priced the line at. Illustrative. */
  allowedUsd: number;
  /**
   * A denial the engine has no step for. Takes precedence over the engine's
   * own result for this line.
   */
  seedDenialId?: string;
  /**
   * Money the remittance shows that the group-code rule alone cannot express —
   * used once, by DAR-03, where the unpaid allowance is held under appeal
   * rather than written off.
   */
  writeOffUsdOverride?: number;
  /**
   * The answer key — carried only by a denied line, and never rendered before
   * that line is committed.
   */
  key?: PracticeLineKey;
}

export interface PracticeLineKey {
  /** The one correct action for this line. */
  resolution: PracticeLineResolution;
  /** True where the payer will not decide without a call note on this line. */
  requiresCallNote?: boolean;
  /** Any one of these phrases, in the call note, satisfies the note criterion. */
  noteMustMention?: string[];
  /** Why that is the right action — shown only after the commit. */
  why: string;
  /** The habit the scenario teaches — shown only after the commit. */
  lesson: string;
  /**
   * Money the remittance neither pays nor writes off (an appeal in progress).
   * Shown only after the commit, and never labelled a write-off.
   */
  disputedUsd?: number;
}

export interface DentalARPracticeScenario {
  id: string;
  title: string;
  /** What the student practises — a denial category, never the action. */
  whatYouWillPractise: string;
  /** Fictional payer, from `benefitRules.ts`. */
  payerName: string;
  planId: string;
  /** Date of service on the claim. */
  dos: string;
  /** The claim number on the remittance (fictional). */
  claimNumber: string;
  /** The background a biller would have in front of them. Carries no answer. */
  brief: string;
  /** What a call to this payer has to establish. Shown when the call connects. */
  callObjectives: string[];
  lines: DentalPracticeLine[];
  /** Plan, coverage patient and contracted allowances — fed to the adjudicator. */
  context: PracticeAdjudicationContext;
}

/**
 * The adjudicator's input, built without a graded case: plan, coverage patient,
 * the eligibility snapshot and the contracted allowances by code. A practice
 * scenario authors no per-line expected result, so `expectedOutcome` is empty.
 */
export type PracticeAdjudicationContext = DentalAdjudicationContext;

/* ------------------------------------------------------------------ */
/* The money rule — one table                                          */
/* ------------------------------------------------------------------ */

/**
 * Who carries the money on a denied line, from the group code alone.
 *
 * **Owner ruling (2026-11-20): frequency-limit and age-limit denials are
 * contractual (CO) write-offs with a patient balance of 0 — "same as medical".
 * Timely-filing and documentation denials are CO on this data set too. A COB
 * return (OA) moves no money at all: the claim is re-routed to the other payer.
 * Only PR leaves a balance with the patient.**
 *
 * This switch is the whole split. Changing a ruling means changing one branch
 * here, and the bench follows.
 */
export function practiceMoneyForGroup(
  groupCode: CarcGroup,
  chargedUsd: number,
  allowedUsd: number,
): { patientOwesUsd: number; writeOffUsd: number } {
  if (groupCode === "PR") {
    // Patient responsibility: the patient owes what the plan did not pay.
    return { patientOwesUsd: allowedUsd, writeOffUsd: 0 };
  }
  if (groupCode === "OA") {
    // Another payer's share under coordination of benefits: re-routed, so
    // neither the patient nor the practice carries it.
    return { patientOwesUsd: 0, writeOffUsd: 0 };
  }
  // CO (and anything else contractual): the practice absorbs the whole charge.
  return { patientOwesUsd: 0, writeOffUsd: chargedUsd };
}

/** The money a denied practice line shows on the AR card. */
export function practiceMoneyForLine(
  line: DentalPracticeLine,
  denial: DentalDenial,
): { chargedUsd: number; allowedUsd: number; planPaysUsd: number; patientOwesUsd: number; writeOffUsd: number } {
  const rule = practiceMoneyForGroup(denial.groupCode, line.feeUsd, line.allowedUsd);
  return {
    chargedUsd: line.feeUsd,
    allowedUsd: line.allowedUsd,
    planPaysUsd: 0,
    patientOwesUsd: rule.patientOwesUsd,
    writeOffUsd: line.writeOffUsdOverride ?? rule.writeOffUsd,
  };
}

/* ------------------------------------------------------------------ */
/* Scoring                                                            */
/* ------------------------------------------------------------------ */

export interface PracticeLineScore {
  /** True only when the action and the call note both match the key. */
  correct: boolean;
  expected: PracticeLineResolution;
  noteRequired: boolean;
  noteSatisfied: boolean;
  /** What the note had to establish, where one was required. */
  noteHint?: string;
  why: string;
  lesson: string;
  disputedUsd?: number;
}

/**
 * Score one committed line. Called only after the student commits, and its
 * result is the only place the key reaches the screen.
 *
 * `appealOutcome` is optional and additive: where a line's appeal came back
 * **upheld** the appeal counts as paid, and where it came back **denied** a
 * contractual write-off counts exactly as a clean write-off does. The final
 * action still decides — an appeal outcome can never turn a wrong action right
 * (billing the patient stays wrong however the appeal ended).
 */
export function scorePracticeLine(
  scenario: DentalARPracticeScenario,
  lineId: string,
  resolution: PracticeLineResolution,
  callNotes: { lineId?: string; note: string }[],
  appealOutcome?: DentalAppealOutcome,
): PracticeLineScore | null {
  const line = scenario.lines.find((l) => l.id === lineId);
  if (!line?.key) return null;
  const key = line.key;
  const notesForLine = callNotes.filter((n) => n.lineId === lineId).map((n) => n.note.toLowerCase());
  const noteText = notesForLine.join(" ");
  const noteRequired = Boolean(key.requiresCallNote);
  const noteSatisfied = !noteRequired
    ? true
    : key.noteMustMention && key.noteMustMention.length > 0
      ? key.noteMustMention.some((phrase) => noteText.includes(phrase.toLowerCase()))
      : noteText.trim().length > 0;
  /**
   * The two endings of an appeal, scored as the outcome they produced: an upheld
   * appeal is the line paying, and a denied appeal followed by the write-off is
   * the write-off. Both are compared against the key's own action.
   */
  const appealConfirms =
    (appealOutcome === "upheld" && resolution === "appealed" && key.resolution === "appealed") ||
    (appealOutcome === "denied" && resolution === "write-off" && key.resolution === "write-off");
  return {
    correct: (resolution === key.resolution || appealConfirms) && noteSatisfied,
    expected: key.resolution,
    noteRequired,
    noteSatisfied,
    noteHint: noteRequired ? `The call note had to state ${notePhraseList(key.noteMustMention)}.` : undefined,
    why: key.why,
    lesson: key.lesson,
    disputedUsd: key.disputedUsd,
  };
}

function notePhraseList(phrases: string[] | undefined): string {
  if (!phrases || phrases.length === 0) return "what the call established";
  return phrases.map((p) => `"${p}"`).join(" or ");
}

/* ------------------------------------------------------------------ */
/* Scenario builder                                                   */
/* ------------------------------------------------------------------ */

function patient(args: {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  ageAtServiceDate: number;
  gender: string;
  memberId: string;
  coverageEffectiveDate: string;
  monthsCoveredAtServiceDate: number;
  subscriberName?: string;
  relationshipToSubscriber?: "self" | "spouse" | "child";
}): CasePatient {
  return {
    id: args.id,
    firstName: args.firstName,
    lastName: args.lastName,
    dateOfBirth: args.dateOfBirth,
    ageAtServiceDate: args.ageAtServiceDate,
    gender: args.gender,
    phone: "(555) 0100-000",
    address: "Fictional address, Riverbend, ST 00000",
    subscriberName: args.subscriberName ?? `${args.lastName}, ${args.firstName} (self)`,
    relationshipToSubscriber: args.relationshipToSubscriber ?? "self",
    memberId: args.memberId,
    coverageEffectiveDate: args.coverageEffectiveDate,
    monthsCoveredAtServiceDate: args.monthsCoveredAtServiceDate,
  };
}

function contextFor(args: {
  planId: string;
  patient: CasePatient;
  lines: DentalPracticeLine[];
  paidHistory?: DentalAdjudicationContext["eligibilitySnapshot"]["paidHistory"];
  deductibleMetUsd?: number;
  remainingAnnualMaximumUsd?: number | null;
  status: string;
  representativeNotes: string[];
}): PracticeAdjudicationContext {
  return {
    planId: args.planId,
    patient: args.patient,
    eligibilitySnapshot: {
      status: args.status,
      remainingAnnualMaximumUsd: args.remainingAnnualMaximumUsd ?? null,
      deductibleMetUsd: args.deductibleMetUsd ?? 0,
      paidHistory: args.paidHistory ?? [],
      representativeNotes: args.representativeNotes,
    },
    expectedOutcome: [],
    allowedByCode: Object.fromEntries(args.lines.map((l) => [l.code, l.allowedUsd])),
  };
}

/* ------------------------------------------------------------------ */
/* The seven scenarios                                                */
/* ------------------------------------------------------------------ */

/** DAR-01 — a bitewing set eight months after the payer bought the last one. */
const DAR_01: DentalARPracticeScenario = (() => {
  const lines: DentalPracticeLine[] = [
    {
      id: "DAR-01-L1",
      code: "D0120",
      dateOfService: "2027-03-04",
      feeUsd: 62,
      allowedUsd: 58,
    },
    {
      id: "DAR-01-L2",
      code: "D0274",
      tooth: undefined,
      dateOfService: "2027-03-04",
      feeUsd: 74,
      allowedUsd: 68,
      key: {
        resolution: "write-off",
        why: "CO-119 is a frequency limit: the plan caps how often it buys bitewings, so the unpaid allowance is a contractual write-off. The whole 74.00 charge comes off the account — the patient owes nothing for a benefit the plan limits.",
        lesson:
          "The frequency clock follows the patient, not this practice's chart: the payer's own paid history holds D0274 on 2026-06-12 at another practice, and the rolling 12-month window makes that eight months ago. A DHMO's \"no annual maximum\" is not \"no frequency limits\".",
      },
    },
    {
      id: "DAR-01-L3",
      code: "D1110",
      dateOfService: "2027-03-04",
      feeUsd: 108,
      allowedUsd: 95,
    },
  ];
  return {
    id: "DAR-01",
    title: "Bitewings nine months after the last set",
    whatYouWillPractise: "A frequency limitation — a bitewing set the payer already bought this year",
    payerName: "Meridian Smile Choice",
    planId: "PLAN-MERIDIAN-DHMO",
    dos: "2027-03-04",
    claimNumber: "MSC-2027-004128",
    brief:
      "A recall visit on a copay plan. The cleanings and the exam paid; the bitewings did not. The payer's paid history lists a bitewing set taken at another practice while the member was travelling, and the plan's limitation window runs from that date.",
    callObjectives: [
      "Ask the payer for the exact date of the last paid bitewing set and the code that was paid.",
      "Ask whether the limitation is counted from the last service date or from the benefit year.",
      "Ask what the plan does when the images were clinically needed inside the window.",
    ],
    lines,
    context: contextFor({
      planId: "PLAN-MERIDIAN-DHMO",
      patient: patient({
        id: "DPT-7001",
        firstName: "Nadeem",
        lastName: "Sadiq",
        dateOfBirth: "1990-05-02",
        ageAtServiceDate: 36,
        gender: "Male",
        memberId: "MSC771209045",
        coverageEffectiveDate: "2023-04-01",
        monthsCoveredAtServiceDate: 47,
      }),
      lines,
      paidHistory: [
        {
          code: "D0274",
          date: "2026-06-12",
          note: "Bitewing set taken at another practice while the member was travelling.",
        },
      ],
      status: "Active. Assigned to this office; copay plan with no annual maximum.",
      representativeNotes: [
        "Paid history includes services at another practice — the frequency clock follows the patient, not this chart.",
        "This plan pays a fixed copay per code and has no annual maximum.",
      ],
    }),
  };
})();

/** DAR-02 — fluoride on a patient past the plan's age cap. */
const DAR_02: DentalARPracticeScenario = (() => {
  const lines: DentalPracticeLine[] = [
    {
      id: "DAR-02-L1",
      code: "D1110",
      dateOfService: "2027-01-19",
      feeUsd: 108,
      allowedUsd: 95,
    },
    {
      id: "DAR-02-L2",
      code: "D1206",
      dateOfService: "2027-01-19",
      feeUsd: 44,
      allowedUsd: 40,
      key: {
        resolution: "write-off",
        why: "CO-6 is an age limit: the plan funds fluoride to a stated age and this patient is past it, so the line is a contractual write-off. The whole 44.00 charge comes off the account and the patient owes nothing.",
        lesson:
          "\"Preventive pays 100%\" is not \"free\": the percentage only applies to services the plan covers at all. Age is tested on the date of service — a birthday between two appointments changes the answer, and resubmitting the same claim changes nothing.",
      },
    },
    {
      id: "DAR-02-L3",
      code: "D0274",
      dateOfService: "2027-01-19",
      feeUsd: 74,
      allowedUsd: 68,
    },
  ];
  return {
    id: "DAR-02",
    title: "Fluoride on a patient past the age cap",
    whatYouWillPractise: "An age limitation — a preventive service the plan stops funding at a stated age",
    payerName: "Cascadia Dental Guard",
    planId: "PLAN-CASCADIA-PPO",
    dos: "2027-01-19",
    claimNumber: "CASC-2027-006842",
    brief:
      "A seventeen-year-old at a six-month recall. The cleaning and the bitewings paid at the preventive percentage; the fluoride did not. The plan document states an age limit for this benefit, and the patient's date of birth on file matches the payer's record.",
    callObjectives: [
      "Confirm the date of birth the payer holds, so a wrong birth date is ruled out before anything else.",
      "Ask the age the benefit runs to, and whether it is inclusive of that birthday.",
      "Ask whether the plan tests age on the date of service or on the claim received date.",
    ],
    lines,
    context: contextFor({
      planId: "PLAN-CASCADIA-PPO",
      patient: patient({
        id: "DPT-7002",
        firstName: "Bilal",
        lastName: "Riaz",
        dateOfBirth: "2010-01-05",
        ageAtServiceDate: 17,
        gender: "Male",
        memberId: "CDG442901877",
        coverageEffectiveDate: "2024-12-01",
        monthsCoveredAtServiceDate: 25,
        subscriberName: "Riaz, Farah (mother)",
        relationshipToSubscriber: "child",
      }),
      lines,
      remainingAnnualMaximumUsd: 1500,
      status: "Active. Dependent child, preventive services at 100%.",
      representativeNotes: [
        "Date of birth on file matches the payer record.",
        "The plan pays preventive services at 100% — that is not the same as paying every preventive service.",
      ],
    }),
  };
})();

/** DAR-03 — a deep cleaning sent without its chart. */
const DAR_03: DentalARPracticeScenario = (() => {
  const lines: DentalPracticeLine[] = [
    {
      id: "DAR-03-L1",
      code: "D0150",
      dateOfService: "2027-02-23",
      feeUsd: 108,
      allowedUsd: 100,
    },
    {
      id: "DAR-03-L2",
      code: "D4341",
      quadrant: "01",
      dateOfService: "2027-02-23",
      feeUsd: 312,
      allowedUsd: 290,
      seedDenialId: "DEN-MED-NEC",
      // The unpaid allowance is held under appeal, not written off — so only
      // the 22.00 contractual difference leaves the account today.
      writeOffUsdOverride: 22,
      key: {
        resolution: "appealed",
        why: "CO-50 says the payer's consultant did not see enough to agree the treatment was needed — the chart, the radiographs and a dated narrative are what answer that. Appeal in writing, addressing the payer's own criterion, and keep the 290.00 unpaid allowance in dispute rather than writing it off.",
        lesson:
          "A denial under appeal is not a write-off, and writing it off because it looks unwinnable gives away money the plan may still owe. A winning appeal can still leave the patient owing: if it pays, the plan pays 192.00 and the patient owes 98.00 (the 50.00 deductible plus coinsurance), with 30.00 written off as contractual.",
        disputedUsd: 290,
      },
    },
  ];
  return {
    id: "DAR-03",
    title: "Deep cleaning sent without its chart",
    whatYouWillPractise: "A documentation denial — a periodontal service the payer could not see the need for",
    payerName: "Cascadia Dental Guard",
    planId: "PLAN-CASCADIA-PPO",
    dos: "2027-02-23",
    claimNumber: "CASC-2027-006977",
    brief:
      "A new-patient exam and one quadrant of scaling and root planing. The exam paid. The periodontal line came back denied: the claim left without the pocket chart and without a narrative, and the payer's criteria for this service ask for both. The chart exists in the record — 5 to 6 mm on four or more teeth in that quadrant, with radiographs.",
    callObjectives: [
      "Ask which clinical criteria the payer applies to this service, and what evidence they accept for each.",
      "Ask what the payer needs in front of it before it will look at this line again, and in what form.",
      "Ask what happens to the unpaid allowance while a review is open.",
    ],
    lines,
    context: contextFor({
      planId: "PLAN-CASCADIA-PPO",
      patient: patient({
        id: "DPT-7003",
        firstName: "Tariq",
        lastName: "Mehmood",
        dateOfBirth: "1974-07-19",
        ageAtServiceDate: 52,
        gender: "Male",
        memberId: "CDG559120438",
        coverageEffectiveDate: "2024-09-01",
        monthsCoveredAtServiceDate: 29,
      }),
      lines,
      remainingAnnualMaximumUsd: 1500,
      status: "Active. Major services payable after twelve months of continuous coverage.",
      representativeNotes: [
        "Twelve-month major waiting period satisfied — the patient has 29 months of continuous coverage.",
        "The clinical record holds the pocket chart and the radiographs the payer's criteria ask for.",
      ],
    }),
  };
})();

/** DAR-04 — a filling whose surfaces do not match the code. */
const DAR_04: DentalARPracticeScenario = (() => {
  const lines: DentalPracticeLine[] = [
    {
      id: "DAR-04-L1",
      code: "D2392",
      tooth: "19",
      surfaces: "MOD",
      dateOfService: "2027-03-30",
      feeUsd: 248,
      allowedUsd: 235,
      seedDenialId: "DEN-SURFACE-MISMATCH",
      key: {
        resolution: "resubmitted",
        why: "CO-4 on this remittance means the surfaces reported are not consistent with the procedure code or the tooth submitted — the claim lists three surfaces (MOD) against a two-surface code, while the clinical note says two (MO). Correct the surfaces on the claim to match the note and resubmit it as a corrected claim.",
        lesson:
          "Never change the code to a three-surface code (D2393) so the surfaces fit the money — the note drives the code, and that step is the line between a billing correction and fraud. Never appeal a coding error either: the payer is not disputing coverage. Corrected, this line still meets the plan's alternate-benefit downgrade, so the plan pays 124.00 against the 205.00 benchmark and the patient owes 111.00 (50.00 deductible, 31.00 coinsurance, 30.00 upgrade).",
      },
    },
    {
      id: "DAR-04-L2",
      code: "D0272",
      dateOfService: "2027-03-30",
      feeUsd: 46,
      allowedUsd: 42,
    },
  ];
  return {
    id: "DAR-04",
    title: "A filling whose surfaces don't match the code",
    whatYouWillPractise: "A coding denial — surfaces on the claim that the clinical note does not support",
    payerName: "Cascadia Dental Guard",
    planId: "PLAN-CASCADIA-PPO",
    dos: "2027-03-30",
    claimNumber: "CASC-2027-007260",
    brief:
      "A two-surface composite on a lower molar, with two bitewings on the same visit. The bitewings paid; the restoration was denied. The claim as submitted lists three surfaces on a two-surface code, and the clinical note records two surfaces.",
    callObjectives: [
      "Read the remark and confirm exactly which field the payer is disputing.",
      "Ask what the payer needs to see for this line to be reconsidered.",
      "Ask what the plan pays toward this code on a clean line.",
    ],
    lines,
    context: contextFor({
      planId: "PLAN-CASCADIA-PPO",
      patient: patient({
        id: "DPT-7004",
        firstName: "Sana",
        lastName: "Iqbal",
        dateOfBirth: "1992-10-08",
        ageAtServiceDate: 34,
        gender: "Female",
        memberId: "CDG661209774",
        coverageEffectiveDate: "2025-05-01",
        monthsCoveredAtServiceDate: 22,
      }),
      lines,
      remainingAnnualMaximumUsd: 1500,
      status: "Active. Basic services at 80% after the deductible.",
      representativeNotes: [
        "The clinical note records two surfaces on tooth 19; the claim as submitted lists three.",
        "This plan downgrades a posterior composite to the amalgam allowance for the same number of surfaces.",
      ],
    }),
  };
})();

/** DAR-05 — an implant on a plan that excludes implants. */
const DAR_05: DentalARPracticeScenario = (() => {
  const lines: DentalPracticeLine[] = [
    {
      id: "DAR-05-L1",
      code: "D6010",
      tooth: "30",
      dateOfService: "2027-02-05",
      feeUsd: 2250,
      allowedUsd: 2250,
      key: {
        resolution: "closed",
        requiresCallNote: true,
        noteMustMention: ["4,095", "4095"],
        why: "PR-204 is an exclusion, and the group code PR puts the money on the patient: the plan does not sell this benefit at any level, so there is no clinical argument that makes it covered. Close the line and tell the patient plainly that the 4,095.00 balance is theirs.",
        lesson:
          "The group code decides who pays, not the size of the denial. A four-figure denial is not a write-off just because it arrived on a remittance — and a plan exclusion is not an appeal. Confirm the exclusion against the plan's own list, quote the patient before treatment next time, and say the number out loud on the account.",
      },
    },
    {
      id: "DAR-05-L2",
      code: "D6058",
      tooth: "30",
      dateOfService: "2027-02-05",
      feeUsd: 1845,
      allowedUsd: 1845,
      key: {
        resolution: "closed",
        requiresCallNote: true,
        noteMustMention: ["4,095", "4095"],
        why: "Same exclusion, same group code: PR-204 leaves the 1,845.00 abutment charge with the patient. Close it and include it in the balance the patient is told about.",
        lesson:
          "Both lines of one exclusion carry the same answer, and the patient is told one number for the claim, not one number per line.",
      },
    },
  ];
  return {
    id: "DAR-05",
    title: "An implant on a plan that excludes implants",
    whatYouWillPractise: "A non-covered service — an exclusion on a plan that does not sell the benefit",
    payerName: "Northwind Union Dental Trust",
    planId: "PLAN-NORTHWIND-TRUST",
    dos: "2027-02-05",
    claimNumber: "NWT-2027-003310",
    brief:
      "An implant and its abutment on a lower molar, on a self-funded trust plan. Both lines came back with the same reason code and the same group code. The plan's own summary of benefits lists implants and implant-supported restorations as not covered.",
    callObjectives: [
      "Confirm from the plan's summary of benefits that this is an exclusion and not a documentation request.",
      "Ask whether any exception exists, so the answer can be given to the patient with confidence.",
      "Establish the exact balance that moves to the patient, for the whole claim.",
    ],
    lines,
    context: contextFor({
      planId: "PLAN-NORTHWIND-TRUST",
      patient: patient({
        id: "DPT-7005",
        firstName: "Marcus",
        lastName: "Delaney",
        dateOfBirth: "1982-06-11",
        ageAtServiceDate: 44,
        gender: "Male",
        memberId: "NWT889013672",
        coverageEffectiveDate: "2025-08-01",
        monthsCoveredAtServiceDate: 18,
      }),
      lines,
      remainingAnnualMaximumUsd: 2500,
      status: "Active. Implant services excluded by the plan design.",
      representativeNotes: [
        "The trust's summary of benefits lists implant placement and implant-supported restorations as not covered.",
        "No predetermination was requested before surgery.",
      ],
    }),
  };
})();

/** DAR-06 — two plans, one child, claim sent to the wrong one. */
const DAR_06: DentalARPracticeScenario = (() => {
  const cobKey = (line: string): PracticeLineKey => ({
    resolution: "resubmitted",
    why: `OA-22 is not a denial of the service and not a write-off: the payer is telling you it is the secondary plan and wants the primary's payment first. ${line} is re-routed, not lost — nothing is billable to the patient and nothing leaves the account.`,
    lesson:
      "The birthday rule decides, not the household: the father's date of birth (14 March) falls earlier in the calendar year than the mother's (2 September), so his Northwind plan is primary and this Cascadia claim was sent to the secondary first. Billing the parent the child lives with, or the plan that was easiest to find, can burn the primary's filing window.",
  });
  const lines: DentalPracticeLine[] = [
    {
      id: "DAR-06-L1",
      code: "D1120",
      dateOfService: "2027-01-27",
      feeUsd: 82,
      allowedUsd: 76,
      seedDenialId: "DEN-COB-PRIMARY",
      key: cobKey("This child cleaning"),
    },
    {
      id: "DAR-06-L2",
      code: "D0274",
      dateOfService: "2027-01-27",
      feeUsd: 74,
      allowedUsd: 68,
      seedDenialId: "DEN-COB-PRIMARY",
      key: cobKey("This bitewing set"),
    },
  ];
  return {
    id: "DAR-06",
    title: "Two plans, one child, claim sent to the wrong one",
    whatYouWillPractise: "Coordination of benefits — one child covered by two plans, and a claim in the wrong order",
    payerName: "Cascadia Dental Guard",
    planId: "PLAN-CASCADIA-PPO",
    dos: "2027-01-27",
    claimNumber: "CASC-2027-006910",
    brief:
      "A nine-year-old child cleaning and bitewing set, billed to the mother's Cascadia plan. The child is also covered by the father's Northwind Union Dental Trust plan. The father's date of birth is 14 March; the mother's is 2 September. Both lines came back on the same reason code and the same group code.",
    callObjectives: [
      "Ask the payer to state, on the record, which plan it considers primary for this child and why.",
      "Confirm the birthday rule applies to this dependent and how each plan counts it.",
      "Ask how long the primary's filing window runs, so the re-routed claim is not lost twice.",
    ],
    lines,
    context: contextFor({
      planId: "PLAN-CASCADIA-PPO",
      patient: patient({
        id: "DPT-7006",
        firstName: "Ellie",
        lastName: "Marsh",
        dateOfBirth: "2018-03-22",
        ageAtServiceDate: 8,
        gender: "Female",
        memberId: "CDG220418905",
        coverageEffectiveDate: "2026-06-01",
        monthsCoveredAtServiceDate: 7,
        subscriberName: "Marsh, Priya (mother)",
        relationshipToSubscriber: "child",
      }),
      lines,
      remainingAnnualMaximumUsd: 1500,
      status: "Active. Dependent child; another plan also covers this patient.",
      representativeNotes: [
        "Two plans on file: the mother's Cascadia plan and the father's Northwind Union Dental Trust plan.",
        "Father's date of birth 14 March; mother's date of birth 2 September.",
        "The child lives with the mother, which is not what decides the order of benefits.",
      ],
    }),
  };
})();

/** DAR-07 — a crown that sat in a rejection queue for seven months. */
const DAR_07: DentalARPracticeScenario = (() => {
  const lines: DentalPracticeLine[] = [
    {
      id: "DAR-07-L1",
      code: "D2740",
      tooth: "8",
      dateOfService: "2026-03-18",
      feeUsd: 1320,
      allowedUsd: 1100,
      seedDenialId: "DEN-TIMELY-FILING",
      key: {
        resolution: "write-off",
        requiresCallNote: true,
        noteMustMention: ["clearinghouse", "timely", "original"],
        why: "CO-29 is a timely-filing denial, and it is the one denial with a hard expiry date. Check the clearinghouse for proof of a timely original submission first — there is none here, the claim sat in an unworked rejection queue — then write the line off as a practice write-off. The 1,320.00 charge comes off the account and is not billed to the patient.",
        lesson:
          "The payer's limit is 90 days from the date of service and this claim was submitted on 2026-11-02, seven months later. Billing the patient because \"the insurance didn't pay\", or appealing with no proof of timely filing, teaches the wrong habit twice over. The real question is why the claim aged seven months — work rejections within days, not months.",
      },
    },
    {
      id: "DAR-07-L2",
      code: "D2950",
      tooth: "8",
      dateOfService: "2026-03-18",
      feeUsd: 288,
      allowedUsd: 240,
      seedDenialId: "DEN-TIMELY-FILING",
      key: {
        resolution: "write-off",
        requiresCallNote: true,
        noteMustMention: ["clearinghouse", "timely", "original"],
        why: "The same timely-filing denial covers the buildup on the same claim: CO-29, practice write-off, patient balance zero.",
        lesson: "One late claim takes every line on it down together, whatever each line would have paid.",
      },
    },
  ];
  return {
    id: "DAR-07",
    title: "A crown that sat in a rejection queue for seven months",
    whatYouWillPractise: "A timely-filing denial — a claim that arrived after the payer's deadline",
    payerName: "Cascadia Dental Guard",
    planId: "PLAN-CASCADIA-PPO",
    dos: "2026-03-18",
    claimNumber: "CASC-2026-002914",
    brief:
      "A ceramic crown and its buildup on an upper anterior tooth, on a plan with a 90-day filing limit. The claim was submitted on 2026-11-02, seven months after the date of service. The rejection queue shows the claim was never worked — there is no evidence of an earlier submission anywhere.",
    callObjectives: [
      "Ask the payer for the date the claim was received and the date the filing limit ran from.",
      "Ask what proof of timely filing they accept, and whether a clearinghouse report would count.",
      "Ask whether any exception to the filing limit applies here.",
    ],
    lines,
    context: contextFor({
      planId: "PLAN-CASCADIA-PPO",
      patient: patient({
        id: "DPT-7007",
        firstName: "Owen",
        lastName: "Pike",
        dateOfBirth: "1965-04-30",
        ageAtServiceDate: 60,
        gender: "Male",
        memberId: "CDG773901255",
        coverageEffectiveDate: "2023-11-01",
        monthsCoveredAtServiceDate: 28,
      }),
      lines,
      remainingAnnualMaximumUsd: 1500,
      status: "Active. Major services payable after twelve months of continuous coverage.",
      representativeNotes: [
        "The payer's filing limit is 90 days from the date of service — a payer fact, stated on the plan's provider page.",
        "The claim was submitted on 2026-11-02 for a 2026-03-18 date of service.",
        "No clearinghouse acceptance report exists for this claim.",
      ],
    }),
  };
})();

export const DENTAL_AR_PRACTICE_SCENARIOS: DentalARPracticeScenario[] = [
  DAR_01,
  DAR_02,
  DAR_03,
  DAR_04,
  DAR_05,
  DAR_06,
  DAR_07,
];

export const DENTAL_AR_PRACTICE_INDEX: Record<string, DentalARPracticeScenario> = Object.fromEntries(
  DENTAL_AR_PRACTICE_SCENARIOS.map((s) => [s.id, s]),
);

export function findPracticeScenario(id: string | null | undefined): DentalARPracticeScenario | undefined {
  return id ? DENTAL_AR_PRACTICE_INDEX[id] : undefined;
}

/** The denial a seeded line carries, where it carries one. */
export function practiceSeedDenial(line: DentalPracticeLine): DentalDenial | undefined {
  return line.seedDenialId ? findDenial(line.seedDenialId) : undefined;
}

/** A practice line in the shape the coder's claim lines take. */
export interface PracticeClaimLine {
  id: string;
  code: string;
  tooth?: string;
  surfaces?: string;
  quadrant?: string;
  dateOfService: string;
  feeUsd: number;
  predeterminationOnFile: boolean;
  attachments: string[];
}

export function practiceClaimLines(scenario: DentalARPracticeScenario): PracticeClaimLine[] {
  return scenario.lines.map((l) => ({
    id: l.id,
    code: l.code,
    ...(l.tooth ? { tooth: l.tooth } : {}),
    ...(l.surfaces ? { surfaces: l.surfaces } : {}),
    ...(l.quadrant ? { quadrant: l.quadrant } : {}),
    dateOfService: l.dateOfService,
    feeUsd: l.feeUsd,
    predeterminationOnFile: false,
    attachments: [],
  }));
}
