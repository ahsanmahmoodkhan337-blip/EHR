/**
 * The reference chart is readable: print, download, tabs, calculator, filters.
 *
 * Spec `tutorial-dead-buttons.md` §2. The standard chart used to lock its whole
 * workspace with one `<fieldset disabled>`, which also killed the controls a
 * student needs in order to *read* the worked example: the claim's Print and
 * Download PDF, the Billing tabs, the reimbursement calculator, "Open the 835 and
 * the ledger", "Back to Billing", the Prior Auth tab strip and the AR queue's
 * filters. The lock is now per control, at the write (`ClaimFormShell.set`,
 * `handleSignAndLock`, the demo-fill switch), so:
 *
 *   1. **What reads stays live** — Print, Download PDF, the tabs, the calculator,
 *      the filters and the navigation between the money stages are pressable.
 *   2. **What writes is still refused** — the demo-fill switch and the paper's
 *      box editors are disabled and carry the one sentence.
 *
 * Inspiration: Epic's training environment — the reference patient can be opened,
 * printed and paged through; it just cannot be changed.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

// ── A DOM, before React DOM is imported ────────────────────────────
const win = new Window({ url: "http://localhost/encounter/DEMO/billing" });
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
const { READ_ONLY_REASON, clearTutorialRefusal } = await import("../src/domain/tutorialReadOnly");
const { READ_ONLY_REASON_ID } = await import("../src/components/shell/ReadOnlyStage");
const {
  pressSubmitOnReferenceClaim,
  pressAdjudicateOnReferenceClaim,
} = await import("./support/referenceSubmit");

/** A control a browser would let a student press, on this markup. */
function isBlocked(el: Element): boolean {
  if (el.matches(":disabled")) return true;
  if (el.closest("fieldset[disabled]")) return true;
  if (el.getAttribute("aria-disabled") === "true") return true;
  if (el.getAttribute("aria-readonly") === "true") return true;
  return false;
}

/** Every button whose visible text starts with one of these labels. */
function buttonsStartingWith(root: ParentNode, labels: string[]): Element[] {
  return [...root.querySelectorAll("button")].filter((el) =>
    labels.some((label) => (el.textContent ?? "").trim().startsWith(label)),
  );
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

/** The student's own Submit and Adjudicate, so the money stages hold their money. */
async function sendAndAdjudicate() {
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
    pipeline?.selectPatient("DEMO");
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 600));
  });
  await act(async () => {
    pressSubmitOnReferenceClaim(pipeline!);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 600));
  });
  await act(async () => {
    pressAdjudicateOnReferenceClaim(pipeline!);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 600));
  });
  expect(pipeline?.getEncounter("DEMO")?.remittances).toHaveLength(1);
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

describe("the reference chart stays readable", () => {
  test("the claim's Print, Download PDF, tabs and calculator are live, and its writes are not", async () => {
    const screen = await openStage("DEMO", "billing");

    const live = buttonsStartingWith(screen.container, [
      "Print",
      "Download PDF",
      "Validate",
      "Claim Form",
      "Denial Codes",
      "References",
      "Calculator",
    ]);
    expect(live.length).toBeGreaterThanOrEqual(7);
    expect(live.filter((el) => isBlocked(el)).map((el) => (el.textContent ?? "").trim())).toEqual([]);

    // The paper's own write controls are still refused, each with the sentence.
    const demoFill = [...screen.container.querySelectorAll("input[type=checkbox]")].find((el) =>
      /Demo-fill missing boxes/.test(el.closest("label")?.textContent ?? ""),
    );
    expect(demoFill).not.toBeUndefined();
    expect(isBlocked(demoFill!)).toBe(true);
    expect(demoFill!.getAttribute("title")).toBe(READ_ONLY_REASON);
    expect((demoFill!.getAttribute("aria-describedby") ?? "").startsWith(READ_ONLY_REASON_ID)).toBe(true);

    // Save is a write and refuses; Submit is the one press the chart leaves open.
    const save = buttonsStartingWith(screen.container, ["Save"])[0];
    const submit = buttonsStartingWith(screen.container, ["Submit"])[0];
    expect(isBlocked(save)).toBe(true);
    expect(isBlocked(submit)).toBe(false);

    await screen.unmount();
  }, 60000);

  test("the Prior Auth tab strip is live while the e-PA panels keep the lock", async () => {
    const screen = await openStage("DEMO", "prior-auth");

    const tabs = [...screen.container.querySelectorAll("button")].filter((el) =>
      ["PA Form", "Criteria", "Documents", "Queue", "Follow"].some((label) =>
        (el.textContent ?? "").includes(label),
      ),
    );
    expect(tabs.length).toBeGreaterThan(0);
    expect(tabs.filter((el) => isBlocked(el)).map((el) => (el.textContent ?? "").trim())).toEqual([]);

    // The panels those tabs open are writes, and they say why.
    const panelFields = [...screen.container.querySelectorAll("input,select,textarea")];
    expect(panelFields.length).toBeGreaterThan(0);
    expect(panelFields.filter((el) => !isBlocked(el)).length).toBe(0);

    await screen.unmount();
  }, 60000);

  test("the 835 and the ledger open, Back to Billing works, and the AR filters are live", async () => {
    await sendAndAdjudicate();

    const payments = await openStage("DEMO", "payments");
    const back = buttonsStartingWith(payments.container, ["Back to Billing"])[0];
    expect(back).not.toBeUndefined();
    expect(isBlocked(back)).toBe(false);
    // The money write on this stage still refuses, with its sentence on screen.
    expect(payments.container.querySelector('[data-testid="read-only-reason"]')).not.toBeNull();
    await payments.unmount();

    const ar = await openStage("DEMO", "denials-ar");
    const filterGroup = ar.container.querySelector('[aria-label="Filter the work queue"]');
    expect(filterGroup).not.toBeNull();
    const filters = [...(filterGroup?.querySelectorAll("button") ?? [])];
    expect(filters.length).toBeGreaterThan(0);
    expect(filters.filter((el) => isBlocked(el)).map((el) => (el.textContent ?? "").trim())).toEqual([]);
    await ar.unmount();
  }, 90000);
});
