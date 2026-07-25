/**
 * DrugAlertEngine — Drug-Drug & Drug-Allergy Interaction Checker
 *
 * Checks drug orders against patient allergies and current medications.
 * Triggers on CPOE order entry. Shows high-visibility alert banner
 * with Override/Cancel buttons.
 *
 * Exports `checkDrugInteractions()` function.
 */

import { useState } from "react";
import { AlertTriangle, Shield, XCircle, CheckCircle2, Info, X } from "lucide-react";

// ─── Mock Drug Database ─────────────────────────────────────────────

interface Drug {
  name: string;
  class: string;
  renalAdjustment?: string;
  interactions: { drug: string; severity: "contraindicated" | "warning" | "caution"; note: string }[];
  allergyCrossReactivity?: string[];
}

const DRUGS: Drug[] = [
  {
    name: "Amoxicillin",
    class: "Penicillin Antibiotic",
    interactions: [],
    allergyCrossReactivity: ["Penicillin", "Amoxicillin", "Ampicillin"],
  },
  {
    name: "Warfarin",
    class: "Anticoagulant",
    interactions: [
      { drug: "Aspirin", severity: "warning", note: "Increased bleeding risk — monitor INR closely" },
      { drug: "Ibuprofen", severity: "warning", note: "NSAIDs increase bleeding risk with Warfarin" },
    ],
  },
  {
    name: "Aspirin",
    class: "NSAID / Antiplatelet",
    interactions: [
      { drug: "Warfarin", severity: "warning", note: "Additive antiplatelet effect — GI bleeding risk" },
      { drug: "Ibuprofen", severity: "caution", note: "Concurrent NSAID use — increased GI risk" },
    ],
  },
  {
    name: "Metformin",
    class: "Biguanide",
    interactions: [
      { drug: "Contrast Dye", severity: "warning", note: "Risk of lactic acidosis — hold 48h before/after contrast" },
    ],
    renalAdjustment: "Contraindicated if eGFR < 30 mL/min",
  },
  {
    name: "Lisinopril",
    class: "ACE Inhibitor",
    interactions: [
      { drug: "Potassium Chloride", severity: "warning", note: "Hyperkalemia risk — monitor K+ levels" },
      { drug: "Spironolactone", severity: "warning", note: "Additive hyperkalemia risk" },
    ],
  },
  {
    name: "Ibuprofen",
    class: "NSAID",
    interactions: [
      { drug: "Warfarin", severity: "warning", note: "Increased bleeding risk" },
      { drug: "Lisinopril", severity: "caution", note: "May reduce antihypertensive effect" },
    ],
    renalAdjustment: "Avoid if eGFR < 30; use caution",
  },
  {
    name: "Furosemide",
    class: "Loop Diuretic",
    interactions: [
      { drug: "Gentamicin", severity: "warning", note: "Increased ototoxicity risk" },
    ],
    renalAdjustment: "Higher doses may be needed in renal impairment",
  },
  {
    name: "Simvastatin",
    class: "Statin",
    interactions: [
      { drug: "Clarithromycin", severity: "warning", note: "Increased myopathy/rhabdomyolysis risk" },
    ],
  },
  {
    name: "Metoprolol",
    class: "Beta Blocker",
    interactions: [
      { drug: "Verapamil", severity: "caution", note: "Additive bradycardia and hypotension" },
    ],
  },
  {
    name: "Insulin Glargine",
    class: "Long-acting Insulin",
    interactions: [],
  },
  {
    name: "Oxycodone",
    class: "Opioid Analgesic",
    interactions: [
      { drug: "Alprazolam", severity: "contraindicated", note: "Concomitant use increases risk of respiratory depression and death" },
    ],
  },
  {
    name: "Gentamicin",
    class: "Aminoglycoside Antibiotic",
    interactions: [
      { drug: "Furosemide", severity: "warning", note: "Additive ototoxicity and nephrotoxicity" },
    ],
    renalAdjustment: "Adjust dose based on eGFR — monitor levels",
  },
];

// ─── Interaction Checker ────────────────────────────────────────────

interface InteractionResult {
  type: "allergy" | "drug-drug" | "renal" | "safe";
  severity: "contraindicated" | "warning" | "caution" | "info";
  message: string;
}

