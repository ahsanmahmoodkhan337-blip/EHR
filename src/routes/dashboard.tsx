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

import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Stethoscope, Smile, Sparkles } from "lucide-react";
import { getLoggedInPhone, getSubscriptionStatus, isLoggedIn } from "../store/accessStore";
import { loadUserData } from "../store/persistence";
import { PatientProvider } from "../store/patientStore";
import { AppShell } from "../components/AppShell";
import { useActiveTrack } from "../components/shell/activeTrack";
import { SHELL_NAV_ITEMS } from "../components/shell/navItems";
import { requestPatientOpen } from "../components/shell/pendingPatient";
import { getSharingSignal, MAX_DEVICE_COUNT, resetOtherSessions } from "../store/accountSecurity";
import { encounterKey, type PipelineStoreState } from "../store/pipelineStore";
import {
  ENCOUNTER_FLOW_STAGES,
  currentFlowStage,
  flowStageIndex,
} from "../domain/encounterFlow";
import type { DentalTrackState, DentalStageName } from "../components/dental/DentalTrackStore";

export const Route = createFileRoute("/dashboard")({
  // The dashboard sits inside the same shell as every other page, so it needs
  // the patient list the top bar's search reads.
  component: () => (
    <PatientProvider>
      <DashboardPage />
    </PatientProvider>
  ),
});

/**
 * The medical encounter's stages, in the owner's order, from the one flow
 * module — so the number printed here is the number the encounter's stepper
 * prints (owner's audit, 2026-11-20, item 1). The old list numbered the roles
 * (Coder 2, Prior Auth 3, Biller 4), which contradicted the real order.
 */
const MEDICAL_STAGES = ENCOUNTER_FLOW_STAGES;

/**
 * The destinations the dashboard carries a card for: everything the removed
 * left rail held except Home and Settings, which are the header's own controls.
 */
const PRACTICE_AREAS = SHELL_NAV_ITEMS.filter(
  (item) => item.id !== "home" && item.id !== "settings",
);

