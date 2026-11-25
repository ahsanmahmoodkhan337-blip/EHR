/**
 * ActivityDrawer — every status change on this visit and its claim, newest
 * first, with the sentence that says why. Opens from the live tracker's
 * Activity button and from "See all activity" on the event card, so the feed is
 * one click away at every stage and on phones (where the side panel is hidden).
 */

import { useEffect } from "react";
import { X } from "lucide-react";
import type { StatusEvent } from "../../domain/statusEvent";
import { StatusTimeline } from "../status/StatusTimeline";

export function ActivityDrawer({
  open,
  onClose,
  events,
  subject,
}: {
  open: boolean;
  onClose: () => void;
  events: StatusEvent[];
  subject?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Activity on this visit"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-[min(100vw,28rem)] flex-col bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Activity</h2>
            <p className="text-[13px] text-slate-500">Everything that happened on this visit, and why.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close activity"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <StatusTimeline
            events={events}
            title="Visit and claim timeline"
            subject={subject}
            emptyHint="Nothing has happened yet. Sign and lock the note to record the first step."
          />
        </div>
      </aside>
    </div>
  );
}
