/**
 * Persistence — Per-user two-layer storage for appointments and encounter state
 *
 * Layer 1 (always on): localStorage keyed by the logged-in student's phone.
 *   Every student's data lives under `hh_userdata_<phone>`, so it survives
 *   refresh and follows the student across sessions on the same device.
 *
 * Layer 2 (optional): Supabase sync for cross-device continuity. Falls back
 *   silently to localStorage-only when the `user_data` table does not exist
 *   yet (e.g. Supabase not provisioned / env vars missing) — same graceful
 *   degradation pattern as accessStore.syncFromSupabase().
 *
 * This module is storage-agnostic: the patientStore, pipelineStore and the
 * appointment state in routes/index.tsx each read/write their own slice of
 * the same per-user blob via `loadUserData` / `saveUserData`.
 */
import { supabase } from "./supabase";
import type { CaseState } from "./patientStore";
import type { DeniedClaim, ARCallRecord, PARecordStore, Role } from "./pipelineStore";
import {
  encounterKey,
  normalizePipelineStore,
  type PipelineEncounter,
  type PipelineStoreState,
} from "./pipelineEncounter";
import type { Appointment } from "../components/TabsEpic/DailySchedule";
import type { AccountSecurityState } from "./accountSecurity";
import { migrateClaimData } from "../utils/claimAutoFill";
import { claimNumberSequence, claimStatusFromLegacy, mintClaimNumber } from "../domain/claimStatus";
import { appendStatusEvent, makeStatusEvent } from "../domain/statusEvent";
import { describeStorageError, markFailed, writeAutosaved } from "./autosave";

const STORAGE_PREFIX = "hh_userdata_";
/**
 * v2 added the structured CMS-1500 record (`pipeline.claimForm`).
 * v3 made the pipeline one encounter per patient (`activePatientId` +
 * `encounters`), so picking a patient loads their work instead of wiping it.
 * v4 is the status engine (`specs/status-engine.md` §8): every claim gets a
 * claim number, a claim status, and a MIGRATED timeline entry. Nothing is
 * invented — no `accepted`, no money, no CARC.
 * v5 is money cycle slice 2: every encounter gains `remittances` (the 835s the
 * payer sent) and `ledger` (the posted money). Both start empty on a migrated
 * record — no payment, no adjustment and no patient balance is invented for a
 * claim that was saved before the ledger existed, and a claim status carried
 * from v4 stays exactly what it said.
 */
const BLOB_VERSION = 5;

export interface PersistedUserData {
  v: number;
  updatedAt: string;
  appointments?: Appointment[];
  caseStates?: Record<string, CaseState>;
  pipeline?: PipelineStoreState;
  currentRole?: Role;
  deniedClaims?: DeniedClaim[];
  arCalls?: ARCallRecord[];
  paRecords?: PARecordStore[];
  security?: AccountSecurityState;
}

/** localStorage key for a given phone. */
export function userDataKey(phone: string): string {
  return `${STORAGE_PREFIX}${phone}`;
}

/**
 * Schema migration.
 * v1 → v2 back-fills `pipeline.claimForm` from the legacy `claimData` box map
 * and makes sure the new fields exist, so a student who had a claim open before
 * the CMS-1500 replica shipped keeps their data.
 * v2 → v3 turns the single stored encounter into that patient's encounter in
 * the per-patient map, so a student mid-workflow keeps their place.
 * v3 → v4 (status engine, `specs/status-engine.md` §8) gives every claim a claim
 * number, a claim status read from the old `PipelineStatus`, and one MIGRATED
 * timeline entry saying exactly what was migrated. The rules, in order:
 *   - `pending` / `charted` / `coded` → no claim (null number, null status);
 *   - `billed` → `submitted` — **never `accepted`**, because no 277CA happened;
 *   - `denied` → `denied`, and the old denial code string is carried **verbatim**
 *     in the entry's text — never translated into a CARC;
 *   - `paid` → `paid` with no `amountCents` (invent no money) and `migrated`;
 *   - `reprocessed` → `reprocessed`;
 *   - an encounter with an open claim form but no recorded claim status starts as
 *     a `draft` claim: it exists, nothing was submitted, and nothing is claimed;
 *   - `deniedClaims` rows keep every field, gain `patientId` / `claimId` /
 *     `claimNumber`, and a row whose old `encounterId` was `"unknown"` keeps its
 *     place in the unassigned bucket instead of being dropped.
 * `caseStates.*` are not migrated: they were never persisted, so they are
 * projections now, not a source of truth.
 *
 * v4 → v5 adds `remittances` and `ledger` to every encounter (normalised to
 * empty arrays by `normalizeEncounter`) and changes nothing else: a claim saved
 * before the ledger existed keeps its status and gains no money.
 */
