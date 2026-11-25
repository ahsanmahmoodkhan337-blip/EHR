/**
 * TabsEpic — Chart Tabs Navigation
 *
 * Inspiration: Epic Hyperspace / Epic EHR tabbed chart navigation.
 * Epic organizes the patient chart into a series of horizontal tabs
 * (Summary, Notes, Orders, Medications, Results, etc.) that let
 * clinicians switch between clinical domains without losing context.
 * This component mimics that tab-bar UX with smooth transitions and
 * clear active-state indicators, and includes a Chart Search bar on
 * the right side for searching the active patient's clinical data.
 */

import { useState, type ReactNode } from "react";
import {
  Activity,
  Beaker,
  BookOpen,
  ClipboardList,
  FileText,
  HeartPulse,
  Pill,
  Stethoscope,
  Syringe,
} from "lucide-react";
import { ChartSearch } from "./ChartSearch";

// ─── Tab Definition ────────────────────────────────────────────────

export interface Tab {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: string | number;
  badgeColor?: string;
}

const DEFAULT_TABS: Tab[] = [
  {
    id: "summary",
    label: "Summary",
    icon: <ClipboardList className="h-4 w-4" />,
  },
  {
    id: "vitals",
    label: "Vitals",
    icon: <Activity className="h-4 w-4" />,
  },
  {
    id: "medications",
    label: "Medications",
    icon: <Pill className="h-4 w-4" />,
    badge: 5,
  },
  {
    id: "problems",
    label: "Problems",
    icon: <Stethoscope className="h-4 w-4" />,
    badge: 4,
  },
  {
    id: "labs",
    label: "Labs & Results",
    icon: <Beaker className="h-4 w-4" />,
  },
  {
    id: "orders",
    label: "Orders",
    icon: <ClipboardList className="h-4 w-4" />,
    badge: 2,
  },
  {
    id: "imaging",
    label: "Imaging",
    icon: <HeartPulse className="h-4 w-4" />,
  },
  {
    id: "immunizations",
    label: "Immunizations",
    icon: <Syringe className="h-4 w-4" />,
  },
  {
    id: "notes",
    label: "Notes",
    icon: <FileText className="h-4 w-4" />,
    badge: 3,
  },
  {
    id: "referrals",
    label: "Referrals",
    icon: <BookOpen className="h-4 w-4" />,
  },
];

// ─── Props ─────────────────────────────────────────────────────────

interface TabsEpicProps {
  tabs?: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
  /** Patient ID for the ChartSearch component */
  patientId?: string;
}

// ─── Component ─────────────────────────────────────────────────────

export function TabsEpic({
  tabs = DEFAULT_TABS,
  activeTab,
  onTabChange,
  className = "",
  patientId,
}: TabsEpicProps) {
  return (
    <nav
      className={`flex items-center border-b border-slate-200 bg-white ${className}`}
      role="tablist"
      aria-label="Patient chart navigation"
    >
      <div className="flex flex-1 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              onClick={() => onTabChange(tab.id)}
              className={`
                group relative flex shrink-0 items-center gap-1.5 px-3 py-3 text-xs font-medium
                transition-colors duration-150
                ${
                  isActive
                    ? "text-brand-700"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }
              `}
            >
              {/* Active indicator bar */}
              {isActive && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-brand-600" />
              )}

              <span
                className={`${
                  isActive ? "text-brand-600" : "text-slate-400 group-hover:text-slate-500"
                }`}
              >
                {tab.icon}
              </span>
              <span>{tab.label}</span>

              {tab.badge !== undefined && (
                <span
                  className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white ${
                    tab.badgeColor || "bg-brand-500"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Chart Search — right-aligned in the tab bar */}
      {patientId && (
        <div className="shrink-0 px-3">
          <ChartSearch patientId={patientId} />
        </div>
      )}
    </nav>
  );
}

// ─── Tab Panel Wrapper ─────────────────────────────────────────────

interface TabPanelProps {
  id: string;
  activeTab: string;
  children: ReactNode;
  className?: string;
}

export function TabPanel({ id, activeTab, children, className = "" }: TabPanelProps) {
  if (id !== activeTab) return null;

  return (
    <div
      id={`tabpanel-${id}`}
      role="tabpanel"
      aria-labelledby={`tab-${id}`}
      className={className}
    >
      {children}
    </div>
  );
}

// ─── Hook for managing tab state ───────────────────────────────────

export function useTabsEpic(initialTab = "summary") {
  const [activeTab, setActiveTab] = useState(initialTab);
  return { activeTab, setActiveTab };
}