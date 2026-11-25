/**
 * FinancialLedger — Right Sidebar Financial KPIs with Recharts
 *
 * Shows billing performance metrics: clean claim rate,
 * total billed, collected, denied, days in A/R.
 * Ring chart for Clean Claim Rate, bar chart for denial breakdown,
 * line chart for revenue trend.
 */

import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, Activity, PiggyBank } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

interface FinancialLedgerProps {
  totalBilled: number;
  totalCollected: number;
  totalDenied: number;
  daysInAR: number;
  /** CARCs on this encounter's denied 835 lines — one entry per adjustment. */
  deniedCarcs?: string[];
}

const COLORS = {
  success: "var(--color-success)",
  warning: "var(--color-warn)",
  danger: "var(--color-danger)",
  primary: "var(--color-brand-600)",
  muted: "var(--color-ink-muted)",
};

export function FinancialLedger({ totalBilled, totalCollected, totalDenied, daysInAR, deniedCarcs = [] }: FinancialLedgerProps) {
  const cleanClaimRate = totalBilled > 0 ? Math.round(((totalBilled - totalDenied) / totalBilled) * 100) : 100;
  const netCollectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;
  const rateColor = cleanClaimRate >= 90 ? "text-green-600 dark:text-green-400" : cleanClaimRate >= 75 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
  
  // Pie chart data
  const pieData = [
    { name: "Clean Claims", value: totalBilled - totalDenied },
    { name: "Denied", value: totalDenied },
  ];

  // Denials on this encounter's posted 835, by reason code. (Was a fixed mock
  // list of CO-16/CO-50/... shown as if it were the student's own denials.)
  const denialBreakdown = Object.entries(
    deniedCarcs.reduce<Record<string, number>>((acc, code) => {
      acc[code] = (acc[code] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([reason, count]) => ({ reason, count }));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-2">
        <PiggyBank className="h-4 w-4 text-brand-600 dark:text-brand-500" />
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
                  <Cell fill="var(--color-line)" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 text-[10px] text-slate-500 dark:text-slate-400">
            <div className="flex items-center justify-between">
              <span>Clean</span>
              <span className="font-medium text-green-600 dark:text-green-400">${(totalBilled - totalDenied).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Denied</span>
              <span className="font-medium text-red-600 dark:text-red-400">${totalDenied.toLocaleString()}</span>
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
          <p className="text-sm font-bold text-green-600 dark:text-green-400">${totalCollected.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 shadow-sm">
          <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
            <TrendingDown className="h-3 w-3" />
            Denied
          </div>
          <p className="text-sm font-bold text-red-600 dark:text-red-400">${totalDenied.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 shadow-sm">
          <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
            <Activity className="h-3 w-3" />
            Days in A/R
          </div>
          <p className={`text-sm font-bold ${daysInAR > 45 ? "text-red-600 dark:text-red-400" : daysInAR > 30 ? "text-amber-600 dark:text-amber-400" : "text-slate-800 dark:text-slate-200"}`}>
            {daysInAR}d
          </p>
        </div>
      </div>

      {/* Net Collection Rate */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Net Collection Rate</span>
          <span className={`text-xs font-bold ${netCollectionRate >= 90 ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
            {netCollectionRate}%
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-700">
          <div className={`h-1.5 rounded-full ${netCollectionRate >= 90 ? "bg-green-500" : "bg-amber-500"}`} style={{ width: `${Math.min(netCollectionRate, 100)}%` }} />
        </div>
        {netCollectionRate < 90 && (
          <p className="mt-1 flex items-center gap-1 text-[9px] text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-2.5 w-2.5" />
            Below 90% target
          </p>
        )}
      </div>

      {/* Denial Breakdown — Bar Chart */}
      {denialBreakdown.length > 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-sm">
        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-2 block">Denial by Reason Code</span>
        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={denialBreakdown} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
              <XAxis dataKey="reason" tick={{ fontSize: 9, fill: "var(--color-ink-muted)" }} />
              <YAxis tick={{ fontSize: 9, fill: "var(--color-ink-muted)" }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 10, borderRadius: 8, border: "1px solid var(--color-line)" }}
                formatter={((value: number) => [`${value} claims`, "Count"]) as any}
              />
              <Bar dataKey="count" fill={COLORS.danger} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-[10px] text-slate-500 shadow-sm">
          <span className="mb-1 block font-semibold text-slate-500">Denial by Reason Code</span>
          No denied lines on this claim{totalBilled > 0 ? "" : " yet"}.
        </div>
      )}
    </div>
  );
}