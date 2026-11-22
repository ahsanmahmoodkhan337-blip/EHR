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
import { ArrowRight, ShieldCheck, Stethoscope, Smile, Sparkles } from "lucide-react";
import { getLoggedInPhone, getSubscriptionStatus, isLoggedIn } from "../store/accessStore";
import { loadUserData } from "../store/persistence";
import { PatientProvider, usePatientStore } from "../store/patientStore";
import { useAllAppointments } from "../store/ehrStore";
import { AppShell } from "../components/AppShell";
import { useActiveTrack } from "../components/shell/activeTrack";
import { SHELL_NAV_ITEMS } from "../components/shell/navItems";
import { requestPatientOpen } from "../components/shell/pendingPatient";
import { encounterKey, type PipelineStoreState } from "../store/pipelineStore";
import { ownPatientList, TUTORIAL_PATIENT_ID } from "../domain/inbox";
import {
  PRACTICE_AREA_GROUPS,
  practiceAreaCounts,
  type PracticeAreaCount,
  type PracticeAreaTile,
} from "../domain/practiceAreas";
import { MEDICAL_CASE_SCENARIOS } from "../data/medical/caseScenarios";
import { DENTAL_CASE_SCENARIOS } from "../data/dental/caseScenarios";
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
 * The four practice-area groups the dashboard carries (owner's student
 * experience work order, 2026-11-21, item 6): Front desk · Clinical · Billing ·
 * Review, in the order the work moves. The groups, their tiles and the stage
 * names they print all come from `domain/practiceAreas.ts`, so a destination
 * cannot fall out of the dashboard and the stage names cannot drift from the
 * encounter stepper's.
 */
const AREA_GROUPS = PRACTICE_AREA_GROUPS;

/** The nav entry a tile opens, resolved from the shell's one list. */
function navFor(tile: PracticeAreaTile) {
  return tile.nav ? SHELL_NAV_ITEMS.find((item) => item.id === tile.nav) : undefined;
}

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
  // The student's own charts and appointments — the two records the practice
  // area counts read. Both hooks sit ABOVE the sign-in early return below, so
  // the hook order never depends on whether the student is signed in.
  const { patients, getPatientById } = usePatientStore();
  const appointments = useAllAppointments();

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

  // ── the four practice areas and their real counts ───────────────────
  // Every number is read from the student's own saved records through the same
  // domain builders each page uses (`domain/practiceAreas.ts`), so a tile and
  // the page it opens print the same figure. Nothing here is stored by hand.
  const today = (() => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}-${month}-${day}`;
  })();
  const areaCounts: Partial<Record<string, PracticeAreaCount>> = practiceAreaCounts({
    encounters: Object.values(pipeline?.encounters ?? {}),
    dental,
    track,
    ownPatientCount: ownPatientList(patients).length,
    appointmentsToday: appointments.filter((appointment) => appointment.date === today).length,
    paRecords: medical?.paRecords ?? [],
    caseCount: MEDICAL_CASE_SCENARIOS.length + DENTAL_CASE_SCENARIOS.length,
    now: new Date().toISOString(),
    nameForPatient: (patientId, fallback) => {
      const patient = patientId ? getPatientById(patientId) : undefined;
      if (patient) return `${patient.firstName} ${patient.lastName}`;
      return fallback ?? "No patient attached";
    },
  });

  // Prior Auth has no page of its own: its tile opens that patient's own Prior
  // Auth stage, on the patient the workspace already has open (the Tutorial
  // Patient when nothing is open yet).
  const priorAuthPatientId = pipeline?.activePatientId ?? TUTORIAL_PATIENT_ID;

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

        {/* Practice areas — four groups in workflow order.
            Owner's student-experience work order, 2026-11-21, item 6: the flat
            grid of nine identical buttons became Front desk · Clinical ·
            Billing · Review. The groups come from `domain/practiceAreas.ts`,
            which reads the shell's one destination list and the pipeline's one
            stage list, so a tile prints the same stage name the encounter's
            stepper prints and every destination stays reachable. */}
        <div className="surface-card mt-5 p-5">
          <h2 className="text-base font-bold text-slate-800">Practice areas</h2>
          <p className="mt-0.5 text-[11px] text-slate-400">
            The seven-stage encounter, group by group.
          </p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {AREA_GROUPS.map((group) => (
              <section key={group.id} aria-labelledby={`practice-area-${group.id}`}>
                <h3 id={`practice-area-${group.id}`} className="section-header">
                  {group.label}
                </h3>
                <ul className="space-y-1.5">
                  {group.tiles.map((tile) => {
                    const nav = navFor(tile);
                    const Icon = nav?.icon ?? ShieldCheck;
                    const count = areaCounts[tile.id];
                    const className =
                      "flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600";
                    const body = (
                      <>
                        <Icon className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="text-xs font-medium text-slate-700">{tile.label}</span>
                            {count && (
                              <span className="shrink-0 whitespace-nowrap text-[10px] font-semibold tabular-nums text-slate-400">
                                {count.label}
                              </span>
                            )}
                          </span>
                          <span className="block text-[11px] leading-snug text-slate-500">
                            {tile.description}
                          </span>
                        </span>
                      </>
                    );
                    return (
                      <li key={tile.id}>
                        {nav ? (
                          <Link to={nav.to} className={className}>
                            {body}
                          </Link>
                        ) : (
                          <Link
                            to="/encounter/$encounterId/$stage"
                            params={{ encounterId: priorAuthPatientId, stage: "prior-auth" }}
                            className={className}
                          >
                            {body}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-slate-400">
          Work saves automatically to this browser as you go — the indicator in the top bar shows
          the last save, and says so if a save fails. You can switch tracks anytime.
        </p>
        </div>
      </div>
    </AppShell>
  );
}
