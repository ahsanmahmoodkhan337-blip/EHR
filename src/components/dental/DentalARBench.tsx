/**
 * DentalARBench.tsx — the dental AR practice bench
 *
 * Inspired by: the training bench a billing school runs beside its production
 * system — a pool of ready-made denials a student can work on without first
 * coding and submitting a claim.
 *
 * Two views, one route: the picker (nine premade scenarios, facts only) and the
 * scenario itself, which renders the real `DentalAR` workspace against that
 * scenario's own record. Practice runs live in `state.practice` keyed by
 * scenario id, so nothing here can reach a graded case's lines, resolutions,
 * call log or rubric.
 *
 * STANDING-RULES 6: the picker shows the claim's facts and what the student
 * practises — never the resolution, the appealable flag or the answer key.
 */

import { useMemo } from "react";
import { ArrowLeft, ArrowRight, Phone, ShieldCheck } from "lucide-react";
import {
  DENTAL_AR_PRACTICE_SCENARIOS,
  findPracticeScenario,
  type DentalARPracticeScenario,
} from "../../data/dental";
import { adjudicatePracticeScenario } from "./adjudication";
import { useDentalTrack } from "./DentalTrackStore";
import { DentalAR } from "./DentalAR";

/**
 * `onBack` is where "Back to cases" goes when the bench is a page of its own
 * (`/practice-ar`). Inside the dental runner the button only closes the bench,
 * which is what the runner expects.
 */
export function DentalARBench({ onBack }: { onBack?: () => void } = {}) {
  const { state } = useDentalTrack();
  const scenario = findPracticeScenario(state.activePracticeId);
  return scenario ? (
    <ScenarioView scenario={scenario} onBack={onBack} />
  ) : (
    <ScenarioPicker onBack={onBack} />
  );
}

// ─── picker ──────────────────────────────────────────────────────────────────

function ScenarioPicker({ onBack }: { onBack?: () => void }) {
  const { openPractice, closePractice, practice } = useDentalTrack();
  const leave = () => {
    closePractice();
    onBack?.();
  };

  // The number of denied lines is read from the adjudicator, not typed in, so
  // the count on the card is the count the student will find inside.
  const deniedCounts = useMemo(
    () =>
      Object.fromEntries(
        DENTAL_AR_PRACTICE_SCENARIOS.map((s) => [s.id, adjudicatePracticeScenario(s).denied.length]),
      ) as Record<string, number>,
    [],
  );

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-teal-50 px-3 py-2 ring-1 ring-teal-100">
        <Phone className="h-4 w-4 shrink-0 text-teal-600" aria-hidden="true" />
        <span className="text-xs font-bold text-teal-700">Dental AR — Practice bench</span>
        <span className="ml-auto text-xs font-medium text-teal-600">No case needed</span>
      </div>

      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-800">Premade denials to work</h3>
          <p className="text-xs text-slate-500">
            Each scenario is a claim that has already been adjudicated. Open one, dial the payer, log the call and
            decide every denied line. Nothing here touches a graded case, and no case needs to be started first.
          </p>
        </div>
        <button
          onClick={leave}
          className="flex min-h-[40px] items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to cases
        </button>
      </div>

      <ul className="grid gap-3 md:grid-cols-2">
        {DENTAL_AR_PRACTICE_SCENARIOS.map((scenario) => {
          const run = practice[scenario.id];
          const decided = run ? Object.keys(run.decisions).length : 0;
          const denied = deniedCounts[scenario.id] ?? 0;
          return (
            <li key={scenario.id} className="flex flex-col clinical-card p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-500">{scenario.id}</span>
                <span className="text-xs text-slate-400">{scenario.claimNumber}</span>
                <span className="ml-auto rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700">
                  {denied} denied {denied === 1 ? "line" : "lines"}
                </span>
              </div>
              <h4 className="mt-1.5 text-xs font-bold text-slate-800">{scenario.title}</h4>
              <p className="mt-1 text-xs text-slate-500">
                {scenario.payerName} · DOS {scenario.dos}
              </p>
              <p className="mt-1 flex-1 text-xs text-slate-600">
                <span className="font-semibold text-slate-700">You will practise: </span>
                {scenario.whatYouWillPractise}
              </p>
              {decided > 0 && (
                <p className="mt-1 text-[11px] font-medium text-emerald-700">
                  {decided} of {denied} lines decided — your work is saved
                </p>
              )}
              <button
                onClick={() => openPractice(scenario.id)}
                aria-label={`Open practice scenario ${scenario.id}: ${scenario.title}`}
                className="mt-2 flex min-h-[40px] items-center justify-center gap-1 rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-500"
              >
                Open scenario <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>

      <SimulatedDataFooter />
    </div>
  );
}

// ─── one scenario ────────────────────────────────────────────────────────────

function ScenarioView({
  scenario,
  onBack,
}: {
  scenario: DentalARPracticeScenario;
  onBack?: () => void;
}) {
  const { openPractice, closePractice } = useDentalTrack();
  const leave = () => {
    closePractice();
    onBack?.();
  };
  const denied = useMemo(() => adjudicatePracticeScenario(scenario).denied.length, [scenario]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-slate-200 bg-white px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => openPractice(null)}
            className="flex min-h-[40px] items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> All scenarios
          </button>
          <div className="min-w-0">
            <h3 className="truncate text-xs font-bold text-slate-800">{scenario.title}</h3>
            <p className="text-xs text-slate-500">
              {scenario.payerName} · DOS {scenario.dos} · claim {scenario.claimNumber} · {denied} denied{" "}
              {denied === 1 ? "line" : "lines"}
            </p>
          </div>
          <button
            onClick={leave}
            className="ml-auto flex min-h-[40px] items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
          >
            Back to cases
          </button>
        </div>
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-teal-100 bg-teal-50 px-2 py-1.5">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-teal-900">
            <span className="font-semibold">Practice scenario — not a graded case. </span>
            {scenario.brief}
          </p>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <DentalAR />
      </div>
    </div>
  );
}

function SimulatedDataFooter() {
  return (
    <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-500">
      Simulated data: every patient, payer, claim number and fee on this bench is fictional and built for teaching.
      No real payer, provider or patient is represented.
    </p>
  );
}
