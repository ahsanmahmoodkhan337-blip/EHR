/**
 * MIPSDashboard — MIPS Quality Performance Dashboard
 *
 * Tracks CMS Quality Measures compliance with visual gauge.
 * CSS bars only — no Recharts dependency needed.
 */

import { useState } from "react";
import { Award, BarChart3, TrendingUp, Send, X, CheckCircle2 } from "lucide-react";

// ─── MIPS Measures ──────────────────────────────────────────────────

interface Measure {
  id: string;
  name: string;
  numerator: number;
  denominator: number;
  target: number;
}

const MIPS_MEASURES: Measure[] = [
  { id: "MIPS-001", name: "HbA1c Poor Control (<9%)", numerator: 82, denominator: 100, target: 80 },
  { id: "MIPS-002", name: "Depression Screening", numerator: 65, denominator: 100, target: 75 },
  { id: "MIPS-003", name: "BP Control (<140/90)", numerator: 78, denominator: 100, target: 70 },
  { id: "MIPS-004", name: "Mammogram Screening", numerator: 58, denominator: 100, target: 65 },
  { id: "MIPS-005", name: "Tobacco Cessation Counseling", numerator: 91, denominator: 100, target: 85 },
  { id: "MIPS-006", name: "Statin Therapy for CVD", numerator: 72, denominator: 100, target: 70 },
];

// ─── Component ──────────────────────────────────────────────────────

export function MIPSDashboard() {
  const [measures, setMeasures] = useState(MIPS_MEASURES);
  const [showPanel, setShowPanel] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const performanceRate = (n: number, d: number) => Math.round((n / d) * 100);

  const totalPoints = measures.reduce((s, m) => {
    const rate = performanceRate(m.numerator, m.denominator);
    const metTarget = rate >= m.target;
    return s + (metTarget ? 10 : Math.floor((rate / m.target) * 10));
  }, 0);
  const maxPoints = measures.length * 10;
  const compositeScore = Math.round((totalPoints / maxPoints) * 100);

  const scoreColor = compositeScore >= 80 ? "text-green-600" : compositeScore >= 60 ? "text-amber-600" : "text-red-600";

  const statusColor = (rate: number, target: number) => {
    if (rate >= target) return "border-green-200 bg-green-50";
    if (rate >= target * 0.8) return "border-amber-200 bg-amber-50";
    return "border-red-200 bg-red-50";
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1.5 text-[10px] font-medium text-purple-600 hover:bg-purple-100 transition-colors"
      >
        <Award className="h-3.5 w-3.5" />
        MIPS Score: {compositeScore}
      </button>

      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/20" onClick={() => setShowPanel(false)}>
          <div className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl p-5 animate-slide-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">MIPS Quality Dashboard</h3>
                <p className="text-[9px] text-slate-400">CMS Quality Payment Program — Performance Year 2026</p>
              </div>
              <button onClick={() => setShowPanel(false)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
            </div>

            {/* Composite Score Gauge */}
            <div className="rounded-xl border-2 border-purple-200 bg-purple-50 p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold text-purple-700">MIPS Composite Score</p>
                  <p className={`text-3xl font-bold ${scoreColor}`}>{compositeScore}</p>
                  <p className="text-[9px] text-slate-500">out of 100</p>
                </div>
                <div className="w-28">
                  <div className="h-4 w-full rounded-full bg-slate-200">
                    <div
                      className={`h-4 rounded-full ${compositeScore >= 80 ? "bg-green-500" : compositeScore >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${compositeScore}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[8px] text-slate-400 mt-0.5">
                    <span>0</span><span>50</span><span>100</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Measures */}
            <div className="space-y-2 mb-4">
              <p className="text-[10px] font-semibold text-slate-600">Quality Measures</p>
              {measures.map((m) => {
                const rate = performanceRate(m.numerator, m.denominator);
                return (
                  <div key={m.id} className={`rounded-lg border p-3 ${statusColor(rate, m.target)}`}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] font-medium text-slate-700">{m.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                        rate >= m.target ? "bg-green-500 text-white" : rate >= m.target * 0.8 ? "bg-amber-500 text-white" : "bg-red-500 text-white"
                      }`}>
                        {rate}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-slate-200">
                        <div
                          className={`h-2 rounded-full ${rate >= m.target ? "bg-green-500" : rate >= m.target * 0.8 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                      <span className="text-[8px] text-slate-400 shrink-0">
                        {m.numerator}/{m.denominator}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[8px] text-slate-400">Target: {m.target}%</p>
                  </div>
                );
              })}
            </div>

            {/* Submit */}
            {submitted ? (
              <div className="rounded-lg bg-green-50 border border-green-200 p-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-[10px] font-medium text-green-700">Submitted to QPP successfully!</span>
              </div>
            ) : (
              <button
                onClick={() => setSubmitted(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-[10px] font-medium text-white hover:bg-purple-500"
              >
                <Send className="h-3.5 w-3.5" />
                Submit to QPP
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
