/**
 * AdminPage — Admin Panel for Access Request Management
 *
 * Sign-in-gated admin dashboard where administrators can:
 * - View pending access requests
 * - Approve or reject requests
 * - Browse approved students 50 at a time
 *
 * Access is a real Supabase Auth email + password sign-in (no shared password
 * string in the bundle). Nothing is read from the enrolment table until a
 * session exists, and each read is one page of named columns.
 *
 * Inspiration: Epic security / admin workflow
 */

import { useState, useEffect } from "react";
import type { Session } from "@supabase/supabase-js";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  LogOut,
  Key,
  Lock,
  Eye,
  EyeOff,
  Save,
  UserPlus,
  Trash2,
} from "lucide-react";
import {
  fetchAccessRequestsPage,
  countAccessRequests,
  updateRequestStatus,
  getSessionTimeoutMinutes,
  setSessionTimeoutMinutes,
  ADMIN_PAGE_SIZE,
  type AccessRequest,
  calculateEndDate,
  revokeApprovedPhone,
  saveAccessRequest,
} from "../store/accessStore";
import { supabase } from "../store/supabase";
import { fetchAdminSharingSummaries, MAX_DEVICE_COUNT, type AdminSharingSummary } from "../store/accountSecurity";
import {
  getAllPins,
  setStagePin,
  resetAllPins,
  type StagePinMap,
} from "../store/pinStore";
import type { Role } from "../store/pipelineStore";
import { WhatsAppFloat } from "../components/WhatsAppFloat";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

/**
 * Turn a Supabase auth failure into something the admin can act on, instead of
 * one generic "login failed".
 */
function describeAuthError(error: { message?: string; code?: string; status?: number }): string {
  const message = (error?.message || "").toLowerCase();
  const code = (error?.code || "").toLowerCase();
  if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return "Email not confirmed — confirm this address in Supabase Auth, then sign in again.";
  }
  if (code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return "Invalid login credentials — check the admin email and password.";
  }
  if (code.includes("rate_limit") || message.includes("rate limit") || error?.status === 429) {
    return "Too many attempts — wait a minute and try again.";
  }
  if (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("network error")
  ) {
    return "Could not reach the server — check the connection and try again.";
  }
  return error?.message || "Sign-in failed.";
}

/**
 * Subscription state read straight from the row, so the table never depends on
 * a local cache of the enrolment table.
 */
