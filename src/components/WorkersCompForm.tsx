/**
 * WorkersCompForm — Workers' Compensation Intake Form
 *
 * WC/third-party liability workflow with First Report of Injury.
 */

import { useState } from "react";
import { ClipboardList, Printer, X } from "lucide-react";

const STATES = ["CA","NY","TX","FL","IL","PA","OH","GA","NC","MI","NJ","VA","WA","CO"];

export function WorkersCompForm() {
  const [showPanel, setShowPanel] = useState(false);
  const [form, setForm] = useState({ doi: "", jurisdiction: "CA", claimNo: "", adjuster: "", adjusterPhone: "", employer: "", carrier: "", isWorkRelated: true });
  const [showPrint, setShowPrint] = useState(false);

  const update = (k: string, v: any) => setForm({ ...form, [k]: v });

  return (
    <div className="relative">
      <button onClick={() => setShowPanel(!showPanel)} className="flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-[10px] font-medium text-orange-600 hover:bg-orange-100">
        <ClipboardList className="h-3.5 w-3.5" /> Workers Comp
      </button>
      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/20" onClick={() => setShowPanel(false)}>
          <div className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl p-5 animate-slide-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div><h3 className="text-sm font-bold text-slate-800">Workers' Comp Intake</h3></div>
              <button onClick={() => setShowPanel(false)} className="text-slate-400"><X className="h-4 w-4" /></button>
            </div>
            {!showPrint ? (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[10px]"><input type="checkbox" checked={form.isWorkRelated} onChange={e => update("isWorkRelated", e.target.checked)} className="h-3 w-3" /> This is a work-related injury</label>
                <input type="date" value={form.doi} onChange={e => update("doi", e.target.value)} placeholder="Date of Injury" className="w-full rounded-lg border px-3 py-2 text-[10px] outline-none" />
                <select value={form.jurisdiction} onChange={e => update("jurisdiction", e.target.value)} className="w-full rounded-lg border px-3 py-2 text-[10px] outline-none">{STATES.map(s => <option key={s} value={s}>{s}</option>)}</select>
                <input value={form.claimNo} onChange={e => update("claimNo", e.target.value)} placeholder="Claim Number" className="w-full rounded-lg border px-3 py-2 text-[10px] outline-none" />
                <input value={form.adjuster} onChange={e => update("adjuster", e.target.value)} placeholder="Adjuster Name" className="w-full rounded-lg border px-3 py-2 text-[10px] outline-none" />
                <input value={form.adjusterPhone} onChange={e => update("adjusterPhone", e.target.value)} placeholder="Adjuster Phone" className="w-full rounded-lg border px-3 py-2 text-[10px] outline-none" />
                <input value={form.employer} onChange={e => update("employer", e.target.value)} placeholder="Employer Name" className="w-full rounded-lg border px-3 py-2 text-[10px] outline-none" />
                <input value={form.carrier} onChange={e => update("carrier", e.target.value)} placeholder="WC Carrier" className="w-full rounded-lg border px-3 py-2 text-[10px] outline-none" />
                <button onClick={() => setShowPrint(true)} className="w-full rounded-lg bg-orange-600 px-4 py-2.5 text-[10px] font-medium text-white"><Printer className="h-3.5 w-3.5 inline mr-1" />Generate First Report of Injury</button>
              </div>
            ) : (
              <div className="rounded-lg border-2 border-slate-300 p-4">
                <h4 className="text-xs font-bold text-slate-800 mb-2">First Report of Injury</h4>
                <div className="space-y-1 text-[9px] text-slate-600">
                  <p><strong>Date of Injury:</strong> {form.doi}</p>
                  <p><strong>Jurisdiction:</strong> {form.jurisdiction}</p>
                  <p><strong>Claim #:</strong> {form.claimNo}</p>
                  <p><strong>Adjuster:</strong> {form.adjuster} ({form.adjusterPhone})</p>
                  <p><strong>Employer:</strong> {form.employer}</p>
                  <p><strong>WC Carrier:</strong> {form.carrier}</p>
                  <p><strong>Work-Related:</strong> {form.isWorkRelated ? "Yes" : "No"}</p>
                </div>
                <button onClick={() => setShowPrint(false)} className="mt-3 rounded-lg border px-3 py-1.5 text-[9px]">Back</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
