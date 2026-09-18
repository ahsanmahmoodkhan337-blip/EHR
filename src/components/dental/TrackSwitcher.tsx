/**
 * TrackSwitcher — Medical | Dental RCM track toggle
 *
 * Inspired by: EHR practice-management suites that separate medical billing
 * from dental billing because the code sets (CPT/ICD-10 vs CDT), claim forms
 * (CMS-1500 vs ADA J430D) and benefit logic have no overlap. Owner direction:
 * the dental track must be separate and independently accessible — and the
 * switch between tracks must be immediately obvious in the header.
 *
 * Switching tracks does NOT touch the other track's state — the providers are
 * separate, and each reads/writes its own persisted store.
 */

import type { ReactNode } from "react";
import { Stethoscope, Smile } from "lucide-react";

export type RcmTrack = "medical" | "dental";

interface TrackSwitcherProps {
  track: RcmTrack;
  onTrackChange: (track: RcmTrack) => void;
  /** Render as a compact strip (header row) rather than a full-width segmented card. */
  compact?: boolean;
}

export function TrackSwitcher({ track, onTrackChange, compact }: TrackSwitcherProps) {
  const options: {
    id: RcmTrack;
    label: string;
    icon: ReactNode;
    hint: string;
    activeClass: string;
  }[] = [
    {
      id: "medical",
      label: "Medical",
      icon: <Stethoscope className="h-4 w-4" />,
      hint: "CPT / ICD-10 · CMS-1500",
      activeClass: "bg-blue-600 text-white shadow-sm",
    },
    {
      id: "dental",
      label: "Dental",
      icon: <Smile className="h-4 w-4" />,
      hint: "CDT · ADA J430D",
      activeClass: "bg-emerald-600 text-white shadow-sm",
    },
  ];

  return (
    <div
      className={`flex items-center gap-1 rounded-xl border border-slate-300 bg-white p-1 shadow-md ${
        compact ? "w-fit" : "w-full"
      }`}
      role="tablist"
      aria-label="RCM track"
    >
      {options.map((opt) => {
        const active = track === opt.id;
        return (
          <button
            key={opt.id}
            role="tab"
            aria-selected={active}
            onClick={() => onTrackChange(opt.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors sm:px-4 sm:text-sm ${
              active ? opt.activeClass : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            }`}
          >
            {opt.icon}
            {opt.label}
            {!compact && <span className="hidden font-medium opacity-80 md:inline">{opt.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}
