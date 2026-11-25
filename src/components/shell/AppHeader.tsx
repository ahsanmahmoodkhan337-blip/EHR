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

  const hasToolbar = Boolean(roleLabel || extras || onToggleExamMode);

  return (
    <header className="header-nav sticky top-0 z-30 shadow-lg">
      {/* Row 1 — the same on every signed-in screen: where you are and where
          you can go. Nothing in it wraps; below 1100 px the four links take a
          scrollable row of their own instead of being squeezed. */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4 min-[1100px]:flex-nowrap">
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Link
            to="/dashboard"
            onClick={() => onHomeClick?.()}
            aria-label="Healthcare Hustlers — go to the dashboard"
            title="Go to the dashboard"
            className="mr-1 hidden shrink-0 items-center rounded-lg bg-white px-2 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white xl:flex"
          >
            <img src="/healthcarehustlers-logo.png" alt="Healthcare Hustlers" className="h-8 w-auto" style={{ maxWidth: "150px" }} />
          </Link>
          <Link
            to="/dashboard"
            onClick={() => onHomeClick?.()}
            aria-label="Home — go to the dashboard"
            title="Home — dashboard"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
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

        <nav
          aria-label="Main"
          className="order-last flex w-full flex-nowrap items-center gap-0.5 overflow-x-auto border-t border-white/10 pt-1.5 min-[1100px]:order-none min-[1100px]:w-auto min-[1100px]:flex-1 min-[1100px]:justify-center min-[1100px]:overflow-visible min-[1100px]:border-0 min-[1100px]:pt-0"
        >
          {HEADER_LINKS.map(({ id, label, to }) => {
            const active = activeLink === id;
            return (
              <Link
                key={id}
                to={to}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-lg px-3 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                  active ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
          {onPatientSelect && (
            <div className="hidden w-48 min-w-0 md:block xl:w-60">
              <GlobalPatientSearch selectedId={selectedPatientId} onSelect={onPatientSelect} />
            </div>
          )}
          <AutosaveIndicator />
          {/* Phones have no toolbar row: the exam timer, if any, sits here. */}
          {onToggleExamMode && (
            <button
              type="button"
              onClick={onToggleExamMode}
              aria-label={examMode ? "Exit exam mode" : "Start exam mode (30 min)"}
              className={`flex h-10 min-w-10 shrink-0 items-center justify-center gap-1 rounded-lg px-2 text-[13px] font-medium md:hidden ${
                examMode ? (examUrgent ? "bg-red-600 text-white" : "bg-amber-600 text-white") : "text-white/70 ring-1 ring-white/15"
              }`}
            >
              <Timer className="h-4 w-4" aria-hidden="true" />
              {examMode && examTimeRemaining !== undefined && (
                <span className="font-mono font-bold">{formatClock(examTimeRemaining)}</span>
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
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/70 ring-1 ring-white/15 transition-colors hover:bg-red-900/40 hover:text-red-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Patient search on phones: a row of its own, so it is never squeezed out. */}
        {onPatientSelect && (
          <div className="order-last w-full min-w-0 md:hidden">
            <GlobalPatientSearch selectedId={selectedPatientId} onSelect={onPatientSelect} />
          </div>
        )}
      </div>

      {/* Row 2 — the encounter's working tools, only where an encounter is
          open: the desk you are working at, the clinic, the summary pane and
          the exam timer. Kept out of row 1 so the main links never wrap. */}
      {hasToolbar && (
        <div className="hidden min-h-11 flex-wrap items-center gap-2 border-t border-white/10 bg-black/15 px-3 py-1.5 sm:px-4 md:flex">
          {roleLabel && (
            <span className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-white/10 px-2.5 text-[13px] font-medium text-white">
              <Users className="h-4 w-4 text-white/70" aria-hidden="true" />
              {roleLabel}
            </span>
          )}
          <span className="hidden min-h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-white/70 sm:inline-flex">
            <Building2 className="h-4 w-4" aria-hidden="true" />
            Main Clinic · Internal Medicine
          </span>
          <div className="ml-auto flex items-center gap-2">
            {extras}
            {onToggleExamMode && (
              <button
                type="button"
                onClick={onToggleExamMode}
                aria-label={examMode ? "Exit exam mode" : "Start exam mode (30 min)"}
                title={examMode ? "Exit exam mode" : "Start exam mode (30 min)"}
                className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                  examMode
                    ? examUrgent
                      ? "bg-red-600 text-white"
                      : "bg-amber-600 text-white"
                    : "text-white/80 ring-1 ring-white/20 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Timer className="h-4 w-4" aria-hidden="true" />
                {examMode && examTimeRemaining !== undefined ? (
                  <span className="font-mono font-bold">{formatClock(examTimeRemaining)}</span>
                ) : (
                  <span>Exam</span>
                )}
              </button>
            )}
          </div>
        </div>
      )}
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
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
        open ? "bg-white text-[#192166]" : "text-white/80 ring-1 ring-white/20 hover:bg-white/10 hover:text-white"
      }`}
    >
      <PanelRightClose className="h-4 w-4" aria-hidden="true" />
      <span>Summary</span>
    </button>
  );
}
