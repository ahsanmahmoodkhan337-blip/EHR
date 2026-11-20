/**
 * DentalAR.tsx — Dental AR Voice / follow-up workspace
 *
 * Inspired by: medical AR follow-up call workflows (the phone-widget pattern
 * used across this app) applied to dental denial categories and the ADA/COB
 * structure. Reimplements the widget locally — by owner direction the dental
 * tree must not import medical stage components.
 *
 * Guardrails (spec §3 + appendix, STANDING-RULES 6):
 *  - the call objective is `AR_CALL_GUIDANCE[denial.expectedOutcome]`, and for
 *    cases the case-specific `callObjectives[]`;
 *  - **every action is always offered.** The screen never says whether a denial
 *    is appealable before the student decides: choosing appeal on a denial that
 *    is not appealable is a scored trap, explained only after the choice;
 *  - a downgrade is never listed here as a denial (it is a covered reduction);
 *  - the money line comes from `denialMoney()`, so a CO line never prints as a
 *    patient balance and an OA (COB) line never prints as a write-off.
 *
 * Two callers, one component (spec `dental-ar-practice-bench.md`):
 *  - a graded case — `state.lines` and `state.lineResolutions`, scored by the
 *    case rubric;
 *  - the AR practice bench — a premade scenario's own record in `state.practice`,
 *    keyed by scenario id, scored line by line the moment each line is
 *    committed. The component takes no props: it reads which one is open.
 */

