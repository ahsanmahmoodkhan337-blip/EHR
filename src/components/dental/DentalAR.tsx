/**
 * DentalAR.tsx — Dental AR Voice / follow-up workspace
 *
 * Inspired by: medical AR follow-up call workflows (the phone-widget pattern
 * used across this app) applied to dental denial categories and the ADA/COB
 * structure. Reimplements the widget locally — by owner direction the dental
 * tree must not import medical stage components.
 *
 * Guardrails (spec §3 + appendix):
 *  - the call objective is `AR_CALL_GUIDANCE[denial.expectedOutcome]`, and for
 *    cases the case-specific `callObjectives[]`;
 *  - "appeal" is only ever available where `denial.appealable === true`;
 *  - a downgrade is never listed here as a denial (it is a covered reduction);
 *  - resolution options are gated by `expectedOutcome`.
 */

import { useMemo, useState } from "react";
import { Phone, PhoneOff, AlertTriangle, CheckCircle2 } from "lucide-react";
import { findCDT, AR_CALL_GUIDANCE, type DentalDenial, type DenialOutcome } from "../../data/dental";
import { adjudicateDentalClaim } from "./adjudication";
import { useDentalTrack, type DentalLineResolution } from "./DentalTrackStore";

const RESOLUTION_LABELS: Record<DentalLineResolution, string> = {
  "not-handled": "Not handled",
  appealed: "Appealed",
  resubmitted: "Resubmitted",
  "billed-patient": "Billed patient",
  "write-off": "Written off",
  closed: "Closed",
};

/** The single correct next action per denial outcome. */
const PRIMARY_ACTION: Record<DenialOutcome, { res: DentalLineResolution; label: string }> = {
  "appeal-with-documentation": { res: "appealed", label: "Prepare appeal" },
  "correct-and-resubmit": { res: "resubmitted", label: "Correct & resubmit" },
  "bill-patient": { res: "billed-patient", label: "Bill patient" },
  "write-off-contractual": { res: "write-off", label: "Write off (contractual)" },
  "no-recourse-educate-patient": { res: "closed", label: "Close — educate patient" },
};

