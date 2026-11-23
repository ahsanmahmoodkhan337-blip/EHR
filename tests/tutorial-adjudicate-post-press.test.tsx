/**
 * After Submit, the reference chart's student presses **Adjudicate this claim**
 * and then **Post this 835 to the ledger** — and the real 835, the ledger
 * posting and the AR row appear.
 *
 * Owner's ruling, 2026-11-23: the reference chart is *filled, not finished* —
 * every section opens filled and the actions stay the student's. Submit was the
 * first of those; the Payments (835) stage then promised *"press Adjudicate this
 * claim here"* and drew no control that worked, so the chart dead-ended at the
 * 277CA and Denials & AR never filled.
 *
 * Adjudication and posting are **forward** steps, not edits: they add the payer's
 * 835, the ledger entries and the AR row to a chart whose content is already
 * written, and cannot change a box, a note or a code. This test presses the two
 * real buttons on the rendered stage — not the store directly — because a
 * disabled control that looks live is exactly the bug being fixed.
 *
 * Inspiration: Epic's training environment, where the demo claim is filled and
 * the learner presses Send, then works the remittance it earns.
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

const PHONE = "+920000000042";
win.localStorage.setItem("hh_logged_in_phone", PHONE);
win.localStorage.setItem("hh_approved_phones", JSON.stringify([PHONE]));

const React = (await import("react")).default;
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { RouterProvider, createRouter, createMemoryHistory } = await import("@tanstack/react-router");
const { routeTree } = await import("../src/routeTree.gen");
const { useEhrStore } = await import("../src/store/ehrStore");
const { PipelineProvider, usePipeline } = await import("../src/store/pipelineStore");
const { pressSubmitOnReferenceClaim } = await import("./support/referenceSubmit");
const { SEED_PATIENTS } = await import("../src/store/patientStore");
const { clearTutorialRefusal } = await import("../src/domain/tutorialReadOnly");

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
    button(label: string) {
      return [...container.querySelectorAll("button")].find((el) =>
        (el.textContent ?? "").trim().startsWith(label),
      );
    },
    async press(label: string) {
      const button = [...container.querySelectorAll("button")].find((el) =>
        (el.textContent ?? "").trim().startsWith(label),
      );
      expect({ label, found: Boolean(button) }).toEqual({ label, found: true });
      await act(async () => {
        button!.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 300));
      });
    },
    /** Let the store save before this screen goes away — the next screen reads the record. */
    async settle() {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1200));
      });
    },
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
  clearTutorialRefusal();
});

describe("the reference chart's money steps are the student's own", () => {
  test("before Submit nothing is priced, and adjudicating on the record changes nothing", async () => {
    // Open the chart once, so the reference encounter is seeded and saved.
    const seed = await openStage("payments");
    expect(seed.text()).toContain("Not yet — press Submit on Billing first");
    expect(seed.button("Adjudicate this claim")).toBeUndefined();
    await seed.unmount();

    // Pressing the store action with no claim out prices nothing: the payer has
    // never seen it.
    await withPipeline((store) => store.adjudicateClaim({ payerName: "Medicare Part B" }));

    const stillDraft = await openStage("payments");
    expect(stillDraft.text()).toContain("Not yet — press Submit on Billing first");
    expect(stillDraft.text()).not.toContain("835 remittance");
    await stillDraft.unmount();
  }, 60000);

  test("Adjudicate then Post are pressable, and produce the real 835, ledger and AR row", async () => {
    const seed = await openStage("payments");
    await seed.unmount();

    // Step 1 — the student's own Submit on Billing: the 277CA, nothing priced.
    await withPipeline((store) => pressSubmitOnReferenceClaim(store));

    // Step 2 — the Payments stage offers a live Adjudicate button.
    const payments = await openStage("payments");
    const adjudicate = payments.button("Adjudicate this claim");
    expect(adjudicate).toBeDefined();
    expect({
      disabled: adjudicate!.hasAttribute("disabled"),
      ariaDisabled: adjudicate!.getAttribute("aria-disabled"),
    }).toEqual({ disabled: false, ariaDisabled: null });

    await payments.press("Adjudicate this claim");
    const afterAdjudicate = payments.text();
    // The payer's own 835 is on the screen, priced line by line.
    expect(afterAdjudicate).toContain("835 remittance");
    expect(afterAdjudicate).not.toContain("No remittance backs this claim");
    // Adjudication is not posting: the money has not reached the ledger yet.
    expect(afterAdjudicate).toContain("Post this 835 to the ledger");

    // Step 3 — Post 835 is live too, and writes the ledger and the AR row.
    const post = payments.button("Post this 835 to the ledger");
    expect(post).toBeDefined();
    expect(post!.hasAttribute("disabled")).toBe(false);
    await payments.press("Post this 835 to the ledger");
    const afterPost = payments.text();
    expect(afterPost).toContain("Posted to the patient ledger on");
    expect(afterPost).toContain("AR work queue");
    expect(afterPost).not.toContain("Not yet");
    await payments.settle();
    await payments.unmount();

    // Step 4 — Denials & AR fills from the posted 835, and it survives a reload.
    const ar = await openStage("denials-ar");
    expect(ar.text()).toContain("CO-236");
    expect(ar.text()).not.toContain("Not yet");
    await ar.unmount();

    const reloaded = await openStage("payments");
    expect(reloaded.text()).toContain("835 remittance");
    expect(reloaded.text()).toContain("Posted to the patient ledger on");
    await reloaded.unmount();
  }, 120000);
});
