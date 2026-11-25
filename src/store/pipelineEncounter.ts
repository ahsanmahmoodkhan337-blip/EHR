/**
 * Pipeline Encounter Model — one encounter per patient
 *
 * Inspiration: Epic's encounter record and DrChrono's per-patient chart — a
 * patient's note, codes, claim and stage belong to that patient's encounter,
 * not to whichever chart happens to be open.
 *
 * `pipelineStore` keeps a map of these keyed by patient id plus the id of the
 * patient being worked on. This module holds the shapes and the factories so
 * both the store and the persistence layer can build/normalise them without a
 * circular import.
 */

import { normalizeVitalsList, type RecordedVitals } from "../domain/vitalsRecord";
import {
  ENCOUNTER_OPENING_STEP,
  ENCOUNTER_STEPS,
  encounterStepIndex,
  furthestEncounterStep,
} from "../domain/encounterSteps";
import {
  EMPTY_NOTE_FIELDS,
  compileNoteText,
  noteFieldsHaveText,
  normalizeNoteFields,
  parseNoteText,
  type NoteFields,
} from "../domain/noteStatus";
import type { ClaimType } from "../data/claims/claimType";
import type { ClaimHold, ClaimStatus, JobRole } from "../domain/claimStatus";
import type { StatusEvent } from "../domain/statusEvent";
import type { Remittance835 } from "../domain/adjudication";
import type { LedgerEntry } from "../domain/ledger";
import type { ArItemState } from "../domain/arWorkQueue";

// ─── Types ────────────────────────────────────────────────────────

export type Role = "scribe" | "coder" | "biller" | "prior-auth" | "ar-voice";

// ─── The scribe's chart steps ──────────────────────────────────────

/**
 * The chart's own steps, in the order a visit is documented. The order itself
 * lives in one pure module, `domain/encounterSteps.ts`, and is re-exported here
 * because this is the record that a saved encounter's `chartStage` carries.
 *
 * Spec `encounter-continuity.md` (owner, 2026-11-20) supersedes
 * `start-at-scribing.md`: a patient opens on **step 1, Registration**, and the
 * chart walks forward one step at a time. `resumeChartStep` is gone — a chart no
 * longer opens wherever the student last was.
 *
 * The ids are what a saved encounter's `chartStage` carries, so a step is added
 * or reworded — never renumbered or renamed.
 */
export const CHART_STEPS: readonly { id: string; label: string }[] = ENCOUNTER_STEPS;

/** The step every patient opens on: Registration, step 1. */
export const CHART_OPENING_STEP = ENCOUNTER_OPENING_STEP;

/** How far into the chart a step is; -1 for an id this build does not know. */
export function chartStepRank(id: string | null | undefined): number {
  return encounterStepIndex(id);
}

/**
 * The later of two chart steps — how "furthest reached" advances. Never
 * backwards, so going Back to Registration does not forget the note work the
 * student had already done.
 */
export function furthestChartStep(a: string | null | undefined, b: string): string {
  return furthestEncounterStep(a, b);
}

export type PipelineStatus =
  | "charted"
  | "coded"
  | "billed"
  | "paid"
  | "denied"
  | "reprocessed"
  | "pending";

/**
 * One row of box 24 on the CMS-1500 (02/12).
 * The spec's field names are kept as-is; the printed box each one feeds is in
 * the comment, because that is how the form and its validation talk.
 */
export interface ClaimServiceLine {
  dateOfService: string;   // 24A
  placeOfService: string;  // 24B
  /** Box 24C — "Y" or blank. Blank is the normal state; a demo Y would declare an emergency. */
  emg?: string;            // 24C
  cpt: string;             // 24D
  modifiers: string[];     // 24D
  diagnosisPointer: string;// 24E  e.g. "A" or "AB"
  charge: number;          // 24F
  units: number;           // 24G — DAYS OR UNITS
  /** Box 24H — EPSDT / family-plan code. Blank by default: it asserts a referral. */
  epsdt?: string;          // 24H
  /** Box 24I — qualifier for 24J. "XX" (NPI) on every line this app builds. */
  idQualifier?: string;    // 24I
  renderingNpi: string;    // 24J
  /**
   * UB-04 locator 42 — the revenue code: which hospital department earned the
   * money. Blank until the line is worked; nothing guesses it from the CPT.
   */
  revenueCode?: string;    // UB-04 42
  /**
   * UB-04 locator 48 — the part of this line's charge the payer does not cover.
   * Zero is the normal state; it is never derived from a denial.
   */
  nonCovered?: number;     // UB-04 48
}

