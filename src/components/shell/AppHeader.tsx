/**
 * AppHeader — the 19 November navy header bar, with labelled links
 *
 * Inspiration: Epic Hyperspace's global header — a dark navy bar with the brand
 * at the left, the working context in the middle and the account at the right.
 *
 * This is the bar the 19 November build (`f8fd8681`, `TabsEpic/Header.tsx`) drew
 * with the `.header-nav` class from `src/styles/app.css`. The class names,
 * spacing and control styling below are taken from that build, not approximated;
 * what changed is what the bar carries:
 *
 *   Logo + Home icon — both open `/dashboard` (spec `slice-navigation.md` item
 *                      2). The Home icon no longer drops the student into the
 *                      encounter: **only Resume opens the encounter.**
 *   Dashboard · Schedule · Patients · Settings
 *                    — the four labelled destinations (item 1). The current one
 *                      is highlighted (item 4).
 *   Track switch     — Medical / Dental, beside the logo
 *   Save status      — the one autosave indicator
 *   Summary          — the right-pane toggle, when the route passes one
 *   Account          — dark mode and log out
 *
 * The bar is one row from 1100 px up; below that the four links take a row of
 * their own rather than being squeezed out, and the bar wraps — it never pushes
 * the page sideways (STANDING-RULES 4). Every control is at least 40 px in its
 * smallest dimension, carries a visible label or an `aria-label`, and keeps a
 * keyboard focus ring.
 */

import type { ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Building2, Home, LogOut, PanelRightClose, Timer, Users } from "lucide-react";
import { logout } from "../../store/accessStore";
import { headerNavForPath } from "../../domain/breadcrumb";
import { TrackSwitcher } from "../dental/TrackSwitcher";
import { AutosaveIndicator } from "./AutosaveIndicator";
import { GlobalPatientSearch } from "./GlobalPatientSearch";
import { setActiveTrack } from "./activeTrack";
import type { ShellTrack } from "./navItems";

interface AppHeaderProps {
  track: ShellTrack;
  /**
   * Called when the Home control is clicked, before the dashboard opens: the
   * page gets to flush what it holds (the note draft) instead of losing it.
   */
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

/**
 * The four labelled destinations the bar carries (spec `slice-navigation.md`
 * item 1). Everything else the app can reach lives on the dashboard's Practice
 * areas card and in the encounter's stepper, so no page is stranded.
 */
const HEADER_LINKS = [
  { id: "dashboard", label: "Dashboard", to: "/dashboard" },
  { id: "schedule", label: "Schedule", to: "/schedule" },
  { id: "patients", label: "Patients", to: "/patients" },
  { id: "settings", label: "Settings", to: "/settings" },
] as const;

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
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const activeLink = headerNavForPath(pathname);
  const examUrgent = examTimeRemaining !== undefined && examTimeRemaining < 120;

  return (
    <header className="header-nav sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 px-3 py-2 shadow-lg sm:gap-3 sm:px-4">
      {/* ─── Left: logo, Home, the four labelled links, track switch ─── */}
      <div className="flex min-w-0 items-center gap-1 sm:gap-2">
        {/* The 19 November mark on a white chip so it stays legible on the navy
            bar (the artwork is dark-on-light). It is a link to the dashboard,
            as the Home icon is; hidden below xl so the four labels and the
            working controls stay on one row at 1100 px. */}
        <Link
          to="/dashboard"
          onClick={() => onHomeClick?.()}
          aria-label="Healthcare Hustlers — go to the dashboard"
          title="Go to the dashboard"
          className="mr-1 hidden shrink-0 items-center rounded-lg bg-white px-2 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white xl:flex"
        >
          <img
            src="/healthcarehustlers-logo.png"
            alt="Healthcare Hustlers"
            className="h-8 w-auto"
            style={{ maxWidth: "150px" }}
          />
        </Link>
        <Link
          to="/dashboard"
          onClick={() => onHomeClick?.()}
          aria-label="Home — go to the dashboard"
          title="Home — dashboard"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <Home className="h-4 w-4" aria-hidden="true" />
        </Link>
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

      {/* ─── The four labelled destinations ───
          One row with everything else from 1100 px up; a row of its own below
          that, so a label is never clipped and the bar never scrolls the page. */}
      <nav
        aria-label="Main"
        className="order-last flex w-full flex-wrap items-center gap-0.5 border-t border-white/10 pt-1.5 min-[1100px]:order-none min-[1100px]:w-auto min-[1100px]:flex-1 min-[1100px]:justify-center min-[1100px]:border-0 min-[1100px]:pt-0"
      >
        {HEADER_LINKS.map(({ id, label, to }) => {
          const active = activeLink === id;
          return (
            <Link
              key={id}
              to={to}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-10 items-center rounded-lg px-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                active
                  ? "bg-white/15 text-white"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* ─── Center: the role the encounter is working in ─── */}
      {roleLabel && (
        <div className="hidden min-w-0 items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5 min-[1400px]:flex">
          <Users className="h-4 w-4 shrink-0 text-blue-400" aria-hidden="true" />
          <span className="truncate text-xs font-medium text-white">{roleLabel}</span>
        </div>
      )}

      {/* ─── Right: patient search, route controls, save status, account ─── */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5 sm:gap-3 min-[1100px]:flex-none">
        {onPatientSelect && (
          // The one patient finder. On a narrow screen it takes a row of its
          // own under the bar instead of being squeezed out — without it there
          // is no way to open a patient at 360 px (the Inbox list starts at lg).
          <div className="order-last w-full min-w-0 md:order-first md:w-40 min-[1100px]:w-40 xl:w-56">
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
            className={`hidden min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-medium transition-colors sm:flex focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white xl:inline-flex ${
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
