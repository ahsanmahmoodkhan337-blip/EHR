/**
 * The Tutorial Patient's buttons: disabled, and they say why.
 *
 * Owner report, 2026-11-23 — *"in tutorial patient i am unable to click submit
 * button i click on it and nothing happen"*. The guard had reached the stores but
 * no stage component, so every write control on the standard chart rendered live
 * and its refusal was invisible. `domain/tutorialReadOnly.ts` now publishes one
 * signal (`READ_ONLY_REASON`, `useReadOnlyChart`, `refuseReadOnly`) and every
 * stage prints it beside the controls that would write.
 *
 * Three regression tests, one per thing the fix promises:
 *
 *   1. **A Tutorial Patient write control is disabled and carries the reason.**
 *      A control that writes is blocked *and* carries the sentence — as its
 *      `title` and as its `aria-describedby`, pointing at the visible line — so a
 *      disabled button can never read as a broken one.
 *   2. **A student's own visit control is enabled.** The same stages, on a chart
 *      the student booked, offer their write controls and carry no lock: the fix
 *      must not have locked the practice chart along with the reference one.
 *   3. **The Submit path refuses with a message rather than silently.** The store
 *      call the Submit button makes is refused with one sentence, the saved
 *      record does not move, and the sentence reaches the student on screen.
 *
 * `isBlocked` asks the question a browser asks — `:disabled`, or a descendant of
 * a `fieldset[disabled]` — because on this markup `.disabled` is false on a
 * descendant of a disabled fieldset (see `tutorial-read-only.test.tsx`).
 *
 * Inspiration: Epic's reference patient — the worked example is shown whole and
 * cannot be changed, and the screen says so rather than swallowing the click.
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

const PHONE = "+920000000023";
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
const { loadUserData } = await import("../src/store/persistence");
const { ENCOUNTER_FLOW_STAGES } = await import("../src/domain/encounterFlow");
const { READ_ONLY_REASON, clearTutorialRefusal, refuseReadOnly, tutorialRefusal } = await import(
  "../src/domain/tutorialReadOnly"
);
const { READ_ONLY_REASON_ID } = await import("../src/components/shell/ReadOnlyStage");
const { TUTORIAL_NOTICE_ID } = await import("../src/components/TabsEpic/TutorialReadOnlyNotice");

/** Every stage of the encounter after the note, in stepper order. */
const WRITE_STAGES = ENCOUNTER_FLOW_STAGES.map((stage) => stage.id).filter(
  (id) => id !== "progress-note",
);

/**
 * The stages whose screen draws the reason beside its controls. Sign & Lock and
 * Billing draw a finished summary of the standard chart — the note is already
 * signed and the claim already submitted — so they have no write control left to
 * label; the line at the top of the page still says why the chart is locked.
 */
const REASON_STAGES = ["coding", "prior-auth", "payments", "denials-ar"];

/**
 * The stages whose write controls are on screen when the stage opens, so the
 * sentence has to be on one of them. Prior Auth opens on a tab that holds no
 * write control (the e-PA form is a tab away), so it is checked for the reason
 * line only.
 */
const OFFER_STAGES = ["coding", "payments", "denials-ar"];

/** A control a browser would let a student press, on this markup. */
function isBlocked(el: Element): boolean {
  if (el.matches(":disabled")) return true;
  if (el.closest("fieldset[disabled]")) return true;
  if (el.getAttribute("aria-disabled") === "true") return true;
  if (el.getAttribute("aria-readonly") === "true") return true;
  return false;
}

const INTERACTIVE = "button,input,select,textarea";

/** Every control that carries the read-only sentence, by either route. */
function reasonCarryingControls(root: ParentNode): Element[] {
  return [...root.querySelectorAll(INTERACTIVE)].filter(
    (el) =>
      el.getAttribute("title") === READ_ONLY_REASON ||
      el.getAttribute("aria-describedby") === READ_ONLY_REASON_ID,
  );
}

function describeControl(el: Element): string {
  return `${el.tagName}:${(el.textContent ?? "").trim().slice(0, 40)}`;
}

/** Mount the app at one encounter address, the way a pasted link opens it. */
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

// ─── 1. Disabled, and it says why ──────────────────────────────────

