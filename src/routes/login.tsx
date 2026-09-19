/**
 * LoginPage — Phone-based login gateway
 *
 * Students must log in with their registered phone number.
 * The app checks localStorage for approved phones. If the
 * phone is not yet approved, the user sees a "pending" or
 * "denied" message. This gate protects the EHR simulator
 * behind the payment/access workflow.
 *
 * Inspiration: DrChrono / Epic login gateways
 */

import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Activity, Phone, LogIn, AlertCircle, CheckCircle2 } from "lucide-react";
import { WhatsAppFloat } from "../components/WhatsAppFloat";
import {
  isPhoneApproved,
  getAccessRequests,
  setLoggedInPhone,
  syncFromSupabase,
  getLastSyncError,
  normalizePhone,
  type AccessRequest,
  isSubscriptionExpired,
  getSubscriptionStatus,
  getDaysRemaining,
  getDurationLabel,
  revokeApprovedPhone,
} from "../store/accessStore";
import { recordLogin } from "../store/accountSecurity";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "denied" | "approved">("idle");
  const [requestInfo, setRequestInfo] = useState<AccessRequest | null>(null);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [expiryWarning, setExpiryWarning] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const handleLogin = async () => {
    const cleaned = phone.trim();
    if (!cleaned) {
      setError("Please enter your phone number");
      return;
    }

    setError("");

    // Pull the latest approved list from Supabase before checking, so a
    // student who was just approved on the admin's device can log in from
    // theirs (localStorage is per-device and may be stale/empty).
    await syncFromSupabase();
    setSyncError(getLastSyncError());

    // Check if approved
    if (isPhoneApproved(cleaned)) {
      // Check subscription expiry — auto-revoke if expired
      if (isSubscriptionExpired(cleaned)) {
        revokeApprovedPhone(cleaned);
        setStatus("denied");
        setExpiryWarning("Your subscription has expired. Please renew via WhatsApp at +92 335 0340888.");
        return;
      }

      setLoggedInPhone(cleaned);

      // Record device binding + session + login log (detection-only, never blocks).
      await recordLogin(cleaned);

      // Show expiry warning if < 30 days
      const days = getDaysRemaining(cleaned);
      if (days < 30 && days !== Infinity) {
        setExpiryWarning(`Your subscription expires in ${days} day${days === 1 ? "" : "s"}. Please renew via WhatsApp.`);
      } else {
        setExpiryWarning(null);
      }

      // Save phone as name if no name set yet (no prompt needed)
      if (!localStorage.getItem("hh_student_name")) {
        localStorage.setItem("hh_student_name", cleaned);
      }
      navigate({ to: "/dashboard" });
      return;
    }

    // Check if there's a pending request
    const requests = getAccessRequests();
    const target = normalizePhone(cleaned);
    const existing = requests.find((r) => normalizePhone(r.phone) === target);
    if (existing) {
      setRequestInfo(existing);
      if (existing.status === "pending") {
        setStatus("pending");
      } else if (existing.status === "rejected") {
        setStatus("denied");
      }
      return;
    }

    // No request found at all
    setStatus("denied");
  };

  const handleSaveName = () => {
    if (studentName.trim()) {
      localStorage.setItem("hh_student_name", studentName.trim());
      navigate({ to: "/dashboard" });
    }
  };

  return (
    <div className="brand-gradient flex min-h-dvh flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 text-center">
          <img
            src="/healthcarehustlers-logo.png"
            alt="Healthcare Hustlers"
            className="mx-auto h-12 w-auto mb-3"
            style={{ maxWidth: "220px" }}
          />
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
          <h2 className="mb-1 text-lg font-semibold text-slate-800">Student Login</h2>
          <p className="mb-4 text-sm text-slate-500">
            Enter your registered phone number to access the EHR simulator
          </p>

          {/* ─── What's inside the sandbox ─── */}
          <div className="mb-5 rounded-lg border border-slate-100 bg-slate-50 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Inside the sandbox
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                  Medical
                </span>
                <span className="text-[11px] text-slate-600">
                  Registration → Scribe → ICD-10 / CPT coding → CMS-1500 → Prior Auth → AR calling
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700">
                  Dental
                </span>
                <span className="text-[11px] text-slate-600">
                  CDT coding, tooth charting &amp; ADA claim form —{" "}
                  <span className="font-medium text-teal-700">rolling out now</span>
                </span>
              </div>
            </div>
          </div>

          {status === "pending" && requestInfo ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
              <AlertCircle className="mx-auto mb-2 h-8 w-8 text-amber-500" />
              <h3 className="font-medium text-amber-800">Access Pending Approval</h3>
              <p className="mt-1 text-sm text-amber-600">
                Your request is under review. You'll receive access once an admin approves your account.
              </p>
              <p className="mt-3 text-xs text-amber-500">
                Submitted: {new Date(requestInfo.submittedAt).toLocaleDateString()}
              </p>
            </div>
          ) : status === "denied" ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
              <AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-500" />
              <h3 className="font-medium text-red-800">Access Denied</h3>
              <p className="mt-1 text-sm text-red-600">
                {expiryWarning || "No account found for this phone number. Please submit an access request first."}
              </p>
              {syncError && (
                <p className="mt-2 text-xs font-medium text-red-500">Could not reach server: {syncError}</p>
              )}
              <p className="mt-2 text-[10px] text-slate-400">Note: Access works across devices. If you were just approved, refresh this page and try again — or contact us on WhatsApp.</p>
              {!expiryWarning && (
                <Link
                  to="/access"
                  className="mt-3 inline-block rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
                >
                  Request Access
                </Link>
              )}
              {expiryWarning && (
                <a
                  href="https://wa.me/923350340888"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500"
                >
                  Renew via WhatsApp
                </a>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {expiryWarning && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
                  <p className="text-xs font-medium text-amber-700">{expiryWarning}</p>
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Phone Number (Login ID)
                </label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setError("");
                      setStatus("idle");
                    }}
                    placeholder="e.g. 03001234567"
                    className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
              </div>

              <button
                onClick={handleLogin}
                className="btn-primary w-full"
              >
                <LogIn className="h-4 w-4" />
                Sign In
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-2 text-slate-400">New student?</span>
                </div>
              </div>

              <Link
                to="/access"
                className="btn-secondary w-full"
              >
                Request Access & Enroll
              </Link>
            </div>
          )}

          <div className="mt-4 text-center text-xs text-slate-400">
            <Link to="/" className="underline hover:text-slate-600">Back to home</Link>
          </div>
          <div className="mt-2 text-center text-[10px] text-slate-300">
            Build v4 · connection diagnostics
          </div>
        </div>
      </div>

      <WhatsAppFloat />
    </div>
  );
}