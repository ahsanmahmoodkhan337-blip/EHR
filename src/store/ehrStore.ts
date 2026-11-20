/**
 * Central EHR store — Phase 0 "one persisted store" (spec sections 1, 2, 3, 6)
 *
 * Inspiration: the single patient-centric database behind Epic (Chronicles) and
 * eClinicalWorks — one record set that every screen reads and writes, instead of
 * each screen keeping its own copy of patients and appointments in React state.
 *
 * What this module owns:
 *   - the user's patients, appointments, encounters, notes, orders, claims,
 *     prior auths, payments, tasks, activity log and per-patient case state;
 *   - a read-only **seed** namespace (built-in demo patients + demo
 *     appointments) merged on read, where a user record always wins over a seed
 *     record with the same id (section 2);
 *   - `schemaVersion` + a migration chain run on every load, which absorbs the
 *     legacy per-phone keys `hh_userdata_<phone>` and `hh_dental_track_<phone>`
 *     so no student loses work on first load (sections 1 + 2);
 *   - persistence to IndexedDB via `idb-keyval`, debounced 300 ms, with a
 *     localStorage fallback when IndexedDB is unavailable (section 1);
 *   - auto-MRN allocation `HH-000123` (zero-padded, monotonic, never reused)
 *     used by New Appointment → search-or-register (section 3);
 *   - reset / export / import of all user data (section 6);
 *   - the **working context** — last patient, open encounter, role, chart tab
 *     and workspace tab — restored on the next load (section 4);
 *   - **note drafts**, one per patient, written by autosave rather than by a
 *     Save button (section 5);
 *   - the **activity log**: every create, edit and delete of a patient,
 *     appointment or note is recorded with time, role, user, patientId,
 *     entity, action and a before/after digest (section 7).
 *
 * Deliberately NOT in this slice: Supabase sync.
 */

import { useMemo } from "react";
import { create } from "zustand";
import { createStore as createIdbStore, get as idbGet, set as idbSet } from "idb-keyval";
import type { Patient, CaseState, PatientInsurance } from "./patientStore";
import { deriveInsuranceRecord } from "../utils/insuranceRecord";
import { markFailed, markSaved, markSaving } from "./autosave";

// ─── Types ─────────────────────────────────────────────────────────

export type Track = "medical" | "dental";

export type EhrAppointmentStatus =
  | "scheduled"
  | "in-progress"
  | "completed"
  | "cancelled"
  | "no-show";

