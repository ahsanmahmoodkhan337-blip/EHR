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
 * ┌───────────────────────────────────────────────────┐
 * │  Top bar (search, track, role, timer…)            │  ← sticky, full width
 * │  Patient banner (sticky under the bar)            │
 * ├────────┬───────────────────────────┬──────────────┤
 * │  Side  │  Work area                │  Right       │
 * │  bar   │  (min-w-0, flex-1)        │  panel       │
 * └────────┴───────────────────────────┴──────────────┘
 *
 * Owner's audit, 2026-11-20 (slice A): the navy top bar runs the **full width
 * above the rail**, exactly as the 19 November build did. Before this it started
 * to the right of the rail, so the bar looked cut in half. The rail sits under
 * the bar now, and sticks below it — the header's measured height is published as
 * `--app-header-h` so the rail's sticky offset follows the banner too.
 *
 * The shell owns only the frame: navigation state, the collapsible rail, the
 * top bar and where the banner sticks. Page content is passed in as children
 * and is never restructured here.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
  /**
   * Called when the rail's Home entry is clicked. Home is a destination even
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

  // The header's real height (top bar, plus the patient banner when one is
  // drawn) is published to the frame as `--app-header-h`, so the rail sticks
  // directly under it instead of guessing a pixel value.
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(52);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const measure = () => setHeaderHeight(el.offsetHeight);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="app-shell"
      style={{ ["--app-header-h" as string]: `${headerHeight}px` }}
    >
      {/* Navy bar + banner: full width, above the rail (19 Nov build). */}
      <div ref={headerRef} className="app-shell-header sticky top-0 z-40 shrink-0">
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

      <div className="app-shell-row">
        <AppSidebar
          track={track}
          activeNav={activeNav}
          onHomeClick={onHomeClick}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((value) => !value)}
          mobileOpen={mobileOpen}
          onCloseMobile={closeMobile}
        />

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
      </div>

      {/* One help button, collapsed to a 44 px launcher so it never sits over a
          form control until the student opens it (spec item 10). */}
      <HelpLauncher />
    </div>
  );
}
