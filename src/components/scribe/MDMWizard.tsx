/**
 * MDMWizard — E/M Medical Decision Making Level Calculator
 *
 * Recommends CPT 99202-99215 from the three AMA MDM elements:
 * 1. Number and complexity of problems addressed
 * 2. Amount and complexity of data reviewed and analysed
 * 3. Risk of complications of patient management
 *
 * The level is the highest one that **two of the three** elements reach — the
 * AMA 2021 office E/M rule — read from `domain/mdm.ts`, the same rule the Coding
 * stage's calculator uses. Earlier versions added the boxes up as points, which
 * is not how MDM is scored and could recommend 99215 for a minor problem with a
 * lot of data reviewed.
 *
 * Wire as a toggle panel in the scribe workspace.
 */

import { useEffect, useMemo, useState } from "react";
import { Calculator, ChevronDown, ChevronUp, CheckCircle2, Info, Minus, Plus, X } from "lucide-react";
import {
  MDM_LEVEL_NAMES,
  mdmDataLevel,
  mdmLevelFromElements,
  officeEmCode,
  type MdmLevel,
} from "../../domain/mdm";

// ─── MDM Data (AMA 2021 table) ──────────────────────────────────────

/** Each box carries the MDM level it reaches; an element takes its highest box. */
const PROBLEM_LEVELS: { label: string; level: MdmLevel }[] = [
  { label: "1 self-limited or minor problem", level: 1 },
  { label: "2+ self-limited or minor problems", level: 2 },
  { label: "1 stable chronic illness", level: 2 },
  { label: "1 acute, uncomplicated illness or injury", level: 2 },
  { label: "1+ chronic illness with exacerbation, progression or side effects", level: 3 },
  { label: "2+ stable chronic illnesses", level: 3 },
  { label: "1 undiagnosed new problem with uncertain prognosis", level: 3 },
  { label: "1 acute illness with systemic symptoms, or acute complicated injury", level: 3 },
  { label: "1+ chronic illness with severe exacerbation", level: 4 },
  { label: "Acute or chronic illness posing a threat to life or bodily function", level: 4 },
];

const RISK_LEVELS: { label: string; level: MdmLevel }[] = [
  { label: "Minimal risk (rest, gargles, elastic bandages, superficial dressings)", level: 1 },
  { label: "Low risk (over-the-counter drugs, minor surgery without risk factors, PT/OT)", level: 2 },
  { label: "Moderate risk (prescription drug management)", level: 3 },
  { label: "Moderate risk (minor surgery with risk factors, elective major surgery without risk factors, SDOH limiting care)", level: 3 },
  { label: "High risk (drug therapy needing intensive monitoring for toxicity, elective major surgery with risk factors)", level: 4 },
  { label: "High risk (decision about emergency major surgery or hospitalisation, DNR / de-escalation)", level: 4 },
];

const highestChecked = (items: { level: MdmLevel; checked: boolean }[]): MdmLevel =>
  items.reduce<MdmLevel>((max, i) => (i.checked && i.level > max ? i.level : max), 1);

// ─── Component ──────────────────────────────────────────────────────

export interface MDMWizardResult {
  code: string;
  label: string;
  patientType: string;
  /** The MDM level reached: 1 straightforward, 2 low, 3 moderate, 4 high. */
  total: number;
}

interface MDMWizardProps {
  onLevelChange?: (result: MDMWizardResult) => void;
  /**
   * Open on "New Patient" — true when the chart holds no prior signed visit.
   * The student can still switch it.
   */
  defaultNewPatient?: boolean;
}

