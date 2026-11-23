/**
 * Pipeline Store — RCM Pipeline State (React Context)
 *
 * Tracks the full RCM pipeline for each patient encounter through 5 stages:
 *   [Charted] → [Coded] → [Billed (Bill)] → [Prior Auth] → [Paid/Denied/Reprocessed]
 *
 * Roles: Scribe, Coder, Biller, Prior Auth, AR Voice Specialist
 *
 * Inspiration: Epic's encounter list — one encounter per patient, with the
 * active encounter explicit. Every stage and every document (note, codes,
 * claim, prior auth, denial) is stored with the patient it belongs to, so
 * picking a patient loads their work and picking another never wipes it.
 *
 * Submission functions auto-advance the active patient's stage. The AR Voice
 * Specialist role handles denied claims with aging buckets and call resolution;
 * its ledger and worklists are legitimately multi-patient, so they stay global.
 */

import { createContext, useContext, useState, useEffect, useMemo, useRef, type ReactNode } from "react";
import { getLoggedInPhone } from "./accessStore";
import { loadUserData, saveUserData, syncUserDataFromSupabase } from "./persistence";
import { registerResetHandler } from "./resetData";
import {
  createEncounter,
  encounterEventId,
  encounterHasWork,
  encounterKey,
  EMPTY_ENCOUNTER,
  UNASSIGNED_ENCOUNTER_KEY,
  furthestChartStep,
  jobRoleFor,
  normalizePipelineStore,
  restoredRoleFor,
  type ClaimFormData,
  type ClaimServiceLine,
  type PipelineEncounter,
  type PipelineState,
  type PipelineStoreState,
  type Role,
} from "./pipelineEncounter";
import {
  claimStatusForRemittance,
  type ClaimStatus,
  type ReasonCode,
} from "../domain/claimStatus";
import { mintNextClaimNumber } from "./claimSequence";
import { encounterIdFor, scopingRefusal } from "../domain/dataScoping";
import { resolveEncounterPatientId } from "../utils/encounterPatient";
import { buildSubmissionEvents } from "../domain/clearinghouse";
import { signNote } from "../domain/signNote";
import {
  applyTutorialSeed,
  tutorialCardFor,
  tutorialCardPending,
  tutorialEligibilityFor,
  tutorialPaRecord,
  tutorialSeedPending,
  TUTORIAL_PA_ID,
  TUTORIAL_PATIENT_ID,
  type TutorialPatientSource,
} from "../domain/tutorialEncounter";
import { isSeedWrite, refuseStudentWrite, withSeedWrite } from "../domain/tutorialReadOnly";
import { selectPatientById, useEhrStore } from "./ehrStore";
import { applyTutorialMoneySeed, tutorialMoneyPending } from "../domain/tutorialClaim";
import { applyCodingPlaceOfService, hasLineForCpt } from "../domain/codingPlaceOfService";
import {
  compileNoteText,
  normalizeNoteFields,
  noteFieldsHaveText,
  noteReadOnly,
  type NoteFields,
} from "../domain/noteStatus";
import {
  adjudicateClaim as adjudicateClaimDomain,
  planForPayerName,
  remittanceForClaim,
  type Remittance835,
} from "../domain/adjudication";
import { appendLedgerEntries, postRemittanceToLedger, type LedgerEntry } from "../domain/ledger";
import {
  arResolutionEntries,
  arResolutionOutcome,
  arResolutionReason,
  buildArWorkQueue,
  type ArAction,
  type ArItemState,
  type ArQueueSource,
  type ArWorkItem,
} from "../domain/arWorkQueue";
import {
  appendStatusEvent as appendEvent,
  makeStatusEvent,
  type StatusEventInput,
} from "../domain/statusEvent";

// Re-exported so every existing import path keeps working.
export type {
  ClaimFormData,
  ClaimServiceLine,
  PipelineEncounter,
  PipelineState,
  PipelineStatus,
  PipelineStoreState,
  Role,
} from "./pipelineEncounter";
export { encounterHasWork, encounterKey, UNASSIGNED_ENCOUNTER_KEY } from "./pipelineEncounter";

export interface DeniedClaim {
  id: string;
  /** Holds the patient id in records written before v4; kept for old callers. */
  encounterId: string;
  patientName: string;
  reason: string;
  amount: number;
  deniedAt: string;
  agingBucket: "0-30" | "31-60" | "61-90" | "90+";
  resolutionStatus: "unresolved" | "in-progress" | "resolved" | "escalated";
  assignedTo?: string;
  notes?: string;
  /**
   * The patient this denial belongs to. Null means unassigned — the row still
   * shows, as "no patient attached" (status-engine.md §8).
   */
  patientId?: string | null;
  /** The claim the denial belongs to. In this build a claim's id is its number. */
  claimId?: string;
  claimNumber?: string;
}

export interface ARCallRecord {
  id: string;
  claimId: string;
  patientName: string;
  caller: string;
  timestamp: string;
  duration: number;
  outcome: "reached-patient" | "left-voicemail" | "wrong-number" | "promised-payment" | "escalated";
  notes?: string;
}

/** Prior Authorization record with lifecycle tracking */
export interface PARecordStore {
  id: string;
  patientId: string;
  procedure: string;
  insuranceName: string;
  paProcessor: string;
  authStartDate: string;
  authEndDate: string;
  nextRefillDate: string;
  submissionMethod: string;
  submittedBy: string;
  submittedAt: string;
  status: string; // matches PA_STATUS_FLOW key
  verificationStatus: "not-verified" | "verified" | "failed";
  verificationResult: string;
}

// ─── Context ───────────────────────────────────────────────────────

