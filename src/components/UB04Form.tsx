/**
 * UB04Form — CMS-1450 Institutional Claim Form
 *
 * For facility/inpatient billing. Type of Bill, Revenue Codes,
 * HCPCS codes, Service Dates, Total Charges.
 */

import { useState } from "react";
import { FileText, Printer, X, Plus } from "lucide-react";

const REVENUE_CODES = [
  { code: "0120", desc: "Room & Board — Semi-Private" },
  { code: "0250", desc: "Pharmacy — General" },
  { code: "0300", desc: "Laboratory — General" },
  { code: "0320", desc: "Radiology — Diagnostic" },
  { code: "0450", desc: "Emergency Room" },
  { code: "0270", desc: "Medical/Surgical Supplies" },
  { code: "0420", desc: "Physical Therapy" },
];

const TYPE_OF_BILL = [
  { code: "111", desc: "Hospital Inpatient" },
  { code: "131", desc: "Hospital Outpatient" },
  { code: "851", desc: "Critical Access Hospital" },
  { code: "121", desc: "Hospital Inpatient — Interim" },
];

export function UB04Form() {
  const [showPanel, setShowPanel] = useState(false);
  const [billType, setBillType] = useState("111");
  const [charges, setCharges] = useState([{ revCode: "0300", hcpcs: "80053", desc: "CMP", qty: 1, charge: 85 }]);

  const addCharge = () => {
    setCharges([...charges, { revCode: "0300", hcpcs: "", desc: "", qty: 1, charge: 0 }]);
  };

  const updateCharge = (idx: number, field: string, value: any) => {
    const updated = [...charges];
    (updated[idx] as any)[field] = value;
    setCharges(updated);
  };

  const totalCharges = charges.reduce((s, c) => s + c.charge * c.qty, 0);

  return (
    <div className="relative">
      <button onClick={() => setShowPanel(!showPanel)} className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[10px] font-medium text-blue-600 hover:bg-blue-100">
        <FileText className="h-3.5 w-3.5" /> UB-04
      </button>
      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/20" onClick={() => setShowPanel(false)}>
          <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl p-5 animate-slide-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div><h3 className="text-sm font-bold text-slate-800">UB-04 (CMS-1450)</h3><p className="text-[9px] text-slate-400">Institutional Claim Form</p></div>
              <button onClick={() => setShowPanel(false)} className="text-slate-400"><X className="h-4 w-4" /></button>
            </div>

            {/* Header Fields */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="text-[9px] font-medium text-slate-500">Type of Bill</label>
                <select value={billType} onChange={e => setBillType(e.target.value)} className="w-full rounded-lg border px-2 py-1.5 text-[10px] outline-none">
                  {TYPE_OF_BILL.map(t => <option key={t.code} value={t.code}>{t.code} — {t.desc}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-medium text-slate-500">Statement Date</label>
                <input type="text" defaultValue={new Date().toLocaleDateString()} className="w-full rounded-lg border px-2 py-1.5 text-[10px] outline-none" />
              </div>
            </div>

            {/* Revenue Code Reference */}
            <div className="mb-3 rounded-lg bg-slate-50 p-2">
              <p className="text-[9px] font-semibold text-slate-600 mb-1">Revenue Codes</p>
              <div className="flex flex-wrap gap-1">
                {REVENUE_CODES.map(r => (
                  <span key={r.code} className="rounded bg-blue-100 px-1.5 py-0.5 text-[8px] text-blue-700">{r.code}</span>
                ))}
              </div>
            </div>

            {/* Charge Lines */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-semibold text-slate-600">Service Lines</p>
                <button onClick={addCharge} className="text-[9px] text-blue-600"><Plus className="h-3 w-3 inline" /> Add</button>
              </div>
              {charges.map((c, i) => (
                <div key={i} className="grid grid-cols-5 gap-1 mb-1">
                  <select value={c.revCode} onChange={e => updateCharge(i, "revCode", e.target.value)} className="rounded border px-1 py-1 text-[9px] outline-none">
                    {REVENUE_CODES.map(r => <option key={r.code} value={r.code}>{r.code}</option>)}
                  </select>
                  <input value={c.hcpcs} onChange={e => updateCharge(i, "hcpcs", e.target.value)} placeholder="HCPCS" className="rounded border px-1 py-1 text-[9px] outline-none" />
                  <input value={c.desc} onChange={e => updateCharge(i, "desc", e.target.value)} placeholder="Desc" className="rounded border px-1 py-1 text-[9px] outline-none" />
                  <input type="number" value={c.qty} onChange={e => updateCharge(i, "qty", parseInt(e.target.value) || 1)} className="rounded border px-1 py-1 text-[9px] outline-none w-10" />
                  <input type="number" value={c.charge} onChange={e => updateCharge(i, "charge", parseInt(e.target.value) || 0)} className="rounded border px-1 py-1 text-[9px] outline-none" />
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 mb-3">
              <div className="flex justify-between text-[10px]"><span className="text-slate-500">Total Charges</span><span className="font-bold">${totalCharges}</span></div>
              <div className="flex justify-between text-[10px] mt-1"><span className="text-slate-500">Days/Units</span><span className="font-bold">{charges.reduce((s, c) => s + c.qty, 0)}</span></div>
            </div>

            <button className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-[10px] font-medium text-white hover:bg-blue-500"><Printer className="h-3.5 w-3.5 inline mr-1" />Print UB-04</button>
          </div>
        </div>
      )}
    </div>
  );
}