export function checkDrugInteractions(
  patientAllergies: string[],
  currentMeds: string[],
  newOrder: string
): InteractionResult[] {
  const results: InteractionResult[] = [];
  const drug = DRUGS.find((d) => d.name.toLowerCase() === newOrder.toLowerCase());
  if (!drug) return results;

  // 1. Allergy check
  if (drug.allergyCrossReactivity) {
    for (const allergy of patientAllergies) {
      if (drug.allergyCrossReactivity.some((a) => a.toLowerCase() === allergy.toLowerCase())) {
        results.push({
          type: "allergy",
          severity: "contraindicated",
          message: `CONTRAINDICATED: Patient has documented allergy to ${allergy}. ${drug.name} is a ${drug.class} and may cause cross-reactivity.`,
        });
      }
    }
  }

  // 2. Drug-drug check
  for (const med of currentMeds) {
    const interaction = drug.interactions.find((i) => i.drug.toLowerCase() === med.toLowerCase());
    if (interaction) {
      results.push({
        type: "drug-drug",
        severity: interaction.severity,
        message: `${interaction.severity.toUpperCase()}: ${newOrder} + ${med} — ${interaction.note}`,
      });
    }
  }

  // 3. Renal adjustment
  if (drug.renalAdjustment) {
    results.push({
      type: "renal",
      severity: "caution",
      message: `Renal dosing alert: ${drug.renalAdjustment} (${drug.name} — ${drug.class})`,
    });
  }

  return results;
}

// ─── Component ──────────────────────────────────────────────────────

interface DrugAlertEngineProps {
  patientAllergies?: string[];
  currentMeds?: string[];
  onOverride?: () => void;
  onCancel?: () => void;
}

export function DrugAlertEngine({
  patientAllergies = ["Penicillin"],
  currentMeds = ["Lisinopril", "Metformin"],
  onOverride,
  onCancel,
}: DrugAlertEngineProps) {
  const [selectedDrug, setSelectedDrug] = useState("");
  const [results, setResults] = useState<InteractionResult[]>([]);
  const [checked, setChecked] = useState(false);
  const [showPanel, setShowPanel] = useState(false);

  const handleCheck = (drug: string) => {
    setSelectedDrug(drug);
    const res = checkDrugInteractions(patientAllergies, currentMeds, drug);
    setResults(res);
    setChecked(true);
  };

  const severityColor = (s: string) => {
    switch (s) {
      case "contraindicated": return "border-red-300 bg-red-50 text-red-700";
      case "warning": return "border-amber-300 bg-amber-50 text-amber-700";
      case "caution": return "border-yellow-300 bg-yellow-50 text-yellow-700";
      default: return "border-blue-300 bg-blue-50 text-blue-700";
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[10px] font-medium text-rose-600 hover:bg-rose-100 transition-colors"
      >
        <Shield className="h-3.5 w-3.5" />
        Drug Safety Check
      </button>

      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/20" onClick={() => setShowPanel(false)}>
          <div
            className="relative w-full max-w-md max-h-[80vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl p-5 animate-slide-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Drug Interaction Checker</h3>
                <p className="text-[10px] text-slate-500">Select a drug to check against patient allergies and current medications</p>
              </div>
              <button onClick={() => setShowPanel(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Patient context */}
            <div className="mb-3 rounded-lg bg-slate-50 p-3 text-[10px]">
              <p className="font-medium text-slate-600">Patient Allergies: <span className="text-red-600">{patientAllergies.join(", ")}</span></p>
              <p className="font-medium text-slate-600 mt-1">Current Meds: <span className="text-slate-700">{currentMeds.join(", ")}</span></p>
            </div>

            {/* Drug selector */}
            <div className="mb-3">
              <label className="mb-1 block text-[10px] font-medium text-slate-500">Order / New Medication</label>
              <select
                value={selectedDrug}
                onChange={(e) => handleCheck(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-rose-400"
              >
                <option value="">Select a medication...</option>
                {DRUGS.map((d) => (
                  <option key={d.name} value={d.name}>{d.name} ({d.class})</option>
                ))}
              </select>
            </div>

            {/* Results */}
            {checked && (
              <div className="space-y-2">
                {results.length === 0 ? (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <p className="text-[10px] font-medium text-green-700">No interactions detected — safe to order {selectedDrug}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <p className="text-[10px] font-bold text-red-600">
                        {results.length} alert{results.length > 1 ? "s" : ""} found
                      </p>
                    </div>
                    {results.map((r, i) => (
                      <div key={i} className={`rounded-lg border p-3 ${severityColor(r.severity)}`}>
                        <div className="flex items-start gap-1.5">
                          {r.severity === "contraindicated" ? (
                            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          ) : r.severity === "warning" ? (
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          )}
                          <span className="text-[10px] leading-relaxed">{r.message}</span>
                        </div>
                      </div>
                    ))}
                    {results.some((r) => r.severity === "contraindicated") && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => { onOverride?.(); setShowPanel(false); }}
                          className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-[10px] font-medium text-white hover:bg-red-500"
                        >
                          Override & Order Anyway
                        </button>
                        <button
                          onClick={() => { onCancel?.(); setShowPanel(false); }}
                          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
                        >
                          Cancel Order
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
