/**
 * The standard chart's Progress Note says nothing when its autosave fires.
 *
 * Owner report, 2026-11-23 — the reference chart showed *"The note was not
 * saved."* on its own. The autosave timer, a blur or the panel closing tried to
 * write a chart that refuses student writes, and the store answered with the
 * refusal sentence. Nothing was typed and nothing was lost, so nothing should
 * be said.
 *
 * Mounted at `/encounter/DEMO/progress-note` — the address a student reaches
 * from the stepper — so the assertion is about the screen, not a helper.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

const win = new Window({ url: "http://localhost/encounter/DEMO/progress-note" });
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

const PHONE = "+920000000022";

const React = (await import("react")).default;
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { RouterProvider, createRouter, createMemoryHistory } = await import("@tanstack/react-router");
const { routeTree } = await import("../src/routeTree.gen");
const { clearTutorialRefusal } = await import("../src/domain/tutorialReadOnly");
const { useEhrStore } = await import("../src/store/ehrStore");
const { SEED_PATIENTS } = await import("../src/store/patientStore");

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
    await new Promise((resolve) => setTimeout(resolve, 800));
  });
  return {
    container,
    text: () => (container.textContent ?? "").replace(/\s+/g, " "),
    async unmount() {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

beforeEach(() => {
  // The refusal line is module state: a refusal left by another test file in
  // the same process must not read as this test's autosave being refused.
  clearTutorialRefusal();
  win.localStorage.clear();
  win.localStorage.setItem("hh_logged_in_phone", PHONE);
  win.localStorage.setItem("hh_approved_phones", JSON.stringify([PHONE]));
  useEhrStore.getState().registerSeedPatients(SEED_PATIENTS);
});

describe("the Tutorial Patient's Progress Note", () => {
  test("the autosave fires and nothing is said about it", async () => {
    const screen = await openStage("DEMO", "progress-note");
    expect(screen.text()).toContain("Standard reference chart — read-only");

    // A blur is how the autosave fires while a student reads the stage.
    await act(async () => {
      win.document.dispatchEvent(new win.Event("focusout", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    expect(screen.container.querySelector('[data-testid="tutorial-refusal"]')).toBeNull();
    expect(screen.text()).not.toContain("was not saved");
    expect(screen.text()).toContain("Standard reference chart — read-only");

    await screen.unmount();
  }, 40000);
});
