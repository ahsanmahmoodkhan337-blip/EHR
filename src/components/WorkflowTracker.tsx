/**
 * WorkflowTracker — Multi-stage RCM Pipeline Progress Visualizer
 *
 * Displays the full 5-stage pipeline at the top of the main content area:
 *   [Charted] → [Coded] → [Billed] → [Prior Auth] → [Paid ✅ / Denied ❌ / Reprocessed 🔄]
 *
 * Visible regardless of current role. Completed stages are highlighted,
 * current stage pulses, and future stages are dimmed.
 *
 * Inspiration: Athenahealth's workflow stage indicator + Epic's
 * encounter timeline visual.
 */

import { CheckCircle2, Circle, ArrowRight, AlertCircle, RefreshCw } from "lucide-react";
import { usePipeline } from "../store/pipelineStore";

interface WorkflowTrackerProps {
  encounterId?: string;
}

const STAGES = [
  { key: "charted" as const, label: "Charted", color: "blue" },
  { key: "coded" as const, label: "Coded", color: "indigo" },
  { key: "billed" as const, label: "Billed", color: "violet" },
  { key: "priorAuth" as const, label: "Prior Auth", color: "purple" },
];

const COLOR_MAP: Record<string, { bg: string; text: string; ring: string; dot: string }> = {
  blue: { bg: "bg-blue-100", text: "text-blue-700", ring: "ring-blue-400", dot: "bg-blue-500" },
  indigo: { bg: "bg-indigo-100", text: "text-indigo-700", ring: "ring-indigo-400", dot: "bg-indigo-500" },
  violet: { bg: "bg-violet-100", text: "text-violet-700", ring: "ring-violet-400", dot: "bg-violet-500" },
  purple: { bg: "bg-purple-100", text: "text-purple-700", ring: "ring-purple-400", dot: "bg-purple-500" },
};

export function WorkflowTracker({ encounterId }: WorkflowTrackerProps) {
  const { state, currentRole, getRoleLabel } = usePipeline();

  // Map pipeline status to completed stages
  const isStageCompleted = (stageKey: string): boolean => {
    switch (stageKey) {
      case "charted":
        return ["charted", "coded", "billed", "paid", "denied"].includes(state.status);
      case "coded":
        return ["coded", "billed", "paid", "denied"].includes(state.status);
      case "billed":
        return ["billed", "paid", "denied"].includes(state.status);
      case "priorAuth":
        return state.status === "paid";
      default:
        return false;
    }
  };

  // Determine which stage index is current based on role
  const roleStageIndex: Record<string, number> = {
    scribe: 0,
    coder: 1,
    biller: 2,
    "prior-auth": 3,
    "ar-voice": 4,
  };
  const currentStageIndex = roleStageIndex[currentRole] ?? 0;

  return (
    <div className="border-b border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center justify-center gap-1 sm:gap-2">
        {STAGES.map((s, i) => {
          const isCompleted = isStageCompleted(s.key);
          const isCurrent = i === currentStageIndex && !isCompleted;
          const isFuture = !isCompleted && !isCurrent && i > currentStageIndex;
          const colors = COLOR_MAP[s.color];

          return (
            <div key={s.key} className="flex items-center gap-1 sm:gap-2">
              {/* Stage badge */}
              <div
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all sm:px-3 sm:py-1.5 ${
                  isCompleted
                    ? `${colors.bg} ${colors.text} ring-1 ${colors.ring}`
                    : isCurrent
                    ? "bg-sky-100 text-sky-700 ring-1 ring-sky-400 animate-pulse"
                    : "bg-slate-100 text-slate-400"
                } ${isFuture ? "opacity-40" : ""}`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : isCurrent ? (
                  <Circle className="h-3.5 w-3.5 fill-sky-400 text-sky-400" />
                ) : (
                  <Circle className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">{s.label}</span>
              </div>

              {/* Arrow between stages */}
              {i < STAGES.length - 1 && (
                <ArrowRight className={`h-3.5 w-3.5 ${
                  i < currentStageIndex ? "text-slate-400" : "text-slate-300"
                }`} />
              )}
            </div>
          );
        })}

        {/* Arrow to final outcome */}
        <ArrowRight className="h-3.5 w-3.5 text-slate-300" />

        {/* ─── 5th Stage: Claim Status ─── */}
        {state.status === "paid" ? (
          <div className="flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700 ring-1 ring-green-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Paid</span>
            <span className="inline sm:hidden">✅</span>
          </div>
        ) : state.status === "denied" ? (
          <div className="flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 ring-1 ring-red-400">
            <AlertCircle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Denied</span>
            <span className="inline sm:hidden">❌</span>
          </div>
        ) : state.status === "reprocessed" ? (
          <div className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-700 ring-1 ring-amber-400">
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reprocessed</span>
            <span className="inline sm:hidden">🔄</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-400">
            <Circle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Pending</span>
          </div>
        )}
      </div>

      {/* Role indicator label */}
      <div className="mt-2 text-center text-[10px] font-medium uppercase tracking-wider text-slate-400">
        Current Role: {getRoleLabel(currentRole)}
      </div>
    </div>
  );
}