function migrateBlob(parsed: PersistedUserData): PersistedUserData {
  if ((parsed.v ?? 1) >= BLOB_VERSION) return parsed;
  const pipeline = parsed.pipeline as unknown as
    | (Partial<PipelineEncounter> & { claimForm?: PipelineEncounter["claimForm"] })
    | undefined;
  if (pipeline && !("encounters" in pipeline)) {
    if (!pipeline.claimForm) pipeline.claimForm = migrateClaimData(pipeline.claimData ?? {});
    if (!Array.isArray(pipeline.codingLines)) pipeline.codingLines = [];
  }
  const normalized = pipeline
    ? normalizePipelineStore(pipeline, parsed.currentRole ?? "scribe")
    : parsed.pipeline;
  // The blob's own timestamp, so a reload does not keep re-dating the migration.
  const at = parsed.updatedAt || new Date().toISOString();
  const migrated = normalized ? migratePipelineToV4(normalized, at) : normalized;
  return {
    ...parsed,
    pipeline: migrated,
    deniedClaims:
      parsed.deniedClaims && migrated
        ? migrateDeniedClaimsToV4(parsed.deniedClaims, migrated.encounters)
        : parsed.deniedClaims,
    v: BLOB_VERSION,
  };
}

/**
 * Give every claim in a v3 store a number, a status and its MIGRATED entry.
 * Numbers continue past the highest one already present, so a number is never
 * reused and a re-run cannot mint a second one for the same claim.
 */
function migratePipelineToV4(store: PipelineStoreState, at: string): PipelineStoreState {
  let sequence = Object.values(store.encounters).reduce(
    (max, enc) => Math.max(max, claimNumberSequence(enc.claimNumber)),
    0,
  );
  const nextNumber = () => mintClaimNumber((sequence += 1));

  const encounters: Record<string, PipelineEncounter> = {};
  for (const [key, encounter] of Object.entries(store.encounters)) {
    encounters[key] = migrateEncounterToV4(encounter, at, nextNumber);
  }
  return { ...store, encounters };
}

function migrateEncounterToV4(
  encounter: PipelineEncounter,
  at: string,
  nextNumber: () => string,
): PipelineEncounter {
  // Already migrated (or written by this build): leave it exactly as it is.
  if (encounter.claimNumber) return encounter;

  const legacyStatus = encounter.status;
  const recorded = claimStatusFromLegacy(legacyStatus);
  const claimExists = recorded !== null || !!encounter.claimForm;
  if (!claimExists) {
    return {
      ...encounter,
      claimNumber: null,
      claimStatus: null,
      claimStatusMigrated: false,
      holds: [],
      statusEvents: encounter.statusEvents ?? [],
    };
  }

  const claimNumber = nextNumber();
  const claimStatus = recorded ?? "draft";
  const event = makeStatusEvent(
    {
      entityType: "claim",
      entityId: claimNumber,
      patientId: encounter.patientId,
      claimNumber,
      at,
      from: null,
      to: claimStatus,
      by: "system",
      jobRole: "system",
      reasonCode: "MIGRATED",
      reason: migrationReason(legacyStatus, recorded, encounter.denialInfo?.code),
    },
    encounter.statusEvents,
  );

  return {
    ...encounter,
    claimNumber,
    claimStatus,
    claimStatusMigrated: true,
    holds: [],
    statusEvents: appendStatusEvent(encounter.statusEvents ?? [], event),
  };
}

/**
 * One plain-English sentence saying what the old record held. The old denial
 * code is quoted exactly as saved — this migration assigns no CARC, because
 * translating an unrecognised string into one would teach the wrong code.
 */
function migrationReason(
  legacyStatus: PipelineEncounter["status"],
  recorded: ReturnType<typeof claimStatusFromLegacy>,
  denialCode: string | undefined,
): string {
  if (!recorded) {
    return `Migrated from an earlier saved record: a claim was open on this encounter but its status was never recorded, so it starts as a draft. Nothing has been submitted.`;
  }
  switch (recorded) {
    case "submitted":
      return `Migrated from an earlier saved record: status "${legacyStatus}" → submitted. No 277CA was ever recorded, so this claim is not shown as accepted.`;
    case "denied":
      return denialCode
        ? `Migrated from an earlier saved record: status "${legacyStatus}". The denial code as saved was "${denialCode}" — carried over exactly as recorded, with no CARC assigned.`
        : `Migrated from an earlier saved record: status "${legacyStatus}". No denial code was recorded.`;
    case "paid":
      return `Migrated from an earlier saved record: status "${legacyStatus}". No payment amount was recorded, so none is shown.`;
    case "reprocessed":
      return `Migrated from an earlier saved record: status "${legacyStatus}".`;
    default:
      return `Migrated from an earlier saved record: status "${legacyStatus}".`;
  }
}

/**
 * `deniedClaims` rows carry their patient and their claim number after v4.
 * A row whose old `encounterId` was `"unknown"` lands in the unassigned bucket
 * (patientId null) and is kept, never dropped — the AR screen shows it as a
 * claim with no patient attached.
 */
