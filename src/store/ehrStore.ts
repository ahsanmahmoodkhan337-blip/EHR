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
 *   - reset / export / import of all user data (section 6).
 *
 * Deliberately NOT in this slice: Supabase sync, working-context restore,
 * note autosave and the full activity-log wiring (spec sections 4, 5, 7).
 */

import { useMemo } from "react";
import { create } from "zustand";
import { createStore as createIdbStore, get as idbGet, set as idbSet } from "idb-keyval";
import type { Patient, CaseState } from "./patientStore";

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
export const SCHEMA_VERSION = 2;
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
    dental: null,
    legacy: null,
    mrnSequence: 0,
  };
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

async function readEnvelope(phone: string): Promise<unknown | null> {
  if (hasIndexedDb()) {
    try {
      const value = await idbGet<unknown>(`${IDB_KEY_PREFIX}${phone}`, idbStore);
      if (value) return value;
    } catch (e) {
      console.warn("ehrStore: IndexedDB read failed, trying localStorage", e);
    }
  }
  try {
    const raw = localStorage.getItem(`${LS_KEY_PREFIX}${phone}`);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch (e) {
    console.warn("ehrStore: localStorage read failed", e);
    return null;
  }
}

async function writeEnvelope(phone: string, envelope: EhrEnvelope): Promise<void> {
  let wroteToIdb = false;
  if (hasIndexedDb()) {
    try {
      await idbSet(`${IDB_KEY_PREFIX}${phone}`, envelope, idbStore);
      wroteToIdb = true;
    } catch (e) {
      console.warn("ehrStore: IndexedDB write failed, falling back to localStorage", e);
    }
  }
  if (!wroteToIdb) {
    try {
      localStorage.setItem(`${LS_KEY_PREFIX}${phone}`, JSON.stringify(envelope));
    } catch (e) {
      console.warn("ehrStore: localStorage write failed", e);
    }
  }
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
  createAppointment: (input: NewAppointmentInput) => EhrAppointment;
  updateAppointment: (id: string, patch: Partial<EhrAppointment>) => void;
  setAppointmentStatus: (id: string, status: EhrAppointmentStatus) => void;
  deleteAppointment: (id: string) => void;
  updateCase: (patientId: string, updater: (current: CaseState) => CaseState) => void;

  resetUserData: () => Promise<void>;
  exportUserData: () => string;
  importUserData: (json: string) => { ok: boolean; error?: string; counts?: Record<string, number> };
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

    const stored = await readEnvelope(phone);
    let user: UserData;
    if (stored) {
      const migrated = migrateEnvelope(stored);
      user = migrated ? migrated.user : emptyUser();
    } else {
      // First load for this student — absorb the legacy keys rather than orphan them.
      user = absorbLegacyKeys(phone);
    }
    user.mrnSequence = Math.max(
      user.mrnSequence,
      highestMrnSequence([...get().seedPatients, ...user.patients]),
    );
    set({ phone, hydrated: true, user });
  },

  unload: () => {
    const { phone, user, hydrated } = get();
    if (phone && hydrated) {
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
        activity: [...s.user.activity, entry],
      },
    }));
    return patient;
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
        activity: [...s.user.activity, entry],
      },
    }));
    return appointment;
  },

  updateAppointment: (id, patch) => {
    // Upsert: a seed/demo appointment edited by the student becomes a user
    // record, so seed data is never mutated in place (section 2).
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
  },

  setAppointmentStatus: (id, status) => {
    get().updateAppointment(id, { status });
  },

  deleteAppointment: (id) => {
    set((s) => ({
      user: { ...s.user, appointments: s.user.appointments.filter((a) => a.id !== id) },
    }));
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

/** Write the current user slice for `phone` right now (used by reset/import). */
export function flushEhrStore(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const { phone, hydrated, user } = useEhrStore.getState();
  if (!phone || !hydrated) return;
  void writeEnvelope(phone, envelopeFor(phone, user));
}

useEhrStore.subscribe((state, prev) => {
  if (!state.phone || !state.hydrated) return;
  if (state.user === prev.user) return;
  const phone = state.phone;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const current = useEhrStore.getState();
    if (current.phone !== phone) return;
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
