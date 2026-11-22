/**
 * The Tutorial Patient is seeded by the store's own open path.
 *
 * Owner report, 2026-11-22: the tutorial chart is the worked example a student
 * opens to see which datum belongs in which stage. It was seeded by one screen's
 * effect, so a chart opened any other way — `/patients`, Start Visit, a pasted
 * link — could arrive blank.
 *
 * The seed now lives in `PipelineProvider.seedTutorialOnOpen`, called at the start
 * of `selectPatient`, so opening the chart is what fills it. This test mounts the
 * real provider with no screen on top, puts the Tutorial Patient's chart in the
 * store, calls `selectPatient("DEMO")` — the store's open path — and reads the
 * record back.
 *
 * Inspiration: Epic's Playground patient — the demo chart is filled the moment it
 * is opened, whichever door the student came through.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

// ── A DOM, before React DOM is imported ────────────────────────────
const win = new Window({ url: "http://localhost/patients" });
const globals = globalThis as unknown as Record<string, unknown>;
globals.window = win;
globals.document = win.document;
globals.navigator = win.navigator;
globals.HTMLElement = win.HTMLElement;
globals.Node = win.Node;
globals.Element = win.Element;
globals.Event = win.Event;
globals.MouseEvent = win.MouseEvent;
globals.KeyboardEvent = win.KeyboardEvent;
globals.localStorage = win.localStorage;
globals.getComputedStyle = win.getComputedStyle.bind(win);
globals.requestAnimationFrame = (cb: FrameRequestCallback) =>
  setTimeout(() => cb(Date.now()), 0) as unknown as number;
globals.cancelAnimationFrame = (id: number) => clearTimeout(id);
globals.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import("react")).default;
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { PipelineProvider, usePipeline } = await import("../src/store/pipelineStore");
const { useEhrStore } = await import("../src/store/ehrStore");
const { SEED_PATIENTS } = await import("../src/store/patientStore");
const { TUTORIAL_PA_ID, TUTORIAL_SEED_VERSION } = await import(
  "../src/domain/tutorialEncounter"
);

const PHONE = "+920000000002";

/** The live pipeline context, re-read on every provider render. */
let pipeline: ReturnType<typeof usePipeline> | null = null;

function Probe() {
  pipeline = usePipeline();
  return null;
}

async function mount() {
  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  const root = createRoot(container as unknown as HTMLElement);
  await act(async () => {
    root.render(
      React.createElement(PipelineProvider, null, React.createElement(Probe)),
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  return {
    async open(patientId: string) {
      await act(async () => {
        pipeline?.selectPatient(patientId);
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
    },
    async unmount() {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

beforeEach(() => {
  win.localStorage.clear();
  win.localStorage.setItem("hh_logged_in_phone", PHONE);
  // The Tutorial Patient's chart, in the central store — nothing opened yet.
  useEhrStore.getState().registerSeedPatients(SEED_PATIENTS);
  pipeline = null;
});

describe("opening the Tutorial Patient's chart seeds it", () => {
  test("selectPatient('DEMO') writes the clinical half onto the record", async () => {
    const screen = await mount();
    // Nothing on the chart before the open.
    expect(pipeline?.getEncounter("DEMO")).toBeUndefined();

    await screen.open("DEMO");

    const enc = pipeline?.getEncounter("DEMO");
    expect(enc).toBeTruthy();
    // The codes: the visit's reason first, then the chart's own problem list.
    expect(enc?.icdCodes).toEqual(["R07.9", "I10", "I25.10"]);
    // The procedures: the office visit and its ECG.
    expect(enc?.cptCodes).toEqual(["99214", "93000"]);
    // Two charged lines, both at place of service 11 (office), with a fee.
    expect(enc?.codingLines).toHaveLength(2);
    expect(enc?.codingLines.map((line) => line.cpt)).toEqual(["99214", "93000"]);
    for (const line of enc?.codingLines ?? []) {
      expect(line.placeOfService).toBe("11");
      expect(line.charge).toBeGreaterThan(0);
    }
    // The record says it was seeded, so a second open never refills it.
    expect(enc?.tutorialSeed).toBe(TUTORIAL_SEED_VERSION);
    // The PA desk's own queue holds the decided authorisation too.
    expect(
      pipeline?.paRecords.some((record) => record.patientId === "DEMO" && record.id === TUTORIAL_PA_ID),
    ).toBe(true);

    await screen.unmount();
  });
});