/**
 * The structured CMS-1500 claim record — every printed box, keyed by the box
 * number in the comment. Sits alongside the legacy `claimData` string map so
 * nothing that reads that map breaks.
 */
export interface ClaimFormData {
  /**
   * Which paper this claim is submitted on — professional (CMS-1500),
   * institutional (UB-04) or dental (ADA). Suggested from the encounter's place
   * of service and persisted with the claim, so reopening it shows the same
   * paper. See `src/data/claims/claimType.ts`.
   */
  claimType: ClaimType;
  /**
   * True once the identity boxes (1a, 2, 3, 4, 5, 6, 7, 26) have been seeded
   * from the encounter's patient. Claims persisted by an earlier build carry
   * `undefined`, so they get seeded once on the next open — and a box the
   * student clears afterwards stays cleared instead of being refilled.
   */
  identitySeeded?: boolean;
  /**
   * The patient fingerprint the identity boxes were last seeded from — see
   * `identitySeedFor` in `utils/claimAutoFill.ts`. When the encounter's patient
   * changes, or that patient's demographics / insurance record change, the
   * fingerprint differs and the identity boxes are re-seeded. A one-shot
   * `identitySeeded` flag froze the claim on whatever was known the first time
   * it opened, which is why a patient the student registered themselves never
   * reached the paper.
   */
  identitySeedKey?: string;
  /** The values this claim was seeded with, so a typed value is never overwritten. */
  identitySeedValues?: Record<string, string>;
  insuranceType: string;        // 1
  insuredId: string;            // 1a
  patientName: string;          // 2
  patientDob: string;           // 3
  patientSex: string;           // 3
  insuredName: string;          // 4
  patientAddress: string;       // 5
  patientRelationship: string;  // 6
  insuredAddress: string;       // 7
  otherInsuranceName: string;   // 9
  /** Box 9a — the other insured's policy or group number. */
  otherInsuredPolicyGroup: string; // 9a
  /** Box 9b — the other insured's date of birth and sex. */
  otherInsuredDob: string;      // 9b
  otherInsuredSex: string;      // 9b
  /**
   * Box 9d — INSURANCE PLAN NAME OR PROGRAM NAME of the other coverage.
   *
   * This key used to hold `planName · groupNumber` joined together, under the
   * label 9a. The group number now has its own box (9a) and this is the plan
   * name only; a saved claim is split on load by the v6 → v7 migration.
   */
  otherInsurancePlan: string;   // 9d
  /**
   * Box 9c — EMPLOYER'S OR SCHOOL'S NAME, inside the other-insured block.
   *
   * The key keeps its old name so a value a student typed into box 11b under
   * the previous build is carried forward verbatim: 11b was labelled
   * "OTHER CLAIM ID / EMPLOYER" and this field has always meant the employer,
   * so the stored value now prints where the 02/12 prints it (9c) instead of
   * being dropped.
   */
  insuredEmployer: string;      // 9c
  conditionEmployment: boolean; // 10a
  conditionAuto: boolean;       // 10b
  conditionOther: boolean;      // 10c
  /**
   * Box 10d — CLAIM CODES (Designated by NUCC). Typed by the biller only when
   * the payer requires attachment codes; no upstream stage fills it and it has
   * no demo value, because a fabricated claim code declares an attachment that
   * does not exist.
   */
  claimCodes: string;           // 10d
  insuredPolicyGroup: string;   // 11
  insuredDob: string;           // 11a
  /** Box 11a — the insured's sex, printed beside the insured's date of birth. */
  insuredSex: string;           // 11a
  /** Box 11b — OTHER CLAIM ID (ID). Not the employer; that is 9c. */
  otherClaimId: string;         // 11b
  insuredPlanName: string;      // 11c
  otherBenefitPlan: string;     // 11d
  /** Box 8 — PATIENT STATUS. The 02/12 prints five checkboxes, any of which may apply. */
  patientStatusSingle: boolean;          // 8
  patientStatusMarried: boolean;         // 8
  patientStatusEmployed: boolean;        // 8
  patientStatusFullTimeStudent: boolean; // 8
  patientStatusPartTimeStudent: boolean; // 8
  /**
   * Payer name and EDI payer ID from the patient's insurance record. The
   * CMS-1500 has no box for either (11c carries the plan name), but the UB-04
   * prints them in boxes 50 and 51 — carried on the claim now so the
   * institutional paper reads the same coverage record the professional paper
   * does.
   */
  payerName: string;            // UB-04 50
  payerEdiId: string;           // UB-04 51
  patientSignature: boolean;    // 12
  insuredSignature: boolean;    // 13
  currentIllnessDate: string;   // 14
  /** Box 15 — the `QUAL.` qualifier for the other date. A date with no qualifier is invalid. */
  similarIllnessQualifier: string; // 15
  similarIllnessDate: string;   // 15
  unableToWorkFrom: string;     // 16
  unableToWorkTo: string;       // 16
  referringProvider: string;    // 17
  /** Box 17a — OTHER ID #: the qualifier/other-ID box, not the NPI. */
  referringOtherId: string;     // 17a
  referringNpi: string;         // 17b
  hospitalizationFrom: string;  // 18
  hospitalizationTo: string;    // 18
  additionalInfo: string;       // 19
  outsideLab: string;           // 20
  diagnosisCodes: string[];     // 21, A–L (12 slots)
  resubmissionCode: string;     // 22
  /**
   * Box 22 — `ORIGINAL REF. NO.`, printed beneath the resubmission code in the
   * same cell. The key is unchanged so a saved value survives the 22a removal.
   */
  originalClaimNumber: string;  // 22
  priorAuthNumber: string;      // 23
  serviceLines: ClaimServiceLine[]; // 24A–24J, max 6
  federalTaxId: string;         // 25
  /** Box 25 — whether `federalTaxId` is an EIN or an SSN. A payer rejects the box with no indicator. */
  federalTaxIdType: string;     // 25
  patientAccountNumber: string; // 26
  acceptAssignment: string;     // 27
  totalCharge: number;          // 28
  amountPaid: number;           // 29
  /**
   * @deprecated Box 30 on the 02/12 is `R.S. AMOUNT` — shaded and reserved, with
   * no data. Nothing prints this any more, and no autofill writes it. It is kept
   * only so a claim saved by an earlier build keeps the value it held instead of
   * losing it on load. A patient's balance is summed from the ledger
   * (`domain/ledger.ts`), never from a claim box.
   */
  balanceDue: number;           // 30 — reserved on the 02/12, no longer printed
  providerSignature: string;    // 31
  providerSignatureDate: string;// 31
  facilityName: string;         // 32
  facilityAddress: string;      // 32
  facilityNpi: string;          // 32
  billingProviderName: string;  // 33
  billingProviderAddress: string; // 33
  billingProviderNpi: string;   // 33
  billingProviderTaxId: string; // 33

