/**
 * navItems.ts — the one sidebar model
 *
 * Inspired by athenaOne's left navigation rail and Epic Hyperspace's activity
 * toolbar: one entry per destination, the same list on every page.
 *
 * Spec `phase-1-navigation.md` items 1 and 2: every item in the rail is a page
 * of its own, in this order — Home, Schedule, Patients, Practice Cases,
 * Reference, Settings — and nothing else. There is no "coming soon" entry any
 * more: a rail item that does not open a page is not in the rail. The stages
 * that used to sit here as SOON (Coding, Claims, Payments, Denials and AR,
 * Reports) are reached inside a case, where they are stages of one encounter.
 *
 * Kept free of React on purpose: the router, the sidebar and the tests all read
 * this one list.
 */

import {
  BookOpen,
  CalendarDays,
  Home,
  Library,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

/** The two revenue cycles the shell serves. */
export type ShellTrack = "medical" | "dental";

/** Every destination in the rail. Six items, six pages. */
export type ShellNavId = "home" | "schedule" | "patients" | "practice-cases" | "reference" | "settings";

/** A page that exists. Literals so the router can type the link. */
export type ShellRoutePath = "/" | "/schedule" | "/patients" | "/cases" | "/reference" | "/settings";

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
  { id: "practice-cases", label: "Practice Cases", icon: BookOpen, to: "/cases", shared: true },
  { id: "reference", label: "Reference", icon: Library, to: "/reference", shared: true },
  { id: "settings", label: "Settings", icon: Settings, to: "/settings", shared: true },
];

/**
 * The rail's ids in order — the contract the tests hold the rail to, and the
 * order a reader of the brief expects to see.
 */
export const SHELL_NAV_ORDER: ShellNavId[] = SHELL_NAV_ITEMS.map((item) => item.id);
