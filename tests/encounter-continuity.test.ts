/**
 * The encounter's steps stay one sequence, and every patient opens on step 1.
 *
 * Spec `specs/encounter-continuity.md`. Owner, 2026-11-20: "whenever I should
 * open a patient, scribing should follow the sequence it was earlier and take us
 * step by step to last step — now all steps are dissociated." This supersedes
 * `start-at-scribing.md`, which opened a chart mid-visit.
 *
 *   1. One pure module owns the step order, and the record re-exports it.
 *   2. Step 1 is Registration, and every patient — Tutorial, medical, dental,
 *      practice case — opens on the first step of its own spine.
 *   3. The chart draws the shared step bar at the top of the workspace, numbered,
 *      with the steps the record says are finished ticked.
 *   4. Next / Back walk one step at a time; no step id is renumbered, so no saved
 *      work is stranded.
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
} from "../src/store/pipelineEncounter";
import {
  ENCOUNTER_OPENING_STEP,
  ENCOUNTER_STEPS,
  completedEncounterSteps,
  encounterStepNumber,
  encounterStepRows,
  lastEncounterStepId,
  nextEncounterStep,
  previousEncounterStep,
} from "../src/domain/encounterSteps";
import {
  ENCOUNTER_FLOW_STAGES,
  flowStageNumber,
  lastFlowStageId,
} from "../src/domain/encounterFlow";

const root = join(import.meta.dir, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const INDEX = read("src/routes/index.tsx");
const STORE = read("src/store/pipelineStore.tsx");
const STAGE_NAV = read("src/components/shell/StageNav.tsx");
const STEPPER = read("src/components/shell/EncounterStepper.tsx");
const STEPS_MODULE = read("src/domain/encounterSteps.ts");
const DENTAL_STORE = read("src/components/dental/DentalTrackStore.tsx");
const MEDICAL_CASE_STORE = read("src/components/medical/MedicalCaseStore.tsx");

/** The body of one function, from its declaration to its closing brace. */
function functionBody(source: string, name: string): string {
  const start = source.indexOf(`const ${name} = `);
  expect(start).toBeGreaterThan(-1);
  const rest = source.slice(start);
  const end = rest.indexOf("\n  };");
  return rest.slice(0, end === -1 ? undefined : end);
}

describe("one pure module owns the step order", () => {
  test("the order lives in domain/encounterSteps.ts and is pure", () => {
    expect(STEPS_MODULE).toContain("export const ENCOUNTER_STEPS");
    expect(STEPS_MODULE).not.toContain("useState");
    expect(STEPS_MODULE).not.toContain("localStorage");
    expect(STEPS_MODULE).not.toContain("sessionStorage");
    expect(STEPS_MODULE).not.toContain("from \"react\"");
  });

  test("the encounter record re-exports that same list, not a copy", () => {
    const RECORD = read("src/store/pipelineEncounter.ts");
    expect(RECORD).toContain("export const CHART_STEPS: readonly { id: string; label: string }[] = ENCOUNTER_STEPS;");
    expect(CHART_STEPS).toBe(ENCOUNTER_STEPS);
  });

  test("no second step list is left anywhere in the chart", () => {
    expect(INDEX).toContain("const SCRIBE_STAGES = CHART_STEPS;");
    expect(INDEX.match(/const SCRIBE_STAGES/g)?.length).toBe(1);
  });
});

describe("step 1 is Registration, and every patient opens there", () => {
  test("the opening step is Registration", () => {
    expect(ENCOUNTER_OPENING_STEP).toBe("registration");
    expect(CHART_OPENING_STEP).toBe("registration");
    expect(CHART_STEPS[0]).toEqual({ id: "registration", label: "Registration" });
    expect(encounterStepNumber("registration")).toBe(1);
  });

  test("the chart's default step is the opening step", () => {
    expect(INDEX).toContain("useState(CHART_OPENING_STEP);");
    expect(INDEX).not.toContain('useState("registration");');
  });

  test("the Tutorial Patient opens on step 1, not mid-visit", () => {
    expect(INDEX).toContain("patientId === TUTORIAL_PATIENT_ID &&");
    expect(INDEX).toContain("tutorialSeedPending(getEncounter(patientId))");
    expect(INDEX).toContain("setActiveStage(CHART_OPENING_STEP);");
    expect(INDEX).not.toContain('setActiveStage("sign-lock");');
    expect(INDEX).not.toContain('setActiveStage("hpi");');
  });

  test("a worked patient also opens on step 1 — the chart no longer resumes mid-visit", () => {
    // `resumeChartStep` is gone from the build, and from every caller.
    expect(INDEX).not.toContain("resumeChartStep");
    expect(read("src/store/pipelineEncounter.ts")).not.toContain("export function resumeChartStep");
    // Both branches of loadPatientSession open the visit at step 1.
    expect(INDEX.match(/setActiveStage\(CHART_OPENING_STEP\);/g)?.length).toBeGreaterThanOrEqual(2);
  });

  test("a practice case opens at the first step of its own spine", () => {
    // Selecting a case resets the case to its first stage and forgets any
    // further stage, so a reopened case starts from the beginning.
    expect(MEDICAL_CASE_STORE).toContain('const openingStage: MedicalCaseStageName = found ? "briefing" : "case-select";');
    expect(MEDICAL_CASE_STORE).toContain("furthestStage: openingStage");
    expect(DENTAL_STORE).toContain('const openingStage: DentalStageName = found ? "briefing" : "case-select";');
    // Dental has no Registration screen; its first encounter step is planning,
    // and that is what beginning a dental case sets.
    expect(DENTAL_STORE).toContain('stage: "planning"');
  });
});