  // ─── UB-04 (CMS-1450) locators ────────────────────────────────────
  // The institutional paper has its own box numbers. They live on the same
  // claim record, so a claim that switches paper keeps the patient, the codes
  // and the money it already holds. A box nothing captured stays "" — the
  // paper prints the caption and names the stage that supplies it.
  /** Locator 3b — the hospital's own medical record number. */
  medicalRecordNumber: string;      // UB-04 3b
  /** Locator 4 — 3 digits (facility · care type · frequency). Derived from the POS. */
  typeOfBill: string;               // UB-04 4
  /** Locator 6 — STATEMENT COVERS PERIOD, from / through. */
  statementFrom: string;            // UB-04 6
  statementThrough: string;         // UB-04 6
  /** Locator 7 — covered days. Blank on a single-date outpatient bill. */
  coveredDays: number;              // UB-04 7
  admissionDate: string;            // UB-04 12
  admissionHour: string;            // UB-04 13
  admissionType: string;            // UB-04 14
  /** Locator 15 — SRC, source of admission. */
  admissionSource: string;          // UB-04 15
  /** Locator 16 — DHR, discharge hour. */
  dischargeHour: string;            // UB-04 16
  patientStatus: string;            // UB-04 17
  /** Locators 18–28 — condition codes, space-separated. */
  conditionCodes: string;           // UB-04 18–28
  accidentState: string;            // UB-04 29
  /** Locators 31–34 — occurrence codes and dates. */
  occurrenceCodes: string;          // UB-04 31–34
  /** Locators 35–36 — occurrence span code and dates. */
  occurrenceSpan: string;           // UB-04 35–36
  responsibleParty: string;         // UB-04 38
  /** Locators 39–41 — value codes and amounts. */
  valueCodes: string;               // UB-04 39–41
  /** Locator 52 — release of information, row A. */
  releaseOfInformation: string;     // UB-04 52
  /** Locator 53 — assignment of benefits, row A. */
  assignmentOfBenefits: string;     // UB-04 53
  priorPayments: number;            // UB-04 54
  estimatedAmountDue: number;       // UB-04 55
  otherProviderIdQualifier: string; // UB-04 57
  otherProviderId: string;          // UB-04 57
  insuredGroupName: string;         // UB-04 61
  insuranceGroupNumber: string;     // UB-04 62
  /** Locator 63 — the payer's treatment authorisation code (row A). */
  treatmentAuthorizationCode: string; // UB-04 63
  /** Locator 64 — the payer's ICN/DCN for a replaced or voided claim. */
  documentControlNumber: string;    // UB-04 64
  /** Locator 66 — diagnosis coding method: "0" is ICD-10-CM. */
  diagnosisVersion: string;         // UB-04 66
  principalDiagnosis: string;       // UB-04 67
  otherDiagnoses: string;           // UB-04 67A–67Q
  admittingDiagnosis: string;       // UB-04 69
  patientReasonVisit: string;       // UB-04 70
  ppsCode: string;                  // UB-04 71
  /** Locator 72 — ECI, external cause of injury. */
  eciCode: string;                  // UB-04 72
  principalProcedureCode: string;   // UB-04 73
  principalProcedureDate: string;   // UB-04 73
  principalProcedureQualifier: string; // UB-04 73
  otherProcedureCode: string;       // UB-04 74
  otherProcedureDate: string;       // UB-04 74
  attendingNpi: string;             // UB-04 76
  attendingQualifier: string;       // UB-04 76
  attendingLastName: string;        // UB-04 76
  attendingFirstName: string;       // UB-04 76
  operatingProviderNpi: string;     // UB-04 77
  otherProviderNpi: string;         // UB-04 78
  otherProviderNpi2: string;        // UB-04 79
  remarks: string;                  // UB-04 80
  codeCodeA: string;                // UB-04 81
  codeCodeB: string;                // UB-04 81
  codeCodeC: string;                // UB-04 81
  codeCodeD: string;                // UB-04 81
}

