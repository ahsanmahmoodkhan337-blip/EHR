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

import type { ClaimType } from "../data/claims/claimType";
import type { ClaimHold, ClaimStatus, JobRole } from "../domain/claimStatus";
import type { StatusEvent } from "../domain/statusEvent";

// ─── Types ────────────────────────────────────────────────────────

export type Role = "scribe" | "coder" | "biller" | "prior-auth" | "ar-voice";

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
  cpt: string;             // 24D
  modifiers: string[];     // 24D
  diagnosisPointer: string;// 24E  e.g. "A" or "AB"
  charge: number;          // 24F
  units: number;           // 24G
  renderingNpi: string;    // 24J
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
  otherInsurancePlan: string;   // 9a
  conditionEmployment: boolean; // 10a
  conditionAuto: boolean;       // 10b
  conditionOther: boolean;      // 10c
  insuredPolicyGroup: string;   // 11
  insuredDob: string;           // 11a
  insuredEmployer: string;      // 11b
  insuredPlanName: string;      // 11c
  otherBenefitPlan: string;     // 11d
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
  similarIllnessDate: string;   // 15
  unableToWorkFrom: string;     // 16
  unableToWorkTo: string;       // 16
  referringProvider: string;    // 17
  referringNpi: string;         // 17b
  hospitalizationFrom: string;  // 18
  hospitalizationTo: string;    // 18
  additionalInfo: string;       // 19
  outsideLab: string;           // 20
  diagnosisCodes: string[];     // 21, A–L (12 slots)
  resubmissionCode: string;     // 22
  originalClaimNumber: string;  // 22a
  priorAuthNumber: string;      // 23
  serviceLines: ClaimServiceLine[]; // 24A–24J, max 6
  federalTaxId: string;         // 25
  patientAccountNumber: string; // 26
  acceptAssignment: string;     // 27
  totalCharge: number;          // 28
  amountPaid: number;           // 29
  balanceDue: number;           // 30
  providerSignature: string;    // 31
  providerSignatureDate: string;// 31
  facilityName: string;         // 32
  facilityAddress: string;      // 32
  facilityNpi: string;          // 32
  billingProviderName: string;  // 33
  billingProviderAddress: string; // 33
  billingProviderNpi: string;   // 33
  billingProviderTaxId: string; // 33
}

/**
 * One patient's encounter — everything the pipeline captures about them.
 * Stored per patient, so switching chart loads this instead of wiping it.
 */
export interface PipelineEncounter {
  patientId: string | null;
  displayName: string | null;  // override for custom/new patients from calendar
  stage: Role | "complete";
  status: PipelineStatus;
  scribeNote: string;
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
    status: "pending",
    scribeNote: "",
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
  };
}

/** The blank encounter returned when nothing is active. */
export const EMPTY_ENCOUNTER: PipelineEncounter = createEncounter(null);

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
    patientId: raw.patientId ?? patientId,
    icdCodes: Array.isArray(raw.icdCodes) ? raw.icdCodes : [],
    cptCodes: Array.isArray(raw.cptCodes) ? raw.cptCodes : [],
    codingLines: Array.isArray(raw.codingLines) ? raw.codingLines : [],
    claimData: raw.claimData && typeof raw.claimData === "object" ? raw.claimData : {},
    paData: raw.paData && typeof raw.paData === "object" ? raw.paData : {},
    role: raw.role ?? roleForStage(raw.stage ?? base.stage),
    stage: raw.stage ?? base.stage,
    status: raw.status ?? base.status,
    claimNumber: raw.claimNumber ?? base.claimNumber,
    claimStatus: raw.claimStatus ?? base.claimStatus,
    claimStatusMigrated: raw.claimStatusMigrated === true,
    holds: Array.isArray(raw.holds) ? raw.holds : [],
    statusEvents: Array.isArray(raw.statusEvents) ? raw.statusEvents : [],
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
    enc.scribeNote ||
    enc.icdCodes.length ||
    enc.cptCodes.length ||
    enc.claimForm ||
    enc.codingLines.length ||
    Object.keys(enc.claimData).length ||
    Object.keys(enc.paData).length ||
    enc.stage !== "scribe" ||
    enc.status !== "pending",
  );
}
