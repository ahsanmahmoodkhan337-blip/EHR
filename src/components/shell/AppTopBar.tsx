/**
 * AppTopBar — the single top bar for both revenue cycles.
 *
 * Inspiration: athenaOne's top bar — a track switch on the left, the global
 * search in the middle, the save state and one user menu on the right.
 *
 * The bar holds exactly four things (spec `phase-2-layout.md` §2): the track
 * switch, the patient search, the save status and the user menu. Everything
 * that used to sit beside them — the role chip, the exam timer, route extras,
 * the dark-mode toggle — now lives inside the user menu, which is where the
 * athenaOne-style bar keeps its account-level actions. Below `lg` the sidebar
 * drawer trigger sits first, because the rail has no other way in at that width.
 *
 * Every control is at least 40 px in its smallest dimension and carries either
 * a visible label or an `aria-label`.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, LogOut, Menu, Moon, Settings, Timer } from "lucide-react";
import { logout } from "../../store/accessStore";
import { DarkModeToggle } from "../DarkModeToggle";
import { TrackSwitcher } from "../dental/TrackSwitcher";
import { GlobalPatientSearch } from "./GlobalPatientSearch";
import { AutosaveIndicator } from "./AutosaveIndicator";
import { setActiveTrack } from "./activeTrack";
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
  /** Route-specific controls — they render inside the user menu. */
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
  const [userOpen, setUserOpen] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);
  const userButtonRef = useRef<HTMLButtonElement>(null);

  // One outside-click handler for the menu.
  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (userRef.current && !userRef.current.contains(target)) setUserOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  // The user menu behaves like a menu for a keyboard: opening it moves focus to
  // the first item, the arrow keys walk the items, and Escape closes it and puts
  // focus back on the button that opened it (spec item 11).
  useEffect(() => {
    if (!userOpen) return;
    const itemsOf = () =>
      Array.from(userRef.current?.querySelectorAll<HTMLElement>('[role="menu"] button, [role="menu"] a') ?? []);
    itemsOf()[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setUserOpen(false);
        userButtonRef.current?.focus();
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const items = itemsOf();
      if (items.length === 0) return;
      event.preventDefault();
      const current = items.indexOf(document.activeElement as HTMLElement);
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next = current < 0 ? 0 : (current + step + items.length) % items.length;
      items[next]?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [userOpen]);

  const handleLogout = () => {
    logout();
    void navigate({ to: "/login" });
  };

  const examUrgent = examTimeRemaining !== undefined && examTimeRemaining < 120;

  const examControl = onToggleExamMode ? (
    <button
      type="button"
      role="menuitem"
      onClick={onToggleExamMode}
      aria-label={examMode ? "Exit exam mode" : "Start exam mode, 30 minutes"}
      title={examMode ? "Exit exam mode" : "Start exam mode (30 min)"}
      className={`flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-xs font-medium ${
        examMode
          ? examUrgent
            ? "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-200"
            : "bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-200"
          : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
      }`}
    >
      <Timer className="h-4 w-4" aria-hidden="true" />
      <span className="font-mono tabular-nums">
        {examMode && examTimeRemaining !== undefined ? `Exam ${formatClock(examTimeRemaining)}` : "Start exam mode"}
      </span>
    </button>
  ) : null;

  return (
    <header className="header-nav flex min-w-0 shrink-0 flex-nowrap items-center gap-1 border-b border-black/10 px-2 py-1.5 sm:gap-2 dark:border-black/40">
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

      {/* 1 · Track switch */}
      <div className="shrink-0">
        <TrackSwitcher
          track={track}
          compact
          onTrackChange={(next) => {
            // The choice is remembered before the navigation, so the case list
            // the student lands on is the one for the track they just picked.
            setActiveTrack(next);
            void navigate({ to: "/cases" });
          }}
        />
      </div>

      {/* 2 · Patient search — the one flexible thing in the bar */}
      {onPatientSelect && (
        <div className="min-w-0 flex-1">
          <GlobalPatientSearch selectedId={selectedPatientId} onSelect={onPatientSelect} />
        </div>
      )}

      {/* 3 · Save status */}
      <div className="shrink-0">
        <AutosaveIndicator />
      </div>

      {/* 4 · User menu — role, exam mode, route extras, dark mode, settings, log out */}
      <div ref={userRef} className="relative shrink-0">
        <button
          ref={userButtonRef}
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
          {/* The chevron is the first thing to go when the bar is tight; the
              button keeps its label and its menu either way. */}
          <ChevronDown className="hidden h-3.5 w-3.5 sm:block" aria-hidden="true" />
        </button>
        {userOpen && (
          <div
            role="menu"
            aria-label="User menu"
            className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-800"
          >
            {roleLabel && (
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Role: {roleLabel}
              </p>
            )}
            {extras}
            {examControl}
            <div className="flex min-h-10 items-center justify-between rounded-lg px-2 dark:text-slate-200">
              <span className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200">
                <Moon className="h-4 w-4" aria-hidden="true" /> Dark mode
              </span>
              <DarkModeToggle />
            </div>
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
    </header>
  );
}
