/**
 * The Front Desk stage never calls a covered patient self-pay.
 *
 * Owner rule (2026-11-23): one screen must not call a patient self-pay while its
 * card names a payer. The Tutorial Patient's chart holds Medicare Part B with
 * member ID `1EG4TE5MK72`, and its Front Desk stage opened with a "Record as
 * self-pay … (coverage is saved as Self-pay)" control sitting under a card that
 * names Medicare Part B — the panel contradicting the banner and the card on the
 * same screen.
 *
 * The stage now initialises its coverage form from the patient's own saved
 * coverage: the payer, member ID and EDI payer ID come from that patient's card,
 * and the self-pay control is only offered to a patient whose card names no
 * payer. `handleSubmit` reads the same derived flag, so a covered chart can never
 * be written back as "Self-pay" either.
 *
 * Mounted at `/encounter/DEMO/registration` — the address a student reaches from
 * `/patients` → Open encounter — so the assertion is about the screen, not a
 * helper.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

const win = new Window({ url: "http://localhost/encounter/DEMO/registration" });
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
win.localStorage.setItem("hh_logged_in_phone", PHONE);
win.localStorage.setItem("hh_approved_phones", JSON.stringify([PHONE]));

const React = (await import("react")).default;
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { RouterProvider, createRouter, createMemoryHistory } = await import("@tanstack/react-router");
const { routeTree } = await import("../src/routeTree.gen");
const { useEhrStore } = await import("../src/store/ehrStore");
const { SEED_PATIENTS } = await import("../src/store/patientStore");

/** Mount one encounter address, the way a pasted link opens it. */
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
    text: (container.textContent ?? "").replace(/\s+/g, " "),
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

describe("the Front Desk stage of a covered chart", () => {
  test("never says Self-pay, and reads the patient's own payer and member ID", async () => {
    const screen = await openStage("DEMO", "registration");

    // ── The rule ───────────────────────────────────────────────
    expect(screen.text).not.toMatch(/self.?pay/i);

    // ── The card's own facts, on the stage ─────────────────────
    // The card panel prints this patient's payer and member ID. Since phase 2
    // (owner, 2026-11-23) the transcription boxes below it open BLANK — the
    // student types what the card says before Verify — so the card, not the form,
    // is where the patient's own coverage must be readable.
    expect(screen.text).toContain("Medicare Part B");
    expect(screen.text).toContain("1EG4TE5MK72");
    const values = [...screen.container.querySelectorAll("input")].map((el) => el.value);
    expect(values).not.toContain("1EG4TE5MK72");

    // ── No self-pay control is offered for this chart ──────────
    const selfPayBoxes = [...screen.container.querySelectorAll("input[type=checkbox]")];
    expect(selfPayBoxes).toHaveLength(0);

    await screen.unmount();
  }, 30000);
});
