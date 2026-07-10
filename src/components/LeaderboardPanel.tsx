/**
 * LeaderboardPanel — Top 5 Students by XP
 *
 * Slides out from a trophy icon in the header.
 * Shows ranked list of students with XP, level, and achievements.
 * Current user's rank highlighted in gold.
 *
 * Inspiration: Duolingo leaderboard + Epic gamification
 */

import { useState } from "react";
import { Trophy, Medal, Crown, X, Star, TrendingUp } from "lucide-react";

// ─── Mock Leaderboard Data ─────────────────────────────────────────

interface LeaderboardEntry {
  rank: number;
  name: string;
  xp: number;
  level: number;
  streak: number;
  isCurrentUser?: boolean;
  badge?: string;
}

const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, name: "Dr. Aisha Khan", xp: 4850, level: 12, streak: 15, badge: "Modifier Master" },
  { rank: 2, name: "Sarah Chen", xp: 4200, level: 10, streak: 12, badge: "Prior-Auth Expert" },
  { rank: 3, name: "You", xp: 3850, level: 9, streak: 8, isCurrentUser: true, badge: "Zero-Balance Closer" },
  { rank: 4, name: "Mohammad Ali", xp: 3100, level: 7, streak: 5 },
  { rank: 5, name: "Priya Sharma", xp: 2800, level: 6, streak: 3 },
];

const RANK_COLORS = ["text-amber-400", "text-slate-300", "text-amber-600", "text-slate-500", "text-slate-500"];
const RANK_BG = ["bg-amber-50 dark:bg-amber-900/20", "bg-slate-50 dark:bg-slate-700/50", "bg-amber-50/50 dark:bg-amber-900/10", "bg-white dark:bg-slate-800", "bg-white dark:bg-slate-800"];

// ─── Component ─────────────────────────────────────────────────────

export function LeaderboardPanel() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Trophy button in header */}
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
        title="Leaderboard"
        aria-label="Leaderboard"
      >
        <Trophy className="h-4 w-4" />
        <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-[7px] font-bold text-white">
          1
        </span>
      </button>

      {/* Leaderboard slide-out panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setOpen(false)} />
          {/* Panel */}
          <div className="fixed right-0 top-0 z-50 h-full w-80 max-w-[90vw] bg-white dark:bg-slate-800 shadow-2xl animate-slide-in border-l border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-4 py-3">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Leaderboard</h3>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-2">
              {/* Header stats */}
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 mb-3">
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-amber-500" />
                  <div>
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-300">Top Coder This Week</p>
                    <p className="text-[10px] text-amber-600 dark:text-amber-400">Dr. Aisha Khan — 4,850 XP</p>
                  </div>
                </div>
              </div>

              {/* Ranked list */}
              {MOCK_LEADERBOARD.map((entry) => (
                <div
                  key={entry.rank}
                  className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                    entry.isCurrentUser
                      ? "border-amber-300 dark:border-amber-600 bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-900/10"
                      : "border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800"
                  }`}
                >
                  {/* Rank */}
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${RANK_COLORS[entry.rank - 1]} ${RANK_BG[entry.rank - 1]}`}>
                    {entry.rank === 1 ? <Crown className="h-4 w-4" /> : entry.rank === 2 ? <Medal className="h-4 w-4" /> : entry.rank === 3 ? <Star className="h-4 w-4" /> : entry.rank}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className={`text-xs font-semibold truncate ${entry.isCurrentUser ? "text-amber-800 dark:text-amber-300" : "text-slate-700 dark:text-slate-300"}`}>
                        {entry.name} {entry.isCurrentUser && "(You)"}
                      </p>
                      {entry.badge && (
                        <span className="shrink-0 rounded bg-indigo-100 dark:bg-indigo-900/30 px-1 py-0.5 text-[8px] font-medium text-indigo-600 dark:text-indigo-400">
                          {entry.badge}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
                      <span>{entry.xp.toLocaleString()} XP</span>
                      <span>·</span>
                      <span>Lv.{entry.level}</span>
                      <span>·</span>
                      <span className="flex items-center gap-0.5">
                        <TrendingUp className="h-2.5 w-2.5" />
                        {entry.streak}d streak
                      </span>
                    </div>
                  </div>

                  {/* XP bar */}
                  <div className="w-16 shrink-0">
                    <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-700">
                      <div
                        className={`h-1.5 rounded-full ${entry.isCurrentUser ? "bg-amber-500" : "bg-indigo-500"}`}
                        style={{ width: `${(entry.xp / 5000) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 dark:border-slate-700 p-3 text-center">
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                Complete encounters to earn XP and climb the ranks!
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}