describe("the chart draws the shared step bar at the top of the workspace", () => {
  test("it is the one EncounterStepper, numbered, with the record's ticks", () => {
    // The top of the workspace carries the encounter's own seven stages, in the
    // owner's real order, numbered (owner's audit, 2026-11-20, item 1).
    const flowBar = INDEX.slice(
      INDEX.indexOf("<EncounterStepper"),
      INDEX.indexOf("<EncounterStepper", INDEX.indexOf("<EncounterStepper") + 1),
    );
    expect(flowBar).toContain(
      "steps={ENCOUNTER_FLOW_STAGES.map((stage) => ({ id: stage.id, label: stage.label }))}",
    );
    expect(flowBar).toContain("currentId={flowStageId}");
    expect(flowBar).toContain("completedIds={completedFlow}");
    expect(flowBar).toContain("furthestId={lastFlowStageId()}");
    expect(flowBar).toContain("onSelect={openFlowStage}");
    expect(flowBar).toContain("numbered");
    expect(flowBar).toContain('label="Encounter stages"');

    // Seven stages, numbered 1..7 in the order the money cycle runs.
    expect(ENCOUNTER_FLOW_STAGES.map((stage) => stage.id)).toEqual([
      "progress-note",
      "sign-lock",
      "coding",
      "prior-auth",
      "billing",
      "payments",
      "denials-ar",
    ]);
    ENCOUNTER_FLOW_STAGES.forEach((stage, i) => {
      expect(flowStageNumber(stage.id)).toBe(i + 1);
    });
    expect(lastFlowStageId()).toBe("denials-ar");

    // The note's own sections are the same component but unnumbered: they are
    // the documentation steps inside the Progress Note stage, not stages of the
    // encounter, so they never print a second set of stage numbers.
    const noteBarStart = INDEX.indexOf("<EncounterStepper", INDEX.indexOf("<EncounterStepper") + 1);
    const noteBar = INDEX.slice(noteBarStart, INDEX.indexOf("/>", noteBarStart));
    expect(noteBar).toContain(
      "steps={NOTE_SECTIONS.map((stage) => ({ id: stage.id, label: stage.label }))}",
    );
    expect(noteBar).toContain("completedIds={completedChartSteps}");
    expect(noteBar).toContain("furthestId={lastEncounterStepId()}");
    expect(noteBar).toContain("onSelect={goToChartStage}");
    expect(noteBar).toContain('label="Progress note sections"');
    expect(noteBar).not.toContain("numbered");
  });

  test("the bar is drawn above the step bodies, not after them", () => {
    const bar = INDEX.indexOf("<EncounterStepper");
    const firstBody = INDEX.indexOf('activeStage === "registration" && (');
    expect(bar).toBeGreaterThan(-1);
    expect(firstBody).toBeGreaterThan(bar);
  });

  test("the ticks come from the record, mapped through the one step list", () => {
    expect(INDEX).toContain("const completedChartSteps = completedEncounterSteps({");
    for (const flag of ["registration:", '"intake-vitals":', "hpi:", '"exam-ros":', '"assessment-plan":', '"sign-lock":']) {
      expect(INDEX).toContain(flag);
    }
    expect(INDEX).not.toContain("completedStagesDerived");
  });

  test("a tick means the record says the step is done, not that it is behind you", () => {
    expect(STEPPER).toContain("const done = !current && (completed ? completed.has(step.id) : i < furthestIdx);");
    expect(STEPPER).toContain("completedIds?: readonly string[];");
    expect(STEPPER).toContain("numbered?: boolean;");
  });

  test("every step keeps a visible label, keyboard focus and a 40 px hit area", () => {
    expect(STEPPER).toContain("min-h-10");
    expect(STEPPER).toContain("focus-visible:ring-2");
    expect(STEPPER).toContain("aria-label={`${stepName} — ${stateLabel}`}");
    expect(STEPPER).toContain("aria-current={current ? \"step\" : undefined}");
  });
});

