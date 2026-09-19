/**
 * WorkflowTracker — Multi-stage RCM Pipeline Progress Visualizer
 *
 * Displays the full medical pipeline as a consistent 5-stage stepper plus a
 * final claim-status node:
 *   Scribe → Coder → Prior Auth → Biller → AR Voice → [Paid / Denied / …]
 *
 * Completed stages show a check, the current stage is highlighted on
 * brand-blue, and future stages are locked/dimmed. Uses the shared
 * `.stage-stepper` / `.stage-step` / `.stage-sep` primitives so every
 * pipeline view renders stages the same way (the container scrolls
 * horizontally on small screens).
 *
 * Inspiration: Athenahealth's workflow stage indicator + Epic's
 * encounter timeline visual.
 */

import { CheckCircle2, Circle, ArrowRight, AlertCircle, RefreshCw } from "lucide-react";
import { usePipeline } from "../store/pipelineStore";
import type { Role } from "../store/pipelineStore";

interface WorkflowTrackerProps {
  encounterId?: string;
}

const STAGE_ORDER: Role[] = ["scribe", "coder", "prior-auth", "biller", "ar-voice"];

const STAGES: { key: Role; label: string }[] = [
  { key: "scribe", label: "Scribe" },
  { key: "coder", label: "Coder" },
  { key: "prior-auth", label: "Prior Auth" },
  { key: "biller", label: "Biller" },
  { key: "ar-voice", label: "AR Voice" },
];

export function WorkflowTracker({ encounterId }: WorkflowTrackerProps) {
  const { state, currentRole, getRoleLabel } = usePipeline();

  const currentIndex = STAGE_ORDER.indexOf(currentRole);
  const isComplete = state.stage === "complete";

  const stepState = (i: number) =>
    isComplete || i < currentIndex ? "complete" : i === currentIndex ? "active" : "locked";

  const outcomeTone =
    state.status === "paid"
      ? "is-success"
      : state.status === "denied"
      ? "is-danger"
      : state.status === "reprocessed"
      ? "is-warning"
      : "is-neutral";

  const OutcomeIcon =
    state.status === "paid" ? CheckCircle2 : state.status === "denied" ? AlertCircle : state.status === "reprocessed" ? RefreshCw : Circle;

  const outcomeLabel =
    state.status === "paid"
      ? "Paid"
      : state.status === "denied"
      ? "Denied"
      : state.status === "reprocessed"
      ? "Reprocessed"
      : "Pending";

  return (
    <div className="border-b border-slate-200 bg-white px-4 py-3">
      <div className="stage-stepper justify-center">
        {STAGES.map((s, i) => {
          const tone = stepState(i);
          return (
            <div key={s.key} className="flex items-center">
              <div className={`stage-step ${tone === "complete" ? "is-complete" : tone === "active" ? "is-active" : "is-locked"}`}>
                {tone === "complete" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                ) : tone === "active" ? (
                  <Circle className="h-3.5 w-3.5 fill-white/30 text-white" />
                ) : (
                  <Circle className="h-3.5 w-3.5" />
                )}
                <span className="whitespace-nowrap">{s.label}</span>
              </div>
              {i < STAGES.length - 1 && <ArrowRight className="stage-sep" />}
            </div>
          );
        })}

        <ArrowRight className="stage-sep" />

        {/* Final claim-status node */}
        <span className={`status-badge ${outcomeTone}`}>
          <OutcomeIcon className="h-3.5 w-3.5" />
          <span className="whitespace-nowrap">{outcomeLabel}</span>
        </span>
      </div>

      {/* Role indicator label */}
      <div className="mt-2 text-center text-[10px] font-medium uppercase tracking-wider text-slate-400">
        Current Role: {getRoleLabel(currentRole)}
      </div>
    </div>
  );
}
