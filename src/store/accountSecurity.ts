/**
 * accountSecurity.ts — Account-sharing detection (device binding, active
 * session, login logging)
 *
 * Plan item 3. Login today is a bare phone number (no password), so a
 * hard block would lock out legitimate students. This module is therefore
 * DETECTION-ORIENTED and LOCAL-FIRST: it records enough signal to flag
 * casual credential sharing without ever refusing a valid approved phone.
 * A determined attacker bypassing the client is already an accepted,
 * known limitation in the plan.
 *
 * Three responsibilities:
 *   1. Device binding — a persistent per-device UUID (localStorage) is
 *      associated with each phone number. A phone appearing on a NEW
 *      device is flagged (isNewDevice) and the device is recorded.
 *   2. Single active session — each login mints a session token; when a
 *      second concurrent login arrives from a different device, the prior
 *      session is marked stale (session-stale event) and the event logged.
 *   3. Login logging — appends { phone, timestamp, deviceId, userAgent }
 *      (plus an `event` kind) to a per-phone log under the existing
 *      persistence namespace (`hh_userdata_<phone>` via persistence.ts),
 *      which already syncs to Supabase (`user_data`) when configured.
 *
 * No admin UI is built here — the "shared account" signal is surfaced as a
 * compact `SharingSignal` object, written to the student dashboard and
 * console-logged, ready for a future admin screen to read.
 */

import { loadUserData, saveUserData, syncUserDataFromSupabase, type PersistedUserData } from "./persistence";
import { normalizePhone } from "./accessStore";
import { supabase } from "./supabase";

const DEVICE_ID_KEY = "hh_device_id";
const MAX_LOG_ENTRIES = 200;

export type LoginEventKind = "login" | "concurrent-login" | "session-stale";

export interface LoginEvent {
  phone: string;
  /** ISO 8601 timestamp of the event. */
  timestamp: string;
  deviceId: string;
  userAgent: string;
  event: LoginEventKind;
}

export interface ActiveSession {
  token: string;
  deviceId: string;
  /** ISO 8601 timestamp when this session started. */
  startedAt: string;
}

/** Persisted per-phone slice stored inside the `security` field of the user blob. */
export interface AccountSecurityState {
  /** Distinct device IDs this phone has ever logged in from. */
  deviceIds: string[];
  /** Append-only login / session event log (capped to MAX_LOG_ENTRIES). */
  loginLog: LoginEvent[];
  /** The most recent (active) session token. */
  activeSession: ActiveSession | null;
}

/** Compact, human- and admin-readable summary of sharing risk for a phone. */
export interface SharingSignal {
  phone: string;
  currentDeviceId: string;
  /** Number of distinct devices this phone has logged in from. */
  distinctDeviceCount: number;
  /** True when the current device has not previously logged in for this phone. */
  isNewDevice: boolean;
  /** True when a login from a second device superseded an earlier session. */
  concurrentLoginDetected: boolean;
  /** ISO timestamp of the most recent login event, if any. */
  lastLoginAt: string | null;
  /** Roll-up flag: multi-device OR concurrent login observed. */
  flagged: boolean;
}

/**
 * Compact, device-agnostic sharing summary for admin review. Unlike
 * `SharingSignal`, this has no `currentDeviceId`/`isNewDevice` (those describe
 * the *reader's* device); it only carries the fields an admin cares about when
 * scanning the approved-user list for shared accounts.
 */
export interface AdminSharingSummary {
  phone: string;
  /** Number of distinct devices this phone has logged in from. */
  distinctDeviceCount: number;
  /** ISO timestamp of the most recent login event, if any. */
  lastLoginAt: string | null;
  /** True when a concurrent (multi-device) login was observed. */
  concurrentLoginDetected: boolean;
  /** Roll-up flag: multi-device OR concurrent login observed. */
  flagged: boolean;
}

function generateId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* ignore — fall through to timestamp+random fallback */
  }
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

function emptyState(): AccountSecurityState {
  return { deviceIds: [], loginLog: [], activeSession: null };
}

function buildSignal(
  phone: string,
  state: AccountSecurityState | null,
  currentDeviceId: string,
  isNewDevice: boolean,
  concurrent: boolean,
): SharingSignal {
  const last = state?.loginLog[state.loginLog.length - 1] ?? null;
  const sawConcurrent = concurrent || (state?.loginLog.some((e) => e.event === "concurrent-login") ?? false);
  const deviceCount = state?.deviceIds.length ?? 0;
  return {
    phone,
    currentDeviceId,
    distinctDeviceCount: deviceCount,
    isNewDevice,
    concurrentLoginDetected: sawConcurrent,
    lastLoginAt: last?.timestamp ?? null,
    flagged: deviceCount > 1 || sawConcurrent,
  };
}

/**
 * Return (creating once) the persistent device identifier for this browser.
 * Stored at the device level (not per-phone) since it describes the machine.
 */
export function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const id = generateId();
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    // localStorage unavailable — fall back to an ephemeral id (best effort).
    return generateId();
  }
}

/**
 * Record a login for `phone`: refresh device binding, mint a session token,
 * mark any prior session on a different device stale, and append to the log.
 * Resolves to a SharingSignal suitable for the dashboard / console / admin UI.
 *
 * Call AFTER the phone is approved and set as the logged-in phone.
 */
