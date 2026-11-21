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
import { DENTAL_LEGACY_STAGE } from "../src/components/dental/DentalTrackStore";
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

describe("the rail — eleven pages, no SOON", () => {
  test("the items are Home, Schedule, Patients, Charts, Coding, Claims, Payments, Denials and AR, Reports, Practice Cases, Settings", () => {
    expect(SHELL_NAV_ORDER).toEqual([
      "home",
      "schedule",
      "patients",
      "charts",
      "coding",
      "claims",
      "payments",
      "denials-ar",
      "reports",
      "practice-cases",
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

  test("no destination says Soon, and none is a placeholder", () => {
    const navItems = read("src/components/shell/navItems.ts");
    const header = read("src/components/shell/AppHeader.tsx");
    expect(navItems).not.toContain('"soon"');
    expect(header).not.toContain("Soon");
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

  test("dental's old 'claims' and 'ledger' steps are Claim and Remittance now", () => {
    // The two out-of-model steps are read, never dropped: an old id still names
    // the stage it belongs to (spec `sidebar-stage-fixes.md`, defect 4).
    expect(DENTAL_LEGACY_STAGE.claims).toBe("claim");
    expect(DENTAL_LEGACY_STAGE.ledger).toBe("remittance");
    // The mapping itself names only current stages — no `claims`, no `ledger`.
    expect(DENTAL_STAGE_TO_MODEL.claim).toBe("claim");
    expect(DENTAL_STAGE_TO_MODEL.remittance).toBe("remittance");
    expect(rcmLabel(DENTAL_STAGE_TO_MODEL.remittance)).toBe("Remittance");
    expect(DENTAL_STAGE_TO_MODEL.claims).toBeUndefined();
    expect(DENTAL_STAGE_TO_MODEL.ledger).toBeUndefined();
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
    ["/cases/", "src/routes/cases.index.tsx", "practice-cases"],
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

  /**
   * The regression this guards: `/cases` is the parent of
   * `/cases/$track/$caseId/$stage`, so it must draw its child. When it drew the
   * list itself and rendered no `<Outlet />`, every case deep link showed the
   * case list instead of the case.
   */
  test("/cases is a layout that draws its child, and the list is its index child", () => {
    const layout = read("src/routes/cases.tsx");
    expect(layout).toContain('createFileRoute("/cases")');
    expect(layout).toContain("<Outlet />");
    expect(layout).not.toContain("<AppShell");
    expect(read("src/routes/cases.index.tsx")).toContain('createFileRoute("/cases/")');
    // The generated tree must carry the index child under the layout, or the
    // list never draws and `/cases` is a blank frame.
    const tree = read("src/routeTree.gen.ts");
    expect(tree).toContain("CasesIndexRoute: typeof CasesIndexRoute");
    expect(tree).toContain("getParentRoute: () => CasesRoute,");
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
