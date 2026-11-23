/**
 * Payments (835) and Denials & AR say "not yet" until the student has sent the
 * claim — and show the real money once it exists.
 *
 * Owner's ruling, 2026-11-23: the reference chart opens filled and **nothing is
 * submitted for the student** — *"in billing section it should not be submitted,
 * the CMS-1500 should be filled and student should submit too … himself"*. So
 * before that Submit there is no 277CA, no 835, no posting and no AR row on the
 * record (`domain/tutorialClaim.ts`). The two money stages used to answer with a
 * money-shaped empty screen; they now name the step that produces the money
 * (`components/status/MoneyNotYet.tsx`) and draw the real 835 / AR row the
 * moment the record holds one.
 *
 * Inspiration: Epic's demo worklist, which names the action that fills it rather
 * than printing a zero balance.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

const win = new Window({ url: "http://localhost/encounter/DEMO/payments" });
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

const PHONE = "+920000000041";
win.localStorage.setItem("hh_logged_in_phone", PHONE);
win.localStorage.setItem("hh_approved_phones", JSON.stringify([PHONE]));

const React = (await import("react")).default;
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { RouterProvider, createRouter, createMemoryHistory } = await import("@tanstack/react-router");
const { routeTree } = await import("../src/routeTree.gen");
const { useEhrStore } = await import("../src/store/ehrStore");
const { PipelineProvider, usePipeline } = await import("../src/store/pipelineStore");
const {
  pressSubmitOnReferenceClaim,
  pressAdjudicateOnReferenceClaim,
} = await import("./support/referenceSubmit");
const { SEED_PATIENTS } = await import("../src/store/patientStore");

/** Mount the app at one encounter address, the way a pasted link opens it. */
async function openStage(stageId: string) {
  const router = createRouter({
    routeTree: routeTree as never,
    history: createMemoryHistory({ initialEntries: [`/encounter/DEMO/${stageId}`] }),
  });
  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  const root = createRoot(container as unknown as HTMLElement);
  await act(async () => {
    root.render(React.createElement(RouterProvider as never, { router } as never));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 700));
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

/** Run one store action against the saved record, the way a stage's button does. */
async function withPipeline(run: (store: ReturnType<typeof usePipeline>) => void) {
  let pipeline: ReturnType<typeof usePipeline> | null = null;
  function Probe() {
    pipeline = usePipeline();
    return null;
  }
  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  const root = createRoot(container as unknown as HTMLElement);
  await act(async () => {
    root.render(React.createElement(PipelineProvider, null, React.createElement(Probe)));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  await act(async () => {
    run(pipeline!);
  });
  // Let the store save before this provider goes away.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 600));
  });
  await act(async () => root.unmount());
  container.remove();
}

beforeEach(() => {
  win.localStorage.clear();
  win.localStorage.setItem("hh_logged_in_phone", PHONE);
  win.localStorage.setItem("hh_approved_phones", JSON.stringify([PHONE]));
  useEhrStore.getState().registerSeedPatients(SEED_PATIENTS);
});

describe("the money stages before the student has sent the claim", () => {
  test("Payments (835) names Submit instead of drawing an empty 835", async () => {
    const screen = await openStage("payments");
    const text = screen.text();

    expect(text).toContain("Not yet — press Submit on Billing first");
    // No remittance, no money columns and no denied line exist yet.
    expect(text).not.toContain("835 remittance");
    expect(text).not.toContain("CO-236");
    expect(text).not.toContain("$225.00");
    await screen.unmount();
  }, 40000);

  test("Denials & AR names Submit instead of an empty queue, and keeps its filters", async () => {
    const screen = await openStage("denials-ar");
    const text = screen.text();

    expect(text).toContain("Not yet — press Submit on Billing first");
    expect(text).not.toContain("Appeal by");
    expect(text).not.toContain("CO-236");
    // The filters stay live — the student can still work the desk's controls.
    for (const label of ["Open", "Denied lines", "Patient balances", "Cleared"]) {
      expect({ label, shown: text.includes(label) }).toEqual({ label, shown: true });
    }
    await screen.unmount();
  }, 40000);

  test("after Submit the stages name the next step, and after posting show the real money", async () => {
    // Open the chart once, so the reference encounter is seeded and saved.
    const seed = await openStage("payments");
    await seed.unmount();

    // Step 1 — the student's own Submit: 277CA, and nothing priced.
    await withPipeline((store) => pressSubmitOnReferenceClaim(store));

    const afterSubmit = await openStage("payments");
    expect(afterSubmit.text()).not.toContain("Not yet — press Submit on Billing first");
    expect(afterSubmit.text()).toContain("Adjudicate this claim");
    await afterSubmit.unmount();

    const arAfterSubmit = await openStage("denials-ar");
    expect(arAfterSubmit.text()).toContain(
      "Not yet — adjudicate on Payments (835), then post the 835",
    );
    await arAfterSubmit.unmount();

    // Step 2 — adjudicate and post: the real 835 and the real AR row appear.
    await withPipeline((store) => pressAdjudicateOnReferenceClaim(store));

    const payments = await openStage("payments");
    expect(payments.text()).toContain("835 remittance");
    expect(payments.text()).not.toContain("Not yet");
    await payments.unmount();

    const ar = await openStage("denials-ar");
    expect(ar.text()).toContain("CO-236");
    expect(ar.text()).not.toContain("Not yet");
    await ar.unmount();
  }, 60000);
});
