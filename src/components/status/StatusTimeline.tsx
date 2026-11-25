/**
 * StatusTimeline — the record of every status change, on the encounter and on
 * the claim.
 *
 * Inspiration: Epic's "Encounter Activity" list and athenahealth's claim status
 * history — one row per change, newest last, naming the state it moved from and
 * to, who did it, which role they were in and why, in one plain sentence.
 *
 * Read-only by design: there is no control here that edits or deletes a row,
 * because the timeline is the student's audit trail (`status-engine.md` §9).
 * Ordering comes from each entry's `seq`, never from its timestamp.
 */

import { History } from "lucide-react";
import {
  CLAIM_STATUS_LABELS,
  CLAIM_STATUS_TONE,
  ENCOUNTER_STATUS_LABELS,
  JOB_ROLE_LABELS,
  REASON_CODE_LABELS,
  type StatusTone,
} from "../../domain/claimStatus";
import type { Status, StatusEvent } from "../../domain/statusEvent";
import { actorLabel } from "../../utils/actorLabel";

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-slate-100 text-slate-600",
  info: "bg-brand-50 text-brand-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
};

function statusLabel(status: Status): string {
  return (
    CLAIM_STATUS_LABELS[status as keyof typeof CLAIM_STATUS_LABELS] ??
    ENCOUNTER_STATUS_LABELS[status as keyof typeof ENCOUNTER_STATUS_LABELS] ??
    String(status)
  );
}

function toneFor(status: Status, event: StatusEvent): StatusTone {
  if (event.entityType === "claim") {
    return CLAIM_STATUS_TONE[status as keyof typeof CLAIM_STATUS_TONE] ?? "neutral";
  }
  return status === "open" ? "neutral" : "info";
}

function timeOf(at: string): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return at;
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export interface StatusTimelineProps {
  events: StatusEvent[];
  title?: string;
  /** Shown beside the title, e.g. the claim number the entries belong to. */
  subject?: string | null;
  /** What to say when nothing has happened yet. */
  emptyHint?: string;
  className?: string;
}

export function StatusTimeline({
  events,
  title = "Status timeline",
  subject,
  emptyHint = "No status change has been recorded yet.",
  className = "",
}: StatusTimelineProps) {
  // Sequence numbers are per entity (the visit and its claim count separately),
  // so a feed that mixes both sorts by time, with seq breaking a tie.
  const ordered = [...events].sort((a, b) => (a.at === b.at ? a.seq - b.seq : a.at < b.at ? -1 : 1));

  return (
    <section className={`rounded-xl border border-slate-200 bg-white ${className}`}>
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
        <History className="h-3.5 w-3.5 text-slate-400" />
        <h4 className="text-[11px] font-semibold text-slate-500">{title}</h4>
        {subject && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-600">
            {subject}
          </span>
        )}
        <span className="ml-auto text-xs text-slate-400">
          {ordered.length} {ordered.length === 1 ? "change" : "changes"} · append-only
        </span>
      </header>

      {ordered.length === 0 ? (
        <p className="px-3 py-2 text-xs italic text-slate-400">{emptyHint}</p>
      ) : (
        <ol className="divide-y divide-slate-50">
          {ordered.map((event) => (
            <li key={event.id} className="flex items-start gap-2 px-3 py-1.5">
              <span className="mt-0.5 w-5 shrink-0 text-right font-mono text-xs text-slate-300">
                {event.seq}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  {event.from && (
                    <>
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${TONE_CLASSES.neutral}`}>
                        {statusLabel(event.from)}
                      </span>
                      <span className="text-slate-300">→</span>
                    </>
                  )}
                  <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${TONE_CLASSES[toneFor(event.to, event)]}`}>
                    {statusLabel(event.to)}
                  </span>
                  <span className="text-xs font-medium text-slate-500">
                    {REASON_CODE_LABELS[event.reasonCode] ?? event.reasonCode}
                  </span>
                </p>
                <p className="mt-0.5 text-xs leading-snug text-slate-600">{event.reason}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {timeOf(event.at)} · {JOB_ROLE_LABELS[event.jobRole] ?? event.jobRole}
                  {` · ${actorLabel(event.by)}`}
                  {event.claimNumber ? ` · ${event.claimNumber}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
