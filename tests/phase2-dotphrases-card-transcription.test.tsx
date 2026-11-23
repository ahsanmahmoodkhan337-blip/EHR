/**
 * Phase 2, first half: the insurance card is transcribed before Verify, and the
 * score it earns is locked.
 *
 * Owner (2026-11-23): the student "types the member ID, group and plan from the
 * card before Verify reveals the stored values, then a score is locked in and
 * cannot be improved by retrying".
 *
 * Mounted at `/encounter/DEMO/registration` — the address a student reaches from
 * the chart — so the assertions are about the screen, not a helper.
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

const PHONE = "+920000000033";
win.localStorage.setItem("hh_logged_in_phone", PHONE);
win.localStorage.setItem("hh_approved_phones", JSON.stringify([PHONE]));

const React = (await import("react")).default;
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { RouterProvider, createRouter, createMemoryHistory } = await import("@tanstack/react-router");
const { routeTree } = await import("../src/routeTree.gen");
const { useEhrStore } = await import("../src/store/ehrStore");
const { SEED_PATIENTS } = await import("../src/store/patientStore");
const { patientCard } = await import("../src/domain/patientCard");
const { loadLockedRegistrationScore } = await import("../src/utils/scoring");

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

/** Type into a controlled input the way a person does (React sees an input event). */
async function type(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(el, value);
    el.dispatchEvent(new win.Event("input", { bubbles: true }));
  });
}

beforeEach(() => {
  win.localStorage.clear();
  win.localStorage.setItem("hh_logged_in_phone", PHONE);
  win.localStorage.setItem("hh_approved_phones", JSON.stringify([PHONE]));
  useEhrStore.getState().registerSeedPatients(SEED_PATIENTS);
});

describe("the insurance card is transcribed before Verify", () => {
  test("the form opens blank, Verify reveals the card's values, and the score locks", async () => {
    const screen = await openStage("DEMO", "registration");
    const chart = () => useEhrStore.getState().patients.find((p) => p.id === "DEMO");
    const card = patientCard(chart());
    expect(card.memberId).not.toBe("");

    // ── The transcription boxes are empty; the card on screen is not ──
    const inputs = [...screen.container.querySelectorAll("input")] as HTMLInputElement[];
    expect(inputs.map((el) => el.value)).not.toContain(card.memberId);
    expect(screen.text()).toContain(card.memberId);

    const labelled = (text: string) => {
      const all = [...screen.container.querySelectorAll("input")] as HTMLInputElement[];
      return all.find((el) => el.previousElementSibling?.textContent?.trim() === text);
    };
    const firstName = labelled("First Name")!;
    const lastName = labelled("Last Name")!;
    const dob = labelled("Date of Birth (MM/DD/YYYY)")!;
    const payerName = labelled("Payer Name")!;
    const member = labelled("Subscriber ID")!;
    const group = labelled("Group Number")!;
    const plan = labelled("Plan")!;
    const payerId = labelled("Payer ID (EDI)")!;
    expect(Boolean(firstName && lastName && dob && payerName && member && group && plan && payerId)).toBe(true);

    await type(firstName, "Tutorial");
    await type(lastName, "Patient");
    await type(dob, card.dateOfBirth);
    await type(payerName, card.payerName);
    await type(member, "WRONG-000");
    await type(group, card.groupNumber);
    await type(plan, card.planName);
    await type(payerId, card.payerId);

    const yes = [...screen.container.querySelectorAll("input[type=radio]")][0] as HTMLInputElement;
    if (yes) await act(async () => yes.click());

    const verify = [...screen.container.querySelectorAll("button")].find((b) =>
      /Verify Identity/.test(b.textContent ?? ""),
    ) as HTMLButtonElement;
    await act(async () => verify.click());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // ── The reveal names the stored value and the denial it would cost ──
    const revealed = screen.text();
    expect(revealed).toContain(card.memberId);
    expect(revealed).toContain("CO-16");
    expect(revealed).toContain("Score:");

    // ── The typo never reaches the chart ──
    expect(patientCard(chart()).memberId).toBe(card.memberId);

    // ── The score is locked, and a better retry cannot raise it ──
    const locked = loadLockedRegistrationScore("DEMO", PHONE);
    expect(locked).not.toBeNull();
    const firstScore = locked!.score;

    await type(member, card.memberId);
    const reverify = [...screen.container.querySelectorAll("button")].find((b) =>
      /Re-verify/.test(b.textContent ?? ""),
    ) as HTMLButtonElement;
    await act(async () => reverify.click());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(loadLockedRegistrationScore("DEMO", PHONE)!.score).toBe(firstScore);
    expect(screen.text()).toContain("locked");

    await screen.unmount();
  }, 40000);
});
