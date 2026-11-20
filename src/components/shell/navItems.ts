/**
 * Shell navigation model — the one list of destinations the sidebar renders.
 *
 * Inspiration: athenaOne's left navigation rail (one entry per revenue-cycle
 * workspace, collapsible to icons) with Epic Hyperspace's activity toolbar as
 * the secondary reference.
 *
 * Every item states honestly what exists today (specs/task-1-app-shell.md,
 * item 1, and the "honest dependencies" section):
 *  - `route`     — a real page that already ships; the item links to it.
 *  - `workspace` — a workspace that already exists inside the medical track;
 *                  the item switches to it in place.
 *  - `soon`      — no screen exists yet. The item is rendered as unavailable
 *                  with the reason on screen, never as a link to nowhere. The
 *                  money-cycle screens arrive with TASK 4 + TASK 5.
 */

import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarDays,
  FileText,
  Home,
  Receipt,
  Settings,
  Stethoscope,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/** The two revenue cycles the shell serves. */
export type ShellTrack = "medical" | "dental";

export type ShellNavId =
  | "home"
  | "schedule"
  | "patients"
  | "charts"
  | "coding"
  | "claims"
  | "payments"
  | "denials"
  | "reports"
  | "practice-cases"
  | "settings";

/** A page that already exists. Kept as literals so the router can type them. */
export type ShellRoutePath = "/" | "/dental" | "/medical-cases" | "/settings";

export interface ShellNavItem {
  id: ShellNavId;
  label: string;
  icon: LucideIcon;
  /** Where the item goes, per track. */
  target: (track: ShellTrack) => ShellNavTarget;
}

export type ShellNavTarget =
  | { kind: "route"; to: ShellRoutePath }
  | { kind: "workspace"; workspace: string }
  | { kind: "soon"; reason: string };

const NOT_BUILT_YET =
  "No screen for this yet — it arrives with the money cycle (TASK 4 + 5).";

const DENTAL_ONLY_IN_CASE =
  "Dental practices this inside a running case — open the dental track.";

export const SHELL_NAV_ITEMS: ShellNavItem[] = [
  {
    id: "home",
    label: "Home",
    icon: Home,
    target: (track) => ({ kind: "route", to: track === "dental" ? "/dental" : "/" }),
  },
  {
    id: "schedule",
    label: "Schedule",
    icon: CalendarDays,
    target: (track) =>
      track === "medical"
        ? { kind: "workspace", workspace: "schedule" }
        : { kind: "soon", reason: DENTAL_ONLY_IN_CASE },
  },
  {
    id: "patients",
    label: "Patients",
    icon: Users,
    target: (track) =>
      track === "medical"
        ? { kind: "workspace", workspace: "chart" }
        : { kind: "soon", reason: DENTAL_ONLY_IN_CASE },
  },
  {
    id: "charts",
    label: "Charts",
    icon: FileText,
    target: (track) =>
      track === "medical"
        ? { kind: "workspace", workspace: "note" }
        : { kind: "soon", reason: DENTAL_ONLY_IN_CASE },
  },
  { id: "coding", label: "Coding", icon: Stethoscope, target: () => ({ kind: "soon", reason: NOT_BUILT_YET }) },
  { id: "claims", label: "Claims", icon: Receipt, target: () => ({ kind: "soon", reason: NOT_BUILT_YET }) },
  { id: "payments", label: "Payments", icon: Wallet, target: () => ({ kind: "soon", reason: NOT_BUILT_YET }) },
  {
    id: "denials",
    label: "Denials and AR",
    icon: AlertTriangle,
    target: () => ({ kind: "soon", reason: NOT_BUILT_YET }),
  },
  { id: "reports", label: "Reports", icon: BarChart3, target: () => ({ kind: "soon", reason: NOT_BUILT_YET }) },
  {
    id: "practice-cases",
    label: "Practice Cases",
    icon: BookOpen,
    target: (track) => ({ kind: "route", to: track === "dental" ? "/dental" : "/medical-cases" }),
  },
  { id: "settings", label: "Settings", icon: Settings, target: () => ({ kind: "route", to: "/settings" }) },
];
