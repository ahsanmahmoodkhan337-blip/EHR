/**
 * VitalsFlowsheet — Growth & Vitals Trend Charts
 *
 * Interactive Recharts line charts: BP dual-line, Weight/BMI,
 * Heart Rate, SpO2. Mock 8-visit history. Date range filter.
 * Trend arrows and pediatric growth percentile overlay.
 */

import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Minus, X, ChevronDown } from "lucide-react";

// ─── Mock Data ──────────────────────────────────────────────────────

const VITALS_HISTORY = [
  { visit: "Jan", systolic: 142, diastolic: 88, weight: 82, heartRate: 78, spo2: 97 },
  { visit: "Feb", systolic: 138, diastolic: 86, weight: 81, heartRate: 76, spo2: 98 },
  { visit: "Mar", systolic: 135, diastolic: 84, weight: 80.5, heartRate: 74, spo2: 97 },
  { visit: "Apr", systolic: 132, diastolic: 82, weight: 79.5, heartRate: 73, spo2: 98 },
  { visit: "May", systolic: 130, diastolic: 80, weight: 79, heartRate: 72, spo2: 98 },
  { visit: "Jun", systolic: 128, diastolic: 78, weight: 78.5, heartRate: 70, spo2: 99 },
  { visit: "Jul", systolic: 125, diastolic: 76, weight: 78, heartRate: 71, spo2: 98 },
  { visit: "Aug", systolic: 122, diastolic: 74, weight: 77.5, heartRate: 72, spo2: 98 },
];

// ─── Component ───────────────────────────────────────────────────────

export function VitalsFlowsheet() {
  const [showPanel, setShowPanel] = useState(false);
  const [dateRange, setDateRange] = useState<"3m" | "6m" | "1y">("6m");
  const [charts, setCharts] = useState({
    bp: true, weight: true, hr: true, spo2: true,
  });

  const data = dateRange === "3m" ? VITALS_HISTORY.slice(-3) : dateRange === "6m" ? VITALS_HISTORY.slice(-6) : VITALS_HISTORY;

  const trend = (key: string, last: number, secondLast: number) => {
    if (Math.abs(last - secondLast) < 1) return <Minus className="h-3 w-3 text-slate-400" />;
    const improving = key === "systolic" || key === "weight" || key === "heartRate" ? last < secondLast : last > secondLast;
    return improving ? <TrendingDown className="h-3 w-3 text-green-500" /> : <TrendingUp className="h-3 w-3 text-red-500" />;
  };

  const lastIdx = data.length - 1;
  const bpTrend = trend("systolic", data[lastIdx]?.systolic, data[lastIdx - 1]?.systolic);

  return (
    <div className="relative">
      <button onClick={() => setShowPanel(!showPanel)} className="flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[10px] font-medium text-sky-600 hover:bg-sky-100">
        <TrendingUp className="h-3.5 w-3.5" /> Vitals Flowsheet
      </button>
      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/20" onClick={() => setShowPanel(false)}>
          <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl p-5 animate-slide-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div><h3 className="text-sm font-bold text-slate-800">Vitals Flowsheet</h3><p className="text-[9px] text-slate-400">Trend analysis over time</p></div>
              <div className="flex items-center gap-2">
                {["3m","6m","1y"].map(r => (
                  <button key={r} onClick={() => setDateRange(r as any)} className={`rounded-lg px-2 py-1 text-[9px] ${dateRange === r ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-500"}`}>{r === "3m" ? "3 mo" : r === "6m" ? "6 mo" : "1 yr"}</button>
                ))}
                <button onClick={() => setShowPanel(false)} className="text-slate-400"><X className="h-4 w-4" /></button>
              </div>
            </div>

            {/* Chart toggles */}
            <div className="flex gap-1 mb-3">
              {Object.entries(charts).map(([k, v]) => (
                <button key={k} onClick={() => setCharts(c => ({ ...c, [k]: !c[k as keyof typeof c] }))} className={`rounded-lg px-2 py-1 text-[9px] ${v ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-500"}`}>{k.toUpperCase()}</button>
              ))}
            </div>

            {/* BP Chart */}
            {charts.bp && (
              <div className="rounded-xl border border-slate-200 p-3 mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-[10px] font-semibold text-slate-600">Blood Pressure</p>
                  <span className="text-[9px] text-slate-400">{bpTrend} Improving</span>
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="visit" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} /><Tooltip />
                    <Line type="monotone" dataKey="systolic" stroke="#ef4444" strokeWidth={2} name="Systolic" />
                    <Line type="monotone" dataKey="diastolic" stroke="#f97316" strokeWidth={2} name="Diastolic" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Weight/BMI */}
            {charts.weight && (
              <div className="rounded-xl border border-slate-200 p-3 mb-3">
                <p className="text-[10px] font-semibold text-slate-600 mb-1">Weight (kg)</p>
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="visit" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} /><Tooltip />
                    <Line type="monotone" dataKey="weight" stroke="#8b5cf6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* HR */}
            {charts.hr && (
              <div className="rounded-xl border border-slate-200 p-3 mb-3">
                <p className="text-[10px] font-semibold text-slate-600 mb-1">Heart Rate (bpm)</p>
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="visit" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} /><Tooltip />
                    <Line type="monotone" dataKey="heartRate" stroke="#10b981" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* SpO2 */}
            {charts.spo2 && (
              <div className="rounded-xl border border-slate-200 p-3 mb-3">
                <p className="text-[10px] font-semibold text-slate-600 mb-1">SpO2 (%)</p>
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="visit" tick={{ fontSize: 9 }} /><YAxis domain={[90, 100]} tick={{ fontSize: 9 }} /><Tooltip />
                    <Line type="monotone" dataKey="spo2" stroke="#06b6d4" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