export interface EhrAppointment {
  id: string;
  /** Links the appointment to a patient record. Null only for legacy rows. */
  patientId: string | null;
  patientName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  type: string;
  duration: number; // minutes
  notes: string;
  status: EhrAppointmentStatus;
  provider?: string;
  location?: string;
  isNewPatient?: boolean;
  /** Built-in demo row — read-only, never persisted. */
  isSeed?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface EhrEncounter {
  id: string;
  patientId: string;
  appointmentId?: string | null;
  dateOfService: string;
  placeOfService: string;
  workflowStage: string;
  signedBy?: string;
  signedAt?: string;
  locked?: boolean;
}

export interface EhrNote {
  id: string;
  encounterId: string;
  template: string;
  chiefComplaint: string;
  hpi: string;
  ros: string;
  pe: string;
  assessmentPlan: string;
  addenda: string[];
  status: "Draft" | "Pending Sign" | "Signed" | "Addended";
  updatedAt: string;
}

export interface EhrOrder {
  id: string;
  encounterId: string;
  type: "lab" | "imaging" | "med" | "referral" | "procedure";
  code: string;
  priority: "Routine" | "Urgent" | "STAT";
  status: "Ordered" | "In Progress" | "Resulted" | "Cancelled";
  result?: string;
}

export interface EhrClaim {
  id: string;
  encounterId: string;
  cpt: string;
  modifiers: string[];
  icd10: string[];
  units: number;
  fee: number;
  status:
    | "Draft"
    | "Scrubbing"
    | "Ready"
    | "Submitted"
    | "Accepted"
    | "Rejected"
    | "Denied"
    | "Paid"
    | "Appealed";
  scrubberHits: string[];
}

export interface EhrPriorAuth {
  id: string;
  orderId: string;
  payer: string;
  cpt: string;
  icd10: string[];
  clinicalReason: string;
  attachments: string[];
  status: "Not Started" | "Submitted" | "Pended" | "Approved" | "Denied" | "Peer-to-Peer";
  authNumber?: string;
  validFrom?: string;
  validTo?: string;
}

export interface EhrPayment {
  id: string;
  claimId: string;
  source: "payer" | "patient";
  amount: number;
  adjustments: { carc?: string; rarc?: string; amount: number }[];
  date: string;
}

export interface EhrTask {
  id: string;
  type: "result" | "refill" | "message" | "denial" | "auth";
  patientId: string;
  assignedRole: string;
  due?: string;
  status: "Open" | "Done";
}

export interface ActivityEntry {
  time: string;
  role: string;
  user: string;
  patientId: string | null;
  entity: string;
  action: "create" | "update" | "delete";
  before?: unknown;
  after?: unknown;
}

/**
 * Where the student left off (section 4). Persisted with the rest of their
 * data so a refresh, a role switch or a log-out/log-in reopens the same
 * patient, encounter, role and tab instead of dropping them on the schedule.
 */
export interface WorkingContext {
  patientId: string | null;
  /** Open encounter for that patient, when one exists yet. */
  encounterId: string | null;
  /** Pipeline role: scribe | coder | biller | prior-auth | ar-voice. */
  role: string;
  /** Chart tab (TabsEpic). */
  tab: string;
  /** Workspace tab: schedule | chart | inbasket | note. */
  workspace: string;
  updatedAt: string;
}

/** The fields of a progress note — the shape the scribe screens edit. */
export interface NoteFields {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

/**
 * An unsigned progress-note draft (section 5), one per patient. Written by the
 * autosave in `routes/index.tsx` every 5 s and on blur — nothing depends on the
 * student pressing Save. `savedAt` drives the "Saved 12:04 PM" indicator.
 */
export interface NoteDraft {
  patientId: string;
  encounterId: string | null;
  fields: NoteFields;
  status: "Draft" | "Signed";
  savedAt: string;
  updatedAt: string;
}

/** Everything that belongs to the student (persisted, exportable, resettable). */
export interface UserData {
  patients: Patient[];
  appointments: EhrAppointment[];
  encounters: EhrEncounter[];
  notes: EhrNote[];
  orders: EhrOrder[];
  claims: EhrClaim[];
  priorAuths: EhrPriorAuth[];
  payments: EhrPayment[];
  tasks: EhrTask[];
  activity: ActivityEntry[];
  caseStates: Record<string, CaseState>;
  /** Section 4 — where the student left off. */
  context: WorkingContext;
  /** Section 5 — unsigned note drafts, keyed by patientId. */
  noteDrafts: Record<string, NoteDraft>;
  /** Opaque dental-track blob absorbed from `hh_dental_track_<phone>`. */
  dental: unknown;
  /** Slices of `hh_userdata_<phone>` this slice does not own yet, kept intact. */
  legacy: Record<string, unknown> | null;
  /** Last allocated numeric MRN sequence (monotonic, never reused). */
  mrnSequence: number;
}

export interface EhrEnvelope {
  app: string;
  schemaVersion: number;
  updatedAt: string;
  /** Student the records belong to (informational — import never rebinds it). */
  phone?: string;
  user: UserData;
}

export interface NewPatientInput {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  sex?: string;
  phone?: string;
  email?: string;
  address?: string;
  track?: Track;
}

export interface NewAppointmentInput {
  patientId: string | null;
  patientName: string;
  date: string;
  time: string;
  type: string;
  duration: number;
  notes?: string;
  provider?: string;
  location?: string;
  status?: EhrAppointmentStatus;
  isNewPatient?: boolean;
}

// ─── Constants ─────────────────────────────────────────────────────

export const APP_ID = "healthcare-hustlers-ehr";
export const SCHEMA_VERSION = 4;
/** Newest activity entries kept — the log is a teaching aid, not an archive. */
export const MAX_ACTIVITY_ENTRIES = 500;
const DB_NAME = "healthcare-hustlers";
const IDB_STORE_NAME = "ehr";
const IDB_KEY_PREFIX = "hh_ehr_";
const LS_KEY_PREFIX = "hh_ehr_ls_";
const LEGACY_MEDICAL_PREFIX = "hh_userdata_";
const LEGACY_DENTAL_PREFIX = "hh_dental_track_";
const SAVE_DEBOUNCE_MS = 300;

const idbStore = createIdbStore(DB_NAME, IDB_STORE_NAME);

// ─── Small helpers ─────────────────────────────────────────────────

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyContext(): WorkingContext {
  return {
    patientId: null,
    encounterId: null,
    role: "scribe",
    tab: "summary",
    workspace: "schedule",
    updatedAt: "",
  };
}

function emptyUser(): UserData {
  return {
    patients: [],
    appointments: [],
    encounters: [],
    notes: [],
    orders: [],
    claims: [],
    priorAuths: [],
    payments: [],
    tasks: [],
    activity: [],
    caseStates: {},
    context: emptyContext(),
    noteDrafts: {},
    dental: null,
    legacy: null,
    mrnSequence: 0,
  };
}

/** Append an activity entry, keeping only the newest `MAX_ACTIVITY_ENTRIES`. */
function appendActivity(log: ActivityEntry[], entry: ActivityEntry): ActivityEntry[] {
  const next = [...log, entry];
  return next.length > MAX_ACTIVITY_ENTRIES
    ? next.slice(next.length - MAX_ACTIVITY_ENTRIES)
    : next;
}

/**
 * Compact before/after for a note edit: which sections hold text, plus a short
 * preview of each. Storing the full note on every autosave would bloat the
 * student's saved data for no teaching value.
 */
export function noteDigest(fields: NoteFields): string {
  return (Object.keys(fields) as (keyof NoteFields)[])
    .filter((key) => (fields[key] ?? "").trim().length > 0)
    .map((key) => `${key}: ${fields[key].trim().replace(/\s+/g, " ").slice(0, 80)}`)
    .join(" | ");
}

/** Short before/after summary of an appointment for the activity log. */
function appointmentDigest(a: EhrAppointment): Record<string, string> {
  return {
    patient: a.patientName,
    date: a.date,
    time: a.time,
    type: a.type,
    status: a.status,
  };
}

function sameNoteFields(a: NoteFields, b: NoteFields): boolean {
  return (
    a.subjective === b.subjective &&
    a.objective === b.objective &&
    a.assessment === b.assessment &&
    a.plan === b.plan
  );
}

function normalizeContext(raw: unknown): WorkingContext {
  const base = emptyContext();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  return {
    patientId: typeof r.patientId === "string" ? r.patientId : null,
    encounterId: typeof r.encounterId === "string" ? r.encounterId : null,
    role: typeof r.role === "string" && r.role ? r.role : base.role,
    tab: typeof r.tab === "string" && r.tab ? r.tab : base.tab,
    workspace: typeof r.workspace === "string" && r.workspace ? r.workspace : base.workspace,
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : "",
  };
}

function normalizeNoteDrafts(raw: unknown): Record<string, NoteDraft> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, NoteDraft> = {};
  for (const [patientId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const r = value as Record<string, unknown>;
    const fields = (r.fields ?? {}) as Record<string, unknown>;
    out[patientId] = {
      patientId,
      encounterId: typeof r.encounterId === "string" ? r.encounterId : null,
      fields: {
        subjective: String(fields.subjective ?? ""),
        objective: String(fields.objective ?? ""),
        assessment: String(fields.assessment ?? ""),
        plan: String(fields.plan ?? ""),
      },
      status: r.status === "Signed" ? "Signed" : "Draft",
      savedAt: typeof r.savedAt === "string" ? r.savedAt : "",
      updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : "",
    };
  }
  return out;
}

function ageFromDob(dob: string): number {
  const born = new Date(dob);
  if (Number.isNaN(born.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const beforeBirthday =
    now.getMonth() < born.getMonth() ||
    (now.getMonth() === born.getMonth() && now.getDate() < born.getDate());
  if (beforeBirthday) age -= 1;
  return Math.max(age, 0);
}

/** Highest `HH-######` sequence present anywhere — keeps MRNs monotonic. */
function highestMrnSequence(patients: Patient[]): number {
  let highest = 0;
  for (const p of patients) {
    const match = /^HH-(\d+)$/.exec(p.mrn ?? "");
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return highest;
}

/** Seed first, user data wins on id collision (section 2). */
export function mergeById<T extends { id: string }>(seed: T[], user: T[]): T[] {
  const userIds = new Set(user.map((r) => r.id));
  return [...seed.filter((r) => !userIds.has(r.id)), ...user];
}

// ─── Normalisation / migration ─────────────────────────────────────

function normalizeAppointment(raw: unknown): EhrAppointment | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const status = String(r.status ?? "scheduled");
  const allowed: EhrAppointmentStatus[] = [
    "scheduled",
    "in-progress",
    "completed",
    "cancelled",
    "no-show",
  ];
  return {
    id: String(r.id ?? uid("apt")),
    patientId: typeof r.patientId === "string" ? r.patientId : null,
    patientName: String(r.patientName ?? ""),
    date: String(r.date ?? ""),
    time: String(r.time ?? "09:00"),
    type: String(r.type ?? "Follow-up"),
    duration: Number(r.duration ?? 30) || 30,
    notes: String(r.notes ?? ""),
    status: (allowed as string[]).includes(status) ? (status as EhrAppointmentStatus) : "scheduled",
    provider: r.provider ? String(r.provider) : undefined,
    location: r.location ? String(r.location) : undefined,
    isNewPatient: Boolean(r.isNewPatient),
    isSeed: false,
    createdAt: r.createdAt ? String(r.createdAt) : undefined,
    updatedAt: r.updatedAt ? String(r.updatedAt) : undefined,
  };
}

function normalizeUser(raw: unknown): UserData {
  const base = emptyUser();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const arr = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
  return {
    patients: arr<Patient>(r.patients).filter((p) => p && typeof p.id === "string"),
    appointments: arr<unknown>(r.appointments)
      .map(normalizeAppointment)
      .filter((a): a is EhrAppointment => a !== null),
    encounters: arr<EhrEncounter>(r.encounters),
    notes: arr<EhrNote>(r.notes),
    orders: arr<EhrOrder>(r.orders),
    claims: arr<EhrClaim>(r.claims),
    priorAuths: arr<EhrPriorAuth>(r.priorAuths),
    payments: arr<EhrPayment>(r.payments),
    tasks: arr<EhrTask>(r.tasks),
    activity: arr<ActivityEntry>(r.activity),
    caseStates:
      r.caseStates && typeof r.caseStates === "object"
        ? (r.caseStates as Record<string, CaseState>)
        : {},
    context: normalizeContext(r.context),
    noteDrafts: normalizeNoteDrafts(r.noteDrafts),
    dental: r.dental ?? null,
    legacy:
      r.legacy && typeof r.legacy === "object" ? (r.legacy as Record<string, unknown>) : null,
    mrnSequence: Number(r.mrnSequence ?? 0) || 0,
  };
}

/**
 * Run the schema migrations on a persisted/imported envelope.
 * Returns null when the payload is unreadable or comes from a newer release
 * (we refuse rather than silently wipe a student's work).
 */
export function migrateEnvelope(raw: unknown): EhrEnvelope | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const version = typeof obj.schemaVersion === "number" ? obj.schemaVersion : 1;
  if (version > SCHEMA_VERSION) return null;

  let user: UserData;
  if (version >= 2) {
    user = normalizeUser(obj.user);
  } else {
    // v1 = the pre-Phase-0 `hh_userdata_<phone>` blob shape.
    user = normalizeUser(obj.user ?? obj);
  }

  // ── v1 → v2 ── appointments gain patientId + isSeed; case state moves into
  // the store. Nothing is dropped: unknown slices are carried in `legacy`.
  if (version < 2) {
    if (!user.legacy) {
      const rest: Record<string, unknown> = { ...obj };
      delete rest.appointments;
      delete rest.caseStates;
      delete rest.schemaVersion;
      delete rest.user;
      user.legacy = Object.keys(rest).length > 0 ? rest : null;
    }
  }

  // ── v2 → v3 ── `context` (section 4) and `noteDrafts` (section 5) are new.
  // `normalizeUser` above already defaults both, so a v2 export keeps every
  // patient, appointment and case file and simply starts with no draft saved.

  // ── v3 → v4 ── every patient gains an `insuranceRecord`: the payer name and
  // plan name are taken from the old free-text `insurance` string, and every
  // identifier (member ID, group, EDI payer ID) stays empty because no earlier
  // build captured one. Nothing is invented — a blank identifier falls through
  // to the claim's tagged demo value instead of printing a fake number.
  if (version < 4) {
    user.patients = user.patients.map((patient) => {
      const insuranceRecord = deriveInsuranceRecord(patient);
      return insuranceRecord ? { ...patient, insuranceRecord } : patient;
    });
  }

  return {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    user,
  };
}

/** Absorb the legacy per-phone localStorage keys on first load (section 1). */
function absorbLegacyKeys(phone: string): UserData {
  const user = emptyUser();
  try {
    const rawMedical = localStorage.getItem(`${LEGACY_MEDICAL_PREFIX}${phone}`);
    if (rawMedical) {
      const blob = JSON.parse(rawMedical) as Record<string, unknown>;
      const migrated = normalizeUser(blob);
      user.appointments = migrated.appointments;
      user.caseStates = migrated.caseStates;
      const rest: Record<string, unknown> = { ...blob };
      delete rest.appointments;
      delete rest.caseStates;
      user.legacy = Object.keys(rest).length > 0 ? rest : null;
    }
  } catch (e) {
    console.warn("ehrStore: could not absorb hh_userdata key", e);
  }
  try {
    const rawDental = localStorage.getItem(`${LEGACY_DENTAL_PREFIX}${phone}`);
    if (rawDental) user.dental = JSON.parse(rawDental) as unknown;
  } catch (e) {
    console.warn("ehrStore: could not absorb hh_dental_track key", e);
  }
  return user;
}

// ─── Storage layer: IndexedDB via idb-keyval, localStorage fallback ─

function hasIndexedDb(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    return false;
  }
}

/** ISO timestamps compare correctly as strings; a missing one is the oldest. */
function envelopeStamp(raw: unknown): number {
  const value = (raw as { updatedAt?: unknown } | null)?.updatedAt;
  const ms = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isNaN(ms) ? 0 : ms;
}

/** Newest of the two stored copies. A write that only landed in one backend
 * must never be shadowed by an older copy in the other. */
function newestOf(a: unknown | null, b: unknown | null): unknown | null {
  if (!a) return b;
  if (!b) return a;
  return envelopeStamp(b) > envelopeStamp(a) ? b : a;
}

async function readEnvelope(phone: string): Promise<unknown | null> {
  let fromIdb: unknown | null = null;
  if (hasIndexedDb()) {
    try {
      fromIdb = (await idbGet<unknown>(`${IDB_KEY_PREFIX}${phone}`, idbStore)) ?? null;
    } catch (e) {
      console.warn("ehrStore: IndexedDB read failed, trying localStorage", e);
    }
  }
  let fromLs: unknown | null = null;
  try {
    const raw = localStorage.getItem(`${LS_KEY_PREFIX}${phone}`);
    fromLs = raw ? (JSON.parse(raw) as unknown) : null;
  } catch (e) {
    console.warn("ehrStore: localStorage read failed", e);
  }
  return newestOf(fromIdb, fromLs);
}

/** Set false the first time the mirror is rejected (quota), so a full
 * localStorage does not throw on every save for the rest of the session. */
let mirrorEnabled = true;

async function writeEnvelope(phone: string, envelope: EhrEnvelope): Promise<void> {
  // Mirror to localStorage first and synchronously. This copy is what survives a
  // page teardown that happens before the IndexedDB transaction commits — the
  // sign-out/supersession path calls unload() and reloads in the same tick.
  markSaving("Chart");
  let mirrored = false;
  if (mirrorEnabled) {
    try {
      localStorage.setItem(`${LS_KEY_PREFIX}${phone}`, JSON.stringify(envelope));
      mirrored = true;
    } catch (e) {
      mirrorEnabled = false;
      console.warn("ehrStore: localStorage mirror failed, continuing with IndexedDB only", e);
    }
  }
  if (hasIndexedDb()) {
    try {
      await idbSet(`${IDB_KEY_PREFIX}${phone}`, envelope, idbStore);
      // IndexedDB is the primary copy, so this is a real save.
      markSaved("Chart");
      return;
    } catch (e) {
      console.warn("ehrStore: IndexedDB write failed, relying on the localStorage copy", e);
    }
  }
  // Neither copy landed → say so in the one autosave indicator, and offer the
  // same write again. A chart that did not save must never look saved.
  if (mirrored) markSaved("Chart");
  else
    markFailed("Chart", "no browser storage would take the write", () => {
      void writeEnvelope(phone, envelope);
    });
}

// ─── Store ─────────────────────────────────────────────────────────

interface EhrState {
  /** True once the persisted record set for `phone` has been loaded. */
  hydrated: boolean;
  phone: string | null;
  /** Read-only built-in demo patients (never persisted). */
  seedPatients: Patient[];
  /** Read-only built-in demo appointments (never persisted). */
  seedAppointments: EhrAppointment[];
  user: UserData;

