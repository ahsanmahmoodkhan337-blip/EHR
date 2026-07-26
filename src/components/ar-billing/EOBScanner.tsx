/**
 * EOBScanner — Simulated EOB Upload & Parsing
 *
 * Mock PDF upload → parsed EOB data. Post to Ledger button.
 * Sample EOB pre-loaded button.
 */

import { useState } from "react";
import { FileText, Upload, CheckCircle2, DollarSign, X } from "lucide-react";

const SAMPLE_EOBS = [
  { id: "EOB-001", patient: "Jane Doe", provider: "Springfield General", dos: "2026-07-15", billed: 185, allowed: 148, paid: 133.20, pr: 14.80, adj: [{ code: "CO-45", desc: "Contractual Obligation", amt: 14.80 }] },
  { id: "EOB-002", patient: "John Smith", provider: "Mercy Medical", dos: "2026-07-10", billed: 250, allowed: 225, paid: 210.50, pr: 14.50, adj: [{ code: "CO-45", desc: "Contractual", amt: 14.50 }, { code: "PR-2", desc: "Coinsurance", amt: 25 }] },
];

export function EOBScanner() {
  const [showPanel, setShowPanel] = useState(false);
  const [eob, setEob] = useState<any>(null);
  const [posted, setPosted] = useState(false);

  const loadSample = (idx: number) => { setEob(SAMPLE_EOBS[idx]); setPosted(false); };

  return (
    <div className="relative">
      <button onClick={() => setShowPanel(!showPanel)} className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] font-medium text-amber-600 hover:bg-amber-100"><FileText className="h-3.5 w-3.5" /> EOB Scanner</button>
      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/20" onClick={() => setShowPanel(false)}>
          <div className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl p-5 animate-slide-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><div><h3 className="text-sm font-bold text-slate-800">EOB Scanner</h3><p className="text-[9px] text-slate-400">Upload & parse explanation of benefits</p></div><button onClick={() => setShowPanel(false)} className="text-slate-400"><X className="h-4 w-4" /></button></div>

            <div className="flex gap-2 mb-3">
              {SAMPLE_EOBS.map((s, i) => <button key={s.id} onClick={() => loadSample(i)} className={`rounded-lg px-3 py-1.5 text-[10px] ${eob?.id === s.id ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>{s.id}</button>)}
            </div>

            <div className="rounded-lg border-2 border-dashed border-slate-300 p-4 text-center mb-3">
              <Upload className="mx-auto h-5 w-5 text-slate-300 mb-1" />
              <p className="text-[10px] text-slate-400">Drop EOB file or click to upload</p>
            </div>

            {eob && (
              <div>
                <div className="rounded-lg border border-slate-200 p-3 mb-3">
                  <div className="grid grid-cols-2 gap-1 text-[9px]"><span className="text-slate-400">Patient:</span><span className="font-medium">{eob.patient}</span><span className="text-slate-400">Provider:</span><span className="font-medium">{eob.provider}</span><span className="text-slate-400">DOS:</span><span>{eob.dos}</span></div>
                  <div className="grid grid-cols-2 gap-1 mt-2 text-[9px] border-t border-slate-100 pt-2"><span>Billed:</span><span>${eob.billed}</span><span>Allowed:</span><span>${eob.allowed}</span><span className="font-bold text-green-600">Paid:</span><span className="font-bold text-green-600">${eob.paid}</span><span>Patient Due:</span><span>${eob.pr}</span></div>
                  {eob.adj.map((a: any, i: number) => <p key={i} className="text-[8px] text-slate-400 mt-1">{a.code} {a.desc}: ${a.amt}</p>)}
                </div>
                {posted ? (
                  <div className="rounded-lg bg-green-50 p-3 flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /><span className="text-[10px] text-green-700">Posted to patient ledger</span></div>
                ) : (
                  <button onClick={() => setPosted(true)} className="w-full rounded-lg bg-amber-600 px-4 py-2.5 text-[10px] font-medium text-white"><DollarSign className="h-3.5 w-3.5 inline mr-1" />Post to Ledger</button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
