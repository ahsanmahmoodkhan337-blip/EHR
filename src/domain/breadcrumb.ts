/**
 * breadcrumb.ts — where the student is, in words, from the address alone
 *
 * Inspired by: Epic Hyperspace's chart trail (the small line under the activity
 * bar that names the record you are in) and every web app's breadcrumb.
 *
 * Spec `slice-navigation.md` item 3: a visible Back button and a breadcrumb on
 * every page except the dashboard. The trail is derived from the pathname here,
 * in one pure module, so the strip the student reads and the page the router
 * drew cannot disagree — and a page that knows more than its address (the
 * patient in front of them, the stage they are on) passes a `tail` that
 * replaces the guess.
 *
 * `null` means "draw no breadcrumb": that is the dashboard, the page the trail
 * starts from.
 *
 * Kept free of React on purpose: the shell and the tests read this one list.
 */

/** One step of the trail. `to` absent = the page the student is on. */
export interface Crumb {
  label: string;
  to?: string;
}

/** The first crumb of every trail — the dashboard is the root of the app. */
export const DASHBOARD_CRUMB: Crumb = { label: "Dashboard", to: "/dashboard" };

/**
 * The one destination each top-level address belongs to. Same labels as the
 * header links (`shell/navItems.ts`), so a student who clicks "Claims" reads
 * "Claims" in the trail too.
 */
const PAGE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  schedule: "Schedule",
  patients: "Patients",
  charts: "Charts",
  coding: "Coding",
  claims: "Claims",
  payments: "Payments",
  "denials-ar": "Denials & AR",
  reports: "Reports",
  cases: "Practice Cases",
  "medical-cases": "Practice Cases",
  "practice-ar": "Practice AR",
  dental: "Dental track",
  reference: "Reference",
  settings: "Settings",
};

/** The page each top-level address links back to (the second crumb's target). */
const PAGE_ROUTES: Record<string, string> = {
  dashboard: "/dashboard",
  schedule: "/schedule",
  patients: "/patients",
  charts: "/charts",
  coding: "/coding",
  claims: "/claims",
  payments: "/payments",
  "denials-ar": "/denials-ar",
  reports: "/reports",
  cases: "/cases",
  "medical-cases": "/medical-cases",
  "practice-ar": "/practice-ar",
  dental: "/dental",
  reference: "/reference",
  settings: "/settings",
};

/** The address as segments, without the empty ones a trailing slash leaves. */
function segmentsOf(pathname: string): string[] {
  return pathname.split("?")[0].split("#")[0].split("/").filter(Boolean);
}

/**
 * The trail for an address, or `null` where none should be drawn.
 *
 * `tail` is what the page itself knows and its address does not — the patient's
 * name and the stage on screen in the encounter, the claim number on Claims.
 * When given, it replaces everything after the Dashboard crumb.
 */
export function breadcrumbForPath(pathname: string, tail?: Crumb[] | null): Crumb[] | null {
  const segments = segmentsOf(pathname);
  const head = segments[0] ?? "";

  // The dashboard is where the trail starts: no breadcrumb on it.
  if (head === "dashboard") return null;

  if (tail && tail.length > 0) return [DASHBOARD_CRUMB, ...tail];

  // Home (`/`) and the encounter's own address are the patient workspace. Its
  // page passes the patient and the stage; without them the trail still says
  // where the student is.
  if (head === "" || head === "encounter") {
    return [DASHBOARD_CRUMB, { label: "Encounter" }];
  }

  const label = PAGE_LABELS[head];
  if (!label) return [DASHBOARD_CRUMB, { label: head }];

  const trail: Crumb[] = [DASHBOARD_CRUMB, { label, to: PAGE_ROUTES[head] ?? `/${head}` }];

  // Anything below a top-level page (a patient id, a case id, a stage) is part
  // of the address but not a name we can read off it — the page that knows it
  // passes a `tail`. Until then the trail stops at the page.
  return trail;
}

/**
 * Which header link the address belongs to, so the current page is highlighted
 * (spec item 4). `null` where the page is not one of the header's four — the
 * encounter workspace has its own stepper and is not a header destination.
 */
export function headerNavForPath(pathname: string): "dashboard" | "schedule" | "patients" | "settings" | null {
  const head = segmentsOf(pathname)[0] ?? "";
  if (head === "dashboard") return "dashboard";
  if (head === "schedule") return "schedule";
  if (head === "patients") return "patients";
  if (head === "settings") return "settings";
  return null;
}
