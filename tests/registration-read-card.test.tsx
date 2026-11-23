/**
 * Phase 2 — the Registration card must be READ before the student transcribes.
 *
 * Three behaviours, one screen:
 *  1. a student's chart opens with the identity and insurance boxes LOCKED,
 *     and no score anywhere on the page;
 *  2. pressing "Read the card" unlocks them, and the "n of 8 fields transcribed
 *     correctly" line appears only after the student's own Verify — never
 *     before, because a live count is the answer key;
 *  3. the Tutorial Patient's registration is untouched: no gate, its own
 *     prefilled values, still read-only.
 *
 * The lock is asserted on the DOM, not on a class name: a box inside a disabled
 * `<fieldset>` is disabled for real, which is what a keystroke would meet.
 */
import { describe, expect, test, beforeEach } from "bun:test";

const { Window } = await import("happy-dom");
const win = new Window({ url: "https://app.test/" }) as unknown as Window & typeof globalThis;
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

const PHONE = "+920000000023";
win.localStorage.setItem("hh_logged_in_phone", PHONE);
win.localStorage.setItem("hh_approved_phones", JSON.stringify([PHONE]));

const React = (await import("react")).default;
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { RouterProvider, createRouter, createMemoryHistory } = await import("@tanstack/react-router");
const { routeTree } = await import("../src/routeTree.gen");
const { useEhrStore } = await import("../src/store/ehrStore");
const { SEED_PATIENTS } = await import("../src/store/patientStore");
const { scoreTranscription } = await import("../src/domain/registrationTranscription");

// ─── A student's own chart, with a card on file ───────────────────

const STUDENT_PATIENT = {
  id: "PAT-READCARD",
  mrn: "HH-900101",
  firstName: "Ayesha",
  lastName: "Siddiqui",
  dateOfBirth: "1988-07-04",
  age: 38,
  gender: "Female",
  phone: "03000000041",
  email: "",
  address: "",
  emergencyContact: { name: "", phone: "", relation: "" },
  primaryCareProvider: "",
  insurance: "Meridian Advantage HMO",
  chiefComplaint: "",
  vitals: {
    bloodPressure: "",
    heartRate: 0,
    temperature: 0,
    respiratoryRate: 0,
    oxygenSaturation: 0,
    recordedAt: "2026-11-23T09:00:00.000Z",
  },
  medications: [],
  allergies: [],
  labResults: [],
  encounters: [],
  problems: [],
  isSeed: true,
  insuranceRecord: {
    primary: {
      payerName: "Meridian Advantage HMO",
      ediPayerId: "MERID01",
      subscriberId: "MER-884210",
      groupNumber: "GRP-2201",
      relationshipToSubscriber: "Self",
      planName: "Meridian Advantage HMO",
    },
    secondary: null,
  },
};

// ─── The pure count ───────────────────────────────────────────────

describe("the transcription count is fields, not points", () => {
  test("a faithful copy of the two documents counts every field", () => {
    const score = scoreTranscription(
      {
        firstName: "Ayesha",
        lastName: "Siddiqui",
        dob: "07/04/1988",
        payerName: "Meridian Advantage HMO",
        subscriberId: "MER-884210",
        groupNumber: "GRP-2201",
        payerId: "MERID01",
        relationship: "Self",
      },
      STUDENT_PATIENT as never,
    );
    expect(score).toEqual({ correct: 8, total: 8 });
  });

  test("a mistyped member ID costs exactly one field", () => {
    const score = scoreTranscription(
      {
        firstName: "Ayesha",
        lastName: "Siddiqui",
        dob: "07/04/1988",
        payerName: "Meridian Advantage HMO",
        subscriberId: "MER-88421",
        groupNumber: "GRP-2201",
        payerId: "MERID01",
        relationship: "Self",
      },
      STUDENT_PATIENT as never,
    );
    expect(score).toEqual({ correct: 7, total: 8 });
  });
});

// ─── The rendered stage ───────────────────────────────────────────