  registerSeedPatients: (patients: Patient[]) => void;
  registerSeedAppointments: (appointments: EhrAppointment[]) => void;
  hydrateForPhone: (phone: string | null) => Promise<void>;
  unload: () => void;

  registerPatient: (input: NewPatientInput) => Patient;
  /**
   * Write the insurance record Registration & eligibility captured onto the
   * patient. A seed patient edited this way is copied into the user namespace
   * first, so the read-only demo record is never mutated in place (section 2).
   */
  updatePatientInsurance: (patientId: string, insurance: PatientInsurance) => void;
  /**
   * Write the identity Registration transcribed (name, date of birth) onto the
   * patient, so the banner, the right-hand summary and the claim all read it.
   * Only a field the chart is missing is written — a seeded patient's real DOB
   * is never replaced by the practice licence's date, and a mistyped name never
   * renames an existing chart. `dateOfBirth` is an ISO `YYYY-MM-DD` string.
   */
  updatePatientIdentity: (
    patientId: string,
    identity: { firstName?: string; lastName?: string; dateOfBirth?: string },
  ) => void;
  createAppointment: (input: NewAppointmentInput) => EhrAppointment;
  updateAppointment: (id: string, patch: Partial<EhrAppointment>) => void;
  setAppointmentStatus: (id: string, status: EhrAppointmentStatus) => void;
  deleteAppointment: (id: string) => void;
  updateCase: (patientId: string, updater: (current: CaseState) => CaseState) => void;

