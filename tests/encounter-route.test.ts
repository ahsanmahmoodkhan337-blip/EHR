/**
 * encounter-route.test.ts — one address per encounter and stage
 *
 * Owner's audit, 2026-11-20, item 2: "A real route per encounter and stage:
 * `/encounter/:encounterId/:stage`, so refresh and deep links work. Old paths
 * redirect." Item 4: "Loading `/coding` directly currently drops the patient
 * banner and shows the Dental track — it must keep both."
 *
 * What is checked here:
 *
 *   1. Every one of the seven stages has an address, and reading that address
 *      back gives the stage it names — the round trip a refresh makes.
 *   2. A pasted address opens the same screen the stepper opens, for all seven
 *      stages: the address's stage, run through the one stage model, is that
 *      stage again.
 *   3. Anything that is not a stage of this build is not an address, and the
 *      route sends the student to the stage the encounter opens on instead of
 *      to a screen that does not exist.
 *   4. The parent route draws its child, and both routes are in the route tree.
 *   5. The address write is shallow (the workspace is not unmounted) and the
 *      workspace keeps the address in step with the stage on screen, so every
 *      path that reaches a stage today still reaches it.
 *   6. A refresh on the address opens that patient's encounter, not the one the
 *      saved session remembered.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ENCOUNTER_FLOW_OPENING_STAGE,
  ENCOUNTER_FLOW_STAGES,
  currentFlowStage,
  stageOpenTarget,
} from "../src/domain/encounterFlow";
import {
  ENCOUNTER_ROUTE_PREFIX,
  encounterPath,
  openingStageId,
  parseEncounterPath,
  writeEncounterAddress,
  type AddressTarget,
} from "../src/domain/encounterRoute";

const root = join(import.meta.dir, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const INDEX = read("src/routes/index.tsx");
const PARENT = read("src/routes/encounter.$encounterId.tsx");
const STAGE_ROUTE = read("src/routes/encounter.$encounterId.$stage.tsx");
const TREE = read("src/routeTree.gen.ts");

const ENCOUNTER_ID = "MPT-2001";

describe("every stage has one address, and the address gives the stage back", () => {
  test("the seven stages build and parse their own addresses", () => {
    expect(ENCOUNTER_FLOW_STAGES).toHaveLength(7);
    for (const stage of ENCOUNTER_FLOW_STAGES) {
      const href = encounterPath(ENCOUNTER_ID, stage.id);
      expect(href).toBe(`${ENCOUNTER_ROUTE_PREFIX}/${ENCOUNTER_ID}/${stage.id}`);
      expect(parseEncounterPath(href)).toEqual({ encounterId: ENCOUNTER_ID, stage: stage.id });
    }
  });

  test("the query, the hash and a trailing slash do not change the address", () => {
    for (const href of [
      "/encounter/MPT-2001/coding?from=coding",
      "/encounter/MPT-2001/coding#codes",
      "/encounter/MPT-2001/coding/",
    ]) {
      expect(parseEncounterPath(href)).toEqual({ encounterId: ENCOUNTER_ID, stage: "coding" });
    }
  });

  test("a patient id with a space survives the trip", () => {
    const href = encounterPath("MPT 2001", "prior-auth");
    expect(href).toBe("/encounter/MPT%202001/prior-auth");
    expect(parseEncounterPath(href)).toEqual({ encounterId: "MPT 2001", stage: "prior-auth" });
  });

  test("a stage this build does not know is not an address", () => {
    for (const path of [
      "/",
      "/coding",
      "/encounter",
      "/encounter/MPT-2001",
      "/encounter/MPT-2001/refunds",
      "/encounter/MPT-2001/coding/extra",
      "/encounters/MPT-2001/coding",
      "",
    ]) {
      expect(parseEncounterPath(path)).toBeNull();
    }
  });
});

describe("a pasted link opens the screen the stepper opens", () => {
  test("every stage's address opens that stage, not a neighbour", () => {
    for (const stage of ENCOUNTER_FLOW_STAGES) {
      const address = parseEncounterPath(encounterPath(ENCOUNTER_ID, stage.id));
      expect(address).not.toBeNull();
      const target = stageOpenTarget(address!.stage);
      expect(target).toBeDefined();
      // The screen the address opens, read back through the one stage model.
      expect(
        currentFlowStage({
          role: target!.role,
          chartStage: target!.chartStage ?? "",
          billingTab: target!.billingTab,
        }),
      ).toBe(stage.id);
    }
  });

  test("the two biller stages open different screens of the same desk", () => {
    expect(stageOpenTarget("billing")?.billingTab).toBe("form");
    expect(stageOpenTarget("payments")?.billingTab).toBe("remittance");
  });

  test("an unknown stage opens nothing", () => {
    expect(stageOpenTarget("refunds")).toBeUndefined();
    expect(stageOpenTarget("")).toBeUndefined();
  });

  test("the stage a bad address falls back to is the encounter's opening stage", () => {
    expect(openingStageId()).toBe(ENCOUNTER_FLOW_OPENING_STAGE);
    expect(STAGE_ROUTE).toContain("openingStageId()");
    expect(STAGE_ROUTE).toContain("throw redirect({");
  });
});

describe("the routes exist and the parent draws its child", () => {
  test("the parent is a layout that renders its child", () => {
    expect(PARENT).toContain('createFileRoute("/encounter/$encounterId")');
    expect(PARENT).toContain("<Outlet />");
  });

  test("the stage route draws the encounter workspace with the address's patient and stage", () => {
    expect(STAGE_ROUTE).toContain('createFileRoute("/encounter/$encounterId/$stage")');
    expect(STAGE_ROUTE).toContain("Route.useParams()");
    expect(STAGE_ROUTE).toContain("encounterIdFromRoute={encounterId}");
    expect(STAGE_ROUTE).toContain("stageFromRoute={stage}");
    // The same providers Home mounts, so the banner, the stepper and the
    // Medical track are the same screen.
    expect(STAGE_ROUTE).toContain("<PatientProvider>");
    expect(STAGE_ROUTE).toContain("<PipelineProvider>");
    expect(STAGE_ROUTE).toContain("<ToastProvider>");
  });

  test("both routes are in the generated tree, the stage under its encounter", () => {
    expect(TREE).toContain("id: '/encounter/$encounterId'");
    expect(TREE).toContain("id: '/encounter/$encounterId/$stage'");
    expect(TREE).toContain("getParentRoute: () => EncounterEncounterIdRoute");
  });
});

describe("the address follows the stage without unmounting the workspace", () => {
  const fakeTarget = (pathname: string) => {
    const written: string[] = [];
    const history: { _ignoreSubscribers?: boolean } = {};
    const target: AddressTarget = {
      history,
      browserHistory: {
        state: { __TSR_index: 0 },
        replaceState(_state, _unused, url) {
          written.push(url ?? "");
          // The router's wrapper reads this flag; it must be muted here.
          expect(history._ignoreSubscribers).toBe(true);
        },
      },
      pathname,
    };
    return { target, written, history };
  };

  test("the address is written when it differs, and the router is not told", () => {
    const { target, written, history } = fakeTarget("/");
    expect(writeEncounterAddress("/encounter/MPT-2001/coding", target)).toBe(true);
    expect(written).toEqual(["/encounter/MPT-2001/coding"]);
    // Restored, so the next real navigation still re-renders the router.
    expect(history._ignoreSubscribers).toBeUndefined();
  });

  test("writing the address it already has changes nothing", () => {
    const { target, written } = fakeTarget("/encounter/MPT-2001/coding");
    expect(writeEncounterAddress("/encounter/MPT-2001/coding", target)).toBe(false);
    expect(written).toEqual([]);
  });

  test("the workspace keeps the address in step with the stage on screen", () => {
    // One effect, reading the one stage model, so the address and the stepper
    // cannot disagree.
    expect(INDEX).toContain("encounterPath(selectedPatientId, flowStageId)");
    expect(INDEX).toContain("writeEncounterAddress(href, {");
    // Every path that reaches a stage today opens it through the one target
    // function — the stepper, Back / Continue and the queue rows alike.
    expect(INDEX).toContain("const openFlowStage = (id: string) => {");
    expect(INDEX).toContain("const target = stageOpenTarget(id);");
    expect(INDEX).not.toContain("const stage = flowStage(id);");
  });
});

describe("a refresh opens the patient and stage the address names", () => {
  test("the address's patient is the patient the chart opens on", () => {
    expect(INDEX).toContain("encounterIdFromRoute && patients.some((p) => p.id === encounterIdFromRoute)");
  });

  test("the address's stage is applied once, after the patient's session has loaded", () => {
    const sessionLoad = INDEX.indexOf("loadPatientSession(selectedPatientId);");
    const applyAddressStage = INDEX.indexOf("openFlowStage(stageFromRoute);");
    expect(sessionLoad).toBeGreaterThan(-1);
    expect(applyAddressStage).toBeGreaterThan(-1);
    // The session load resets the chart to its opening step, so the address's
    // stage has to be applied after it — otherwise a refresh would land on
    // step 1 of every stage.
    expect(applyAddressStage).toBeGreaterThan(sessionLoad);
    expect(INDEX).toContain("routeStageApplied");
  });

  test("the saved session does not put another patient in front of a pasted link", () => {
    const guard = INDEX.indexOf("if (encounterIdFromRoute) return;");
    const restore = INDEX.indexOf("const ctx = useEhrStore.getState().user.context;");
    expect(guard).toBeGreaterThan(-1);
    expect(restore).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(restore);
  });
});
