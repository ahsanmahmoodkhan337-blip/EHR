/**
 * MDMWizard — E/M Medical Decision Making Level Calculator
 *
 * Evaluates SOAP notes and auto-calculates CPT 99202-99215 coding
 * levels based on AMA MDM guidelines. Three elements:
 * 1. Number/Complexity of Problems
 * 2. Amount/Complexity of Data Reviewed
 * 3. Risk of Complications
 *
 * Wire as a toggle panel in the scribe workspace.
 */

import { useState } from "react";
import { Calculator, ChevronDown, ChevronUp, CheckCircle2, Info, X } from "lucide-react";

// ─── MDM Data ───────────────────────────────────────────────────────

interface MDMLevel {
  problems: { label: string; points: number; checked: boolean }[];
  data: { label: string; points: number; checked: boolean }[];
  risk: { label: string; points: number; checked: boolean }[];
}

const PROBLEM_LEVELS = [
  { label: "1 self-limited or minor problem", points: 1 },
  { label: "2+ self-limited problems", points: 1 },
  { label: "1 stable chronic illness", points: 2 },
  { label: "1 acute uncomplicated illness", points: 2 },
  { label: "2+ stable chronic illnesses", points: 3 },
  { label: "1+ chronic illness with exacerbation", points: 3 },
  { label: "1+ chronic illness with severe exacerbation", points: 4 },
];

const DATA_LEVELS = [
  { label: "Review of external notes (1-2 docs)", points: 1 },
  { label: "Review of lab tests (1-2 tests)", points: 1 },
  { label: "Independent historian", points: 2 },
  { label: "Review of 3+ lab/imaging tests", points: 2 },
  { label: "Discussion with external provider", points: 2 },
  { label: "Independent review of imaging/tracing", points: 3 },
  { label: "Review of extensive external records", points: 3 },
];

const RISK_LEVELS = [
  { label: "Minimal risk (OTC meds, self-limited)", points: 1 },
  { label: "Low risk (prescription management)", points: 1 },
  { label: "Moderate risk (prescription drug mgmt)", points: 2 },
  { label: "Moderate risk (minor surgery, IV fluids)", points: 2 },
  { label: "High risk (major surgery, drug toxicity monitoring)", points: 3 },
  { label: "High risk (life-threatening condition)", points: 4 },
];

// ─── Level Mapping ──────────────────────────────────────────────────

interface EMLevel {
  code: string;
  label: string;
  patientType: string;
  minTotal: number;
}

const NEW_PATIENT_LEVELS: EMLevel[] = [
  { code: "99202", label: "Level 2", patientType: "New", minTotal: 2 },
  { code: "99203", label: "Level 3", patientType: "New", minTotal: 4 },
  { code: "99204", label: "Level 4", patientType: "New", minTotal: 6 },
  { code: "99205", label: "Level 5", patientType: "New", minTotal: 8 },
];

const ESTABLISHED_LEVELS: EMLevel[] = [
  { code: "99212", label: "Level 2", patientType: "Established", minTotal: 2 },
  { code: "99213", label: "Level 3", patientType: "Established", minTotal: 3 },
  { code: "99214", label: "Level 4", patientType: "Established", minTotal: 5 },
  { code: "99215", label: "Level 5", patientType: "Established", minTotal: 7 },
];

// ─── Component ──────────────────────────────────────────────────────

