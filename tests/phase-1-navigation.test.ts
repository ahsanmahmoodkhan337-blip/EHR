/**
 * Phase 1 — navigation.
 *
 * Spec `phase-1-navigation.md`. Four promises are tested here:
 *   1. Every rail item is a real page, in the owner's order, and no "SOON" item
 *      is left in the model.
 *   2. The eight-stage model is one list, identical for both tracks, and both
 *      runners render their stages under the model's own names.
 *   3. Each new page is a route of its own and marks its rail item active.
 *   4. `/medical-cases` and `/dental` redirect to `/cases`.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SHELL_NAV_ITEMS, SHELL_NAV_ORDER } from "../src/components/shell/navItems";
import {
  DENTAL_STAGE_TO_MODEL,
  MEDICAL_STAGE_TO_MODEL,
  RCM_STAGE_MODEL,
  modelStagesFor,
  rcmLabel,
  stageModelFor,
} from "../src/components/shell/stageModel";

const root = join(import.meta.dir, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const EIGHT = [
  "Front Desk",
  "Chart",
  "Coding",
  "Prior Auth",
  "Claim",
  "Remittance",
  "AR",
  "Debrief",
];

describe("the rail — six pages, no SOON", () => {
  test("the items are Home, Schedule, Patients, Practice Cases, Reference, Settings", () => {
    expect(SHELL_NAV_ORDER).toEqual([
      "home",
      "schedule",
      "patients",
      "practice-cases",
      "reference",
      "settings",
    ]);
  });

  test("every item opens a real page — there is no 'soon' target left", () => {
    for (const item of SHELL_NAV_ITEMS) {
      expect(typeof item.to).toBe("string");
      expect(item.to.startsWith("/")).toBe(true);
    }
    expect(read("src/components/shell/navItems.ts")).not.toContain('"soon"');
  });

  test("the sidebar has no not-built-yet branch to render", () => {
    const sidebar = read("src/components/shell/AppSidebar.tsx");
    expect(sidebar).not.toContain('"soon"');
    expect(sidebar).not.toContain("Soon");
  });
});

describe("one eight-stage model for both tracks", () => {
  test("the model is the eight stages, in order", () => {
    expect(RCM_STAGE_MODEL.map((s) => s.label)).toEqual(EIGHT);
  });

  test("both tracks read the same model", () => {
    expect(stageModelFor("medical")).toEqual(stageModelFor("dental"));
    expect(stageModelFor("medical").map((s) => s.label)).toEqual(EIGHT);
  });

  test("both tracks name their stages from the model, never their own label", () => {
    for (const mapping of [MEDICAL_STAGE_TO_MODEL, DENTAL_STAGE_TO_MODEL]) {
      for (const stage of modelStagesFor(mapping)) {
        expect(stage.label).toBe(rcmLabel(stage.id));
      }
    }
  });

  test("dental's duplicate 'Claims' stage is the Remittance stage now", () => {
    expect(DENTAL_STAGE_TO_MODEL.claims).toBe("remittance");
    expect(DENTAL_STAGE_TO_MODEL.claim).toBe("claim");
    expect(rcmLabel(DENTAL_STAGE_TO_MODEL.claims)).toBe("Remittance");
  });

  test("medical's registration and eligibility are one Front Desk stage", () => {
    expect(MEDICAL_STAGE_TO_MODEL.registration).toBe("front-desk");
    expect(MEDICAL_STAGE_TO_MODEL.eligibility).toBe("front-desk");
    const labels = modelStagesFor(MEDICAL_STAGE_TO_MODEL).map((s) => s.label);
    expect(labels.filter((l) => l === "Front Desk")).toHaveLength(1);
  });

  test("a hidden conditional stage is dropped from the row, not renamed", () => {
    const labels = modelStagesFor(MEDICAL_STAGE_TO_MODEL, { hide: ["prior-auth"] }).map((s) => s.label);
    expect(labels).not.toContain("Prior Auth");
    expect(labels).toContain("Claim");
  });
});

describe("every new page is a route of its own", () => {
  const pages: [string, string, string][] = [
    ["/schedule", "src/routes/schedule.tsx", "schedule"],
    ["/patients", "src/routes/patients.tsx", "patients"],
    ["/cases", "src/routes/cases.tsx", "practice-cases"],
    ["/reference", "src/routes/reference.tsx", "reference"],
  ];

  for (const [path, file, activeNav] of pages) {
    test(`${path} renders its own page and marks ${activeNav} active`, () => {
      const source = read(file);
      expect(source).toContain(`createFileRoute("${path}")`);
      expect(source).toContain(`activeNav="${activeNav}"`);
      expect(source).toContain("<AppShell");
    });
  }

  test("Home marks the Home item active", () => {
    expect(read("src/routes/index.tsx")).toContain('activeNav={shellActiveNav}');
  });
});

describe("the old case-list addresses still work", () => {
  for (const file of ["src/routes/medical-cases.tsx", "src/routes/dental.tsx"]) {
    test(`${file} redirects to /cases`, () => {
      const source = read(file);
      expect(source).toContain('redirect({ to: "/cases"');
      expect(source).toContain("beforeLoad");
    });
  }
});
