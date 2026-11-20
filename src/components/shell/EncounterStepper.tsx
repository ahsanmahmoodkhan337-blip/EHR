/**
 * EncounterStepper.tsx — the one encounter stepper for both RCM tracks
 *
 * Inspired by: Epic's Chart activity workflow navigator (the activity bar across
 * the top of a Chart activity) and athenaOne's encounter checklist. It replaces
 * the two hand-rolled steppers that used to sit inside MedicalCaseRunner and
 * DentalCaseRunner, so a student reads the same three states in both tracks
 * (spec `task-1-app-shell.md` item 5, plus T0-15's lock state).
 *
 * Three states, read from the record and never from a stored click:
 *   done    — a stage behind the furthest stage this student has reached.
 *             Still clickable: going back is review, and the stage body decides
 *             for itself what may be edited.
 *   current — the stage on screen.
 *   locked  — beyond the furthest stage reached. It keeps its place in the row
 *             so the student can see what is still ahead, carries a lock icon,
 *             and says why it cannot be opened. It stays keyboard-focusable
 *             (aria-disabled, not `disabled`) so a screen reader can announce
 *             the reason instead of the step silently vanishing from the tab
 *             order.
 */

import { Check, Lock } from "lucide-react";
import type { ReactNode } from "react";

/** One step in the spine. `id` is the stage name the runner navigates to. */
export interface EncounterStep {
  id: string;
  label: string;
  icon?: ReactNode;
}

export type StepperAccent = "blue" | "teal";

interface EncounterStepperProps {
  /** Stages in order, including the frames (case select, briefing, debrief). */
  steps: EncounterStep[];
  /** Stage currently on screen. */
  currentId: string;
  /** Furthest stage this student has reached — everything after it is locked. */
  furthestId: string;
  onSelect: (id: string) => void;
  /** Blue for the medical track, teal for dental. */
  accent?: StepperAccent;
  /** Right-hand chip, e.g. "MCASE-001 · beginner". */
  meta?: ReactNode;
  /** Accessible name for the whole strip. */
  label?: string;
}

const ACCENT: Record<StepperAccent, { current: string; done: string; ring: string }> = {
  blue: {
    current: "bg-blue-600 text-white shadow-sm",
    done: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200 hover:bg-blue-100",
    ring: "focus-visible:ring-blue-500",
  },
  teal: {
    current: "bg-teal-600 text-white shadow-sm",
    done: "bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200 hover:bg-teal-100",
    ring: "focus-visible:ring-teal-500",
  },
};

export function EncounterStepper({
  steps,
  currentId,
  furthestId,
  onSelect,
  accent = "blue",
  meta,
  label = "Encounter stages",
}: EncounterStepperProps) {
  const currentIdx = steps.findIndex((s) => s.id === currentId);
  // A conditional stage (medical prior-auth) can be absent from the visible
  // list while still being the furthest one recorded; fall back to the current
  // step rather than locking the whole spine.
  let furthestIdx = steps.findIndex((s) => s.id === furthestId);
  if (furthestIdx < 0) furthestIdx = Math.max(currentIdx, 0);

  const tone = ACCENT[accent];

  return (
    <nav
      aria-label={label}
      className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900"
    >
      <ol className="flex items-center gap-1">
        {steps.map((step, i) => {
          const current = step.id === currentId;
          const done = !current && i < furthestIdx;
          const locked = i > furthestIdx;
          const stateLabel = current ? "current stage" : done ? "done" : locked ? "locked" : "open";
          return (
            <li key={step.id} className="shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (locked) return;
                  onSelect(step.id);
                }}
                aria-current={current ? "step" : undefined}
                aria-disabled={locked || undefined}
                aria-label={`${step.label} — ${stateLabel}`}
                title={locked ? `${step.label} — locked until you reach this stage` : step.label}
                className={`flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${tone.ring} ${
                  current
                    ? tone.current
                    : done
                      ? tone.done
                      : locked
                        ? "cursor-not-allowed text-slate-500 dark:text-slate-400"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {locked ? (
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                ) : done ? (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  step.icon
                )}
                <span className="whitespace-nowrap">{step.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {meta && <div className="ml-auto shrink-0 pl-2">{meta}</div>}
    </nav>
  );
}