/**
 * One patient's encounter — everything the pipeline captures about them.
 * Stored per patient, so switching chart loads this instead of wiping it.
 */
export interface PipelineEncounter {
  patientId: string | null;
  displayName: string | null;  // override for custom/new patients from calendar
  stage: Role | "complete";
  /**
   * The furthest step of the visit (`CHART_STEPS`) this student has reached on
   * this patient, or null while they have not moved off step 1. Navigation
   * memory only — it is never read as chart content and it never decides where a
   * chart opens (`specs/encounter-continuity.md`: a chart always opens on step 1,
   * Registration). A record saved before it existed keeps null rather than
   * inventing a step.
   */
  chartStage: string | null;
  status: PipelineStatus;
  /**
   * **The note** — the one record the whole app reads. Four SOAP sections,
   * written only by `noteStatus`-aware writers: the Progress Note stages
   * (`writeNoteFor`), Charts (`writeNoteFor`) and Sign & Lock (`signNote`).
   * Nothing else may hold a copy of this text.
   *
   * A record saved by an earlier build carries no `noteFields`; the text in
   * `scribeNote` is parsed into these four sections on load, verbatim, and never
   * rewritten on the way in (`normalizeEncounter`).
   */
  noteFields: NoteFields;
  /**
   * The note's text form, compiled from `noteFields`. Kept on the record because
   * a signed note prints as one block and an older build saved only this. It is
   * derived: `noteFields` is the source, and a migrated record's original text is
   * carried forward unchanged until the student edits it.
   */
  scribeNote: string;
  /** When the note's text last changed. Null until the student types something. */
  noteUpdatedAt: string | null;
  icdCodes: string[];
  cptCodes: string[];
  claimData: Record<string, string>;
  /** Structured CMS-1500 record (box-by-box). Null until the claim is opened. */
  claimForm: ClaimFormData | null;
  /** Per-line coding data handed over by the Coder stage (seeds box 24). */
  codingLines: ClaimServiceLine[];
  denialInfo: { code: string; reason: string; amount: number } | null;
  paData: Record<string, string>;
  /** The role the student last worked this patient in — restored on a switch. */
  role: Role;
  /**
   * The claim number, minted the moment this encounter's claim is created and
   * never re-minted. Null while the encounter has no claim at all.
   */
  claimNumber: string | null;
  /** Where the claim stands (`domain/claimStatus`). Null while there is no claim. */
  claimStatus: ClaimStatus | null;
  /**
   * True when `claimStatus` came from a v3 blob rather than a recorded
   * transition — no 835 backs it, and no money was invented for it.
   */
  claimStatusMigrated: boolean;
  /** Holds are an attribute, not a state (status-engine.md §2). */
  holds: ClaimHold[];
  /**
   * The append-only timeline for this encounter and its claim. Written only
   * through `appendStatusEvent` in the store — never edited, never removed.
   */
  statusEvents: StatusEvent[];
  /**
   * The 835s this encounter's claim received from the payer. One per claim in
   * this build; `postedAt` on a remittance is what says the money reached the
   * ledger (`domain/adjudication.ts`).
   */
  remittances: Remittance835[];
  /**
   * The patient ledger: every posted charge, insurance payment, adjustment,
   * patient payment, refund and transfer, append-only
   * (`domain/ledger.ts`). The balances are summed from here, never stored.
   */
  ledger: LedgerEntry[];
  /**
   * What the student has done to each AR work-queue item on this claim
   * (`domain/arWorkQueue.ts`). The queue itself is derived from the posted 835
   * and the ledger; only the work done on an item is stored, so a resolved item
   * can never disagree with the money. v6.
   */
  arItems: ArItemState[];
  /**
   * The version of the Tutorial Patient's worked example written onto this
   * encounter (`domain/tutorialEncounter.ts`), or null for a chart that is the
   * student's own work. It is the seed's guard: the example is written once, and
   * a second open — or a later rebuild — never overwrites the chart. Null on every
   * encounter except the Tutorial Patient's.
   */
  tutorialSeed: string | null;
  /**
   * The vitals flowsheet: every set Save Vitals recorded on this encounter,
   * oldest first (`domain/vitalsRecord.ts`). The latest set feeds the summary
   * sidebar, the note and the sign checklist. Additive: a record saved before
   * it existed loads with an empty list — no vitals are invented for it.
   */
  vitals: RecordedVitals[];
}

