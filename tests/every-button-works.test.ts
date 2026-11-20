/**
 * every-button-works.test.ts — a dead control cannot ship on a rail page
 *
 * Spec `every-button-works.md` item 5, STANDING-RULES 5.
 *
 * The eleven rail pages (Home `/`, `/schedule`, `/patients`, `/charts`,
 * `/coding`, `/claims`, `/payments`, `/denials-ar`, `/reports`, `/cases`,
 * `/settings`) are walked here as source: every interactive element they draw —
 * button, link, input, select, textarea — must either
 *
 *   - carry the handler that makes it do what its label says (`onClick`,
 *     `onChange`, `onSubmit`, `href`, `to`), or
 *   - be `disabled` AND state why in the same breath (`title=`, an
 *     `aria-describedby` pointing at the reason, or an `aria-label` that says
 *     why).
 *
 * Anything else is a control a student can press that does nothing, and this
 * test fails on it.
 *
 * The page set is the route file plus the frame it renders (the rail, the top
 * bar, the banner, the help launcher) and the page's own panel — the files that
 * make up the eleven pages. A stage component inside an encounter is covered by
 * the encounter's own tests, not by this one.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

/** The eleven rail pages: the owner's rail, one route each (spec `eleven-rail-pages.md`). */
const RAIL_PAGES: { path: string; label: string }[] = [
  { path: "/", label: "Home" },
  { path: "/schedule", label: "Schedule" },
  { path: "/patients", label: "Patients" },
  { path: "/charts", label: "Charts" },
  { path: "/coding", label: "Coding" },
  { path: "/claims", label: "Claims" },
  { path: "/payments", label: "Payments" },
  { path: "/denials-ar", label: "Denials and AR" },
  { path: "/reports", label: "Reports" },
  { path: "/cases", label: "Practice Cases" },
  { path: "/settings", label: "Settings" },
];

/** Every file the eleven pages draw: the route, the frame, the page's own panel. */
const PAGE_FILES = [
  "src/routes/index.tsx",
  "src/routes/schedule.tsx",
  "src/routes/patients.tsx",
  "src/routes/charts.tsx",
  "src/routes/coding.tsx",
  "src/routes/claims.tsx",
  "src/routes/payments.tsx",
  "src/routes/denials-ar.tsx",
  "src/routes/reports.tsx",
  "src/routes/cases.tsx",
  "src/routes/cases.index.tsx",
  "src/routes/settings.tsx",
  "src/components/AppShell.tsx",
  "src/components/shell/AppSidebar.tsx",
  "src/components/shell/AppTopBar.tsx",
  "src/components/shell/PatientBanner.tsx",
  "src/components/shell/HelpLauncher.tsx",
  "src/components/shell/AutosaveIndicator.tsx",
  "src/components/shell/GlobalPatientSearch.tsx",
  "src/components/DarkModeToggle.tsx",
  "src/components/TabsEpic/DailySchedule.tsx",
  "src/components/status/HomeWorkQueues.tsx",
  "src/components/rail/RailPageFrame.tsx",
];

type Element = { file: string; tag: string; attrs: string; line: number };

/** JSX interactive elements, each with the attributes written on the tag. */
function interactiveElements(file: string, source: string): Element[] {
  const found: Element[] = [];
  const re = /<(button|a|input|select|textarea)([\s>])/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    const tag = match[1];
    const start = match.index;
    // Walk the tag to its closing '>', stepping over braces and quotes.
    let depth = 0;
    let quote: string | null = null;
    let i = start + match[0].length - 1;
    for (; i < source.length; i += 1) {
      const ch = source[i];
      if (quote) {
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") {
        quote = ch;
        continue;
      }
      if (ch === "{") depth += 1;
      else if (ch === "}") depth -= 1;
      else if (ch === ">" && depth === 0) break;
    }
    const attrs = source.slice(start, i + 1);
    found.push({ file, tag, attrs, line: source.slice(0, start).split("\n").length });
  }
  return found;
}

/** True when the element states why it cannot be used, in the same breath. */
function statesDisabledReason(attrs: string): boolean {
  if (!/\bdisabled\b/.test(attrs)) return false;
  return /\btitle=/.test(attrs) || /\baria-describedby=/.test(attrs) || /\baria-label=/.test(attrs);
}

/**
 * True when the element carries the handler its label promises.
 *
 * A text field may also be read by its `id` from the button beside it
 * (`document.getElementById("newLabInput").value`) — that is a field whose
 * value is used, not a decorative box.
 */