  // ── Section 4: working context ──
  setWorkingContext: (patch: Partial<Omit<WorkingContext, "updatedAt">>) => void;

  // ── Section 5: note autosave ──
  /** Write the patient's draft. No-op when nothing changed. Returns `savedAt`. */
  saveNoteDraft: (
    patientId: string,
    fields: NoteFields,
    options?: { encounterId?: string | null; status?: NoteDraft["status"] },
  ) => string | null;

  // ── Section 7: activity log ──
  logActivity: (
    entry: Omit<ActivityEntry, "time" | "role" | "user"> & { role?: string },
  ) => void;

  resetUserData: () => Promise<void>;
  exportUserData: () => string;
  importUserData: (json: string) => { ok: boolean; error?: string; counts?: Record<string, number> };
}

/** True when the in-memory record set holds anything a student would miss. */
function userHasRecords(user: UserData): boolean {
  return (
    user.patients.length > 0 ||
    user.appointments.length > 0 ||
    user.encounters.length > 0 ||
    user.notes.length > 0 ||
    user.claims.length > 0 ||
    Object.keys(user.caseStates).length > 0 ||
    Object.keys(user.noteDrafts).length > 0
  );
}

/**
 * Merge two record sets, `over` winning on every id.
 *
 * Used when a hydration read finishes after the student has already done work
 * in this session: the work on screen is newer than the copy on disk, so it
 * must never be replaced by it. Both sides are kept, nothing is dropped.
 */
function mergeUsers(base: UserData, over: UserData): UserData {
  const byId = <T extends { id: string }>(a: T[], b: T[]): T[] => {
    const map = new Map<string, T>();
    for (const record of a) map.set(record.id, record);
    for (const record of b) map.set(record.id, record);
    return [...map.values()];
  };
  return {
    patients: byId(base.patients, over.patients),
    appointments: byId(base.appointments, over.appointments),
    encounters: byId(base.encounters, over.encounters),
    notes: byId(base.notes, over.notes),
    orders: byId(base.orders, over.orders),
    claims: byId(base.claims, over.claims),
    priorAuths: byId(base.priorAuths, over.priorAuths),
    payments: byId(base.payments, over.payments),
    tasks: byId(base.tasks, over.tasks),
    activity: [...base.activity, ...over.activity].slice(-MAX_ACTIVITY_ENTRIES),
    caseStates: { ...base.caseStates, ...over.caseStates },
    context: over.context?.updatedAt ? over.context : base.context,
    noteDrafts: { ...base.noteDrafts, ...over.noteDrafts },
    dental: over.dental ?? base.dental,
    legacy: over.legacy ?? base.legacy,
    mrnSequence: Math.max(base.mrnSequence, over.mrnSequence),
  };
}

function envelopeFor(phone: string, user: UserData): EhrEnvelope {
  return {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    phone,
    user,
  };
}

export const useEhrStore = create<EhrState>()((set, get) => ({
  hydrated: false,
  phone: null,
  seedPatients: [],
  seedAppointments: [],
  user: emptyUser(),

  registerSeedPatients: (patients) => set({ seedPatients: patients }),
  registerSeedAppointments: (appointments) => set({ seedAppointments: appointments }),

  hydrateForPhone: async (phone) => {
    if (!phone) {
      get().unload();
      return;
    }
    if (get().phone === phone && get().hydrated) return;

    const startPhone = get().phone;
    const startUser = get().user;
    const stored = await readEnvelope(phone);

    // The read is asynchronous, so the session can move on while it is in
    // flight: another student is loaded, this one already hydrated, or the
    // student has registered a patient and booked them an appointment. In every
    // one of those cases this read is stale and must not replace what is on
    // screen — a late hydrate used to wipe work saved in the same session.
    const after = get();
    if (after.phone !== startPhone || after.hydrated) return;

    let user: UserData;
    if (stored) {
      const migrated = migrateEnvelope(stored);
      user = migrated ? migrated.user : emptyUser();
    } else {
      // First load for this student — absorb the legacy keys rather than orphan them.
      user = absorbLegacyKeys(phone);
    }
    // Anything created while the read was in flight is newer than the disk copy.
    if (after.user !== startUser) user = mergeUsers(user, after.user);
    user.mrnSequence = Math.max(
      user.mrnSequence,
      highestMrnSequence([...get().seedPatients, ...user.patients]),
    );
    set({ phone, hydrated: true, user });
  },

  unload: () => {
    const { phone, user, hydrated } = get();
    // Write even when hydration never completed, as long as there is work in
    // memory: a store that never hydrated is holding the only copy of that
    // patient and that appointment. Requiring `hydrated` here threw them away.
    if (phone && (hydrated || userHasRecords(user))) {
      void writeEnvelope(phone, envelopeFor(phone, user));
    }
    set({ phone: null, hydrated: false, user: emptyUser() });
  },

  registerPatient: (input) => {
    const state = get();
    const seq =
      Math.max(state.user.mrnSequence, highestMrnSequence(allPatients(state))) + 1;
    const now = new Date().toISOString();
    const patient: Patient = {
      id: uid("PAT"),
      mrn: `HH-${String(seq).padStart(6, "0")}`,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      dateOfBirth: input.dateOfBirth ?? "",
      age: input.dateOfBirth ? ageFromDob(input.dateOfBirth) : 0,
      gender: input.sex ?? "",
      phone: input.phone ?? "",
      email: input.email ?? "",
      address: input.address ?? "",
      emergencyContact: { name: "", phone: "", relation: "" },
      primaryCareProvider: "",
      insurance: "",
      chiefComplaint: "",
      vitals: {
        bloodPressure: "",
        heartRate: 0,
        temperature: 0,
        respiratoryRate: 0,
        oxygenSaturation: 0,
        recordedAt: now,
      },
      medications: [],
      allergies: [],
      labResults: [],
      encounters: [],
      problems: [],
      isSeed: false,
      track: input.track ?? "medical",
      createdBy: state.phone ?? undefined,
    };
    const entry: ActivityEntry = {
      time: now,
      role: "front-desk",
      user: state.phone ?? "unknown",
      patientId: patient.id,
      entity: "patient",
      action: "create",
      after: { mrn: patient.mrn, name: `${patient.firstName} ${patient.lastName}` },
    };
    set((s) => ({
      user: {
        ...s.user,
        patients: [...s.user.patients, patient],
        mrnSequence: seq,
        activity: appendActivity(s.user.activity, entry),
      },
    }));
    // Write now instead of waiting out the 300 ms debounce: a sign-out, a
    // superseded session or a reload straight after the click would otherwise
    // drop the appointment before it ever reached the disk.
    flushEhrStore();
    return patient;
  },

  updatePatientInsurance: (patientId, insurance) => {
    const state = get();
    const existing = mergeById(state.seedPatients, state.user.patients).find(
      (p) => p.id === patientId,
    );
    if (!existing) return;

    const now = new Date().toISOString();
    const record: PatientInsurance = { ...insurance, updatedAt: now };
    const entry: ActivityEntry = {
      time: now,
      role: "front-desk",
      user: state.phone ?? "unknown",
      patientId,
      entity: "patient",
      action: "update",
      before: existing.insuranceRecord?.primary.payerName
        ? { insurance: existing.insuranceRecord.primary.payerName }
        : undefined,
      after: {
        insurance: record.primary.payerName,
        memberId: record.primary.subscriberId,
        group: record.primary.groupNumber,
        secondary: record.secondary?.payerName ?? "none",
      },
    };

    set((s) => {
      const inUser = s.user.patients.some((p) => p.id === patientId);
      const patients = inUser
        ? s.user.patients.map((p) => (p.id === patientId ? { ...p, insuranceRecord: record } : p))
        : [...s.user.patients, { ...existing, isSeed: false, insuranceRecord: record }];
      return {
        user: { ...s.user, patients, activity: appendActivity(s.user.activity, entry) },
      };
    });
  },

  updatePatientIdentity: (patientId, identity) => {
    const state = get();
    const existing = mergeById(state.seedPatients, state.user.patients).find(
      (p) => p.id === patientId,
    );
    if (!existing) return;

    // Fill only what the chart lacks. A recorded DOB always wins over the
    // practice licence's date, and a name already on the chart is never
    // replaced by a transcription the student may have mistyped.
    const patch: Partial<Patient> = {};
    const hasDob =
      Boolean(existing.dateOfBirth) &&
      !Number.isNaN(new Date(existing.dateOfBirth).getTime());
    const typedDob = identity.dateOfBirth?.trim();
    if (!hasDob && typedDob) {
      patch.dateOfBirth = typedDob;
      patch.age = ageFromDob(typedDob);
    }
    if (!existing.firstName?.trim() && identity.firstName?.trim()) {
      patch.firstName = identity.firstName.trim();
    }
    if (!existing.lastName?.trim() && identity.lastName?.trim()) {
      patch.lastName = identity.lastName.trim();
    }
    if (Object.keys(patch).length === 0) return;

    const now = new Date().toISOString();
    const entry: ActivityEntry = {
      time: now,
      role: "front-desk",
      user: state.phone ?? "unknown",
      patientId,
      entity: "patient",
      action: "update",
      after: {
        name: `${patch.firstName ?? existing.firstName} ${patch.lastName ?? existing.lastName}`.trim(),
        dateOfBirth: patch.dateOfBirth ?? existing.dateOfBirth ?? "none",
      },
    };

    set((s) => {
      const inUser = s.user.patients.some((p) => p.id === patientId);
      const patients = inUser
        ? s.user.patients.map((p) => (p.id === patientId ? { ...p, ...patch } : p))
        : [...s.user.patients, { ...existing, isSeed: false, ...patch }];
      return {
        user: { ...s.user, patients, activity: appendActivity(s.user.activity, entry) },
      };
    });
  },

  createAppointment: (input) => {
    const now = new Date().toISOString();
    const appointment: EhrAppointment = {
      id: uid("apt"),
      patientId: input.patientId,
      patientName: input.patientName,
      date: input.date,
      time: input.time,
      type: input.type,
      duration: input.duration,
      notes: input.notes ?? "",
      status: input.status ?? "scheduled",
      provider: input.provider?.trim() ? input.provider.trim() : undefined,
      location: input.location,
      isNewPatient: input.isNewPatient ?? false,
      isSeed: false,
      createdAt: now,
      updatedAt: now,
    };
    const state = get();
    const entry: ActivityEntry = {
      time: now,
      role: "front-desk",
      user: state.phone ?? "unknown",
      patientId: appointment.patientId,
      entity: "appointment",
      action: "create",
      after: { date: appointment.date, time: appointment.time, type: appointment.type },
    };
    set((s) => ({
      user: {
        ...s.user,
        appointments: [...s.user.appointments, appointment],
        activity: appendActivity(s.user.activity, entry),
      },
    }));
    // Flush straight away — the appointment must be on disk before the modal
    // closes, not 300 ms later.
    flushEhrStore();
    return appointment;
  },

  updateAppointment: (id, patch) => {
    // Upsert: a seed/demo appointment edited by the student becomes a user
    // record, so seed data is never mutated in place (section 2).
    const before = mergeById(get().seedAppointments, get().user.appointments).find(
      (a) => a.id === id,
    );
    set((s) => {
      const now = new Date().toISOString();
      const inUser = s.user.appointments.some((a) => a.id === id);
      if (inUser) {
        return {
          user: {
            ...s.user,
            appointments: s.user.appointments.map((a) =>
              a.id === id ? { ...a, ...patch, id: a.id, updatedAt: now } : a,
            ),
          },
        };
      }
      const base = mergeById(s.seedAppointments, s.user.appointments).find((a) => a.id === id);
      if (!base) return {};
      const copy: EhrAppointment = { ...base, ...patch, id: base.id, isSeed: false, updatedAt: now };
      return { user: { ...s.user, appointments: [...s.user.appointments, copy] } };
    });
    if (!before) return;
    const after = { ...before, ...patch, id: before.id };
    get().logActivity({
      patientId: after.patientId,
      entity: "appointment",
      action: "update",
      before: appointmentDigest(before),
      after: appointmentDigest(after),
    });
  },

  setAppointmentStatus: (id, status) => {
    get().updateAppointment(id, { status });
  },

  deleteAppointment: (id) => {
    const before = mergeById(get().seedAppointments, get().user.appointments).find(
      (a) => a.id === id,
    );
    set((s) => ({
      user: { ...s.user, appointments: s.user.appointments.filter((a) => a.id !== id) },
    }));
    if (!before) return;
    get().logActivity({
      patientId: before.patientId,
      entity: "appointment",
      action: "delete",
      before: appointmentDigest(before),
    });
  },

  setWorkingContext: (patch) => {
    const current = get().user.context;
    const unchanged = (Object.keys(patch) as (keyof typeof patch)[]).every(
      (key) => current[key] === patch[key],
    );
    if (unchanged) return;
    set((s) => ({
      user: {
        ...s.user,
        context: { ...s.user.context, ...patch, updatedAt: new Date().toISOString() },
      },
    }));
  },

  saveNoteDraft: (patientId, fields, options) => {
    const state = get();
    const previous = state.user.noteDrafts[patientId];
    if (previous && sameNoteFields(previous.fields, fields)) return previous.savedAt;

    const now = new Date().toISOString();
    const draft: NoteDraft = {
      patientId,
      encounterId: options?.encounterId ?? previous?.encounterId ?? null,
      fields: { ...fields },
      status: options?.status ?? previous?.status ?? "Draft",
      savedAt: now,
      updatedAt: now,
    };
    const entry: ActivityEntry = {
      time: now,
      role: state.user.context.role,
      user: state.phone ?? "unknown",
      patientId,
      entity: "note",
      action: previous ? "update" : "create",
      before: previous ? noteDigest(previous.fields) : undefined,
      after: noteDigest(draft.fields),
    };
    set((s) => ({
      user: {
        ...s.user,
        noteDrafts: { ...s.user.noteDrafts, [patientId]: draft },
        activity: appendActivity(s.user.activity, entry),
      },
    }));
    return now;
  },

  logActivity: (entry) => {
    const state = get();
    const full: ActivityEntry = {
      time: new Date().toISOString(),
      role: entry.role ?? state.user.context.role,
      user: state.phone ?? "unknown",
      patientId: entry.patientId,
      entity: entry.entity,
      action: entry.action,
      before: entry.before,
      after: entry.after,
    };
    set((s) => ({ user: { ...s.user, activity: appendActivity(s.user.activity, full) } }));
  },

  updateCase: (patientId, updater) => {
    set((s) => ({
      user: {
        ...s.user,
        caseStates: {
          ...s.user.caseStates,
          [patientId]: updater(s.user.caseStates[patientId] ?? defaultCaseState(patientId)),
        },
      },
    }));
  },

  resetUserData: async () => {
    const { phone } = get();
    set({ user: emptyUser() });
    if (phone) {
      // Remove the legacy keys too, so a reset cannot resurrect old work on the
      // next load (the store now owns this phone's data).
      try {
        localStorage.removeItem(`${LEGACY_MEDICAL_PREFIX}${phone}`);
        localStorage.removeItem(`${LEGACY_DENTAL_PREFIX}${phone}`);
      } catch (e) {
        console.warn("ehrStore: could not clear legacy keys", e);
      }
      await writeEnvelope(phone, envelopeFor(phone, emptyUser()));
    }
  },

  exportUserData: () => {
    const { phone, user } = get();
    return JSON.stringify(envelopeFor(phone ?? "local", user), null, 2);
  },

  importUserData: (json) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json) as unknown;
    } catch {
      return { ok: false, error: "That file is not valid JSON." };
    }
    const raw = parsed as Record<string, unknown> | null;
    const version = raw && typeof raw.schemaVersion === "number" ? raw.schemaVersion : null;
    if (version === null) {
      return { ok: false, error: "This file has no schemaVersion, so it is not an EHR export." };
    }
    if (version > SCHEMA_VERSION) {
      return {
        ok: false,
        error: `This export comes from a newer release (schema ${version}); this build reads up to ${SCHEMA_VERSION}.`,
      };
    }
    const envelope = migrateEnvelope(parsed);
    if (!envelope) return { ok: false, error: "The file could not be migrated into this release." };
    envelope.user.mrnSequence = Math.max(
      envelope.user.mrnSequence,
      highestMrnSequence([...get().seedPatients, ...envelope.user.patients]),
    );
    set({ user: envelope.user, hydrated: true });
    const counts = {
      patients: envelope.user.patients.length,
      appointments: envelope.user.appointments.length,
    };
    return { ok: true, counts };
  },
}));