/**
 * What `usePipeline().state` hands a component: the active patient's encounter
 * plus the one global setting that is not patient data.
 */
export interface PipelineState extends PipelineEncounter {
  /**
   * `demoFillMissingBoxes` — owner decision 2026-11-20. When on (the default) a
   * claim box with no captured value renders the teaching demo value from
   * `src/data/claims/demoClaimData.ts`, grey italic and tagged. An instructor or
   * exam mode switches it off so assessment claims show only what the student
   * captured. Never written back onto the claim.
   */
  demoFillMissingBoxes: boolean;
}

/** The whole store: every patient's encounter plus the one being worked on. */
export interface PipelineStoreState {
  activePatientId: string | null;
  encounters: Record<string, PipelineEncounter>;
  /** Global instructor / exam switch — not per patient. */
  demoFillMissingBoxes: boolean;
  /** Role used while no patient is active (role switcher before a pick). */
  currentRole: Role;
}

// ─── Factories ─────────────────────────────────────────────────────

/**
 * Key used for an encounter with no patient attached (a custom calendar entry,
 * or work handed over before a patient was picked). Keeping it in the map means
 * that work is never dropped — and never shown under a real patient.
 */
export const UNASSIGNED_ENCOUNTER_KEY = "__unassigned";

/** Map key for a patient id (null → the unassigned bucket). */
export function encounterKey(patientId: string | null | undefined): string {
  return patientId || UNASSIGNED_ENCOUNTER_KEY;
}

/**
 * The role a pipeline stage belongs to. The stage is the durable record of how
 * far the student got; the role is the screen that shows it. A finished
 * pipeline was last worked by the AR Voice specialist, so `complete` maps back
 * there.
 */
export function roleForStage(stage: PipelineEncounter["stage"]): Role {
  return stage === "complete" ? "ar-voice" : stage;
}

