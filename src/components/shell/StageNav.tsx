/**
 * StageNav — one way back, and the one step forward.
 *
 * Inspiration: athenahealth's sequential encounter workflow (a single step
 * forward at a time, never a jump into the middle of the pipeline) with Epic
 * Hyperspace's chart-stage breadcrumb.
 *
 * Spec `tutorial-start-and-back.md`: every stage after the first carries one
 * clearly labelled secondary **Back to <previous stage>** control, and spec
 * `home-button-returns-home.md` / STANDING-RULES 9 want a clear Next at the
 * bottom of the step. Both are navigation only: they change which stage is
 * shown and nothing else — no note, code, claim or posted entry is touched.
 *
 * Each control is a real `<button>` with a visible label, keyboard focus and a
 * 40 px minimum hit area (STANDING-RULES 5).
 */

import { ArrowLeft, ArrowRight } from "lucide-react";

export interface StageNavTarget {
  /** The stage's own name, e.g. "Intake / Vitals". */
  label: string;
  onClick: () => void;
}

interface StageNavProps {
  /** The previous stage, when there is one. The first stage has none. */
  back?: StageNavTarget;
  /** The next stage, when the student may move on. */
  next?: StageNavTarget;
  className?: string;
}

export function StageNav({ back, next, className = "" }: StageNavProps) {
  if (!back && !next) return null;
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 ${className}`}
    >
      {back ? (
        <button
          type="button"
          onClick={back.onClick}
          className="flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to {back.label}
        </button>
      ) : (
        <span />
      )}
      {next ? (
        <button
          type="button"
          onClick={next.onClick}
          className="btn-primary flex min-h-10 items-center gap-1.5"
        >
          Next: {next.label}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
