/**
 * TutorialReadOnlyNotice — the one line at the top of every stage of the
 * Tutorial Patient's chart.
 *
 * Inspired by: Epic Hyperspace's read-only chart banner, where a record you may
 * look at but not change says so in a single line above the activity rather than
 * in a modal that hides the work.
 *
 * Owner decision, 2026-11-22 — *"Keep the Tutorial Patient read-only so students
 * can't edit the standard chart"* — and 2026-11-23 — *"each section should be pre
 * written and locked"*. Spec `specs/tutorial-patient-prefill.md` § C.
 *
 * This is the *second* layer. The stores refuse the write first
 * (`domain/tutorialReadOnly.ts`, `store/pipelineStore.tsx`,
 * `store/ehrStore.ts`); the sentence here tells the student why the control in
 * front of them does nothing, and where to go to practise instead. A refused
 * write lands in the same block, so a control that still reached the store (a
 * click handler on a row rather than a form control) says what happened.
 */
import { Lock } from "lucide-react";
import { TUTORIAL_READ_ONLY_LINE, useTutorialRefusal } from "../../domain/tutorialReadOnly";

export const TUTORIAL_NOTICE_ID = "tutorial-read-only-notice";

export function TutorialReadOnlyNotice() {
  const refusal = useTutorialRefusal();
  return (
    <div
      id={TUTORIAL_NOTICE_ID}
      role="status"
      aria-live="polite"
      className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-snug text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
    >
      <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
      <span className="font-medium">{TUTORIAL_READ_ONLY_LINE}</span>
      {refusal && (
        <span className="basis-full font-medium text-amber-700 dark:text-amber-400" data-testid="tutorial-refusal">
          {refusal}
        </span>
      )}
    </div>
  );
}
