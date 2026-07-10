/**
 * InstructorDashboard — Admin/Instructor Analytics Dashboard
 *
 * Protected by admin login. Shows:
 * - Stats cards: total students, active sessions, completion rate
 * - Student list table with per-stage progress bars
 * - Error heatmap showing most common mistakes
 * - CSV export button for student data
 *
 * Inspiration: Epic Cogito analytics / Canvas instructor dashboard
 */

import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  Users,
  TrendingUp,
  AlertTriangle,
  Download,
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  Shield,
  ArrowRight,
  Search,
} from "lucide-react";

// ─── Mock Instructor Data ─────────────────────────────────────────

interface StudentRecord {
  id: string;
  name: string;
  email: string;
  enrolledDate: string;
  stageProgress: Record<string, "complete" | "in-progress" | "not-started">;
  errors: { stage: string; count: number }[];
  timeSpent: number; // minutes
  score: number;
  active: boolean;
}

const MOCK_STUDENTS: StudentRecord[] = [
  { id: "S001", name: "Aisha Khan", email: "aisha@example.com", enrolledDate: "2026-06-01", stageProgress: { Scribe: "complete", Coder: "complete", Biller: "complete", "Prior Auth": "complete", "AR Voice": "in-progress" }, errors: [{ stage: "Coder", count: 3 }, { stage: "Biller", count: 1 }], timeSpent: 245, score: 88, active: true },
  { id: "S002", name: "Sarah Chen", email: "sarah@example.com", enrolledDate: "2026-06-05", stageProgress: { Scribe: "complete", Coder: "complete", Biller: "in-progress", "Prior Auth": "not-started", "AR Voice": "not-started" }, errors: [{ stage: "Scribe", count: 2 }, { stage: "Coder", count: 5 }], timeSpent: 180, score: 72, active: true },
  { id: "S003", name: "Mohammad Ali", email: "mohammad@example.com", enrolledDate: "2026-06-10", stageProgress: { Scribe: "complete", Coder: "in-progress", Biller: "not-started", "Prior Auth": "not-started", "AR Voice": "not-started" }, errors: [{ stage: "Scribe", count: 1 }], timeSpent: 90, score: 65, active: true },
  { id: "S004", name: "Priya Sharma", email: "priya@example.com", enrolledDate: "2026-06-15", stageProgress: { Scribe: "complete", Coder: "complete", Biller: "complete", "Prior Auth": "complete", "AR Voice": "complete" }, errors: [], timeSpent: 320, score: 95, active: true },
  { id: "S005", name: "David Kim", email: "david@example.com", enrolledDate: "2026-06-20", stageProgress: { Scribe: "in-progress", Coder: "not-started", Biller: "not-started", "Prior Auth": "not-started", "AR Voice": "not-started" }, errors: [], timeSpent: 35, score: 0, active: false },
];

const STAGES = ["Scribe", "Coder", "Biller", "Prior Auth", "AR Voice"];

const STAGE_COLORS: Record<string, string> = {
  complete: "bg-emerald-500",
  "in-progress": "bg-amber-400",
  "not-started": "bg-slate-200 dark:bg-slate-600",
};

const ERROR_COLORS: Record<string, string> = {
  Scribe: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400",
  Coder: "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
  Biller: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
  "Prior Auth": "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400",
  "AR Voice": "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-400",
};

// ─── Route ────────────────────────────────────────────────────────

export const Route = createFileRoute("/instructor")({
  component: InstructorDashboard,
});

// ─── Component ────────────────────────────────────────────────────