/**
 * The role to open a patient's encounter on. The stored role is used when the
 * student chose one explicitly; otherwise the stage says where the work got to,
 * so a patient worked to the Biller reopens on the Biller and never on Scribe.
 */
export function restoredRoleFor(encounter: PipelineEncounter): Role {
  return encounter.role && encounter.role !== "scribe"
    ? encounter.role
    : roleForStage(encounter.stage);
}

/** A brand-new, empty encounter — a patient never visited starts here. */
export function createEncounter(patientId: string | null): PipelineEncounter {
  return {
    patientId,
    displayName: null,
    stage: "scribe",
    chartStage: null,
    status: "pending",
    noteFields: { ...EMPTY_NOTE_FIELDS },
    scribeNote: "",
    noteUpdatedAt: null,
    icdCodes: [],
    cptCodes: [],
    claimData: {},
    claimForm: null,
    codingLines: [],
    denialInfo: null,
    paData: {},
    role: "scribe",
    claimNumber: null,
    claimStatus: null,
    claimStatusMigrated: false,
    holds: [],
    statusEvents: [],
    remittances: [],
    ledger: [],
    arItems: [],
    vitals: [],
    tutorialSeed: null,
  };
}

/** The blank encounter returned when nothing is active. */
export const EMPTY_ENCOUNTER: PipelineEncounter = createEncounter(null);

/**
 * v7 — **one note**. A record saved before this build holds its note as text
 * only (`scribeNote`, written by Sign & Lock or by the old note drafts); it is
 * parsed into the four SOAP sections and its text is carried forward **verbatim**,
 * because it is the student's own note and a migration invents nothing.
 *
 * A record saved with sections has its text recompiled from them, so the record
 * can never print one thing and hold another.
 */
function normalizeNote(
  raw: Partial<PipelineEncounter>,
): { noteFields: NoteFields; scribeNote: string; noteUpdatedAt: string | null } {
  const savedText = typeof raw.scribeNote === "string" ? raw.scribeNote : "";
  const noteUpdatedAt = typeof raw.noteUpdatedAt === "string" ? raw.noteUpdatedAt : null;
  const savedFields = raw.noteFields ? normalizeNoteFields(raw.noteFields) : null;

  if (savedFields && noteFieldsHaveText(savedFields)) {
    return { noteFields: savedFields, scribeNote: compileNoteText(savedFields), noteUpdatedAt };
  }
  if (!savedText.trim()) {
    return { noteFields: { ...EMPTY_NOTE_FIELDS }, scribeNote: "", noteUpdatedAt };
  }
  // Old shape (or sections that somehow lost their text): parse what was saved,
  // and keep the saved text exactly as it was.
  return { noteFields: parseNoteText(savedText), scribeNote: savedText, noteUpdatedAt };
}

/** Fill in anything a stored encounter from an older build is missing. */
export function normalizeEncounter(
  raw: Partial<PipelineEncounter> | null | undefined,
  patientId: string | null,
): PipelineEncounter {
  const base = createEncounter(patientId);
  if (!raw || typeof raw !== "object") return base;
  return {
    ...base,
    ...raw,
    ...normalizeNote(raw),
    patientId: raw.patientId ?? patientId,
    icdCodes: Array.isArray(raw.icdCodes) ? raw.icdCodes : [],
    cptCodes: Array.isArray(raw.cptCodes) ? raw.cptCodes : [],
    codingLines: Array.isArray(raw.codingLines) ? raw.codingLines : [],
    claimData: raw.claimData && typeof raw.claimData === "object" ? raw.claimData : {},
    paData: raw.paData && typeof raw.paData === "object" ? raw.paData : {},
    role: raw.role ?? roleForStage(raw.stage ?? base.stage),
    stage: raw.stage ?? base.stage,
    // The chart's remembered step. A record saved before the encounter kept it
    // keeps null. It no longer decides where the chart opens — every patient
    // opens on step 1 (`specs/encounter-continuity.md`) — so nothing is invented
    // for work the student may not have done.
    chartStage: typeof raw.chartStage === "string" ? raw.chartStage : null,
    status: raw.status ?? base.status,
    claimNumber: raw.claimNumber ?? base.claimNumber,
    claimStatus: raw.claimStatus ?? base.claimStatus,
    claimStatusMigrated: raw.claimStatusMigrated === true,
    holds: Array.isArray(raw.holds) ? raw.holds : [],
    statusEvents: Array.isArray(raw.statusEvents) ? raw.statusEvents : [],
    // v5 (money cycle slice 2). A record saved before the ledger existed keeps
    // an empty ledger and an empty remittance list: no money is invented for it,
    // and the claim's status is carried forward exactly as it was stored.
    remittances: Array.isArray(raw.remittances) ? raw.remittances : [],
    ledger: Array.isArray(raw.ledger) ? raw.ledger : [],
    // v6 (money cycle slice 3). A record saved before the AR work queue existed
    // starts with no item worked: the queue is derived from the 835 and the
    // ledger, so nothing is invented for it and no money moves on its own.
    arItems: Array.isArray(raw.arItems) ? raw.arItems : [],
    // A record saved before the Tutorial Patient's worked example existed carries
    // no seed key, so it reads as "never seeded" — which is what it is.
    tutorialSeed: typeof raw.tutorialSeed === "string" ? raw.tutorialSeed : null,
    vitals: normalizeVitalsList(raw.vitals),
  };
}