export async function recordLogin(phone: string): Promise<SharingSignal> {
  const deviceId = getOrCreateDeviceId();
  if (!phone) {
    return buildSignal("", null, deviceId, false, false);
  }

  // Best-effort pull of the freshest cross-device state so a second device
  // can observe the first device's session. No-ops safely in local-only mode.
  try {
    await syncUserDataFromSupabase(phone);
  } catch {
    /* proceed with whatever localStorage has */
  }

  const existing = loadUserData(phone)?.security ?? emptyState();
  const isNewDevice = !existing.deviceIds.includes(deviceId);
  const prior = existing.activeSession;
  const concurrent = Boolean(prior && prior.deviceId !== deviceId);

  const now = new Date().toISOString();
  const userAgent =
    typeof navigator !== "undefined" && navigator.userAgent ? navigator.userAgent : "";

  const loginLog = existing.loginLog.slice();
  if (concurrent && prior) {
    // Mark the earlier session stale and log the event on the prior device's entry.
    loginLog.push({
      phone,
      timestamp: now,
      deviceId: prior.deviceId,
      userAgent,
      event: "session-stale",
    });
  }
  loginLog.push({
    phone,
    timestamp: now,
    deviceId,
    userAgent,
    event: concurrent ? "concurrent-login" : "login",
  });

  const state: AccountSecurityState = {
    deviceIds: isNewDevice ? [...existing.deviceIds, deviceId] : existing.deviceIds,
    loginLog: loginLog.slice(-MAX_LOG_ENTRIES),
    activeSession: { token: generateId(), deviceId, startedAt: now },
  };

  saveUserData(phone, { security: state });

  const signal = buildSignal(phone, state, deviceId, isNewDevice, concurrent);
  console.info("[account-security] login recorded:", JSON.stringify(signal));
  return signal;
}

/** Read-only sharing signal for the current device (used by the dashboard). */
export function getSharingSignal(phone: string | null | undefined): SharingSignal {
  const deviceId = getOrCreateDeviceId();
  if (!phone) {
    return buildSignal("", null, deviceId, false, false);
  }
  const state = loadUserData(phone)?.security ?? null;
  const isNewDevice = state ? !state.deviceIds.includes(deviceId) : true;
  const concurrent = state?.loginLog.some((e) => e.event === "concurrent-login") ?? false;
  return buildSignal(phone, state, deviceId, isNewDevice, concurrent);
}

/** Raw per-phone login log (for a future admin screen). */
export function getLoginLog(phone: string | null | undefined): LoginEvent[] {
  if (!phone) return [];
  return loadUserData(phone)?.security?.loginLog ?? [];
}

/**
 * Build a device-agnostic summary from a per-phone security state. Pure and
 * side-effect free so it can back both the local signal and the admin summary.
 */
function summarizeSharingState(phone: string, state: AccountSecurityState | null): AdminSharingSummary {
  const deviceCount = state?.deviceIds.length ?? 0;
  const sawConcurrent = state?.loginLog.some((e) => e.event === "concurrent-login") ?? false;
  const last = state?.loginLog[state.loginLog.length - 1] ?? null;
  return {
    phone,
    distinctDeviceCount: deviceCount,
    lastLoginAt: last?.timestamp ?? null,
    concurrentLoginDetected: sawConcurrent,
    flagged: deviceCount > 1 || sawConcurrent,
  };
}

/**
 * Fetch sharing summaries for a list of phones for the admin panel. Reads the
 * existing `user_data` table (the same blob the student's device already writes
 * on login via `recordLogin`) — no new table/column. Falls back to whatever is
 * in this browser's localStorage (usually nothing for other students) when
 * Supabase is unavailable, so the admin view degrades to "no activity" instead
 * of breaking. Detection-only: a determined client can still bypass it.
 *
 * Keys the result by the EXACT phone strings passed in, but matches Supabase
 * rows by normalized phone so a student who typed their number differently at
 * login vs. registration still surfaces their signal.
 */
export async function fetchAdminSharingSummaries(
  phones: string[],
): Promise<Record<string, AdminSharingSummary>> {
  const unique = [...new Set(phones.map((p) => (p || "").trim()).filter(Boolean))];
  const result: Record<string, AdminSharingSummary> = {};
  for (const p of unique) {
    result[p] = summarizeSharingState(p, loadUserData(p)?.security ?? null);
  }
  if (!supabase || unique.length === 0) return result;
  try {
    const { data, error } = await supabase
      .from("user_data")
      .select("phone, data")
      .in("phone", unique);
    if (error) {
      console.warn("fetchAdminSharingSummaries: Supabase read failed, using local:", error.message);
      return result;
    }
    const byNormalized = new Map<string, AccountSecurityState | null>();
    for (const row of (data ?? [])) {
      const blob = row?.data as PersistedUserData | undefined;
      byNormalized.set(normalizePhone(String(row?.phone ?? "")), blob?.security ?? null);
    }
    for (const p of unique) {
      const state = byNormalized.get(normalizePhone(p));
      if (state !== undefined) {
        result[p] = summarizeSharingState(p, state);
      }
    }
  } catch (e) {
    console.warn("fetchAdminSharingSummaries: sync failed, using local:", e);
  }
  return result;
}