function subscriptionState(row: AccessRequest): {
  status: "active" | "expiring-soon" | "expired" | "no-expiry";
  days: number;
} {
  const end = row.subscriptionEndDate ? new Date(row.subscriptionEndDate) : null;
  if (!end || Number.isNaN(end.getTime())) return { status: "no-expiry", days: Infinity };
  const days = Math.ceil((end.getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return { status: "expired", days };
  if (days <= 30) return { status: "expiring-soon", days };
  return { status: "active", days };
}

function AdminPage() {
  // ─── Auth (Supabase email + password) ───
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  // ─── Enrolment table: one page at a time, never cached ───
  const [approvedRows, setApprovedRows] = useState<AccessRequest[]>([]);
  const [approvedTotal, setApprovedTotal] = useState(0);
  const [approvedPage, setApprovedPage] = useState(0);
  const [pendingRows, setPendingRows] = useState<AccessRequest[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [pendingPage, setPendingPage] = useState(0);
  const [totalRequests, setTotalRequests] = useState<number | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");

  const [pins, setPins] = useState<StagePinMap>({ scribe: "1111", coder: "2222", biller: "3333", "prior-auth": "4444", "ar-voice": "5555" });
  const [editPinRole, setEditPinRole] = useState<Role | null>(null);
  const [editPinValue, setEditPinValue] = useState("");
  const [showPins, setShowPins] = useState(false);
  const [pinSaved, setPinSaved] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState(getSessionTimeoutMinutes());
  const [timeoutSaved] = useState(false);
  const [durationModal, setDurationModal] = useState<{ id: string; duration: string } | null>(null);
  const [sharingSignals, setSharingSignals] = useState<Record<string, AdminSharingSummary>>({});

  // Restore an existing session on mount and follow sign-in / sign-out / expiry.
  useEffect(() => {
    if (!supabase) {
      setAuthChecked(true);
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next ?? null);
      setAuthChecked(true);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Debounce the search box so typing doesn't fire a query per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setActiveSearch(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Every panel read sits behind the session. No session → no request, no data.
  useEffect(() => {
    if (!session) {
      setApprovedRows([]);
      setApprovedTotal(0);
      setPendingRows([]);
      setPendingTotal(0);
      setTotalRequests(null);
      setSharingSignals({});
      setListLoading(false);
      return;
    }
    let cancelled = false;
    setListLoading(true);
    (async () => {
      const [approved, pending, total] = await Promise.all([
        fetchAccessRequestsPage({ page: approvedPage, status: "approved", search: activeSearch }),
        fetchAccessRequestsPage({ page: pendingPage, status: "pending" }),
        countAccessRequests(),
      ]);
      if (cancelled) return;
      setApprovedRows(approved.rows);
      setApprovedTotal(approved.total);
      setPendingRows(pending.rows);
      setPendingTotal(pending.total);
      setTotalRequests(total);
      setSyncError(approved.error || pending.error || null);
      setListLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session, approvedPage, pendingPage, activeSearch, refreshKey]);

  useEffect(() => {
    if (!session) return;
    setPins(getAllPins());
    setEditPinRole(null);
    setPinSaved(false);
  }, [session, refreshKey]);

  const handleSignIn = async () => {
    if (!supabase) {
      setAuthError("Sign-in is not available in this build — the server connection is not configured.");
      return;
    }
    if (!email.trim() || !password) {
      setAuthError("Enter the admin email and password.");
      return;
    }
    setSigningIn(true);
    setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setSigningIn(false);
    if (error) {
      setAuthError(describeAuthError(error));
      return;
    }
    setPassword("");
  };

  const handleSignOut = async () => {
    await supabase?.auth.signOut();
    setSession(null);
    setPassword("");
    setSearchQuery("");
    setActiveSearch("");
    setApprovedPage(0);
    setPendingPage(0);
    setDurationModal(null);
  };

  const handleApprove = (id: string, duration: string) => {
    if (duration === "Lifetime") {
      updateRequestStatus(id, "approved");
    } else {
      const endDate = calculateEndDate(duration);
      updateRequestStatus(id, "approved", {
        subscriptionEndDate: endDate,
        durationLabel: duration,
      });
    }
    setDurationModal(null);
    setRefreshKey((k) => k + 1);
  };

  const handleReject = (id: string) => {
    updateRequestStatus(id, "rejected");
    setRefreshKey((k) => k + 1);
  };

  const handleRevoke = (phone: string) => {
    revokeApprovedPhone(phone);
    setRefreshKey((k) => k + 1);
  };

  const handleSavePin = (role: Role) => {
    if (editPinValue.length >= 4) {
      setStagePin(role, editPinValue);
      setPins(getAllPins());
      setEditPinRole(null);
      setPinSaved(true);
      setTimeout(() => setPinSaved(false), 2000);
    }
  };

  const pagePhonesKey = approvedRows.map((r) => r.phone).join("|");

  // Account-sharing signal (detection-only, non-blocking) for the approved
  // users on the current page only — batched in groups of 20, so no single
  // user_data call carries more than 20 phone numbers.
  useEffect(() => {
    if (!session) return;
    const phones = pagePhonesKey ? pagePhonesKey.split("|") : [];
    if (phones.length === 0) {
      setSharingSignals({});
      return;
    }
    let cancelled = false;
    const batches: string[][] = [];
    for (let i = 0; i < phones.length; i += 20) batches.push(phones.slice(i, i + 20));
    Promise.all(batches.map((batch) => fetchAdminSharingSummaries(batch)))
      .then((results) => {
        if (!cancelled) setSharingSignals(Object.assign({}, ...results));
      })
      .catch(() => {
        if (!cancelled) setSharingSignals({});
      });
    return () => {
      cancelled = true;
    };
  }, [session, pagePhonesKey, refreshKey]);

  if (!authChecked) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-900 p-4">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Checking sign-in…
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-900 p-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
          <div className="mb-6 text-center">
            <Shield className="mx-auto mb-3 h-10 w-10 text-brand-400" />
            <h1 className="text-lg font-bold text-white">Admin Panel</h1>
            <p className="text-sm text-slate-400">Sign in with your admin email and password</p>
          </div>
          <div className="space-y-3">
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setAuthError("");
              }}
              placeholder="Admin email"
              className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2.5 text-sm text-white placeholder-slate-400 outline-none focus:border-brand-500"
            />
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setAuthError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && !signingIn && handleSignIn()}
              placeholder="Password"
              className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2.5 text-sm text-white placeholder-slate-400 outline-none focus:border-brand-500"
            />
            {authError && (
              <p className="text-xs text-red-400">{authError}</p>
            )}
            <button
              onClick={handleSignIn}
              disabled={signingIn}
              className="w-full rounded-lg bg-brand-500 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
            >
              {signingIn ? "Signing in…" : "Sign In"}
            </button>
          </div>
          <div className="mt-4 text-center">
            <Link to="/" className="text-xs text-slate-500 underline hover:text-slate-300">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-900">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-700 bg-slate-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-brand-400" />
          <h1 className="text-sm font-bold text-white">Admin Panel</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-[11px] text-slate-400 sm:inline">
            {session.user.email}
          </span>
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="flex items-center gap-1 rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-600"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
          <button
            onClick={() => {
              const phone = prompt("Enter student phone number to manually add:");
              if (phone) {
                const name = prompt("Enter student name:") || "Manual Entry";
                const req: AccessRequest = {
                  id: `manual-${Date.now()}`,
                  fullName: name,
                  phone: phone.trim(),
                  email: "",
                  paymentMethod: "easypaisa",
                  transactionId: "manual-" + Date.now(),
                  submittedAt: new Date().toISOString(),
                  status: "approved",
                };
                saveAccessRequest(req);
                setRefreshKey(k => k + 1);
                alert(`${name} added with lifetime access`);
              }
            }}
            className="flex items-center gap-1 rounded-lg bg-green-700 px-3 py-1.5 text-xs text-white hover:bg-green-600"
          >
            <UserPlus className="h-3 w-3" />
            Manual Add
          </button>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1 rounded-lg bg-red-900/50 px-3 py-1.5 text-xs text-red-300 hover:bg-red-900"
          >
            <LogOut className="h-3 w-3" />
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl p-4 py-6">
        {syncError && (
          <div className="mb-4 rounded-xl border border-red-700 bg-red-900/40 p-3 text-sm text-red-200">
            <strong>Database connection error:</strong> {syncError}
            <div className="mt-1 text-xs text-red-300">The approved list could not load from the server. This usually means this device cannot reach Supabase (network/DNS).</div>
          </div>
        )}
        {/* Stats — exact counts from the server, no rows fetched */}
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <p className="text-xs text-slate-400">Pending</p>
            <p className="text-2xl font-bold text-amber-400">{pendingTotal}</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <p className="text-xs text-slate-400">Approved</p>
            <p className="text-2xl font-bold text-green-400">{approvedTotal}</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <p className="text-xs text-slate-400">All requests</p>
            <p className="text-2xl font-bold text-brand-400">{totalRequests ?? "—"}</p>
          </div>
        </div>

        {/* Pending Requests */}
        <div className="mb-6 rounded-xl border border-slate-700 bg-slate-800">
          <div className="flex items-center gap-2 border-b border-slate-700 px-4 py-3">
            <Clock className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-white">Pending Requests</h2>
            <span className="rounded-full bg-amber-900/50 px-2 py-0.5 text-[10px] font-medium text-amber-300">
              {pendingTotal}
            </span>
            {listLoading && <RefreshCw className="h-3 w-3 animate-spin text-slate-500" />}
          </div>
          {pendingRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No pending requests</div>
          ) : (
            <div className="divide-y divide-slate-700">
              {pendingRows.map((req) => (
                <div key={req.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">{req.fullName}</p>
                    <p className="text-xs text-slate-400">
                      {req.phone} | {req.paymentMethod} | ID: {req.transactionId}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {new Date(req.submittedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setDurationModal({ id: req.id, duration: "1 month" })}
                      className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-500"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(req.id)}
                      className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500"
                    >
                      <XCircle className="h-3 w-3" />
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {pendingTotal > ADMIN_PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-slate-700 px-4 py-3">
              <p className="text-xs text-slate-400">
                Showing {pendingPage * ADMIN_PAGE_SIZE + 1}&ndash;
                {Math.min((pendingPage + 1) * ADMIN_PAGE_SIZE, pendingTotal)} of {pendingTotal}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPendingPage((p) => Math.max(0, p - 1))}
                  disabled={pendingPage === 0}
                  className="rounded bg-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                <span className="px-2 text-xs text-slate-400">
                  Page {pendingPage + 1} of {Math.ceil(pendingTotal / ADMIN_PAGE_SIZE)}
                </span>
                <button
                  onClick={() =>
                    setPendingPage((p) =>
                      (p + 1) * ADMIN_PAGE_SIZE < pendingTotal ? p + 1 : p
                    )
                  }
                  disabled={(pendingPage + 1) * ADMIN_PAGE_SIZE >= pendingTotal}
                  className="rounded bg-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ─── Subscription Duration Modal ─── */}
        {durationModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-xl border border-slate-600 bg-slate-800 p-6 shadow-2xl">
              <h3 className="text-sm font-bold text-white mb-4">Select Subscription Duration</h3>
              <div className="space-y-2">
                {["1 month", "3 months", "6 months", "1 year", "Lifetime (No Expiry)"].map((d) => (
                  <button
                    key={d}
                    onClick={() => handleApprove(durationModal.id, d)}
                    className={`w-full rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors ${
                      durationModal.duration === d
                        ? "border-green-500 bg-green-900/30 text-green-300"
                        : "border-slate-600 text-slate-300 hover:border-slate-500"
                    }`}
                    onMouseEnter={() => setDurationModal({ ...durationModal, duration: d })}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => handleApprove(durationModal.id, durationModal.duration)}
                  className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-xs font-medium text-white hover:bg-green-500"
                >
                  Approve with {durationModal.duration}
                </button>
                <button
                  onClick={() => setDurationModal(null)}
                  className="rounded-lg bg-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* All Approved Users */}
        <div className="mb-6 rounded-xl border border-slate-700 bg-slate-800">
          <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              <h2 className="text-sm font-semibold text-white">All Approved Users</h2>
              <span className="rounded-full bg-green-900/50 px-2 py-0.5 text-[10px] font-medium text-green-300">
                {approvedTotal}
              </span>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setApprovedPage(0); }}
              placeholder="Search by name or phone..."
              className="w-56 rounded-lg border border-slate-600 bg-slate-700 px-3 py-1.5 text-xs text-white placeholder-slate-400 outline-none focus:border-brand-500"
            />
          </div>
          {approvedRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              {activeSearch ? "No users match your search" : "No approved users"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-700 text-[10px] uppercase tracking-wider text-slate-400">
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Phone</th>
                    <th className="px-3 py-2 font-medium">Payment</th>
                    <th className="px-3 py-2 font-medium">Transaction ID</th>
                    <th className="px-3 py-2 font-medium">Subscription</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Days Left</th>
                    <th className="px-3 py-2 font-medium">Sharing</th>
                    <th className="px-3 py-2 font-medium">Submitted</th>
                    <th className="px-3 py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {approvedRows.map((req) => {
                    const { status, days } = subscriptionState(req);
                    const statusBadge =
                      status === "expired"
                        ? "bg-red-900/40 text-red-300 border-red-700/50"
                        : status === "expiring-soon"
                          ? "bg-amber-900/40 text-amber-300 border-amber-700/50"
                          : status === "no-expiry"
                            ? "bg-brand-900/40 text-brand-300 border-brand-700/50"
                            : "bg-green-900/40 text-green-300 border-green-700/50";
                    const statusLabel =
                      status === "no-expiry"
                        ? "No Expiry"
                        : status === "expired"
                          ? "Expired"
                          : status === "expiring-soon"
                            ? "Expiring Soon"
                            : "Active";
                    const daysLabel =
                      status === "no-expiry"
                        ? "∞"
                        : status === "expired"
                          ? "—"
                          : `${days}d`;
                    const durationLabel = req.durationLabel || "—";
                    const sig = sharingSignals[req.phone];
                    const deviceCount = sig?.distinctDeviceCount ?? 0;
                    return (
                      <tr key={req.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-3 py-2 font-medium text-white">{req.fullName}</td>
                        <td className="px-3 py-2 text-slate-300">{req.phone}</td>
                        <td className="px-3 py-2 text-slate-300 capitalize">{req.paymentMethod || "—"}</td>
                        <td className="px-3 py-2 font-mono text-[10px] text-slate-400">{req.transactionId || "—"}</td>
                        <td className="px-3 py-2 text-slate-300">{durationLabel}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusBadge}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-300">{daysLabel}</td>
                        <td className="px-3 py-2">
                          {deviceCount === 0 ? (
                            <span className="text-[10px] text-slate-500">No activity</span>
                          ) : (
                            <div>
                              <span
                                className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                                  sig?.overLimit
                                    ? "border-red-700/50 bg-red-900/40 text-red-300"
                                    : sig?.flagged
                                      ? "border-amber-700/50 bg-amber-900/40 text-amber-300"
                                      : "border-slate-600 bg-slate-700/50 text-slate-300"
                                }`}
                              >
                                {deviceCount}/{MAX_DEVICE_COUNT} device{deviceCount !== 1 ? "s" : ""}
                              </span>
                              {sig?.overLimit && (
                                <p className="mt-0.5 text-[9px] text-red-400">over device limit</p>
                              )}
                              {sig?.concurrentLoginDetected && !sig?.overLimit && (
                                <p className="mt-0.5 text-[9px] text-amber-400">multi-session</p>
                              )}
                              {sig?.lastLoginAt && (
                                <p className="mt-0.5 text-[9px] text-slate-500">
                                  last {new Date(sig.lastLoginAt).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-400 text-[10px]">
                          {new Date(req.submittedAt).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => handleRevoke(req.phone)}
                            className="rounded bg-red-900/50 px-2 py-0.5 text-[10px] font-medium text-red-300 hover:bg-red-700 transition-colors"
                            title="Revoke access"
                          >
                            Revoke
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        {/* Pagination — one page of 50 rows at a time, total from the server */}
        {approvedTotal > 0 && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 px-4 py-3">
            <p className="text-xs text-slate-400">
              Showing {approvedTotal === 0 ? 0 : approvedPage * ADMIN_PAGE_SIZE + 1}&ndash;
              {Math.min((approvedPage + 1) * ADMIN_PAGE_SIZE, approvedTotal)} of {approvedTotal} approved user{approvedTotal !== 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setApprovedPage((p) => Math.max(0, p - 1))}
                disabled={approvedPage === 0}
                className="rounded bg-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <span className="px-2 text-xs text-slate-400">
                Page {approvedPage + 1} of {Math.max(1, Math.ceil(approvedTotal / ADMIN_PAGE_SIZE))}
              </span>
              <button
                onClick={() =>
                  setApprovedPage((p) =>
                    (p + 1) * ADMIN_PAGE_SIZE < approvedTotal ? p + 1 : p
                  )
                }
                disabled={(approvedPage + 1) * ADMIN_PAGE_SIZE >= approvedTotal}
                className="rounded bg-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}

        </div>

        {/* ─── PIN Management ─── */}
        <div className="mt-6 rounded-xl border border-slate-700 bg-slate-800">
          <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white">Stage PIN Management</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPins(!showPins)}
                className="flex items-center gap-1 rounded-lg bg-slate-700 px-2.5 py-1 text-[10px] text-slate-300 hover:bg-slate-600"
              >
                {showPins ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {showPins ? "Hide" : "Show"}
              </button>
              <button
                onClick={() => {
                  resetAllPins();
                  setPins(getAllPins());
                  setPinSaved(true);
                  setTimeout(() => setPinSaved(false), 2000);
                }}
                className="flex items-center gap-1 rounded-lg bg-red-900/50 px-2.5 py-1 text-[10px] text-red-300 hover:bg-red-800"
              >
                Reset All to Defaults
              </button>
              {pinSaved && (
                <span className="text-[10px] text-green-400">PIN saved!</span>
              )}
            </div>
          </div>
          <div className="divide-y divide-slate-700">
            {(Object.entries(pins) as [Role, string][]).map(([role, pin]) => (
              <div key={role} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-sm text-slate-200">
                    {role === "prior-auth" ? "Prior Auth" :
                     role === "ar-voice" ? "AR Voice" :
                     role.charAt(0).toUpperCase() + role.slice(1)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {editPinRole === role ? (
                    <>
                      <input
                        type="text"
                        value={editPinValue}
                        onChange={(e) => setEditPinValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        onKeyDown={(e) => e.key === "Enter" && handleSavePin(role)}
                        className="w-20 rounded border border-brand-600 bg-slate-700 px-2 py-1 text-center text-xs text-white outline-none"
                        autoFocus
                      />
                      {editPinValue.length > 0 && editPinValue.length < 4 && (
                        <p className="text-[9px] text-amber-400 mt-0.5">Min 4 digits required</p>
                      )}
                      <button
                        onClick={() => handleSavePin(role)}
                        disabled={editPinValue.length < 4}
                        className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium ${
                          editPinValue.length >= 4
                            ? "bg-green-600 text-white hover:bg-green-500"
                            : "bg-slate-600 text-slate-400 cursor-not-allowed"
                        }`}
                      >
                        <Save className="h-3 w-3" /> Save
                      </button>
                      <button
                        onClick={() => setEditPinRole(null)}
                        className="rounded bg-slate-600 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-500"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span className={`font-mono text-sm ${showPins ? "text-brand-300" : "text-slate-500"}`}>
                        {showPins ? pin : "••••"}
                      </span>
                      <button
                        onClick={() => {
                          setEditPinRole(role);
                          setEditPinValue(pin);
                        }}
                        className="rounded bg-slate-700 px-2 py-1 text-[10px] text-slate-400 hover:bg-slate-600 hover:text-white"
                      >
                        Change
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Session Timeout ─── */}
        <div className="mt-6 rounded-xl border border-slate-700 bg-slate-800">
          <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-brand-400" />
              <h2 className="text-sm font-semibold text-white">Session Timeout</h2>
            </div>
            {timeoutSaved && (
              <span className="text-[10px] text-green-400">Saved!</span>
            )}
          </div>
          <div className="p-4">
            <p className="text-xs text-slate-400 mb-3">
              Automatically revoke student credentials after a set period of inactivity.
              Set to 0 to disable auto-logout.
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-[10px] font-medium text-slate-500 mb-1">Timeout Duration</label>
                <select
                  value={sessionTimeout}
                  onChange={(e) => setSessionTimeout(parseInt(e.target.value))}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
                >
                  <option value="0">No timeout (disabled)</option>
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="120">2 hours</option>
                  <option value="240">4 hours</option>
                  <option value="480">8 hours</option>
                  <option value="1440">24 hours</option>
                </select>
              </div>
              <button
                onClick={() => {
                  setSessionTimeoutMinutes(sessionTimeout);
                  setRefreshKey((k) => k + 1);
                }}
                className="mt-5 flex items-center gap-1 rounded-lg bg-brand-600 px-4 py-2 text-xs font-medium text-white hover:bg-brand-500"
              >
                <Save className="h-3.5 w-3.5" />
                Apply
              </button>
            </div>
            {sessionTimeout > 0 && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-brand-900/30 px-3 py-2">
                <Clock className="h-3.5 w-3.5 text-brand-400" />
                <p className="text-[10px] text-brand-300">
                  Students will be automatically logged out after <strong>{sessionTimeout} minutes</strong> of inactivity.
                  Their session resets each time they log in.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Scenario Builder */}
      <div className="mt-6 rounded-xl border border-slate-700 bg-slate-800 p-4">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="h-4 w-4 text-brand-400" />
          <h3 className="text-xs font-bold text-slate-200">Scenario Builder</h3>
          <span className="rounded-full bg-brand-900/50 px-2 py-0.5 text-[9px] font-medium text-brand-300">Create Custom Patient</span>
        </div>
        <ScenarioBuilder />
      </div>

      <div className="mt-6 text-center">
          <Link to="/" className="text-xs text-slate-500 underline hover:text-slate-300">
            Back to home
          </Link>
        </div>
      </div>

      <WhatsAppFloat />
    </div>
  );
}

// ─── Scenario Builder Component ──────────────────────────────────

interface CustomPatient {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  gender: string;
  chiefComplaint: string;
  problems: string[];
  medications: string[];
  insurance: string;
  vitals: { bp: string; hr: string; temp: string; rr: string; o2: string };
}

function ScenarioBuilder() {
  const [patients, setPatients] = useState<CustomPatient[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("hh_custom_patients") || "[]");
    } catch { return []; }
  });
  const [form, setForm] = useState<CustomPatient>({
    id: `CP-${Date.now()}`,
    firstName: "", lastName: "", age: 35, gender: "Male",
    chiefComplaint: "", problems: [], medications: [], insurance: "",
    vitals: { bp: "120/80", hr: "72", temp: "98.6", rr: "16", o2: "98" },
  });
  const [problemInput, setProblemInput] = useState("");
  const [medInput, setMedInput] = useState("");
  const [saved, setSaved] = useState(false);

  const savePatient = () => {
    if (!form.firstName.trim()) return;
    const newPatient = { ...form, id: `CP-${Date.now()}` };
    const updated = [...patients, newPatient];
    setPatients(updated);
    localStorage.setItem("hh_custom_patients", JSON.stringify(updated));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setForm({ id: `CP-${Date.now()}`, firstName: "", lastName: "", age: 35, gender: "Male", chiefComplaint: "", problems: [], medications: [], insurance: "", vitals: { bp: "120/80", hr: "72", temp: "98.6", rr: "16", o2: "98" } });
  };

  const deletePatient = (id: string) => {
    const updated = patients.filter(p => p.id !== id);
    setPatients(updated);
    localStorage.setItem("hh_custom_patients", JSON.stringify(updated));
  };

  const updateField = (field: string, value: any) => setForm({ ...form, [field]: value });
  const updateVital = (field: string, value: string) => setForm({ ...form, vitals: { ...form.vitals, [field]: value } });

  return (
    <div className="space-y-3">
      {/* Form */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div>
          <label className="mb-1 block text-[9px] font-medium text-slate-400">First Name</label>
          <input type="text" value={form.firstName} onChange={e => updateField("firstName", e.target.value)} placeholder="Jane" className="w-full rounded border border-slate-600 bg-slate-700 px-2 py-1 text-[10px] text-white outline-none focus:border-brand-400" />
        </div>
        <div>
          <label className="mb-1 block text-[9px] font-medium text-slate-400">Last Name</label>
          <input type="text" value={form.lastName} onChange={e => updateField("lastName", e.target.value)} placeholder="Doe" className="w-full rounded border border-slate-600 bg-slate-700 px-2 py-1 text-[10px] text-white outline-none focus:border-brand-400" />
        </div>
        <div>
          <label className="mb-1 block text-[9px] font-medium text-slate-400">Age</label>
          <input type="number" value={form.age} onChange={e => updateField("age", parseInt(e.target.value) || 0)} min={0} max={120} className="w-full rounded border border-slate-600 bg-slate-700 px-2 py-1 text-[10px] text-white outline-none focus:border-brand-400" />
        </div>
        <div>
          <label className="mb-1 block text-[9px] font-medium text-slate-400">Gender</label>
          <select value={form.gender} onChange={e => updateField("gender", e.target.value)} className="w-full rounded border border-slate-600 bg-slate-700 px-2 py-1 text-[10px] text-white outline-none focus:border-brand-400">
            <option>Male</option><option>Female</option><option>Other</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[9px] font-medium text-slate-400">Chief Complaint</label>
          <input type="text" value={form.chiefComplaint} onChange={e => updateField("chiefComplaint", e.target.value)} placeholder="Chest pain and shortness of breath" className="w-full rounded border border-slate-600 bg-slate-700 px-2 py-1 text-[10px] text-white outline-none focus:border-brand-400" />
        </div>
        <div>
          <label className="mb-1 block text-[9px] font-medium text-slate-400">Insurance</label>
          <input type="text" value={form.insurance} onChange={e => updateField("insurance", e.target.value)} placeholder="Blue Cross PPO" className="w-full rounded border border-slate-600 bg-slate-700 px-2 py-1 text-[10px] text-white outline-none focus:border-brand-400" />
        </div>
      </div>
      {/* Vitals */}
      <div className="grid grid-cols-5 gap-2">
        {["bp", "hr", "temp", "rr", "o2"].map(v => (
          <div key={v}>
            <label className="mb-1 block text-[9px] font-medium text-slate-400 uppercase">{v}</label>
            <input type="text" value={(form.vitals as any)[v]} onChange={e => updateVital(v, e.target.value)} className="w-full rounded border border-slate-600 bg-slate-700 px-2 py-1 text-[10px] text-white outline-none focus:border-brand-400" />
          </div>
        ))}
      </div>
      {/* Problems */}
      <div>
        <label className="mb-1 block text-[9px] font-medium text-slate-400">Problems</label>
        <div className="flex gap-1 mb-1">
          <input type="text" value={problemInput} onChange={e => setProblemInput(e.target.value)} placeholder="e.g. Essential hypertension (I10)" className="flex-1 rounded border border-slate-600 bg-slate-700 px-2 py-1 text-[10px] text-white outline-none focus:border-brand-400" />
          <button onClick={() => { if (problemInput.trim()) { updateField("problems", [...form.problems, problemInput.trim()]); setProblemInput(""); } }} className="rounded bg-brand-600 px-2 py-1 text-[10px] text-white">Add</button>
        </div>
        <div className="flex flex-wrap gap-1">
          {form.problems.map((p, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded bg-brand-900/50 px-1.5 py-0.5 text-[9px] text-brand-300">
              {p}
              <button onClick={() => updateField("problems", form.problems.filter((_, j) => j !== i))} className="text-brand-400 hover:text-red-400">×</button>
            </span>
          ))}
        </div>
      </div>
      {/* Medications */}
      <div>
        <label className="mb-1 block text-[9px] font-medium text-slate-400">Medications</label>
        <div className="flex gap-1 mb-1">
          <input type="text" value={medInput} onChange={e => setMedInput(e.target.value)} placeholder="e.g. Lisinopril 10mg" className="flex-1 rounded border border-slate-600 bg-slate-700 px-2 py-1 text-[10px] text-white outline-none focus:border-brand-400" />
          <button onClick={() => { if (medInput.trim()) { updateField("medications", [...form.medications, medInput.trim()]); setMedInput(""); } }} className="rounded bg-brand-600 px-2 py-1 text-[10px] text-white">Add</button>
        </div>
        <div className="flex flex-wrap gap-1">
          {form.medications.map((m, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded bg-green-900/50 px-1.5 py-0.5 text-[9px] text-green-300">
              {m}
              <button onClick={() => updateField("medications", form.medications.filter((_, j) => j !== i))} className="text-green-400 hover:text-red-400">×</button>
            </span>
          ))}
        </div>
      </div>
      {/* Save */}
      <div className="flex items-center gap-2">
        <button onClick={savePatient} className="flex items-center gap-1 rounded-lg bg-brand-600 px-4 py-2 text-[10px] font-medium text-white hover:bg-brand-500">
          <Save className="h-3 w-3" />
          {saved ? "Saved!" : "Save Patient Scenario"}
        </button>
      </div>
      {/* Saved patients list */}
      {patients.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-700">
          <p className="text-[10px] font-medium text-slate-400 mb-2">Custom Patients ({patients.length})</p>
          <div className="space-y-1">
            {patients.map(p => (
              <div key={p.id} className="flex items-center justify-between rounded bg-slate-700/50 px-2 py-1">
                <span className="text-[10px] text-slate-300">{p.firstName} {p.lastName} — {p.chiefComplaint?.slice(0, 40)}</span>
                <button onClick={() => deletePatient(p.id)} className="text-red-400 hover:text-red-300"><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}