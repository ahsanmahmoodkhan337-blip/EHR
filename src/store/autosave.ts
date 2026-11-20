/**
 * autosave.ts — the one record of whether the student's work is saved
 *
 * Inspired by: Epic Hyperspace's save-status line at the bottom of a Chart
 * activity and athenaOne's "All changes saved" toast — collapsed into a single
 * piece of state that one component (`AutosaveIndicator`, in the top bar) reads.
 * Spec `task-1-app-shell.md` item 9 and T0-12: the indicator is the ONE place
 * that states where work is saved, so Dashboard and Settings point at it
 * instead of each making their own claim.
 *
 * The rule this file exists to enforce (see the plan's Known Risks: "silent
 * persistence failure is worse than a crash"): a save path that can no-op must
 * either succeed or say so. Every student-work write goes through
 * `writeAutosaved()`, which reports "saving", then either "saved" with the time
 * or "failed" with a plain-English reason and a retry.
 *
 * No React here on purpose — the store is a tiny external store so it can be
 * tested without a DOM (`tests/autosave.test.ts`).
 */

export type AutosaveStatus = "idle" | "saving" | "saved" | "failed";

export interface AutosaveSnapshot {
  status: AutosaveStatus;
  /** What was written, in the student's words — e.g. "Medical case". */
  scope: string | null;
  /** Epoch ms of the last successful write, or null when nothing has saved yet. */
  savedAt: number | null;
  /** Plain-English reason the last write failed, or null. */
  error: string | null;
  /** Bumped on every change so a subscriber can re-read even identical states. */
  revision: number;
}

const EMPTY: AutosaveSnapshot = {
  status: "idle",
  scope: null,
  savedAt: null,
  error: null,
  revision: 0,
};

let snapshot: AutosaveSnapshot = EMPTY;
const listeners = new Set<() => void>();

/** A write that failed and can be attempted again, with the same arguments. */
let retry: (() => void) | null = null;

function publish(next: Partial<AutosaveSnapshot>): void {
  snapshot = { ...snapshot, ...next, revision: snapshot.revision + 1 };
  for (const listener of listeners) listener();
}

export function getAutosave(): AutosaveSnapshot {
  return snapshot;
}

export function subscribeAutosave(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** A write has started. Shown as "Saving…" — never as "Saved". */
export function markSaving(scope: string): void {
  publish({ status: "saving", scope, error: null });
}

/** The write landed. `savedAt` is the moment it did. */
export function markSaved(scope: string, at: number = Date.now()): void {
  retry = null;
  publish({ status: "saved", scope, savedAt: at, error: null });
}

/** The write did not land. The reason is shown, and the save is offered again. */
export function markFailed(scope: string, reason: string, again?: () => void): void {
  retry = again ?? null;
  publish({ status: "failed", scope, error: reason });
}

/** Re-run the last failed write. No-op when nothing failed. */
export function retryLastSave(): void {
  retry?.();
}

/** True when there is a failed write that can be tried again. */
export function canRetry(): boolean {
  return retry !== null;
}

/** Back to "nothing has happened yet" — used between students and by tests. */
export function resetAutosave(): void {
  retry = null;
  snapshot = EMPTY;
  for (const listener of listeners) listener();
}

/**
 * Turn a thrown storage error into a sentence a student can act on. The three
 * cases a browser actually produces are quota, blocked storage (private mode /
 * site data disabled) and everything else.
 */
export function describeStorageError(error: unknown): string {
  if (error instanceof Error) {
    const name = error.name;
    const message = error.message || "";
    if (name === "QuotaExceededError" || /quota/i.test(message)) {
      return "this browser's storage is full — free some space or clear old data";
    }
    if (name === "SecurityError" || /denied|blocked|not allowed/i.test(message)) {
      return "this browser is blocking site storage — allow it for this site, or turn off private browsing";
    }
    return message || "the browser refused the write";
  }
  return "the browser refused the write";
}

/**
 * Write one value to localStorage and report the outcome in the one indicator.
 *
 * Returns true when the value is stored. On failure the student's screen keeps
 * working from memory — the write is not retried silently, because a silent
 * retry loop is how a save failure goes unnoticed.
 */
export function writeAutosaved(key: string, value: string, scope: string): boolean {
  markSaving(scope);
  if (typeof localStorage === "undefined") {
    markFailed(scope, "this browser has no local storage available");
    return false;
  }
  try {
    localStorage.setItem(key, value);
    markSaved(scope);
    return true;
  } catch (error) {
    const reason = describeStorageError(error);
    markFailed(scope, reason, () => {
      writeAutosaved(key, value, scope);
    });
    return false;
  }
}
