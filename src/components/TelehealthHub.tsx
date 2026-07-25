/**
 * TelehealthHub — Virtual Visit & RPM Dashboard
 *
 * Simulated wearable telemetry: CGM, BP Cuff, Scale, Pulse Ox.
 * Values update every 3 seconds. Session timer.
 */

import { useState, useEffect, useRef } from "react";
import { Video, Activity, Heart, Weight, Droplets, Phone, X } from "lucide-react";

const DEVICES = [
  { name: "CGM", icon: <Activity className="h-4 w-4" />, unit: "mg/dL", values: [120, 118, 115, 112, 110], trend: "↓ Improving" },
  { name: "BP Cuff", icon: <Heart className="h-4 w-4" />, unit: "mmHg", values: ["135/85", "132/82", "128/80", "126/78", "124/76"], trend: "↓ Improving" },
  { name: "Smart Scale", icon: <Weight className="h-4 w-4" />, unit: "lbs", values: [198, 197.5, 197, 196.8, 196.5], trend: "→ Stable" },
  { name: "Pulse Ox", icon: <Droplets className="h-4 w-4" />, unit: "%", values: [98, 97, 98, 97, 98], trend: "→ Stable" },
];

export function TelehealthHub() {
  const [showPanel, setShowPanel] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [valueIdx, setValueIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (sessionActive) {
      timerRef.current = setInterval(() => { setSeconds(s => s + 1); setValueIdx(v => (v + 1) % DEVICES[0].values.length); }, 3000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [sessionActive]);

  const formatTime = (s: number) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  return (
    <div className="relative">
      <button onClick={() => setShowPanel(!showPanel)} className="flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-[10px] font-medium text-teal-600 hover:bg-teal-100"><Video className="h-3.5 w-3.5" /> Telehealth</button>
      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/20" onClick={() => setShowPanel(false)}>
          <div className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl p-5 animate-slide-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><div><h3 className="text-sm font-bold text-slate-800">Telehealth & RPM Hub</h3><p className="text-[9px] text-slate-400">Remote patient monitoring</p></div><button onClick={() => setShowPanel(false)} className="text-slate-400"><X className="h-4 w-4" /></button></div>

            {sessionActive && <div className="rounded-lg bg-teal-50 p-2 mb-3 text-center text-xs font-mono font-bold text-teal-700">Session: {formatTime(seconds)}</div>}

            <div className="space-y-2 mb-3">
              {DEVICES.map(d => {
                const val = d.values[valueIdx];
                return (
                  <div key={d.name} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between"><div className="flex items-center gap-2">{d.icon}<span className="text-[10px] font-semibold text-slate-700">{d.name}</span></div><span className="text-sm font-bold text-slate-800">{val} {d.unit}</span></div>
                    <p className="text-[9px] text-slate-400 mt-0.5">{d.trend}</p>
                  </div>
                );
              })}
            </div>

            {!sessionActive ? (
              <button onClick={() => setSessionActive(true)} className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-[10px] font-medium text-white"><Phone className="h-3.5 w-3.5 inline mr-1" />Start Telehealth Session</button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => { setSessionActive(false); setSeconds(0); }} className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-[10px] font-medium text-white">End Session</button>
                <button className="rounded-lg border px-4 py-2.5 text-[10px]">Add to Chart</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
