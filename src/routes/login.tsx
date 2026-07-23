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
  type AccessRequest,
  isSubscriptionExpired,
  getSubscriptionStatus,
  getDaysRemaining,
  getDurationLabel,
} from "../store/accessStore";

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

  const handleLogin = () => {
    const cleaned = phone.trim();
    if (!cleaned) {
      setError("Please enter your phone number");
      return;
    }

    setError("");

    // Check if approved
    if (isPhoneApproved(cleaned)) {
      // Check subscription expiry
      if (isSubscriptionExpired(cleaned)) {
        setStatus("denied");
        setExpiryWarning("Your subscription has expired. Please renew via WhatsApp at +92 335 0340888.");
        return;
      }

      setLoggedInPhone(cleaned);

      // Show expiry warning if < 30 days
      const days = getDaysRemaining(cleaned);
      if (days < 30 && days !== Infinity) {
        setExpiryWarning(`Your subscription expires in ${days} day${days === 1 ? "" : "s"}. Please renew via WhatsApp.`);
      } else {
        setExpiryWarning(null);
      }

      // Prompt for name if not set yet
      if (!localStorage.getItem("hh_student_name")) {
        setShowNamePrompt(true);
        return;
      }
      navigate({ to: "/" });
      return;
    }

    // Check if there's a pending request
    const requests = getAccessRequests();
    const existing = requests.find((r) => r.phone === cleaned);
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
      navigate({ to: "/" });
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-br from-sky-50 to-blue-100 p-4">
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
          <p className="mb-5 text-sm text-slate-500">
            Enter your registered phone number to access the EHR simulator
          </p>

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
          ) : showNamePrompt ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-center">
                <h3 className="font-medium text-indigo-800">Welcome! What's your name?</h3>
                <p className="mt-1 text-sm text-indigo-600">
                  This will appear on your completion certificate.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Your Full Name
                </label>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); }}
                  placeholder="e.g. Muhammad Ali"
                  className="w-full rounded-lg border border-slate-200 py-2.5 px-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                  autoFocus
                />
              </div>
              <button
                onClick={handleSaveName}
                disabled={!studentName.trim()}
                className={`flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-white transition-colors ${
                  studentName.trim()
                    ? "bg-indigo-600 hover:bg-indigo-700"
                    : "bg-slate-300 cursor-not-allowed"
                }`}
              >
                <CheckCircle2 className="h-4 w-4" />
                Save & Enter EHR
              </button>
            </div>
          ) : status === "denied" ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
              <AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-500" />
              <h3 className="font-medium text-red-800">Access Denied</h3>
              <p className="mt-1 text-sm text-red-600">
                {expiryWarning || "No account found for this phone number. Please submit an access request first."}
              </p>
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
                    className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                  />
                </div>
                {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
              </div>

              <button
                onClick={handleLogin}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-500 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-600"
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
                className="block rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5 text-center text-sm font-medium text-sky-700 transition-colors hover:bg-sky-100"
              >
                Request Access & Enroll
              </Link>
            </div>
          )}

          <div className="mt-4 text-center text-xs text-slate-400">
            <Link to="/" className="underline hover:text-slate-600">Back to home</Link>
          </div>
        </div>
      </div>

      <WhatsAppFloat />
    </div>
  );
}