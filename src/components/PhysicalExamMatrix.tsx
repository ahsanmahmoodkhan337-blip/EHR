/**
 * PhysicalExamMatrix — 12-System Physical Exam Grid
 *
 * Clickable checkbox grid for the scribe workflow.
 * Each system toggles: Not Examined → Normal → Abnormal (with text field).
 * "Mark All Normal" one-click button.
 *
 * Wire as a standalone component in the scribe workspace.
 */

import { useState } from "react";
import { CheckCircle2, Circle, AlertCircle, X } from "lucide-react";

// ─── System Data ────────────────────────────────────────────────────

interface SystemState {
  name: string;
  icon: string;
  status: "not-examined" | "normal" | "abnormal";
  findings: string;
}

const SYSTEMS: { name: string; icon: string }[] = [
  { name: "Constitutional", icon: "🌡" },
  { name: "Eyes", icon: "👁" },
  { name: "ENT", icon: "👂" },
  { name: "Cardiovascular", icon: "❤️" },
  { name: "Respiratory", icon: "🫁" },
  { name: "GI", icon: "🫄" },
  { name: "GU", icon: "🫗" },
  { name: "Musculoskeletal", icon: "🦴" },
  { name: "Skin", icon: "🤚" },
  { name: "Neurological", icon: "🧠" },
  { name: "Psychiatric", icon: "💭" },
  { name: "Endocrine", icon: "🦋" },
];

// ─── Component ──────────────────────────────────────────────────────

const DEFAULT_NORMAL_FINDINGS: Record<string, string> = {
  Constitutional: "Well-appearing, no acute distress, afebrile.",
  Eyes: "PERRLA, EOMI, no conjunctival injection.",
  ENT: "Mucous membranes moist, oropharynx clear, TMs clear.",
  Cardiovascular: "Regular rate and rhythm, no murmurs/rubs/gallops.",
  Respiratory: "Clear to auscultation bilaterally, no wheezes/crackles.",
  GI: "Soft, non-tender, non-distended, normal bowel sounds.",
  GU: "No CVA tenderness.",
  Musculoskeletal: "Full ROM all extremities, no deformities/edema.",
  Skin: "Warm, dry, no rashes or lesions.",
  Neurological: "Alert and oriented x3, CN II-XII grossly intact, normal gait.",
  Psychiatric: "Normal mood and affect, appropriate insight.",
  Endocrine: "Thyroid non-enlarged, no thyromegaly.",
};

export function PhysicalExamMatrix() {
  const [systems, setSystems] = useState<SystemState[]>(
    SYSTEMS.map((s) => ({
      name: s.name,
      icon: s.icon,
      status: "not-examined",
      findings: "",
    }))
  );
  const [showPanel, setShowPanel] = useState(false);

  const toggleStatus = (idx: number) => {
    const updated = [...systems];
    if (updated[idx].status === "not-examined") {
      updated[idx].status = "normal";
      updated[idx].findings = DEFAULT_NORMAL_FINDINGS[updated[idx].name] || "";
    } else if (updated[idx].status === "normal") {
      updated[idx].status = "abnormal";
      updated[idx].findings = "";
    } else {
      updated[idx].status = "not-examined";
      updated[idx].findings = "";
    }
    setSystems(updated);
  };

  const markAllNormal = () => {
    setSystems(
      systems.map((s) => ({
        ...s,
        status: s.status === "not-examined" ? "normal" : s.status,
        findings: s.status === "normal" ? "" : DEFAULT_NORMAL_FINDINGS[s.name] || "",
      }))
    );
  };

  const resetAll = () => {
    setSystems(SYSTEMS.map((s) => ({ name: s.name, icon: s.icon, status: "not-examined" as const, findings: "" })));
  };

  const normalCount = systems.filter((s) => s.status === "normal").length;
  const abnormalCount = systems.filter((s) => s.status === "abnormal").length;

  const generatedText = systems
    .filter((s) => s.status !== "not-examined")
    .map((s) => {
      const status = s.status === "abnormal" ? " (Abnormal)" : "";
      return `**${s.name}${status}:** ${s.findings || "Normal."}`;
    })
    .join("\n");

  return (
    <div className="relative">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-medium text-emerald-600 hover:bg-emerald-100 transition-colors"
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        Physical Exam ({normalCount}✓ {abnormalCount > 0 ? `${abnormalCount}⚠` : ""})
      </button>

      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/20" onClick={() => setShowPanel(false)}>
          <div
            className="relative w-full max-w-md max-h-[80vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl p-5 animate-slide-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Physical Exam Matrix</h3>
                <p className="text-[10px] text-slate-500">Click to cycle: Not Examined → Normal → Abnormal</p>
              </div>
              <button onClick={() => setShowPanel(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={markAllNormal}
                className="flex-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-medium text-white hover:bg-emerald-500"
              >
                Mark All Normal
              </button>
              <button
                onClick={resetAll}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
              >
                Reset
              </button>
            </div>

            {/* System Grid */}
            <div className="grid grid-cols-2 gap-2">
              {systems.map((s, i) => (
                <div key={s.name} className="relative">
                  <button
                    onClick={() => toggleStatus(i)}
                    className={`w-full rounded-lg border p-2.5 text-left transition-colors ${
                      s.status === "not-examined"
                        ? "border-slate-200 bg-white hover:bg-slate-50"
                        : s.status === "normal"
                        ? "border-green-200 bg-green-50"
                        : "border-amber-300 bg-amber-50"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{s.icon}</span>
                      <span className="text-[10px] font-medium text-slate-700">{s.name}</span>
                      <span className="ml-auto">
                        {s.status === "not-examined" && <Circle className="h-3 w-3 text-slate-300" />}
                        {s.status === "normal" && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                        {s.status === "abnormal" && <AlertCircle className="h-3 w-3 text-amber-500" />}
                      </span>
                    </div>
                  </button>
                  {s.status === "abnormal" && (
                    <input
                      type="text"
                      value={s.findings}
                      onChange={(e) => {
                        const updated = [...systems];
                        updated[i].findings = e.target.value;
                        setSystems(updated);
                      }}
                      placeholder="Enter abnormal findings..."
                      className="mt-1 w-full rounded border border-amber-200 px-2 py-1 text-[9px] text-amber-700 outline-none focus:border-amber-400 placeholder:text-amber-400"
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Generated Text Preview */}
            {normalCount + abnormalCount > 0 && (
              <div className="mt-4 rounded-lg bg-slate-50 p-3">
                <p className="mb-1 text-[10px] font-semibold text-slate-600">Generated Exam Text</p>
                <pre className="whitespace-pre-wrap text-[9px] text-slate-500 leading-relaxed font-sans max-h-24 overflow-y-auto">{generatedText}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
