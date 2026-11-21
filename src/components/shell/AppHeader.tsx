/**
 * AppHeader — the 19 November navy header bar, restored
 *
 * Inspiration: Epic Hyperspace's global header — a dark navy bar with the brand
 * at the left, the working context in the middle and the account at the right.
 *
 * This is the bar the 19 November build (`f8fd8681`, `TabsEpic/Header.tsx`) drew
 * with the `.header-nav` class from `src/styles/app.css`. The class names,
 * spacing and control styling below are taken from that build, not approximated;
 * the only thing that changed is where the destinations live, because the owner
 * removed the left rail (spec `nov19-style-restore.md` §1):
 *
 *   Home        — the house icon at the far left (a destination, so it also
 *                 tells the page it was clicked, which closes an open chart)
 *   Dashboard   — the track cards and every practice area, one click away, so
 *                 no page the rail used to hold is stranded
 *   Settings    — the gear beside it
 *   Track switch— Medical / Dental, beside the logo
 *   Save status — the one autosave indicator
 *   Summary     — the right-pane toggle, when the route passes one
 *   Account     — dark mode and log out
 *
 * Every control is at least 40 px in its smallest dimension, carries a visible
 * label or an `aria-label`, and keeps a keyboard focus ring. The bar wraps at
 * narrow widths instead of pushing the page sideways (STANDING-RULES 4).
 */

import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Building2, Home, LayoutDashboard, LogOut, PanelRightClose, Settings, Timer, Users } from "lucide-react";
import { logout } from "../../store/accessStore";
import { DarkModeToggle } from "../DarkModeToggle";
import { TrackSwitcher } from "../dental/TrackSwitcher";
import { AutosaveIndicator } from "./AutosaveIndicator";
import { GlobalPatientSearch } from "./GlobalPatientSearch";
import { setActiveTrack } from "./activeTrack";
import type { ShellTrack } from "./navItems";

interface AppHeaderProps {
  track: ShellTrack;
  /** Clicking Home is a destination even on Home: the page closes its chart. */
  onHomeClick?: () => void;
  selectedPatientId?: string;
  /** Opens a patient. When absent the patient search is not drawn. */
  onPatientSelect?: (patientId: string) => void;
  /** The role the student is working in, shown as a read-only pill. */
  roleLabel?: string;
  examMode?: boolean;
  examTimeRemaining?: number;
  onToggleExamMode?: () => void;
  /** Route-specific controls, drawn in the bar (for example the summary toggle). */
  extras?: ReactNode;
}

function formatClock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function AppHeader({
  track,
  onHomeClick,
  selectedPatientId,
  onPatientSelect,
  roleLabel,
  examMode,
  examTimeRemaining,
  onToggleExamMode,
  extras,
}: AppHeaderProps) {
  const navigate = useNavigate();
  const examUrgent = examTimeRemaining !== undefined && examTimeRemaining < 120;

  return (
    <header className="header-nav sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 px-3 py-2 shadow-lg sm:gap-4 sm:px-4">
      {/* ─── Left: Home, Settings, brand, track switch ─── */}
      <div className="flex min-w-0 items-center gap-1 sm:gap-3">
        <Link
          to="/"
          onClick={() => onHomeClick?.()}
          aria-label="Home"
          title="Home"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <Home className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Link
          to="/dashboard"
          aria-label="Dashboard — your tracks and every practice area"
          title="Dashboard — your tracks and every practice area"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Link
          to="/settings"
          aria-label="Settings — reset, export or import your practice data"
          title="Settings — reset, export or import your practice data"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <Settings className="h-4 w-4" aria-hidden="true" />
        </Link>
        {/* Logo: the 19 November mark (h-7 / 140 px) taken up to the height of
            the header controls (h-10), with its own breathing room on both
            sides so it never crowds the Medical/Dental switch. Hidden below
            sm, where the header keeps its single row for controls. */}
        <img
          src="/healthcarehustlers-logo.png"
          alt="Healthcare Hustlers"
          className="ml-1 mr-2 hidden h-10 w-auto shrink-0 sm:block"
          style={{ maxWidth: "200px" }}
        />
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

      {/* ─── Center: the role the encounter is working in ─── */}
      {roleLabel && (
        <div className="hidden min-w-0 items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5 md:flex">
          <Users className="h-4 w-4 shrink-0 text-blue-400" aria-hidden="true" />
          <span className="truncate text-xs font-medium text-white">{roleLabel}</span>
        </div>
      )}

      {/* ─── Right: patient search, route controls, save status, account ─── */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5 sm:gap-3">
        {onPatientSelect && (
          // The one patient finder. On a narrow screen it takes a row of its
          // own under the bar instead of being squeezed out — without it there
          // is no way to open a patient at 360 px (the Inbox list starts at lg).
          <div className="order-last w-full min-w-0 md:order-first md:w-40 lg:w-56">
            <GlobalPatientSearch selectedId={selectedPatientId} onSelect={onPatientSelect} />
          </div>
        )}

        {extras}

        <div className="hidden items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5 xl:flex">
          <Building2 className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <div className="text-xs">
            <p className="font-medium text-slate-200">Main Clinic</p>
            <p className="text-[10px] text-slate-500">Internal Medicine</p>
          </div>
        </div>

        <AutosaveIndicator />

        {onToggleExamMode && (
          <button
            type="button"
            onClick={onToggleExamMode}
            aria-label={examMode ? "Exit exam mode" : "Start exam mode (30 min)"}
            title={examMode ? "Exit exam mode" : "Start exam mode (30 min)"}
            className={`hidden min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-medium transition-colors sm:flex focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
              examMode
                ? examUrgent
                  ? "bg-red-600 text-white"
                  : "bg-amber-600 text-white"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white"
            }`}
          >
            <Timer className="h-3.5 w-3.5" aria-hidden="true" />
            {examMode && examTimeRemaining !== undefined ? (
              <span className="font-mono font-bold">{formatClock(examTimeRemaining)}</span>
            ) : (
              <span>Exam</span>
            )}
          </button>
        )}

        <DarkModeToggle />

        <button
          type="button"
          onClick={() => {
            logout();
            void navigate({ to: "/login" });
          }}
          aria-label="Log out"
          title="Log out"
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-slate-400 transition-colors hover:bg-red-900/50 hover:text-red-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

/**
 * The 19 November summary-pane toggle, drawn in the header bar. It lives here so
 * every route that shows a right-hand pane can put the same control in the same
 * place instead of inventing its own.
 */
export function SummaryPaneToggle({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={open ? "Hide patient summary panel" : "Show patient summary panel"}
      title={open ? "Hide summary panel" : "Show summary panel"}
      aria-pressed={open}
      className={`flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
        open
          ? "bg-brand-600 text-white hover:bg-brand-500"
          : "bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white"
      }`}
    >
      <PanelRightClose className="h-4 w-4" aria-hidden="true" />
      <span className="hidden lg:inline">Summary</span>
    </button>
  );
}
