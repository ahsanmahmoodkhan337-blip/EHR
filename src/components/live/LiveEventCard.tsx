/**
 * LiveEventCard — "what just happened, and why", the moment it happens.
 *
 * Every status change the student causes (note signed, claim sent, 277CA,
 * 835 received, posting, appeal, write-off) is already recorded with one
 * plain-English sentence saying what moved and why. This card shows the
 * newest one for a few seconds after it lands, so the student sees the
 * consequence of a click without hunting for it. It never shows on first load —
 * only for events that arrive while the student is watching.
 */

import { useEffect, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import type { StatusEvent } from "../../domain/statusEvent";
import { REASON_CODE_LABELS } from "../../domain/claimStatus";

const usd = (cents: number) => `$${(Math.abs(cents) / 100).toFixed(2)}`;

export function LiveEventCard({
  events,
  scopeKey,
  onOpenActivity,
}: {
  events: StatusEvent[];
  /** The patient/encounter the events belong to — switching patients resets what counts as new. */
  scopeKey: string;
  onOpenActivity: () => void;
}) {
  const seen = useRef<{ scope: string; ids: Set<string> } | null>(null);
  const [shown, setShown] = useState<StatusEvent | null>(null);

  useEffect(() => {
    const ids = new Set(events.map((e) => e.id));
    if (!seen.current || seen.current.scope !== scopeKey) {
      seen.current = { scope: scopeKey, ids };
      setShown(null);
      return;
    }
    const added = events.filter((e) => !seen.current!.ids.has(e.id)).sort((a, b) => a.seq - b.seq);
    seen.current = { scope: scopeKey, ids };
    if (added.length > 0) setShown(added[added.length - 1]);
  }, [events, scopeKey]);

  useEffect(() => {
    if (!shown) return;
    const t = window.setTimeout(() => setShown(null), 9000);
    return () => window.clearTimeout(t);
  }, [shown]);

  return (
    // Bottom-left on desktop (over the inbox, away from the stage's Continue
    // button and the toasts on the right); top of the screen on phones.
    <div
      className="pointer-events-none fixed inset-x-3 top-20 z-40 sm:inset-x-auto sm:left-3 sm:top-auto sm:bottom-16 sm:w-[17rem]"
      aria-live="polite"
    >
        {shown && (
          <div
            key={shown.id}
            className="live-event-card pointer-events-auto rounded-2xl bg-white p-4 shadow-[0_20px_50px_-20px_rgba(25,33,102,0.45)] ring-1 ring-slate-200"
            role="status"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium text-slate-500">What just happened</p>
                <p className="text-[15px] font-bold text-slate-900">
                  {REASON_CODE_LABELS[shown.reasonCode] ?? shown.reasonCode}
                  {typeof shown.amountCents === "number" && shown.amountCents !== 0 && (
                    <span className="ml-1.5 font-semibold text-slate-600">{usd(shown.amountCents)}</span>
                  )}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{shown.reason}</p>
                <button
                  type="button"
                  onClick={() => {
                    setShown(null);
                    onOpenActivity();
                  }}
                  className="mt-2 text-[13px] font-semibold text-brand-700 hover:underline"
                >
                  See all activity
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShown(null)}
                aria-label="Dismiss"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
    </div>
  );
}