interface PipelineContextValue {
  /** The active patient's encounter (+ the global demo-fill switch). */
  state: PipelineState;
  /** The patient every stage reads and writes. */
  activePatientId: string | null;
  /** Load a patient's own encounter (creating an empty one on first visit). */
  selectPatient: (patientId: string | null) => void;
  /** This patient's stored encounter, or undefined when never visited. */
  getEncounter: (patientId: string | null) => PipelineEncounter | undefined;
  /**
   * Every stored encounter, keyed the way the store keys them. Read-only, for
   * the Home work queues: they count across all of the student's patients, not
   * just the one on screen, and nothing here writes.
   */
  allEncounters: Record<string, PipelineEncounter>;
  currentRole: Role;
  setRole: (role: Role) => void;
  /**
   * Remember how far into the scribe's chart the student has got on the active
   * patient (spec `start-at-scribing.md` item 5). Forward only, and it writes
   * nothing but the step id: no note, code, claim or ledger entry.
   */
  rememberChartStage: (stage: string) => void;
  submitToCoding: (note: NoteFields | string) => void;
  /**
   * Save a patient's progress note — the four SOAP sections, the one record
   * every screen reads. Refused once the note is signed.
   */
  writeNoteFor: (patientId: string | null, fields: NoteFields) => string | null;
  submitToBilling: (icdCodes: string[], cptCodes: string[], lines?: ClaimServiceLine[]) => void;
  /**
   * Box 24B — the place of service the Coder picked for one CPT line.
   *
   * Written to the Coder's own line and to the claim's box-24 row for the same
   * CPT, because the billing screen chooses the paper (CMS-1500 / UB-04 / ADA)
   * from the place of service on the claim's line. Changing the picker on a line
   * that was already coded used to leave the claim on POS 11 and the CMS-1500.
   * Same field, no schema change; nothing else on either line is touched.
   */
  setCodingLinePlaceOfService: (cpt: string, placeOfService: string) => void;
  submitClaim: (claimData: Record<string, string>) => void;
  // Structured CMS-1500 record
  setClaimForm: (form: ClaimFormData | null) => void;
  patchClaimForm: (patch: Partial<ClaimFormData>) => void;
  /** Instructor / exam-mode switch for the demo fill of missing claim boxes. */
  setDemoFillMissingBoxes: (enabled: boolean) => void;
  /**
   * Append one entry to the active patient's timeline. Append-only and
   * idempotent: appending a transition that is already recorded changes
   * nothing, and there is no way to edit or delete an entry.
   */
  appendStatusEvent: (input: StatusEventInput) => void;
  /**
   * Transmit the active patient's claim to the clearinghouse: the 837P goes out
   * and the 277CA comes back. Ready, Submitted and the outcome are recorded in
   * one store write, so the claim's status never exists without its timeline.
   * The outcome is read back off the timeline with `ackForClaim`.
   */
  transmitClaim: (input: {
    /** Box 1a as submitted. */
    subscriberId: string;
    /** Box 1a as the coverage record holds it. */
    subscriberIdOnFile: string;
    /** Box 3 as submitted. */
    patientDob: string;
    /** Box 3 as the chart holds it. */
    patientDobOnFile: string;
    lineCount: number;
    payerName?: string;
  }) => void;
  handleDenial: (denialCode: string, meta?: { amount?: number; patientName?: string }) => void;
  /**
   * Ask the payer to adjudicate the active patient's accepted claim. The payer's
   * 835 comes back priced against the plan's rules (allowance, deductible,
   * coinsurance, contractual write-off, any denial CARC) and is stored on the
   * encounter. **No money moves here** — nothing is paid and the ledger is
   * untouched until the 835 is posted.
   */
  adjudicateClaim: (input?: { payerName?: string }) => void;
  /**
   * Post the 835 the payer sent to the patient ledger. One store write adds the
   * charge, insurance payment and adjustment entries, records the posting and
   * the patient balance on the claim's timeline, and moves the claim's status.
   * Idempotent: posting the same 835 twice adds no money.
   */
  postRemittance: () => void;
  /**
   * Post one already-built entry to a patient's visit ledger — the copay the
   * front desk collected at check-in (`domain/checkIn.ts`). The entry id is
   * derived from the appointment, so posting the same copay twice adds no money.
   * It targets the patient named on the entry, because the desk checks a patient
   * in before their chart is the active one.
   */
  postPatientPayment: (patientId: string | null, entry: LedgerEntry) => void;
  submitPA: (paData: Record<string, string>) => void;
  completePipeline: () => void;
  getRoleLabel: (role: Role) => string;
  // AR-specific
  deniedClaims: DeniedClaim[];
  arCalls: ARCallRecord[];
  /**
   * The AR work queue (`domain/arWorkQueue.ts`): one item per denied line of a
   * posted 835 and one per patient balance, each with an age. Derived from the
   * posted 835s and the ledger on every render — never stored.
   */
  arWorkItems: ArWorkItem[];
  /**
   * Clear one work-queue item with an action that moves money. Off the render
   * path and idempotent: a resolved item cannot be resolved twice, and the
   * ledger entry ids are derived from the item, so a double press adds nothing.
   */
  resolveArItem: (input: { itemId: string; action: ArAction; reasonCode?: string; note?: string }) => void;
  /**
   * Record the work in progress on an item — assigned to, in progress,
   * escalated, or back to open. Moves no money and can never un-resolve one.
   */
  updateArItemWork: (input: {
    itemId: string;
    status: "open" | "in-progress" | "escalated";
    assignedTo?: string;
    note?: string;
  }) => void;
  addCallRecord: (record: ARCallRecord) => void;
  assignDenial: (claimId: string, agent: string) => void;
  getClaimsByAging: () => Record<string, DeniedClaim[]>;
  // PA lifecycle
  paRecords: PARecordStore[];
  addPARecord: (record: PARecordStore) => void;
  updatePAStatus: (id: string, status: string) => void;
  /**
   * Start a patient's encounter over from blank. Pass an id to target that
   * patient, `null` for the unassigned bucket, or nothing for the active one.
   * Never called on a plain patient switch — switching only loads.
   */
  resetEncounter: (patientId?: string | null) => void;
  /**
   * Write the Tutorial Patient's worked example onto that patient's encounter —
   * once — when the chart is opened. Spec `specs/tutorial-patient-prefill.md`:
   * the tutorial chart is the standard a student opens to see what a complete
   * encounter looks like, so the note, the signature, the vitals, the codes and
   * the decided prior authorisation are seeded from the patient's own record.
   *
   * `selectPatient` calls it, so it works however the chart is opened — the
   * inbox, `/patients`, Start Visit or a pasted link. A screen that loads a
   * session may call it a second time; it answers whether this chart is showing
   * the example, and the answer is the same either way.
   *
   * Guarded by the encounter's own `tutorialSeed` key (`tutorialSeedPending`), so
   * a second open never overwrites work the student did after the seed. Nothing is
   * written for any other patient.
   */
  seedTutorialOnOpen: (patientId: string | null) => boolean;
  setPatientDisplayName: (name: string | null) => void;
}

/**
 * The pipeline context. Exported so a test can wrap a screen with a context
 * whose writers it can count — a refused write leaves no trace in the store,
 * so "how many times did this screen try to seed the claim?" can only be
 * answered from here (`tests/billing-reseed-once.test.tsx`).
 */
export const PipelineContext = createContext<PipelineContextValue | null>(null);

// ─── Helpers ───────────────────────────────────────────────────────

