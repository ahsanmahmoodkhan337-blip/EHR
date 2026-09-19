/**
 * MedicalCaseRunner.tsx — Medical RCM case runner shell
 *
 * Inspired by: the dental track's DentalCaseRunner, applied to the medical
 * track's seven-stage clinical-to-financial spine. Walks the student through:
 *   case-select → briefing → registration → eligibility → clinical → coding →
 *   (conditional) prior-auth → claim → ar-follow-up → debrief
 *
 * The coding / claim / prior-auth / ar stages are case-driven here: the runner
 * feeds the case data (payer rules, expected adjudication, grading rubrics) into
 * focused stage screens and enforces the per-stage scoring. The case-select,
 * briefing and debrief frames mirror the dental runner.
 */

import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Code2,
  FileCheck2,
  Phone,
  RotateCcw,
  Search,
  ShieldCheck,
  Stethoscope,
  Trophy,
  UserRound,
  XCircle,
} from "lucide-react";
import {
  findPlan,
  MEDICAL_CASE_SCENARIOS,
  type MedicalCaseScenario,
  type MedicalCaseTrap,
} from "../../data/medical";
import { CPT_CODES } from "../CodingQueue/cptData";
import { ICD10_CODES } from "../CodingQueue/icd10Data";
import {
  useMedicalCase,
  type MedicalARAction,
  type MedicalCaseStageName,
  type MedicalPriorAuthChoice,
  type MedicalProcedureLine,
} from "./MedicalCaseStore";

// ─── stage spine ─────────────────────────────────────────────────────────────

const FRAME_STAGES: { id: MedicalCaseStageName; label: string; icon: ReactNode }[] = [
  { id: "case-select", label: "Case", icon: <BookOpen className="h-3.5 w-3.5" /> },
  { id: "briefing", label: "Briefing", icon: <ClipboardList className="h-3.5 w-3.5" /> },
];