/** Minimal case state for a patient the store has not seen yet. */
export function defaultCaseState(patientId: string): CaseState {
  return {
    patientId,
    currentQueue: "QUEUE_REGISTRATION",
    auditLogs: [],
    modifier25Applied: false,
    billingStatus: "DRAFT",
    paStatus: "NOT_REQUIRED",
    arStatus: "NONE",
    routingNotes: [],
    followups: [],
  };
}

// ─── Debounced persistence (300 ms) ────────────────────────────────

let saveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Who is signed in, according to the access layer. Registered from
 * `accessStore` so the store can still persist when it was never told the
 * phone — a store stuck at `phone: null` used to drop every save silently,
 * which is how a registered patient's appointment vanished.
 */
let loggedInPhoneResolver: () => string | null = () => null;

export function registerLoggedInPhoneResolver(fn: () => string | null): void {
  loggedInPhoneResolver = fn;
}

function persistencePhone(state: EhrState): string | null {
  return state.phone ?? loggedInPhoneResolver();
}

/** Write the current user slice for `phone` right now (used by reset/import). */
export function flushEhrStore(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const state = useEhrStore.getState();
  const phone = persistencePhone(state);
  if (!phone) return;
  // Never write an empty record set over one that may be on disk; do write
  // whatever is in memory when the store never hydrated.
  if (!state.hydrated && !userHasRecords(state.user)) return;
  void writeEnvelope(phone, envelopeFor(phone, state.user));
}