export function MDMWizard() {
  const [open, setOpen] = useState(false);
  const [problems, setProblems] = useState(PROBLEM_LEVELS.map((p) => ({ ...p, checked: false })));
  const [data, setData] = useState(DATA_LEVELS.map((d) => ({ ...d, checked: false })));
  const [risk, setRisk] = useState(RISK_LEVELS.map((r) => ({ ...r, checked: false })));
  const [isNewPatient, setIsNewPatient] = useState(false);
  const [showRationale, setShowRationale] = useState(false);

  const toggleProblem = (idx: number) => {
    const updated = [...problems];
    updated[idx].checked = !updated[idx].checked;
    setProblems(updated);
  };
  const toggleData = (idx: number) => {
    const updated = [...data];
    updated[idx].checked = !updated[idx].checked;
    setData(updated);
  };
  const toggleRisk = (idx: number) => {
    const updated = [...risk];
    updated[idx].checked = !updated[idx].checked;
    setRisk(updated);
  };

  const problemScore = problems.filter((p) => p.checked).reduce((s, p) => s + p.points, 0);
  const dataScore = data.filter((d) => d.checked).reduce((s, d) => s + d.points, 0);
  const riskScore = risk.filter((r) => r.checked).reduce((s, r) => s + r.points, 0);
  const totalScore = problemScore + dataScore + riskScore;

  const levels = isNewPatient ? NEW_PATIENT_LEVELS : ESTABLISHED_LEVELS;
  let recommendedLevel: EMLevel = levels[0];
  for (const l of levels) {
    if (totalScore >= l.minTotal) recommendedLevel = l;
  }

  const levelColors = ["bg-slate-100", "bg-blue-100", "bg-green-100", "bg-amber-100", "bg-red-100"];
  const levelIdx = levels.indexOf(recommendedLevel);
  const levelColor = levelColors[Math.min(levelIdx + 1, 4)];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[10px] font-medium text-indigo-600 hover:bg-indigo-100 transition-colors"
      >
        <Calculator className="h-3.5 w-3.5" />
        E/M MDM Wizard
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/20" onClick={() => setOpen(false)}>
          <div
            className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl p-5 animate-slide-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">E/M MDM Level Calculator</h3>
                <p className="text-[10px] text-slate-500">Check the boxes to determine coding level</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Patient Type Toggle */}
            <div className="mb-3 flex items-center gap-3">
              <span className="text-[10px] font-medium text-slate-500">Patient Type:</span>
              <button
                onClick={() => setIsNewPatient(false)}
                className={`rounded-lg px-3 py-1 text-[10px] font-medium ${!isNewPatient ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}
              >
                Established
              </button>
              <button
                onClick={() => setIsNewPatient(true)}
                className={`rounded-lg px-3 py-1 text-[10px] font-medium ${isNewPatient ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}
              >
                New Patient
              </button>
            </div>

            {/* Problem Complexity */}
            <div className="mb-3 rounded-lg border border-slate-200 p-3">
              <p className="mb-2 text-[10px] font-semibold text-slate-700">
                1. Number/Complexity of Problems ({problemScore} pts)
              </p>
              <div className="space-y-1">
                {problems.map((p, i) => (
                  <label key={i} className="flex items-center gap-2 text-[10px] text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={p.checked} onChange={() => toggleProblem(i)} className="h-3 w-3 accent-indigo-500" />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Data Reviewed */}
            <div className="mb-3 rounded-lg border border-slate-200 p-3">
              <p className="mb-2 text-[10px] font-semibold text-slate-700">
                2. Data Reviewed ({dataScore} pts)
              </p>
              <div className="space-y-1">
                {data.map((d, i) => (
                  <label key={i} className="flex items-center gap-2 text-[10px] text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={d.checked} onChange={() => toggleData(i)} className="h-3 w-3 accent-indigo-500" />
                    {d.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Risk */}
            <div className="mb-3 rounded-lg border border-slate-200 p-3">
              <p className="mb-2 text-[10px] font-semibold text-slate-700">
                3. Risk of Complications ({riskScore} pts)
              </p>
              <div className="space-y-1">
                {risk.map((r, i) => (
                  <label key={i} className="flex items-center gap-2 text-[10px] text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={r.checked} onChange={() => toggleRisk(i)} className="h-3 w-3 accent-indigo-500" />
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
                    Recommended: CPT {recommendedLevel.code} — {recommendedLevel.label} {recommendedLevel.patientType} Patient
                  </p>
                  <p className="text-[10px] text-slate-500">Total MDM Score: {totalScore} (P:{problemScore} D:{dataScore} R:{riskScore})</p>
                </div>
              </div>
            </div>

            {/* Rationale */}
            <button
              onClick={() => setShowRationale(!showRationale)}
              className="mt-3 flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-800"
            >
              <Info className="h-3 w-3" />
              {showRationale ? "Hide" : "Why this level?"}
            </button>
            {showRationale && (
              <div className="mt-2 rounded-lg bg-slate-50 p-3 text-[10px] text-slate-600 leading-relaxed">
                <p>The coding level is determined by the <strong>highest 2 out of 3</strong> MDM elements. For {isNewPatient ? "new" : "established"} patients, CPT {recommendedLevel.code} requires a total of at least {recommendedLevel.minTotal} combined points. Your selection reached {totalScore} points, qualifying for Level {recommendedLevel.label}.</p>
                <p className="mt-1">This aligns with CMS 2021 E/M guidelines — only MDM or Time (not both) is used to determine the level.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
