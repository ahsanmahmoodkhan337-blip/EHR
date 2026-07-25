/**
 * ERAPosting — ERA 835 Auto-Posting Engine
 *
 * Simulated remittance posting with claim-level breakdowns.
 * 3 mock 835 remittances pre-loaded. Auto-post to ledger.
 */

import { useState } from "react";
import { FileText, CheckCircle2, DollarSign, X } from "lucide-react";

const MOCK_REMITTANCES = [
  { id: "RMT-001", payer: "Blue Cross", checkNo: "CHK-1001", date: "2026-07-20", totalPaid: 133.20, claims: [{ id: "CLAIM-001", billed: 185, allowed: 148, paid: 133.20, adj: [{ code: "CO-45", desc: "Contractual Obligation", amt: 14.80 }, { code: "PR-1", desc: "Deductible", amt: 0 }] }] },
  { id: "RMT-002", payer: "Medicare", checkNo: "CHK-2001", date: "2026-07-22", totalPaid: 210.50, claims: [{ id: "CLAIM-002", billed: 250, allowed: 225, paid: 210.50, adj: [{ code: "CO-45", desc: "Contractual", amt: 14.50 }, { code: "PR-2", desc: "Coinsurance", amt: 25 }] }] },
  { id: "RMT-003", payer: "Aetna", checkNo: "CHK-3001", date: "2026-07-24", totalPaid: 85.00, claims: [{ id: "CLAIM-003", billed: 100, allowed: 90, paid: 85.00, adj: [{ code: "CO-45", desc: "Contractual", amt: 5.00 }, { code: "PR-1", desc: "Deductible", amt: 10 }] }] },
];

export function ERAPosting() {
  const [showPanel, setShowPanel] = useState(false);
  const [selectedRmt, setSelectedRmt] = useState(0);
  const [posted, setPosted] = useState<Set<number>>(new Set());

  const postRemittance = (idx: number) => {
    setPosted(prev => new Set([...prev, idx]));
  };

  const rmt = MOCK_REMITTANCES[selectedRmt];

  return (
    <div className="relative">
      <button onClick={() => setShowPanel(!showPanel)} className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1.5 text-[10px] font-medium text-green-600 hover:bg-green-100">
        <DollarSign className="h-3.5 w-3.5" /> ERA Posting
      </button>
      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/20" onClick={() => setShowPanel(false)}>
          <div className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl p-5 animate-slide-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div><h3 className="text-sm font-bold text-slate-800">ERA 835 Posting</h3><p className="text-[9px] text-slate-400">{MOCK_REMITTANCES.length} remittances</p></div>
              <button onClick={() => setShowPanel(false)} className="text-slate-400"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex gap-1 mb-3">
              {MOCK_REMITTANCES.map((r, i) => (
                <button key={r.id} onClick={() => setSelectedRmt(i)} className={`rounded-lg px-3 py-1.5 text-[9px] ${selectedRmt === i ? "bg-green-600 text-white" : posted.has(i) ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>{r.id}</button>
              ))}
            </div>
            <div className="rounded-lg border border-slate-200 p-3 mb-3">
              <div className="grid grid-cols-2 gap-1 text-[9px]">
                <span className="text-slate-400">Payer:</span><span className="font-medium">{rmt.payer}</span>
                <span className="text-slate-400">Check #:</span><span className="font-medium">{rmt.checkNo}</span>
                <span className="text-slate-400">Date:</span><span className="font-medium">{rmt.date}</span>
                <span className="text-slate-400">Total Paid:</span><span className="font-bold text-green-600">${rmt.totalPaid}</span>
              </div>
            </div>
            {rmt.claims.map(claim => (
              <div key={claim.id} className="rounded-lg border border-slate-200 p-3 mb-2">
                <p className="text-[10px] font-semibold text-slate-700 mb-1">{claim.id}</p>
                <div className="grid grid-cols-2 gap-0.5 text-[9px]">
                  <span className="text-slate-400">Billed:</span><span>${claim.billed}</span>
                  <span className="text-slate-400">Allowed:</span><span>${claim.allowed}</span>
                  <span className="text-slate-400">Paid:</span><span className="font-bold text-green-600">${claim.paid}</span>
                  {claim.adj.map(a => <span key={a.code} className="text-slate-400 col-span-2">{a.code} {a.desc}: ${a.amt}</span>)}
                </div>
              </div>
            ))}
            {posted.has(selectedRmt) ? (
              <div className="rounded-lg bg-green-50 p-3 flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /><span className="text-[10px] text-green-700">Posted to ledger — {rmt.claims.length} claims updated</span></div>
            ) : (
              <button onClick={() => postRemittance(selectedRmt)} className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-[10px] font-medium text-white hover:bg-green-500">Auto-Post Remittance</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
