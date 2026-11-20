/**
 * navItems.ts — the one list of destinations
 *
 * Inspired by Epic Hyperspace's activity list: one entry per destination, the
 * same list on every page.
 *
 * Owner's style correction, 2026-11-21 (spec `nov19-style-restore.md` §1): the
 * eleven-button left rail is **gone**, and this list is no longer a rail. It is
 * the register of destinations — **eleven buttons in all**, in this order, in
 * both tracks —
 *
 *   Home · Schedule · Patients · Charts · Coding · Claims · Payments ·
 *   Denials and AR · Reports · Practice Cases · Settings
 *
 * and each one is still a real page reached from the 19 November navigation:
 * Home and Settings from the header bar (`shell/AppHeader.tsx`), the other nine
 * from the dashboard's Practice areas card (`routes/dashboard.tsx`) and, inside
 * an encounter, from the stepper (Coding, Claims, Payments, Denials and AR).
 * The dashboard builds its cards from this list, so a destination cannot fall
 * out of both.
 *
 * No entry says Soon, and no entry is a placeholder: every item here opens a
 * route that exists and draws something.
 *
 * Charts took the slot Reference held in PR #120; Reference is the drawer beside
 * the work, not a page students need in the list — its route (`/reference`)
 * still exists, it is simply not one of the eleven.
 *
 * Kept free of React on purpose: the router, the dashboard and the tests all
 * read this one list.
 */

import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  FileText,
  Home,
  Settings,
  Stethoscope,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/** The two revenue cycles the shell serves. */
export type ShellTrack = "medical" | "dental";

/**
 * Every destination the shell can name. Eleven of them are the eleven
 * destinations; `reference` stays here because `/reference` is still a page
 * with its own address, it is just not one of the eleven.
 */
export type ShellNavId =
  | "home"
  | "schedule"
  | "patients"
  | "charts"
  | "coding"
  | "claims"
  | "payments"
  | "denials-ar"
  | "reports"
  | "practice-cases"
  | "settings"
  | "reference";

/** A page that exists. Literals so the router can type the link. */
export type ShellRoutePath =
  | "/"
  | "/schedule"
  | "/patients"
  | "/charts"
  | "/coding"
  | "/claims"
  | "/payments"
  | "/denials-ar"
  | "/reports"
  | "/cases"
  | "/reference"
  | "/settings";

export interface ShellNavItem {
  id: ShellNavId;
  label: string;
  icon: LucideIcon;
  /** The page this item opens. Always a real route. */
  to: ShellRoutePath;
  /** True when the page is shared by both tracks (all of them are, today). */
  shared?: boolean;
}

export const SHELL_NAV_ITEMS: ShellNavItem[] = [
  { id: "home", label: "Home", icon: Home, to: "/", shared: true },
  { id: "schedule", label: "Schedule", icon: CalendarDays, to: "/schedule", shared: true },
  { id: "patients", label: "Patients", icon: Users, to: "/patients", shared: true },
  { id: "charts", label: "Charts", icon: Stethoscope, to: "/charts", shared: true },
  { id: "coding", label: "Coding", icon: ClipboardList, to: "/coding", shared: true },
  { id: "claims", label: "Claims", icon: FileText, to: "/claims", shared: true },
  { id: "payments", label: "Payments", icon: Wallet, to: "/payments", shared: true },
  { id: "denials-ar", label: "Denials and AR", icon: AlertTriangle, to: "/denials-ar", shared: true },
  { id: "reports", label: "Reports", icon: BarChart3, to: "/reports", shared: true },
  { id: "practice-cases", label: "Practice Cases", icon: BookOpen, to: "/cases", shared: true },
  { id: "settings", label: "Settings", icon: Settings, to: "/settings", shared: true },
];

/**
 * The rail's ids in order — the contract the tests hold the rail to, and the
 * order a reader of the brief expects to see.
 */
export const SHELL_NAV_ORDER: ShellNavId[] = SHELL_NAV_ITEMS.map((item) => item.id);
