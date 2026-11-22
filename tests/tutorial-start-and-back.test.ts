/**
 * Tutorial starts at the beginning, and Home always goes home.
 *
 * Specs `tutorial-start-and-back.md` and `home-button-returns-home.md`.
 *
 *   1. Opening the Tutorial patient leaves the encounter on the first stage as
 *      the scribe, with no ICD-10 or CPT code already submitted.
 *   2. Every stage after the first has one Back control that changes the stage
 *      shown and nothing else.
 *   3. The rail's Home entry is a destination even when the student is already
 *      on Home with a chart open, and it never resets saved work.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const STORE = read("src/store/pipelineStore.tsx");
const SEED = read("src/domain/tutorialEncounter.ts");
const INDEX = read("src/routes/index.tsx");
const SHELL = read("src/components/AppShell.tsx");
const SIDEBAR = read("src/components/shell/AppHeader.tsx");
const STAGE_NAV = read("src/components/shell/StageNav.tsx");

/** The body of one function, from its declaration to its closing brace. */
function functionBody(source: string, name: string): string {
  const start = source.indexOf(`const ${name} = `);
  expect(start).toBeGreaterThan(-1);
  const rest = source.slice(start);
  const end = rest.indexOf("\n  };");
  return rest.slice(0, end === -1 ? undefined : end);
}

describe("the Tutorial patient opens at the beginning", () => {
  // Superseded deliberately by spec `tutorial-patient-prefill.md` (owner,
  // 2026-11-22): the Tutorial Patient is now the *worked example* — a chart with
  // its note signed, its codes captured and its authorisation decided, so a
  // student can see which datum belongs where. What still holds is that the chart
  // opens on step 1, and that the example is written once and never over a
  // student's own work.
  test("the worked example is written once, guarded by the record's own seed key", () => {
    expect(STORE).toContain("seedTutorialEncounter");
    expect(STORE).toContain("applyTutorialSeed");
    expect(SEED).toContain("encounter.tutorialSeed === TUTORIAL_SEED_VERSION");
    expect(SEED).toContain("return !encounterHasWork(encounter);");
  });

  test("the note is signed through the one signature the app has", () => {
    expect(SEED).toContain("signNote(encounter,");
  });

  test("the tutorial opens on step 1, and never lands on a later step", () => {
    // Revised by spec `encounter-continuity.md`: every patient opens on step 1,
    // Registration, and walks forward from there.
    expect(INDEX).toContain("setActiveStage(CHART_OPENING_STEP);");
    expect(INDEX).not.toContain('setActiveStage("registration");');
    expect(INDEX).not.toContain('setActiveStage("sign-lock");');
  });

  test("the seed still only runs while the record is pending, never over work", () => {
    // The guard is the record's own shape (`tutorialSeedPending`), so the
    // built-in demo chart is replaced while a chart the student worked — or one
    // they are editing in this session — is left alone.
    expect(INDEX).toContain("patientId === TUTORIAL_PATIENT_ID &&");
    expect(INDEX).toContain("!savedForPatient &&");
    expect(INDEX).toContain("tutorialSeedPending(getEncounter(patientId))");
    expect(INDEX).not.toContain("const hasPipelineWork =");
  });
});

describe("every stage after the first has one way back", () => {
  test("the Back control is a real button with a visible label and 40 px hit area", () => {
    expect(STAGE_NAV).toContain("Back to {back.label}");
    expect(STAGE_NAV).toContain("min-h-10");
    expect(STAGE_NAV).toContain('type="button"');
    expect(STAGE_NAV).toContain("focus-visible:outline-2");
  });

  test("the first stage has no Back, and the stages after it do", () => {
    // The Back target is the previous stage in the list, so index 0 gets none.
    expect(INDEX).toContain("const scribeBack = scribeStageIndex > 0 ? SCRIBE_STAGES[scribeStageIndex - 1] : undefined;");
    expect(INDEX).toContain("back={");
  });

  test("every role stage names the stage it came from", () => {
    const block = INDEX.slice(INDEX.indexOf("const ROLE_BACK"), INDEX.indexOf("};", INDEX.indexOf("const ROLE_BACK")));
    for (const role of ["coder", "prior-auth", "biller", "ar-voice"]) {
      expect(block).toMatch(new RegExp(`"?${role}"?: \\{`));
    }
    // Scribe is the first stage, so it is never a Back target of its own.
    expect(block).not.toMatch(/"scribe": \{/);
  });

  test("going back changes the stage and nothing else", () => {
    // The Back handler only moves the stage: no reset, no submit, no delete.
    const handler = INDEX.slice(INDEX.indexOf("const handleHomeClick"));
    // The note sections' Back goes through the one handler that moves the chart
    // step and remembers the furthest one reached (spec `start-at-scribing.md`).
    expect(INDEX).toContain("onClick: () => goToChartStage(scribeBack.id)");
    // Every role stage's Back goes through the one flow handler that opens the
    // previous stage of the seven-stage encounter — navigation only.
    expect(INDEX).toContain("const flowPrevious = previousFlowStage(flowStageId);");
    expect(INDEX).toContain(
      "? { label: flowPrevious.label, onClick: () => openFlowStage(flowPrevious.id) }",
    );
    expect(handler).not.toContain("resetEncounter(");
  });
});

describe("Home always takes you home", () => {
  test("the header's Home control tells the page it was clicked", () => {
    // The rail is gone (spec `nov19-style-restore.md`); Home is the header's
    // house icon now, and it still reports the click to the page.
    expect(SIDEBAR).toContain("onClick={() => onHomeClick?.()}");
    expect(SHELL).toContain("onHomeClick={onHomeClick}");
    expect(INDEX).toContain("onHomeClick={handleHomeClick}");
  });

  test("Home flushes the draft and leaves saved work alone", () => {
    // Spec `slice-navigation.md` item 2: Home and the logo open `/dashboard`,
    // and only Resume opens the encounter — so Home no longer closes the chart
    // either. What it still does is flush the note on the way out.
    const handler = functionBody(INDEX, "handleHomeClick");
    expect(handler).toContain("saveNoteDraftNow();");
    expect(handler).toContain("saveCurrentSession();");
    expect(handler).not.toContain('setSelectedPatientId("");');
    // Navigation only: nothing is reset, cleared or rewritten.
    expect(handler).not.toContain("resetEncounter");
    expect(handler).not.toContain("delete ");
    expect(handler).not.toContain("setSoapNote(");
    expect(handler).not.toContain("setRole(");
  });

  test("Home is marked current on Home and the label is still visible", () => {
    expect(INDEX).toContain('const shellActiveNav: ShellNavId = "home";');
    // The house icon keeps its label, its 40 px hit area, and now opens the
    // dashboard (spec `slice-navigation.md` item 2).
    expect(SIDEBAR).toContain('aria-label="Home — go to the dashboard"');
    expect(SIDEBAR).toContain('to="/dashboard"');
    expect(SIDEBAR).toContain("h-10 w-10");
  });
});