function InstructorDashboard() {
  const [search, setSearch] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    if (typeof window !== "undefined") {
      const pw = sessionStorage.getItem("hh_admin_pw");
      return pw === "Khankhail@1122";
    }
    return false;
  });
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    if (password === "Khankhail@1122") {
      sessionStorage.setItem("hh_admin_pw", password);
      setIsLoggedIn(true);
    }
  };

  const filteredStudents = useMemo(() => {
    if (!search) return MOCK_STUDENTS;
    const q = search.toLowerCase();
    return MOCK_STUDENTS.filter(s => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q));
  }, [search]);

  const stats = useMemo(() => {
    const total = MOCK_STUDENTS.length;
    const active = MOCK_STUDENTS.filter(s => s.active).length;
    const completed = MOCK_STUDENTS.filter(s => s.stageProgress["AR Voice"] === "complete").length;
    const avgScore = Math.round(MOCK_STUDENTS.reduce((sum, s) => sum + s.score, 0) / total);
    return { total, active, completed, completionRate: Math.round((completed / total) * 100), avgScore };
  }, []);

  const errorHeatmap = useMemo(() => {
    const map: Record<string, number> = {};
    MOCK_STUDENTS.forEach(s => s.errors.forEach(e => {
      map[e.stage] = (map[e.stage] || 0) + e.count;
    }));
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, []);

  const generateCSV = () => {
    const headers = ["Student", "Email", "Enrolled", "Score", "Time (min)", "Active", ...STAGES.map(s => `${s} Status`)];
    const rows = MOCK_STUDENTS.map(s => [
      s.name, s.email, s.enrolledDate, s.score, s.timeSpent, s.active ? "Yes" : "No",
      ...STAGES.map(st => s.stageProgress[st] || "not-started"),
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ehr_student_report_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">Instructor Login</h2>
          </div>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            placeholder="Enter admin password..."
            className="w-full rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-xs outline-none focus:border-indigo-400 mb-3 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
          />
          <button onClick={handleLogin} className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500">
            Login
          </button>
          <Link to="/" className="mt-2 block text-center text-[10px] text-slate-400 hover:text-slate-600">Back to app</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-5 w-5 text-indigo-600" />
          <h1 className="text-sm font-bold text-slate-800 dark:text-slate-200">Instructor Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/" className="rounded-lg bg-slate-100 dark:bg-slate-700 px-3 py-1.5 text-[10px] font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200">
            Back to App
          </Link>
          <button onClick={() => { sessionStorage.removeItem("hh_admin_pw"); setIsLoggedIn(false); }} className="rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-1.5 text-[10px] font-medium text-red-600 hover:bg-red-100">
            Logout
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl p-4 space-y-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-sm">
            <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-1">
              <Users className="h-3.5 w-3.5" />
              Total Students
            </div>
            <p className="text-xl font-bold text-slate-800 dark:text-slate-200">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-sm">
            <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-1">
              <Activity className="h-3.5 w-3.5" />
              Active Sessions
            </div>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{stats.active}</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-sm">
            <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-1">
              <TrendingUp className="h-3.5 w-3.5" />
              Completion Rate
            </div>
            <p className={`text-xl font-bold ${stats.completionRate >= 50 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>{stats.completionRate}%</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-sm">
            <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-1">
              <BarChart3 className="h-3.5 w-3.5" />
              Avg Score
            </div>
            <p className={`text-xl font-bold ${stats.avgScore >= 80 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>{stats.avgScore}%</p>
          </div>
        </div>

        {/* Error Heatmap + CSV Export */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">Student Progress</h3>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-32 rounded border border-slate-200 dark:border-slate-600 pl-6 pr-2 py-1 text-[10px] outline-none focus:border-indigo-400 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="py-2 pr-2 font-semibold text-slate-500">Student</th>
                    <th className="py-2 px-2 font-semibold text-slate-500">Score</th>
                    <th className="py-2 px-2 font-semibold text-slate-500">Time</th>
                    {STAGES.map(s => <th key={s} className="py-2 px-1 font-semibold text-slate-500 text-center">{s}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map(s => (
                    <tr key={s.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="py-2 pr-2">
                        <p className="font-medium text-slate-800 dark:text-slate-200">{s.name}</p>
                        <p className="text-[9px] text-slate-400">{s.email}</p>
                      </td>
                      <td className="py-2 px-2">
                        <span className={`font-bold ${s.score >= 80 ? "text-emerald-600" : s.score >= 50 ? "text-amber-600" : "text-slate-400"}`}>{s.score}%</span>
                      </td>
                      <td className="py-2 px-2 text-slate-500">{s.timeSpent}m</td>
                      {STAGES.map(st => {
                        const status = s.stageProgress[st] || "not-started";
                        return (
                          <td key={st} className="py-2 px-1 text-center">
                            <div className="mx-auto h-4 w-4 rounded-full" style={{ backgroundColor: status === "complete" ? "#10b981" : status === "in-progress" ? "#f59e0b" : "#e2e8f0" }} title={status} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Error Heatmap */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">Error Heatmap</h3>
              <button onClick={generateCSV} className="flex items-center gap-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 text-[9px] font-medium text-indigo-600 hover:bg-indigo-100">
                <Download className="h-3 w-3" />
                CSV
              </button>
            </div>
            {errorHeatmap.length === 0 ? (
              <p className="text-[10px] text-slate-400 italic">No errors recorded</p>
            ) : (
              <div className="space-y-2">
                {errorHeatmap.map(([stage, count]) => {
                  const maxCount = errorHeatmap[0][1];
                  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                  return (
                    <div key={stage}>
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="font-medium text-slate-600 dark:text-slate-400">{stage}</span>
                        <span className="text-slate-400">{count} errors</span>
                      </div>
                      <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                        <div className="h-3 rounded-full bg-gradient-to-r from-amber-400 to-red-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
              <p className="text-[9px] text-slate-400">Most common errors by stage. Higher bars = more frequent mistakes.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}