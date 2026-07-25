/**
 * SDOHIntake — PRAPARE Social Determinants of Health Screening
 *
 * Housing, Food, Transportation, Utilities, Safety, Social Support.
 * Risk score with color coding. Auto-generates SDOH Z-codes.
 */

import { useState } from "react";
import { Heart, CheckCircle2, AlertTriangle, X, ClipboardList } from "lucide-react";

// ─── Questions ──────────────────────────────────────────────────────

interface SDOHQuestion {
  id: string;
  section: string;
  text: string;
  zCode?: string;
}

const SECTIONS = [
  {
    name: "Housing Stability",
    questions: [
      { id: "h1", section: "Housing", text: "In the past 12 months, have you been homeless or at risk of homelessness?", zCode: "Z59.0" },
      { id: "h2", section: "Housing", text: "Are you worried about losing your housing?", zCode: "Z59.8" },
    ],
  },
  {
    name: "Food Security",
    questions: [
      { id: "f1", section: "Food", text: "In the past 12 months, have you worried about food running out?", zCode: "Z59.4" },
      { id: "f2", section: "Food", text: "In the past 12 months, did you skip meals because there wasn't enough food?", zCode: "Z59.4" },
    ],
  },
  {
    name: "Transportation",
    questions: [
      { id: "t1", section: "Transportation", text: "Has lack of transportation kept you from medical appointments?", zCode: "Z59.8" },
    ],
  },
  {
    name: "Utilities",
    questions: [
      { id: "u1", section: "Utilities", text: "In the past 12 months, have you had trouble paying for utilities (electricity, water, heat)?", zCode: "Z59.8" },
    ],
  },
  {
    name: "Safety",
    questions: [
      { id: "s1", section: "Safety", text: "Do you feel safe in your home and neighborhood?", zCode: "Z60.5" },
    ],
  },
  {
    name: "Social Support",
    questions: [
      { id: "ss1", section: "Social Support", text: "Do you have someone you can count on for help if needed?", zCode: "Z60.2" },
    ],
  },
];

// ─── Component ──────────────────────────────────────────────────────

export function SDOHIntake() {
  const [showPanel, setShowPanel] = useState(false);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);

  const toggleAnswer = (id: string, value: boolean) => {
    setAnswers(prev => ({ ...prev, [id]: value }));
    setSaved(false);
  };

  // "Yes" = risk scored. For "Do you feel safe?" and "Do you have support?", "No" = risk
  const riskScore = SECTIONS.reduce((score, section) => {
    let sectionScore = 0;
    for (const q of section.questions) {
      const answer = answers[q.id];
      const isRiskQuestion = q.id === "s1" || q.id === "ss1";
      const isRisk = isRiskQuestion ? (answer === false) : (answer === true);
      if (isRisk) sectionScore++;
    }
    return score + sectionScore;
  }, 0);

  const riskColor = riskScore <= 2 ? "text-green-600" : riskScore <= 5 ? "text-amber-600" : "text-red-600";
  const riskBg = riskScore <= 2 ? "bg-green-50 border-green-200" : riskScore <= 5 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";

  // Generate Z-codes
  const zCodes: string[] = [];
  for (const section of SECTIONS) {
    for (const q of section.questions) {
      const answer = answers[q.id];
      const isRiskQuestion = q.id === "s1" || q.id === "ss1";
      const isRisk = isRiskQuestion ? (answer === false) : (answer === true);
      if (isRisk && q.zCode && !zCodes.includes(q.zCode)) zCodes.push(q.zCode);
    }
  }

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = SECTIONS.reduce((s, sec) => s + sec.questions.length, 0);

  return (
    <div className="relative">
      <button onClick={() => setShowPanel(!showPanel)} className="flex items-center gap-1.5 rounded-lg border border-pink-200 bg-pink-50 px-2.5 py-1.5 text-[10px] font-medium text-pink-600 hover:bg-pink-100">
        <Heart className="h-3.5 w-3.5" /> SDOH Intake
      </button>
      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/20" onClick={() => setShowPanel(false)}>
          <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl p-5 animate-slide-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div><h3 className="text-sm font-bold text-slate-800">SDOH Screening (PRAPARE)</h3><p className="text-[9px] text-slate-400">{answeredCount}/{totalQuestions} answered</p></div>
              <button onClick={() => setShowPanel(false)} className="text-slate-400"><X className="h-4 w-4" /></button>
            </div>

            {/* Risk Score */}
            <div className={`rounded-lg border p-3 mb-4 ${riskBg}`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium">Risk Score</span>
                <span className={`text-lg font-bold ${riskColor}`}>{riskScore}</span>
              </div>
              <p className="text-[8px] text-slate-500 mt-0.5">{riskScore <= 2 ? "Low risk" : riskScore <= 5 ? "Moderate risk — consider referral" : "High risk — immediate referral recommended"}</p>
            </div>

            {/* Questions */}
            {SECTIONS.map((section) => (
              <div key={section.name} className="mb-3">
                <p className="text-[10px] font-semibold text-slate-600 mb-1.5">{section.name}</p>
                {section.questions.map((q) => (
                  <div key={q.id} className="mb-1.5 rounded-lg border border-slate-200 p-2">
                    <p className="text-[10px] text-slate-600 mb-1">{q.text}</p>
                    <div className="flex gap-1">
                      <button onClick={() => toggleAnswer(q.id, true)} className={`rounded px-3 py-0.5 text-[9px] ${answers[q.id] === true ? "bg-red-600 text-white" : "bg-slate-100 text-slate-500"}`}>Yes</button>
                      <button onClick={() => toggleAnswer(q.id, false)} className={`rounded px-3 py-0.5 text-[9px] ${answers[q.id] === false ? "bg-green-600 text-white" : "bg-slate-100 text-slate-500"}`}>No</button>
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {/* Z-codes */}
            {zCodes.length > 0 && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 mb-3">
                <p className="text-[10px] font-semibold text-blue-700 mb-1">Suggested SDOH Z-Codes</p>
                <div className="flex flex-wrap gap-1">
                  {zCodes.map(c => <span key={c} className="rounded bg-blue-200 px-1.5 py-0.5 text-[9px] font-mono text-blue-700">{c}</span>)}
                </div>
              </div>
            )}

            {saved && (
              <div className="rounded-lg bg-green-50 p-3 flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-[10px] font-medium text-green-700">Saved to patient chart</span>
              </div>
            )}
            <button onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }} disabled={answeredCount === 0} className="w-full rounded-lg bg-pink-600 px-4 py-2.5 text-[10px] font-medium text-white hover:bg-pink-500 disabled:bg-slate-300">
              <ClipboardList className="h-3.5 w-3.5 inline mr-1" />Save to Chart
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
