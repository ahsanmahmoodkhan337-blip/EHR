/**
 * CreditBalanceQueue — Credit Balance & Refund Management
 *
 * Detects patient/insurance overpayments. Generate refund vouchers.
 */

import { useState } from "react";
import { DollarSign, CheckCircle2, AlertTriangle, X, Printer } from "lucide-react";

interface Credit {
  id: string; date: string; source: string; amount: number; type: "Patient" | "Insurance"; status: "Pending" | "Resolved";
}

const MOCK_CREDITS: Credit[] = [
  { id: "CR-001", date: "2026-07-20", source: "Patient overpayment — copay", amount: 25, type: "Patient", status: "Pending" },
  { id: "CR-002", date: "2026-07-18", source: "Insurance duplicate payment — BCBS", amount: 150, type: "Insurance", status: "Pending" },
  { id: "CR-003", date: "2026-07-15", source: "Copay overpayment — cash", amount: 10, type: "Patient", status: "Pending" },
  { id: "CR-004", date: "2026-07-10", source: "Credit adjustment — contractual", amount: 50, type: "Insurance", status: "Resolved" },
];

export function CreditBalanceQueue() {
  const [showPanel, setShowPanel] = useState(false);
  const [credits, setCredits] = useState(MOCK_CREDITS);
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  const resolve = (id: string) => {
    setResolved(prev => new Set([...prev, id]));
    setCredits(c => c.map(x => x.id === id ? { ...x, status: "Resolved" as const } : x));
  };

  const pending = credits.filter(c => c.status === "Pending");
  const totalPending = pending.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="relative">
      <button onClick={() => setShowPanel(!showPanel)} className="flex items-center gap-1.5 rounded-lg border border-yellow-200 bg-yellow-50 px-2.5 py-1.5 text-[10px] font-medium text-yellow-600 hover:bg-yellow-100"><DollarSign className="h-3.5 w-3.5" /> Credits (${totalPending})</button>
      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/20" onClick={() => setShowPanel(false)}>
          <div className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl p-5 animate-slide-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><div><h3 className="text-sm font-bold text-slate-800">Credit Balance Queue</h3><p className="text-[9px] text-slate-400">${totalPending} pending refunds</p></div><button onClick={() => setShowPanel(false)} className="text-slate-400"><X className="h-4 w-4" /></button></div>
            <div className="space-y-2">
              {credits.map(c => (
                <div key={c.id} className={`rounded-lg border p-3 ${c.status === "Resolved" ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
                  <div className="flex items-start justify-between mb-1"><div><span className="text-[10px] font-semibold text-slate-700">{c.source}</span><p className="text-[9px] text-slate-500">{c.date}</p></div><span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold ${c.status==="Resolved"?"bg-green-500 text-white":"bg-amber-500 text-white"}`}>{c.status}</span></div>
                  <div className="flex items-center justify-between"><span className="text-[10px] font-bold text-red-600">${c.amount}</span><span className="rounded bg-slate-200 px-1.5 py-0.5 text-[8px] text-slate-600">{c.type}</span></div>
                  {c.status !== "Resolved" && (
                    <div className="mt-2 flex gap-1.5">
                      <button onClick={() => resolve(c.id)} className="rounded bg-yellow-600 px-2 py-1 text-[8px] font-medium text-white"><CheckCircle2 className="h-3 w-3 inline mr-1" />Resolve</button>
                      <button className="rounded border px-2 py-1 text-[8px]"><Printer className="h-3 w-3 inline mr-1" />Voucher</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
