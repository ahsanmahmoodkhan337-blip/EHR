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
import { AppHeader } from "./shell/AppHeader";
import { HelpLauncher } from "./shell/HelpLauncher";
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
   * Called when the header's Home control is clicked. Home is a destination even
   * when the page is already Home (spec `home-button-returns-home.md`), so the
   * page gets to close whatever workspace is open in front of it.
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
  banner,
  leftPanel,
  rightPanel,
  showRightPanel = true,
  reference,
  footer,
  children,
}: AppShellProps) {
  return (
    <div className="app-shell">
      {/* Navy bar + banner: full width, stuck to the top (19 Nov build). */}
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
        {banner}
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

        {footer}
      </div>

      {/* One help button, collapsed to a 44 px launcher so it never sits over a
          form control until the student opens it (spec item 10). */}
      <HelpLauncher />
    </div>
  );
}
