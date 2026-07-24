/**
 * Access Store — Supabase-backed access control with localStorage cache
 *
 * Primary data is stored in Supabase for cross-device sync.
 * localStorage serves as a fast read cache and fallback.
 * On app load, data is synced from Supabase to localStorage.
 * On write, Supabase is updated first, then localStorage cache.
 */

import { supabase } from "./supabase";

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

// ─── Supabase ↔ localStorage sync ──────────────────────────────────

// Sync all requests from Supabase to localStorage cache
export async function syncFromSupabase(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from("access_requests")
      .select("*")
      .order("submitted_at", { ascending: false });

    if (error) {
      console.warn("Supabase sync failed, using localStorage cache:", error.message);
      return;
    }

    if (data) {
      const mapped: AccessRequest[] = data.map((r: any) => ({
        id: r.id,
        fullName: r.full_name,
        phone: r.phone,
        email: r.email,
        paymentMethod: r.payment_method,
        transactionId: r.transaction_id,
        submittedAt: r.submitted_at,
        status: r.status,
        subscriptionEndDate: r.subscription_end_date,
        durationLabel: r.duration_label,
      }));
      localStorage.setItem(ACCESS_REQUESTS_KEY, JSON.stringify(mapped));

      // Also sync approved phones
      const approved = mapped
        .filter((r) => r.status === "approved")
        .map((r) => r.phone);
      localStorage.setItem(APPROVED_PHONES_KEY, JSON.stringify([...new Set(approved)]));
    }
  } catch (e) {
    console.warn("Supabase sync error, using localStorage cache:", e);
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
  // Write to Supabase
  await supabase.from("access_requests").upsert({
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
  if (status === "approved" && !extra?.subscriptionEndDate) {
    // Default: 1 month if no duration specified
    updates.subscription_end_date = calculateEndDate("1 month");
    updates.duration_label = "1 month";
  }

  await supabase
    .from("access_requests")
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
    .from("access_requests")
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
  return getApprovedPhones().includes(phone);
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
}

// ─── Subscription Expiry ──────────────────────────────────────────

export function getSubscriptionEndDate(phone: string): string | null {
  const requests = getAccessRequests();
  const req = requests.find((r) => r.phone === phone && r.status === "approved");
  return req?.subscriptionEndDate ?? null;
}

export function getDurationLabel(phone: string): string | null {
  const requests = getAccessRequests();
  const req = requests.find((r) => r.phone === phone && r.status === "approved");
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
