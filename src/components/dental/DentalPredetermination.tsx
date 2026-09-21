/**
 * DentalPredetermination.tsx — Predetermination & attachment-requirement stage
 *
 * Inspired by: the front-desk / biller step where, before the provider touches a
 * bur, the practice (a) gathers whatever the payer needs to adjudicate the
 * service and (b) sends a predetermination of benefits so the patient's
 * out-of-pocket number is in writing. It consumes the structured data layer
 * (PR #26) directly — `attachmentsForCode()` and `PREDETERMINATION_SCENARIOS` —
 * rather than the loose `CDTCode.commonAttachments` hint.
 *
 * Two halves:
 *   1. Required attachments per planned/claim line, with a "gathered" toggle
 *      and a red flag when anything is still missing before submission.
 *   2. The three predetermination scenarios, reachable in-context; the selected
 *      one renders its line-by-line estimate through PredeterminationEstimate
 *      (downgrade rendered as an adjustment, never a denial).
 */

import { useMemo } from "react";
import { ArrowLeft, ClipboardCheck, Info, Receipt } from "lucide-react";
import {
  PREDETERMINATION_CANDIDATE_INDEX,
  PREDETERMINATION_SCENARIOS,
  attachmentsForCode,
  findCDT,
  findPredeterminationScenario,
  isPredeterminationCandidate,
  predeterminationDriverFor,
  type AttachmentType,
  type PredeterminationDriver,
  type PredeterminationScenario,
} from "../../data/dental";
import { useDentalTrack } from "./DentalTrackStore";
import { PredeterminationEstimate } from "./PredeterminationEstimate";

const DRIVER_LABEL: Record<PredeterminationDriver, string> = {
  "high-fee": "High-fee",
  cosmetic: "Cosmetic",
  "removable-appliance": "Removable appliance",
  surgical: "Surgical",
  "frequency-sensitive": "Frequency-sensitive",
};

interface CheckableService {
  id: string;
  code: string;
  tooth?: string;
  attachments: string[];
  kind: "line" | "plan";
}

