/**
 * FWADetector — Fraud, Waste & Abuse Audit Panel
 *
 * Flags: impossible hours, code spikes, unbundling pairs.
 * Color-coded findings with Investigate/Dismiss actions.
 */

import { useState } from "react";
import { Shield, AlertTriangle, CheckCircle2, X, Eye, Trash2 } from "lucide-react";

interface Finding {
  id: string;
  provider: string;
  type: "Critical" | "Suspicious" | "Clean";
  description: string;
  dismissed: boolean;
}

const MOCK_FINDINGS: Finding[] = [
  { id: "F-001", provider: "Dr. Smith", type: "Critical", description: "Impossible hours: 28h of 99214 billed on 07/22/2026", dismissed: false },
  { id: "F-002", provider: "Dr. Jones", type: "Suspicious", description: "E/M 99215 rate: 62% (avg practice: 18%) — code spike detected", dismissed: false },
  { id: "F-003", provider: "Dr. Lee", type: "Suspicious", description: "Unbundling: 99213 + 93005 reported together without modifier 25", dismissed: false },
  { id: "F-004", provider: "Dr. Chen", type: "Clean", description: "Billing patterns within normal range", dismissed: false },
  { id: "F-005", provider: "Dr. Smith", type: "Suspicious", description: "Duplicate claim: CLAIM-001 submitted twice on 07/21/2026", dismissed: false },
];

export function FWADetector() {
  const [showPanel, setShowPanel] = useState(false);
  const [findings, setFindings] = useState(MOCK_FINDINGS);

  const dismiss = (id: string) => setFindings(f => f.map(x => x.id === id ? { ...x, dismissed: true } : x));

  const active = findings.filter(f => !f.dismissed);
  const critical = active.filter(f => f.type === "Critical").length;
  const suspicious = active.filter(f => f.type === "Suspicious").length;
  const clean = active.filter(f => f.type === "Clean").length;

  const typeColor = (t: string) => t === "Critical" ? "border-red-200 bg-red-50" : t === "Suspicious" ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50";

  return (
    <div className="relative">
      <button onClick={() => setShowPanel(!showPanel)} className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[10px] font-medium text-red-600 hover:bg-red-100">
        <Shield className="h-3.5 w-3.5" /> FWA ({active.length})
      </button>
      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/20" onClick={() => setShowPanel(false)}>
          <div className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl p-5 animate-slide-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div><h3 className="text-sm font-bold text-slate-800">FWA Detection Panel</h3><p className="text-[9px] text-slate-400">Fraud, Waste & Abuse Audit</p></div>
              <button onClick={() => setShowPanel(false)} className="text-slate-400"><X className="h-4 w-4" /></button>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="rounded-lg border border-green-200 bg-green-50 p-2 text-center"><p className="text-[8px] text-green-600">Clean</p><p className="text-lg font-bold text-green-700">{clean}</p></div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-center"><p className="text-[8px] text-amber-600">Flagged</p><p className="text-lg font-bold text-amber-700">{suspicious}</p></div>
              <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-center"><p className="text-[8px] text-red-600">Critical</p><p className="text-lg font-bold text-red-700">{critical}</p></div>
            </div>

            <div className="space-y-2">
              {active.map(f => (
                <div key={f.id} className={`rounded-lg border p-3 ${typeColor(f.type)}`}>
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-start gap-1.5">
                      {f.type === "Critical" ? <AlertTriangle className="mt-0.5 h-4 w-4 text-red-500" /> : f.type === "Suspicious" ? <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-500" />}
                      <div>
                        <span className={`rounded px-1.5 py-0.5 text-[8px] font-bold ${f.type === "Critical" ? "bg-red-200 text-red-700" : f.type === "Suspicious" ? "bg-amber-200 text-amber-700" : "bg-green-200 text-green-700"}`}>{f.type}</span>
                        <span className="ml-1 text-[9px] font-medium text-slate-600">{f.provider}</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[9px] text-slate-600">{f.description}</p>
                  <div className="mt-2 flex gap-1.5">
                    <button className="rounded bg-blue-600 px-2 py-1 text-[8px] font-medium text-white"><Eye className="h-3 w-3 inline mr-1" />Investigate</button>
                    <button onClick={() => dismiss(f.id)} className="rounded border px-2 py-1 text-[8px]"><Trash2 className="h-3 w-3 inline mr-1" />Dismiss</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