import { useMemo, useState } from "react";
import { Phone, PhoneOff, AlertTriangle, CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import {
  findCDT,
  findPracticeScenario,
  AR_CALL_GUIDANCE,
  denialMoney,
  scorePracticeLine,
  type DentalDenial,
} from "../../data/dental";
import { adjudicateDentalClaim, adjudicatePracticeScenario } from "./adjudication";
import { useDentalTrack, type DentalLineResolution } from "./DentalTrackStore";

const RESOLUTION_LABELS: Record<DentalLineResolution, string> = {
  "not-handled": "Not handled",
  appealed: "Appealed",
  resubmitted: "Resubmitted",
  "billed-patient": "Billed patient",
  "write-off": "Written off",
  closed: "Closed",
};

/**
 * Every action the AR workspace offers, in the order a biller weighs them.
 * All of them are shown on every denied line — the student decides (rule 6).
 */
const ACTIONS: { res: DentalLineResolution; label: string }[] = [
  { res: "appealed", label: "Appeal with documentation" },
  { res: "resubmitted", label: "Correct & resubmit" },
  { res: "write-off", label: "Write off (contractual)" },
  { res: "billed-patient", label: "Bill patient" },
  { res: "closed", label: "Close — educate patient" },
];

interface DeniedLineRow {
  lineId: string;
  code: string;
  denial: DentalDenial;
  chargedUsd: number;
  allowedUsd: number;
  planPaysUsd: number;
  patientOwesUsd: number;
  writeOffUsd: number;
  resolution: DentalLineResolution;
  /** True once the student has committed this line. */
  committed: boolean;
  /** The committed action, so the reveal can be re-scored against the call log. */
  committedResolution?: DentalLineResolution;
  /** Practice only: the key, returned by `scorePracticeLine` after the commit. */
  score?: ReturnType<typeof scorePracticeLine>;
}

export function DentalAR() {
  const {
    state,
    activeCase,
    logCall,
    resolveLine,
    triggerTrap,
    traps,
    goTo,
    practice,
    activePracticeId,
    practiceLogCall,
    practiceResolveLine,
    practiceResetLine,
  } = useDentalTrack();

  const [callState, setCallState] = useState<"idle" | "dialing" | "connected">("idle");
  const [callNote, setCallNote] = useState("");
  const [callTarget, setCallTarget] = useState<string | null>(null);
  const [showAppealWarning, setShowAppealWarning] = useState<string | null>(null);

  const practiceScenario = findPracticeScenario(activePracticeId);
  const practiceRun = practiceScenario ? practice[practiceScenario.id] : undefined;
  const isPractice = Boolean(practiceScenario);

  const caseAdjudication = useMemo(
    () => (practiceScenario ? null : adjudicateDentalClaim(state.lines, activeCase)),
    [practiceScenario, state.lines, activeCase],
  );

  const practiceAdjudication = useMemo(
    () => (practiceScenario ? adjudicatePracticeScenario(practiceScenario) : null),
    [practiceScenario],
  );

  // Denied lines only. Downgrades are covered (reduced), never listed here.
  const deniedLines: DeniedLineRow[] = useMemo(() => {
    if (practiceScenario) {
      const run = practiceRun;
      return (practiceAdjudication?.denied ?? []).map((l) => {
        const decision = run?.decisions[l.lineId];
        return {
          lineId: l.lineId,
          code: l.code,
          denial: l.denial,
          chargedUsd: l.chargedUsd,
          allowedUsd: l.allowedUsd,
          planPaysUsd: l.planPaysUsd,
          patientOwesUsd: l.patientOwesUsd,
          writeOffUsd: l.writeOffUsd,
          resolution: run?.lineResolutions[l.lineId] ?? "not-handled",
          committed: Boolean(decision),
          committedResolution: decision?.resolution,
          score: decision
            ? scorePracticeLine(practiceScenario, l.lineId, decision.resolution, run?.callLog ?? [])
            : undefined,
        };
      });
    }
    return (caseAdjudication?.lines ?? [])
      .filter((l) => l.denial)
      .map((l) => ({
        lineId: l.lineId,
        code: l.code,
        denial: l.denial as DentalDenial,
        chargedUsd: l.result.chargedUsd,
        allowedUsd: l.result.allowedUsd,
        planPaysUsd: l.result.planPaysUsd,
        patientOwesUsd: l.result.patientOwesUsd,
        writeOffUsd: l.result.contractualWriteOffUsd,
        resolution: state.lineResolutions[l.lineId] ?? ("not-handled" as DentalLineResolution),
        committed: Boolean(state.lineResolutions[l.lineId]),
      }));
  }, [practiceScenario, practiceRun, practiceAdjudication, caseAdjudication, state.lineResolutions]);

  const arTrapForDenial = (denial: DentalDenial) =>
    traps.find((t) => t.stage === "ar-follow-up" && t.producesDenialId === denial.id && !denial.appealable);

  const objectiveFor = (denial: DentalDenial) => ({
    guidance: AR_CALL_GUIDANCE[denial.expectedOutcome],
    caseSpecific: practiceScenario ? practiceScenario.callObjectives : (activeCase?.arFollowUp?.callObjectives ?? []),
  });

  const dial = (lineId: string) => {
    setCallTarget(lineId);
    setCallNote("");
    setCallState("dialing");
    setTimeout(() => setCallState("connected"), 900);
  };

  const endCall = (denial: DentalDenial) => {
    if (callNote.trim()) {
      const guidance = objectiveFor(denial).guidance;
      if (practiceScenario) practiceLogCall(practiceScenario.id, callTarget ?? "", guidance, callNote.trim());
      else logCall(guidance, callNote.trim());
    }
    setCallState("idle");
    setCallTarget(null);
  };

  /**
   * Commit one line's action. This is the only place a decision is recorded,
   * and the only place anything about the correct answer can appear.
   */
  const commit = (lineId: string, denial: DentalDenial, resolution: DentalLineResolution) => {
    if (practiceScenario) {
      practiceResolveLine(practiceScenario.id, lineId, resolution);
      return;
    }
    resolveLine(lineId, resolution);
    // An appeal on a denial that cannot be appealed is the trap this screen
    // teaches. It is scored, and explained, now — never before the choice.
    if (resolution === "appealed" && !denial.appealable) {
      const trap = arTrapForDenial(denial);
      if (trap) triggerTrap(trap.id);
      setShowAppealWarning(denial.id);
    }
  };

  const allResolved = deniedLines.length > 0 && deniedLines.every((l) => l.resolution !== "not-handled");
  const decidedCount = deniedLines.filter((l) => l.committed).length;

  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-800">
            Dental AR Follow-up{isPractice ? " — practice" : ""}
          </h3>
          <p className="text-[10px] text-slate-400">
            {practiceScenario
              ? `${practiceScenario.claimNumber} · ${practiceScenario.payerName} · DOS ${practiceScenario.dos}`
              : activeCase
                ? (activeCase.arFollowUp?.scenario ?? "Work the denied lines below.")
                : "Work the denied lines below."}
          </p>
        </div>
        {isPractice ? (
          <span className="rounded-lg bg-teal-50 px-3 py-2 text-[11px] font-semibold text-teal-800 ring-1 ring-teal-100">
            {decidedCount} of {deniedLines.length} lines decided
          </span>
        ) : (
          <button
            onClick={() => goTo("ledger")}
            disabled={!allResolved}
            className="min-h-[40px] rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {allResolved ? "Post to ledger →" : "Resolve all lines to finish"}
          </button>
        )}
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
        {deniedLines.map((row) => {
          const { lineId, code, denial, resolution, score } = row;
          const codeInfo = findCDT(code);
          const objective = objectiveFor(denial);
          const isTarget = callTarget === lineId;
          const trap = arTrapForDenial(denial);
          // One record decides the money: a CO line never carries a patient
          // balance, and an OA line is neither the patient's nor a write-off.
          const money = denialMoney(denial);

          return (
            <div key={lineId} className="rounded-xl border border-slate-200 bg-white shadow-sm">
              {/* denial summary row — the facts on the remittance, no answer */}
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">{code}</code>
                <span className="text-[11px] font-medium text-slate-700">{codeInfo?.shortName ?? "Unknown"}</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold ring-1 ${
                    money.patientBalance ? "bg-red-50 text-red-700 ring-red-100" : "bg-slate-100 text-slate-700 ring-slate-200"
                  }`}
                  title="Claim Adjustment Reason Code, group code first"
                >
                  {denial.carc}
                </span>
                <span className="rounded bg-slate-50 px-1.5 py-0.5 text-[9px] font-medium text-slate-400 ring-1 ring-slate-100">
                  {denial.id}
                </span>
                <span
                  className={`ml-auto text-[11px] font-bold ${money.patientBalance ? "text-red-600" : "text-slate-500"}`}
                >
                  {money.patientBalance
                    ? `${fmtUsd(row.patientOwesUsd)} patient balance — ${money.label}`
                    : `${fmtUsd(row.writeOffUsd)} — ${money.label}`}
                </span>
              </div>

              {/* denial body — what the payer said, and nothing about what to do */}
              <div className="space-y-1.5 px-3 py-2">
                <p className="text-[11px] font-semibold text-red-800">
                  {denial.title}
                  <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
                    {denial.carc} · group {denial.groupCode}
                  </span>
                </p>
                <p className="text-[10px] text-slate-600">{denial.plainLanguage}</p>
                <p className="rounded border border-slate-100 bg-slate-50 px-2 py-1 font-mono text-[9px] italic text-slate-500">
                  “{denial.payerRemark}”
                </p>
                <div className="flex flex-wrap gap-1">
                  <Badge k="Group code" v={groupCodeLabel(denial.groupCode)} tone={denial.groupCode === "PR" ? "red" : "slate"} />
                </div>
                {isPractice && (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 rounded border border-slate-100 bg-slate-50 px-2 py-1 text-[10px] text-slate-600">
                    <span>Charged <b className="tabular-nums">{fmtUsd(row.chargedUsd)}</b></span>
                    <span>Allowed <b className="tabular-nums">{fmtUsd(row.allowedUsd)}</b></span>
                    <span>Plan paid <b className="tabular-nums">{fmtUsd(row.planPaysUsd)}</b></span>
                    <span>Patient <b className="tabular-nums">{fmtUsd(row.patientOwesUsd)}</b></span>
                  </div>
                )}
              </div>

              {/* resolution area */}
              {!row.committed ? (
                <div className="border-t border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => (isTarget && callState !== "idle" ? endCall(denial) : dial(lineId))}
                      aria-label={`${isTarget && callState !== "idle" ? "End the call about" : "Call the payer about"} ${code}`}
                      className={`flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold ${
                        isTarget && callState !== "idle" ? "bg-red-600 text-white" : "bg-teal-700 text-white hover:bg-teal-600"
                      }`}
                    >
                      {isTarget && callState !== "idle" ? <PhoneOff className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
                      {isTarget ? (callState === "dialing" ? "Calling…" : "End call") : "Call payer"}
                    </button>

                    {ACTIONS.map((action) => (
                      <button
                        key={action.res}
                        onClick={() => commit(lineId, denial, action.res)}
                        aria-label={`${action.label} for ${code}`}
                        className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 hover:border-teal-300 hover:text-teal-800"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>

                  {isTarget && callState === "connected" && (
                    <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 p-2">
                      <p className="text-[10px] font-semibold text-blue-800">Call objective — what this call must accomplish</p>
                      <p className="text-[10px] text-blue-700">{objective.guidance}</p>
                      {objective.caseSpecific.length > 0 && (
                        <div className="mt-1">
                          <p className="text-[9px] font-semibold uppercase tracking-wide text-blue-400">
                            {isPractice ? "Scenario call script" : "Case call script"}
                          </p>
                          <ol className="ml-4 list-decimal text-[10px] text-blue-700">
                            {objective.caseSpecific.map((o, i) => (
                              <li key={i}>{o}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <label htmlFor={`call-note-${lineId}`} className="sr-only">
                          Call note for {code}
                        </label>
                        <input
                          id={`call-note-${lineId}`}
                          value={callNote}
                          onChange={(e) => setCallNote(e.target.value)}
                          placeholder="Log what was confirmed on the call…"
                          className="min-h-[40px] min-w-0 flex-1 rounded-lg border border-blue-200 bg-white px-2 py-2 text-[11px] outline-none focus:border-blue-400"
                        />
                        <button
                          onClick={() => endCall(denial)}
                          disabled={!callNote.trim()}
                          className="min-h-[40px] rounded-lg bg-teal-700 px-3 py-2 text-[11px] font-semibold text-white hover:bg-teal-600 disabled:bg-slate-300"
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
                <div className="border-t border-slate-100 bg-slate-50 px-3 py-2">
                  {isPractice && score ? (
                    <div className="space-y-1.5">
                      <div
                        className={`flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-semibold ${
                          score.correct
                            ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100"
                            : "bg-amber-50 text-amber-900 ring-1 ring-amber-100"
                        }`}
                      >
                        {score.correct ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                        <span>
                          {score.correct ? "Correct" : "Not the action the payer was asking for"} — you chose{" "}
                          {RESOLUTION_LABELS[row.committedResolution ?? "not-handled"]}.
                        </span>
                        <span className="w-full text-[10px] font-medium sm:w-auto">
                          Correct action: {RESOLUTION_LABELS[score.expected]}.
                        </span>
                      </div>
                      {score.noteRequired && (
                        <p className={`text-[10px] ${score.noteSatisfied ? "text-emerald-700" : "text-amber-800"}`}>
                          {score.noteSatisfied
                            ? "Your call note covers what the payer needed."
                            : `The payer would not decide this without a call note. ${score.noteHint}`}
                        </p>
                      )}
                      <p className="text-[10px] text-slate-700">{score.why}</p>
                      <p className="rounded bg-blue-50 px-2 py-1 text-[10px] italic text-blue-800">{score.lesson}</p>
                      {typeof score.disputedUsd === "number" && score.disputedUsd > 0 && (
                        <p className="text-[10px] font-semibold text-amber-800">
                          {fmtUsd(score.disputedUsd)} is held in dispute while the appeal is open — it is not a
                          write-off and it is not the patient's balance.
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => practiceResetLine(practiceScenario!.id, lineId)}
                          className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 hover:border-teal-300 hover:text-teal-800"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Decide this line again
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="flex items-center gap-2 text-[11px] font-medium text-emerald-800">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Resolved: {RESOLUTION_LABELS[resolution]}.
                      </p>
                      {/* Rule 6: the teaching text arrives after the decision, never before it. */}
                      <p className="text-[10px] text-slate-600">
                        <span className="font-semibold text-slate-700">Prevention: </span>
                        {denial.prevention}
                      </p>
                      <p className="rounded bg-blue-50 px-2 py-1 text-[10px] italic text-blue-700">Debrief: {denial.teachingPoint}</p>
                      {showAppealWarning === denial.id && (
                        <div className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] text-amber-800">
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                          <span>
                            This denial was <b>not appealable</b> — {denial.plainLanguage}
                            {trap ? ` ${trap.whyItIsWrong} Correct: ${trap.correctAction}` : ""}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {deniedLines.length > 0 && (
        <p className="mt-3 text-[9px] text-slate-400">
          Fictional payer data — all patients, payers and fees are simulated. All figures illustrative.
        </p>
      )}
    </div>
  );
}

function groupCodeLabel(groupCode: string): string {
  if (groupCode === "CO") return "CO — contractual, not billable to patient";
  if (groupCode === "PR") return "PR — patient responsibility";
  if (groupCode === "OA") return "OA — another payer's share";
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
