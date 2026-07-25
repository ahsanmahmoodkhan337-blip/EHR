/**
 * HCCRiskOptimizer — HCC Risk Score Analyzer
 *
 * Scans ICD-10 codes, maps to HCC categories, shows RAF scores,
 * and suggests higher-specificity alternatives for optimization.
 */

import { useState } from "react";
import { TrendingUp, Lightbulb, AlertCircle, BarChart3, X } from "lucide-react";

// ─── HCC Mapping ────────────────────────────────────────────────────

interface HCCMap {
  icd10: string;
  hcc: string;
  label: string;
  rafScore: number;
  suggestions?: { icd10: string; label: string; rafBoost: number; note: string }[];
}

const HCC_MAPPINGS: HCCMap[] = [
  {
    icd10: "E11.9",
    hcc: "HCC 18",
    label: "Diabetes with Chronic Complications",
    rafScore: 0.104,
    suggestions: [
      { icd10: "E11.22", label: "DM with CKD", rafBoost: 0.302, note: "Add CKD diagnosis for 3x RAF" },
      { icd10: "E11.42", label: "DM with Polyneuropathy", rafBoost: 0.302, note: "Document neuropathy for higher RAF" },
    ],
  },
  {
    icd10: "I10",
    hcc: "HCC 19",
    label: "Hypertension",
    rafScore: 0.034,
    suggestions: [
      { icd10: "I11.0", label: "HTN Heart Disease with HF", rafBoost: 0.331, note: "Document cardiac involvement" },
    ],
  },
  {
    icd10: "J44.9",
    hcc: "HCC 111",
    label: "Chronic Obstructive Pulmonary Disease",
    rafScore: 0.335,
    suggestions: [
      { icd10: "J44.1", label: "COPD with exacerbation", rafBoost: 0.335, note: "Specify acute exacerbation if present" },
    ],
  },
  {
    icd10: "E78.5",
    hcc: "HCC 20",
    label: "Hyperlipidemia",
    rafScore: 0.000,
    suggestions: [],
  },
  {
    icd10: "I50.9",
    hcc: "HCC 85",
    label: "Heart Failure",
    rafScore: 0.331,
    suggestions: [
      { icd10: "I50.22", label: "Chronic Systolic HF", rafBoost: 0.331, note: "Specify systolic vs. diastolic" },
    ],
  },
  {
    icd10: "N18.3",
    hcc: "HCC 136",
    label: "Chronic Kidney Disease Stage 3",
    rafScore: 0.069,
    suggestions: [
      { icd10: "N18.4", label: "CKD Stage 4", rafBoost: 0.237, note: "Document if GFR < 30" },
    ],
  },
  {
    icd10: "F32.9",
    hcc: "HCC 59",
    label: "Major Depressive Disorder",
    rafScore: 0.309,
    suggestions: [],
  },
  {
    icd10: "M17.11",
    hcc: "HCC 40",
    label: "Osteoarthritis",
    rafScore: 0.000,
    suggestions: [],
  },
];

// ─── Component ──────────────────────────────────────────────────────

export function HCCRiskOptimizer() {
  const [codes, setCodes] = useState<string[]>(["E11.9", "I10", "J44.9", "E78.5"]);
  const [codeInput, setCodeInput] = useState("");
  const [showPanel, setShowPanel] = useState(false);

  const addCode = () => {
    if (codeInput.trim()) {
      setCodes([...codes, codeInput.trim().toUpperCase()]);
      setCodeInput("");
    }
  };

  const removeCode = (idx: number) => {
    setCodes(codes.filter((_, i) => i !== idx));
  };

  const mappedCodes = codes
    .map((c) => {
      const match = HCC_MAPPINGS.find(
        (h) => h.icd10.toUpperCase() === c.toUpperCase()
      );
      return { code: c, mapping: match || null };
    });

  const totalRAF = mappedCodes.reduce((s, m) => s + (m.mapping?.rafScore || 0), 0);
  const rafColor = totalRAF >= 1.5 ? "text-green-600" : totalRAF >= 0.8 ? "text-amber-600" : "text-red-600";

  return (
    <div className="relative">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[10px] font-medium text-blue-600 hover:bg-blue-100 transition-colors"
      >
        <BarChart3 className="h-3.5 w-3.5" />
        HCC Optimizer
      </button>

      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/20" onClick={() => setShowPanel(false)}>
          <div className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl p-5 animate-slide-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">HCC Risk Score Optimizer</h3>
                <p className="text-[9px] text-slate-400">Analyze ICD-10 codes for HCC mapping and RAF scores</p>
              </div>
              <button onClick={() => setShowPanel(false)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
            </div>

            {/* Code input */}
            <div className="mb-3 flex gap-1">
              <input
                type="text"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCode()}
                placeholder="Enter ICD-10 code..."
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-[10px] outline-none focus:border-blue-400"
              />
              <button onClick={addCode} className="rounded-lg bg-blue-600 px-3 py-2 text-[10px] font-medium text-white hover:bg-blue-500">Add</button>
            </div>

            {/* Code tags */}
            <div className="flex flex-wrap gap-1 mb-3">
              {codes.map((c, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-[9px] font-mono text-slate-600">
                  {c}
                  <button onClick={() => removeCode(i)} className="text-slate-400 hover:text-red-500">×</button>
                </span>
              ))}
            </div>

            {/* HCC Mappings */}
            <div className="space-y-2 mb-3">
              {mappedCodes.map((mc, i) => (
                <div key={i} className="rounded-lg border border-slate-200 p-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-slate-700">{mc.code}</span>
                      {mc.mapping ? (
                        <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-medium text-blue-700">{mc.mapping.hcc}</span>
                      ) : (
                        <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[9px] text-slate-500">Not mapped</span>
                      )}
                    </div>
                    {mc.mapping && (
                      <span className="text-[10px] font-bold text-slate-700">RAF: {mc.mapping.rafScore.toFixed(3)}</span>
                    )}
                  </div>
                  {mc.mapping?.label && (
                    <p className="mt-0.5 text-[9px] text-slate-500">{mc.mapping.label}</p>
                  )}
                  {mc.mapping?.suggestions && mc.mapping.suggestions.length > 0 && (
                    <div className="mt-1.5 space-y-1">
                      <p className="text-[8px] font-medium text-amber-600 flex items-center gap-1">
                        <Lightbulb className="h-2.5 w-2.5" /> Suggestions for higher RAF:
                      </p>
                      {mc.mapping.suggestions.map((s, j) => (
                        <div key={j} className="rounded bg-amber-50 px-2 py-1 text-[9px] text-amber-700">
                          <span className="font-mono font-bold">{s.icd10}</span> — {s.label}
                          <span className="ml-1 text-green-600">(+{(s.rafBoost - (mc.mapping?.rafScore || 0)).toFixed(3)} RAF)</span>
                          <p className="text-[8px] text-amber-500">{s.note}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Total RAF */}
            <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold text-blue-700">Total RAF Score</p>
                  <p className={`text-2xl font-bold ${rafColor}`}>{totalRAF.toFixed(3)}</p>
                </div>
                {/* Visual gauge */}
                <div className="w-24">
                  <div className="h-3 w-full rounded-full bg-slate-200">
                    <div
                      className={`h-3 rounded-full ${totalRAF >= 1.5 ? "bg-green-500" : totalRAF >= 0.8 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${Math.min(100, (totalRAF / 2) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-0.5 text-right text-[8px] text-slate-400">Target: 1.5+</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
