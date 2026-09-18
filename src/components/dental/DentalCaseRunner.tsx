/**
 * DentalCaseRunner.tsx — Dental RCM case runner shell
 *
 * Inspired by: the medical track's seven-stage encounter spine, applied to the
 * dental case data. Walks the student through:
 *   case-select → briefing → coding → claim → AR follow-up → debrief
 * The coding / claim / AR stages are the dedicated dental components; this file
 * owns the case-select, briefing and debrief frames plus the stage stepper.
 */

import { useMemo, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  FileText,
  Phone,
  RotateCcw,
  Stethoscope,
  Trophy,
} from "lucide-react";
import { DENTAL_CASE_SCENARIOS, findPlan, type DentalCaseScenario } from "../../data/dental";
import { useDentalTrack, type DentalStageName } from "./DentalTrackStore";
import { DentalCodingQueue } from "./DentalCodingQueue";
import { DentalBillingLedger } from "./DentalBillingLedger";
import { DentalAR } from "./DentalAR";
import { adjudicateDentalClaim } from "./adjudication";

const STAGES: { id: DentalStageName; label: string; icon: ReactNode }[] = [
  { id: "case-select", label: "Case", icon: <BookOpen className="h-3.5 w-3.5" /> },
  { id: "briefing", label: "Briefing", icon: <ClipboardList className="h-3.5 w-3.5" /> },
  { id: "coding", label: "Coding", icon: <Stethoscope className="h-3.5 w-3.5" /> },
  { id: "claim", label: "Claim", icon: <FileText className="h-3.5 w-3.5" /> },
  { id: "ar", label: "AR", icon: <Phone className="h-3.5 w-3.5" /> },
  { id: "debrief", label: "Debrief", icon: <Trophy className="h-3.5 w-3.5" /> },
];

