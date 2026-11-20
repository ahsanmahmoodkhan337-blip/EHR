/**
 * AppShell — the one application frame, used by every working page.
 *
 * Inspiration: athenaOne's frame (one left navigation rail, one top bar, a
 * work area that scrolls inside itself) with Epic Hyperspace's persistent
 * patient banner and eClinicalWorks' right-hand patient summary.
 *
 * Replaces the three separate headers the app used to carry (the medical
 * workspace header, the dental track header and the medical-cases header):
 *
 * ┌────────┬──────────────────────────────────────────┐
 * │        │  Top bar (search, track, role, timer…)   │  ← sticky
 * │  Side  ├──────────────────────────────────────────┤
 * │  bar   │  Patient banner (sticky under the bar)   │
 * │        ├──────────┬────────────────────┬──────────┤
 * │        │  Left    │  Work area         │  Right   │
 * │        │  panel   │  (min-w-0, flex-1) │  panel   │
 * └────────┴──────────┴────────────────────┴──────────┘
 *
 * The shell owns only the frame: navigation state, the collapsible rail, the
 * top bar and where the banner sticks. Page content is passed in as children
 * and is never restructured here.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AppSidebar } from "./shell/AppSidebar";
import { AppTopBar } from "./shell/AppTopBar";
import type { ShellNavId, ShellTrack } from "./shell/navItems";
import { HelpLauncher } from "./shell/HelpLauncher";

const COLLAPSE_KEY = "hh_shell_sidebar_collapsed";

interface AppShellProps {
  /** Which revenue cycle the frame is serving. */
  track: ShellTrack;
  /** Sidebar item to mark as current, or null when none matches. */
  activeNav?: ShellNavId | null;
  /** Switches an in-page medical workspace (Schedule / Patients / Charts). */
  onWorkspaceSelect?: (workspace: string) => void;

  selectedPatientId?: string;
  onPatientSelect?: (patientId: string) => void;
  roleLabel?: string;
  examMode?: boolean;
  examTimeRemaining?: number;
  onToggleExamMode?: () => void;
  /** Route-specific top-bar controls (for example the summary toggle). */
  topBarExtras?: ReactNode;

  /** Full-width strip rendered directly below the top bar (patient banner). */
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
  activeNav = null,
  onWorkspaceSelect,
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
  // The rail's collapsed state is a preference, so it survives a reload.
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(COLLAPSE_KEY) === "true";
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(COLLAPSE_KEY, String(collapsed));
  }, [collapsed]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <div className="app-shell">
      <AppSidebar
        track={track}
        activeNav={activeNav}
        onWorkspaceSelect={onWorkspaceSelect}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((value) => !value)}
        mobileOpen={mobileOpen}
        onCloseMobile={closeMobile}
      />

      <div className="app-shell-main">
        {/* Top bar + patient banner stay put while the work area scrolls */}
        <div className="sticky top-0 z-40 shrink-0">
          <AppTopBar
            track={track}
            selectedPatientId={selectedPatientId}
            onPatientSelect={onPatientSelect}
            roleLabel={roleLabel}
            examMode={examMode}
            examTimeRemaining={examTimeRemaining}
            onToggleExamMode={onToggleExamMode}
            onOpenSidebar={() => setMobileOpen(true)}
            extras={topBarExtras}
          />
          {banner}
        </div>

        {/* Middle: 3-zone body */}
        <div className="app-shell-body min-h-0 flex-1">
          {leftPanel && (
            <aside className="hidden w-72 shrink-0 overflow-y-auto border-r border-slate-200 bg-white lg:block dark:border-slate-800 dark:bg-slate-900">
              {leftPanel}
            </aside>
          )}

          <main className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</main>

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