export function DentalAR() {
  const {
    state,
    activeCase,
    logCall,
    resolveLine,
    triggerTrap,
    traps,
    goTo,
  } = useDentalTrack();
  const [callState, setCallState] = useState<"idle" | "dialing" | "connected">("idle");
  const [callNote, setCallNote] = useState("");
  const [callTarget, setCallTarget] = useState<string | null>(null);
  const [showAppealWarning, setShowAppealWarning] = useState<string | null>(null);

  const adjudication = useMemo(
    () => adjudicateDentalClaim(state.lines, activeCase),
    [state.lines, activeCase],
  );

  // Denied lines only. Downgrades are covered (reduced), never listed here.
  const deniedLines = useMemo(
    () =>
      adjudication.lines
        .filter((l) => l.denial)
        .map((l) => ({
          lineId: l.lineId,
          code: l.code,
          denial: l.denial as DentalDenial,
          patientOwesUsd: l.result.patientOwesUsd,
          resolution: state.lineResolutions[l.lineId] ?? ("not-handled" as DentalLineResolution),
        })),
    [adjudication, state.lineResolutions],
  );

  const arTrapForDenial = (denial: DentalDenial) =>
    traps.find((t) => t.stage === "ar-follow-up" && t.producesDenialId === denial.id && !denial.appealable);

  const objectiveFor = (denial: DentalDenial) => ({
    guidance: AR_CALL_GUIDANCE[denial.expectedOutcome],
    caseSpecific: activeCase?.arFollowUp?.callObjectives ?? [],
  });

  const dial = (lineId: string) => {
    setCallTarget(lineId);
    setCallNote("");
    setCallState("dialing");
    setTimeout(() => setCallState("connected"), 900);
  };

  const endCall = () => {
    const target = deniedLines.find((x) => x.lineId === callTarget);
    if (target && callNote.trim()) {
      logCall(objectiveFor(target.denial).guidance, callNote.trim());
    }
    setCallState("idle");
    setCallTarget(null);
  };

  const tryAppeal = (denial: DentalDenial) => {
    const trap = arTrapForDenial(denial);
    if (trap) triggerTrap(trap.id);
    setShowAppealWarning(denial.id);
  };

  const allResolved = deniedLines.every((l) => l.resolution !== "not-handled");

  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Dental AR Follow-up</h3>
          <p className="text-[10px] text-slate-400">
            {activeCase ? activeCase.arFollowUp?.scenario ?? "Work the denied lines below." : "Work the denied lines below."}
          </p>
        </div>
        <button
          onClick={() => goTo("ledger")}
          disabled={!allResolved}
          className="rounded-lg bg-blue-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {allResolved ? "Post to ledger →" : "Resolve all lines to finish"}
        </button>
      </div>

      {deniedLines.length === 0 && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-7 w-7 text-emerald-500" />
          <p className="text-xs font-medium text-emerald-800">No denied lines on this claim.</p>
          <p className="mt-1 text-[10px] text-emerald-600">
            The claim paid, or every line was covered. {activeCase ? "Still call to confirm payment posted." : ""}
          </p>
        </div>
      )}

      <div className="mt-3 space-y-3">
        {deniedLines.map(({ lineId, code, denial, patientOwesUsd, resolution }) => {
          const codeInfo = findCDT(code);
          const objective = objectiveFor(denial);
          const isTarget = callTarget === lineId;
          const trap = arTrapForDenial(denial);
          const primary = PRIMARY_ACTION[denial.expectedOutcome];
          const canAppeal = denial.appealable;

          return (
            <div key={lineId} className="rounded-xl border border-slate-200 bg-white shadow-sm">
              {/* denial summary row */}
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">{code}</code>
                <span className="text-[11px] font-medium text-slate-700">{codeInfo?.shortName ?? "Unknown"}</span>
                <span className="rounded bg-red-50 px-1.5 py-0.5 text-[9px] font-semibold text-red-700 ring-1 ring-red-100">
                  {denial.id}
                </span>
                <span className="ml-auto text-[11px] font-bold text-red-600">{fmtUsd(patientOwesUsd)} patient balance</span>
              </div>

              {/* denial body */}
              <div className="space-y-1.5 px-3 py-2">
                <p className="text-[11px] font-semibold text-red-800">
                  {denial.title}
                  <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
                    CARC {denial.carc} · Group {denial.groupCode}
                  </span>
                </p>
                <p className="text-[10px] text-slate-600">{denial.plainLanguage}</p>
                <p className="rounded border border-slate-100 bg-slate-50 px-2 py-1 font-mono text-[9px] italic text-slate-500">
                  “{denial.payerRemark}”
                </p>
                <div className="flex flex-wrap gap-1">
                  <Badge k="Group code" v={groupCodeLabel(denial.groupCode)} tone={denial.groupCode === "PR" ? "red" : "slate"} />
                  <Badge k="Outcome" v={denial.expectedOutcome.replace(/-/g, " ")} />
                  <Badge k="Appealable" v={denial.appealable ? "yes" : "no"} tone={denial.appealable ? "green" : "red"} />
                  <Badge k="Preventable" v={denial.preventable ? "yes" : "no"} tone={denial.preventable ? "amber" : "slate"} />
                </div>
                <p className="text-[10px] text-slate-500">
                  <span className="font-semibold text-slate-600">Prevention: </span>
                  {denial.prevention}
                </p>
                <p className="rounded bg-blue-50 px-2 py-1 text-[9px] italic text-blue-700">Debrief: {denial.teachingPoint}</p>
              </div>

              {/* resolution area */}
              {resolution === "not-handled" ? (
                <div className="border-t border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => dial(lineId)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold ${
                        isTarget && callState !== "idle"
                          ? "bg-red-600 text-white"
                          : "bg-blue-700 text-white hover:bg-blue-600"
                      }`}
                    >
                      {isTarget && callState !== "idle" ? <PhoneOff className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
                      {isTarget ? (callState === "dialing" ? "Calling…" : "End call") : "Call payer"}
                    </button>

                    <button
                      onClick={() => resolveLine(lineId, primary.res)}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-500"
                    >
                      {primary.label}
                    </button>

                    {canAppeal && primary.res !== "appealed" && (
                      <button
                        onClick={() => resolveLine(lineId, "appealed")}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:border-blue-200 hover:text-blue-700"
                      >
                        Appeal with documentation
                      </button>
                    )}

                    {!canAppeal && (
                      <button
                        onClick={() => tryAppeal(denial)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-500 hover:border-red-200 hover:text-red-600"
                      >
                        Why can't I appeal?
                      </button>
                    )}
                  </div>

                  {isTarget && callState === "connected" && (
                    <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 p-2">
                      <p className="text-[10px] font-semibold text-blue-800">Call objective — what this call must accomplish</p>
                      <p className="text-[10px] text-blue-700">{objective.guidance}</p>
                      {objective.caseSpecific.length > 0 && (
                        <div className="mt-1">
                          <p className="text-[9px] font-semibold uppercase tracking-wide text-blue-400">Case call script</p>
                          <ol className="ml-4 list-decimal text-[10px] text-blue-700">
                            {objective.caseSpecific.map((o, i) => (
                              <li key={i}>{o}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                      <div className="mt-1.5 flex items-center gap-2">
                        <input
                          value={callNote}
                          onChange={(e) => setCallNote(e.target.value)}
                          placeholder="Log what was confirmed on the call…"
                          className="flex-1 rounded-lg border border-blue-200 bg-white px-2 py-1 text-[10px] outline-none focus:border-blue-400"
                        />
                        <button
                          onClick={endCall}
                          disabled={!callNote.trim()}
                          className="rounded-lg bg-blue-700 px-3 py-1 text-[10px] font-semibold text-white hover:bg-blue-600 disabled:bg-slate-300"
                        >
                          Log call
                        </button>
                      </div>
                    </div>
                  )}

                  {showAppealWarning === denial.id && (
                    <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] text-amber-800">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>
                        This denial is <b>not appealable</b> — {denial.plainLanguage}
                        {trap ? ` ${trap.whyItIsWrong} Correct: ${trap.correctAction}` : ""}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 border-t border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-800">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Resolved: {RESOLUTION_LABELS[resolution]}.
                </div>
              )}
            </div>
          );
        })}
      </div>

      {deniedLines.length > 0 && <p className="mt-3 text-[9px] text-slate-400">Fictional payer data. All figures illustrative.</p>}
    </div>
  );
}

function groupCodeLabel(groupCode: string): string {
  if (groupCode === "CO") return "CO — contractual, not billable to patient";
  if (groupCode === "PR") return "PR — patient responsibility";
  return `${groupCode} — check the remittance`;
}

function Badge({ k, v, tone }: { k: string; v: string; tone?: "red" | "green" | "amber" | "slate" }) {
  const map = {
    red: "bg-red-50 text-red-700 ring-red-100",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    slate: "bg-slate-100 text-slate-600 ring-slate-200",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ring-1 ${map[tone ?? "slate"]}`}>
      {k}: <b>{v}</b>
    </span>
  );
}

function fmtUsd(n: number): string {
  return `$${(Math.round(n * 100) / 100).toFixed(2)}`;
}
