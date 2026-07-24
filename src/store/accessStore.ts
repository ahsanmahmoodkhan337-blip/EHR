/**
 * Access Store — localStorage-based access control utilities
 *
 * Manages student access requests, approved phone numbers,
 * and login sessions using localStorage. This is a temporary
 * store for the educational prototype — production would use
 * a real database.
 */

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
  subscriptionEndDate?: string; // ISO date string
  durationLabel?: string; // "1 month", "3 months", "6 months", "1 year", "Custom"
}

// ─── Access Requests ──────────────────────────────────────────────

export function getAccessRequests(): AccessRequest[] {
  try {
    const raw = localStorage.getItem(ACCESS_REQUESTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveAccessRequest(request: AccessRequest): void {
  const requests = getAccessRequests();
  requests.push(request);
  localStorage.setItem(ACCESS_REQUESTS_KEY, JSON.stringify(requests));
}

export function updateRequestStatus(
  id: string,
  status: "approved" | "rejected"
): void {
  const requests = getAccessRequests();
  const idx = requests.findIndex((r) => r.id === id);
  if (idx >= 0) {
    requests[idx].status = status;
    localStorage.setItem(ACCESS_REQUESTS_KEY, JSON.stringify(requests));

    // If approved, add phone to approved list
    if (status === "approved") {
      addApprovedPhone(requests[idx].phone);
    }
  }
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
  const phones = getApprovedPhones().filter(p => p !== phone);
  localStorage.setItem(APPROVED_PHONES_KEY, JSON.stringify(phones));
  // Also update the request status back to pending
  const requests = getAccessRequests();
  const idx = requests.findIndex(r => r.phone === phone && r.status === "approved");
  if (idx >= 0) {
    requests[idx].status = "pending";
    delete requests[idx].subscriptionEndDate;
    delete requests[idx].durationLabel;
    localStorage.setItem(ACCESS_REQUESTS_KEY, JSON.stringify(requests));
  }
}

export function isPhoneApproved(phone: string): boolean {
  // Also check the hardcoded cross-device whitelist
  if (CROSS_DEVICE_WHITELIST.includes(phone)) return true;
  return getApprovedPhones().includes(phone);
}

// ─── Cross-Device Whitelist ──────────────────────────────────────
// Phones hardcoded here work on ALL devices (not just the approving device).
// Add a phone to this array to grant access everywhere.
const CROSS_DEVICE_WHITELIST: string[] = [];

export function getAccessToken(): string {
  const phones = [...new Set([...CROSS_DEVICE_WHITELIST, ...getApprovedPhones()])];
  return btoa(JSON.stringify(phones));
}

export function importAccessToken(token: string): void {
  try {
    const phones: string[] = JSON.parse(atob(token));
    if (Array.isArray(phones)) {
      phones.forEach(p => addApprovedPhone(p));
    }
  } catch { /* invalid token */ }
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

const SESSION_TIMEOUT_DEFAULT = 0; // 0 = no timeout

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
  // Reset session start when timeout is changed
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
  if (timeout <= 0) return false; // No timeout configured

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

// ─── Subscription Expiry ────────────────────────────────────────────

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
  if (!endDateStr) return Infinity; // No expiry = unlimited
  const endDate = new Date(endDateStr);
  const now = new Date();
  const diffMs = endDate.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function isSubscriptionExpired(phone: string): boolean {
  const days = getDaysRemaining(phone);
  if (days === Infinity) return false; // No expiry set
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
    default: now.setMonth(now.getMonth() + 1); // Default to 1 month
  }
  return now.toISOString();
}