describe("a Tutorial Patient write control is disabled and carries the reason", () => {
  test("no write control on the standard chart is pressable", async () => {
    // A guard on the walk: the six stages after the note, so a stage added to
    // the flow is walked here without anyone remembering to add it.
    expect(WRITE_STAGES).toEqual([
      "sign-lock",
      "coding",
      "prior-auth",
      "billing",
      "payments",
      "denials-ar",
    ]);

    for (const stageId of WRITE_STAGES) {
      const screen = await openStage("DEMO", stageId);

      // ── The line at the top is there on every stage ─────────────
      expect({ stage: stageId, notice: screen.container.querySelector(`#${TUTORIAL_NOTICE_ID}`) !== null }).toEqual(
        { stage: stageId, notice: true },
      );

      // ── No control that carries the reason can be pressed ───────
      const carrying = reasonCarryingControls(screen.container);
      const pressable = carrying.filter((el) => !isBlocked(el));
      expect({ stage: stageId, pressable: pressable.map(describeControl) }).toEqual({
        stage: stageId,
        pressable: [],
      });

      // ── Where the stage draws write controls, the reason is on it ──
      if (REASON_STAGES.includes(stageId)) {
        const reason = screen.container.querySelector(`#${READ_ONLY_REASON_ID}`);
        expect({ stage: stageId, reason: reason !== null }).toEqual({ stage: stageId, reason: true });
        expect({ stage: stageId, text: (reason?.textContent ?? "").includes(READ_ONLY_REASON) }).toEqual({
          stage: stageId,
          text: true,
        });
        // The stage offers its controls (a stage whose controls vanished is as
        // broken as one whose controls stayed live) — and every one of them is
        // blocked and carries the sentence.
        if (OFFER_STAGES.includes(stageId)) {
          expect({ stage: stageId, offers: carrying.length > 0 }).toEqual({
            stage: stageId,
            offers: true,
          });
        }
        // The description each control points at is the sentence on screen.
        for (const el of carrying) {
          const describedBy = el.getAttribute("aria-describedby");
          if (!describedBy) continue;
          const target = screen.container.querySelector(`#${describedBy}`);
          expect({ stage: stageId, target: target !== null }).toEqual({ stage: stageId, target: true });
          expect({ stage: stageId, text: (target?.textContent ?? "").includes(READ_ONLY_REASON) }).toEqual({
            stage: stageId,
            text: true,
          });
        }
      }

      await screen.unmount();
    }
  }, 120000);

  test("the Coding submit button is disabled and names the reason", async () => {
    const screen = await openStage("DEMO", "coding");

    const submit = [...screen.container.querySelectorAll("button")].find((el) =>
      (el.textContent ?? "").trim().startsWith("Submit Coded Encounter"),
    );
    expect(submit).not.toBeUndefined();
    expect(submit!.getAttribute("title")).toBe(READ_ONLY_REASON);
    expect(submit!.getAttribute("aria-describedby")).toBe(READ_ONLY_REASON_ID);
    expect(isBlocked(submit!)).toBe(true);

    // A disabled control that says nothing reads as a broken one. What it says
    // is on the screen, not only in the attribute.
    const reason = screen.container.querySelector(`#${READ_ONLY_REASON_ID}`);
    expect((reason?.textContent ?? "").includes(READ_ONLY_REASON)).toBe(true);

    await screen.unmount();
  }, 60000);

  test("the Denials & AR queue is wired to the same signal", async () => {
    const screen = await openStage("DEMO", "denials-ar");

    // The queue's own actions — the ones that move money — are write controls.
    const queueActions = [...screen.container.querySelectorAll("button")].filter((el) =>
      / on CLM-\d+$/.test(el.getAttribute("aria-label") ?? ""),
    );
    expect(queueActions.length).toBeGreaterThan(0);
    for (const action of queueActions) {
      expect({ action: describeControl(action), reason: action.getAttribute("title") }).toEqual({
        action: describeControl(action),
        reason: READ_ONLY_REASON,
      });
      expect({ action: describeControl(action), blocked: isBlocked(action) }).toEqual({
        action: describeControl(action),
        blocked: true,
      });
    }

    // And the queue says why, in its own panel, not only at the top of the page.
    const reason = screen.container.querySelector(`#${READ_ONLY_REASON_ID}`);
    expect((reason?.textContent ?? "").includes(READ_ONLY_REASON)).toBe(true);

    await screen.unmount();
  }, 60000);
});

// ─── 2. The student's own chart is not locked ──────────────────────

