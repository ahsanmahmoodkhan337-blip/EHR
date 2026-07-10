/**
 * GamificationHeader — XP Meter, Streak, Badges & Daily Challenges
 *
 * Shows student level, XP bar, consecutive error-free
 * action counter, expandable achievement badges, and
 * 3 rotating daily challenges.
 *
 * Challenges stored in localStorage with date-based rotation.
 */

import { useState, useEffect } from "react";
import { Zap, Star, Award, Medal, Trophy, ChevronDown, ChevronUp, Sparkles, CheckCircle2, Target, Flame } from "lucide-react";

const BADGES = [
  { id: "modifier-master", label: "Modifier Master", icon: <Award className="h-3.5 w-3.5" />, unlocked: false },
  { id: "prior-auth-expert", label: "Prior-Auth Expert", icon: <Medal className="h-3.5 w-3.5" />, unlocked: false },
  { id: "zero-balance", label: "Zero-Balance Closer", icon: <Trophy className="h-3.5 w-3.5" />, unlocked: false },
];

// ─── Daily Challenges ──────────────────────────────────────────────

const DAILY_CHALLENGES = [
  { id: "clean-claims", label: "Complete 3 clean claims in a row", icon: "💰" },
  { id: "no-modifier-errors", label: "No modifier mistakes today", icon: "🏷️" },
  { id: "perfect-pa", label: "Perfect Prior Auth submission", icon: "📄" },
];

function getTodayKey(): string {
  return new Date().toISOString().split("T")[0];
}

function loadChallengeState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem("hh_challenges");
    if (!raw) return {};
    const data = JSON.parse(raw);
    const today = getTodayKey();
    // Reset if not today
    if (data.date !== today) return {};
    return data.completed || {};
  } catch {
    return {};
  }
}

function saveChallengeState(completed: Record<string, boolean>) {
  localStorage.setItem("hh_challenges", JSON.stringify({
    date: getTodayKey(),
    completed,
  }));
}

function loadStreak(): number {
  try {
    return parseInt(localStorage.getItem("hh_streak") || "0", 10);
  } catch { return 0; }
}

function saveStreak(n: number) {
  localStorage.setItem("hh_streak", String(n));
}

// ─── Component ─────────────────────────────────────────────────────

interface GamificationHeaderProps {
  xp: number;
  streak: number;
  level: number;
}

export function GamificationHeader({ xp = 0, streak = 0, level = 1 }: GamificationHeaderProps) {
  const [showBadges, setShowBadges] = useState(false);
  const [showChallenges, setShowChallenges] = useState(false);
  const [completedChallenges, setCompletedChallenges] = useState<Record<string, boolean>>(loadChallengeState);
  const [challengeStreak, setChallengeStreak] = useState(loadStreak);

  const xpForNextLevel = level * 100;
  const xpPercent = Math.min(100, Math.round((xp / xpForNextLevel) * 100));
  const challengesDone = Object.values(completedChallenges).filter(Boolean).length;
  const allChallengesDone = challengesDone === DAILY_CHALLENGES.length;

  // Persist challenge state changes
  useEffect(() => {
    saveChallengeState(completedChallenges);
  }, [completedChallenges]);

  const toggleChallenge = (id: string) => {
    const next = { ...completedChallenges, [id]: !completedChallenges[id] };
    setCompletedChallenges(next);
    const done = Object.values(next).filter(Boolean).length;
    if (done === DAILY_CHALLENGES.length) {
      // All challenges done — increment streak
      setChallengeStreak(prev => {
        const newStreak = prev + 1;
        saveStreak(newStreak);
        return newStreak;
      });
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-gradient-to-r from-indigo-50/50 to-white px-3 py-2 shadow-sm">
      {/* Level */}
      <div className="flex items-center gap-1.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
          {level}
        </div>
        <span className="text-[10px] font-medium text-slate-500">Lvl</span>
      </div>

      {/* XP Bar */}
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-slate-400">XP</span>
          <span className="text-[9px] font-medium text-slate-500">{xp}/{xpForNextLevel}</span>
        </div>
        <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500" style={{ width: `${xpPercent}%` }} />
        </div>
      </div>

      {/* Streak */}
      {streak > 0 && (
        <div className="flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1">
          <Zap className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[10px] font-bold text-amber-700">{streak}</span>
        </div>
      )}

      {/* Daily Challenges */}
      <div className="relative">
        <button
          onClick={() => setShowChallenges(!showChallenges)}
          className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium transition-colors ${
            allChallengesDone
              ? "bg-green-100 text-green-700"
              : challengesDone > 0
                ? "bg-amber-50 text-amber-700"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
          }`}
        >
          <Target className="h-3 w-3" />
          <span>{challengesDone}/{DAILY_CHALLENGES.length}</span>
          {challengeStreak > 0 && (
            <span className="flex items-center gap-0.5 ml-0.5 text-amber-600">
              <Flame className="h-2.5 w-2.5" />
              {challengeStreak}
            </span>
          )}
        </button>

        {/* Challenges dropdown */}
        {showChallenges && (
          <div className="absolute left-0 top-full mt-1 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg z-20 animate-slide-in">
            <p className="text-[10px] font-semibold text-slate-600 mb-2">Daily Challenges</p>
            <div className="space-y-1.5">
              {DAILY_CHALLENGES.map((ch) => {
                const done = !!completedChallenges[ch.id];
                return (
                  <button
                    key={ch.id}
                    onClick={() => toggleChallenge(ch.id)}
                    className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[10px] transition-colors ${
                      done
                        ? "border-green-200 bg-green-50 text-green-700"
                        : "border-slate-100 bg-slate-50 text-slate-600 hover:border-indigo-200"
                    }`}
                  >
                    <span className="text-sm">{ch.icon}</span>
                    <span className="flex-1">{ch.label}</span>
                    {done && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />}
                  </button>
                );
              })}
            </div>
            {challengeStreak > 0 && (
              <p className="mt-2 text-[9px] text-center text-amber-600 flex items-center justify-center gap-1">
                <Flame className="h-3 w-3" />
                {challengeStreak} day streak!
              </p>
            )}
            {allChallengesDone && (
              <p className="mt-2 text-[9px] text-center text-green-600 flex items-center justify-center gap-1">
                <Sparkles className="h-3 w-3" />
                All challenges complete! Streak +1
              </p>
            )}
          </div>
        )}
      </div>

      {/* Badges */}
      <div className="relative">
        <button
          onClick={() => setShowBadges(!showBadges)}
          className="flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500 hover:bg-slate-200 transition-colors"
        >
          <Star className="h-3 w-3" />
          <span>Badges</span>
          {showBadges ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {showBadges && (
          <div className="absolute left-0 top-full mt-1 w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-lg z-20 animate-slide-in">
            <p className="text-[10px] font-semibold text-slate-600 mb-2">Achievement Badges</p>
            <div className="space-y-1.5">
              {BADGES.map((badge) => (
                <div key={badge.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2">
                  <span className={`flex items-center gap-1.5 text-[10px] ${badge.unlocked ? "text-indigo-700" : "text-slate-400"}`}>
                    {badge.icon}
                    <span>{badge.label}</span>
                  </span>
                  <span className={`ml-auto text-[9px] font-medium ${badge.unlocked ? "text-green-600" : "text-slate-400"}`}>
                    {badge.unlocked ? "Unlocked" : "Locked"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}