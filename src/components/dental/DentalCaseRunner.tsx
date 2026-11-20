/**
 * DentalCaseRunner.tsx — Dental RCM case runner shell
 *
 * Inspired by: the medical track's seven-stage encounter spine, applied to the
 * dental case data. Walks the student through:
 *   case-select → briefing → coding → claim → AR follow-up → debrief
 * The coding / claim / AR stages are the dedicated dental components; this file
 * owns the case-select, briefing and debrief frames plus the stage stepper.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileText,
  ListChecks,
  Phone,
  RotateCcw,
  Smile,
  Stethoscope,
  Trophy,
} from "lucide-react";
import { DENTAL_CASE_SCENARIOS, findPlan, type DentalCaseScenario } from "../../data/dental";
import { EncounterStepper, type EncounterStep } from "../shell/EncounterStepper";
import {
  DENTAL_STAGE_TO_MODEL,
  modelStagesFor,
  rcmLabel,
  type RcmStageId,
} from "../shell/stageModel";
import { StageReviewFrame } from "../shell/StageReviewFrame";
import { useStageShortcuts } from "../shell/useStageShortcuts";
import { adjacentStage, isReviewingStage, isStageUnlocked } from "../shell/stageReview";
import { DENTAL_STAGE_ORDER, useDentalTrack, type DentalStageName } from "./DentalTrackStore";
import { DentalCodingQueue } from "./DentalCodingQueue";
import { DentalBillingLedger } from "./DentalBillingLedger";
import { DentalAR } from "./DentalAR";
import { DentalTreatmentPlan } from "./DentalTreatmentPlan";
import { DentalPatientLedger } from "./DentalPatientLedger";
import { DentalClaimQueue } from "./DentalClaimQueue";
import { DentalPredetermination } from "./DentalPredetermination";
import { DentalARBench } from "./DentalARBench";
import { adjudicateDentalClaim } from "./adjudication";

const FRAME_STAGES: EncounterStep[] = [
  { id: "case-select", label: "Case", icon: <BookOpen className="h-3.5 w-3.5" /> },
  { id: "briefing", label: "Briefing", icon: <ClipboardList className="h-3.5 w-3.5" /> },
];

/** The icon each model stage wears in this track's stepper. */
const MODEL_ICON: Record<RcmStageId, ReactNode> = {
  "front-desk": <ClipboardList className="h-3.5 w-3.5" />,
  chart: <CalendarClock className="h-3.5 w-3.5" />,
  coding: <Stethoscope className="h-3.5 w-3.5" />,
  "prior-auth": <ClipboardCheck className="h-3.5 w-3.5" />,
  claim: <FileText className="h-3.5 w-3.5" />,
  remittance: <ListChecks className="h-3.5 w-3.5" />,
  ar: <Phone className="h-3.5 w-3.5" />,
  debrief: <Trophy className="h-3.5 w-3.5" />,
};

const DEBRIEF_STEP: EncounterStep = {
  id: "debrief",
  label: rcmLabel("debrief"),
  role: "Case debrief",
  icon: <Trophy className="h-3.5 w-3.5" />,
};

/** The model step an internal stage belongs to; a frame keeps its own id. */
function stepOf(stage: DentalStageName): string {
  return DENTAL_STAGE_TO_MODEL[stage] ?? stage;
}

/** Which internal screen a stepper step opens. */
function opensFor(stepId: string): DentalStageName {
  const internal = Object.keys(DENTAL_STAGE_TO_MODEL).find(
    (id) => DENTAL_STAGE_TO_MODEL[id] === stepId,
  );
  return (internal ?? stepId) as DentalStageName;
}

/** Stage label by id, for the URL and the locked-stage notice. */
export const DENTAL_STAGE_LABEL: Record<DentalStageName, string> = {
  "case-select": "Case",
  briefing: "Briefing",
  planning: rcmLabel("chart"),
  predetermination: rcmLabel("prior-auth"),
  coding: rcmLabel("coding"),
  claim: rcmLabel("claim"),
  remittance: rcmLabel("remittance"),
  ar: rcmLabel("ar"),
  debrief: rcmLabel("debrief"),
};

/**
 * The Claim stage. The owner's mapping puts the claim and its submission status
 * in one stage (`phase-1-navigation-addendum.md` item 3): the ADA claim form and
 * its totals, then the claim status queue with the 835 and the ERA. They are two
 * sections of one stage, not two steps, and nothing either screen showed before
 * is dropped.
 */
