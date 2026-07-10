/**
 * FinancialLedger — Right Sidebar Financial KPIs with Recharts
 *
 * Shows billing performance metrics: clean claim rate,
 * total billed, collected, denied, days in A/R.
 * Ring chart for Clean Claim Rate, bar chart for denial breakdown,
 * line chart for revenue trend.
 */

import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, Activity, PiggyBank } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, CartesianGrid } from "recharts";

interface FinancialLedgerProps {
  totalBilled: number;
  totalCollected: number;
  totalDenied: number;
  daysInAR: number;
}

const COLORS = {
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  primary: "#6366f1",
  muted: "#94a3b8",
};

export function FinancialLedger({ totalBilled, totalCollected, totalDenied, daysInAR }: FinancialLedgerProps) {
  const cleanClaimRate = totalBilled > 0 ? Math.round(((totalBilled - totalDenied) / totalBilled) * 100) : 100;
  const netCollectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;
  const rateColor = cleanClaimRate >= 90 ? "text-emerald-600 dark:text-emerald-400" : cleanClaimRate >= 75 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400";
  const barColor = cleanClaimRate >= 90 ? "bg-emerald-500" : cleanClaimRate >= 75 ? "bg-amber-500" : "bg-rose-500";

  // Pie chart data
  const pieData = [
    { name: "Clean Claims", value: totalBilled - totalDenied },
    { name: "Denied", value: totalDenied },
  ];

  // Denial breakdown mock data
  const denialBreakdown = [
    { reason: "CO-16", count: 4 },
    { reason: "CO-50", count: 3 },
    { reason: "CO-119", count: 2 },
    { reason: "PR-1", count: 1 },
  ];

  // Revenue trend mock data
  const revenueTrend = [
    { month: "Jan", revenue: 3200 },
    { month: "Feb", revenue: 4100 },
    { month: "Mar", revenue: 3800 },
    { month: "Apr", revenue: 5200 },
    { month: "May", revenue: 4800 },
    { month: "Jun", revenue: 4500 },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-2">
        <PiggyBank className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Financial Ledger</span>
      </div>

      {/* Clean Claim Rate — Pie Chart */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Clean Claim Rate</span>
          <span className={`text-sm font-bold ${rateColor}`}>{cleanClaimRate}%</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-16 w-16 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={20}
                  outerRadius={30}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                >
                  <Cell fill={cleanClaimRate >= 90 ? COLORS.success : cleanClaimRate >= 75 ? COLORS.warning : COLORS.danger} />
                  <Cell fill="#e2e8f0" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 text-[10px] text-slate-500 dark:text-slate-400">
            <div className="flex items-center justify-between">
              <span>Clean</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">${(totalBilled - totalDenied).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Denied</span>
              <span className="font-medium text-rose-600 dark:text-rose-400">${totalDenied.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 shadow-sm">
          <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
            <DollarSign className="h-3 w-3" />
            Total Billed
          </div>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">${totalBilled.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 shadow-sm">
          <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
            <TrendingUp className="h-3 w-3" />
            Collected
          </div>
          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">${totalCollected.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 shadow-sm">
          <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
            <TrendingDown className="h-3 w-3" />
            Denied
          </div>
          <p className="text-sm font-bold text-rose-600 dark:text-rose-400">${totalDenied.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 shadow-sm">
          <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
            <Activity className="h-3 w-3" />
            Days in A/R
          </div>
          <p className={`text-sm font-bold ${daysInAR > 45 ? "text-rose-600 dark:text-rose-400" : daysInAR > 30 ? "text-amber-600 dark:text-amber-400" : "text-slate-800 dark:text-slate-200"}`}>
            {daysInAR}d
          </p>
        </div>
      </div>

      {/* Net Collection Rate */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Net Collection Rate</span>
          <span className={`text-xs font-bold ${netCollectionRate >= 90 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
            {netCollectionRate}%
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-700">
          <div className={`h-1.5 rounded-full ${netCollectionRate >= 90 ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${Math.min(netCollectionRate, 100)}%` }} />
        </div>
        {netCollectionRate < 90 && (
          <p className="mt-1 flex items-center gap-1 text-[9px] text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-2.5 w-2.5" />
            Below 90% target
          </p>
        )}
      </div>

      {/* Denial Breakdown — Bar Chart */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-sm">
        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-2 block">Denial by Reason Code</span>
        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={denialBreakdown} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="reason" tick={{ fontSize: 9, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 10, borderRadius: 8, border: "1px solid #e2e8f0" }}
                formatter={(value: number) => [`${value} claims`, "Count"]}
              />
              <Bar dataKey="count" fill={COLORS.danger} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Revenue Trend — Line Chart */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-sm">
        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-2 block">Revenue Trend</span>
        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revenueTrend} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} />
              <Tooltip
                contentStyle={{ fontSize: 10, borderRadius: 8, border: "1px solid #e2e8f0" }}
                formatter={(value: number) => [`$${value.toLocaleString()}`, "Revenue"]}
              />
              <Line type="monotone" dataKey="revenue" stroke={COLORS.primary} strokeWidth={2} dot={{ r: 2, fill: COLORS.primary }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}