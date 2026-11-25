/**
 * LiveTracker — the encounter's road to "paid and closed", lit up as the
 * student works, with the money beside it.
 *
 * Under the stage stepper: the stepper says which desk you are at; this strip
 * says what has actually happened to the visit and its claim — and when. A
 * milestone the student just reached pulses once, and a money figure that just
 * changed counts to its new value, so the effect of every action is visible
 * the moment it lands. "Activity" opens the full feed of what happened and why.
 */

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, History } from "lucide-react";
import { MILESTONE_NEXT_STEP, type LiveMoney, type Milestone } from "../../domain/liveTracker";

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const time = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";

/**
 * A dollar figure that briefly highlights when it changes, so a posting's
 * effect is visible the moment it lands. Plain CSS (no animation library):
 * light on low-end phones, and the motion-reduce variant drops the transition.
 */
function Money({ cents, label, tone = "text-slate-900" }: { cents: number | null; label: string; tone?: string }) {
  const [flash, setFlash] = useState(false);
  const prev = useRef(cents);
  useEffect(() => {
    if (prev.current === cents) return;
    prev.current = cents;
    if (cents === null) return;
    setFlash(true);
    const t = window.setTimeout(() => setFlash(false), 1400);
    return () => window.clearTimeout(t);
  }, [cents]);
  return (
    <div className={`rounded-lg px-2 py-1 transition-colors duration-700 motion-reduce:transition-none ${flash ? "bg-amber-100" : "bg-transparent"}`}>
      <dt className="text-[11px] text-slate-500">{label}</dt>
      <dd className={`text-[13px] font-bold tabular-nums ${tone}`}>{cents === null ? "—" : usd(cents)}</dd>
    </div>
  );
}

export function LiveTracker({
  milestones,
  money,
  onOpenActivity,
  activityCount,
  referenceChart = false,
}: {
  /** The read-only Tutorial Patient: the hint points through the chart, not at work. */
  referenceChart?: boolean;
  milestones: Milestone[];
  money: LiveMoney;
  onOpenActivity: () => void;
  activityCount: number;
}) {
  // Pulse a milestone the moment it is reached — not on first render.
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  useEffect(() => {
    const done = new Set(milestones.filter((m) => m.state === "done").map((m) => m.id));
    if (seen.current) {
      const added = [...done].find((id) => !seen.current!.has(id));
      if (added) {
        setFresh(added);
        const t = window.setTimeout(() => setFresh(null), 1600);
        seen.current = done;
        return () => window.clearTimeout(t);
      }
    }
    seen.current = done;
  }, [milestones]);

  const current = milestones.find((m) => m.state === "current" || m.state === "problem");

  return (
    <section
      aria-label="Live status of this visit and its claim"
      className="border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900"
    >
      <ol className="flex items-center gap-1 overflow-x-auto pb-1" aria-label="Milestones">
        {milestones.map((m, i) => {
          const isFresh = fresh === m.id;
          return (
            <li key={m.id} className="flex shrink-0 items-center gap-1">
              <span
                title={m.note ?? (m.at ? `${m.label} · ${time(m.at)}` : m.label)}
                className={`inline-flex min-h-7 items-center gap-1 whitespace-nowrap rounded-full px-2 text-[12px] font-medium ${
                  m.state === "done"
                    ? "bg-green-50 text-green-800 ring-1 ring-green-200"
                    : m.state === "problem"
                      ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                      : m.state === "current"
                        ? "bg-brand-50 text-brand-800 ring-2 ring-brand-300"
                        : "text-slate-400 ring-1 ring-slate-200"
                } transition-transform duration-500 motion-reduce:transition-none ${isFresh ? "scale-110 ring-2 ring-green-400" : "scale-100"}`}
              >
                {m.state === "done" && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                {m.state === "problem" && <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
                {m.label}
                {m.at && m.state !== "todo" && <span className="font-normal text-slate-500">{time(m.at)}</span>}
                <span className="sr-only">
                  {m.state === "done" ? " — done" : m.state === "current" ? " — next" : m.state === "problem" ? ` — problem: ${m.note}` : " — not yet"}
                </span>
              </span>
              {i < milestones.length - 1 && <span className="h-px w-2 bg-slate-200" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>

      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
        {referenceChart ? (
          <p className="min-w-[16rem] flex-1 text-[13px] text-slate-600">
            <span className="font-semibold text-slate-800">Reference chart: </span>
            press Continue to see each finished stage. Book your own patient to do these steps yourself.
          </p>
        ) : current ? (
          <p className={`min-w-[16rem] flex-1 text-[13px] ${current.state === "problem" ? "text-red-700" : "text-slate-600"}`}>
            {current.state === "problem" ? (
              current.note
            ) : (
              <>
                <span className="font-semibold text-slate-800">Next: </span>
                {MILESTONE_NEXT_STEP[current.id]}
              </>
            )}
          </p>
        ) : (
          <p className="min-w-[16rem] flex-1 text-[13px] font-semibold text-green-700">Paid and closed — this visit is done.</p>
        )}

        <dl className="flex shrink-0 flex-wrap items-center gap-1" aria-label="Money on this claim">
          <Money label="Billed" cents={money.billedCents || null} />
          <Money label="Allowed" cents={money.allowedCents} />
          <Money label="Paid" cents={money.paidCents} tone="text-green-700" />
          <Money label="Adjusted" cents={money.adjustedCents} tone="text-slate-600" />
          {money.deniedCents > 0 && <Money label="Denied (in AR)" cents={money.deniedCents} tone="text-red-700" />}
          <Money label="Patient owes" cents={money.patientOwesCents} tone="text-brand-900" />
        </dl>

        <button
          type="button"
          onClick={onOpenActivity}
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          <History className="h-4 w-4" aria-hidden="true" />
          Activity
          <span className="rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold tabular-nums">{activityCount}</span>
        </button>
      </div>
    </section>
  );
}