/**
 * The id a status event names for this patient's encounter. The pipeline keys an
 * encounter by its patient, so the patient id *is* the encounter's identity; the
 * unassigned bucket (work with no chart attached) keeps its own id.
 */
export function encounterEventId(patientId: string | null | undefined): string {
  return patientId || "unassigned";
}

/** The status-engine role that matches a pipeline role. */
export function jobRoleFor(role: Role | "complete"): JobRole {
  return role === "complete" ? "ar-voice" : role;
}

/**
 * Bring any persisted shape up to the current one.
 * - the new shape (`encounters`) is normalised encounter by encounter;
 * - a legacy single-encounter pipeline becomes the encounter of the patient it
 *   carries, so a student mid-workflow keeps their place.
 */
export function normalizePipelineStore(
  raw: unknown,
  fallbackRole: Role = "scribe",
): PipelineStoreState {
  const empty: PipelineStoreState = {
    activePatientId: null,
    encounters: {},
    demoFillMissingBoxes: true,
    currentRole: fallbackRole,
  };
  if (!raw || typeof raw !== "object") return empty;
  const value = raw as Partial<PipelineStoreState> & Partial<PipelineEncounter>;

  if (value.encounters && typeof value.encounters === "object") {
    const encounters: Record<string, PipelineEncounter> = {};
    for (const [key, enc] of Object.entries(value.encounters)) {
      const patientId = (enc as PipelineEncounter)?.patientId ?? (key === UNASSIGNED_ENCOUNTER_KEY ? null : key);
      encounters[key] = normalizeEncounter(enc as Partial<PipelineEncounter>, patientId);
    }
    const activePatientId = value.activePatientId ?? null;
    const active = encounters[encounterKey(activePatientId)];
    // The active patient's own encounter decides the stage being shown; a
    // `currentRole` saved from another chart must not override it.
    const activeRole = active ? restoredRoleFor(active) : null;
    return {
      activePatientId,
      encounters,
      demoFillMissingBoxes: value.demoFillMissingBoxes !== false,
      currentRole: activeRole ?? value.currentRole ?? fallbackRole,
    };
  }

  // Legacy single-encounter pipeline.
  const patientId = (value.patientId as string | null | undefined) ?? null;
  const key = encounterKey(patientId);
  const encounter = normalizeEncounter(value as Partial<PipelineEncounter>, patientId);
  return {
    activePatientId: patientId,
    encounters: { [key]: encounter },
    demoFillMissingBoxes: value.demoFillMissingBoxes !== false,
    currentRole: value.currentRole ?? encounter.role ?? fallbackRole,
  };
}

/** True when this encounter holds work worth keeping (i.e. not a blank chart). */
export function encounterHasWork(enc: PipelineEncounter | undefined | null): boolean {
  if (!enc) return false;
  return Boolean(
    noteFieldsHaveText(enc.noteFields) ||
    enc.scribeNote ||
    enc.icdCodes.length ||
    enc.cptCodes.length ||
    enc.claimForm ||
    enc.codingLines.length ||
    enc.ledger.length ||
    enc.remittances.length ||
    Object.keys(enc.claimData).length ||
    Object.keys(enc.paData).length ||
    enc.stage !== "scribe" ||
    enc.status !== "pending",
  );
}
