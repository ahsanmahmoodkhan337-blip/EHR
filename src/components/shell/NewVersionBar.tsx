/**
 * NewVersionBar — one line that says a newer build is on the server.
 *
 * Inspired by: Epic Hyperspace's "a newer version is available — reload" strip
 * and the update banner in eCW's web client. One line under the header, one
 * primary action, dismissible, and it never takes the screen away from the
 * student's work — nothing reloads until they press Reload.
 *
 * Owner report, 2026-11-23 — *"the Tutorial coding and SOAP part is not
 * updated"*. The chart was new on the server and stale in an already-open tab.
 * `domain/appVersion.ts` does the asking (on load, every five minutes, on tab
 * focus); this is only what the answer looks like. Classes and tokens are the
 * 19 November build's — `brand-*` and the same rounded/outline language as
 * `.btn-primary`, never a new palette.
 */
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  NEW_VERSION_BAR_ID,
  NEW_VERSION_MESSAGE,
  startVersionWatch,
} from "../../domain/appVersion";

export function NewVersionBar() {
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const watch = startVersionWatch({ onNewVersion: () => setReady(true) });
    return watch.stop;
  }, []);

  if (!ready || dismissed) return null;

  return (
    <div
      id={NEW_VERSION_BAR_ID}
      role="status"
      aria-live="polite"
      className="flex shrink-0 flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-brand-200 bg-brand-50 px-3 py-1 text-[12px] font-medium text-brand-900 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-100"
    >
      <span>{NEW_VERSION_MESSAGE} —</span>{" "}
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex min-h-10 items-center justify-center rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        Reload
      </button>
      <button
        type="button"
        aria-label="Dismiss the new version notice"
        onClick={() => setDismissed(true)}
        className="inline-flex min-h-10 w-10 items-center justify-center rounded-lg text-brand-700 transition-colors hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:text-brand-200 dark:hover:bg-brand-900"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
