/**
 * Every patient opens at the scribing step, with Back to Registration.
 *
 * Spec `specs/start-at-scribing.md` (owner direction 2026-11-20: "tutorial
 * patient as well as other patients should start from scribing and back going
 * option should be here"). This revises `tutorial-start-and-back.md`, which
 * opened every patient at Registration.
 *
 *   1. A fresh patient — the Tutorial Patient and a normal one — opens on the
 *      first scribing step (Intake / Vitals), not on Registration.
 *   2. From that step, Back reaches Registration, and Registration itself shows
 *      no Back.
 *   3. Every stage after the first still renders exactly one Back, labelled with
 *      the stage it returns to.
 *   4. A patient with saved progress reopens at the furthest step reached, and
 *      opening a chart writes no note, code, claim or ledger entry.
 *   5. Both tracks are covered, and no step is renumbered, so no saved work is
 *      stranded.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CHART_OPENING_STEP,
  CHART_STEPS,
  chartStepRank,
  createEncounter,
  furthestChartStep,
  normalizeEncounter,
  resumeChartStep,
} from "../src/store/pipelineEncounter";

const root = join(import.meta.dir, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const INDEX = read("src/routes/index.tsx");
const STORE = read("src/store/pipelineStore.tsx");
const STAGE_NAV = read("src/components/shell/StageNav.tsx");
const DENTAL_STORE = read("src/components/dental/DentalTrackStore.tsx");

/** The body of one function, from its declaration to its closing brace. */
function functionBody(source: string, name: string): string {
  const start = source.indexOf(`const ${name} = `);
  expect(start).toBeGreaterThan(-1);
  const rest = source.slice(start);
  const end = rest.indexOf("\n  };");
  return rest.slice(0, end === -1 ? undefined : end);
}

describe("a patient opens at the scribing step", () => {
  test("the opening step is the first scribing step, not Registration", () => {
    expect(CHART_OPENING_STEP).toBe("intake-vitals");
    expect(CHART_STEPS[0].id).toBe("registration");
    expect(CHART_OPENING_STEP).not.toBe("registration");
    // Intake / Vitals is the step where the student starts charting the visit.
    expect(CHART_STEPS[1]).toEqual({ id: "intake-vitals", label: "Intake / Vitals" });
  });

  test("the chart's own default stage is the scribing step", () => {
    expect(INDEX).toContain("useState(CHART_OPENING_STEP);");
    expect(INDEX).not.toContain('useState("registration");');
  });

  test("the Tutorial Patient opens on the scribing step, not Registration", () => {
    expect(INDEX).toContain("setActiveStage(CHART_OPENING_STEP);");
    expect(INDEX).not.toContain('setActiveStage("registration");');
    // The prefill still only runs on a first visit, and nothing else moves the
    // tutorial to a later stage.
    expect(INDEX).toContain('if (patientId === "DEMO" && !hasPipelineWork) {');
    expect(INDEX).not.toContain('setActiveStage("sign-lock");');
  });

  test("a patient never worked opens on the scribing step too", () => {
    expect(INDEX).toContain(
      "setActiveStage(resumeChartStep(getEncounter(patientId)?.chartStage));",
    );
    expect(resumeChartStep(null)).toBe(CHART_OPENING_STEP);
    expect(resumeChartStep(undefined)).toBe(CHART_OPENING_STEP);
  });
});

describe("Back to Registration is on the opening step", () => {
  test("the opening step's Back is the stage before it, which is Registration", () => {
    const openingIndex = CHART_STEPS.findIndex((step) => step.id === CHART_OPENING_STEP);
    expect(openingIndex).toBe(1);
    expect(CHART_STEPS[openingIndex - 1].id).toBe("registration");
    // The Back control names the stage it goes to, so it reads "Back to Registration".
    expect(INDEX).toContain(
      "const scribeBack = scribeStageIndex > 0 ? SCRIBE_STAGES[scribeStageIndex - 1] : undefined;",
    );
    expect(STAGE_NAV).toContain("Back to {back.label}");
  });

  test("the Back control is a real button with keyboard focus and a 40 px hit area", () => {
    expect(STAGE_NAV).toContain('type="button"');
    expect(STAGE_NAV).toContain("min-h-10");
    expect(STAGE_NAV).toContain("focus-visible:outline-2");
    // Exactly one Back button in the component: no nested or duplicate control.
    expect(STAGE_NAV.match(/<ArrowLeft /g)?.length).toBe(1);
    expect(STAGE_NAV.match(/Back to \{back\.label\}/g)?.length).toBe(1);
  });

  test("Registration is still stage 1, and it has no Back of its own", () => {
    expect(CHART_STEPS[0]).toEqual({ id: "registration", label: "Registration" });
    expect(chartStepRank("registration")).toBe(0);
    // Index 0 gets no Back target, so the first stage renders none.
    expect(INDEX).toContain("scribeStageIndex > 0 ? SCRIBE_STAGES[scribeStageIndex - 1] : undefined");
    // Registration keeps its one primary Next.
    expect(STAGE_NAV).toContain("Next: {next.label}");
  });

  test("every step after the first has exactly one Back to the named previous step", () => {
    for (let i = 1; i < CHART_STEPS.length; i += 1) {
      expect(chartStepRank(CHART_STEPS[i].id)).toBe(i);
      expect(CHART_STEPS[i - 1]).toBeDefined();
    }
    // The Back handler only moves the step: no reset, submit or delete.
    expect(INDEX).toContain("onClick: () => goToChartStage(scribeBack.id)");
    expect(INDEX).toContain("if (roleBack.stage) goToChartStage(roleBack.stage);");
    expect(INDEX).not.toContain("onClick: () => setActiveStage(scribeBack.id)");
  });
});

