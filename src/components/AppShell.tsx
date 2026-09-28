/**
 * AppShell — 3-Zone Layout Shell
 *
 * Inspiration: Blended from Epic (top nav + chart area + right summary),
 * eCW (compact right-side patient summary), and Athenahealth (persistent
 * left workflow sidebar). Provides a consistent layout wrapper for the
 * entire EHR simulation.
 *
 * Layout Zones:
 * ┌─────────────────────────────────────────┐
 * │  Header (slot) — sticky top             │
 * ├──────────┬──────────────────┬───────────┤
 * │  Left    │  Main Content    │  Right    │
 * │  Panel   │  (flex-1)        │  Panel    │
 * │ (always) │                  │ (coll.)   │
 * ├──────────┴──────────────────┴───────────┤
 * │  Footer                                 │
 * └─────────────────────────────────────────┘
 *
 * Props:
 * - header: Header component
 * - leftPanel: Persistent left sidebar (e.g. workflow) — always visible on desktop
 * - rightPanel: Collapsible right sidebar (e.g. patient summary)
 * - showRightPanel: Whether to show the right panel
 * - children: Main content area
 */

import type { ReactNode } from "react";
import { WhatsAppFloat } from "./WhatsAppFloat";

interface AppShellProps {
  header: ReactNode;
  /** Full-width strip rendered directly below the header (e.g. patient banner). */
  banner?: ReactNode;
  leftPanel?: ReactNode;
  rightPanel?: ReactNode;
  showRightPanel?: boolean;
  footer?: ReactNode;
  children: ReactNode;
}

export function AppShell({
  header,
  banner,
  leftPanel,
  rightPanel,
  showRightPanel = true,
  footer,
  children,
}: AppShellProps) {
  return (
    <div className="app-shell">
      {/* Top: Header */}
      {header}

      {/* Below-header banner (persistent patient context) */}
      {banner}

      {/* Middle: 3-zone body */}
      <div className="app-shell-body flex-1">
        {/* Left panel — always visible on desktop when patient selected */}
        {leftPanel && (
          <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white overflow-y-auto lg:block">
            {leftPanel}
          </aside>
        )}

        {/* Center: Main content */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>

        {/* Right panel — collapsible */}
        {rightPanel && showRightPanel && (
          <aside className="hidden w-72 shrink-0 border-l border-slate-200 overflow-y-auto xl:block">
            {rightPanel}
          </aside>
        )}
      </div>

      {/* Bottom: Footer */}
      {footer}

      {/* Floating WhatsApp Button */}
      <WhatsAppFloat />
    </div>
  );
}