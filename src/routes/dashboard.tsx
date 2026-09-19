/**
 * dashboard.tsx — Student home dashboard (post-login landing)
 *
 * Inspired by: EHR "Today" / home dashboards (Epic Home, eCW dashboard) and
 * learning-platform landing pages. Gives the student one screen after login
 * that shows BOTH tracks (Medical and Dental), where they left off, and lets
 * them jump straight back into the active stage.
 *
 * This is presentation-only: it reads the already-persisted per-user state
 * (medical `hh_userdata_<phone>` and dental `hh_dental_track_<phone>`) and
 * never mutates it.
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, LogOut, Stethoscope, Smile, Sparkles } from "lucide-react";
import {
  getLoggedInPhone,
  getSubscriptionStatus,
  isLoggedIn,
  logout,
} from "../store/accessStore";
import { loadUserData } from "../store/persistence";
import type { PipelineState, Role } from "../store/pipelineStore";
import type { DentalTrackState, DentalStageName } from "../components/dental/DentalTrackStore";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

const MEDICAL_STAGES: { role: Role; label: string }[] = [
  { role: "scribe", label: "Scribe" },
  { role: "coder", label: "Coder" },
  { role: "prior-auth", label: "Prior Auth" },
  { role: "biller", label: "Biller" },
  { role: "ar-voice", label: "AR Voice" },
];

const DENTAL_STAGE_LABELS: Record<DentalStageName, string> = {
  "case-select": "Select a case",
  briefing: "Briefing",
  planning: "Treatment plan",
  coding: "Coding",
  claim: "Claim",
  claims: "Claim status",
  ar: "AR follow-up",
  ledger: "Ledger",
  debrief: "Debrief",
};

const STATUS_TONE: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  denied: "bg-red-50 text-red-700 ring-red-200",
  charted: "bg-blue-50 text-blue-700 ring-blue-200",
  coded: "bg-blue-50 text-blue-700 ring-blue-200",
  billed: "bg-violet-50 text-violet-700 ring-violet-200",
  pending: "bg-slate-100 text-slate-600 ring-slate-200",
  reprocessed: "bg-amber-50 text-amber-700 ring-amber-200",
};

function readDentalState(phone: string | null): DentalTrackState | null {
  if (!phone) return null;
  try {
    const raw = localStorage.getItem(`hh_dental_track_${phone}`);
    return raw ? (JSON.parse(raw) as DentalTrackState) : null;
  } catch {
    return null;
  }
}

function DashboardPage() {
  const navigate = useNavigate();
  const loggedIn = isLoggedIn();
  const phone = getLoggedInPhone();

  if (!loggedIn || !phone) {
    navigate({ to: "/login" });
    return null;
  }

  // ── read persisted state (no providers needed) ──────────────────────
  const medical = loadUserData(phone);
  const pipeline: PipelineState | undefined = medical?.pipeline;
  const dental = readDentalState(phone);

  const subStatus = getSubscriptionStatus(phone);

  // Medical progress
  const currentRole: Role | "complete" = pipeline?.stage ?? "scribe";
  const medicalIdx = currentRole === "complete" ? MEDICAL_STAGES.length : MEDICAL_STAGES.findIndex((s) => s.role === currentRole);
  const medicalDone = currentRole === "complete" ? MEDICAL_STAGES.length : Math.max(0, medicalIdx);
  const medicalPct = Math.round((medicalDone / MEDICAL_STAGES.length) * 100);

  // Dental progress
  const dentalStage: DentalStageName | null = dental?.stage ?? null;
  const dentalStarted = Boolean(dental?.caseId);

  return (
    <div className="brand-gradient min-h-dvh">
      {/* header */}
      <header className="flex items-center justify-between border-b border-blue-200 bg-white/80 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <img src="/healthcarehustlers-logo.png" alt="Healthcare Hustlers" className="h-7 w-auto" style={{ maxWidth: "150px" }} />
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
            Student dashboard
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-slate-500 sm:block">{phone}</span>
          <button
            onClick={() => {
              logout();
              navigate({ to: "/login" });
            }}
            className="btn-ghost px-3 py-1.5 text-xs"
          >
            <LogOut className="h-3.5 w-3.5" /> Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {/* welcome */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
              <Sparkles className="h-5 w-5 text-blue-500" /> Welcome back
            </h1>
            <p className="mt-1 text-sm text-slate-500">Pick a track and resume where you left off.</p>
          </div>
          {subStatus !== "no-expiry" && (
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              subStatus === "expired" ? "bg-red-50 text-red-700" : subStatus === "expiring-soon" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
            }`}>
              {subStatus === "expired" ? "Subscription expired" : subStatus === "expiring-soon" ? "Expiring soon" : "Active"}
            </span>
          )}
        </div>

        {/* track cards */}
        <div className="grid gap-5 md:grid-cols-2">
          {/* Medical */}
          <div className="surface-card flex flex-col p-5">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                <Stethoscope className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800">Medical RCM</h2>
                <p className="text-[11px] text-slate-400">5-stage encounter pipeline</p>
              </div>
            </div>

            {/* stage stepper */}
            <div className="mt-4 space-y-1.5">
              {MEDICAL_STAGES.map((s, i) => {
                const done = i < medicalDone;
                const active = i === medicalIdx;
                return (
                  <div key={s.role} className="flex items-center gap-2">
                    <div className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      done ? "bg-emerald-500 text-white" : active ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"
                    }`}>
                      {done ? "✓" : i + 1}
                    </div>
                    <span className={`text-xs ${active ? "font-semibold text-blue-700" : done ? "text-slate-600" : "text-slate-400"}`}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Progress</span>
                <span className="text-xs font-bold text-slate-700">{medicalPct}%</span>
                {pipeline?.status && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${STATUS_TONE[pipeline.status] ?? STATUS_TONE.pending}`}>
                    {pipeline.status}
                  </span>
                )}
              </div>
              <Link to="/" className="btn-primary px-3 py-1.5 text-xs">
                {medicalDone === 0 ? "Start" : "Resume"} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Dental */}
          <div className="surface-card flex flex-col p-5">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
                <Smile className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800">Dental RCM</h2>
                <p className="text-[11px] text-slate-400">Case-based revenue cycle</p>
              </div>
            </div>

            <div className="mt-4 flex-1 rounded-xl border border-slate-100 bg-slate-50 p-3">
              {dentalStarted ? (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Current case</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-700">{dental?.caseId ?? "—"}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Stage: <span className="font-semibold text-teal-700">{dentalStage ? DENTAL_STAGE_LABELS[dentalStage] : "—"}</span>
                  </p>
                </div>
              ) : (
                <p className="py-4 text-center text-xs text-slate-400">
                  No case started yet. Pick a graded case to begin the dental pipeline.
                </p>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-xs text-slate-500">{dentalStarted ? "Resume your case" : "Start the dental track"}</span>
              <Link to="/dental" className="btn-primary bg-teal-600 px-3 py-1.5 text-xs hover:bg-teal-500">
                {dentalStarted ? "Resume" : "Start"} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-slate-400">
          Everything saves automatically to your account — you can switch tracks anytime.
        </p>
      </main>
    </div>
  );
}
