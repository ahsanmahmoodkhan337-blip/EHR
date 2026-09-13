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
import type { PipelineState, DeniedClaim, ARCallRecord, PARecordStore, Role } from "./pipelineStore";
import type { Appointment } from "../components/TabsEpic/DailySchedule";

const STORAGE_PREFIX = "hh_userdata_";
const BLOB_VERSION = 1;

export interface PersistedUserData {
  v: number;
  updatedAt: string;
  appointments?: Appointment[];
  caseStates?: Record<string, CaseState>;
  pipeline?: PipelineState;
  currentRole?: Role;
  deniedClaims?: DeniedClaim[];
  arCalls?: ARCallRecord[];
  paRecords?: PARecordStore[];
}

/** localStorage key for a given phone. */
export function userDataKey(phone: string): string {
  return `${STORAGE_PREFIX}${phone}`;
}

/** Read the full per-user blob from localStorage (null when absent/corrupt). */
export function loadUserData(phone: string | null | undefined): PersistedUserData | null {
  if (!phone) return null;
  try {
    const raw = localStorage.getItem(userDataKey(phone));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedUserData;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
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
  try {
    const existing = loadUserData(phone) ?? {};
    const blob: PersistedUserData = {
      ...existing,
      ...slice,
      v: BLOB_VERSION,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(userDataKey(phone), JSON.stringify(blob));
    // Layer 2 — cross-device sync. Never blocks the UI.
    void pushToSupabase(phone, blob);
  } catch (e) {
    console.warn("saveUserData: localStorage write failed for", phone, e);
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
      const remote = data.data as PersistedUserData;
      const local = loadUserData(phone);
      // Prefer whichever was updated more recently.
      const merged = !local
        ? remote
        : (remote.updatedAt || "") > (local.updatedAt || "")
          ? { ...remote, ...local, updatedAt: remote.updatedAt }
          : local;
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