/**
 * ADTStream — Simulated Hospital ADT Event Stream
 *
 * Scrolling feed of mock ADT events: Admit, Discharge, Transfer, Registration.
 * Auto-scrolls every 3 seconds. Pause/Resume toggle.
 */

import { useState, useEffect, useRef } from "react";
import { Bell, Play, Pause, X } from "lucide-react";

const EVENTS = [
  { type: "A01", label: "Admit", patient: "Jane Doe", mrn: "MRN-1001", location: "3 North — Room 302", time: "14:32" },
  { type: "A04", label: "Registration", patient: "John Smith", mrn: "MRN-1002", location: "ED Registration", time: "14:28" },
  { type: "A03", label: "Discharge", patient: "Bob Wilson", mrn: "MRN-1003", location: "2 West — Discharged", time: "14:15" },
  { type: "A02", label: "Transfer", patient: "Sarah Lee", mrn: "MRN-1004", location: "ICU → 4 South", time: "14:10" },
  { type: "A08", label: "Update", patient: "Tom Brown", mrn: "MRN-1005", location: "5 East — Observation", time: "13:55" },
  { type: "A01", label: "Admit", patient: "Maria Garcia", mrn: "MRN-1006", location: "3 North — Room 305", time: "13:40" },
  { type: "A03", label: "Discharge", patient: "David Kim", mrn: "MRN-1007", location: "ED — Home", time: "13:30" },
  { type: "A02", label: "Transfer", patient: "Lisa Chen", mrn: "MRN-1008", location: "4 South → Rehab", time: "13:20" },
];

const typeColor = (t: string) => t === "A01" ? "bg-green-100 text-green-700" : t === "A03" ? "bg-blue-100 text-blue-700" : t === "A02" ? "bg-amber-100 text-amber-700" : t === "A04" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-700";

export function ADTStream() {
  const [showPanel, setShowPanel] = useState(false);
  const [paused, setPaused] = useState(false);
  const [idx, setIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!paused && showPanel) {
      timerRef.current = setInterval(() => setIdx(i => (i + 1) % EVENTS.length), 3000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [paused, showPanel]);

  const visible = [...EVENTS.slice(idx), ...EVENTS.slice(0, idx)];

  return (
    <div className="relative">
      <button onClick={() => setShowPanel(!showPanel)} className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1.5 text-[10px] font-medium text-green-600 hover:bg-green-100"><Bell className="h-3.5 w-3.5" /> ADT Stream</button>
      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/20" onClick={() => setShowPanel(false)}>
          <div className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl p-5 animate-slide-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><div><h3 className="text-sm font-bold text-slate-800">ADT Event Stream</h3><p className="text-[9px] text-slate-400">HL7 v2 ADT feed</p></div><div className="flex gap-1"><button onClick={() => setPaused(!paused)} className="rounded-lg border px-2 py-1 text-[10px]">{paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}</button><button onClick={() => setShowPanel(false)} className="text-slate-400"><X className="h-4 w-4" /></button></div></div>
            <div className="space-y-1">
              {visible.map((e, i) => (
                <div key={`${e.mrn}-${i}`} className="rounded-lg border border-slate-200 p-2.5 animate-slide-in">
                  <div className="flex items-center justify-between mb-0.5"><span className={`rounded px-1.5 py-0.5 text-[8px] font-bold ${typeColor(e.type)}`}>{e.type} — {e.label}</span><span className="text-[9px] text-slate-400">{e.time}</span></div>
                  <p className="text-[10px] font-semibold text-slate-700">{e.patient}</p>
                  <p className="text-[9px] text-slate-500">{e.mrn} | {e.location}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
