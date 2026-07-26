/**
 * GFECalculator — Good Faith Estimate Price Transparency Tool
 *
 * No Surprises Act compliant for self-pay/uninsured patients.
 * CPT code selection, estimated charges, printable GFE view.
 */

import { useState } from "react";
import { Calculator, Printer, DollarSign, Plus, X, FileText } from "lucide-react";

// ─── CPT Price Data ─────────────────────────────────────────────────

const CPT_PRICES: Record<string, { desc: string; fee: number; facility: number }> = {
  "99203": { desc: "Office Visit — New Patient, Level 3", fee: 220, facility: 50 },
  "99213": { desc: "Office Visit — Established, Level 3", fee: 150, facility: 35 },
  "99214": { desc: "Office Visit — Established, Level 4", fee: 210, facility: 45 },
  "93005": { desc: "ECG 12-Lead", fee: 200, facility: 75 },
  "71046": { desc: "Chest X-Ray PA/LAT", fee: 180, facility: 90 },
  "80053": { desc: "Comprehensive Metabolic Panel", fee: 85, facility: 20 },
  "83036": { desc: "HbA1c", fee: 45, facility: 15 },
  "27447": { desc: "Knee Replacement", fee: 25000, facility: 5000 },
};

// ─── Component ──────────────────────────────────────────────────────

export function GFECalculator() {
  const [showPanel, setShowPanel] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [selected, setSelected] = useState<string[]>(["99213"]);
  const [searchCode, setSearchCode] = useState("");

  const addCode = (code: string) => {
    if (code && !selected.includes(code.toUpperCase()) && CPT_PRICES[code.toUpperCase()]) {
      setSelected([...selected, code.toUpperCase()]);
      setSearchCode("");
    }
  };

  const removeCode = (code: string) => setSelected(selected.filter(c => c !== code));

  const items = selected.map(c => ({ code: c, ...CPT_PRICES[c] })).filter(Boolean);
  const totalFee = items.reduce((s, i) => s + i.fee, 0);
  const totalFacility = items.reduce((s, i) => s + i.facility, 0);
  const grandTotal = totalFee + totalFacility;

  const patientName = localStorage.getItem("hh_student_name") || "Patient";

  return (
    <div className="relative">
      <button onClick={() => setShowPanel(!showPanel)} className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1.5 text-[10px] font-medium text-green-600 hover:bg-green-100">
        <Calculator className="h-3.5 w-3.5" /> GFE Estimator
      </button>
      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/20" onClick={() => setShowPanel(false)}>
          <div className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl p-5 animate-slide-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div><h3 className="text-sm font-bold text-slate-800">Good Faith Estimate</h3><p className="text-[9px] text-slate-400">No Surprises Act compliant</p></div>
              <button onClick={() => setShowPanel(false)} className="text-slate-400"><X className="h-4 w-4" /></button>
            </div>

            {!showPrint ? (
              <>
                <div className="flex gap-1 mb-3">
                  <input type="text" value={searchCode} onChange={e => setSearchCode(e.target.value)} onKeyDown={e => e.key === "Enter" && addCode(searchCode)} placeholder="Enter CPT code..." className="flex-1 rounded-lg border px-3 py-2 text-[10px] outline-none" />
                  <button onClick={() => addCode(searchCode)} className="rounded-lg bg-green-600 px-3 py-2 text-[10px] font-medium text-white"><Plus className="h-3 w-3" /></button>
                </div>

                {/* Quick select */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {Object.entries(CPT_PRICES).slice(0,6).map(([code, p]) => (
                    <button key={code} onClick={() => addCode(code)} className={`rounded px-2 py-1 text-[9px] ${selected.includes(code) ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>{code}</button>
                  ))}
                </div>

                <div className="space-y-2 mb-3">
                  {items.map(item => (
                    <div key={item.code} className="rounded-lg border border-slate-200 p-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono font-bold text-slate-700">{item.code}</span>
                        <button onClick={() => removeCode(item.code)} className="text-slate-400 hover:text-red-500">×</button>
                      </div>
                      <p className="text-[9px] text-slate-500 mb-1">{item.desc}</p>
                      <div className="flex justify-between text-[9px]">
                        <span className="text-slate-400">Service: ${item.fee}</span>
                        <span className="text-slate-400">Facility: ${item.facility}</span>
                        <span className="font-bold text-slate-700">${item.fee + item.facility}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl bg-green-50 border border-green-200 p-3 mb-3">
                  <div className="flex justify-between text-[10px] mb-1"><span className="text-slate-500">Services</span><span className="font-bold">${totalFee}</span></div>
                  <div className="flex justify-between text-[10px] mb-1"><span className="text-slate-500">Facility Fees</span><span className="font-bold">${totalFacility}</span></div>
                  <div className="flex justify-between text-sm border-t border-green-200 pt-1 mt-1"><span className="font-bold text-green-700">Total Estimate</span><span className="font-bold text-green-700">${grandTotal}</span></div>
                </div>
                <button onClick={() => setShowPrint(true)} className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-[10px] font-medium text-white hover:bg-green-500"><Printer className="h-3.5 w-3.5 inline mr-1.5" />Print GFE</button>
              </>
            ) : (
              <div className="rounded-lg border-2 border-slate-300 bg-white p-5 shadow-inner">
                <div className="text-center mb-4 pb-3 border-b border-slate-200">
                  <h3 className="text-sm font-bold text-slate-800">GOOD FAITH ESTIMATE</h3>
                  <p className="text-[9px] text-slate-400">No Surprises Act — Section 2799B-6</p>
                </div>
                <div className="space-y-1 text-[9px] text-slate-600">
                  <p><strong>Estimate ID:</strong> GFE-{Date.now().toString(36).toUpperCase()}</p>
                  <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
                  <p><strong>Provider NPI:</strong> 1234567890</p>
                  <p><strong>Patient:</strong> {patientName}</p>
                </div>
                <div className="my-3 space-y-1">
                  {items.map(i => (
                    <div key={i.code} className="flex justify-between text-[9px]"><span>{i.code} — {i.desc.slice(0,30)}</span><span className="font-mono">${i.fee + i.facility}</span></div>
                  ))}
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between text-[10px] font-bold"><span>Total Estimate</span><span>${grandTotal}</span></div>
                <p className="mt-3 text-[8px] text-slate-400 italic">This is a good faith estimate. Actual charges may vary. This estimate is valid for 12 months from the date of service. You have the right to dispute this bill if the actual charges substantially exceed this estimate.</p>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => window.print()} className="rounded-lg bg-green-600 px-3 py-1.5 text-[9px] font-medium text-white"><Printer className="h-3 w-3 inline mr-1" />Print</button>
                  <button onClick={() => setShowPrint(false)} className="rounded-lg border px-3 py-1.5 text-[9px]">Back</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
