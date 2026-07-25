/**
 * CrossoverClaims — Secondary/Crossover COB Claim Generator
 *
 * Primary → Secondary claim routing with coordination of benefits.
 */

import { useState } from "react";
import { ArrowRight, FileText, Printer, X } from "lucide-react";

const SECONDARY_PAYERS = ["Medicaid (after Medicare)", "Spouse BCBS", "VA Benefits"];

export function CrossoverClaims() {
  const [showPanel, setShowPanel] = useState(false);
  const [secondary, setSecondary] = useState("");
  const [routed, setRouted] = useState(false);

  const primary = { paid: 100, allowed: 150, pr: 50 };
  const secondaryPays = secondary === "Medicaid (after Medicare)" ? 40 : 25;
  const finalPR = primary.pr - secondaryPays;

  return (
    <div className="relative">
      <button onClick={() => setShowPanel(!showPanel)} className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[10px] font-medium text-blue-600 hover:bg-blue-100"><ArrowRight className="h-3.5 w-3.5" /> COB Claims</button>
      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/20" onClick={() => setShowPanel(false)}>
          <div className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl p-5 animate-slide-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><div><h3 className="text-sm font-bold text-slate-800">Crossover/COB Claims</h3></div><button onClick={() => setShowPanel(false)} className="text-slate-400"><X className="h-4 w-4" /></button></div>
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 mb-3">
              <p className="text-[10px] font-semibold text-green-700 mb-1">Primary Claim (BCBS)</p>
              <div className="grid grid-cols-2 text-[9px]"><span>Allowed:</span><span>${primary.allowed}</span><span>Paid:</span><span className="text-green-600">${primary.paid}</span><span>Patient Due:</span><span className="text-red-600">${primary.pr}</span></div>
            </div>
            <div className="mb-3"><label className="text-[10px] font-medium text-slate-500">Route to Secondary Payer</label><select value={secondary} onChange={e => setSecondary(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-[10px] outline-none mt-1"><option value="">Select secondary payer...</option>{SECONDARY_PAYERS.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
            {secondary && !routed && <button onClick={() => setRouted(true)} className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-[10px] font-medium text-white"><ArrowRight className="h-3.5 w-3.5 inline mr-1" />Route to Secondary</button>}
            {routed && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 mt-3">
                <p className="text-[10px] font-semibold text-blue-700 mb-1">Crossover Summary</p>
                <div className="grid grid-cols-2 text-[9px]"><span>Primary Paid:</span><span>${primary.paid}</span><span>Balance to Secondary:</span><span>${primary.pr}</span><span>Secondary ({secondary.slice(0,8)}):</span><span className="text-green-600">${secondaryPays}</span><span className="font-bold">Final Patient Due:</span><span className="font-bold text-red-600">${finalPR}</span></div>
                <button className="mt-2 rounded-lg border px-3 py-1 text-[9px]"><Printer className="h-3 w-3 inline mr-1" />Print COB</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
