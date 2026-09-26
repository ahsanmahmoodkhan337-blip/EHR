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
 * / Dental teal), rounded-2xl cards, and lucide icons. Also updates the dental
 * copy from "rolling out now" to "now live" (the dental track is fully live).
 *
 * Inspiration: DrChrono / Epic login gateways
 */

import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import { Phone, LogIn, AlertCircle, Sparkles, Stethoscope, Smile, ArrowRight } from "lucide-react";
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
  getDaysRemaining,
  revokeApprovedPhone,
} from "../store/accessStore";
import { recordLogin, MAX_DEVICE_COUNT, resetOtherSessions, type SharingSignal } from "../store/accountSecurity";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  // Shared reveal preset — collapses to no-op under prefers-reduced-motion.
  const rise = (i = 0) => ({
    initial: { opacity: 0, y: reduceMotion ? 0 : 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.15 },
    transition: { duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : i * 0.06 },
  });

  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "denied" | "device-limit">("idle");
  const [requestInfo, setRequestInfo] = useState<AccessRequest | null>(null);
  const [expiryWarning, setExpiryWarning] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [deviceSignal, setDeviceSignal] = useState<SharingSignal | null>(null);
  const [resettingDevices, setResettingDevices] = useState(false);

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

  return (
    <div className="min-h-dvh overflow-x-hidden bg-slate-50 text-slate-800">
      {/* Nav */}
      <nav className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200/70 bg-white/85 px-4 py-3 backdrop-blur-md">
        <img
          src="/healthcarehustlers-logo.png"
          alt="Healthcare Hustlers"
          className="h-7 w-auto"
          style={{ maxWidth: "160px" }}
        />
        <div className="flex items-center gap-2 text-xs">
          <Link to="/" className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-50">
            Home
          </Link>
          <Link to="/access" className="rounded-lg bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-700">
            Enroll Now
          </Link>
        </div>
      </nav>

      {/* Main */}
      <section className="relative isolate overflow-hidden">
        {/* Subtle animated background */}
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
          <motion.div
            className="absolute -top-24 left-1/2 h-[420px] w-[420px] -translate-x-[130%] rounded-full bg-blue-300/30 blur-3xl"
            animate={reduceMotion ? undefined : { x: [0, 48, 0], y: [0, 24, 0] }}
            transition={{ duration: 15, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -top-16 left-1/2 h-[380px] w-[380px] translate-x-[20%] rounded-full bg-teal-300/30 blur-3xl"
            animate={reduceMotion ? undefined : { x: [0, -48, 0], y: [0, 32, 0] }}
            transition={{ duration: 17, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
          />
        </div>

        <div className="mx-auto flex min-h-[calc(100dvh-57px)] w-full max-w-md flex-col justify-center px-4 py-12">
          {/* Headline */}
          <motion.div {...rise(0)} className="mb-6 text-center">
            <motion.p className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-medium text-slate-500">
              <Sparkles className="h-3.5 w-3.5 text-blue-500" />
              Medical + Dental RCM training
            </motion.p>
            <motion.h1 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
              Student{" "}
              <span className="bg-gradient-to-r from-blue-600 to-teal-600 bg-clip-text text-transparent">
                Login
              </span>
            </motion.h1>
            <motion.p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
              Enter your registered phone number to pick up where you left off.
            </motion.p>
          </motion.div>

          {/* Login Card */}
          <motion.div {...rise(1)} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/50 md:p-8">
            {/* ─── What's inside the sandbox ─── */}
            <div className="mb-6 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                Inside the sandbox
              </p>
              <div className="space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                    <Stethoscope className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-xs leading-relaxed text-slate-600">
                    <span className="font-semibold text-blue-600">Medical</span> — Registration → Scribe → ICD-10 / CPT coding → CMS-1500 → Prior Auth → AR calling
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-teal-50 text-teal-600">
                    <Smile className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-xs leading-relaxed text-slate-600">
                    <span className="font-semibold text-teal-600">Dental</span> — CDT coding, tooth charting &amp; ADA claim form —{" "}
                    <span className="font-medium text-teal-700">now live</span>
                  </p>
                </div>
              </div>
            </div>

            {status === "device-limit" && deviceSignal ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-center">
                <AlertCircle className="mx-auto mb-2 h-8 w-8 text-amber-500" />
                <h3 className="font-semibold text-amber-800">Too many devices</h3>
                <p className="mt-1 text-sm text-amber-700">
                  This phone number is already signed in on {deviceSignal.distinctDeviceCount} devices —
                  the limit is {MAX_DEVICE_COUNT}. To keep your account secure, sign out your other
                  devices before continuing.
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    onClick={handleSignOutOtherDevices}
                    disabled={resettingDevices}
                    className="w-full rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:opacity-60"
                  >
                    {resettingDevices ? "Signing out other devices…" : "Sign out other devices & continue"}
                  </button>
                  <button
                    onClick={() => {
                      setStatus("idle");
                      setDeviceSignal(null);
                    }}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Back
                  </button>
                </div>
                <p className="mt-3 text-[10px] text-slate-400">
                  Need help? Contact us on WhatsApp at +92 335 0340888.
                </p>
              </div>
            ) : status === "pending" && requestInfo ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
                <AlertCircle className="mx-auto mb-2 h-8 w-8 text-amber-500" />
                <h3 className="font-semibold text-amber-800">Access Pending Approval</h3>
                <p className="mt-1 text-sm text-amber-600">
                  Your request is under review. You'll receive access once an admin approves your account.
                </p>
                <p className="mt-3 text-xs text-amber-500">
                  Submitted: {new Date(requestInfo.submittedAt).toLocaleDateString()}
                </p>
              </div>
            ) : status === "denied" ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
                <AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-500" />
                <h3 className="font-semibold text-red-800">Access Denied</h3>
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
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500"
                  >
                    Request Access
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
                {expiryWarning && (
                  <a
                    href="https://wa.me/923350340888"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-500"
                  >
                    Renew via WhatsApp
                  </a>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {expiryWarning && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center">
                    <p className="text-xs font-medium text-amber-700">{expiryWarning}</p>
                  </div>
                )}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
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
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-300"
                    />
                  </div>
                  {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
                </div>

                <button
                  onClick={handleLogin}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700"
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
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Request Access & Enroll
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}

            <div className="mt-5 text-center text-xs text-slate-400">
              <Link to="/" className="underline decoration-slate-300 underline-offset-2 hover:text-slate-600">Back to home</Link>
            </div>
            <div className="mt-2 text-center text-[10px] text-slate-300">
              Build v4 · connection diagnostics
            </div>
          </motion.div>
        </div>
      </section>

      <WhatsAppFloat />
    </div>
  );
}