const DENTAL_STAGE_LABELS: Record<DentalStageName, string> = {
  "case-select": "Select a case",
  briefing: "Briefing",
  planning: "Treatment plan",
  predetermination: "Predetermination",
  coding: "Coding",
  claim: "Claim",
  remittance: "Remittance",
  ar: "AR follow-up",
  debrief: "Debrief",
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
  // The one stored track, live: the header toggle and this page cannot disagree,
  // and moving between pages never changes it (owner item 4).
  const track = useActiveTrack();
  const navigate = useNavigate();
  const loggedIn = isLoggedIn();
  const phone = getLoggedInPhone();
  const [resettingDevices, setResettingDevices] = useState(false);

  // "Sign out other devices" — clears every other binding, keeps this one.
  const handleResetOtherDevices = async () => {
    if (!phone) return;
    setResettingDevices(true);
    try {
      await resetOtherSessions(phone);
      window.location.reload();
    } finally {
      setResettingDevices(false);
    }
  };

  if (!loggedIn || !phone) {
    return (
      <div className="brand-gradient flex min-h-dvh flex-col items-center justify-center p-4">
        <div className="surface-card max-w-sm w-full p-8 text-center">
          <Sparkles className="mx-auto mb-3 h-8 w-8 text-brand-500" />
          <h1 className="text-base font-bold text-slate-800">Student Dashboard</h1>
          <p className="mt-2 text-sm text-slate-500">
            Sign in to see your tracks and pick up where you left off.
          </p>
          <Link to="/login" className="btn-primary mt-4 w-full">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  // ── read persisted state (no providers needed) ──────────────────────
  const medical = loadUserData(phone);
  // One encounter per patient — the dashboard reports the patient being worked on.
  const pipeline: PipelineStoreState | undefined = medical?.pipeline;
  const activeEncounter = pipeline?.encounters?.[encounterKey(pipeline.activePatientId)];
  const dental = readDentalState(phone);

  const subStatus = getSubscriptionStatus(phone);
  const signal = getSharingSignal(phone);

  // Medical progress — the stage the encounter's own record is on, numbered in
  // the owner's order. Registration/eligibility are front-desk work, not stages.
  const encounterStage = activeEncounter?.stage ?? "scribe";
  const medicalDone =
    encounterStage === "complete"
      ? MEDICAL_STAGES.length
      : Math.max(0, flowStageIndex(currentFlowStage({
          role: encounterStage,
          chartStage: activeEncounter?.chartStage ?? null,
        })));
  const medicalIdx = medicalDone;
  const medicalPct = Math.round((medicalDone / MEDICAL_STAGES.length) * 100);

  // Dental progress
  const dentalStage: DentalStageName | null = dental?.stage ?? null;
  const dentalStarted = Boolean(dental?.caseId);

  return (
    <AppShell
      track={track}
      activeNav="home"
      onPatientSelect={(patientId) => {
        // The dashboard has no patient workspace: open the chart at "/".
        requestPatientOpen(patientId);
        void navigate({ to: "/" });
      }}
    >
      {/* 19 Nov display: the dashboard sits on the brand gradient and its cards
          float on it, exactly as the reference build's student dashboard did. */}
      <div className="brand-gradient min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-8">
        {/* welcome */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
              <Sparkles className="h-5 w-5 text-brand-500" /> Welcome back
            </h1>
            <p className="mt-1 text-sm text-slate-500">Pick a track and resume where you left off.</p>
          </div>
          {subStatus !== "no-expiry" && (
            <span className={`status-badge ${
              subStatus === "expired" ? "is-danger" : subStatus === "expiring-soon" ? "is-warning" : "is-success"
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
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                <Stethoscope className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800">Medical RCM</h2>
                <p className="text-[11px] text-slate-400">7-stage encounter pipeline</p>
              </div>
            </div>

            {/* stage stepper */}
            <div className="mt-4 space-y-1.5">
              {MEDICAL_STAGES.map((s, i) => {
                const done = i < medicalDone;
                const active = i === medicalIdx;
                return (
                  <div key={s.id} className="flex items-center gap-2">
                    <div className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      done ? "bg-green-500 text-white" : active ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-500"
                    }`}>
                      {done ? "✓" : i + 1}
                    </div>
                    <span className={`text-xs ${active ? "font-semibold text-brand-700" : done ? "text-slate-600" : "text-slate-400"}`}>
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
              </div>
              <div className="flex items-center gap-2">
                <Link to="/medical-cases" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                  Graded cases
                </Link>
                <Link to="/" className="btn-primary px-3 py-1.5 text-xs">
                  {medicalDone === 0 ? "Start" : "Resume"} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* Dental */}
          <div className="surface-card flex flex-col p-5">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-100 text-accent-700">
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
                    Stage: <span className="font-semibold text-accent-700">{dentalStage ? DENTAL_STAGE_LABELS[dentalStage] : "—"}</span>
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
              <Link to="/dental" className="btn-primary bg-accent-600 px-3 py-1.5 text-xs hover:bg-accent-500">
                {dentalStarted ? "Resume" : "Start"} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Practice areas — the destinations the left rail used to hold.
            Owner's style correction, 2026-11-21 (spec `nov19-style-restore.md`
            §1): the rail is gone, so every destination it carried gets a 19
            November card here instead. The list is `navItems.ts` — the same one
            the header reads — so a page cannot fall out of both. Home and
            Settings are the header's own two controls and are left out here. */}
        <div className="surface-card mt-5 p-5">
          <h2 className="text-base font-bold text-slate-800">Practice areas</h2>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Every page in the simulator, one click away.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {PRACTICE_AREAS.map(({ id, label, icon: Icon, to }) => (
              <Link
                key={id}
                to={to}
                className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                <Icon className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                <span className="min-w-0 truncate">{label}</span>
              </Link>
            ))}
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-slate-400">
          Work saves automatically to this browser as you go — the indicator in the top bar shows
          the last save, and says so if a save fails. You can switch tracks anytime.
        </p>

        {/* Account activity — device-binding signal + device-management path. */}
        <div className="mt-2 text-center text-[10px] text-slate-400">
          {signal.distinctDeviceCount > 0 ? (
            <span>
              Signed in on {signal.distinctDeviceCount} device{signal.distinctDeviceCount === 1 ? "" : "s"}
              {signal.lastLoginAt ? ` · last sign-in ${new Date(signal.lastLoginAt).toLocaleString()}` : ""}
            </span>
          ) : (
            <span>First sign-in on this device</span>
          )}
          {signal.flagged && (
            <span className="ml-1 text-amber-500" title="This account has been used from more than one device or had overlapping sessions.">
              (multi-device)
            </span>
          )}
          {signal.distinctDeviceCount > 1 && (
            <button
              onClick={handleResetOtherDevices}
              disabled={resettingDevices}
              className="ml-2 inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-60"
              title={`Sign out every other device and keep only this one (device limit: ${MAX_DEVICE_COUNT}).`}
            >
              {resettingDevices ? "Signing out…" : "Sign out other devices"}
            </button>
          )}
        </div>
        </div>
      </div>
    </AppShell>
  );
}
