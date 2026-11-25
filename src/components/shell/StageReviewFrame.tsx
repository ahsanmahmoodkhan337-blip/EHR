/**
 * StageReviewFrame — a finished stage opens for reading, not for editing
 *
 * Inspired by: Epic Hyperspace's read-only view of a completed activity and
 * athenaOne's encounter checklist, where a step you have finished stays
 * clickable so you can go back and read what you recorded — but the screen no
 * longer takes edits (spec `task-1-app-shell.md` items 5 and 11).
 *
 * How the editing is stopped: the stage body is rendered inside a
 * `<fieldset disabled>`. The HTML element disables every form control beneath
 * it natively — inputs, selects, textareas, checkboxes and buttons — so a stage
 * cannot quietly keep one editable control the way a hand-written `readOnly`
 * prop per field can. Screen readers announce the controls as unavailable, and
 * the banner above says in words what happened and how to get back.
 *
 * What stays live: the encounter stepper above the frame, the reference drawer,
 * and the two buttons in the banner. Reading, scrolling and selecting text are
 * untouched.
 *
 * "Reopen to edit" is an explicit opt-in, not a default. A student who reaches
 * the claim and realises the coding was wrong can go back and fix it instead of
 * retaking the whole case; the frame says plainly that reopening changes the
 * graded record.
 */

import { Lock, PencilLine, Undo2 } from "lucide-react";
import type { ReactNode } from "react";

export type ReviewAccent = "blue" | "teal";

interface StageReviewFrameProps {
  /** Label of the stage being reviewed, e.g. "Coding". */
  stageLabel: string;
  /** Label of the stage the case is actually on, e.g. "Claim". */
  currentLabel: string;
  onBackToCurrent: () => void;
  /** Omit to make the review permanently read-only. */
  onReopen?: () => void;
  accent?: ReviewAccent;
  children: ReactNode;
}

const ACCENT: Record<ReviewAccent, { banner: string; button: string; ring: string }> = {
  blue: {
    banner: "border-brand-200 bg-brand-50 text-brand-900",
    button: "bg-brand-700 text-white hover:bg-brand-800",
    ring: "focus-visible:outline-brand-600",
  },
  teal: {
    banner: "border-teal-200 bg-teal-50 text-teal-900",
    button: "bg-teal-700 text-white hover:bg-teal-600",
    ring: "focus-visible:outline-teal-600",
  },
};

export function StageReviewFrame({
  stageLabel,
  currentLabel,
  onBackToCurrent,
  onReopen,
  accent = "blue",
  children,
}: StageReviewFrameProps) {
  const tone = ACCENT[accent];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        role="region"
        aria-label={`Reviewing ${stageLabel} — read only`}
        className={`flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 text-[11px] leading-relaxed ${tone.banner}`}
      >
        <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <p className="min-w-0 flex-1">
          <span className="font-semibold">Reviewing “{stageLabel}” — read only.</span> You have already
          finished this stage, so it opens for reading. Nothing you change here is saved. Your case is at
          “{currentLabel}”.
        </p>
        <button
          type="button"
          onClick={onBackToCurrent}
          className={`flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 ${tone.button} ${tone.ring}`}
        >
          <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
          Back to {currentLabel}
        </button>
        {onReopen && (
          <button
            type="button"
            onClick={onReopen}
            title="Reopening changes the graded record for this case"
            className={`flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-[11px] font-semibold focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 ${tone.ring}`}
          >
            <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
            Reopen to edit
          </button>
        )}
      </div>

      {/* `fieldset disabled` disables every control beneath it — the one switch
          that cannot miss a stage's own inputs. */}
      <fieldset
        disabled
        aria-label={`${stageLabel} — read only`}
        className="m-0 min-h-0 min-w-0 flex-1 overflow-hidden border-0 p-0"
      >
        {children}
      </fieldset>
    </div>
  );
}
