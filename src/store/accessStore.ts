/**
 * Access Store — Supabase-backed access control with localStorage cache
 *
 * Primary data is stored in Supabase for cross-device sync.
 * localStorage serves as a fast read cache and fallback.
 * Student-facing pages never bulk-sync: login asks about one phone number via
 * lookupPhoneStatus(). The admin panel reads the table one page at a time
 * through fetchAccessRequestsPage() and never writes that page to
 * localStorage.
 * On write, Supabase is updated first, then localStorage cache.
 */

import { supabase } from "./supabase";
import { useEhrStore } from "./ehrStore";

const ACCESS_REQUESTS_KEY = "hh_access_requests";
const APPROVED_PHONES_KEY = "hh_approved_phones";
const LOGGED_IN_PHONE_KEY = "hh_logged_in_phone";
const SESSION_TIMEOUT_KEY = "hh_session_timeout";
const SESSION_START_KEY = "hh_session_start";

// ─── Types ────────────────────────────────────────────────────────

export interface AccessRequest {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  paymentMethod: "bank-islami" | "easypaisa" | "paypal";
  transactionId: string;
  submittedAt: string;
  status: "pending" | "approved" | "rejected";
  subscriptionEndDate?: string;
  durationLabel?: string;
}

// ─── Phone Normalization ──────────────────────────────────────────
//
// Phones arrive in wildly inconsistent formats (e.g. 03105265337,
// +923117563571, 00923117563571, 3117563571). Exact-string matching
// against these breaks login for anyone who formats their number even
// slightly differently from how it was stored. Normalize to a single
// canonical digit form before any comparison.

export function normalizePhone(phone: string): string {
  let d = (phone || "").replace(/\D/g, "");
  // Strip international dialing prefix (00)
  if (d.startsWith("00")) d = d.slice(2);
  // Strip common country codes (PK 92, Saudi 966, Qatar 974, India 91) so
  // 03105265337 == +923105265337 == 00923105265337 == 3105265337 and
  // +966559091460 == 0559091460, +97466047531 == 0097466047531.
  const cc = d.match(/^(92|966|974|91)/);
  if (cc && d.length >= 11) d = d.slice(cc[0].length);
  // Strip leading zero(es) from local format
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  return d;
}

// ─── Admin paged read (server → admin panel, 50 rows at a time) ─────
//
// The admin panel is the only place that shows the enrolment table, and it
// must never receive more than one page of it. This reads named columns with
// an exact count and an explicit range, and deliberately does NOT cache the
// result in localStorage — the page lives in component state only, so a
// browser that once held the admin panel keeps no copy of the table.

let lastSyncError: string | null = null;
export function getLastSyncError(): string | null {
  return lastSyncError;
}

export const ADMIN_PAGE_SIZE = 50;

const ADMIN_COLUMNS =
  "id, full_name, phone, email, payment_method, transaction_id, submitted_at, status, subscription_end_date, duration_label";

export interface AdminRequestPage {
  rows: AccessRequest[];
  total: number;
  error: string | null;
}