describe("the steps walk one at a time, first to last", () => {
  test("the order is the visit's order, numbered 1..6", () => {
    expect(ENCOUNTER_STEPS.map((step) => step.id)).toEqual([
      "registration",
      "intake-vitals",
      "hpi",
      "exam-ros",
      "assessment-plan",
      "sign-lock",
    ]);
    ENCOUNTER_STEPS.forEach((step, i) => {
      expect(encounterStepNumber(step.id)).toBe(i + 1);
      expect(chartStepRank(step.id)).toBe(i);
    });
    expect(lastEncounterStepId()).toBe("sign-lock");
  });

  test("Next and Back move exactly one step", () => {
    expect(nextEncounterStep("registration")?.id).toBe("intake-vitals");
    expect(nextEncounterStep("hpi")?.id).toBe("exam-ros");
    expect(nextEncounterStep("sign-lock")).toBeUndefined();
    expect(previousEncounterStep("registration")).toBeUndefined();
    expect(previousEncounterStep("intake-vitals")?.id).toBe("registration");
    expect(previousEncounterStep("sign-lock")?.id).toBe("assessment-plan");
    expect(nextEncounterStep("a-step-from-an-older-build")).toBeUndefined();
  });

  test("the chart's own Back / Next read the same list", () => {
    expect(INDEX).toContain("const scribeBack = scribeStageIndex > 0 ? SCRIBE_STAGES[scribeStageIndex - 1] : undefined;");
    expect(INDEX).toContain("const scribeNext =");
    expect(INDEX).toContain("onClick: () => goToChartStage(scribeNext.id)");
    expect(STAGE_NAV).toContain("Back to {back.label}");
    // The forward control names the stage it opens: "Continue to <stage>"
    // (owner's audit, item 1), not a bare "Next".
    expect(STAGE_NAV).toContain("Continue to ${next.label}");
    // The last note section hands over to the encounter's own next stage, so the
    // note bar and the seven-stage stepper read the one flow list.
    expect(INDEX).toContain('{ label: "Coding", onClick: () => openFlowStage("coding") }');
    // Exactly one Back and one Continue: no nested or duplicate control.
    expect(STAGE_NAV.match(/Back to \{back\.label\}/g)?.length).toBe(1);
    expect(STAGE_NAV.match(/Continue to \$\{next\.label\}/g)?.length).toBe(1);
  });
});

describe("completed steps are ticked from the record", () => {
  test("the flags map onto the step ids in order", () => {
    expect(completedEncounterSteps({})).toEqual([]);
    expect(completedEncounterSteps({ registration: true, "intake-vitals": true })).toEqual([
      "registration",
      "intake-vitals",
    ]);
    // Out of order and unknown keys never reorder or invent a step.
    expect(completedEncounterSteps({ "sign-lock": true, registration: true, bogus: true })).toEqual([
      "registration",
      "sign-lock",
    ]);
    expect(completedEncounterSteps({ registration: false })).toEqual([]);
  });

  test("the step on screen is current, never done", () => {
    const rows = encounterStepRows(["registration", "intake-vitals"], "intake-vitals");
    expect(rows[0]).toMatchObject({ id: "registration", number: 1, state: "done" });
    expect(rows[1]).toMatchObject({ id: "intake-vitals", number: 2, state: "current" });
    expect(rows[2]).toMatchObject({ id: "hpi", number: 3, state: "open" });
    expect(rows.length).toBe(6);
  });
});

describe("no saved work is stranded", () => {
  test("the remembered step is still carried forward verbatim, and nothing is invented", () => {
    const old = normalizeEncounter({ patientId: "p1", stage: "scribe" }, "p1");
    expect(old.chartStage).toBeNull();
    expect(old.icdCodes).toEqual([]);
    expect(old.cptCodes).toEqual([]);
    expect(old.ledger).toEqual([]);
    expect(old.remittances).toEqual([]);
    const worked = normalizeEncounter({ patientId: "p1", chartStage: "hpi" }, "p1");
    expect(worked.chartStage).toBe("hpi");
    expect(createEncounter("p2").chartStage).toBeNull();
  });

  test("the furthest step never rewinds when the student goes Back", () => {
    expect(furthestChartStep("hpi", "registration")).toBe("hpi");
    expect(furthestChartStep("registration", "assessment-plan")).toBe("assessment-plan");
    expect(furthestChartStep(null, "intake-vitals")).toBe("intake-vitals");
    const remember = functionBody(STORE, "rememberChartStage");
    expect(remember).toContain("furthestChartStep(enc.chartStage, stage)");
  });

  test("moving a step writes no note, code, claim or ledger entry", () => {
    const goTo = INDEX.slice(
      INDEX.indexOf("const goToChartStage"),
      INDEX.indexOf("};", INDEX.indexOf("const goToChartStage")),
    );
    expect(goTo).toContain("setActiveStage(stage);");
    expect(goTo).toContain("rememberChartStage(stage);");
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
});