describe("a student with saved progress resumes where they left off", () => {
  test("the furthest step reached is what reopens", () => {
    expect(resumeChartStep("hpi")).toBe("hpi");
    expect(resumeChartStep("sign-lock")).toBe("sign-lock");
    expect(furthestChartStep("hpi", "registration")).toBe("hpi");
    expect(furthestChartStep("registration", "assessment-plan")).toBe("assessment-plan");
    expect(furthestChartStep(null, "intake-vitals")).toBe("intake-vitals");
    // An id this build no longer knows opens at the opening step, not blank.
    expect(resumeChartStep("a-step-from-an-older-build")).toBe(CHART_OPENING_STEP);
  });

  test("the saved session and the encounter's own memory both resume forward only", () => {
    expect(INDEX).toContain("furthestChartStep(saved.activeStage, getEncounter(patientId)?.chartStage ?? \"\")");
    expect(INDEX).toContain("resumeChartStep(");
    // Every step change goes through the one handler that remembers it.
    expect(INDEX).toContain("const goToChartStage = (stage: string) => {");
    expect(INDEX).toContain("rememberChartStage(stage);");
  });

  test("the remembered step never rewinds when the student goes Back", () => {
    const remember = functionBody(STORE, "rememberChartStage");
    expect(remember).toContain("furthestChartStep(enc.chartStage, stage)");
    expect(remember).not.toContain("setSoapNote");
    expect(remember).not.toContain("cptCodes");
    expect(remember).not.toContain("icdCodes");
    expect(remember).not.toContain("ledger");
  });

  test("opening a chart writes no note, code, claim or ledger entry", () => {
    const goTo = INDEX.slice(
      INDEX.indexOf("const goToChartStage"),
      INDEX.indexOf("};", INDEX.indexOf("const goToChartStage")),
    );
    expect(goTo).toContain("setActiveStage(stage);");
    expect(goTo).toContain("rememberChartStage(stage);");
    // Navigation only: nothing is filled, submitted or posted by moving a step.
    for (const forbidden of [
      "setSoapNote(",
      "setEditableVitals(",
      "submitToCoding(",
      "submitToBilling(",
      "submitClaim(",
      "postRemittance(",
      "resetEncounter(",
    ]) {
      expect(goTo).not.toContain(forbidden);
    }
  });

  test("an encounter saved before the step was remembered keeps null, and nothing is invented", () => {
    const old = normalizeEncounter({ patientId: "p1", stage: "scribe" }, "p1");
    expect(old.chartStage).toBeNull();
    expect(old.icdCodes).toEqual([]);
    expect(old.cptCodes).toEqual([]);
    expect(old.ledger).toEqual([]);
    expect(old.remittances).toEqual([]);
    // A saved step is carried forward verbatim.
    const worked = normalizeEncounter({ patientId: "p1", chartStage: "hpi" }, "p1");
    expect(worked.chartStage).toBe("hpi");
    // A brand-new encounter has no remembered step either.
    expect(createEncounter("p2").chartStage).toBeNull();
  });
});

describe("both tracks open at their charting step", () => {
  test("the medical chart's steps are unchanged, so no saved work is stranded", () => {
    expect(CHART_STEPS.map((step) => step.id)).toEqual([
      "registration",
      "intake-vitals",
      "hpi",
      "exam-ros",
      "assessment-plan",
      "sign-lock",
    ]);
  });

  test("the dental track opens at its charting step and has no Registration stage", () => {
    // Dental's first encounter stage after the briefing is planning — the
    // charting step (stageModel maps `planning` → Chart). There is no dental
    // Registration screen, so nothing there starts at one.
    expect(DENTAL_STORE).toContain('stage: "planning"');
    expect(DENTAL_STORE).not.toContain('"registration"');
    expect(DENTAL_STORE).toContain('"case-select",\n  "briefing",\n  "planning"');
  });
});
