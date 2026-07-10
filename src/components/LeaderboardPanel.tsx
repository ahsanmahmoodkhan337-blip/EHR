/**
 * LeaderboardPanel — All Participants & Scores
 *
 * Reads from localStorage "hh_scores" to show all registered students.
 * Each row: Rank | Student Name | Score | Stages Completed | Time
 * Sorted by score descending, shows top 20.
 *
 * Inspiration: Duolingo leaderboard + Epic gamification
 */

import { useState } from "react";
import { Trophy, Medal, Crown, X, Star, TrendingUp, Clock, Shield } from "lucide-react";
import { getLeaderboard, getStudentName, type LeaderboardRow } from "../utils/scoring";

// ─── Component ─────────────────────────────────────────────────────

export function LeaderboardPanel() {
  const [open, setOpen] = useState(false);
  const currentStudentName = getStudentName();

  // Refresh data each time panel opens
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [currentUserRank, setCurrentUserRank] = useState<LeaderboardRow | null>(null);

  const handleOpen = () => {
    const rows = getLeaderboard();
    setLeaderboard(rows);
    setCurrentUserRank(rows.find((r) => r.name === currentStudentName) || null);
    setOpen(true);
  };

  const RANK_COLORS = ["text-amber-400", "text-slate-300", "text-amber-600", "text-slate-500", "text-slate-500"];
  const RANK_BG = ["bg-amber-50 dark:bg-amber-900/20", "bg-slate-50 dark:bg-slate-700/50", "bg-amber-50/50 dark:bg-amber-900/10", "bg-white dark:bg-slate-800", "bg-white dark:bg-slate-800"];
  const RANK_ICONS = [Crown, Medal, Star, null, null];

  return (
    <>
      {/* Trophy button in header */}
      <button
        onClick={handleOpen}
        className="relative flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
        title="Leaderboard"
        aria-label="Leaderboard"
      >
        <Trophy className="h-4 w-4" />
        {currentUserRank && currentUserRank.score > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-[7px] font-bold text-white">
            {currentUserRank.rank}
          </span>
        )}
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
              {/* Current user stats */}
              {currentUserRank && currentUserRank.score > 0 && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-amber-500" />
                    <div>
                      <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                        Your Rank: #{currentUserRank.rank} — {currentUserRank.score} pts
                      </p>
                      <p className="text-[10px] text-amber-600 dark:text-amber-400">
                        {currentUserRank.stagesCompleted} stages completed
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {leaderboard.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Shield className="h-12 w-12 text-slate-300 mb-3" />
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No scores yet</p>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    Complete encounters to earn points and climb the ranks!
                  </p>
                </div>
              )}

              {/* Ranked list */}
              {leaderboard.map((entry) => {
                const RankIcon = RANK_ICONS[entry.rank - 1] || null;
                const isCurrentUser = entry.name === currentStudentName;
                const timeAgo = getTimeAgo(entry.timestamp);

                return (
                  <div
                    key={`${entry.rank}-${entry.name}`}
                    className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                      isCurrentUser
                        ? "border-amber-300 dark:border-amber-600 bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-900/10"
                        : "border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800"
                    }`}
                  >
                    {/* Rank */}
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${RANK_COLORS[entry.rank - 1]} ${RANK_BG[entry.rank - 1]}`}>
                      {RankIcon ? <RankIcon className="h-4 w-4" /> : entry.rank}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-xs font-semibold truncate ${isCurrentUser ? "text-amber-800 dark:text-amber-300" : "text-slate-700 dark:text-slate-300"}`}>
                          {entry.name} {isCurrentUser && "(You)"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
                        <span>{entry.score} pts</span>
                        <span>·</span>
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {entry.stagesCompleted}/7 stages
                        </span>
                        <span>·</span>
                        <span>{timeAgo}</span>
                      </div>
                    </div>

                    {/* Score bar */}
                    <div className="w-16 shrink-0">
                      <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-700">
                        <div
                          className={`h-1.5 rounded-full ${isCurrentUser ? "bg-amber-500" : "bg-indigo-500"}`}
                          style={{ width: `${Math.min(100, (entry.score / 100) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            {leaderboard.length > 0 && (
              <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 dark:border-slate-700 p-3 text-center">
                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                  Complete all 7 stages to earn 100 points!
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function getTimeAgo(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMinutes = Math.floor((now - then) / 60000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}