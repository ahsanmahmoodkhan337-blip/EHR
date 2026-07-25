/**
 * RCMDashboard — Executive Revenue Cycle Management Dashboard
 *
 * Full analytics with Recharts: A/R aging, clean claim rate,
 * denial root cause, monthly revenue trend.
 */

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, DollarSign, BarChart3, Download, X } from "lucide-react";

// ─── Mock Data ──────────────────────────────────────────────────────

const AGING_DATA = [
  { bucket: "0-30", amount: 245000 },
  { bucket: "31-60", amount: 128000 },
  { bucket: "61-90", amount: 54000 },
  { bucket: "90+", amount: 32000 },
];

const REVENUE_DATA = [
  { month: "Jan", revenue: 380000 },
  { month: "Feb", revenue: 420000 },
  { month: "Mar", revenue: 395000 },
  { month: "Apr", revenue: 450000 },
  { month: "May", revenue: 410000 },
  { month: "Jun", revenue: 475000 },
];

const DENIAL_DATA = [
  { name: "CO-16 Missing Info", value: 35 },
  { name: "CO-11 Diagnosis Mismatch", value: 25 },
  { name: "PR-27 Expired Auth", value: 20 },
  { name: "CO-50 Not Med Necessary", value: 15 },
  { name: "Other", value: 5 },
];

const COLORS = ["#ef4444", "#f97316", "#eab308", "#3b82f6", "#6b7280"];

// ─── Component ──────────────────────────────────────────────────────

export function RCMDashboard() {
  const [showPanel, setShowPanel] = useState(false);
  const [view, setView] = useState<"provider" | "practice">("practice");

  const cleanClaimRate = 92.4;
  const netCollectionRate = 96.8;
  const totalAR = AGING_DATA.reduce((s, a) => s + a.amount, 0);

  return (
    <div className="relative">
      <button onClick={() => setShowPanel(!showPanel)} className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-medium text-emerald-600 hover:bg-emerald-100">
        <BarChart3 className="h-3.5 w-3.5" /> RCM Dashboard
      </button>
      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/20" onClick={() => setShowPanel(false)}>
          <div className="relative w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl p-5 animate-slide-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div><h3 className="text-sm font-bold text-slate-800">RCM Executive Dashboard</h3><p className="text-[9px] text-slate-400">{view === "practice" ? "Practice View" : "Provider View"}</p></div>
              <div className="flex items-center gap-2">
                <button onClick={() => setView(v => v === "practice" ? "provider" : "practice")} className="rounded-lg border border-slate-200 px-2 py-1 text-[9px]">{view === "practice" ? "Provider View" : "Practice View"}</button>
                <button className="rounded-lg border border-slate-200 px-2 py-1 text-[9px] text-slate-500"><Download className="h-3 w-3 inline mr-1" />Export CSV</button>
                <button onClick={() => setShowPanel(false)} className="text-slate-400"><X className="h-4 w-4" /></button>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                { label: "Total A/R", value: `$${(totalAR / 1000).toFixed(0)}K`, color: "text-blue-600" },
                { label: "Clean Claim Rate", value: `${cleanClaimRate}%`, color: cleanClaimRate >= 95 ? "text-green-600" : "text-amber-600" },
                { label: "Net Collection", value: `${netCollectionRate}%`, color: "text-green-600" },
                { label: "Days in A/R", value: "32", color: "text-amber-600" },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                  <p className="text-[9px] text-slate-400">{kpi.label}</p>
                  <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* A/R Aging */}
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-[10px] font-semibold text-slate-600 mb-2">Days in A/R Aging</p>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={AGING_DATA} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 9 }} />
                    <YAxis dataKey="bucket" type="category" tick={{ fontSize: 9 }} width={40} />
                    <Tooltip />
                    <Bar dataKey="amount" fill="#3b82f6" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Revenue Trend */}
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-[10px] font-semibold text-slate-600 mb-2">Monthly Revenue</p>
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={REVENUE_DATA}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Denial Root Cause */}
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-[10px] font-semibold text-slate-600 mb-2">Denial Root Cause</p>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={DENIAL_DATA} cx="50%" cy="50%" outerRadius={50} dataKey="value" label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {DENIAL_DATA.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 mt-1">
                  {DENIAL_DATA.map((d, i) => (
                    <span key={i} className="flex items-center gap-1 text-[8px] text-slate-500"><span className="h-2 w-2 rounded-full" style={{ background: COLORS[i] }} />{d.name}</span>
                  ))}
                </div>
              </div>

              {/* Clean Claim Gauge */}
              <div className="rounded-xl border border-slate-200 p-3 flex flex-col items-center justify-center">
                <p className="text-[10px] font-semibold text-slate-600 mb-1">Clean Claim Rate</p>
                <div className="relative h-20 w-20">
                  <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831" fill="none" stroke={cleanClaimRate >= 95 ? "#10b981" : "#f59e0b"} strokeWidth="3" strokeDasharray={`${cleanClaimRate}, 100`} />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-700">{cleanClaimRate}%</span>
                </div>
                <p className="text-[8px] text-slate-400 mt-1">Target: 95%</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
