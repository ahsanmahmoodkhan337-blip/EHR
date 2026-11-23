/**
 * AppShell — the one application frame, used by every working page.
 *
 * Inspiration: Epic Hyperspace's chart frame (a navy header, a patient banner
 * under it, a patient list at the left, the work in the middle and a patient
 * summary at the right) — the 19 November build's own three-zone layout.
 *
 * Owner's style correction, 2026-11-21 (spec `nov19-style-restore.md`): the
 * eleven-button left rail is gone. The frame is the 19 November one again —
 *
 * ┌───────────────────────────────────────────────────┐
 * │  Navy header bar (Home, Settings, track, account) │  ← `.header-nav`
 * │  Patient banner (stuck under the bar)             │
 * ├────────┬───────────────────────────┬──────────────┤
 * │  Inbox │  Work area                │  Patient     │
 * │  /     │  (min-w-0, flex-1)        │  summary     │
 * │Patients│                           │  (collapsible)│
 * └────────┴───────────────────────────┴──────────────┘
 *
 * The left panel is the encounter's own Inbox / Patients list — a patient
 * picker, not a button rail — and it is drawn by the encounter route, not here.
 *
 * The destinations the rail used to hold are not gone with it: the header
 * carries Home and Settings, the dashboard carries a card for every page, and
 * the encounter's stepper opens the stages. `navItems.ts` is still the one list
 * of them.
 *
 * The shell owns only the frame: the header, where the banner sticks, the
 * panels and the footer. Page content is passed in as children and is never
 * restructured here.
 */

import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { AppHeader } from "./shell/AppHeader";
import { HelpLauncher } from "./shell/HelpLauncher";
import { NewVersionBar } from "./shell/NewVersionBar";
import { PageBreadcrumb } from "./shell/PageBreadcrumb";
import { breadcrumbForPath, type Crumb } from "../domain/breadcrumb";
import type { ShellNavId, ShellTrack } from "./shell/navItems";

interface AppShellProps {
  /** Which revenue cycle the frame is serving. */
  track: ShellTrack;
  /**
   * The destination the page is showing. The rail that used to highlight it is
   * gone; every route still names itself so the list of destinations stays in
   * one place (`navItems.ts`) while the rail is replaced by the header and the
   * dashboard cards.
   */
  activeNav?: ShellNavId | null;
  /**
   * Called when the header's Home control or the logo is clicked, before the
   * dashboard opens. Both now open `/dashboard` (spec `slice-navigation.md`
   * item 2 — only Resume opens the encounter); this is where the page flushes
   * what it holds, so a note draft is written on the way out rather than lost.
   */
  onHomeClick?: () => void;

  selectedPatientId?: string;
  onPatientSelect?: (patientId: string) => void;
  roleLabel?: string;
  examMode?: boolean;
  examTimeRemaining?: number;
  onToggleExamMode?: () => void;
  /** Route-specific header controls (for example the summary toggle). */
  topBarExtras?: ReactNode;

  /**
   * What this page knows and its address does not — the patient's name and the
   * stage on screen in the encounter, the claim number on Claims. It replaces
   * everything after the Dashboard crumb in the trail (spec
   * `slice-navigation.md` item 3). Pages that pass nothing get the trail their
   * pathname names.
   */
  breadcrumb?: Crumb[] | null;

  /** Full-width strip rendered directly below the header (patient banner). */
  banner?: ReactNode;
  leftPanel?: ReactNode;
  rightPanel?: ReactNode;
  showRightPanel?: boolean;
  /**
   * The split-pane reference drawer (spec item 6). Rendered as a sibling of the
   * work area so it can be a real split pane on a wide screen and a slide-over
   * on a narrow one — the drawer decides which, and the shell does not wrap it
   * in a `hidden lg:block` that would take its mobile button away with it.
   */
  reference?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

export function AppShell({
  track,
  onHomeClick,
  selectedPatientId,
  onPatientSelect,
  roleLabel,
  examMode,
  examTimeRemaining,
  onToggleExamMode,
  topBarExtras,
  breadcrumb,
  banner,
  leftPanel,
  rightPanel,
  showRightPanel = true,
  reference,
  footer,
  children,
}: AppShellProps) {
  // The page the router is drawing — the trail and the highlighted link are
  // read from it, so neither can drift from the screen (spec item 3 and 4).
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const trail = breadcrumbForPath(pathname, breadcrumb);

  return (
    <div className="app-shell">
      {/* Navy bar, the breadcrumb row, then the banner: full width, stuck to
          the top (19 Nov build + spec `slice-navigation.md` item 3). */}
      <div className="app-shell-header sticky top-0 z-40 shrink-0">
        <AppHeader
          track={track}
          onHomeClick={onHomeClick}
          selectedPatientId={selectedPatientId}
          onPatientSelect={onPatientSelect}
          roleLabel={roleLabel}
          examMode={examMode}
          examTimeRemaining={examTimeRemaining}
          onToggleExamMode={onToggleExamMode}
          extras={topBarExtras}
        />
        {/* Every page but the dashboard: Back + the trail. */}
        {trail && <PageBreadcrumb trail={trail} />}
        {banner}
        {/* A tab opened before a deploy still runs the old bundle: one line,
            one Reload, and the student decides (19 Nov tokens). */}
        <NewVersionBar />
      </div>

      <div className="app-shell-main">
        {/* Middle: 3-zone body */}
        <div className="app-shell-body min-h-0 flex-1">
          {leftPanel && (
            <aside className="hidden w-72 shrink-0 overflow-y-auto border-r border-slate-200 bg-white lg:block dark:border-slate-800 dark:bg-slate-900">
              {leftPanel}
            </aside>
          )}

          {/* The one scroll container in the app: the workspace scrolls
              itself, the page never does (spec phase-2-layout.md §1). */}
          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">{children}</main>

          {rightPanel && showRightPanel && (
            <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-slate-200 xl:block dark:border-slate-800">
              {rightPanel}
            </aside>
          )}

          {/* Reference drawer — the split pane beside the work area. It renders
              itself (inline pane, collapsed rail, or slide-over) so it works at
              360 px as well as 1920 px. */}
          {reference}
        </div>

        {/* The footer strip: the page's simulated-data line and the one help
            button side by side, both in the layout. The launcher used to float
            over the bottom-right corner and was measured covering the last
            row's "Open patient" button on Patients (slice H), so it is docked
            here where it cannot be drawn over anything. */}
        <div className="flex shrink-0 items-center gap-2 border-t border-slate-200 bg-white pr-2 dark:border-slate-800 dark:bg-slate-900">
          <div className="min-w-0 flex-1 [&_footer]:border-t-0">{footer}</div>
          <HelpLauncher />
        </div>
      </div>
    </div>
  );
}
