/**
 * ReadOnlyStage — the one reason, and the one set of attributes, a write control
 * on the Tutorial Patient's chart gets.
 *
 * Inspired by: Epic Hyperspace's read-only chart, where a record you may study
 * but not change disables the writing controls and says why in one line beside
 * them — with the way out (a new encounter) a click away.
 *
 * Owner report, 2026-11-23 — *"in tutorial patient i am unable to click submit
 * button i click on it and nothing happen"*. The guard lived in the stores only,
 * so the stage screens drew live-looking buttons that silently refused. Every
 * stage now takes `readOnly`, prints `ReadOnlyReason` where the student is about
 * to click, and spreads `readOnlyAttrs` onto the controls that would write.
 *
 * `disabled` alone is not enough: a disabled control that does not say why reads
 * as a broken button, so the reason is also the control's `title` and its
 * `aria-describedby`, pointing at the visible line.
 */
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { READ_ONLY_REASON } from "../../domain/tutorialReadOnly";

/** The id the visible reason carries, so a control can point at it. */
export const READ_ONLY_REASON_ID = "tutorial-read-only-reason";

/** The reason, and the way out, on the spot where the student would click. */
export function ReadOnlyReason({ className = "" }: { className?: string }) {
  return (
    <p
      id={READ_ONLY_REASON_ID}
      data-testid="read-only-reason"
      className={`flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] leading-snug text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 ${className}`}
    >
      <Lock className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
      <span className="font-medium">{READ_ONLY_REASON}</span>
      <Link
        to="/schedule"
        className="rounded font-semibold text-brand-700 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:text-brand-300"
      >
        Go to Schedule
      </Link>
    </p>
  );
}

/** The attributes a control that would write carries on the read-only chart. */
export function readOnlyAttrs(readOnly: boolean | undefined): {
  disabled?: true;
  title?: string;
  "aria-describedby"?: string;
} {
  if (!readOnly) return {};
  return {
    disabled: true,
    title: READ_ONLY_REASON,
    "aria-describedby": READ_ONLY_REASON_ID,
  };
}