export function DentalPredetermination() {
  const { state, updateLine, updatePlanItem, requestPredetermination, goTo } = useDentalTrack();

  // Attach-checklist source: claim lines once they exist, otherwise the plan.
  const services: CheckableService[] = useMemo(() => {
    if (state.lines.length > 0) {
      return state.lines.map((l) => ({
        id: l.id,
        code: l.code,
        tooth: l.tooth,
        attachments: l.attachments ?? [],
        kind: "line" as const,
      }));
    }
    return state.txPlan.map((p) => ({
      id: p.id,
      code: p.code,
      tooth: p.tooth,
      attachments: p.attachments ?? [],
      kind: "plan" as const,
    }));
  }, [state.lines, state.txPlan]);

  const serviceCodes = useMemo(() => services.map((s) => s.code), [services]);

  const toggleAttachment = (svc: CheckableService, type: AttachmentType) => {
    const has = svc.attachments.includes(type);
    const next = has ? svc.attachments.filter((a) => a !== type) : [...svc.attachments, type];
    if (svc.kind === "line") updateLine(svc.id, { attachments: next });
    else updatePlanItem(svc.id, { attachments: next });
  };

  const selectedScenario = state.predeterminationScenarioId
    ? findPredeterminationScenario(state.predeterminationScenarioId)
    : undefined;

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* header */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
            <ClipboardCheck className="h-4 w-4 text-teal-600" /> Predetermination &amp; attachments
          </h3>
          <p className="text-[10px] text-slate-400">
            Gather the payer's required attachments and put the estimate in writing before treatment.
          </p>
        </div>
        <button
          onClick={() => goTo(state.lines.length > 0 ? "coding" : "planning")}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[10px] text-slate-600 hover:bg-slate-50"
        >
          <ArrowLeft className="h-3 w-3" /> Back
        </button>
      </div>

      {/* ── 1. Required attachments per line ─────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Required attachments {services.length > 0 ? `(${services.length} service${services.length === 1 ? "" : "s"})` : ""}
        </p>
        {services.length === 0 && (
          <p className="py-3 text-center text-[11px] text-slate-400">
            No planned services yet. Build a treatment plan (or add claim lines) first — the required attachments
            appear here per CDT code.
          </p>
        )}
        <div className="space-y-2">
          {services.map((svc) => {
            const reqs = attachmentsForCode(svc.code);
            const missing = reqs.filter((r) => !svc.attachments.includes(r.type));
            const cdt = findCDT(svc.code);
            const candidate = isPredeterminationCandidate(svc.code)
              ? PREDETERMINATION_CANDIDATE_INDEX[svc.code]
              : undefined;
            const driver = predeterminationDriverFor(svc.code);
            return (
              <div key={svc.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-800">
                    {svc.code} {cdt ? `· ${cdt.shortName}` : ""}
                  </span>
                  {svc.tooth && <span className="text-[10px] text-slate-500">#{svc.tooth}</span>}
                  {missing.length > 0 ? (
                    <span className="ml-auto rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-semibold text-red-700">
                      {missing.length} missing
                    </span>
                  ) : (
                    reqs.length > 0 && (
                      <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">
                        Complete
                      </span>
                    )
                  )}
                </div>

                {candidate && driver && (
                  <div className="mt-1.5 rounded-md bg-teal-50 px-2 py-1.5 ring-1 ring-teal-100">
                    <span className="rounded-full bg-teal-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-teal-700">
                      Predetermination candidate · {DRIVER_LABEL[driver]}
                    </span>
                    <p className="mt-1 text-[10px] leading-snug text-teal-800">{candidate.guidance}</p>
                  </div>
                )}

                {reqs.length === 0 && (
                  <p className="mt-1 text-[10px] text-slate-400">No payer-required attachments for this code.</p>
                )}

                <div className="mt-1.5 space-y-1">
                  {reqs.map((r) => {
                    const gathered = svc.attachments.includes(r.type);
                    return (
                      <label
                        key={`${svc.id}-${r.type}`}
                        className="flex cursor-pointer items-start gap-2 rounded-md bg-white px-2 py-1 ring-1 ring-slate-100"
                      >
                        <input
                          type="checkbox"
                          checked={gathered}
                          onChange={() => toggleAttachment(svc, r.type)}
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-blue-600"
                        />
                        <span className="min-w-0 text-[10px] leading-snug text-slate-600">
                          <span className="font-medium text-slate-700">{r.label}</span>
                          {r.when === "conditional" && (
                            <span className="ml-1 rounded bg-slate-100 px-1 py-0.5 text-[9px] text-slate-500">
                              conditional{r.condition ? `: ${r.condition}` : ""}
                            </span>
                          )}
                          <span className="block text-[9px] text-slate-400">{r.whyRequired}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 flex items-center gap-1 text-[9px] text-slate-400">
          <Info className="h-3 w-3 shrink-0" />
          A skipped attachment is the single most common "missing documentation" denial (DEN-DOC-MISSING). Gather it
          before submission.
        </p>
      </div>

      {/* ── 2. Predetermination scenarios ────────────────────────────── */}
      <div className="mt-3">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Predetermination scenarios
        </p>
        <div className="grid gap-2 md:grid-cols-3">
          {PREDETERMINATION_SCENARIOS.map((sc) => {
            const codes = [...new Set(sc.estimate.map((l) => l.code))];
            const matchesPlan = codes.some((c) => serviceCodes.includes(c));
            return (
              <ScenarioCard
                key={sc.id}
                scenario={sc}
                codes={codes}
                matchesPlan={matchesPlan}
                selected={selectedScenario?.id === sc.id}
                onRequest={() => requestPredetermination(sc.id)}
              />
            );
          })}
        </div>
      </div>

      {/* ── selected scenario detail ─────────────────────────────────── */}
      {selectedScenario && (
        <div className="mt-3 space-y-3">
          <div className="rounded-xl border border-teal-100 bg-teal-50 p-3">
            <p className="text-[11px] font-semibold text-teal-800">{selectedScenario.title}</p>
            <p className="mt-0.5 text-[10px] leading-snug text-teal-700">{selectedScenario.plannedTreatment}</p>
            <p className="mt-1.5 text-[10px] leading-snug text-teal-700">
              <span className="font-semibold">Why predetermine: </span>
              {selectedScenario.predeterminationRationale}
            </p>
          </div>

          <PredeterminationEstimate scenario={selectedScenario} />

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
              Trap: {selectedScenario.trap.title}
            </p>
            <p className="mt-1 text-[10px] leading-snug text-amber-800">
              <span className="font-semibold">Mistake: </span>
              {selectedScenario.trap.mistake}
            </p>
            <p className="mt-1 text-[10px] leading-snug text-amber-800">
              <span className="font-semibold">Consequence: </span>
              {selectedScenario.trap.consequence}
            </p>
            <p className="mt-1 text-[10px] leading-snug text-emerald-800">
              <span className="font-semibold">Correct action: </span>
              {selectedScenario.trap.correctAction}
            </p>
            <p className="mt-1.5 border-t border-amber-100 pt-1.5 text-[10px] leading-snug text-slate-700">
              <span className="font-semibold">Teaching point: </span>
              {selectedScenario.teachingPoint}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ScenarioCard({
  scenario,
  codes,
  matchesPlan,
  selected,
  onRequest,
}: {
  scenario: PredeterminationScenario;
  codes: string[];
  matchesPlan: boolean;
  selected: boolean;
  onRequest: () => void;
}) {
  return (
    <div
      className={`flex flex-col rounded-xl border p-3 shadow-sm ${
        selected ? "border-teal-300 bg-teal-50" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-bold text-slate-800">{scenario.id}</span>
        <span
          className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
            scenario.difficulty === "beginner"
              ? "bg-emerald-50 text-emerald-700"
              : scenario.difficulty === "intermediate"
                ? "bg-amber-50 text-amber-700"
                : "bg-red-50 text-red-700"
          }`}
        >
          {scenario.difficulty}
        </span>
        {matchesPlan && (
          <span className="ml-auto rounded-full bg-teal-100 px-1.5 py-0.5 text-[9px] font-semibold text-teal-700">
            matches your plan
          </span>
        )}
      </div>
      <p className="mt-1.5 flex-1 text-[11px] font-medium leading-snug text-slate-700">{scenario.title}</p>
      <p className="mt-1 text-[9px] text-slate-400">
        Verdicts: {[...new Set(scenario.estimate.map((l) => l.verdict))].join(", ")} · Codes: {codes.join(", ")}
      </p>
      <button
        onClick={onRequest}
        className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-500"
      >
        <Receipt className="h-3.5 w-3.5" /> Request predetermination
      </button>
    </div>
  );
}