async function openRegistration(patientId: string) {
  const router = createRouter({
    routeTree: routeTree as never,
    history: createMemoryHistory({ initialEntries: [`/encounter/${patientId}/registration`] }),
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
    async click(el: Element) {
      await act(async () => {
        el.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 300));
      });
    },
    async unmount() {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

/** The First Name box — the first identity field on the stage. */
function firstNameBox(container: HTMLElement): HTMLInputElement | null {
  const label = [...container.querySelectorAll("label")].find(
    (el) => (el.textContent ?? "").trim() === "First Name",
  );
  return (label?.parentElement?.querySelector("input") ?? null) as HTMLInputElement | null;
}

/** A box is locked when it is disabled, or sits inside a disabled fieldset. */
function isLocked(el: Element | null): boolean {
  if (!el) return true;
  if ((el as HTMLInputElement).disabled) return true;
  return Boolean(el.closest("fieldset[disabled]"));
}

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement | null {
  return (
    [...container.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").replace(/\s+/g, " ").trim().includes(text),
    ) ?? null
  ) as HTMLButtonElement | null;
}

beforeEach(() => {
  win.localStorage.clear();
  win.localStorage.setItem("hh_logged_in_phone", PHONE);
  win.localStorage.setItem("hh_approved_phones", JSON.stringify([PHONE]));
  useEhrStore.getState().registerSeedPatients([...SEED_PATIENTS, STUDENT_PATIENT] as never);
});

describe("a student's Registration opens locked until the card is read", () => {
  test("the identity boxes are locked and no score is on the screen", async () => {
    const screen = await openRegistration("PAT-READCARD");

    expect(buttonByText(screen.container, "Read the card")).not.toBeNull();
    expect(firstNameBox(screen.container)).not.toBeNull();
    expect(isLocked(firstNameBox(screen.container))).toBe(true);
    // Nothing the student has not earned yet.
    expect(screen.text()).not.toMatch(/fields transcribed correctly/);

    // Verify is not a dead button: pressing it while locked says what is
    // missing, and still scores and reveals nothing.
    const verify = buttonByText(screen.container, "Verify Identity & Insurance");
    expect(verify).not.toBeNull();
    expect(isLocked(verify)).toBe(false);
    await screen.click(verify!);
    expect(screen.text()).toContain("Read the card above before verifying.");
    expect(screen.text()).not.toMatch(/fields transcribed correctly/);

    await screen.unmount();
  }, 60000);

  test("reading the card unlocks the boxes; the count appears only after Verify", async () => {
    const screen = await openRegistration("PAT-READCARD");

    await screen.click(buttonByText(screen.container, "Read the card")!);
    expect(isLocked(firstNameBox(screen.container))).toBe(false);
    expect(screen.text()).toContain("Card read");
    // Still nothing before the student commits.
    expect(screen.text()).not.toMatch(/fields transcribed correctly/);

    // Answer the identity question if this chart carries the deliberate
    // misspelling, then save the way a student does.
    const yes = [...screen.container.querySelectorAll("input[type=radio]")].find(
      (el) => (el as HTMLInputElement).value === "yes",
    );
    if (yes) await screen.click(yes);
    const verify = buttonByText(screen.container, "Verify Identity & Insurance");
    expect(verify).not.toBeNull();
    await screen.click(verify!);

    expect(screen.text()).toMatch(/8 of 8 fields transcribed correctly/);

    await screen.unmount();
  }, 60000);

  test("the Tutorial Patient's registration is untouched and stays read-only", async () => {
    const screen = await openRegistration("DEMO");

    // No gate on the reference chart: the owner's rule is that it stays as it is.
    expect(buttonByText(screen.container, "Read the card")).toBeNull();
    expect(screen.text()).not.toMatch(/fields transcribed correctly/);
    // Its own card is still on screen, and the boxes are still locked.
    expect([...screen.container.querySelectorAll("input")].map((el) => el.value)).toContain(
      "Medicare Part B",
    );
    expect(isLocked(firstNameBox(screen.container))).toBe(true);

    await screen.unmount();
  }, 60000);
});
