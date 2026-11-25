/**
 * WorkspaceTabs — Epic-Style Workspace Navigation
 *
 * Inspiration: Epic Hyperspace workspace-level navigation.
 * Epic organizes the clinical workflow into top-level workspace
 * views: Schedule, Chart, InBasket, and Notes. These are the
 * HIGHEST level of navigation — above the chart section tabs —
 * letting clinicians switch between major activities.
 *
 * This component renders a horizontal tab bar with 4 workspace
 * views:
 * 1. Daily Schedule — today's appointments (placeholder)
 * 2. Patient Chart Review — the full chart (TabsEpic + content)
 * 3. InBasket/Alert Center — messages, alerts, results
 * 4. Active Progress Note — the note being written
 *
 * Each workspace tab switches the entire main content area.
 */

import { useState, type ReactNode } from "react";
import {
  CalendarDays,
  ClipboardList,
  Inbox,
  FileEdit,
} from "lucide-react";

// ─── Workspace Tab Definition ──────────────────────────────────────

export interface WorkspaceTab {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: string | number;
}

const WORKSPACE_TABS: WorkspaceTab[] = [
  {
    id: "schedule",
    label: "Daily Schedule",
    icon: <CalendarDays className="h-4 w-4" />,
  },
  {
    id: "chart",
    label: "Patient Chart Review",
    icon: <ClipboardList className="h-4 w-4" />,
  },
  {
    id: "inbasket",
    label: "InBasket / Alert Center",
    icon: <Inbox className="h-4 w-4" />,
  },
  {
    id: "note",
    label: "Active Progress Note",
    icon: <FileEdit className="h-4 w-4" />,
  },
];

// ─── Props ─────────────────────────────────────────────────────────

interface WorkspaceTabsProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
  /** Optional chart search bar to render on the right side (shown during chart review) */
  chartSearch?: ReactNode;
  /**
   * Real counts, keyed by tab id. The InBasket badge used to be the literal `3`
   * in the module-level tab list, so it read `3` on an empty practice while the
   * same page's Work Queues panel said "nothing waiting" (lead walk, 2026-11-21).
   * The caller now passes the count it already derived from the student's saved
   * records, and a tab with nothing waiting draws no badge at all.
   */
  badges?: Partial<Record<string, number>>;
}

// ─── Component ─────────────────────────────────────────────────────

export function WorkspaceTabs({
  activeTab,
  onTabChange,
  className = "",
  chartSearch,
  badges,
}: WorkspaceTabsProps) {
  return (
    <div className={`border-b border-slate-200 bg-white ${className}`}>
      <div className="flex items-center">
        {/* Workspace tabs */}
        <nav className="flex" role="tablist" aria-label="Clinical workspace">
          {WORKSPACE_TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            const badge = badges?.[tab.id];
            return (
              <button
                key={tab.id}
                id={`workspace-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`workspace-panel-${tab.id}`}
                aria-label={tab.label}
                onClick={() => onTabChange(tab.id)}
                className={`
                  group relative flex min-h-10 items-center gap-2 px-4 py-3 text-sm font-medium
                  transition-colors duration-150
                  ${
                    isActive
                      ? "text-brand-700 bg-brand-50/50"
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                  }
                `}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-brand-600" />
                )}

                <span
                  aria-hidden="true"
                  className={`${
                    isActive ? "text-brand-600" : "text-slate-400 group-hover:text-slate-500"
                  }`}
                >
                  {tab.icon}
                </span>
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">
                  {tab.id === "schedule" && "Schedule"}
                  {tab.id === "chart" && "Chart"}
                  {tab.id === "inbasket" && "InBasket"}
                  {tab.id === "note" && "Note"}
                </span>

                {badge !== undefined && badge > 0 && (
                  <span
                    aria-label={`${badge} items waiting`}
                    className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold leading-none text-white"
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Chart Search — shown on the right when chart review is active */}
        {activeTab === "chart" && chartSearch && (
          <div className="px-3">{chartSearch}</div>
        )}
      </div>
    </div>
  );
}

// ─── Hook for managing workspace tab state ─────────────────────────

export function useWorkspaceTabs(initialTab = "chart") {
  const [activeWorkspace, setActiveWorkspace] = useState(initialTab);
  return { activeWorkspace, setActiveWorkspace };
}

// ─── Workspace Panel Wrapper ───────────────────────────────────────

interface WorkspacePanelProps {
  id: string;
  activeWorkspace: string;
  children: ReactNode;
  className?: string;
}

export function WorkspacePanel({
  id,
  activeWorkspace,
  children,
  className = "",
}: WorkspacePanelProps) {
  if (id !== activeWorkspace) return null;

  return (
    <div
      id={`workspace-panel-${id}`}
      role="tabpanel"
      aria-labelledby={`workspace-tab-${id}`}
      className={`flex flex-1 flex-col overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
}