function migrateDeniedClaimsToV4(
  rows: DeniedClaim[],
  encounters: Record<string, PipelineEncounter>,
): DeniedClaim[] {
  return rows.map((row) => {
    const rawId = row.encounterId;
    const patientId = row.patientId ?? (rawId && rawId !== "unknown" ? rawId : null);
    const encounter = patientId ? encounters[encounterKey(patientId)] : undefined;
    const claimNumber = row.claimNumber ?? encounter?.claimNumber ?? undefined;
    return {
      ...row,
      patientId,
      // The claim number is this build's claim identity, so the id mirrors it.
      claimId: row.claimId ?? claimNumber,
      claimNumber,
    };
  });
}


/** Read the full per-user blob from localStorage (null when absent/corrupt). */
export function loadUserData(phone: string | null | undefined): PersistedUserData | null {
  if (!phone) return null;
  try {
    const raw = localStorage.getItem(userDataKey(phone));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedUserData;
    if (!parsed || typeof parsed !== "object") return null;
    return migrateBlob(parsed);
  } catch (e) {
    console.warn("loadUserData: failed to parse storage for", phone, e);
    return null;
  }
}

/**
 * Write a slice of the per-user blob. Merges into whatever is already stored
 * for this phone so the patient and pipeline stores never clobber each other.
 * Layer 2 (Supabase) is fire-and-forget; failures are logged, never thrown.
 */
export function saveUserData(phone: string | null | undefined, slice: Partial<PersistedUserData>): void {
  if (!phone) return;
  let blob: PersistedUserData;
  try {
    const existing = loadUserData(phone) ?? {};
    blob = {
      ...existing,
      ...slice,
      v: BLOB_VERSION,
      updatedAt: new Date().toISOString(),
    };
  } catch (e) {
    // Building the blob failed, so nothing was written. Say so rather than
    // leaving the student believing the screen is saved (spec item 9).
    markFailed("Encounter", describeStorageError(e));
    console.warn("saveUserData: could not build the record for", phone, e);
    return;
  }
  // The write reports itself: "saving" → "saved at HH:MM", or "not saved" with
  // the reason and a retry. It is never silent (plan: Known Risks).
  const wrote = writeAutosaved(userDataKey(phone), JSON.stringify(blob), "Encounter");
  if (wrote) {
    // Layer 2 — cross-device sync. Never blocks the UI, and never changes what
    // the indicator says about the local copy the student is relying on.
    void pushToSupabase(phone, blob);
  }
}

/** Remove this user's local copy entirely (used only on explicit data reset). */
export function clearUserData(phone: string | null | undefined): void {
  if (!phone) return;
  try {
    localStorage.removeItem(userDataKey(phone));
  } catch (e) {
    console.warn("clearUserData failed for", phone, e);
  }
}

/**
 * Pull the freshest copy for this phone from Supabase and merge it into
 * localStorage. Resolves to the merged blob, or null when Supabase is
 * unavailable / the table doesn't exist yet (graceful degradation).
 */
export async function syncUserDataFromSupabase(phone: string | null | undefined): Promise<PersistedUserData | null> {
  if (!phone) return null;
  if (!supabase) return loadUserData(phone); // local-only mode — localStorage is source of truth
  try {
    const { data, error } = await supabase
      .from("user_data")
      .select("data, updated_at")
      .eq("phone", phone)
      .maybeSingle();
    if (error) {
      // Table missing / no permission / offline — degrade to localStorage.
      console.warn("syncUserDataFromSupabase: Supabase unavailable, using localStorage:", error.message);
      return loadUserData(phone);
    }
    if (data?.data && typeof data.data === "object") {
      const remote = migrateBlob(data.data as PersistedUserData);
      const local = loadUserData(phone);
      // Prefer whichever was updated more recently — but always let the fresher
      // `security` slice win, because device binding + active session are
      // cross-device truth: a stale local copy must not mask a newer login.
      const merged = !local
        ? remote
        : (remote.updatedAt || "") > (local.updatedAt || "")
          ? { ...remote, ...local, security: remote.security ?? local.security, updatedAt: remote.updatedAt }
          : { ...local, security: remote.security ?? local.security };
      localStorage.setItem(userDataKey(phone), JSON.stringify(merged));
      return merged;
    }
    return loadUserData(phone);
  } catch (e) {
    console.warn("syncUserDataFromSupabase: sync failed, using localStorage:", e);
    return loadUserData(phone);
  }
}

/** Fire-and-forget upsert of the blob into Supabase. */
async function pushToSupabase(phone: string, blob: PersistedUserData): Promise<void> {
  if (!supabase) return; // local-only mode
  try {
    const { error } = await supabase
      .from("user_data")
      .upsert({ phone, data: blob, updated_at: blob.updatedAt }, { onConflict: "phone" });
    if (error) {
      console.warn("pushToSupabase: upsert failed (table may not exist yet):", error.message);
    }
  } catch (e) {
    console.warn("pushToSupabase: sync skipped:", e);
  }
}

/** True when any persisted per-user blob exists on this device. */
export function hasLocalUserData(phone: string | null | undefined): boolean {
  return phone ? loadUserData(phone) !== null : false;
}