/**
 * PASLATimer — CMS Prior Auth SLA Countdown Timer
 *
 * CMS-0057-F compliant: 72-hour (urgent) / 7-day (standard) countdown.
 * Shows colored badges next to each PA item in the PriorAuthPortal.
 * Export getSLAStatus() for use in other components.
 */

import { useState, useEffect } from "react";
import { Clock, AlertTriangle, CheckCircle2, Timer, X } from "lucide-react";

// ─── SLA Logic ──────────────────────────────────────────────────────

const URGENT_HOURS = 72;
const STANDARD_HOURS = 168; // 7 days

interface SLAItem {
  id: string;
  label: string;
  createdAt: Date;
  isUrgent: boolean;
}

export function getSLAStatus(createdAt: string, isUrgent: boolean): {
  hoursRemaining: number;
  isBreached: boolean;
  display: string;
  urgency: "urgent" | "standard";
} {
  const now = new Date();
  const created = new Date(createdAt);
  const limitHours = isUrgent ? URGENT_HOURS : STANDARD_HOURS;
  const limitMs = limitHours * 60 * 60 * 1000;
  const remainingMs = limitMs - (now.getTime() - created.getTime());
  const hoursRemaining = remainingMs / (1000 * 60 * 60);
  const isBreached = hoursRemaining <= 0;

  let display: string;
  if (isBreached) {
    display = "SLA BREACHED";
  } else if (hoursRemaining < 1) {
    display = `${Math.ceil(hoursRemaining * 60)}m remaining`;
  } else if (hoursRemaining < 24) {
    display = `${Math.floor(hoursRemaining)}h ${Math.floor((hoursRemaining % 1) * 60)}m remaining`;
  } else {
    const days = Math.floor(hoursRemaining / 24);
    const hrs = Math.floor(hoursRemaining % 24);
    display = `${days}d ${hrs}h remaining`;
  }

  return {
    hoursRemaining,
    isBreached,
    display,
    urgency: isUrgent ? "urgent" : "standard",
  };
}

// ─── Component ──────────────────────────────────────────────────────

const MOCK_ITEMS: SLAItem[] = [
  { id: "pa-1", label: "Knee Replacement (TKA)", createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000), isUrgent: true },
  { id: "pa-2", label: "MRI Lumbar Spine", createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), isUrgent: false },
  { id: "pa-3", label: "Biopsy — Breast", createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), isUrgent: false },
  { id: "pa-4", label: "Cardiac Cath", createdAt: new Date(Date.now() - 10 * 60 * 60 * 1000), isUrgent: true },
];

export function PASLATimer() {
  const [items, setItems] = useState<SLAItem[]>(MOCK_ITEMS);
  const [showPanel, setShowPanel] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-[10px] font-medium text-orange-600 hover:bg-orange-100 transition-colors"
      >
        <Timer className="h-3.5 w-3.5" />
        PA SLA Timer
      </button>

      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/20" onClick={() => setShowPanel(false)}>
          <div className="relative w-full max-w-md max-h-[80vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl p-5 animate-slide-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Prior Auth SLA Timer</h3>
                <p className="text-[9px] text-slate-400">CMS-0057-F: 72h urgent / 7d standard</p>
              </div>
              <button onClick={() => setShowPanel(false)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-2">
              {items.map((item) => {
                const status = getSLAStatus(item.createdAt.toISOString(), item.isUrgent);
                const badgeColor = status.isBreached
                  ? "border-red-300 bg-red-50"
                  : status.hoursRemaining < 24
                  ? "border-amber-300 bg-amber-50"
                  : "border-green-300 bg-green-50";

                return (
                  <div key={item.id} className={`rounded-lg border p-3 ${badgeColor}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {status.isBreached ? (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        ) : (
                          <Clock className="h-4 w-4 text-slate-500" />
                        )}
                        <div>
                          <p className="text-[10px] font-semibold text-slate-700">{item.label}</p>
                          <p className="text-[9px] text-slate-500">
                            {item.isUrgent ? "🔴 Urgent (72h)" : "🔵 Standard (7d)"}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                          status.isBreached
                            ? "bg-red-600 text-white"
                            : status.hoursRemaining < 24
                            ? "bg-amber-500 text-white"
                            : "bg-green-500 text-white"
                        }`}
                      >
                        {status.display}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 rounded-lg bg-slate-50 p-3">
              <p className="text-[9px] font-medium text-slate-600">SLA Compliance Summary</p>
              <div className="mt-1 flex gap-3 text-[9px]">
                <span className="text-green-600">✅ {items.filter(i => !getSLAStatus(i.createdAt.toISOString(), i.isUrgent).isBreached && getSLAStatus(i.createdAt.toISOString(), i.isUrgent).hoursRemaining >= 24).length} On Track</span>
                <span className="text-amber-600">⚠ {items.filter(i => !getSLAStatus(i.createdAt.toISOString(), i.isUrgent).isBreached && getSLAStatus(i.createdAt.toISOString(), i.isUrgent).hoursRemaining < 24).length} Due Soon</span>
                <span className="text-red-600">🚫 {items.filter(i => getSLAStatus(i.createdAt.toISOString(), i.isUrgent).isBreached).length} Breached</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
