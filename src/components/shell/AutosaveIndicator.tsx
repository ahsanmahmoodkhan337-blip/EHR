/**
 * AutosaveIndicator — the one place the app says whether work is saved
 *
 * Inspired by: Epic Hyperspace's "Last saved" line and athenaOne's save-status
 * chip, moved into the top bar so it is visible on every screen instead of on
 * the one page that happened to have a save button.
 *
 * Spec `task-1-app-shell.md` item 9 and T0-12: one indicator, and it is the one
 * place that states where work is saved. Three states, all stated plainly:
 *   saved   — "Saved 14:32" (the time of the write, not a guess)
 *   saving  — "Saving…"
 *   failed  — "Not saved" in red, with the reason and a Retry button. It stays
 *             on screen until a write succeeds; it never fades away.
 *
 * Everything it knows comes from `store/autosave.ts`, which every student-work
 * write reports to. Nothing here invents a status.
 */

import { useSyncExternalStore } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Save } from "lucide-react";
import {
  canRetry,
  getAutosave,
  retryLastSave,
  subscribeAutosave,
  type AutosaveSnapshot,
} from "../../store/autosave";

const BASE =
  "flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-[11px] font-semibold transition-colors";

function clockOf(at: number): string {
  try {
    return new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "just now";
  }
}

/** Where the work lives — the one true statement, used in every title. */
function where(snapshot: AutosaveSnapshot): string {
  const what = snapshot.scope ? ` ${snapshot.scope}` : "";
  return `Your${what} work is saved automatically to this browser, under your phone number.`;
}

export function AutosaveIndicator() {
  const snapshot = useSyncExternalStore(subscribeAutosave, getAutosave, getAutosave);

  if (snapshot.status === "failed") {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className={`${BASE} bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-900/40 dark:text-red-200 dark:ring-red-800`}
        title={`Not saved: ${snapshot.error ?? "the browser refused the write"}. Your work is still on this screen — it is not stored yet.`}
      >
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="hidden whitespace-nowrap sm:inline">Not saved</span>
        <span className="hidden max-w-[16rem] truncate font-normal opacity-90 sm:inline">
          — {snapshot.error ?? "the browser refused the write"}
        </span>
        {/* A phone-width bar has no room for the words, so the warning becomes
            the retry button itself: the triangle is the alert and pressing it
            tries the write again. */}
        {canRetry() && (
          <button
            type="button"
            onClick={retryLastSave}
            className="ml-0.5 hidden min-h-10 items-center rounded-md bg-red-600 px-2 text-[11px] font-bold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 sm:flex"
            aria-label="Try saving again"
          >
            Retry
          </button>
        )}
        {canRetry() ? (
          <button
            type="button"
            onClick={retryLastSave}
            className="flex h-10 w-10 items-center justify-center rounded bg-red-600 text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 sm:hidden"
            aria-label="Not saved — try saving again"
            title="Not saved — try saving again"
          >
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : (
          <span className="sr-only">Not saved</span>
        )}
      </div>
    );
  }

  if (snapshot.status === "saving") {
    return (
      <span
        role="status"
        aria-live="polite"
        className={`${BASE} bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300`}
        title={where(snapshot)}
      >
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
        <span className="hidden whitespace-nowrap sm:inline">Saving…</span>
        <span className="sr-only">Saving…</span>
      </span>
    );
  }

  if (snapshot.status === "saved" && snapshot.savedAt) {
    const time = clockOf(snapshot.savedAt);
    return (
      <span
        role="status"
        aria-live="polite"
        className={`${BASE} bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:ring-emerald-800`}
        title={`${where(snapshot)} Last save ${new Date(snapshot.savedAt).toLocaleString()}.`}
      >
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="hidden whitespace-nowrap sm:inline">
          Saved <span className="tabular-nums">{time}</span>
        </span>
        <span className="sr-only">Saved {time}</span>
      </span>
    );
  }

  return (
    <span
      role="status"
      className={`${BASE} bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400`}
      title={`${where(snapshot)} Nothing has been saved yet in this session.`}
    >
      <Save className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="hidden whitespace-nowrap sm:inline">Autosave on</span>
      <span className="sr-only">Autosave on</span>
    </span>
  );
}