const RCM_STAGES: { id: MedicalCaseStageName; label: string; icon: ReactNode }[] = [
  { id: "registration", label: "Register", icon: <UserRound className="h-3.5 w-3.5" /> },
  { id: "eligibility", label: "Eligibility", icon: <BadgeCheck className="h-3.5 w-3.5" /> },
  { id: "clinical", label: "Chart", icon: <Stethoscope className="h-3.5 w-3.5" /> },
  { id: "coding", label: "Coding", icon: <Code2 className="h-3.5 w-3.5" /> },
  { id: "prior-auth", label: "Prior Auth", icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  { id: "claim", label: "Claim", icon: <FileCheck2 className="h-3.5 w-3.5" /> },
  { id: "ar-follow-up", label: "AR", icon: <Phone className="h-3.5 w-3.5" /> },
];

const DEBRIEF_STAGE: { id: MedicalCaseStageName; label: string; icon: ReactNode } = {
  id: "debrief",
  label: "Debrief",
  icon: <Trophy className="h-3.5 w-3.5" />,
};

function nextStageFrom(current: MedicalCaseStageName, paTriggered: boolean): MedicalCaseStageName {
  switch (current) {
    case "case-select":
      return "briefing";
    case "briefing":
      return "registration";
    case "registration":
      return "eligibility";
    case "eligibility":
      return "clinical";
    case "clinical":
      return "coding";
    case "coding":
      return paTriggered ? "prior-auth" : "claim";
    case "prior-auth":
      return "claim";
    case "claim":
      return "ar-follow-up";
    case "ar-follow-up":
      return "debrief";
    default:
      return "debrief";
  }
}

function prevStageFrom(current: MedicalCaseStageName, paTriggered: boolean): MedicalCaseStageName {
  switch (current) {
    case "briefing":
      return "case-select";
    case "registration":
      return "briefing";
    case "eligibility":
      return "registration";
    case "clinical":
      return "eligibility";
    case "coding":
      return "clinical";
    case "prior-auth":
      return "coding";
    case "claim":
      return paTriggered ? "prior-auth" : "coding";
    case "ar-follow-up":
      return "claim";
    case "debrief":
      return "ar-follow-up";
    default:
      return "case-select";
  }
}

export function MedicalCaseRunner() {
  const { state, activeCase, paTriggered, goTo } = useMedicalCase();

  const stages = useMemo(() => {
    const rcm = RCM_STAGES.filter((s) => !(s.id === "prior-auth" && !paTriggered));
    return [...FRAME_STAGES, ...rcm, DEBRIEF_STAGE];
  }, [paTriggered]);

  const stageIdx = stages.findIndex((s) => s.id === state.stage);

  return (
    <div className="flex h-full flex-col">
      {/* ── stage stepper ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2">
        {stages.map((s, i) => {
          const active = s.id === state.stage;
          const reached = i <= stageIdx;
          return (
            <button
              key={s.id}
              onClick={() => reached && goTo(s.id)}
              disabled={!reached}
              className={`flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                active ? "bg-blue-600 text-white" : reached ? "text-slate-600 hover:bg-slate-100" : "text-slate-300"
              }`}
            >
              {s.icon}
              {s.label}
            </button>
          );
        })}
        {activeCase && (
          <span className="ml-auto shrink-0 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
            {activeCase.id} · {activeCase.difficulty}
          </span>
        )}
      </div>

      {/* ── stage body ─────────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {state.stage === "case-select" && <CaseSelect />}
        {state.stage === "briefing" && <Briefing />}
        {state.stage === "registration" && <RegistrationStage />}
        {state.stage === "eligibility" && <EligibilityStage />}
        {state.stage === "clinical" && <ClinicalStage />}
        {state.stage === "coding" && <CodingStage />}
        {state.stage === "prior-auth" && <PriorAuthStage />}
        {state.stage === "claim" && <ClaimStage />}
        {state.stage === "ar-follow-up" && <ARStage />}
        {state.stage === "debrief" && <Debrief />}
      </div>
    </div>
  );
}

// ─── shared presentational ───────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      {children}
    </div>
  );
}

/** Back / Continue footer that derives navigation from the current stage. */
function StageNav({ nextLabel = "Continue", onNext, nextDisabled = false }: { nextLabel?: string; onNext?: () => void; nextDisabled?: boolean }) {
  const { state, paTriggered, goTo } = useMedicalCase();
  const back = prevStageFrom(state.stage, paTriggered);
  const next = nextStageFrom(state.stage, paTriggered);
  return (
    <div className="mt-4 flex items-center gap-2">
      <button
        onClick={() => goTo(back)}
        className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>
      <button
        onClick={() => (onNext ? onNext() : goTo(next))}
        disabled={nextDisabled}
        className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {nextLabel} <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function difficultyTone(d: MedicalCaseScenario["difficulty"]) {
  return d === "beginner"
    ? "bg-emerald-50 text-emerald-700"
    : d === "intermediate"
      ? "bg-amber-50 text-amber-700"
      : "bg-red-50 text-red-700";
}

// ─── case select ─────────────────────────────────────────────────────────────

function CaseSelect() {
  const { selectCase, resetTrack } = useMedicalCase();
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Medical RCM Cases</h3>
          <p className="text-[10px] text-slate-400">
            Seven graded cases across the clinical-to-financial spine. Make the mistake, feel the denial, then read why.
          </p>
        </div>
        <button
          onClick={resetTrack}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] text-slate-500 hover:bg-slate-50"
        >
          <RotateCcw className="h-3 w-3" /> Reset
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {MEDICAL_CASE_SCENARIOS.map((c) => (
          <CaseCard key={c.id} c={c} onBegin={() => selectCase(c.id)} />
        ))}
      </div>
    </div>
  );
}

function CaseCard({ c, onBegin }: { c: MedicalCaseScenario; onBegin: () => void }) {
  const plan = findPlan(c.planId);
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${difficultyTone(c.difficulty)}`}>{c.difficulty}</span>
        <span className="text-[10px] text-slate-400">~{c.estimatedMinutes} min</span>
      </div>
      <h4 className="mt-2 text-sm font-bold text-slate-800">{c.title}</h4>
      <p className="mt-1 flex-1 text-[11px] leading-relaxed text-slate-500">{c.briefing}</p>
      <div className="mt-2 text-[10px] text-slate-400">
        <span className="font-medium text-slate-500">{c.specialty}</span>
        {plan && <span> · {plan.name} (fictional payer)</span>}
      </div>
      <button
        onClick={onBegin}
        className="mt-3 flex items-center justify-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
      >
        Begin case <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── briefing ────────────────────────────────────────────────────────────────

function Briefing() {
  const { activeCase, plan, beginCase } = useMedicalCase();
  if (!activeCase) return null;
  const { patient, eligibilitySnapshot, clinicalNote, registrationNotes } = activeCase;
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">{activeCase.title}</h3>
        <span className="text-[10px] text-slate-400">{plan?.name} · {plan?.planType} (fictional payer)</span>
      </div>

      <p className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-relaxed text-blue-800">{activeCase.briefing}</p>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Section title="Patient & registration">
          <p className="text-[11px] text-slate-700">
            {patient.firstName} {patient.lastName} · age {patient.ageAtServiceDate} · {patient.gender}
          </p>
          <p className="text-[10px] text-slate-500">
            Subscriber: {patient.subscriberName} ({patient.relationshipToSubscriber}) · ID {patient.memberId}
          </p>
          <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[10px] text-slate-600">
            {registrationNotes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </Section>

        <Section title="Eligibility snapshot">
          <p className="text-[11px] font-medium text-slate-700">{eligibilitySnapshot.status}</p>
          <p className="text-[10px] text-slate-500">
            Remaining deductible: ${eligibilitySnapshot.remainingDeductibleUsd} · Prior auth required:{" "}
            {eligibilitySnapshot.priorAuthRequired ? "yes" : "no"}
            {eligibilitySnapshot.priorAuthStatus ? ` · ${eligibilitySnapshot.priorAuthStatus}` : ""}
          </p>
          {eligibilitySnapshot.benefitUsage && eligibilitySnapshot.benefitUsage.length > 0 && (
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[10px] text-slate-600">
              {eligibilitySnapshot.benefitUsage.map((b, i) => (
                <li key={i}>
                  {b.category}: {b.used}/{b.limit} used
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">Rep notes</p>
          <ul className="list-disc space-y-0.5 pl-4 text-[10px] text-slate-600">
            {eligibilitySnapshot.representativeNotes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </Section>

        <Section title="Clinical note">
          <p className="text-[11px] font-semibold text-slate-700">{clinicalNote.chiefComplaint}</p>
          <p className="mt-1 text-[10px] text-slate-600">
            <span className="font-semibold">Subjective: </span>
            {clinicalNote.subjective}
          </p>
          <p className="mt-1 text-[10px] text-slate-600">
            <span className="font-semibold">Objective: </span>
            {clinicalNote.objective}
          </p>
          <p className="mt-1 text-[10px] text-slate-600">
            <span className="font-semibold">Assessment: </span>
            {clinicalNote.assessment}
          </p>
          <p className="mt-1 text-[10px] text-slate-600">
            <span className="font-semibold">Plan: </span>
            {clinicalNote.plan}
          </p>
        </Section>

        <Section title="Plan rules to watch">
          <ul className="list-disc space-y-0.5 pl-4 text-[10px] text-slate-600">
            {plan && <li>{plan.notes}</li>}
            <li className="text-amber-700">Read the payer's prior-auth and claim-edit rules — the trap lives in the payer policy.</li>
          </ul>
        </Section>
      </div>

      <StageNav nextLabel="Start encounter" onNext={beginCase} />
    </div>
  );
}

// ─── registration ────────────────────────────────────────────────────────────

function RegistrationStage() {
  const { activeCase, state, setRegistration } = useMedicalCase();
  if (!activeCase) return null;
  const p = activeCase.patient;
  const r = state.registration;
  const nameMatch = r.lastNameEntered.trim().toLowerCase() === p.lastName.toLowerCase();
  const idMatch = r.memberIdEntered.trim() === p.memberId;

  return (
    <div className="h-full overflow-y-auto p-4">
      <h3 className="text-sm font-bold text-slate-800">Patient registration — front desk</h3>
      <p className="text-[10px] text-slate-400">Transcribe the details from the card and confirm they match the chart.</p>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Insurance card</p>
          <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-bold text-slate-800">{p.subscriberName}</p>
            <p className="text-[11px] text-slate-600">Member ID: {p.memberId}</p>
            <p className="text-[10px] text-slate-500">DOB: {p.dateOfBirth}</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Your transcription</p>
          <label className="mt-2 block text-[10px] text-slate-500">Patient last name</label>
          <input
            value={r.lastNameEntered}
            onChange={(e) => setRegistration({ lastNameEntered: e.target.value })}
            className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:border-blue-400 focus:outline-none"
            placeholder="Enter last name"
          />
          <label className="mt-2 block text-[10px] text-slate-500">Member ID</label>
          <input
            value={r.memberIdEntered}
            onChange={(e) => setRegistration({ memberIdEntered: e.target.value })}
            className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:border-blue-400 focus:outline-none"
            placeholder="Enter member ID"
          />
          <div className="mt-2 space-y-1">
            <p className={`text-[10px] ${r.lastNameEntered ? (nameMatch ? "text-emerald-600" : "text-red-600") : "text-slate-400"}`}>
              {r.lastNameEntered ? (nameMatch ? "✓ Name matches" : "✗ Name does not match") : "Name not entered"}
            </p>
            <p className={`text-[10px] ${r.memberIdEntered ? (idMatch ? "text-emerald-600" : "text-red-600") : "text-slate-400"}`}>
              {r.memberIdEntered ? (idMatch ? "✓ Member ID matches" : "✗ Member ID does not match") : "Member ID not entered"}
            </p>
          </div>
        </div>
      </div>

      <StageNav nextLabel="Verify eligibility" />
    </div>
  );
}

// ─── eligibility ─────────────────────────────────────────────────────────────

function EligibilityStage() {
  const { activeCase, plan, state, setEligibilityChecked } = useMedicalCase();
  if (!activeCase) return null;
  const e = activeCase.eligibilitySnapshot;
  const hasBenefitLimit = (e.benefitUsage?.length ?? 0) > 0 || (plan?.benefitLimits.length ?? 0) > 0;

  return (
    <div className="h-full overflow-y-auto p-4">
      <h3 className="text-sm font-bold text-slate-800">Eligibility & prior-authorisation check (270/271)</h3>
      <p className="text-[10px] text-slate-400">Confirm the patient's coverage and any service limits before the visit.</p>

      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-medium text-slate-700">{e.status}</p>
        <p className="mt-1 text-[11px] text-slate-500">
          Remaining deductible: ${e.remainingDeductibleUsd} · Prior auth required for this visit: {e.priorAuthRequired ? "yes" : "no"}
        </p>
        {e.benefitUsage && e.benefitUsage.length > 0 && (
          <div className="mt-2">
            {e.benefitUsage.map((b, i) => (
              <p key={i} className="text-[11px] text-slate-600">
                {b.category}: {b.used}/{b.limit} visits used this year
              </p>
            ))}
          </div>
        )}
        {hasBenefitLimit && (
          <label className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
            <input
              type="checkbox"
              checked={state.eligibilityChecked}
              onChange={(e) => setEligibilityChecked(e.target.checked)}
              className="h-3.5 w-3.5 accent-blue-600"
            />
            <span className="text-[11px] text-slate-700">
              I checked the remaining benefit allowance before this appointment.
            </span>
          </label>
        )}
        <p className="mt-2 text-[9px] font-semibold uppercase tracking-wide text-slate-400">Representative notes</p>
        <ul className="list-disc space-y-0.5 pl-4 text-[10px] text-slate-600">
          {e.representativeNotes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      </div>

      <StageNav nextLabel="Open chart" />
    </div>
  );
}

// ─── clinical (scribe) ───────────────────────────────────────────────────────

function ClinicalStage() {
  const { activeCase } = useMedicalCase();
  if (!activeCase) return null;
  const n = activeCase.clinicalNote;
  const rows: { label: string; value: string }[] = [
    { label: "Chief complaint", value: n.chiefComplaint },
    { label: "Subjective (HPI)", value: n.subjective },
    { label: "Objective / exam", value: n.objective },
    { label: "Assessment", value: n.assessment },
    { label: "Plan", value: n.plan },
  ];
  return (
    <div className="h-full overflow-y-auto p-4">
      <h3 className="text-sm font-bold text-slate-800">Chart — SOAP note</h3>
      <p className="text-[10px] text-slate-400">The provider has signed this note. Read it carefully — it drives the codes.</p>

      <div className="mt-3 space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{r.label}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-700">{r.value}</p>
          </div>
        ))}
      </div>

      <StageNav nextLabel="Go to coding" />
    </div>
  );
}

// ─── coding ──────────────────────────────────────────────────────────────────

function CodingStage() {
  const { activeCase, state, toggleDiagnosis, addProcedure, updateProcedure, removeProcedure } = useMedicalCase();
  if (!activeCase) return null;
  const [dxQuery, setDxQuery] = useState("");
  const [cptQuery, setCptQuery] = useState("");

  const dxResults = useMemo(() => {
    const q = dxQuery.trim().toLowerCase();
    const list = q
      ? ICD10_CODES.filter((c) => c.code.toLowerCase().includes(q) || c.description.toLowerCase().includes(q))
      : ICD10_CODES;
    return list.slice(0, 12);
  }, [dxQuery]);

  const cptResults = useMemo(() => {
    const q = cptQuery.trim().toLowerCase();
    const list = q
      ? CPT_CODES.filter((c) => c.code.toLowerCase().includes(q) || c.description.toLowerCase().includes(q))
      : CPT_CODES;
    return list.slice(0, 12);
  }, [cptQuery]);

  const selectedDiagnoses = activeCase.diagnoses.filter((d) => state.diagnoses.includes(d.code));

  return (
    <div className="h-full overflow-y-auto p-4">
      <h3 className="text-sm font-bold text-slate-800">Medical coding — diagnosis & procedure selection</h3>
      <p className="text-[10px] text-slate-400">
        Code the definitive diagnoses and the procedures performed. Watch for same-day E/M + procedure rules.
      </p>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {/* diagnoses */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Diagnoses (ICD-10)</p>
          <div className="mt-2 flex items-center gap-1 rounded-lg border border-slate-200 px-2">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <input
              value={dxQuery}
              onChange={(e) => setDxQuery(e.target.value)}
              placeholder="Search diagnoses…"
              className="w-full bg-transparent py-1.5 text-xs text-slate-700 focus:outline-none"
            />
          </div>
          <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
            {dxResults.map((c) => {
              const on = state.diagnoses.includes(c.code);
              return (
                <button
                  key={c.code}
                  onClick={() => toggleDiagnosis(c.code)}
                  className={`flex w-full items-start gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors ${
                    on ? "border-blue-300 bg-blue-50" : "border-slate-100 hover:bg-slate-50"
                  }`}
                >
                  <span className={`mt-0.5 text-[10px] font-bold ${on ? "text-blue-600" : "text-slate-400"}`}>{c.code}</span>
                  <span className="text-[11px] text-slate-600">{c.description}</span>
                  {on && <CheckCircle2 className="ml-auto h-3.5 w-3.5 shrink-0 text-blue-600" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* procedures */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Procedures (CPT)</p>
          <div className="mt-2 flex items-center gap-1 rounded-lg border border-slate-200 px-2">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <input
              value={cptQuery}
              onChange={(e) => setCptQuery(e.target.value)}
              placeholder="Search procedures…"
              className="w-full bg-transparent py-1.5 text-xs text-slate-700 focus:outline-none"
            />
          </div>
          <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
            {cptResults.map((c) => {
              const added = state.procedures.some((p) => p.code === c.code);
              return (
                <button
                  key={c.code}
                  onClick={() => addProcedure(c.code)}
                  disabled={added}
                  className={`flex w-full items-start gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors ${
                    added ? "border-blue-300 bg-blue-50 opacity-70" : "border-slate-100 hover:bg-slate-50"
                  }`}
                >
                  <span className={`mt-0.5 text-[10px] font-bold ${added ? "text-blue-600" : "text-slate-400"}`}>{c.code}</span>
                  <span className="text-[11px] text-slate-600">{c.description}</span>
                  {added && <CheckCircle2 className="ml-auto h-3.5 w-3.5 shrink-0 text-blue-600" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* selected claim lines */}
      {state.procedures.length > 0 && (
        <Section title="Your claim lines">
          <div className="space-y-2">
            {state.procedures.map((p: MedicalProcedureLine) => (
              <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2">
                <span className="text-[11px] font-bold text-slate-700">{p.code}</span>
                <span className="max-w-[200px] truncate text-[10px] text-slate-500">
                  {CPT_CODES.find((c) => c.code === p.code)?.description ?? ""}
                </span>
                <label className="ml-auto flex items-center gap-1 text-[10px] text-slate-500">
                  Modifier
                  <select
                    value={p.modifier ?? ""}
                    onChange={(e) => updateProcedure(p.id, { modifier: e.target.value || undefined })}
                    className="rounded border border-slate-200 px-1 py-0.5 text-[10px] text-slate-700"
                  >
                    <option value="">none</option>
                    <option value="25">25</option>
                    <option value="59">59</option>
                  </select>
                </label>
                <label className="flex items-center gap-1 text-[10px] text-slate-500">
                  Link dx
                  <select
                    value={p.linkedDiagnosisPointer ?? ""}
                    onChange={(e) => updateProcedure(p.id, { linkedDiagnosisPointer: e.target.value || undefined })}
                    className="rounded border border-slate-200 px-1 py-0.5 text-[10px] text-slate-700"
                  >
                    <option value="">—</option>
                    {selectedDiagnoses.map((d) => (
                      <option key={d.code} value={d.pointer}>
                        {d.pointer} · {d.code}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={() => removeProcedure(p.id)}
                  className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500"
                  title="Remove line"
                >
                  <XCircle className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <p className="mt-1 text-[9px] text-slate-400">
            Pointer letters map to your selected diagnoses ({selectedDiagnoses.map((d) => `${d.pointer}=${d.code}`).join(", ") || "none"}).
            A same-day E/M + procedure needs modifier 25 on the E/M line.
          </p>
        </Section>
      )}

      <StageNav nextLabel={state.procedures.length ? "Review prior auth / claim" : "Continue"} />
    </div>
  );
}

// ─── prior auth (conditional) ────────────────────────────────────────────────

function PriorAuthStage() {
  const { activeCase, plan, state, setPriorAuth } = useMedicalCase();
  if (!activeCase) return null;
  const required = plan?.priorAuthCptCodes ?? [];
  const pa = state.priorAuth;

  return (
    <div className="h-full overflow-y-auto p-4">
      <h3 className="text-sm font-bold text-slate-800">Prior authorisation</h3>
      <p className="text-[10px] text-slate-400">
        This plan requires prior authorisation for the selected service. Handle it before billing.
      </p>

      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
        <p className="text-xs font-medium text-amber-800">
          Prior authorisation required for CPT: <span className="font-bold">{required.join(", ")}</span>
        </p>
      </div>

      <div className="mt-3 space-y-2">
        <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
          <input
            type="checkbox"
            checked={pa.recognized}
            onChange={(e) => setPriorAuth({ recognized: e.target.checked })}
            className="h-3.5 w-3.5 accent-blue-600"
          />
          <span className="text-[11px] text-slate-700">I recognised this service as prior-auth required.</span>
        </label>

        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">What did you do?</p>
          {(
            [
              { v: "obtained", label: "Obtained the authorisation before billing" },
              { v: "skipped", label: "Skipped PA and routed straight to billing" },
              { v: "wrong-study", label: "Obtained authorisation for a different study/code" },
            ] as { v: MedicalPriorAuthChoice; label: string }[]
          ).map((o) => (
            <label key={o.v} className="mt-1 flex items-center gap-2">
              <input
                type="radio"
                name="pa-choice"
                checked={pa.choice === o.v}
                onChange={() => setPriorAuth({ choice: o.v })}
                className="accent-blue-600"
              />
              <span className="text-[11px] text-slate-700">{o.label}</span>
            </label>
          ))}
        </div>

        {pa.choice === "obtained" && (
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <label className="block text-[10px] text-slate-500">Authorisation number</label>
            <input
              value={pa.authNumber}
              onChange={(e) => setPriorAuth({ authNumber: e.target.value })}
              placeholder="e.g. AUTH-2027-1234"
              className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:border-blue-400 focus:outline-none"
            />
          </div>
        )}
      </div>

      <StageNav nextLabel="Prepare claim" />
    </div>
  );
}

// ─── claim ────────────────────────���─────��──��─────────────────────────────────

function claimVerdict(traps: MedicalCaseTrap[], triggeredIds: string[]): { status: "clean" | "denied"; carc?: string; reason?: string } {
  const denial = traps.find((t) => triggeredIds.includes(t.id) && t.producesDenialCarc);
  if (denial) return { status: "denied", carc: denial.producesDenialCarc, reason: denial.title };
  return { status: "clean" };
}

function ClaimStage() {
  const { activeCase, plan, state, submitClaim, traps, triggeredTrapIds, goTo } = useMedicalCase();
  if (!activeCase) return null;
  const p = activeCase.patient;
  const chargedFor = (code: string) => {
    const expected = activeCase.procedures.find((x) => x.code === code);
    if (expected) return expected.chargedUsd;
    return CPT_CODES.find((c) => c.code === code)?.commercialRate ?? 0;
  };
  const verdict = state.claimSubmitted ? claimVerdict(traps, triggeredTrapIds) : null;
  const dxMap = Object.fromEntries(activeCase.diagnoses.map((d) => [d.code, d.pointer]));

  return (
    <div className="h-full overflow-y-auto p-4">
      <h3 className="text-sm font-bold text-slate-800">Claim — CMS-1500</h3>
      <p className="text-[10px] text-slate-400">Review the claim lines and diagnosis pointers, then submit.</p>

      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-slate-800">
              {p.firstName} {p.lastName} · {p.dateOfBirth}
            </p>
            <p className="text-[10px] text-slate-500">
              Subscriber {p.subscriberName} · ID {p.memberId}
            </p>
          </div>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{plan?.name}</span>
        </div>

        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-100">
          <table className="w-full text-left text-[10px]">
            <thead className="bg-slate-50 text-slate-400">
              <tr>
                <th className="px-2 py-1">Dx</th>
                <th className="px-2 py-1">CPT</th>
                <th className="px-2 py-1">Mod</th>
                <th className="px-2 py-1">Link</th>
                <th className="px-2 py-1 text-right">Charge</th>
              </tr>
            </thead>
            <tbody>
              {state.diagnoses.map((code) => (
                <tr key={code} className="border-t border-slate-100">
                  <td className="px-2 py-1 font-semibold text-slate-600">{code}</td>
                  <td className="px-2 py-1 text-slate-400">—</td>
                  <td className="px-2 py-1 text-slate-400">—</td>
                  <td className="px-2 py-1 text-slate-400">{dxMap[code] ?? ""}</td>
                  <td className="px-2 py-1 text-right text-slate-400">—</td>
                </tr>
              ))}
              {state.procedures.map((line) => (
                <tr key={line.id} className="border-t border-slate-100">
                  <td className="px-2 py-1 text-slate-400">—</td>
                  <td className="px-2 py-1 font-semibold text-slate-700">{line.code}</td>
                  <td className="px-2 py-1 text-slate-600">{line.modifier ?? "—"}</td>
                  <td className="px-2 py-1 text-slate-600">{line.linkedDiagnosisPointer ?? "—"}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-slate-600">${chargedFor(line.code).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {state.procedures.length === 0 && (
          <p className="mt-2 text-[10px] text-slate-400">No claim lines yet — go back to coding and select the procedures.</p>
        )}
      </div>

      {verdict && (
        <div
          className={`mt-3 rounded-xl border p-3 ${
            verdict.status === "clean" ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
          }`}
        >
          <p className={`text-xs font-semibold ${verdict.status === "clean" ? "text-emerald-700" : "text-red-700"}`}>
            {verdict.status === "clean" ? "Claim scrubbed clean — paid on first pass." : `Claim denied — ${verdict.carc}`}
          </p>
          {verdict.reason && <p className="mt-0.5 text-[10px] text-slate-600">{verdict.reason}</p>}
        </div>
      )}

      {state.claimSubmitted ? (
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => goTo("ar-follow-up")}
            className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-600"
          >
            Work the claim <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <StageNav
          nextLabel="Submit claim"
          nextDisabled={state.procedures.length === 0}
          onNext={() => {
            submitClaim();
            goTo("ar-follow-up");
          }}
        />
      )}
    </div>
  );
}

// ─── AR follow-up ────────────────────────────────────────────────────────────

const AR_ACTIONS: { action: MedicalARAction; label: string; hint: string }[] = [
  { action: "resubmit-corrected", label: "Correct & resubmit", hint: "Fix the coding error and send a corrected claim." },
  { action: "appeal", label: "Appeal", hint: "Argue the service was medically necessary / payable." },
  { action: "write-off", label: "Write off", hint: "Post the denied line as a contractual write-off." },
  { action: "bill-patient", label: "Bill patient", hint: "Move the patient's responsibility to their balance." },
  { action: "retrospective-review", label: "Retrospective review", hint: "Request a retrospective authorisation review." },
  { action: "explain-and-move", label: "Explain & move balance", hint: "Explain the benefit limit and move the balance." },
];

function ARStage() {
  const { activeCase, traps, triggeredTrapIds, logARCall, goTo } = useMedicalCase();
  if (!activeCase) return null;
  const verdict = claimVerdict(traps, triggeredTrapIds);
  const [note, setNote] = useState("");

  const take = (action: MedicalARAction) => {
    logARCall(action, note.trim() || AR_ACTIONS.find((a) => a.action === action)?.label || action);
    goTo("debrief");
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      <h3 className="text-sm font-bold text-slate-800">AR follow-up</h3>
      <p className="text-[10px] text-slate-400">The remittance has posted. Decide the right next step for this claim.</p>

      <div
        className={`mt-3 rounded-xl border p-3 ${
          verdict.status === "clean" ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
        }`}
      >
        <p className={`text-xs font-semibold ${verdict.status === "clean" ? "text-emerald-700" : "text-red-700"}`}>
          {verdict.status === "clean" ? "Paid — no denial to work." : `Denied — ${verdict.carc}`}
        </p>
        {verdict.reason && <p className="mt-0.5 text-[10px] text-slate-600">{verdict.reason}</p>}
        {activeCase.arFollowUp && (
          <p className="mt-1 text-[10px] text-slate-600">
            <span className="font-semibold">Scenario: </span>
            {activeCase.arFollowUp.scenario}
          </p>
        )}
      </div>

      <Section title="Choose your next action">
        <div className="grid gap-2 md:grid-cols-2">
          {AR_ACTIONS.map((a) => (
            <button
              key={a.action}
              onClick={() => take(a.action)}
              className="rounded-lg border border-slate-200 bg-white p-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
            >
              <p className="text-xs font-semibold text-slate-700">{a.label}</p>
              <p className="mt-0.5 text-[10px] text-slate-500">{a.hint}</p>
            </button>
          ))}
        </div>
        <label className="mt-3 block text-[10px] text-slate-500">Note (optional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:border-blue-400 focus:outline-none"
          placeholder="What did you tell the payer / patient?"
        />
      </Section>

      <div className="mt-4">
        <button
          onClick={() => goTo("claim")}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to claim
        </button>
      </div>
    </div>
  );
}

// ─── debrief ─────────────────────────────────────────────────────────────────

function Debrief() {
  const { state, activeCase, scoreTally, goTo, resetTrack, traps, triggeredTrapIds } = useMedicalCase();
  if (!activeCase) return null;
  const triggered = new Set(triggeredTrapIds);
  const passed = scoreTally.earned >= scoreTally.passingPoints;

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* score header */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-lg font-bold text-blue-700">
          {scoreTally.earned}/{scoreTally.maxPoints}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-800">
            {passed ? "Case passed" : "Below passing"} — {activeCase.title}
          </h3>
          <p className="text-[11px] text-slate-500">
            {scoreTally.earned} of {scoreTally.maxPoints} points · passing is {scoreTally.passingPoints}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => goTo("case-select")}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Case list
          </button>
          <button onClick={resetTrack} className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600">
            Retake case
          </button>
        </div>
      </div>

      {/* rubric */}
      <Section title="Grading rubric">
        <div className="space-y-1">
          {scoreTally.criteria.map((c) => (
            <div key={c.key} className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-2 py-1.5">
              <span className="text-[11px] text-slate-700">{c.criterion}</span>
              <span className={`text-[11px] font-semibold ${c.earned > 0 ? "text-emerald-600" : "text-slate-300"}`}>
                {c.earned}/{c.points}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-1 text-[9px] text-slate-400">
          Judgment criteria left at 0/… are instructor-reviewed — they are not auto-scored.
        </p>
      </Section>

      {/* expected vs actual */}
      <Section title="Claim — expected vs your result">
        <div className="overflow-x-auto rounded-lg border border-slate-100">
          <table className="w-full text-left text-[10px]">
            <thead className="bg-slate-50 text-slate-400">
              <tr>
                <th className="px-2 py-1">Line</th>
                <th className="px-2 py-1">Expected</th>
                <th className="px-2 py-1 text-right">Plan pays</th>
                <th className="px-2 py-1 text-right">Patient owes</th>
                <th className="px-2 py-1">Denial</th>
              </tr>
            </thead>
            <tbody>
              {activeCase.expectedOutcome.map((o) => {
                const selected = state.procedures.find((p) => p.code === o.code);
                const matched = Boolean(selected) && (selected?.modifier ?? undefined) === o.modifier;
                return (
                  <tr key={o.line} className="border-t border-slate-100">
                    <td className="px-2 py-1 font-medium text-slate-600">{o.line}</td>
                    <td className="px-2 py-1 text-slate-700">
                      {o.code}
                      {o.modifier ? `-${o.modifier}` : ""}
                      {matched ? <span className="ml-1 text-emerald-600">✓ yours</span> : selected ? <span className="ml-1 text-amber-600">≠ yours</span> : <span className="ml-1 text-red-500">missing</span>}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums text-slate-400">${o.planPaysUsd}</td>
                    <td className="px-2 py-1 text-right tabular-nums text-slate-400">${o.patientOwesUsd}</td>
                    <td className="px-2 py-1">
                      <span className={o.carcCode ? "text-red-600" : "text-slate-300"}>{o.carcCode ?? "—"}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-[9px] text-slate-400">
          Expected totals: charged ${activeCase.expectedTotals.chargedUsd} · allowed ${activeCase.expectedTotals.allowedUsd} · plan
          pays ${activeCase.expectedTotals.planPaysUsd} · patient owes ${activeCase.expectedTotals.patientOwesUsd}.
        </p>
      </Section>

      {/* traps */}
      <Section title="Teaching traps">
        <div className="space-y-2">
          {traps.map((t) => {
            const hit = triggered.has(t.id);
            return (
              <div key={t.id} className={`rounded-lg border p-3 ${hit ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}>
                <div className="flex items-center gap-2">
                  {hit ? <XCircle className="h-4 w-4 shrink-0 text-red-500" /> : <ClipboardList className="h-4 w-4 shrink-0 text-slate-300" />}
                  <p className="text-[11px] font-semibold text-slate-800">{t.title}</p>
                  <span className="ml-auto rounded bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-500">{t.pointsAtStake} pts at stake</span>
                </div>
                <div className="mt-1.5 space-y-1 pl-6">
                  <p className="text-[10px] text-slate-600">
                    <span className="font-semibold text-red-600">Common mistake: </span>
                    {t.commonMistake}
                  </p>
                  <p className="text-[10px] text-slate-600">
                    <span className="font-semibold">Why it's wrong: </span>
                    {t.whyItIsWrong}
                  </p>
                  <p className="text-[10px] text-slate-600">
                    <span className="font-semibold text-emerald-600">Correct: </span>
                    {t.correctAction}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* AR call log */}
      {state.arCalls.length > 0 && (
        <Section title="AR call log">
          <div className="space-y-1">
            {state.arCalls.map((e) => (
              <div key={e.id} className="rounded-lg border border-slate-100 bg-white px-2 py-1.5">
                <p className="text-[10px] font-medium text-slate-700">{e.action}</p>
                <p className="text-[9px] text-slate-500">{e.note}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* instructor key */}
      <Section title="Instructor key">
        <ul className="list-disc space-y-0.5 pl-4 text-[10px] text-slate-600">
          {activeCase.instructorKey.map((k, i) => (
            <li key={i}>{k}</li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
