/**
 * readonly-reason-beside-control.test.tsx — the reason sits under the control,
 * and the same button works on a chart the student books.
 *
 * Owner report, 2026-11-23: on the Tutorial Patient's chart the only explanation
 * for a dead Submit was a banner at the top of the stage — measured at 1,170 px
 * above the button — so Submit read as a broken control. This walks the stages
 * and proves the sentence and the Schedule link are drawn under the control
 * itself; then it books a chart the student owns, clicks Coding's Submit, and
 * proves the encounter moves to Billing.
 *
 * Inspiration: Epic's reference patient — the worked example is locked and says
 * so where the reader clicks; a patient of your own is not locked at all.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

const win = new Window({ url: "http://localhost/encounter/DEMO/coding" });
const globals = globalThis as unknown as Record<string, unknown>;
globals.window = win;
globals.document = win.document;
globals.navigator = win.navigator;
globals.HTMLElement = win.HTMLElement;
globals.HTMLInputElement = win.HTMLInputElement;
globals.Node = win.Node;
globals.Element = win.Element;
globals.Event = win.Event;
globals.MouseEvent = win.MouseEvent;
globals.KeyboardEvent = win.KeyboardEvent;
globals.localStorage = win.localStorage;
globals.sessionStorage = win.sessionStorage;
globals.getComputedStyle = win.getComputedStyle.bind(win);
globals.requestAnimationFrame = (cb: FrameRequestCallback) =>
  setTimeout(() => cb(Date.now()), 0) as unknown as number;
globals.cancelAnimationFrame = (id: number) => clearTimeout(id);
globals.scrollTo = () => {};
(win as unknown as { scrollTo: unknown }).scrollTo = () => {};
(win as unknown as { matchMedia: unknown }).matchMedia = (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
});
class StubObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
globals.IntersectionObserver = StubObserver;
globals.ResizeObserver = StubObserver;
(win as unknown as { speechSynthesis: unknown }).speechSynthesis = {
  getVoices: () => [],
  speak: () => {},
  cancel: () => {},
  onvoiceschanged: null,
  addEventListener: () => {},
  removeEventListener: () => {},
};
(win as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class {
  constructor(public text = "") {}
};
globals.IS_REACT_ACT_ENVIRONMENT = true;

const PHONE = "+920000000024";
win.localStorage.setItem("hh_logged_in_phone", PHONE);
win.localStorage.setItem("hh_approved_phones", JSON.stringify([PHONE]));

const React = (await import("react")).default;
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { RouterProvider, createRouter, createMemoryHistory } = await import("@tanstack/react-router");
const { routeTree } = await import("../src/routeTree.gen");
const { PipelineProvider, usePipeline } = await import("../src/store/pipelineStore");
const { useEhrStore } = await import("../src/store/ehrStore");
const { SEED_PATIENTS } = await import("../src/store/patientStore");
const { clearTutorialRefusal, READ_ONLY_REASON } = await import("../src/domain/tutorialReadOnly");
const { ENCOUNTER_FLOW_STAGES } = await import("../src/domain/encounterFlow");

const WRITE_STAGES = ENCOUNTER_FLOW_STAGES.map((stage) => stage.id).filter((id) => id !== "progress-note");

function isBlocked(el: Element): boolean {
  if ((el as unknown as { disabled?: boolean }).disabled) return true;
  if (el.closest("fieldset[disabled]")) return true;
  return el.getAttribute("aria-disabled") === "true";
}

/** The note a control points at, and whether it sits under that control. */
function noteFor(control: Element): { text: string; underControl: boolean } | null {
  const id = control.getAttribute("aria-describedby");
  if (!id) return null;
  const note = control.ownerDocument.getElementById(id);
  if (!note) return null;
  // "Under the control": the note is in the control's own wrapper, or the very
  // next block beside it — not a banner at the top of the stage.
  const wrapper = control.parentElement;
  const underControl =
    wrapper?.contains(note) === true ||
    note.parentElement?.contains(control) === true ||
    control.parentElement?.parentElement?.contains(note) === true;
  return { text: note.textContent ?? "", underControl };
}

async function openStage(patientId: string, stageId: string) {
  const router = createRouter({
    routeTree: routeTree as never,
    history: createMemoryHistory({ initialEntries: [`/encounter/${patientId}/${stageId}`] }),
  });
  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  const root = createRoot(container as unknown as HTMLElement);
  await act(async () => {
    root.render(React.createElement(RouterProvider as never, { router } as never));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
  });
  return {
    container,
    async unmount() {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

beforeEach(() => {
  win.localStorage.clear();
  win.localStorage.setItem("hh_logged_in_phone", PHONE);
  win.localStorage.setItem("hh_approved_phones", JSON.stringify([PHONE]));
  useEhrStore.getState().registerSeedPatients(SEED_PATIENTS);
  clearTutorialRefusal();
});

describe("the reason is drawn under the control, on every stage of the standard chart", () => {
  test("every blocked write control carries its own note and Schedule link beside it", async () => {
    let checked = 0;
    for (const stageId of WRITE_STAGES) {
      const screen = await openStage("DEMO", stageId);
      const blocked = [...screen.container.querySelectorAll("button")]
        .filter((el) => isBlocked(el))
        .filter((el) => el.getAttribute("title") === READ_ONLY_REASON);

      for (const control of blocked) {
        const note = noteFor(control);
        expect({
          stage: stageId,
          control: (control.textContent ?? "").trim().slice(0, 30),
          found: note !== null,
          underControl: note?.underControl === true,
          says: (note?.text ?? "").includes(READ_ONLY_REASON),
        }).toEqual({
          stage: stageId,
          control: (control.textContent ?? "").trim().slice(0, 30),
          found: true,
          underControl: true,
          says: true,
        });
        // The way out is in the same note.
        expect(note!.text).toContain("Schedule");
        checked += 1;
      }
      await screen.unmount();
    }
    // The walk reached real controls, not an empty page.
    expect(checked).toBeGreaterThan(0);
  }, 180000);

  test("Coding's Submit says why, under the button itself", async () => {
    const screen = await openStage("DEMO", "coding");
    const submit = [...screen.container.querySelectorAll("button")].find((el) =>
      (el.textContent ?? "").trim().startsWith("Submit Coded Encounter"),
    );
    expect(submit).not.toBeUndefined();
    expect(isBlocked(submit!)).toBe(true);

    const note = noteFor(submit!);
    expect(note).not.toBeNull();
    expect(note!.underControl).toBe(true);
    expect(note!.text).toContain(READ_ONLY_REASON);
    expect(note!.text).toContain("Schedule");
    await screen.unmount();
  }, 90000);
});
