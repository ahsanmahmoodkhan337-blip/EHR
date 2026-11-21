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
 *   done    — a stage behind the furthest stage this student has reached, or
 *             (when the caller passes `completedIds`) a step the record itself
 *             says is finished. Still clickable: going back is review, and the
 *             stage body decides for itself what may be edited (StageReviewFrame
 *             + Reopen to edit).
 *   current — the stage on screen.
 *   locked  — beyond the furthest stage reached. It keeps its place in the row
 *             so the student can see what is still ahead, carries a lock icon,
 *             and says why it cannot be opened. It stays keyboard-focusable
 *             (aria-disabled, not `disabled`) so a screen reader can announce
 *             the reason instead of the step silently vanishing from the tab
 *             order.
 *
 * The patient chart draws this same strip at the top of the workspace with
 * `numbered` (1..6) and `completedIds` read from the record, so opening a patient
 * shows the whole visit, step 1 first, with the finished steps ticked
 * (spec `encounter-continuity.md`).
 *
 * Layout (spec `phase-1-navigation.md` item 7): the row wraps onto a second line
 * rather than scrolling sideways, so a label is never cut in half — "Debrief"
 * and "Ledger" were both clipped at 1440 px and 1280 px when the row was a
 * horizontal scroller.
 *
 * The role is derived from the current stage and printed once, under the row
 * (item 4). No other screen prints a role for a case.
 */

import { Check, Lock } from "lucide-react";
import type { ReactNode } from "react";

/** One step in the spine. `id` is the stage name the runner navigates to. */
export interface EncounterStep {
  id: string;
  label: string;
  icon?: ReactNode;
  /** The job role that owns this step, from the shared stage model. */
  role?: string;
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
  /**
   * The steps the record says are finished, when the caller can read that from
   * the record itself (the patient chart does: a note section written, the vitals
   * taken, the note signed). When given, a tick means "this step is done", not
   * "this step is behind you" — so a student who jumps back to step 1 still sees
   * which steps are finished (spec `encounter-continuity.md`).
   */
  completedIds?: readonly string[];
  /**
   * Print each step's 1-based number, the way a visit's steps are numbered in
   * the chart's step bar. A finished step keeps its tick instead of the number.
   */
  numbered?: boolean;
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
  completedIds,
  numbered = false,
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
  const completed = completedIds ? new Set(completedIds) : null;

  const tone = ACCENT[accent];
  const currentStep = currentIdx >= 0 ? steps[currentIdx] : undefined;
  const role = currentStep?.role;

  return (
    <div className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <nav
        aria-label={label}
        className="stage-stepper flex-wrap px-3 py-2"
      >
        <ol className="stage-stepper min-w-0 flex-wrap">
          {steps.map((step, i) => {
            const current = step.id === currentId;
            // A record that knows what is finished decides the tick; otherwise
            // the position in the spine does (practice cases).
            const done = !current && (completed ? completed.has(step.id) : i < furthestIdx);
            const locked = i > furthestIdx;
            const stateLabel = current ? "current stage" : done ? "done" : locked ? "locked" : "open";
            const stepName = numbered ? `${i + 1}. ${step.label}` : step.label;
            return (
              <li key={step.id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    if (locked) return;
                    onSelect(step.id);
                  }}
                  aria-current={current ? "step" : undefined}
                  aria-disabled={locked || undefined}
                  aria-label={`${stepName} — ${stateLabel}`}
                  title={
                    locked
                      ? `${step.label} — locked. Finish ${steps[furthestIdx]?.label ?? "your current stage"} to open it.`
                      : done
                        ? `${step.label} — finished. Opens read-only, with Reopen to edit.`
                        : step.label
                  }
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
                    <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  ) : done ? (
                    <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  ) : numbered ? (
                    <span
                      aria-hidden="true"
                      className="w-3.5 shrink-0 text-center tabular-nums"
                    >
                      {i + 1}
                    </span>
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

      {/* The role, derived from the current stage and printed once for the case. */}
      {role && (
        <p className="section-header px-3 pb-1.5">
          Role: <span className="text-slate-600 dark:text-slate-300">{role}</span>
        </p>
      )}
    </div>
  );
}
