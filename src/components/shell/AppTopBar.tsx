/**
 * AppTopBar — the single top bar for both revenue cycles.
 *
 * Inspiration: athenaOne's top bar (global search on the left of the actions,
 * one user menu on the right) with Epic Hyperspace's role and timer chips.
 *
 * Holds, left to right: the menu button below `lg`, the brand, the global
 * patient search, and — from 1100 px up — the Medical/Dental switch, the
 * current role, the exam-mode timer, dark mode and the user menu. Below
 * 1100 px everything after the search folds into one "More" menu, so the bar
 * never forces the page sideways (spec `task-1-app-shell.md` item 1).
 *
 * Every control is at least 40 px in its smallest dimension and carries either
 * a visible label or an `aria-label`.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, LogOut, Menu, MoreHorizontal, Settings, Timer } from "lucide-react";
import { logout } from "../../store/accessStore";
import { DarkModeToggle } from "../DarkModeToggle";
import { TrackSwitcher } from "../dental/TrackSwitcher";
import { GlobalPatientSearch } from "./GlobalPatientSearch";
import { AutosaveIndicator } from "./AutosaveIndicator";
import type { ShellTrack } from "./navItems";

interface AppTopBarProps {
  track: ShellTrack;
  /** Patient currently open — echoed on the search trigger. */
  selectedPatientId?: string;
  /** Opens a patient. When absent the search is not rendered. */
  onPatientSelect?: (patientId: string) => void;
  /** Human label for the role the student is working in, when there is one. */
  roleLabel?: string;
  examMode?: boolean;
  examTimeRemaining?: number;
  onToggleExamMode?: () => void;
  /** Opens the off-canvas sidebar below `lg`. */
  onOpenSidebar: () => void;
  /** Route-specific controls (for example the summary panel toggle). */
  extras?: ReactNode;
}

function formatClock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function AppTopBar({
  track,
  selectedPatientId,
  onPatientSelect,
  roleLabel,
  examMode,
  examTimeRemaining,
  onToggleExamMode,
  onOpenSidebar,
  extras,
}: AppTopBarProps) {
  const navigate = useNavigate();
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  // One outside-click handler for both menus.
  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (overflowRef.current && !overflowRef.current.contains(target)) setOverflowOpen(false);
      if (userRef.current && !userRef.current.contains(target)) setUserOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const handleLogout = () => {
    logout();
    void navigate({ to: "/login" });
  };

  const examUrgent = examTimeRemaining !== undefined && examTimeRemaining < 120;

  const examControl = onToggleExamMode ? (
    <button
      type="button"
      onClick={onToggleExamMode}
      aria-label={examMode ? "Exit exam mode" : "Start exam mode, 30 minutes"}
      title={examMode ? "Exit exam mode" : "Start exam mode (30 min)"}
      className={`flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
        examMode
          ? examUrgent
            ? "bg-red-600 text-white"
            : "bg-amber-500 text-white"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      }`}
    >
      <Timer className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="font-mono tabular-nums">
        {examMode && examTimeRemaining !== undefined ? formatClock(examTimeRemaining) : "Exam"}
      </span>
    </button>
  ) : null;

  const roleControl = roleLabel ? (
    <span
      title="The role you are working in"
      className="flex min-h-10 items-center rounded-lg bg-slate-100 px-2.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
    >
      Role: {roleLabel}
    </span>
  ) : null;

  const trackControl = (
    <TrackSwitcher
      track={track}
      compact
      onTrackChange={(next) => {
        setOverflowOpen(false);
        void navigate({ to: next === "dental" ? "/dental" : "/" });
      }}
    />
  );

  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-2 py-1.5 dark:border-slate-800 dark:bg-slate-900">
      {/* Sidebar drawer trigger — below lg only */}
      <button
        type="button"
        onClick={onOpenSidebar}
        aria-label="Open navigation menu"
        title="Open navigation"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      {/* Track marker — the logo lives once, at the top of the sidebar. */}
      <div className="flex min-w-0 shrink items-center gap-2">
        <span
          className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            track === "dental"
              ? "bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-200"
              : "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
          }`}
        >
          {track === "dental" ? "Dental RCM" : "Medical RCM"}
        </span>
      </div>

      {/* Autosave — one indicator, on every screen (spec item 9, T0-12). It sits
          beside the track marker at every width, because "is my work saved?"
          must never be behind a menu. */}
      <AutosaveIndicator />

      {/* Global patient search — its own row until there is room for it */}
      {onPatientSelect && (
        <div className="order-last w-full min-w-0 min-[700px]:order-none min-[700px]:w-auto min-[700px]:flex-1 min-[700px]:max-w-md">
          <GlobalPatientSearch selectedId={selectedPatientId} onSelect={onPatientSelect} />
        </div>
      )}

      {/* Desktop cluster (1100 px and up) */}
      <div className="ml-auto hidden items-center gap-2 min-[1100px]:flex">
        {trackControl}
        {roleControl}
        {examControl}
        {extras}
        <DarkModeToggle />

        {/* User menu */}
        <div ref={userRef} className="relative">
          <button
            type="button"
            onClick={() => setUserOpen((open) => !open)}
            aria-label="User menu"
            aria-expanded={userOpen}
            aria-haspopup="menu"
            title="User menu"
            className="flex min-h-10 items-center gap-1.5 rounded-lg bg-slate-100 px-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
              ST
            </span>
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          {userOpen && (
            <div
              role="menu"
              aria-label="User menu"
              className="absolute right-0 top-full z-50 mt-1 w-48 rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-800"
            >
              <a
                role="menuitem"
                href="/settings"
                onClick={(event) => {
                  event.preventDefault();
                  setUserOpen(false);
                  void navigate({ to: "/settings" });
                }}
                className="flex min-h-10 items-center gap-2 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Settings className="h-4 w-4" aria-hidden="true" /> Settings
              </a>
              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                className="flex min-h-10 w-full items-center gap-2 px-3 text-left text-xs font-medium text-slate-700 hover:bg-red-50 hover:text-red-700 dark:text-slate-200 dark:hover:bg-red-900/30"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" /> Log out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Below 1100 px: everything above folds in here */}
      <div ref={overflowRef} className="relative ml-auto flex items-center gap-1 min-[1100px]:hidden">
        <button
          type="button"
          onClick={() => setOverflowOpen((open) => !open)}
          aria-label="More actions"
          aria-expanded={overflowOpen}
          aria-haspopup="menu"
          title="More actions"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
        </button>

        {overflowOpen && (
          <div
            role="menu"
            aria-label="More actions"
            className="absolute right-0 top-full z-50 mt-1 flex w-64 max-w-[92vw] flex-col gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800"
          >
            <div className="flex flex-col gap-1">
              <span className="px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Track
              </span>
              {trackControl}
            </div>
            {roleControl}
            {examControl}
            {extras}
            <div className="flex items-center justify-between rounded-lg bg-slate-100 px-2 dark:bg-slate-700">
              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Dark mode</span>
              <DarkModeToggle />
            </div>
            <a
              role="menuitem"
              href="/settings"
              onClick={(event) => {
                event.preventDefault();
                setOverflowOpen(false);
                void navigate({ to: "/settings" });
              }}
              className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Settings className="h-4 w-4" aria-hidden="true" /> Settings
            </a>
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-xs font-medium text-slate-700 hover:bg-red-50 hover:text-red-700 dark:text-slate-200 dark:hover:bg-red-900/30"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" /> Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