describe("a student's own booked visit keeps its controls", () => {
  test("the write stages offer their controls and carry no lock", async () => {
    const patient = useEhrStore.getState().registerPatient({
      firstName: "Ayesha",
      lastName: "Rahman",
      dateOfBirth: "1991-04-02",
      sex: "Female",
      phone: "+920000000098",
    });
    expect(patient.id).toBeTruthy();
    expect(patient.id).not.toBe("DEMO");

    for (const stageId of ["progress-note", ...WRITE_STAGES]) {
      const screen = await openStage(patient.id, stageId);

      // No lock anywhere: not the notice, not the reason, not the fieldset.
      expect({ stage: stageId, notice: screen.container.querySelector(`#${TUTORIAL_NOTICE_ID}`) }).toEqual({
        stage: stageId,
        notice: null,
      });
      expect({ stage: stageId, reason: screen.container.querySelector(`#${READ_ONLY_REASON_ID}`) }).toEqual({
        stage: stageId,
        reason: null,
      });
      expect({
        stage: stageId,
        lock: screen.container.querySelector(`fieldset[aria-describedby="${TUTORIAL_NOTICE_ID}"]`),
      }).toEqual({ stage: stageId, lock: null });
      // No control claims the read-only sentence.
      expect({
        stage: stageId,
        carrying: reasonCarryingControls(screen.container).map(describeControl),
      }).toEqual({ stage: stageId, carrying: [] });

      await screen.unmount();
    }

    // And a named write control on the student's own chart is open: the
    // Registration stage's Verify button is the one a student presses first.
    const registration = await openStage(patient.id, "progress-note");
    const verify = [...registration.container.querySelectorAll("button")].find((el) =>
      (el.textContent ?? "").includes("Verify Identity"),
    );
    expect(verify).not.toBeUndefined();
    expect(isBlocked(verify!)).toBe(false);
    expect(verify!.getAttribute("title")).not.toBe(READ_ONLY_REASON);
    await registration.unmount();
  }, 180000);
});

// ─── 3. Submit refuses with a message, never silently ───────────────

describe("the Submit path refuses with a message rather than silently", () => {
  test("the claim submission is refused, said out loud, and changes nothing", async () => {
    // The student's screen, on the standard chart: this is where the sentence
    // has to appear, so it is mounted first and kept mounted.
    const screen = await openStage("DEMO", "billing");

    // The store the Submit button writes to, reached the way a stage reaches it.
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
    // Open the chart the way `/patients` → Open encounter does: the seed runs.
    await act(async () => {
      pipeline?.selectPatient("DEMO");
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });

    const seeded = pipeline?.getEncounter("DEMO");
    expect(seeded?.tutorialSeed).toBe("tutorial-4");
    expect(seeded?.claimNumber).toBeTruthy();
    const savedBefore = loadUserData(PHONE)?.pipeline?.encounters?.DEMO;
    expect(savedBefore?.claimNumber).toBe(seeded!.claimNumber);

    // ── The call the Submit button makes ───────────────────────────
    clearTutorialRefusal();
    await act(async () => {
      pipeline?.submitClaim({ box1: "typed over the standard chart" });
    });

    // Said out loud, in one sentence, naming what was not saved.
    expect(tutorialRefusal()).toContain("The claim submission");
    expect(tutorialRefusal()).toContain("read-only");
    expect(tutorialRefusal()).toContain("was not saved");

    // ── And the student sees it, not only the store ────────────────
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
    const shown = screen.container.querySelector('[data-testid="tutorial-refusal"]');
    expect(shown).not.toBeNull();
    expect(shown?.textContent ?? "").toContain("The claim submission");

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    // ── Nothing moved ─────────────────────────────────────────────
    const savedAfter = loadUserData(PHONE)?.pipeline?.encounters?.DEMO;
    expect(savedAfter?.claimData).toEqual(savedBefore?.claimData);
    expect(savedAfter?.status).toBe(savedBefore?.status);
    expect(savedAfter?.stage).toBe(savedBefore?.stage);
    const now = pipeline?.getEncounter("DEMO");
    expect(now?.claimData).toEqual(seeded?.claimData);
    expect(now?.status).toBe(seeded?.status);
    expect(now?.stage).toBe(seeded?.stage);

    // The guard a stage handler calls says the same sentence — one refusal, one
    // wording, whether the click reached the store or was stopped at the button.
    clearTutorialRefusal();
    await act(async () => {
      refuseReadOnly("The claim submission");
    });
    expect(tutorialRefusal()).toContain("The claim submission");
    expect(container.isConnected).toBe(true);

    await act(async () => root.unmount());
    container.remove();
    await screen.unmount();
  }, 90000);
});