export function MDMWizard({ onLevelChange, defaultNewPatient = false }: MDMWizardProps = {}) {
  const [open, setOpen] = useState(false);
  const [problems, setProblems] = useState(PROBLEM_LEVELS.map((p) => ({ ...p, checked: false })));
  const [risk, setRisk] = useState(RISK_LEVELS.map((r) => ({ ...r, checked: false })));
  const [uniqueItems, setUniqueItems] = useState(0);
  const [independentHistorian, setIndependentHistorian] = useState(false);
  const [independentInterpretation, setIndependentInterpretation] = useState(false);
  const [externalDiscussion, setExternalDiscussion] = useState(false);
  const [patientTypeChoice, setPatientTypeChoice] = useState<boolean | null>(null);
  const isNewPatient = patientTypeChoice ?? defaultNewPatient;
  const [showRationale, setShowRationale] = useState(false);

  // Escape closes the calculator, like every other dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const toggleProblem = (idx: number) =>
    setProblems((prev) => prev.map((p, i) => (i === idx ? { ...p, checked: !p.checked } : p)));
  const toggleRisk = (idx: number) =>
    setRisk((prev) => prev.map((r, i) => (i === idx ? { ...r, checked: !r.checked } : r)));

  const problemLevel = highestChecked(problems);
  const riskLevel = highestChecked(risk);
  const dataLevel = mdmDataLevel({ uniqueItems, independentHistorian, independentInterpretation, externalDiscussion });
  const mdm = mdmLevelFromElements(problemLevel, dataLevel, riskLevel);

  const recommended = useMemo(
    () => ({
      code: officeEmCode(mdm, isNewPatient),
      label: `Level ${mdm + 1}`,
      patientType: isNewPatient ? "New" : "Established",
    }),
    [mdm, isNewPatient],
  );

  useEffect(() => {
    onLevelChange?.({ ...recommended, total: mdm });
  }, [recommended, mdm, onLevelChange]);

  const levelColors = ["bg-slate-100", "bg-brand-100", "bg-green-100", "bg-amber-100", "bg-red-100"];
  const levelColor = levelColors[mdm];
  const elementLine = (name: string, level: MdmLevel) => `${name}: ${MDM_LEVEL_NAMES[level]}`;
  const meets = [problemLevel, dataLevel, riskLevel].filter((v) => v >= mdm).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-100 transition-colors"
      >
        <Calculator className="h-3.5 w-3.5" />
        E/M MDM Wizard
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/20" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="E/M MDM Level Calculator"
            className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl animate-slide-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* The header stays on screen while the boxes scroll, so Close is always in reach. */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 pb-3 pt-5">
              <div>
                <h3 className="text-sm font-bold text-slate-800">E/M MDM Level Calculator</h3>
                <p className="text-xs text-slate-500">Two of the three elements set the level (AMA 2021)</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close the calculator"
                title="Close (Esc)"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 pt-3">
            {/* Patient Type Toggle */}
            <div className="mb-3 flex items-center gap-3">
              <span className="text-xs font-medium text-slate-500">Patient Type:</span>
              <button
                onClick={() => setPatientTypeChoice(false)}
                className={`rounded-lg px-3 py-1 text-xs font-medium ${!isNewPatient ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500"}`}
              >
                Established
              </button>
              <button
                onClick={() => setPatientTypeChoice(true)}
                className={`rounded-lg px-3 py-1 text-xs font-medium ${isNewPatient ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500"}`}
              >
                New Patient
              </button>
              {patientTypeChoice === null && (
                <span className="text-[11px] text-slate-400">
                  {defaultNewPatient ? "No prior visit on the chart" : "Prior visit on the chart"}
                </span>
              )}
            </div>

            {/* Problem Complexity */}
            <div className="mb-3 rounded-lg border border-slate-200 p-3">
              <p className="mb-2 text-xs font-semibold text-slate-700">
                1. Number/Complexity of Problems — {MDM_LEVEL_NAMES[problemLevel]}
              </p>
              <div className="space-y-1">
                {problems.map((p, i) => (
                  <label key={i} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={p.checked} onChange={() => toggleProblem(i)} className="h-3 w-3 accent-brand-600" />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Data Reviewed */}
            <div className="mb-3 rounded-lg border border-slate-200 p-3">
              <p className="mb-2 text-xs font-semibold text-slate-700">
                2. Data Reviewed and Analysed — {MDM_LEVEL_NAMES[dataLevel]}
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
                  <span>Unique tests ordered or results reviewed, and external sources' notes reviewed (count each one)</span>
                  <span className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      aria-label="One fewer"
                      onClick={() => setUniqueItems((n) => Math.max(0, n - 1))}
                      className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 hover:bg-slate-50"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-5 text-center font-semibold" aria-live="polite">{uniqueItems}</span>
                    <button
                      type="button"
                      aria-label="One more"
                      onClick={() => setUniqueItems((n) => Math.min(9, n + 1))}
                      className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 hover:bg-slate-50"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </span>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={independentHistorian} onChange={() => setIndependentHistorian((v) => !v)} className="h-3 w-3 accent-brand-600" />
                  Assessment needing an independent historian
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={independentInterpretation} onChange={() => setIndependentInterpretation((v) => !v)} className="h-3 w-3 accent-brand-600" />
                  Independent interpretation of a test billed by another clinician (e.g. reading the ECG or X-ray)
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={externalDiscussion} onChange={() => setExternalDiscussion((v) => !v)} className="h-3 w-3 accent-brand-600" />
                  Discussion of management or a test with an external clinician
                </label>
              </div>
            </div>

            {/* Risk */}
            <div className="mb-3 rounded-lg border border-slate-200 p-3">
              <p className="mb-2 text-xs font-semibold text-slate-700">
                3. Risk of Patient Management — {MDM_LEVEL_NAMES[riskLevel]}
              </p>
              <div className="space-y-1">
                {risk.map((r, i) => (
                  <label key={i} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={r.checked} onChange={() => toggleRisk(i)} className="h-3 w-3 accent-brand-600" />
                    {r.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Result */}
            <div className={`rounded-xl ${levelColor} p-4`}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    Recommended: CPT {recommended.code} — {recommended.label} {recommended.patientType} Patient
                  </p>
                  <p className="text-xs text-slate-500">
                    MDM {MDM_LEVEL_NAMES[mdm]} · {elementLine("Problems", problemLevel)} · {elementLine("Data", dataLevel)} · {elementLine("Risk", riskLevel)}
                  </p>
                </div>
              </div>
            </div>

            {/* Rationale */}
            <button
              onClick={() => setShowRationale(!showRationale)}
              className="mt-3 flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800"
            >
              <Info className="h-3 w-3" />
              {showRationale ? "Hide" : "Why this level?"}
            </button>
            {showRationale && (
              <div className="mt-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 leading-relaxed">
                <p>
                  The MDM level is the highest level that <strong>at least two of the three</strong> elements reach — the
                  elements are never added together. Here {meets} of 3 elements reach {MDM_LEVEL_NAMES[mdm]}, so the visit
                  supports {MDM_LEVEL_NAMES[mdm].toLowerCase()} MDM: CPT {recommended.code} for {isNewPatient ? "a new" : "an established"} patient.
                </p>
                <p className="mt-1">
                  Data is counted by category: 2 unique items (or an independent historian) is Low; 3 items, an independent
                  interpretation, or an external discussion is Moderate; any two of those three is Extensive.
                </p>
                <p className="mt-1">AMA 2021 office E/M rules — the level is chosen by MDM or by total time on the date of the visit, not both.</p>
              </div>
            )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