useEhrStore.subscribe((state, prev) => {
  if (state.user === prev.user) return;
  const phone = persistencePhone(state);
  if (!phone) return;
  if (!state.hydrated && !userHasRecords(state.user)) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const current = useEhrStore.getState();
    if (persistencePhone(current) !== phone) return;
    void writeEnvelope(phone, envelopeFor(phone, current.user));
  }, SAVE_DEBOUNCE_MS);
});

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => flushEhrStore());
}

/** Load this student's store. Idempotent — safe to call from any screen. */
export function bootstrapEhrStore(phone: string | null): void {
  void useEhrStore.getState().hydrateForPhone(phone);
}

// ─── Merged selectors (seed + user, user wins) ─────────────────────

function allPatients(state: EhrState): Patient[] {
  return mergeById(state.seedPatients, state.user.patients);
}

export function selectPatients(state: EhrState): Patient[] {
  return allPatients(state);
}

export function selectAppointments(state: EhrState): EhrAppointment[] {
  return mergeById(state.seedAppointments, state.user.appointments);
}

export function selectPatientById(state: EhrState, id: string | null | undefined): Patient | undefined {
  if (!id) return undefined;
  return allPatients(state).find((p) => p.id === id);
}

/** All patients (seed + user) for list, storyboard and chart review. */
export function useAllPatients(): Patient[] {
  const seed = useEhrStore((s) => s.seedPatients);
  const user = useEhrStore((s) => s.user.patients);
  return useMemo(() => mergeById(seed, user), [seed, user]);
}

/** All appointments (seed + user) for the calendar. */
export function useAllAppointments(): EhrAppointment[] {
  const seed = useEhrStore((s) => s.seedAppointments);
  const user = useEhrStore((s) => s.user.appointments);
  return useMemo(() => mergeById(seed, user), [seed, user]);
}
