/**
 * AllergyImmunizationRegistry — Allergy & Immunization Record
 *
 * RxNorm/CVX coded table. Add allergy/immunization modals.
 */

import { useState } from "react";
import { Shield, Syringe, Plus, Printer, X } from "lucide-react";

interface Allergy {
  substance: string; reaction: string; severity: "Mild"|"Moderate"|"Severe"|"Anaphylaxis"; date: string;
}
interface Immunization {
  vaccine: string; cvx: string; date: string; lot: string; provider: string;
}

const INITIAL_ALLERGIES: Allergy[] = [
  { substance: "Penicillin", reaction: "Anaphylaxis", severity: "Anaphylaxis", date: "2020-03-22" },
  { substance: "Sulfa Drugs", reaction: "Rash, hives", severity: "Moderate", date: "2021-07-14" },
  { substance: "Latex", reaction: "Contact dermatitis", severity: "Mild", date: "2019-08-20" },
  { substance: "Codeine", reaction: "Nausea/vomiting", severity: "Moderate", date: "2020-05-10" },
];
const INITIAL_IMMUNIZATIONS: Immunization[] = [
  { vaccine: "Tdap", cvx: "115", date: "2024-06-01", lot: "TDAP-2024-01", provider: "Dr. Chen" },
  { vaccine: "MMR", cvx: "03", date: "2023-05-15", lot: "MMR-2023-02", provider: "Dr. Chen" },
  { vaccine: "HepB #3", cvx: "08", date: "2024-01-10", lot: "HEPB-2024-03", provider: "Dr. Smith" },
  { vaccine: "COVID-19 #2", cvx: "208", date: "2023-11-20", lot: "COV-2023-05", provider: "CVS Pharmacy" },
  { vaccine: "Influenza", cvx: "141", date: "2025-10-15", lot: "FLU-2025-01", provider: "Dr. Chen" },
];

export function AllergyImmunizationRegistry() {
  const [showPanel, setShowPanel] = useState(false);
  const [tab, setTab] = useState<"allergies"|"immunizations">("allergies");
  const [allergies] = useState(INITIAL_ALLERGIES);
  const [immunizations] = useState(INITIAL_IMMUNIZATIONS);

  const sevColor = (s: string) => s === "Anaphylaxis" || s === "Severe" ? "border-red-200 bg-red-50" : s === "Moderate" ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50";

  return (
    <div className="relative">
      <button onClick={() => setShowPanel(!showPanel)} className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[10px] font-medium text-blue-600 hover:bg-blue-100"><Shield className="h-3.5 w-3.5" /> Registry</button>
      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/20" onClick={() => setShowPanel(false)}>
          <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl p-5 animate-slide-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><div><h3 className="text-sm font-bold text-slate-800">Allergy & Immunization Registry</h3></div><button onClick={() => setShowPanel(false)} className="text-slate-400"><X className="h-4 w-4" /></button></div>
            <div className="flex gap-2 mb-3">
              <button onClick={() => setTab("allergies")} className={`rounded-lg px-3 py-1.5 text-[10px] font-medium ${tab==="allergies"?"bg-blue-600 text-white":"bg-slate-100"}`}>Allergies ({allergies.length})</button>
              <button onClick={() => setTab("immunizations")} className={`rounded-lg px-3 py-1.5 text-[10px] font-medium ${tab==="immunizations"?"bg-blue-600 text-white":"bg-slate-100"}`}>Immunizations ({immunizations.length})</button>
            </div>
            {tab === "allergies" ? (
              <div className="space-y-1">
                {allergies.map((a, i) => (
                  <div key={i} className={`rounded-lg border p-2.5 ${sevColor(a.severity)}`}>
                    <div className="flex items-center justify-between"><span className="text-[10px] font-semibold text-slate-700">{a.substance}</span><span className="rounded-full px-1.5 py-0.5 text-[8px] font-bold bg-white/50">{a.severity}</span></div>
                    <p className="text-[9px] text-slate-500">Reaction: {a.reaction} | {a.date}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {immunizations.map((v, i) => (
                  <div key={i} className="rounded-lg border border-green-200 bg-green-50 p-2.5">
                    <div className="flex items-center justify-between"><span className="text-[10px] font-semibold text-slate-700">{v.vaccine}</span><span className="text-[9px] font-mono text-slate-500">CVX:{v.cvx}</span></div>
                    <p className="text-[9px] text-slate-500">{v.date} | Lot: {v.lot} | {v.provider}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