function ClaimStage() {
  return (
    <div className="h-full overflow-y-auto">
      <section aria-labelledby="dental-claim-form">
        <h3
          id="dental-claim-form"
          className="sticky top-0 z-10 border-b border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500"
        >
          The claim — ADA 2019 (J430)
        </h3>
        <DentalBillingLedger embedded />
      </section>
      <section aria-labelledby="dental-claim-status" className="border-t-4 border-slate-100">
        <h3
          id="dental-claim-status"
          className="border-b border-slate-200 bg-white px-4 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500"
        >
          Submission status, the 835 and the ERA
        </h3>
        <DentalClaimQueue embedded />
      </section>
    </div>
  );
}

export function DentalCaseRunner() {
  const { state, activeCase, goTo } = useDentalTrack();
  const navigate = useNavigate();

  // The same eight-stage model the medical track shows, under the same names.
  // Every step here is one of the model's stages: the claim status queue is a
  // section of Claim and the patient ledger is Remittance, so the stepper has no
  // step of its own outside the model.
  const stages = useMemo<EncounterStep[]>(() => {
    const model = modelStagesFor(DENTAL_STAGE_TO_MODEL).filter((s) => s.id !== "debrief");
    return [
      ...FRAME_STAGES,
      ...model.map((stage) => ({
        id: stage.id,
        label: stage.label,
        role: stage.role,
        icon: MODEL_ICON[stage.id],
      })),
      DEBRIEF_STEP,
    ];
  }, []);

  const stageIds = useMemo(() => DENTAL_STAGE_ORDER as string[], []);

  const labelOf = (id: string) => DENTAL_STAGE_LABEL[id as DentalStageName] ?? id;

  // Item 11: a finished stage opens for reading, not editing. The case picker is
  // exempt so a student can always start a different case.
  const [reopenedStage, setReopenedStage] = useState<string | null>(null);
  useEffect(() => {
    setReopenedStage(null);
  }, [state.stage]);
  const reviewing =
    reopenedStage !== state.stage &&
    isReviewingStage({
      stageIds,
      currentId: state.stage,
      furthestId: state.furthestStage,
      exemptIds: ["case-select"],
    });

  // Item 8: the same Alt+→ / Alt+← spine keys as the medical runner.
  const { announcement, announce } = useStageShortcuts({
    onNext: () => {
      const next = adjacentStage(stageIds, state.stage, "next");
      if (!next) {
        announce("You are on the last stage of this case.");
        return;
      }
      if (!isStageUnlocked(stageIds, next, state.furthestStage)) {
        announce(`${labelOf(next)} is locked until you reach it. Use the stage button on your current stage.`);
        return;
      }
      goTo(next as DentalStageName);
      announce(`Moved to ${labelOf(next)}.`);
    },
    onPrevious: () => {
      const previous = adjacentStage(stageIds, state.stage, "previous");
      if (!previous) {
        announce("You are on the first stage of this case.");
        return;
      }
      goTo(previous as DentalStageName);
      announce(`Moved to ${labelOf(previous)}.`);
    },
  });

  const stageBody = (
    <>
      {state.stage === "case-select" && <CaseSelect />}
      {state.stage === "briefing" && <Briefing />}
      {state.stage === "planning" && <DentalTreatmentPlan />}
      {state.stage === "predetermination" && <DentalPredetermination />}
      {state.stage === "coding" && <DentalCodingQueue />}
      {state.stage === "claim" && <ClaimStage />}
      {state.stage === "remittance" && <DentalPatientLedger />}
      {state.stage === "ar" && <DentalAR />}
      {state.stage === "debrief" && <Debrief />}
    </>
  );

  // The AR practice bench is not a case stage, so it replaces the whole case
  // frame (stepper included) rather than opening inside it.
  if (state.practiceBenchOpen) {
    return <DentalARBench />;
  }

  return (
    <div className="flex h-full flex-col">
      {/* ── stage stepper (the one shared encounter stepper) ──────────────── */}
      <EncounterStepper
        steps={stages}
        currentId={stepOf(state.stage)}
        furthestId={stepOf(state.furthestStage)}
        onSelect={(id) => {
          // The Case step is the case list, not a stage of this encounter.
          if (id === "case-select") {
            void navigate({ to: "/cases" });
            return;
          }
          goTo(opensFor(id));
        }}
        accent="teal"
        label="Dental case stages"
        meta={
          activeCase ? (
            <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
              {activeCase.id} · {activeCase.difficulty}
            </span>
          ) : undefined
        }
      />

      {/* What the keyboard shortcuts just did, spoken by a screen reader. */}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {/* ── stage body ────────────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {reviewing ? (
          <StageReviewFrame
            stageLabel={labelOf(state.stage)}
            currentLabel={labelOf(state.furthestStage)}
            accent="teal"
            onBackToCurrent={() => goTo(state.furthestStage)}
            onReopen={() => setReopenedStage(state.stage)}
          >
            {stageBody}
          </StageReviewFrame>
        ) : (
          stageBody
        )}
      </div>
    </div>
  );
}

// ─── case select ─────────────────────────────────────────────────────────────

function CaseSelect() {
  const { selectCase, resetTrack, openPractice } = useDentalTrack();
  return (
    <div className="h-full overflow-y-auto p-4">
      {/* Track identity banner — makes it unambiguous which RCM track this is. */}
      <div className="mb-3 flex items-center gap-2 rounded-lg bg-teal-50 px-3 py-2 ring-1 ring-teal-100">
        <Smile className="h-4 w-4 shrink-0 text-teal-600" />
        <span className="text-xs font-bold uppercase tracking-wide text-teal-700">Dental RCM Track</span>
        <span className="ml-auto text-[10px] font-medium text-teal-600">CDT · ADA J430D</span>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Dental RCM Cases</h3>
          <p className="text-[10px] text-slate-400">
            Pick a graded case. Each carries deliberate traps — make the mistake, feel the denial, then read why.
          </p>
        </div>
        <button
          onClick={resetTrack}
          className="flex min-h-[40px] items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-[10px] text-slate-500 hover:bg-slate-50"
        >
          <RotateCcw className="h-3 w-3" aria-hidden="true" /> Reset
        </button>
      </div>

      {/* Two equally weighted ways in: a graded case, or the AR bench. */}
      <div className="mb-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-700">Graded cases</p>
          <p className="mt-1 text-[11px] text-slate-600">
            Work a patient from treatment plan to claim and AR. Scored against the case rubric.
          </p>
          <p className="mt-1 text-[10px] text-slate-500">{DENTAL_CASE_SCENARIOS.length} cases below.</p>
        </div>
        <div className="rounded-xl border border-teal-200 bg-white p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-700">Practice AR</p>
          <p className="mt-1 text-[11px] text-slate-600">
            Premade denials, already adjudicated. Jump straight into the AR workspace and work them — no case to
            start, no coding first, and nothing a graded case can see.
          </p>
          <button
            onClick={() => openPractice(null)}
            className="mt-2 flex min-h-[40px] items-center justify-center gap-1 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-600"
          >
            Practice AR <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
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
        className="mt-3 flex items-center justify-center gap-1 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-500"
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

      <p className="rounded-xl border border-teal-100 bg-teal-50 p-3 text-xs leading-relaxed text-teal-800">{activeCase.briefing}</p>

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
          className="flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-teal-600"
        >
          Start treatment plan <ArrowRight className="h-3.5 w-3.5" />
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
  // TASK 0 item 9: the pass mark is judged on the points the app can actually
  // score. Instructor-reviewed rows are reported, not counted against the
  // student, so doing everything available can pass.
  const passed = scoreTally.autoMaxPoints > 0 && scoreTally.autoEarned >= scoreTally.autoPassingPoints;

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* score header */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 text-center text-sm font-bold leading-tight text-teal-700">
          {scoreTally.autoEarned}/{scoreTally.autoMaxPoints}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-800">
            {passed ? "Case passed" : "Below passing"} — {activeCase.title}
          </h3>
          <p className="text-[11px] text-slate-500">
            Auto-scored {scoreTally.autoEarned} of {scoreTally.autoMaxPoints} points · passing is{" "}
            {scoreTally.autoPassingPoints} · {scoreTally.pendingReviewPoints} points pending instructor review.
          </p>
          <p className="text-[10px] text-slate-400">
            Rubric total {scoreTally.maxPoints} points ({scoreTally.earned} earned so far), of which{" "}
            {scoreTally.pendingReviewPoints} sit on criteria only an instructor can mark.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/cases"
            className="flex min-h-10 items-center rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Case list
          </Link>
          <button
            onClick={resetTrack}
            className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-600"
          >
            Retake case
          </button>
        </div>
      </div>

      {/* rubric */}
      <Section title="Grading rubric">
        <div className="space-y-1">
          {scoreTally.criteria.map((c) => (
            <div key={c.key} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-white px-2 py-1.5">
              <span className="text-[11px] text-slate-700">
                {c.criterion}
                {!c.autoScored && (
                  <span className="ml-1.5 rounded bg-amber-50 px-1 py-0.5 text-[9px] font-semibold text-amber-700">
                    instructor review
                  </span>
                )}
              </span>
              <span
                className={`shrink-0 text-[11px] font-semibold ${
                  !c.autoScored ? "text-amber-600" : c.earned > 0 ? "text-emerald-600" : "text-slate-300"
                }`}
              >
                {c.autoScored ? `${c.earned}/${c.points}` : `pending/${c.points}`}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-1 text-[9px] text-slate-400">
          Rows marked "instructor review" are steps this screen gives you no scored action for yet. They are not
          counted against the pass mark; the score above is what the app can actually check.
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