function hasHandler(element: Element, source: string): boolean {
  const { tag, attrs } = element;
  if (tag === "a") return /\bhref=/.test(attrs) || /\bonClick=/.test(attrs);
  if (tag === "button")
    return (
      /\bonClick=/.test(attrs) ||
      /\bonSubmit=/.test(attrs) ||
      /type="submit"/.test(attrs) ||
      /\bform=/.test(attrs)
    );
  if (/\bonChange=/.test(attrs) || /\bonInput=/.test(attrs)) return true;
  if (/\breadOnly\b/.test(attrs)) return true;
  const id = attrs.match(/\bid="([^"]+)"/);
  return id ? source.includes(`getElementById("${id[1]}")`) : false;
}

function deadControls(file: string, source: string): string[] {
  return interactiveElements(file, source)
    .filter((element) => !hasHandler(element, source) && !statesDisabledReason(element.attrs))
    .map((element) => {
      const label = element.attrs.replace(/\s+/g, " ").slice(0, 90);
      return `${element.file}:${element.line} <${element.tag}> ${label}`;
    });
}

describe("every control on the eleven rail pages does something or says why not", () => {
  for (const file of PAGE_FILES) {
    test(`${file} has no dead control`, () => {
      const dead = deadControls(file, read(file));
      expect(dead).toEqual([]);
    });
  }
});

describe("the rail never lies about where the student is", () => {
  const sidebar = read("src/components/shell/AppSidebar.tsx");
  const navItems = read("src/components/shell/navItems.ts");

  test("exactly one rail entry is marked aria-current, and only the active one", () => {
    const current = sidebar.match(/aria-current=\{/g) ?? [];
    expect(current.length).toBe(1);
    expect(sidebar).toContain('aria-current={isActive ? "page" : undefined}');
    expect(sidebar).toContain("const isActive = activeNav === item.id;");
  });

  test("each of the eleven rail entries opens its own page", () => {
    const targets = [...navItems.matchAll(/to: "([^"]+)"/g)].map((m) => m[1]);
    expect(targets).toEqual(RAIL_PAGES.map((page) => page.path));
    expect(targets).toHaveLength(11);
  });

  test("no rail entry says Soon, and none is a placeholder", () => {
    // No item carries a "soon" flag or a "soon" target — every one is a page.
    expect(navItems).not.toMatch(/\bsoon\s*:/);
    expect(navItems).not.toContain('"soon"');
    expect(sidebar).not.toContain("Soon");
    // Every label is a real destination, never a "coming soon" marker.
    const labels = [...navItems.matchAll(/label: "([^"]+)"/g)].map((m) => m[1]);
    expect(labels).toEqual([
      "Home",
      "Schedule",
      "Patients",
      "Charts",
      "Coding",
      "Claims",
      "Payments",
      "Denials and AR",
      "Reports",
      "Practice Cases",
      "Settings",
    ]);
  });

  test("every rail page names itself to the rail", () => {
    const expected: Record<string, string> = {
      "src/routes/schedule.tsx": 'activeNav="schedule"',
      "src/routes/coding.tsx": 'activeNav="coding"',
      "src/routes/claims.tsx": 'activeNav="claims"',
      "src/routes/payments.tsx": 'activeNav="payments"',
      "src/routes/denials-ar.tsx": 'activeNav="denials-ar"',
      "src/routes/reports.tsx": 'activeNav="reports"',
      "src/routes/patients.tsx": 'activeNav="patients"',
      "src/routes/charts.tsx": 'activeNav="charts"',
      "src/routes/cases.index.tsx": 'activeNav="practice-cases"',
      "src/routes/settings.tsx": 'activeNav="settings"',
    };
    for (const [file, marker] of Object.entries(expected)) {
      expect(read(file)).toContain(marker);
    }
    // Home's rail marker is a named constant, because `/` also draws a chart.
    const home = read("src/routes/index.tsx");
    expect(home).toContain("const shellActiveNav: ShellNavId = \"home\";");
    expect(home).toContain("activeNav={shellActiveNav}");
  });
});

describe("debug and simulate controls are not shown to students", () => {
  test("no rail page renders a debug or simulate control", () => {
    for (const file of PAGE_FILES) {
      const source = read(file);
      expect(source.toLowerCase()).not.toContain("simulate denial");
      expect(source.toLowerCase()).not.toContain("debug panel");
      expect(source).not.toContain("<ScenarioInjector");
    }
  });
});
