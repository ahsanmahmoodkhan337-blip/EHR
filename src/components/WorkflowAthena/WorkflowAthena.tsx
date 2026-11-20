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
 */

import {
  Activity,
  CheckCircle2,
  CircleDot,
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
  completedStages: Set<string>;
  onToggleStageComplete: (stageId: string) => void;
  /** Steps whose completion comes from the patient's data, not from a click. */
  derivedStages?: string[];
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
  onToggleStageComplete,
  derivedStages = [],
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
          className="h-full rounded-full bg-blue-600 transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Stage Steps */}
      <div className="space-y-1">
        {stages.map((stage, index) => {
          const isCompleted = completedStages.has(stage.id);
          const isCurrent = activeStage === stage.id;
          const isPreviousCompleted =
            index === 0 || completedStages.has(stages[index - 1]?.id ?? "");

          return (
            <div
              key={stage.id}
              className={`group flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                isCurrent
                  ? "border-blue-200 bg-blue-50"
                  : isCompleted
                    ? "border-green-200 bg-green-50/70"
                    : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              {/* Completion checkbox — beside the step, never inside it */}
              <input
                type="checkbox"
                checked={isCompleted}
                disabled={derivedStages.includes(stage.id)}
                onChange={() => onToggleStageComplete(stage.id)}
                aria-label={
                  isCompleted
                    ? `Mark ${stage.label} as incomplete`
                    : `Mark ${stage.label} as complete`
                }
                title={
                  derivedStages.includes(stage.id)
                    ? "This step is completed by the patient's data, not by a click."
                    : undefined
                }
                className="mt-1 h-4 w-4 shrink-0 accent-green-600 disabled:cursor-not-allowed disabled:opacity-40"
              />

              {/* The step itself — one button */}
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => isPreviousCompleted && onStageSelect(stage.id)}
                  disabled={!isPreviousCompleted}
                  className={`flex w-full items-center gap-2 text-left ${
                    isPreviousCompleted ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                  }`}
                >
                  <span
                    className={`${
                      isCurrent ? "text-blue-600" : "text-slate-400"
                    }`}
                  >
                    {stage.icon}
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      isCurrent
                        ? "text-blue-800"
                        : isCompleted
                          ? "text-green-800"
                          : "text-slate-700"
                    }`}
                  >
                    {stage.label}
                  </span>
                  {isCurrent && (
                    <span className="ml-auto rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                      Active
                    </span>
                  )}
                </button>
                <p className="mt-0.5 text-xs text-slate-500">
                  {stage.description}
                </p>
                {!isCompleted && stageHints[stage.id] && (
                  <p className="mt-0.5 text-[10px] font-medium text-amber-700">
                    {stageHints[stage.id]}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}