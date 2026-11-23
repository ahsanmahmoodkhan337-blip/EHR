/**
 * The Tutorial Patient's money stages open prefilled and read-only.
 *
 * Owner report, 2026-11-23: Coding showed its codes, but Payments (835) showed no
 * remittance at all — no Allowed, Paid, Adjustment or Check — behind an "Open the
 * 835 and the ledger" button, and Billing badged "Partially paid" beside copy
 * saying nothing had been paid.
 *
 * The money was already on the record (`domain/tutorialClaim.ts`): the screen was
 * showing the claim-transmitted panel on the posting stage, which hid the 835, and
 * the button that was supposed to reveal it switched a tab the claim stage filters
 * out. These tests mount the real app at each money stage and read what a student
 * sees, so a screen that hides the money fails here.
 *
 * Inspiration: Epic's reference patient — the worked example is shown whole.
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

const PHONE = "+920000000031";
win.localStorage.setItem("hh_logged_in_phone", PHONE);
win.localStorage.setItem("hh_approved_phones", JSON.stringify([PHONE]));

const React = (await import("react")).default;
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { RouterProvider, createRouter, createMemoryHistory } = await import("@tanstack/react-router");
const { routeTree } = await import("../src/routeTree.gen");
const { useEhrStore } = await import("../src/store/ehrStore");
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
    text: () => (container.textContent ?? "").replace(/\s+/g, " "),
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
});

describe("the Tutorial Patient's money stages", () => {
  test("Payments (835) draws the 835, its allowed/paid/adjustment money and the ledger", async () => {
    const screen = await openStage("payments");
    const text = screen.text();

    // The 835 itself: the panel, the check and the four money columns.
    expect(text).toContain("835 remittance");
    expect(text).toMatch(/EFT-CLM\d+/);
    for (const column of ["Billed", "Allowed", "Paid", "Patient", "Adjustments"]) {
      expect({ column, shown: text.includes(column) }).toEqual({ column, shown: true });
    }
    // The money the seed priced, and the posting that put it on the ledger.
    expect(text).toContain("$280.00"); // billed — the claim's own box 28 total
    expect(text).toContain("$225.00"); // allowed
    expect(text).toContain("$140.00"); // paid
    expect(text).toContain("Posted to the patient ledger");
    // The denied line's real group code + CARC, and the patient's balance.
    expect(text).toContain("CO-236");
    expect(text).toContain("$85.00");

    // The claim-transmitted panel — and its "nothing has been paid" copy — is not
    // what the posting stage shows once the payer has answered.
    expect(text).not.toContain("Nothing has been paid yet");

    await screen.unmount();
  }, 40000);

  test("Billing does not call a part-paid claim unpaid", async () => {
    const screen = await openStage("billing");
    const text = screen.text();
    expect(text).toContain("Partially paid");
    // The header badge and the sentence beside it agree: the payer answered.
    expect(text).toContain("The payer answered");
    expect(text).not.toContain("Nothing has been paid yet");
    await screen.unmount();
  }, 40000);

  test("Denials & AR carries the denied ECG line", async () => {
    const screen = await openStage("denials-ar");
    const text = screen.text();
    expect(text).toContain("CO-236");
    expect(text).toContain("93000");
    await screen.unmount();
  }, 40000);

  test("Coding labels its third diagnosis 3rd, not 3th", async () => {
    const screen = await openStage("coding");
    const text = screen.text();
    expect(text).toContain("R07.9");
    expect(text).not.toContain("3th");
    await screen.unmount();
  }, 40000);
});