export async function fetchAccessRequestsPage(opts: {
  page: number;
  pageSize?: number;
  status?: "pending" | "approved";
  search?: string;
}): Promise<AdminRequestPage> {
  const pageSize = opts.pageSize ?? ADMIN_PAGE_SIZE;
  const page = Math.max(0, Math.floor(opts.page));
  const from = page * pageSize;
  const to = from + pageSize - 1;

  if (!supabase) {
    lastSyncError = "Supabase is not configured (missing keys).";
    return { rows: [], total: 0, error: lastSyncError };
  }

  try {
    let query = supabase
      .from("access_requests")
      .select(ADMIN_COLUMNS, { count: "exact" });

    if (opts.status) query = query.eq("status", opts.status);

    // Search runs on the server so it covers every row, not just this page.
    // Strip characters that would break PostgREST's or() filter syntax.
    const term = (opts.search ?? "").trim().replace(/[,()%\\*]/g, "");
    if (term) query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`);

    const { data, error, count } = await query
      .order("submitted_at", { ascending: false })
      .range(from, to);

    if (error) {
      lastSyncError = error.message;
      console.warn("fetchAccessRequestsPage: read failed:", error.message);
      return { rows: [], total: 0, error: error.message };
    }

    lastSyncError = null;
    const rows: AccessRequest[] = (data ?? []).map((r: any) => ({
      id: r.id,
      fullName: r.full_name,
      phone: r.phone,
      email: r.email ?? "",
      paymentMethod: r.payment_method,
      transactionId: r.transaction_id ?? "",
      submittedAt: r.submitted_at,
      status: r.status,
      subscriptionEndDate: r.subscription_end_date ?? undefined,
      durationLabel: r.duration_label ?? undefined,
    }));
    return { rows, total: count ?? rows.length, error: null };
  } catch (e) {
    lastSyncError = e instanceof Error ? e.message : String(e);
    console.warn("fetchAccessRequestsPage: read error:", e);
    return { rows: [], total: 0, error: lastSyncError };
  }
}

/** Exact row count for the admin header cards — no rows transferred. */
export async function countAccessRequests(
  status?: "pending" | "approved" | "rejected"
): Promise<number | null> {
  if (!supabase) return null;
  try {
    let query = supabase.from("access_requests").select("id", { count: "exact", head: true });
    if (status) query = query.eq("status", status);
    const { count, error } = await query;
    if (error) {
      console.warn("countAccessRequests failed:", error.message);
      return null;
    }
    return count ?? 0;
  } catch (e) {
    console.warn("countAccessRequests error:", e);
    return null;
  }
}

// ─── Single-phone status lookup ────────────────────────────────────
//
// The login path must never pull the enrolment table into the browser. This
// asks the server about exactly one phone number: the check_access() function
// when it exists, otherwise a column-limited query, otherwise (offline) the
// device's own cache.

export interface PhoneStatus {
  status: "pending" | "approved" | "rejected";
  subscriptionEndDate: string | null;
  durationLabel: string | null;
}

function isPhoneStatusValue(v: unknown): v is PhoneStatus["status"] {
  return v === "pending" || v === "approved" || v === "rejected";
}

function readCachedPhoneStatus(phone: string): PhoneStatus | null {
  const target = normalizePhone(phone);
  const cached = getAccessRequests().find((r) => normalizePhone(r.phone) === target);
  if (!cached) return null;
  return {
    status: cached.status,
    subscriptionEndDate: cached.subscriptionEndDate ?? null,
    durationLabel: cached.durationLabel ?? null,
  };
}

export async function lookupPhoneStatus(rawPhone: string): Promise<PhoneStatus | null> {
  const phone = (rawPhone || "").trim();
  if (!phone) return null;

  if (!supabase) {
    lastSyncError = "Supabase is not configured (missing keys).";
    return readCachedPhoneStatus(phone);
  }

  // Preferred path: the check_access() function returns this one phone's
  // status. It starts working once specs/supabase-close-exposure.sql has run.
  try {
    const { data, error } = await supabase.rpc("check_access", { p_phone: phone });
    if (!error) {
      lastSyncError = null;
      const row = (Array.isArray(data) ? data[0] : data) as Record<string, any> | null | undefined;
      if (!row) return null;
      if (!isPhoneStatusValue(row.status)) return null;
      return {
        status: row.status,
        subscriptionEndDate: row.subscription_end_date ?? null,
        durationLabel: row.duration_label ?? null,
      };
    }
    // Function not deployed yet — fall through to the narrow query below.
  } catch {
    // Network/RPC failure — fall through too.
  }

  try {
    // Stored numbers arrive in every format (03105265337, +923105265337,
    // 00923117563571, 923105265337). An exact-match query locks out any
    // approved student whose saved format differs from what they type, so
    // match on the last 9 local digits and then confirm the normalised forms
    // are equal. Bounded to 25 rows — never a bulk read of the table.
    const target = normalizePhone(phone);
    const tail = target.length > 9 ? target.slice(-9) : target;

    const { data: rows, error } = await supabase
      .from("access_requests")
      .select("phone, status, subscription_end_date, duration_label")
      .ilike("phone", `%${tail}%`)
      .limit(25);

    if (error) {
      lastSyncError = error.message;
      console.warn("lookupPhoneStatus: Supabase read failed, using localStorage cache:", error.message);
      return readCachedPhoneStatus(phone);
    }

    lastSyncError = null;
    const data =
      (rows ?? []).find((r) => normalizePhone(String((r as any).phone ?? "")) === target) ?? null;
    if (!data) return null;
    if (!isPhoneStatusValue((data as any).status)) return null;
    return {
      status: (data as any).status,
      subscriptionEndDate: (data as any).subscription_end_date ?? null,
      durationLabel: (data as any).duration_label ?? null,
    };
  } catch (e) {
    lastSyncError = e instanceof Error ? e.message : String(e);
    console.warn("lookupPhoneStatus: Supabase lookup error, using localStorage cache:", e);
    return readCachedPhoneStatus(phone);
  }
}

/**
 * Record what the server just said about one phone in this device's local
 * allowlist, so isLoggedIn() keeps working after a reload without any bulk
 * download. Only the phone string is stored — no enrolment record is cached.
 */
export function cachePhoneStatus(phone: string, status: PhoneStatus): void {
  const target = normalizePhone(phone);
  const phones = getApprovedPhones();
  const has = phones.some((p) => normalizePhone(p) === target);
  if (status.status === "approved") {
    if (!has) addApprovedPhone(phone);
  } else if (has) {
    localStorage.setItem(
      APPROVED_PHONES_KEY,
      JSON.stringify(phones.filter((p) => normalizePhone(p) !== target))
    );
  }
}

// ─── Access Requests (sync — reads from localStorage cache) ─────────

export function getAccessRequests(): AccessRequest[] {
  try {
    const raw = localStorage.getItem(ACCESS_REQUESTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ─── Save (async — writes to Supabase + localStorage) ──────────────

export async function saveAccessRequestAsync(request: AccessRequest): Promise<void> {
  // Write to Supabase (skipped in local-only mode)
  await supabase?.from("access_requests").upsert({
    id: request.id,
    full_name: request.fullName,
    phone: request.phone,
    email: request.email,
    payment_method: request.paymentMethod,
    transaction_id: request.transactionId,
    submitted_at: request.submittedAt,
    status: request.status,
    subscription_end_date: request.subscriptionEndDate || null,
    duration_label: request.durationLabel || null,
  });

  // Update localStorage cache
  const requests = getAccessRequests();
  const idx = requests.findIndex((r) => r.id === request.id);
  if (idx >= 0) {
    requests[idx] = request;
  } else {
    requests.push(request);
  }
  localStorage.setItem(ACCESS_REQUESTS_KEY, JSON.stringify(requests));

  // Auto-add to approved phones if status is approved
  if (request.status === "approved") {
    addApprovedPhone(request.phone);
  }
}

// Sync wrapper for backwards compatibility
export function saveAccessRequest(request: AccessRequest): void {
  saveAccessRequestAsync(request).catch((e) =>
    console.warn("Supabase write failed, using localStorage only:", e)
  );
}

// ─── Status Updates ────────────────────────────────────────────────

export async function updateRequestStatusAsync(
  id: string,
  status: "approved" | "rejected",
  extra?: { subscriptionEndDate?: string; durationLabel?: string }
): Promise<void> {
  const updates: Record<string, any> = { status };
  if (extra?.subscriptionEndDate) updates.subscription_end_date = extra.subscriptionEndDate;
  if (extra?.durationLabel) updates.duration_label = extra.durationLabel;
  // No default expiry — if no duration specified, user gets lifetime (no end date)

  await supabase
    ?.from("access_requests")
    .update(updates)
    .eq("id", id);

  const requests = getAccessRequests();
  const idx = requests.findIndex((r) => r.id === id);
  if (idx >= 0) {
    requests[idx].status = status;
    localStorage.setItem(ACCESS_REQUESTS_KEY, JSON.stringify(requests));

    if (status === "approved") {
      addApprovedPhone(requests[idx].phone);
    }
  }
}

export function updateRequestStatus(
  id: string,
  status: "approved" | "rejected",
  extra?: { subscriptionEndDate?: string; durationLabel?: string }
): void {
  updateRequestStatusAsync(id, status, extra).catch((e) =>
    console.warn("Supabase status update failed:", e)
  );
}

// ─── Approved Phones ──────────────────────────────────────────────

export function getApprovedPhones(): string[] {
  try {
    const raw = localStorage.getItem(APPROVED_PHONES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addApprovedPhone(phone: string): void {
  const phones = getApprovedPhones();
  if (!phones.includes(phone)) {
    phones.push(phone);
    localStorage.setItem(APPROVED_PHONES_KEY, JSON.stringify(phones));
  }
}

export function revokeApprovedPhone(phone: string): void {
  const phones = getApprovedPhones();
  const idx = phones.indexOf(phone);
  if (idx >= 0) {
    phones.splice(idx, 1);
    localStorage.setItem(APPROVED_PHONES_KEY, JSON.stringify(phones));
  }
  // Also update Supabase — reset to pending
  supabase
    ?.from("access_requests")
    .update({ status: "pending", subscription_end_date: null, duration_label: null })
    .eq("phone", phone)
    .eq("status", "approved")
    .then(({ error }) => {
      if (error) console.warn("Supabase revoke failed:", error.message);
    });
  // Update localStorage requests cache too
  const requests = getAccessRequests();
  const reqIdx = requests.findIndex(r => r.phone === phone && r.status === "approved");
  if (reqIdx >= 0) {
    requests[reqIdx].status = "pending";
    requests[reqIdx].subscriptionEndDate = undefined;
    requests[reqIdx].durationLabel = undefined;
    localStorage.setItem(ACCESS_REQUESTS_KEY, JSON.stringify(requests));
  }
}

export function isPhoneApproved(phone: string): boolean {
  const target = normalizePhone(phone);
  return getApprovedPhones().some((p) => normalizePhone(p) === target);
}

// ─── Login Session ────────────────────────────────────────────────

export function getLoggedInPhone(): string | null {
  return localStorage.getItem(LOGGED_IN_PHONE_KEY);
}

export function setLoggedInPhone(phone: string): void {
  localStorage.setItem(LOGGED_IN_PHONE_KEY, phone);
}

export function logout(): void {
  localStorage.removeItem(LOGGED_IN_PHONE_KEY);
  // Phase 0: flush the record set to disk, then drop it from memory so the next
  // student on this device cannot see the previous one's patients.
  useEhrStore.getState().unload();
}

export function isLoggedIn(): boolean {
  const phone = getLoggedInPhone();
  return phone !== null && isPhoneApproved(phone);
}

// ─── Session Timeout ──────────────────────────────────────────────

const SESSION_TIMEOUT_DEFAULT = 0;

export function getSessionTimeoutMinutes(): number {
  try {
    const raw = localStorage.getItem(SESSION_TIMEOUT_KEY);
    return raw ? parseInt(raw, 10) : SESSION_TIMEOUT_DEFAULT;
  } catch {
    return SESSION_TIMEOUT_DEFAULT;
  }
}

export function setSessionTimeoutMinutes(minutes: number): void {
  localStorage.setItem(SESSION_TIMEOUT_KEY, minutes.toString());
  if (minutes > 0) {
    localStorage.setItem(SESSION_START_KEY, Date.now().toString());
  } else {
    localStorage.removeItem(SESSION_START_KEY);
  }
}

export function setSessionStart(): void {
  const timeout = getSessionTimeoutMinutes();
  if (timeout > 0) {
    localStorage.setItem(SESSION_START_KEY, Date.now().toString());
  }
}

export function checkSessionExpired(): boolean {
  const timeout = getSessionTimeoutMinutes();
  if (timeout <= 0) return false;
  const startRaw = localStorage.getItem(SESSION_START_KEY);
  if (!startRaw) return false;
  const start = parseInt(startRaw, 10);
  const elapsed = Date.now() - start;
  return elapsed >= timeout * 60 * 1000;
}

export function clearSession(): void {
  localStorage.removeItem(LOGGED_IN_PHONE_KEY);
  localStorage.removeItem(SESSION_START_KEY);
  useEhrStore.getState().unload();
}

// ─── Subscription Expiry ──────────────────────────────────────────

export function getSubscriptionEndDate(phone: string): string | null {
  const target = normalizePhone(phone);
  const requests = getAccessRequests();
  const req = requests.find((r) => normalizePhone(r.phone) === target && r.status === "approved");
  return req?.subscriptionEndDate ?? null;
}

export function getDurationLabel(phone: string): string | null {
  const target = normalizePhone(phone);
  const requests = getAccessRequests();
  const req = requests.find((r) => normalizePhone(r.phone) === target && r.status === "approved");
  return req?.durationLabel ?? null;
}

export function getDaysRemaining(phone: string): number {
  const endDateStr = getSubscriptionEndDate(phone);
  if (!endDateStr) return Infinity;
  const endDate = new Date(endDateStr);
  const now = new Date();
  const diffMs = endDate.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function isSubscriptionExpired(phone: string): boolean {
  const days = getDaysRemaining(phone);
  if (days === Infinity) return false;
  return days <= 0;
}

export function getSubscriptionStatus(phone: string): "active" | "expiring-soon" | "expired" | "no-expiry" {
  const days = getDaysRemaining(phone);
  if (days === Infinity) return "no-expiry";
  if (days <= 0) return "expired";
  if (days <= 30) return "expiring-soon";
  return "active";
}

export function calculateEndDate(durationLabel: string): string {
  const now = new Date();
  switch (durationLabel) {
    case "1 month": now.setMonth(now.getMonth() + 1); break;
    case "3 months": now.setMonth(now.getMonth() + 3); break;
    case "6 months": now.setMonth(now.getMonth() + 6); break;
    case "1 year": now.setFullYear(now.getFullYear() + 1); break;
    default: now.setMonth(now.getMonth() + 1);
  }
  return now.toISOString();
}
