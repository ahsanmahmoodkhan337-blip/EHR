/**
 * WorkflowAthena — Athena-Style Workflow Stage Navigator
 *
 * Inspiration: Athenahealth's workflow-driven encounter design.
 * Athenahealth organizes clinical workflow around sequential stages
 * (Intake → HPI → Exam → Assessment → Sign). Clicking a stage
 * navigates to its content in the center area and marks it as
 * the "current" active stage.
 *
 * This component renders in the left sidebar as a vertical stepper
 * with progress tracking, stage status indicators, and click-to-navigate.
 *
 * Stages:
 * 1. Intake/Vitals — BP, HR, Temp, RR, O2 sat, weight, height
 * 2. Reason for Visit / HPI — Free-text history
 * 3. Exam / Review of Systems — Checkbox ROS grid
 * 4. Assessment & Plan — SOAP note + one-click macros
 * 5. Sign & Lock — Finalize note (placeholder)
 *
 * ── Status comes from the record, not from a click (status-engine.md §5) ──
 * There is no "Mark complete" control any more. `completedStages` is derived by
 * the caller from the patient's own data (a step turns green only when its
 * required fields are valid), so this component never writes anything and never
 * runs an effect. Each row is **one** real `<button>` — the icon and the badges
 * inside it are plain `<span>`s, so there is one tab stop per row and no nested
 * interactive element. A step that cannot be opened yet is **amber**, not red:
 * it says what is still missing instead of looking like an error.
 */

import {
  Activity,
  ClipboardCheck,
  MessageSquare,
  Stethoscope,
  Lock,
  User,
} from "lucide-react";

// ─── Stage Definition ──────────────────────────────────────────────

export interface WorkflowStage {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  required: boolean;
}

const DEFAULT_STAGES: WorkflowStage[] = [
  {
    id: "registration",
    label: "Registration",
    description: "Patient intake, identity & insurance verification",
    icon: <User className="h-5 w-5" />,
    required: true,
  },
  {
   id: "intake-vitals",
    label: "Intake / Vitals",
    description: "BP, HR, Temp, RR, O2 sat, weight, height",
    icon: <Activity className="h-5 w-5" />,
    required: true,
  },
  {
    id: "hpi",
    label: "Reason for Visit / HPI",
    description: "History of Present Illness, OLDCARTS",
    icon: <MessageSquare className="h-5 w-5" />,
    required: true,
  },
  {
    id: "exam-ros",
    label: "Exam / Review of Systems",
    description: "Systems-based ROS checklist",
    icon: <Stethoscope className="h-5 w-5" />,
    required: true,
  },
  {
    id: "assessment-plan",
    label: "Assessment & Plan",
    description: "SOAP note with one-click macros",
    icon: <ClipboardCheck className="h-5 w-5" />,
    required: true,
  },
  {
    id: "sign-lock",
    label: "Sign & Lock Note",
    description: "Finalize encounter documentation",
    icon: <Lock className="h-5 w-5" />,
    required: true,
  },
];

// ─── Props ─────────────────────────────────────────────────────────

interface WorkflowAthenaProps {
  stages?: WorkflowStage[];
  activeStage: string;
  onStageSelect: (stageId: string) => void;
  /** Steps whose required data is complete — derived by the caller, never clicked. */
  completedStages: Set<string>;
  /** Why a step is not done yet, keyed by stage id — shown under the step. */
  stageHints?: Record<string, string>;
  className?: string;
}

// ─── Component ─────────────────────────────────────────────────────

export function WorkflowAthena({
  stages = DEFAULT_STAGES,
  activeStage,
  onStageSelect,
  completedStages,
  stageHints = {},
  className = "",
}: WorkflowAthenaProps) {
  const progressPercent =
    stages.length > 0
      ? Math.round((completedStages.size / stages.length) * 100)
      : 0;

  return (
    <div className={className}>
      {/* Header with Progress */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Workflow
        </h3>
        <p className="text-xs text-slate-400">
          {completedStages.size} of {stages.length} stages
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-brand-600 transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Stage Steps — one button per row */}
      <div className="space-y-1">
        {stages.map((stage, index) => {
          const isCompleted = completedStages.has(stage.id);
          const isCurrent = activeStage === stage.id;
          // A step opens once the one before it is complete. Until then it is
          // blocked — amber, with the reason, never red.
          const isPreviousCompleted =
            index === 0 || completedStages.has(stages[index - 1]?.id ?? "");
          const blocked = !isCompleted && !isCurrent && !isPreviousCompleted;
          const hint =
            stageHints[stage.id] ??
            (blocked ? `Complete ${stages[index - 1]?.label ?? "the previous step"} first.` : undefined);

          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => onStageSelect(stage.id)}
              disabled={blocked}
              aria-current={isCurrent ? "step" : undefined}
              className={`group flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                isCurrent
                  ? "border-brand-200 bg-brand-50"
                  : isCompleted
                    ? "border-green-200 bg-green-50/70 hover:border-green-300"
                    : blocked
                      ? "cursor-not-allowed border-amber-200 bg-amber-50/60"
                      : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              {/* Step icon — decorative, never interactive */}
              <span
                aria-hidden="true"
                className={`mt-0.5 shrink-0 ${
                  isCurrent ? "text-brand-600" : isCompleted ? "text-green-600" : blocked ? "text-amber-500" : "text-slate-400"
                }`}
              >
                {stage.icon}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span
                    className={`text-sm font-medium ${
                      isCurrent
                        ? "text-brand-800"
                        : isCompleted
                          ? "text-green-800"
                          : blocked
                            ? "text-amber-800"
                            : "text-slate-700"
                    }`}
                  >
                    {stage.label}
                  </span>
                  {isCurrent && (
                    <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">
                      Active
                    </span>
                  )}
                  {isCompleted && (
                    <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                      From the record
                    </span>
                  )}
                  {blocked && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                      Not open yet
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {stage.description}
                </span>
                {!isCompleted && hint && (
                  <span className="mt-0.5 block text-[10px] font-medium text-amber-700">{hint}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