export function DentalCaseRunner() {
  const { state, activeCase, goTo } = useDentalTrack();

  const stageIdx = STAGES.findIndex((s) => s.id === state.stage);

  return (
    <div className="flex h-full flex-col">
      {/* ── stage stepper ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b border-slate-200 bg-white px-3 py-2">
        {STAGES.map((s, i) => {
          const active = s.id === state.stage;
          const reached = i <= stageIdx;
          return (
            <button
              key={s.id}
              onClick={() => reached && goTo(s.id)}
              disabled={!reached}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                active ? "bg-sky-600 text-white" : reached ? "text-slate-600 hover:bg-slate-100" : "text-slate-300"
              }`}
            >
              {s.icon}
              {s.label}
            </button>
          );
        })}
        {activeCase && (
          <span className="ml-auto rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
            {activeCase.id} · {activeCase.difficulty}
          </span>
        )}
      </div>

      {/* ── stage body ────────────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {state.stage === "case-select" && <CaseSelect />}
        {state.stage === "briefing" && <Briefing />}
        {state.stage === "coding" && <DentalCodingQueue />}
        {state.stage === "claim" && <DentalBillingLedger />}
        {state.stage === "ar" && <DentalAR />}
        {state.stage === "debrief" && <Debrief />}
      </div>
    </div>
  );
}

// ─── case select ─────────────────────────────────────────────────────────────

function CaseSelect() {
  const { selectCase, resetTrack } = useDentalTrack();
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Dental RCM Cases</h3>
          <p className="text-[10px] text-slate-400">
            Pick a graded case. Each carries deliberate traps — make the mistake, feel the denial, then read why.
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
        {DENTAL_CASE_SCENARIOS.map((c) => (
          <CaseCard key={c.id} c={c} onBegin={() => selectCase(c.id)} />
        ))}
      </div>
    </div>
  );
}

function CaseCard({ c, onBegin }: { c: DentalCaseScenario; onBegin: () => void }) {
  const plan = findPlan(c.planId);
  const difficultyColor =
    c.difficulty === "beginner" ? "bg-emerald-50 text-emerald-700" : c.difficulty === "intermediate" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${difficultyColor}`}>{c.difficulty}</span>
        <span className="text-[10px] text-slate-400">~{c.estimatedMinutes} min</span>
      </div>
      <h4 className="mt-2 text-sm font-bold text-slate-800">{c.title}</h4>
      <p className="mt-1 flex-1 text-[11px] leading-relaxed text-slate-500">{c.briefing}</p>
      <div className="mt-2 text-[10px] text-slate-400">
        {plan && (
          <span>
            {plan.payerName} · {plan.planName}
          </span>
        )}
      </div>
      <button
        onClick={onBegin}
        className="mt-3 flex items-center justify-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500"
      >
        Begin case <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── briefing ────────────────────────────────────────────────────────────────

function Briefing() {
  const { activeCase, beginCase, goTo } = useDentalTrack();
  if (!activeCase) return null;
  const plan = findPlan(activeCase.planId);
  const { patient, eligibilitySnapshot, clinicalNote, registrationNotes } = activeCase;
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">{activeCase.title}</h3>
        <span className="text-[10px] text-slate-400">
          {plan?.payerName} · {plan?.planName} (fictional payer)
        </span>
      </div>

      <p className="rounded-xl border border-sky-100 bg-sky-50 p-3 text-xs leading-relaxed text-sky-800">{activeCase.briefing}</p>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Section title="Patient & registration">
          <p className="text-[11px] text-slate-700">
            {patient.firstName} {patient.lastName} · {patient.ageAtServiceDate} at service · {patient.gender}
          </p>
          <p className="text-[10px] text-slate-500">
            Subscriber: {patient.subscriberName} ({patient.relationshipToSubscriber}) · ID {patient.memberId}
          </p>
          <p className="text-[10px] text-slate-500">Coverage effective {patient.coverageEffectiveDate} · {patient.monthsCoveredAtServiceDate} months covered</p>
          {patient.secondaryCoverage && (
            <p className="text-[10px] text-slate-500">
              Secondary: {patient.secondaryCoverage.subscriberName} ({patient.secondaryCoverage.memberId})
            </p>
          )}
          <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[10px] text-slate-600">
            {registrationNotes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </Section>

        <Section title="Eligibility">
          <p className="text-[11px] font-medium text-slate-700">{eligibilitySnapshot.status}</p>
          <p className="text-[10px] text-slate-500">
            Remaining annual max: {eligibilitySnapshot.remainingAnnualMaximumUsd === null ? "uncapped" : `$${eligibilitySnapshot.remainingAnnualMaximumUsd}`} ·
            Deductible met: ${eligibilitySnapshot.deductibleMetUsd}
          </p>
          <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">Paid history (may include another practice)</p>
          <ul className="list-disc space-y-0.5 pl-4 text-[10px] text-slate-600">
            {eligibilitySnapshot.paidHistory.map((h, i) => (
              <li key={i}>
                {h.code} {h.tooth ? `#${h.tooth} ` : ""}
                {h.quadrant ? `q${h.quadrant} ` : ""}
                on {h.date} — {h.note}
              </li>
            ))}
            {eligibilitySnapshot.paidHistory.length === 0 && <li className="text-slate-400">No prior paid services on file.</li>}
          </ul>
          <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">Rep notes</p>
          <ul className="list-disc space-y-0.5 pl-4 text-[10px] text-slate-600">
            {eligibilitySnapshot.representativeNotes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </Section>

        <Section title="Clinical note">
          <p className="text-[11px] font-semibold text-slate-700">{clinicalNote.chiefComplaint}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[10px] text-slate-600">
            {clinicalNote.findings.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
          <p className="mt-1 text-[10px] text-slate-600">{clinicalNote.diagnosisNarrative}</p>
          <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">Treatment performed</p>
          <ul className="list-disc space-y-0.5 pl-4 text-[10px] text-slate-600">
            {clinicalNote.treatmentPerformed.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </Section>

        <Section title="Plan rules to watch">
          <ul className="list-disc space-y-0.5 pl-4 text-[10px] text-slate-600">
            {plan && <li>{plan.teachingSummary}</li>}
            <li className="text-amber-700">Read the paid history — the frequency clock follows the patient, not this practice.</li>
          </ul>
        </Section>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => goTo("case-select")}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <button
          onClick={beginCase}
          className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-600"
        >
          Start coding <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── debrief ─────────────────────────────────────────────────────────────────

function Debrief() {
  const { state, activeCase, scoreTally, goTo, resetTrack, traps } = useDentalTrack();
  if (!activeCase) return null;
  const adjudication = useMemo(() => adjudicateDentalClaim(state.lines, activeCase), [state.lines, activeCase]);
  const triggered = new Set(state.trapsTriggered);
  const passed = scoreTally.earned >= scoreTally.passingPoints;

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* score header */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-50 text-lg font-bold text-sky-700">
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
          <button
            onClick={resetTrack}
            className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600"
          >
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
                const actual = adjudication.lines.find((l) => l.code === o.code);
                return (
                  <tr key={o.line} className="border-t border-slate-100">
                    <td className="px-2 py-1 font-medium text-slate-600">{o.line}</td>
                    <td className="px-2 py-1 text-slate-700">{o.code}</td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      <span className="text-slate-400">${o.planPaysUsd}</span>
                      {actual && <span className="ml-1 text-emerald-600">→ ${actual.result.planPaysUsd.toFixed(2)}</span>}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      <span className="text-slate-400">${o.patientOwesUsd}</span>
                      {actual && <span className="ml-1 text-red-600">→ ${actual.result.patientOwesUsd.toFixed(2)}</span>}
                    </td>
                    <td className="px-2 py-1">
                      <span className={o.denialId ? "text-red-600" : "text-slate-300"}>{o.denialId ?? "—"}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-[9px] text-slate-400">
          Expected totals: charged ${activeCase.expectedTotals.chargedUsd} · allowed ${activeCase.expectedTotals.allowedUsd} · plan pays $
          {activeCase.expectedTotals.planPaysUsd} · patient owes ${activeCase.expectedTotals.patientOwesUsd}.
        </p>
      </Section>

      {/* traps */}
      <Section title="Teaching traps">
        <div className="space-y-2">
          {traps.map((t) => {
            const hit = triggered.has(t.id);
            return (
              <div
                key={t.id}
                className={`rounded-lg border p-3 ${hit ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}
              >
                <div className="flex items-center gap-2">
                  {hit ? <CheckCircle2 className="h-4 w-4 shrink-0 text-red-500" /> : <ClipboardList className="h-4 w-4 shrink-0 text-slate-300" />}
                  <p className="text-[11px] font-semibold text-slate-800">{t.title}</p>
                  <span className="ml-auto rounded bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-500">
                    {t.pointsAtStake} pts at stake
                  </span>
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

      {/* call log */}
      {state.arCallLog.length > 0 && (
        <Section title="AR call log">
          <div className="space-y-1">
            {state.arCallLog.map((e) => (
              <div key={e.id} className="rounded-lg border border-slate-100 bg-white px-2 py-1.5">
                <p className="text-[10px] font-medium text-slate-700">{e.objective}</p>
                <p className="text-[9px] text-slate-500">{e.note}</p>
              </div>
            ))}
          </div>
        </Section>
      )}
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
