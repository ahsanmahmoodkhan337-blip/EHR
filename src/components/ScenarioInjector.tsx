/**
 * Scenario Injector — Demo Scenario Quick-Load Dropdown
 *
 * Floating button in the top-right area that injects preset
 * scenarios into the pipeline and patient stores for quick demos.
 *
 * Scenarios:
 *   A: Clean Routine Visit
 *   B: Complex Surgery (Needs PA)
 *   C: Denied Claim (Diagnosis Mismatch)
 *   D: Chronic Disease Management
 */

import { useState } from "react";
import { FlaskConical, RotateCcw, ChevronDown, Zap, CheckCircle2, AlertTriangle, Stethoscope } from "lucide-react";

// ─── Scenario Definitions ───────────────────────────────────────────

interface Scenario {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  // Actions to perform on load
}

const SCENARIOS: Scenario[] = [
  {
    id: "clean-routine",
    label: "A: Clean Routine Visit",
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
    description: "Healthy patient, normal vitals, paid claim — ideal workflow demo",
  },
  {
    id: "complex-surgery",
    label: "B: Complex Surgery (Needs PA)",
    icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />,
    description: "Surgical CPTs, prior auth required, modifier 25",
  },
  {
    id: "denied-claim",
    label: "C: Denied Claim (CO-16)",
    icon: <AlertTriangle className="h-3.5 w-3.5 text-red-500" />,
    description: "ICD-10/CPT mismatch, denial CO-16, appeal workflow",
  },
  {
    id: "chronic-dm",
    label: "D: Chronic Disease Mgmt",
    icon: <Stethoscope className="h-3.5 w-3.5 text-blue-500" />,
    description: "Diabetes + HTN follow-up, multiple ICD-10s",
  },
];

// ─── Component ──────────────────────────────────────────────────────

interface ScenarioInjectorProps {
  onSelectScenario?: (scenarioId: string) => void;
}

export function ScenarioInjector({ onSelectScenario }: ScenarioInjectorProps) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState<string | null>(null);

  const handleSelect = (id: string) => {
    // Select patient based on scenario
    const patientMap: Record<string, string> = {
      "clean-routine": "P001",      // Jane Doe — hypertension follow-up
      "complex-surgery": "P018",    // Robert Williams — knee replacement
      "denied-claim": "P011",      // James Kowalski — knee OA
      "chronic-dm": "P005",        // Eleanor Hayes — DM + neuropathy
    };

    const patientId = patientMap[id];
    if (patientId) {
      // Set selected patient in localStorage for next load
      localStorage.setItem("hh_scenario_patient", patientId);
    }
    localStorage.setItem("hh_scenario", id);

    setLoaded(id);
    setOpen(false);
    onSelectScenario?.(id);

    setTimeout(() => setLoaded(null), 3000);
  };

  const handleReset = () => {
    localStorage.removeItem("hh_scenario_patient");
    localStorage.removeItem("hh_scenario");
    localStorage.removeItem("hh_scores");
    setLoaded(null);
    setOpen(false);
    window.location.reload();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-medium transition-colors ${
          loaded
            ? "border-green-300 bg-green-50 text-green-700"
            : "border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
        }`}
      >
        <FlaskConical className="h-3.5 w-3.5" />
        {loaded ? `Loaded: ${loaded}` : "Demo Scenarios"}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-72 rounded-xl border border-slate-200 bg-white shadow-xl animate-slide-in">
            <div className="border-b border-slate-100 px-3 py-2">
              <div className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-[10px] font-bold text-slate-700">Load Demo Scenario</span>
              </div>
              <p className="mt-0.5 text-[9px] text-slate-400">
                Seeds pipeline state for quick testing
              </p>
            </div>

            <div className="py-1">
              {SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSelect(s.id)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="mt-0.5 shrink-0">{s.icon}</div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-slate-700">{s.label}</p>
                    <p className="text-[9px] text-slate-400 leading-snug">{s.description}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="border-t border-slate-100 px-3 py-2">
              <button
                onClick={handleReset}
                className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Sandbox
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
