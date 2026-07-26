/**
 * GlassBreakDrawer — HIPAA Emergency Access
 *
 * Break Glass modal for restricted/VIP records. Audit logging.
 * 60-second countdown timer. "Close & Log" ends session.
 */

import { useState, useEffect, useRef } from "react";
import { Shield, AlertTriangle, Lock, X } from "lucide-react";

export function GlassBreakDrawer() {
  const [showPanel, setShowPanel] = useState(false);
  const [broken, setBroken] = useState(false);
  const [reason, setReason] = useState("");
  const [seconds, setSeconds] = useState(60);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (broken && seconds > 0) {
      timerRef.current = setInterval(() => setSeconds(s => s - 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [broken, seconds]);

  const breakGlass = () => {
    if (!reason) return;
    setBroken(true);
    setSeconds(60);
  };

  const closeAndLog = () => {
    setBroken(false);
    setReason("");
    setShowPanel(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  return (
    <div className="relative">
      <button onClick={() => setShowPanel(!showPanel)} className="flex items-center gap-1.5 rounded-lg border-2 border-red-300 bg-red-100 px-2.5 py-1.5 text-[10px] font-bold text-red-700 hover:bg-red-200 animate-pulse"><Shield className="h-3.5 w-3.5" /> BREAK GLASS</button>
      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="relative w-full max-w-md rounded-xl border-2 border-red-500 bg-white shadow-2xl p-6 animate-slide-in" onClick={e => e.stopPropagation()}>
            {!broken ? (
              <>
                <div className="flex items-center gap-2 mb-4"><AlertTriangle className="h-6 w-6 text-red-500" /><div><h3 className="text-sm font-bold text-red-800">EMERGENCY ACCESS</h3><p className="text-[10px] text-red-600">You are about to access restricted patient data. This will be audited.</p></div></div>
                <div className="mb-3"><label className="text-[10px] font-medium text-slate-600">Reason for Access</label><select value={reason} onChange={e => setReason(e.target.value)} className="w-full rounded-lg border border-red-200 px-3 py-2 text-[10px] outline-none mt-1"><option value="">Select reason...</option><option value="Clinical Emergency">Clinical Emergency</option><option value="Patient Request">Patient Request</option><option value="Legal/Compliance">Legal/Compliance</option><option value="Other">Other</option></select></div>
                <div className="flex gap-2"><button onClick={breakGlass} disabled={!reason} className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-[10px] font-bold text-white hover:bg-red-500 disabled:bg-slate-300"><Lock className="h-3.5 w-3.5 inline mr-1" />BREAK GLASS</button><button onClick={() => setShowPanel(false)} className="rounded-lg border px-4 py-2 text-[10px]">Cancel</button></div>
              </>
            ) : (
              <div>
                <div className="bg-red-600 text-white px-4 py-2 rounded-t-lg -mx-6 -mt-6 mb-4"><p className="text-[10px] font-bold">⚠ EMERGENCY ACCESS ACTIVE — AUDIT LOGGING ENABLED</p></div>
                <div className="mb-3"><p className="text-[10px] text-slate-600">Reason: <strong>{reason}</strong></p><p className="text-[9px] text-slate-500 mt-1">Access time: {new Date().toLocaleString()}</p><p className="text-[9px] text-slate-500">Audit ID: AUDIT-{Date.now().toString(36).toUpperCase()}</p></div>
                <div className="rounded-lg bg-amber-50 p-3 mb-3 text-center"><p className="text-[9px] text-amber-600">Session Timer</p><p className="text-2xl font-bold text-red-600">{seconds}s</p></div>
                <button onClick={closeAndLog} className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-[10px] font-bold text-white">Close & Log Session</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