function determineAgingBucket(deniedAt: string): DeniedClaim["agingBucket"] {
  const daysSince = Math.floor(
    (Date.now() - new Date(deniedAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysSince <= 30) return "0-30";
  if (daysSince <= 60) return "31-60";
  if (daysSince <= 90) return "61-90";
  return "90+";
}

const ROLE_LABELS: Record<Role, string> = {
  scribe: "Scribe / Provider",
  coder: "Medical Coder",
  biller: "Medical Biller",
  "prior-auth": "Prior Authorization",
  "ar-voice": "AR Voice Specialist",
};

// ─── The money cycle: what a posted 835 does to the claim ──────────

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** One plain sentence for the timeline, naming the money and who carries it. */
function remittanceReason(remittance: Remittance835): string {
  const { paidCents, patientRespCents, writeOffCents, allowedCents, deniedCents } = remittance.totals;
  if (remittance.outcome === "paid_in_full") {
    return `Paid in full: the plan paid ${money(paidCents)} of ${money(allowedCents)} allowed. The patient's ${money(
      patientRespCents,
    )} (deductible and coinsurance) is now on the ledger as their balance.`;
  }
  if (remittance.outcome === "partially_paid") {
    return `Partially paid: ${money(paidCents)} paid, ${money(deniedCents)} denied, ${money(
      writeOffCents,
    )} written off. The patient's ${money(patientRespCents)} is on the ledger; the denied lines are for the AR queue.`;
  }
  if (remittance.outcome === "patient_responsibility") {
    return `Nothing paid by the plan: the whole ${money(patientRespCents)} allowed is the patient's responsibility and is on the ledger. No write-off.`;
  }
  return `Denied with no patient balance: ${money(deniedCents)} written off as contractual (${money(
    writeOffCents,
  )} in total adjustments). Nothing is owed by the patient.`;
}

/**
 * Does this write change the Tutorial Patient's chart?
 *
 * `role` and `chartStage` are navigation bookkeeping — which role the chart was
 * opened in and the furthest step reached — not chart data, so they are not an
 * edit. Everything else (note, vitals, codes, PA, claim, remittances, ledger,
 * AR items, the seeded keys) is.
 */
function tutorialContentChanged(
  before: PipelineEncounter | undefined,
  after: PipelineEncounter | undefined,
): boolean {
  if (!before || !after) return true;
  const navigation = new Set(["role", "chartStage"]);
  const fields = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const field of fields) {
    if (navigation.has(field)) continue;
    if ((before as unknown as Record<string, unknown>)[field] !== (after as unknown as Record<string, unknown>)[field]) {
      return true;
    }
  }
  return false;
}

/**
 * The Tutorial Patient's worked example, applied to one store state.
 *
 * The two pure builders — the clinical half (`domain/tutorialEncounter.ts`) and
 * the money half (`domain/tutorialClaim.ts`) — run here, on the state the caller
 * is already writing, so the encounter and its claim land in the *same* write.
 * That is the whole point: a seed that runs in its own later write can be undone
 * by any write that lands between the two, which is exactly what left the chart
 * blank in the mounted app (a cross-device load replaced the store after the
 * seed had written to it).
 *
 * Guarded twice, per half: a chart the student has worked is never re-filled, and
 * a record that already carries `tutorial-2` is returned untouched. The claim
 * number is minted from the state's own numbers, so the function is pure and a
 * second call with the same state yields the same record.
 */
function seedTutorialInto(
  state: PipelineStoreState,
  patient: TutorialPatientSource,
  at: string,
): PipelineStoreState {
  const key = encounterKey(TUTORIAL_PATIENT_ID);
  const current = state.encounters[key];
  const clinicalPending = tutorialSeedPending(current);
  const moneyPending = tutorialMoneyPending(current);
  if (!clinicalPending && !moneyPending) return state;
  let enc = current ?? createEncounter(TUTORIAL_PATIENT_ID);
  if (clinicalPending) enc = applyTutorialSeed(enc, patient, at);
  if (tutorialMoneyPending(enc)) {
    const claimNumber = mintNextClaimNumber(
      Object.values(state.encounters).map((e) => e.claimNumber),
    );
    // `TutorialPatientSource` is the narrow shape the seed builders read from;
    // `applyTutorialMoneySeed` is typed against `Patient` because the same
    // function also prices a real student's claim. Every field the claim builder
    // reads (id, name, date of birth, the coverage card) is on both, so the cast
    // is the same one the two card writes above already make.
    enc = applyTutorialMoneySeed(enc, patient as never, at, claimNumber);
  }
  if (enc === current) return state;
  return { ...state, encounters: { ...state.encounters, [key]: enc } };
}

/** Initial store — read straight from localStorage so the first render has it. */
function initialState(): PipelineStoreState {
  const phone = getLoggedInPhone();
  const local = phone ? loadUserData(phone) : null;
  return normalizePipelineStore(local?.pipeline, local?.currentRole ?? "scribe");
}

/**
 * Make `patientId` the one active patient, and write that pick through at once.
 *
 * Every route mounts its own `PipelineProvider` and reads the saved record when
 * it mounts, so a pick held only in memory reaches the next page after the 400 ms
 * debounce — and a student who picks a patient in Patients and opens Coding
 * immediately outruns it, leaving Coding on the Tutorial Patient (audit item 4,
 * "patient and track context persist across navigation"). This writes the one
 * field the pick changes into the blob the next page reads, before the screen
 * changes.
 *
 * It writes no encounter, no note, no code, no claim and no money: the encounter
 * map is carried forward exactly as saved, and only `activePatientId` moves.
 * A patient picked before their own encounter exists gets the blank encounter
 * `selectPatient` would have made the moment their chart opens — never a filled
 * one.
 */
export function rememberActivePatient(patientId: string | null): void {
  const phone = getLoggedInPhone();
  if (!phone) return;
  const local = loadUserData(phone);
  const saved = normalizePipelineStore(local?.pipeline, local?.currentRole ?? "scribe");
  if (saved.activePatientId === patientId) return;
  // Carry the record forward as it is about to be saved — with the worked
  // example on it when the chart being opened is the Tutorial Patient's — so
  // this write never puts a pre-seed snapshot back over the chart on screen.
  saveUserData(phone, { pipeline: { ...withTutorialSeed(saved), activePatientId: patientId } });
}

/**
 * The record to save, with the Tutorial Patient's worked example applied.
 *
 * The seed is written here, on the way to storage, because the screen paints the
 * example the moment the chart is opened — and a save taken from the state as it
 * was *before* that open stores a blank chart the student never saw. The same
 * guards decide: a chart that already holds the seed, or work the student did,
 * comes back untouched, and the claim number is minted from the student's own
 * sequence. Nothing is invented.
 */
function withTutorialSeed(prev: PipelineStoreState): PipelineStoreState {
  const key = encounterKey(TUTORIAL_PATIENT_ID);
  const current = prev.encounters[key];
  let patient = selectPatientById(useEhrStore.getState(), TUTORIAL_PATIENT_ID);
  if (!patient) return prev;
  const at = new Date().toISOString();
  // The card and the 271 are what the claim's box 1a and the payer's member
  // match read, so they are written before the example is built — and the
  // patient is read back afterwards, because box 1a is the member ID just saved.
  const known = patient;
  if (tutorialCardPending(known)) {
    // A seed write, not a student write: `withSeedWrite` is what lets the card
    // and the 271 land on a chart that refuses student edits (`tutorialReadOnly.ts`).
    patient = withSeedWrite(() => {
      const ehr = useEhrStore.getState();
      ehr.updatePatientInsurance(known.id, tutorialCardFor(known as never));
      ehr.recordEligibility(known.id, "primary", tutorialEligibilityFor(known as never, at));
      return selectPatientById(useEhrStore.getState(), TUTORIAL_PATIENT_ID) ?? known;
    });
  }
  // Nothing pending means nothing more to write: the state comes back as it went
  // in, so a save of a chart the student worked never looks like a change. The
  // card above is checked on every save, not only while the example is pending —
  // a chart whose example landed but whose card did not used to keep printing
  // "Not on file" for good.
  if (!tutorialSeedPending(current) && !tutorialMoneyPending(current)) return prev;
  // One builder for both paths: the same `seedTutorialInto` that the open path
  // writes with, so a chart saved from here and a chart seeded on open are the
  // same record.
  return seedTutorialInto(prev, patient, at);
}

/**
 * The stage this patient's encounter is saved on, read straight from the
 * student's record — the same record `PipelineProvider` mounts from.
 *
 * A screen that sends the student into an encounter rather than to a hub tab
 * (`/patients` on the Tutorial Patient) names the stage in the address, and the
 * address wins over the session's remembered screen. Reading the saved stage is
 * what keeps that click resuming the encounter where it was left instead of
 * restarting it at Registration. `undefined` when nothing is saved yet, or when
 * the student is not signed in — the caller opens the encounter's first stage.
 * Nothing is written here.
 */
export function savedEncounterStage(patientId: string): string | undefined {
  const phone = getLoggedInPhone();
  if (!phone) return undefined;
  const local = loadUserData(phone);
  const saved = normalizePipelineStore(local?.pipeline, local?.currentRole ?? "scribe");
  return saved.encounters[encounterKey(patientId)]?.stage;
}

// ─── Provider ──────────────────────────────────────────────────────

export function PipelineProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<PipelineStoreState>(initialState);

  const [deniedClaims, setDeniedClaims] = useState<DeniedClaim[]>([]);
  const [arCalls, setArCalls] = useState<ARCallRecord[]>([]);
  const [paRecords, setPaRecords] = useState<PARecordStore[]>([]);

  // ── Per-user persistence ─────────────────────────────────────────
  // Keyed by the logged-in student's phone (localStorage, always on), with an
  // optional Supabase refresh. Providers remount on login/logout, so scoping
  // to the phone at mount gives correct per-user isolation.
  useEffect(() => {
    const phone = getLoggedInPhone();
    if (!phone) return;
    const local = loadUserData(phone);
    if (local?.deniedClaims) setDeniedClaims(local.deniedClaims);
    if (local?.arCalls) setArCalls(local.arCalls);
    if (local?.paRecords) setPaRecords(local.paRecords);
    // Layer 2 — optional cross-device refresh from Supabase.
    void syncUserDataFromSupabase(phone).then((remote) => {
      if (!remote) return;
      if (remote.pipeline && (remote.updatedAt || "") > (local?.updatedAt || "")) {
        // Loading a saved record is one of the writes that must carry the
        // example: this load lands after a seed written a moment earlier, and
        // replacing the store without it is what left the chart blank.
        const at = new Date().toISOString();
        const tutorialPatient = prepareTutorialChart(at);
        setStore((prev) => {
          const loaded = normalizePipelineStore(remote.pipeline, remote.currentRole ?? "scribe");
          void prev;
          return tutorialPatient ? seedTutorialInto(loaded, tutorialPatient, at) : loaded;
        });
      }
      if (remote.deniedClaims) setDeniedClaims(remote.deniedClaims);
      if (remote.arCalls) setArCalls(remote.arCalls);
      if (remote.paRecords) setPaRecords(remote.paRecords);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // A reset blanks this state in memory. The blank state must not be saved on
  // the next tick either — the debounce below would recreate the deleted key.
  const skipNextSave = useRef(false);
  useEffect(
    () =>
      registerResetHandler("encounters", () => {
        skipNextSave.current = true;
        setStore(normalizePipelineStore(undefined, "scribe"));
        setDeniedClaims([]);
        setArCalls([]);
        setPaRecords([]);
      }),
    [],
  );
  // Debounced save whenever encounter/AR/PA state changes.
  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const phone = getLoggedInPhone();
    if (!phone) return;
    const t = setTimeout(
      () =>
        saveUserData(phone, {
          // The saved record is the seeded one: the Tutorial Patient's worked
          // example is applied to the record being written, so the write that
          // saves a chart is the same write that carries its seed. A snapshot
          // taken before the seed would save a blank chart the screen was not
          // showing.
          pipeline: withTutorialSeed(store),
          currentRole: store.currentRole,
          deniedClaims,
          arCalls,
          paRecords,
        }),
      400
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, deniedClaims, arCalls, paRecords]);

  // ── Active encounter ─────────────────────────────────────────────
  const activeKey = encounterKey(store.activePatientId);
  const activeEncounter = store.encounters[activeKey] ?? EMPTY_ENCOUNTER;

  const state = useMemo<PipelineState>(
    () => ({ ...activeEncounter, demoFillMissingBoxes: store.demoFillMissingBoxes }),
    [activeEncounter, store.demoFillMissingBoxes],
  );

  const currentRole: Role = store.currentRole;

  /**
   * Every student mutation goes through here, so it always lands on the active
   * patient — and, because it lands here, this is also where the Tutorial
   * Patient's chart refuses a student write (`domain/tutorialReadOnly.ts` § C).
   * The refusal happens before the store is touched and says why, so the saved
   * record is unchanged. `what` names the stage in that sentence; pass `null`
   * for navigation bookkeeping (the step reached), which writes no chart data.
   */
  const updateActive = (
    fn: (enc: PipelineEncounter) => PipelineEncounter,
    what: string | null = "The chart",
  ) => {
    if (what !== null && refuseStudentWrite(store.activePatientId, what)) return;
    setStore((prev) => {
      const key = encounterKey(prev.activePatientId);
      const current = prev.encounters[key] ?? createEncounter(prev.activePatientId);
      return { ...prev, encounters: { ...prev.encounters, [key]: fn(current) } };
    });
  };

  /**
   * The backstop for the writes that do not go through `updateActive`.
   *
   * Same rule, applied to the state about to be written: a student write that
   * would change the Tutorial Patient's encounter is dropped here even if a
   * caller forgot its own guard. Navigation bookkeeping (`role`, the chart step
   * reached) is not chart content and passes; the seed's own writes do not come
   * through this function at all — they use `setStore` directly.
   */
  const studentStore = (update: (prev: PipelineStoreState) => PipelineStoreState) => {
    setStore((prev) => {
      const next = update(prev);
      if (next === prev) return prev;
      const key = encounterKey(TUTORIAL_PATIENT_ID);
      if (next.encounters[key] === prev.encounters[key]) return next;
      if (isSeedWrite()) return next;
      return tutorialContentChanged(prev.encounters[key], next.encounters[key]) ? prev : next;
    });
  };

  const getEncounter = (patientId: string | null) => store.encounters[encounterKey(patientId)];

  // ── The Tutorial Patient's worked example ────────────────────────
  //
  // Spec `tutorial-patient-prefill.md` (owner, 2026-11-22): the tutorial chart is
  // the standard that shows which datum belongs in which stage, so its note, its
  // signature, the codes with their charge, the decided authorisation and the
  // money — the claim, the 277CA, the 835, the posting and the denied line in the
  // AR queue — are built from the patient's own record by
  // `domain/tutorialEncounter.ts` and `domain/tutorialClaim.ts`.
  //
  // WHERE THE SEED RUNS: in the state write itself.
  // Never in a screen's effect and never queued. The pure builders are applied to
  // the state that creates or loads that encounter — `selectPatient` (the store's
  // own open path), the cross-device load, and the arrival of the patient record
  // itself — so the chart and its claim land in one write and no write that lands
  // afterwards can leave the chart blank. Three earlier attempts failed exactly
  // there: a gate inside a loader the new Patients route never called, a queued
  // seed that lost a boot-order race, and a component effect that never fired.
  const storeRef = useRef(store);
  storeRef.current = store;

  /**
   * The chart the example is built from, written before the example itself: the
   * patient's own coverage card with the member ID the 271 needs, the 271 that
   * matches it, and the PA desk's row for the decided authorisation — that queue
   * is its own list, so a decided authorisation has to exist in both places to be
   * the same fact on both screens.
   *
   * Returns the patient as the chart store now holds them, read back after the
   * card is written (the claim's box 1a is the member ID just saved), or
   * `undefined` when there is no such patient to build the example from or the
   * chart no longer needs it.
   */
  const prepareTutorialChart = (at: string): TutorialPatientSource | undefined => {
    const current = storeRef.current.encounters[encounterKey(TUTORIAL_PATIENT_ID)];
    const pending = tutorialSeedPending(current) || tutorialMoneyPending(current);
    let patient = selectPatientById(useEhrStore.getState(), TUTORIAL_PATIENT_ID);
    if (!patient) return undefined;
    const seededPatient = patient;
    if (tutorialCardPending(seededPatient)) {
      // A seed write, not a student write (see `tutorialReadOnly.ts`).
      patient = withSeedWrite(() => {
        const ehr = useEhrStore.getState();
        ehr.updatePatientInsurance(seededPatient.id, tutorialCardFor(seededPatient as never));
        ehr.recordEligibility(seededPatient.id, "primary", tutorialEligibilityFor(seededPatient as never, at));
        return selectPatientById(useEhrStore.getState(), TUTORIAL_PATIENT_ID) ?? seededPatient;
      });
    }
    // The card is repaired on every open, even when the example itself is already
    // on the record: a chart seeded before its card landed would otherwise print
    // "Not on file" on the Front Desk card and the 271 for good.
    //
    // The chart's own name is repaired on the same open. A record saved by a
    // build whose card printed the transposed surname ("Tutorial Pateint") holds
    // that spelling, and the card, the banner and box 2 print it until it is put
    // right (`domain/tutorialIdentity.ts`). Only that one known error is
    // replaced; a name the student typed is left exactly as it is.
    withSeedWrite(() => useEhrStore.getState().repairTutorialPatientName());
    patient = selectPatientById(useEhrStore.getState(), TUTORIAL_PATIENT_ID) ?? patient;
    if (!pending) return undefined;
    const prepared = patient;
    setPaRecords((prev) =>
      prev.some((record) => record.patientId === prepared.id && record.id === TUTORIAL_PA_ID)
        ? prev
        : [...prev, tutorialPaRecord(prepared, at)],
    );
    return prepared;
  };

  /**
   * Seed the Tutorial Patient's worked example when its chart is opened.
   *
   * `selectPatient` is the store's own open path, so the example is written there
   * rather than by one screen's effect — that is what makes it work however the
   * chart is opened: the inbox, `/patients`, Start Visit or a pasted link.
   *
   * Returns true when this chart is showing the example — it was seeded now, or it
   * already holds it and nothing the student did. A chart the student worked
   * answers false and is left exactly as it is.
   */
  const seedTutorialOnOpen = (patientId: string | null): boolean => {
    if (patientId !== TUTORIAL_PATIENT_ID) return false;
    // No pending-check here: `prepareTutorialChart` also repairs a card the
    // example never wrote, so it is asked on every open and answers `undefined`
    // when there is nothing left to do.
    const at = new Date().toISOString();
    const patient = prepareTutorialChart(at);
    if (!patient) return false;
    setStore((prev) => seedTutorialInto(prev, patient, at));
    return true;
  };

  // A patient record that arrives after the chart was opened is a write of its
  // own — the chart store's, not a screen's — and the example is written in that
  // same step. That is what makes opening the Tutorial Patient before its record
  // is registered safe: nothing is queued, and nothing waits for a render.
  const seedingRef = useRef(false);
  useEffect(() => {
    return useEhrStore.subscribe(() => {
      if (seedingRef.current) return;
      // No pending-check: a card the example never wrote is repaired here too.
      seedingRef.current = true;
      try {
        const at = new Date().toISOString();
        const patient = prepareTutorialChart(at);
        if (patient) setStore((prev) => seedTutorialInto(prev, patient, at));
      } finally {
        seedingRef.current = false;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Load a patient's encounter. Creates a blank one the first time only. */
  const selectPatient = (patientId: string | null) => {
    // Opening the Tutorial Patient's chart is what seeds it. The card and the
    // example are built here, and the example is applied inside this same state
    // write — the encounter this call creates or loads and its claim land
    // together, so no later write can leave the chart blank.
    const at = new Date().toISOString();
    const patient =
      patientId === TUTORIAL_PATIENT_ID ? prepareTutorialChart(at) : undefined;
    setStore((prev) => {
      const key = encounterKey(patientId);
      const existing = prev.encounters[key];
      const encounter = existing ?? createEncounter(patientId);
      // Reopen the patient where they were left: their own role when the
      // student picked one, otherwise the stage their work reached.
      const restoredRole = restoredRoleFor(encounter);
      const next =
        prev.activePatientId === patientId && existing
          ? prev.currentRole === restoredRole
            ? prev
            : { ...prev, currentRole: restoredRole }
          : {
              ...prev,
              activePatientId: patientId,
              encounters: existing ? prev.encounters : { ...prev.encounters, [key]: encounter },
              currentRole: restoredRole,
            };
      return patient ? seedTutorialInto(next, patient, at) : next;
    });
    // Write the pick through before the screen changes, so the page the student
    // opens next reads the same patient this one is showing.
    rememberActivePatient(patientId);
  };

  const setRole = (role: Role) => {
    setStore((prev) => {
      const key = encounterKey(prev.activePatientId);
      // Write the role onto the encounter even when it does not exist yet, so a
      // role picked before the encounter was created still belongs to it.
      const enc = prev.encounters[key] ?? createEncounter(prev.activePatientId);
      return {
        ...prev,
        currentRole: role,
        encounters: { ...prev.encounters, [key]: { ...enc, role } },
      };
    });
  };

  const setPatientDisplayName = (name: string | null) => {
    updateActive((enc) => ({ ...enc, displayName: name }), "The patient's name");
  };

  // Start an encounter over. A plain patient switch must never call this.
  // The Tutorial Patient's chart has no blank-visit reset at all (spec § C):
  // the store refuses it before it writes, and says why.
  const resetEncounter = (patientId?: string | null) => {
    const target = patientId === undefined ? store.activePatientId : patientId;
    if (refuseStudentWrite(target, "Start over")) return;
    studentStore((prev) => {
      const key = encounterKey(target);
      return {
        ...prev,
        activePatientId: target,
        encounters: { ...prev.encounters, [key]: createEncounter(target) },
        currentRole: "scribe",
      };
    });
  };

  // Remember the furthest chart step reached on the active patient. Forward
  // only: going Back to Registration never rewinds it, so reopening the chart
  // returns to the furthest step the student reached. Writes the step id and
  // nothing else — no note, no code, no claim, no ledger entry.
  const rememberChartStage = (stage: string) => {
    if (!stage) return;
    updateActive((enc) => {
      const next = furthestChartStep(enc.chartStage, stage);
      return next === enc.chartStage ? enc : { ...enc, chartStage: next };
    }, null);
  };

  /**
   * Save the note's four SOAP sections — the one place a note is written.
   *
   * It targets the patient named rather than whoever is active, because the note
   * is saved by an autosave timer, by a blur and by the Charts page, and any of
   * those can fire while the chart is switching patients. A note that is already
   * signed is refused: once signed it is read-only everywhere
   * (`domain/noteStatus.ts`), not only where it was signed.
   *
   * Returns when it was saved, or null when nothing was written.
   */
  const writeNoteFor = (patientId: string | null, fields: NoteFields): string | null => {
    // The Tutorial Patient's note is the worked example: the store refuses the
    // write here, before the record is touched, and says why (spec § C).
    if (refuseStudentWrite(patientId, "The note")) return null;
    const key = encounterKey(patientId);
    const current = store.encounters[key];
    if (current && noteReadOnly(current)) return null;
    const nextFields = normalizeNoteFields(fields);
    const text = compileNoteText(nextFields);
    const unchanged =
      current && text === current.scribeNote && JSON.stringify(nextFields) === JSON.stringify(current.noteFields);
    if (unchanged) return null;
    const at = new Date().toISOString();
    studentStore((prev) => {
      const base = prev.encounters[key] ?? createEncounter(patientId);
      if (noteReadOnly(base)) return prev;
      return {
        ...prev,
        encounters: {
          ...prev.encounters,
          [key]: { ...base, noteFields: nextFields, scribeNote: text, noteUpdatedAt: at },
        },
      };
    });
    return at;
  };

  // Auto-advance: Scribe → Coder
  const submitToCoding = (note: NoteFields | string) => {
    // The signature itself lives in `domain/signNote.ts`, so the record the
    // Coding queue reads is written by the same function the tests use. A note
    // that is already signed is left exactly as it was: a note is signed once.
    updateActive((enc) => (noteReadOnly(enc) ? enc : signNote(enc, { note, by: getLoggedInPhone() ?? "system" })), "The note's signature");
  };

  // Auto-advance: Coder → Prior Auth (PA first)
  const submitToBilling = (icdCodes: string[], cptCodes: string[], lines?: ClaimServiceLine[]) => {
    updateActive((enc) => ({
      ...enc,
      icdCodes,
      cptCodes,
      codingLines: lines ?? enc.codingLines,
      stage: "prior-auth",
      status: "coded",
    }), "The codes");
  };

  /**
   * 24B — one line's place of service, on the Coder's line and on the claim.
   * Nothing is written when this CPT has no line yet: the line the student is
   * working is not coded until Coding is submitted.
   */
  const setCodingLinePlaceOfService = (cpt: string, placeOfService: string) => {
    if (!hasLineForCpt(activeEncounter, cpt)) return;
    updateActive((enc) => applyCodingPlaceOfService(enc, cpt, placeOfService), "The place of service");
  };

  // ── Structured CMS-1500 record ──────────────────────────────────
  const setClaimForm = (form: ClaimFormData | null) => {
    if (refuseStudentWrite(store.activePatientId ?? resolveEncounterPatientId(null), "The claim")) return;
    studentStore((prev) => {
      // ── Data scoping (audit item 5) ────────────────────────────────
      // A claim belongs to the patient and the encounter on screen. The
      // pipeline's own id can be unset on two real paths (a restored session and
      // the Coder's skip-to-billing) while the chart knows the patient, so the
      // patient is resolved the same way the banner resolves it. With no patient
      // anywhere, nothing is written: **no claim number is minted for a claim
      // that belongs to nobody** — that bucket is where the "No patient attached"
      // rows came from.
      const patientId = prev.activePatientId ?? resolveEncounterPatientId(null);
      if (!patientId) return prev;
      if (scopingRefusal({ patientId, encounterId: encounterIdFor(patientId) })) return prev;

      const key = encounterKey(patientId);
      const own = prev.encounters[key];
      // Work entered while no patient was attached belongs to the patient on
      // screen now: its coded lines are what this claim bills. Adopted only when
      // the patient's own encounter holds no work of its own, and only the
      // charted fields — never a claim, ledger or remittance record, so two
      // encounters can never share one claim number.
      const unassigned = prev.encounters[UNASSIGNED_ENCOUNTER_KEY];
      let enc = own ?? createEncounter(patientId);
      if (!prev.activePatientId && !encounterHasWork(own) && encounterHasWork(unassigned)) {
        enc = {
          ...enc,
          noteFields: noteFieldsHaveText(enc.noteFields) ? enc.noteFields : unassigned.noteFields,
          scribeNote: enc.scribeNote || unassigned.scribeNote,
          icdCodes: enc.icdCodes.length > 0 ? enc.icdCodes : unassigned.icdCodes,
          cptCodes: enc.cptCodes.length > 0 ? enc.cptCodes : unassigned.cptCodes,
          codingLines: enc.codingLines.length > 0 ? enc.codingLines : unassigned.codingLines,
        };
      }

      if (!form) {
        return {
          ...prev,
          activePatientId: patientId,
          encounters: { ...prev.encounters, [key]: { ...enc, claimForm: null } },
        };
      }
      // The claim exists from the first time its paper is opened. Its number is
      // minted once and recorded with its creation event in the same write — a
      // second open never mints a second number or a second event.
      if (enc.claimNumber) {
        return {
          ...prev,
          activePatientId: patientId,
          encounters: { ...prev.encounters, [key]: { ...enc, claimForm: form } },
        };
      }
      // One sequence for the whole student (`store/claimSequence.ts`): the
      // dental track mints from the same mark, so a medical claim and a dental
      // claim can never carry the same number.
      const claimNumber = mintNextClaimNumber(
        Object.values(prev.encounters).map((e) => e.claimNumber),
      );
      const event = makeStatusEvent(
        {
          entityType: "claim",
          entityId: claimNumber,
          patientId: enc.patientId,
          claimNumber,
          from: null,
          to: "draft",
          by: getLoggedInPhone() ?? "system",
          jobRole: jobRoleFor(restoredRoleFor(enc)),
          reasonCode: "CLAIM_CREATED",
          reason: `Claim ${claimNumber} created from this encounter. Nothing has been scrubbed or submitted yet.`,
        },
        enc.statusEvents,
      );
      return {
        ...prev,
        activePatientId: patientId,
        encounters: {
          ...prev.encounters,
          [key]: {
            ...enc,
            claimForm: form,
            claimNumber,
            claimStatus: "draft" as ClaimStatus,
            claimStatusMigrated: false,
            statusEvents: appendEvent(enc.statusEvents, event),
          },
        },
      };
    });
  };

  /**
   * The one way to add a timeline entry. There is deliberately no update and no
   * delete: the engine's audit log has to be append-only to be worth anything.
   * A claim transition moves the claim's status in the same write.
   */
  const appendStatusEvent = (input: StatusEventInput) => {
    if (refuseStudentWrite(input.patientId ?? store.activePatientId, "The claim's timeline")) return;
    studentStore((prev) => {
      const patientId = input.patientId ?? prev.activePatientId;
      const key = encounterKey(patientId);
      const enc = prev.encounters[key] ?? createEncounter(patientId);
      const event = makeStatusEvent({ ...input, patientId }, enc.statusEvents);
      const events = appendEvent(enc.statusEvents, event);
      if (events === enc.statusEvents) return prev; // already recorded — nothing changes
      return {
        ...prev,
        encounters: {
          ...prev.encounters,
          [key]: {
            ...enc,
            statusEvents: events,
            claimStatus:
              event.entityType === "claim" && event.claimNumber === enc.claimNumber
                ? (event.to as ClaimStatus)
                : enc.claimStatus,
          },
        },
      };
    });
  };

  /**
   * Clearinghouse submission (money-cycle items 8 and 9). One write appends the
   * 837P, the 277CA and — on a first transmission — the edit checks passing, and
   * moves the claim's status to whatever the 277CA said. A rejection leaves the
   * claim on the biller's desk: it never becomes a denial, and no money moves.
   */
  const transmitClaim: PipelineContextValue["transmitClaim"] = (input) => {
    if (refuseStudentWrite(store.activePatientId, "The claim submission")) return;
    studentStore((prev) => {
      const key = encounterKey(prev.activePatientId);
      const enc = prev.encounters[key] ?? createEncounter(prev.activePatientId);
      // No claim number, no claim: the paper mints it when it first opens.
      if (!enc.claimNumber) return prev;
      const { events, ack } = buildSubmissionEvents({
        facts: {
          track: "medical",
          claimNumber: enc.claimNumber,
          subscriberId: input.subscriberId,
          subscriberIdOnFile: input.subscriberIdOnFile,
          patientDob: input.patientDob,
          patientDobOnFile: input.patientDobOnFile,
        },
        from: enc.claimStatus,
        patientId: enc.patientId,
        by: getLoggedInPhone() ?? "system",
        jobRole: "biller",
        lineCount: input.lineCount,
        payerName: input.payerName,
        existing: enc.statusEvents,
      });
      // Every row was already recorded — a double-click adds nothing.
      if (events === enc.statusEvents) return prev;
      return {
        ...prev,
        encounters: {
          ...prev.encounters,
          [key]: {
            ...enc,
            statusEvents: events,
            claimStatus: (ack.category === "A1" ? "accepted" : "rejected") as ClaimStatus,
            claimStatusMigrated: false,
          },
        },
      };
    });
  };

  /**
   * The payer adjudicates the accepted claim (money-cycle items 1, 3 and 5).
   * One write stores the 835 and records its arrival on the claim's timeline.
   * The 835 is priced against the plan's rules from `domain/adjudication.ts`;
   * nothing on this screen invents an amount, and no money moves yet.
   */
  const adjudicateClaim: PipelineContextValue["adjudicateClaim"] = (input) => {
    if (refuseStudentWrite(store.activePatientId, "The 835")) return;
    studentStore((prev) => {
      const key = encounterKey(prev.activePatientId);
      const enc = prev.encounters[key] ?? createEncounter(prev.activePatientId);
      if (!enc.claimNumber) return prev;
      // Only an accepted claim reaches adjudication: a rejected or unsubmitted
      // claim has never been to the payer.
      if (enc.claimStatus !== "accepted") return prev;
      // Already adjudicated — a second press changes nothing.
      if (remittanceForClaim(enc.remittances, enc.claimNumber)) return prev;

      const payerName = (input?.payerName || enc.claimForm?.payerName || "").trim();
      const plan = planForPayerName(payerName);
      const lines = (enc.claimForm?.serviceLines ?? [])
        .filter((line) => (line.cpt ?? "").trim() !== "")
        .map((line) => ({
          cpt: line.cpt.trim(),
          modifiers: (Array.isArray(line.modifiers) ? line.modifiers : []).filter(Boolean),
          units: Number(line.units) > 0 ? Number(line.units) : 1,
          chargeCents: Math.round((Number(line.charge) || 0) * 100),
        }));
      if (lines.length === 0) return prev;

      const remittance = adjudicateClaimDomain({
        claimNumber: enc.claimNumber,
        payerName: payerName || "the payer",
        // Box 32 of the claim, so the 835's N1*PR carries the same payer id the
        // paper does instead of no identification at all.
        payerId: enc.claimForm?.payerEdiId ?? "",
        plan,
        lines,
        // The plan's deductible is what this member has still to meet; the
        // simulator records no accumulated deductible, so it starts unmet and
        // the 835 says so on every line it touches.
        deductibleRemainingCents: Math.round((plan?.deductibleUsd ?? 0) * 100),
        // Box 23: the authorisation number the claim actually carries.
        priorAuthNumber: enc.claimForm?.priorAuthNumber ?? "",
      });

      const event = makeStatusEvent(
        {
          entityType: "claim",
          entityId: enc.claimNumber,
          patientId: enc.patientId,
          claimNumber: enc.claimNumber,
          from: enc.claimStatus,
          to: "adjudicated",
          by: "system",
          jobRole: "system",
          reasonCode: "ERA_RECEIVED",
          reason: `835 ${remittance.checkOrEftNumber} received from ${remittance.payerName}: billed ${money(remittance.totals.billedCents)}, allowed ${money(
            remittance.totals.allowedCents,
          )}, paid ${money(remittance.totals.paidCents)}, patient ${money(remittance.totals.patientRespCents)}. Nothing has reached the ledger yet.`,
          amountCents: remittance.totals.paidCents,
          refs: { eraId: remittance.id, checkNumber: remittance.checkOrEftNumber },
        },
        enc.statusEvents,
      );

      return {
        ...prev,
        encounters: {
          ...prev.encounters,
          [key]: {
            ...enc,
            remittances: [...enc.remittances, remittance],
            claimStatus: "adjudicated" as ClaimStatus,
            claimStatusMigrated: false,
            statusEvents: appendEvent(enc.statusEvents, event),
          },
        },
      };
    });
  };

  /**
   * Post the 835 to the patient ledger (items 5 and 13). This is the write that
   * makes money move: charges, the insurance payment and the contractual
   * adjustments become ledger entries, the claim's timeline records the posting
   * and the patient balance, and the claim's status follows the money. One store
   * write, so a status never exists without the entries behind it.
   */
  const postRemittance: PipelineContextValue["postRemittance"] = () => {
    if (refuseStudentWrite(store.activePatientId, "The posting")) return;
    studentStore((prev) => {
      const key = encounterKey(prev.activePatientId);
      const enc = prev.encounters[key] ?? createEncounter(prev.activePatientId);
      const remittance = remittanceForClaim(enc.remittances, enc.claimNumber);
      if (!remittance || remittance.postedAt) return prev;

      const at = new Date().toISOString();
      const by = getLoggedInPhone() ?? "system";
      const entries = postRemittanceToLedger(remittance, {
        patientId: enc.patientId,
        userId: by,
        at,
      });
      const ledger = appendLedgerEntries(enc.ledger, entries);
      if (ledger === enc.ledger) return prev; // already on the ledger — no second posting

      const posted: typeof remittance = { ...remittance, postedAt: at };
      const status = claimStatusForRemittance(remittance);
      let events = enc.statusEvents;

      const postEvent = makeStatusEvent(
        {
          entityType: "claim",
          entityId: remittance.claimNumber,
          patientId: enc.patientId,
          claimNumber: remittance.claimNumber,
          at,
          from: enc.claimStatus,
          to: "adjudicated",
          by,
          jobRole: "payment-poster",
          reasonCode: "ERA_POSTED",
          reason: `835 ${remittance.checkOrEftNumber} posted: ${entries.length} ledger entr${entries.length === 1 ? "y" : "ies"} — charges ${money(
            remittance.totals.billedCents,
          )}, insurance payment ${money(remittance.totals.paidCents)}, contractual write-off ${money(remittance.totals.writeOffCents)}.`,
          amountCents: remittance.totals.paidCents,
          refs: { eraId: remittance.id, checkNumber: remittance.checkOrEftNumber },
        },
        events,
      );
      events = appendEvent(events, postEvent);

      const outcomeCode: ReasonCode =
        remittance.outcome === "paid_in_full"
          ? "ERA_PAID_IN_FULL"
          : remittance.outcome === "partially_paid"
            ? "ERA_PARTIAL"
            : remittance.outcome === "patient_responsibility"
              ? "PATIENT_BALANCE_CREATED"
              : "ERA_DENIED";
      const outcomeEvent = makeStatusEvent(
        {
          entityType: "claim",
          entityId: remittance.claimNumber,
          patientId: enc.patientId,
          claimNumber: remittance.claimNumber,
          at,
          from: "adjudicated",
          to: status,
          by,
          jobRole: "payment-poster",
          reasonCode: outcomeCode,
          reason: remittanceReason(remittance),
          amountCents:
            remittance.outcome === "patient_responsibility"
              ? remittance.totals.patientRespCents
              : remittance.totals.paidCents,
          refs: { eraId: remittance.id, checkNumber: remittance.checkOrEftNumber },
        },
        events,
      );
      events = appendEvent(events, outcomeEvent);

      return {
        ...prev,
        encounters: {
          ...prev.encounters,
          [key]: {
            ...enc,
            ledger,
            remittances: enc.remittances.map((r) => (r.id === remittance.id ? posted : r)),
            claimStatus: status,
            claimStatusMigrated: false,
            statusEvents: events,
          },
        },
      };
    });
  };

  const patchClaimForm = (patch: Partial<ClaimFormData>) => {
    updateActive((enc) => ({
      ...enc,
      claimForm: enc.claimForm ? { ...enc.claimForm, ...patch } : enc.claimForm,
    }), "The claim");
  };

  // Instructor / exam-mode switch. Persisted with the rest of the store, so an
  // assessment session keeps the paper free of demo values.
  const setDemoFillMissingBoxes = (enabled: boolean) => {
    setStore((prev) => ({ ...prev, demoFillMissingBoxes: enabled }));
  };

  // PA submission — don't change status; claim isn't submitted yet
  const submitPA = (paData: Record<string, string>) => {
    // Data scoping (audit item 5): a prior auth belongs to a patient and an
    // encounter. With none, nothing is written — the PA screen names what is
    // missing instead of storing an authorisation for nobody.
    if (scopingRefusal({ patientId: store.activePatientId, encounterId: encounterIdFor(store.activePatientId) })) {
      return;
    }
    updateActive((enc) => ({
      ...enc,
      paData,
      stage: "biller",
      // Keep existing status (typically "coded") — status = "paid" only after actual claim settlement
      denialInfo: null,
    }), "The prior authorisation");
  };

  // Auto-advance: Biller submits claim → AR Voice
  const submitClaim = (claimData: Record<string, string>) => {
    // Data scoping (audit item 5): only a claim that belongs to a patient and an
    // encounter, and that already exists, can be submitted. A submission with no
    // claim number would put a claim on the payer's desk that this practice
    // never created.
    if (scopingRefusal({ patientId: store.activePatientId, encounterId: encounterIdFor(store.activePatientId) })) {
      return;
    }
    if (!activeEncounter.claimNumber) return;
    updateActive((enc) => ({
      ...enc,
      claimData,
      stage: "ar-voice",
      status: "billed",
    }), "The claim submission");
  };

  // Denial from Biller stage — routes to the active patient's AR row
  const handleDenial = (denialCode: string, meta?: { amount?: number; patientName?: string }) => {
    const patientId = store.activePatientId;
    if (refuseStudentWrite(patientId, "The denial")) return;
    const denial: DeniedClaim = {
      id: `denial-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      encounterId: patientId ?? "unknown",
      patientId,
      claimId: activeEncounter.claimNumber ?? undefined,
      claimNumber: activeEncounter.claimNumber ?? undefined,
      patientName: meta?.patientName ?? activeEncounter.displayName ?? "",
      reason: denialCode,
      amount: meta?.amount ?? 0,
      deniedAt: new Date().toISOString(),
      agingBucket: "0-30",
      resolutionStatus: "unresolved",
    };
    setDeniedClaims((d) => [...d, denial]);
    updateActive((enc) => ({
      ...enc,
      status: "denied",
      denialInfo: { code: denialCode, reason: "Claim denied", amount: meta?.amount ?? 0 },
    }), "The denial");
  };

  // Complete pipeline — called when all stages are done
  const completePipeline = () => {
    updateActive((enc) => ({
      ...enc,
      stage: "complete",
      status: "paid",
    }), "The encounter");
  };

  // ── AR work queue (money cycle slice 3) ──────────────────────────
  // The queue is derived, never stored: every item is a denied line of a posted
  // 835 or a balance the ledger already sums. Only the work done on an item is
  // stored, on the patient's own encounter, so it travels with the money.
  const [arNow, setArNow] = useState(() => new Date().toISOString());
  const arSources = useMemo<ArQueueSource[]>(
    () =>
      Object.values(store.encounters).map((enc) => ({
        patientId: enc.patientId,
        patientName: enc.displayName,
        claimNumber: enc.claimNumber,
        remittances: enc.remittances,
        ledger: enc.ledger,
        arItems: enc.arItems,
      })),
    [store.encounters],
  );
  const arWorkItems = useMemo(() => buildArWorkQueue(arSources, arNow), [arSources, arNow]);

  /**
   * Clear one item. The money the action moves is written to the patient's
   * ledger in the same store write that marks the item resolved, so a cleared
   * item and a ledger that still shows the money can never disagree.
   */

  /**
   * Post one hand-built ledger entry (the check-in copay) to a patient's
   * encounter. Idempotent through the entry id; creates the patient's blank
   * encounter the first time so the money has somewhere honest to land.
   */
  const postPatientPayment: PipelineContextValue["postPatientPayment"] = (patientId, entry) => {
    if (refuseStudentWrite(patientId, "The ledger")) return;
    studentStore((prev) => {
      const key = encounterKey(patientId);
      const current = prev.encounters[key] ?? createEncounter(patientId);
      const ledger = appendLedgerEntries(current.ledger, [{ ...entry, patientId }]);
      if (ledger === current.ledger) return prev; // already posted — no second payment
      return { ...prev, encounters: { ...prev.encounters, [key]: { ...current, ledger } } };
    });
  };

  const resolveArItem: PipelineContextValue["resolveArItem"] = (input) => {
    const at = new Date().toISOString();
    const by = getLoggedInPhone() ?? "system";
    studentStore((prev) => {
      const queue = buildArWorkQueue(
        Object.values(prev.encounters).map((enc) => ({
          patientId: enc.patientId,
          patientName: enc.displayName,
          claimNumber: enc.claimNumber,
          remittances: enc.remittances,
          ledger: enc.ledger,
          arItems: enc.arItems,
        })),
        at,
      );
      const item = queue.find((i) => i.id === input.itemId);
      if (!item) return prev;
      if (item.status === "resolved") return prev; // already cleared — no second money
      if (!item.actions.includes(input.action)) return prev;
      const reasonCode = (input.reasonCode ?? "").trim();
      if (input.action === "write_off" && !reasonCode) return prev; // a write-off needs its reason

      const key = encounterKey(item.patientId);
      const enc = prev.encounters[key];
      if (!enc) return prev;

      const entries = arResolutionEntries(item, input.action, {
        patientId: enc.patientId,
        userId: by,
        at,
        reasonCode: reasonCode || undefined,
      });
      const ledger = appendLedgerEntries(enc.ledger, entries);
      // The entries were already on the ledger from an earlier press: record
      // nothing further rather than a second resolution.
      if (entries.length > 0 && ledger === enc.ledger) return prev;

      const state: ArItemState = {
        id: item.id,
        claimNumber: item.claimNumber,
        status: "resolved",
        action: input.action,
        ...(reasonCode ? { reasonCode } : {}),
        ...(input.note ? { note: input.note } : {}),
        at,
        by,
      };
      const arItems = [...enc.arItems.filter((s) => s.id !== item.id), state];
      const outcome = arResolutionOutcome(input.action);
      const movedCents =
        input.action === "write_off"
          ? entries
              .filter((e) => e.type === "adjustment")
              .reduce((sum, e) => sum + Math.abs(e.amountCents), 0)
          : item.amountCents;
      const event = makeStatusEvent(
        {
          entityType: "claim",
          entityId: item.claimNumber,
          patientId: enc.patientId,
          claimNumber: item.claimNumber,
          at,
          from: enc.claimStatus,
          to: outcome.to,
          by,
          jobRole: "ar-voice",
          reasonCode: outcome.reasonCode,
          reason: arResolutionReason(item, input.action, entries),
          amountCents: movedCents,
          refs: { refNumber: item.id, ...(item.carc ? { carc: item.carc } : {}) },
        },
        enc.statusEvents,
      );
      return {
        ...prev,
        encounters: {
          ...prev.encounters,
          [key]: {
            ...enc,
            ledger,
            arItems,
            statusEvents: appendEvent(enc.statusEvents, event),
            claimStatus: outcome.to,
            claimStatusMigrated: false,
          },
        },
      };
    });
    setArNow(at);
  };

  /** Work in progress on an item: assignment, in progress, escalated, open. */
  const updateArItemWork: PipelineContextValue["updateArItemWork"] = (input) => {
    const at = new Date().toISOString();
    const by = getLoggedInPhone() ?? "system";
    studentStore((prev) => {
      const queue = buildArWorkQueue(
        Object.values(prev.encounters).map((enc) => ({
          patientId: enc.patientId,
          patientName: enc.displayName,
          claimNumber: enc.claimNumber,
          remittances: enc.remittances,
          ledger: enc.ledger,
          arItems: enc.arItems,
        })),
        at,
      );
      const item = queue.find((i) => i.id === input.itemId);
      if (!item) return prev;
      if (item.status === "resolved") return prev; // resolved is final
      const key = encounterKey(item.patientId);
      const enc = prev.encounters[key];
      if (!enc) return prev;
      const existing = enc.arItems.find((s) => s.id === item.id);
      const assignedTo = (input.assignedTo ?? existing?.assignedTo ?? "").trim();
      // Same status, same owner: nothing to record.
      if (existing && existing.status === input.status && (existing.assignedTo ?? "") === assignedTo) {
        return prev;
      }
      const state: ArItemState = {
        id: item.id,
        claimNumber: item.claimNumber,
        status: input.status,
        ...(existing?.action ? { action: existing.action } : {}),
        ...(existing?.reasonCode ? { reasonCode: existing.reasonCode } : {}),
        ...(assignedTo ? { assignedTo } : {}),
        ...(input.note ?? existing?.note ? { note: input.note ?? existing?.note } : {}),
        at,
        by,
      };
      return {
        ...prev,
        encounters: {
          ...prev.encounters,
          [key]: { ...enc, arItems: [...enc.arItems.filter((s) => s.id !== item.id), state] },
        },
      };
    });
    setArNow(at);
  };

  const addCallRecord = (record: ARCallRecord) => {
    if (refuseStudentWrite(store.activePatientId, "The AR call record")) return;
    setArCalls((prev) => [...prev, record]);
  };

  const assignDenial = (claimId: string, agent: string) => {
    setDeniedClaims((prev) =>
      prev.map((c) => (c.id === claimId ? { ...c, assignedTo: agent } : c))
    );
  };

  const getClaimsByAging = () => {
    const buckets: Record<string, DeniedClaim[]> = {
      "0-30": [],
      "31-60": [],
      "61-90": [],
      "90+": [],
    };
    deniedClaims.forEach((c) => {
      const bucket = determineAgingBucket(c.deniedAt);
      buckets[bucket].push(c);
    });
    return buckets;
  };

  // PA lifecycle functions
  const addPARecord = (record: PARecordStore) => {
    // The Tutorial Patient's authorisation is part of the worked example: the
    // store refuses a student write and says why (spec § C).
    if (refuseStudentWrite(record.patientId, "The prior authorisation")) return;
    // Data scoping (audit item 5): a prior auth belongs to a patient. A record
    // with no patient is not stored — it would show in every patient's queue as
    // an authorisation nobody owns. The PA screen refuses first and says why.
    if (scopingRefusal({ patientId: record.patientId, encounterId: encounterIdFor(record.patientId) })) {
      return;
    }
    setPaRecords((prev) => {
      // Replace existing record for same patient/procedure, or add new
      const existing = prev.findIndex((r) => r.patientId === record.patientId && r.id === record.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = record;
        return updated;
      }
      return [...prev, record];
    });
  };

  const updatePAStatus = (id: string, status: string) => {
    const owned = paRecords.find((r) => r.id === id);
    if (refuseStudentWrite(owned?.patientId, "The prior authorisation")) return;
    setPaRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r))
    );
  };

  const getRoleLabel = (role: Role) => ROLE_LABELS[role] ?? role;

  return (
    <PipelineContext.Provider
      value={{
        state,
        activePatientId: store.activePatientId,
        selectPatient,
        getEncounter,
        allEncounters: store.encounters,
        currentRole,
        setRole,
        rememberChartStage,
        submitToCoding,
        writeNoteFor,
        submitToBilling,
        setCodingLinePlaceOfService,
        submitClaim,
        setClaimForm,
        patchClaimForm,
        setDemoFillMissingBoxes,
        appendStatusEvent,
        transmitClaim,
        adjudicateClaim,
        postRemittance,
        postPatientPayment,
        handleDenial,
        submitPA,
        completePipeline,
        getRoleLabel,
        deniedClaims,
        arCalls,
        arWorkItems,
        resolveArItem,
        updateArItemWork,
        addCallRecord,
        assignDenial,
        getClaimsByAging,
        paRecords,
        addPARecord,
        updatePAStatus,
        resetEncounter,
        setPatientDisplayName,
        seedTutorialOnOpen,
      }}
    >
      {children}
    </PipelineContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────

export function usePipeline(): PipelineContextValue {
  const ctx = useContext(PipelineContext);
  if (!ctx) throw new Error("usePipeline must be used within a PipelineProvider");
  return ctx;
}
