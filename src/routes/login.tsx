/**
 * LoginPage — Phone-based login gateway
 *
 * Students must log in with their registered phone number.
 * The app checks localStorage for approved phones. If the
 * phone is not yet approved, the user sees a "pending" or
 * "denied" message. This gate protects the EHR simulator
 * behind the payment/access workflow.
 *
 * Redesigned to match the new landing page (PR #44) and enrollment page
 * (PR #46): slate-neutral nav, framer-motion entrance + hero blobs (respecting
 * prefers-reduced-motion), gradient headline, two-track identity (Medical blue
 * / Dental teal), rounded-2xl cards, and lucide icons. The dental copy shows no
 * "rolling out" / "now live" qualifier — the dental track is fully live.
 *
 * Inspiration: DrChrono / Epic login gateways
 */

import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft, Eye, EyeOff, Loader2, Smile, Stethoscope, BookOpen } from "lucide-react";
import { WhatsAppFloat } from "../components/WhatsAppFloat";
import { AuthShell, AuthNavLink } from "../components/auth/AuthShell";
import {
  isPhoneApproved,
  getAccessRequests,
  getSubscriptionEndDate,
  setLoggedInPhone,
  lookupPhoneStatus,
  cachePhoneStatus,
  getLastSyncError,
  normalizePhone,
  type AccessRequest,
  revokeApprovedPhone,
} from "../store/accessStore";
import { recordLogin, MAX_DEVICE_COUNT, resetOtherSessions, type SharingSignal } from "../store/accountSecurity";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "denied" | "device-limit">("idle");
  const [requestInfo, setRequestInfo] = useState<AccessRequest | null>(null);
  const [expiryWarning, setExpiryWarning] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [deviceSignal, setDeviceSignal] = useState<SharingSignal | null>(null);
  const [resettingDevices, setResettingDevices] = useState(false);
  // The lookup goes to the server; say so, and refuse a second press meanwhile.
  const [checking, setChecking] = useState(false);
  // The login ID is masked by default; the student can show it to check typing.
  const [showPhone, setShowPhone] = useState(false);

  const tryAnotherNumber = () => {
    setStatus("idle");
    setRequestInfo(null);
    setExpiryWarning(null);
    setDeviceSignal(null);
    setPhone("");
  };

  const handleLogin = async () => {
    if (checking) return;
    setChecking(true);
    try {
      await runLogin();
    } finally {
      setChecking(false);
    }
  };

  const runLogin = async () => {
    const cleaned = phone.trim();
    if (!cleaned) {
      setError("Please enter your phone number");
      return;
    }

    setError("");

    // Ask the server about this one number only — the login path never reads
    // the enrolment table, so a fresh browser cannot pull it down.
    const remote = await lookupPhoneStatus(cleaned);
    setSyncError(getLastSyncError());

    // Offline path: if the server could not answer, fall back to what this
    // device already knows.
    const target = normalizePhone(cleaned);
    const existing = getAccessRequests().find((r) => normalizePhone(r.phone) === target);
    const effectiveStatus: "pending" | "approved" | "rejected" | null =
      remote?.status ?? (isPhoneApproved(cleaned) ? "approved" : existing?.status ?? null);

    if (effectiveStatus === "approved") {
      // Keep this device's local allowlist in step with the server so the
      // session survives a reload (isLoggedIn reads the local list).
      if (remote) cachePhoneStatus(cleaned, remote);

      // Subscription expiry — prefer the server's end date, else the cache.
      const endDateStr = remote ? remote.subscriptionEndDate : getSubscriptionEndDate(cleaned);
      const days = endDateStr
        ? Math.ceil((new Date(endDateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : Infinity;

      if (days !== Infinity && days <= 0) {
        revokeApprovedPhone(cleaned);
        setStatus("denied");
        setExpiryWarning("Your subscription has expired. Please renew via WhatsApp at +92 335 0340888.");
        return;
      }

      // Record device binding + session + login log, then enforce the device
      // allowlist: a brand-new device over MAX_DEVICE_COUNT is blocked until the
      // student signs out their other devices (client-side, raises the bar).
      const signal = await recordLogin(cleaned);
      if (signal.isNewDevice && signal.overLimit) {
        setDeviceSignal(signal);
        setStatus("device-limit");
        return; // do not mark this device logged in yet
      }

      setLoggedInPhone(cleaned);

      // Show expiry warning if < 30 days
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

    if (effectiveStatus === "pending") {
      setRequestInfo(existing ?? null);
      setStatus("pending");
      return;
    }

    // Rejected, or no request found at all
    setRequestInfo(null);
    setStatus("denied");
  };

  // "Sign out other devices" — clears every other device binding, keeps this
  // one, and lets the student through. The recovery path when blocked by the
  // device allowlist.
  const handleSignOutOtherDevices = async () => {
    const cleaned = phone.trim();
    if (!cleaned) return;
    setResettingDevices(true);
    try {
      await resetOtherSessions(cleaned);
      setLoggedInPhone(cleaned);
      setDeviceSignal(null);
      setStatus("idle");
      navigate({ to: "/dashboard" });
    } finally {
      setResettingDevices(false);
    }
  };

  const aside = (
    <ul className="space-y-5">
      <li className="flex gap-3">
        <Stethoscope className="mt-0.5 h-5 w-5 shrink-0 text-[#8fba47]" aria-hidden="true" />
        <p className="text-[15px] leading-relaxed text-white/80">
          <span className="font-semibold text-white">Medical track.</span> Registration, charting, ICD-10 and CPT coding,
          prior auth, CMS-1500, 835 posting and AR calls.
        </p>
      </li>
      <li className="flex gap-3">
        <Smile className="mt-0.5 h-5 w-5 shrink-0 text-[#8fba47]" aria-hidden="true" />
        <p className="text-[15px] leading-relaxed text-white/80">
          <span className="font-semibold text-white">Dental track.</span> CDT coding, tooth charting and the ADA claim form.
        </p>
      </li>
      <li className="flex gap-3">
        <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-[#8fba47]" aria-hidden="true" />
        <p className="text-[15px] leading-relaxed text-white/80">
          <span className="font-semibold text-white">New here?</span> Open the Tutorial Patient first — every stage is filled
          in so you can see what finished work looks like.
        </p>
      </li>
    </ul>
  );

  const nav = (
    <>
      <AuthNavLink to="/">Home</AuthNavLink>
      <AuthNavLink to="/access">Enroll</AuthNavLink>
    </>
  );

  return (
    <>
      <AuthShell
        title="Student login"
        subtitle="Enter the phone number you enrolled with to pick up where you left off — on any device."
        aside={aside}
        nav={nav}
      >
        {status === "device-limit" && deviceSignal ? (
          <section aria-labelledby="device-limit-title" className="rounded-2xl bg-white p-6 ring-1 ring-amber-200">
            <AlertCircle className="h-7 w-7 text-amber-500" aria-hidden="true" />
            <h2 id="device-limit-title" className="mt-3 text-xl font-bold text-slate-900">Too many devices</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
              This phone number is already signed in on {deviceSignal.distinctDeviceCount} devices — the limit is{" "}
              {MAX_DEVICE_COUNT}. To keep your account secure, sign out your other devices before continuing.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleSignOutOtherDevices}
                disabled={resettingDevices}
                className="min-h-12 w-full rounded-xl bg-amber-600 px-4 text-[15px] font-semibold text-white hover:bg-amber-500 disabled:opacity-60"
              >
                {resettingDevices ? "Signing out other devices…" : "Sign out other devices and continue"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatus("idle");
                  setDeviceSignal(null);
                }}
                className="min-h-12 w-full rounded-xl px-4 text-[15px] font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              >
                Back
              </button>
            </div>
            <p className="mt-4 text-[13px] text-slate-500">Need help? WhatsApp +92 335 0340888.</p>
          </section>
        ) : status === "pending" ? (
          <section aria-labelledby="pending-title" className="rounded-2xl bg-white p-6 ring-1 ring-slate-200">
            <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[13px] font-semibold text-amber-700">
              Waiting for approval
            </span>
            <h2 id="pending-title" className="mt-3 text-xl font-bold text-slate-900">Your request is being reviewed</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
              An admin checks your payment and approves your number, usually within 24 hours. Then sign in here with the
              same number.
            </p>
            {requestInfo?.submittedAt && (
              <p className="mt-3 text-[13px] text-slate-500">
                Submitted {new Date(requestInfo.submittedAt).toLocaleDateString()}
              </p>
            )}
            <button
              type="button"
              onClick={tryAnotherNumber}
              className="mt-5 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-[14px] font-medium text-[#2040c0] hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Try another number
            </button>
          </section>
        ) : status === "denied" ? (
          <section aria-labelledby="denied-title" className="rounded-2xl bg-white p-6 ring-1 ring-red-200">
            <AlertCircle className="h-7 w-7 text-red-500" aria-hidden="true" />
            <h2 id="denied-title" className="mt-3 text-xl font-bold text-slate-900">
              {expiryWarning ? "Your access has expired" : "No account for this number"}
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
              {expiryWarning || "We couldn't find an approved enrollment for this phone number. Check the number, or send an access request."}
            </p>
            {syncError && (
              <p className="mt-2 text-[13px] font-medium text-red-600">Could not reach the server: {syncError}</p>
            )}
            <p className="mt-2 text-[13px] text-slate-500">
              Access works on every device. If you were approved just now, reload this page and try again.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              {expiryWarning ? (
                <a
                  href="https://wa.me/923350340888"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-12 items-center justify-center rounded-xl bg-green-600 px-4 text-[15px] font-semibold text-white hover:bg-green-500"
                >
                  Renew on WhatsApp
                </a>
              ) : (
                <Link
                  to="/access"
                  className="flex min-h-12 items-center justify-center rounded-xl bg-[#192166] px-4 text-[15px] font-semibold text-white hover:bg-[#1a2888]"
                >
                  Request access
                </Link>
              )}
              <button
                type="button"
                onClick={tryAnotherNumber}
                className="min-h-12 w-full rounded-xl px-4 text-[15px] font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              >
                Try another number
              </button>
            </div>
          </section>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleLogin();
            }}
            noValidate
            className="rounded-2xl bg-white p-6 shadow-[0_20px_60px_-30px_rgba(25,33,102,0.35)] ring-1 ring-slate-200 md:p-8"
          >
            <h2 className="text-xl font-bold text-slate-900">Sign in</h2>
            {expiryWarning && (
              <p role="status" className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-[14px] font-medium text-amber-800">
                {expiryWarning}
              </p>
            )}

            <label htmlFor="login-phone" className="mt-5 block text-[14px] font-medium text-slate-700">
              Phone number (your login ID)
            </label>
            <div className="relative mt-1.5">
              <input
                id="login-phone"
                type={showPhone ? "tel" : "password"}
                inputMode="numeric"
                autoComplete="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setError("");
                  setStatus("idle");
                }}
                placeholder="03001234567"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "login-phone-error" : "login-phone-hint"}
                className={`min-h-12 w-full rounded-xl border bg-white pl-3.5 pr-20 text-[16px] tracking-wide text-slate-900 outline-none transition focus:border-[#2040c0] focus:ring-2 focus:ring-[#2040c0]/20 ${
                  error ? "border-red-400" : "border-slate-300"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPhone((v) => !v)}
                aria-pressed={showPhone}
                aria-controls="login-phone"
                className="absolute right-1.5 top-1/2 inline-flex min-h-9 -translate-y-1/2 items-center gap-1 rounded-lg px-2.5 text-[13px] font-medium text-slate-500 hover:bg-slate-100"
              >
                {showPhone ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                {showPhone ? "Hide" : "Show"}
              </button>
            </div>
            {error ? (
              <p id="login-phone-error" className="mt-1.5 text-[13px] text-red-600">{error}</p>
            ) : (
              <p id="login-phone-hint" className="mt-1.5 text-[13px] text-slate-500">
                The same number you wrote on your enrollment form.
              </p>
            )}

            <button
              type="submit"
              disabled={checking}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#192166] px-4 text-[15px] font-bold text-white transition hover:bg-[#1a2888] disabled:cursor-wait disabled:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2040c0]"
            >
              {checking && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {checking ? "Checking your number…" : "Sign in"}
            </button>

            <p className="mt-6 border-t border-slate-100 pt-5 text-center text-[14px] text-slate-600">
              New student?{" "}
              <Link to="/access" className="font-semibold text-[#2040c0] underline-offset-2 hover:underline">
                Request access and enroll
              </Link>
            </p>
          </form>
        )}

        <p className="mt-6 text-center text-[12px] text-slate-400">Build v4 · connection diagnostics</p>
      </AuthShell>
      <WhatsAppFloat />
    </>
  );
}
