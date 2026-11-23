/**
 * The Tutorial Patient's chart is read-only — the two regression tests that keep
 * it locked.
 *
 * Owner decision, 2026-11-22 — *"Keep the Tutorial Patient read-only so students
 * can't edit the standard chart"* — and 2026-11-23 — *"each section should be pre
 * written and locked"*. Spec `specs/tutorial-patient-prefill.md` § C, and § C2's
 * "tests that would catch a regression": a test that mounts every stage on the
 * tutorial record and fails if any editable control is enabled or the line at the
 * top is missing, and a test that calls a student write path and asserts the saved
 * record is unchanged afterwards.
 *
 * The third test § C2 asks for — a fresh store still seeds to `tutorial-4` —
 * lives in `tutorial-read-only-fresh-store.test.tsx`, because a fresh store means
 * a store module that has never been written to, and this file's two tests mount
 * the app and seed the record on purpose.
 *
 * ## Why `matches(":disabled")` and not `.disabled`
 *
 * The lock is a `<fieldset disabled className="contents">` around each stage. A
 * browser leaves `.disabled` **false** on a descendant of a disabled fieldset —
 * only `:disabled` matches, and only `:disabled` blocks focus and typing (verified
 * in Chromium on the built app). So the assertions here ask the same question a
 * browser answers: `matches(":disabled")` for a control that carries the
 * attribute, and the fieldset ancestor for a descendant.
 *
 * happy-dom — the DOM these tests run in — implements the first half of that
 * faithfully (`:disabled` matches a `<fieldset disabled>` itself) but not the
 * inheritance half: on a descendant it reports `.disabled` false **and**
 * `:disabled` false, exactly like a browser that had no stylesheet. So the
 * descendant form of the same fact is written as `closest("fieldset[disabled]")`,
 * which is the DOM structure that makes Chromium refuse the focus. Both forms are
 * asserted below; neither is `el.disabled`, which lies on this exact markup.
 *
 * Inspiration: Epic's reference patient — the worked example is shown whole, in
 * the same chart a student practises in, and cannot be changed.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

// ── A DOM, before React DOM is imported ────────────────────────────
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
// The header's search and the app's motion components ask for these on mount.
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
// The AR Voice stage reads the browser's voices when it mounts.
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

const PHONE = "+920000000021";
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
const { TUTORIAL_READ_ONLY_LINE } = await import("../src/domain/tutorialReadOnly");
const { TUTORIAL_NOTICE_ID } = await import("../src/components/TabsEpic/TutorialReadOnlyNotice");
const { pressSubmitOnReferenceClaim } = await import("./support/referenceSubmit");

/** The seven stages of the encounter, in the order the stepper draws them. */
const STAGES = ENCOUNTER_FLOW_STAGES.map((stage) => stage.id);

/** A control a browser would let a student press, on this markup. */
function isBlocked(el: Element): boolean {
  // Its own attribute: `:disabled` is the question a browser asks.
  if (el.matches(":disabled")) return true;
  // A descendant of a disabled fieldset — Chromium's form-control-disabled.
  // happy-dom does not implement the inheritance in `:disabled`, so the
  // structure is what is asked about here.
  if (el.closest("fieldset[disabled]")) return true;
  if (el.getAttribute("aria-disabled") === "true") return true;
  if (el.getAttribute("aria-readonly") === "true") return true;
  return false;
}

const INTERACTIVE = "button,input,select,textarea,a[href]";

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
});

describe("every stage of the Tutorial Patient's chart is locked", () => {
  test("no stage offers an editable control, and every stage says why", async () => {
    // A guard on the walk itself: all seven stages, so a stage added to the flow
    // is walked here without anyone remembering to add it.
    expect(STAGES.length).toBe(7);

    for (const stageId of STAGES) {
      const screen = await openStage(stageId);

      // ── The line at the top ────────────────────────────────────
      const notice = screen.container.querySelector(`#${TUTORIAL_NOTICE_ID}`);
      expect({ stage: stageId, notice: notice !== null }).toEqual({ stage: stageId, notice: true });
      expect(notice?.textContent ?? "").toContain(TUTORIAL_READ_ONLY_LINE);
      expect(notice?.getAttribute("role")).toBe("status");

      // ── Billing keeps exactly one live control: Submit ─────────
      // Owner, 2026-11-23: the claim opens filled and the student sends it
      // himself, so Billing's Submit is the one pressable control on the whole
      // reference chart — and nothing else on that stage is.
      if (stageId === "billing") {
        const live = [...screen.container.querySelectorAll(INTERACTIVE)].filter((el) => !isBlocked(el));
        expect({
          stage: stageId,
          pressable: live.map((el) => `${el.tagName}:${(el.textContent ?? "").trim()}`),
        }).toEqual({ stage: stageId, pressable: ["BUTTON:Submit"] });
        await screen.unmount();
        continue;
      }

      // ── The lock itself ────────────────────────────────────────
      // The stage's content sits in a fieldset that is disabled for this chart,
      // and the fieldset is the reason a student's keystroke is refused.
      const wrappers = [...screen.container.querySelectorAll(`[aria-describedby="${TUTORIAL_NOTICE_ID}"]`)];
      expect({ stage: stageId, wrappers: wrappers.length > 0 }).toEqual({
        stage: stageId,
        wrappers: true,
      });
      for (const wrapper of wrappers) {
        expect({ stage: stageId, tag: wrapper.tagName, locked: wrapper.matches(":disabled") }).toEqual({
          stage: stageId,
          tag: "FIELDSET",
          locked: true,
        });
      }

      // ── Nothing a student could type into is open ──────────────
      const fields = [...screen.container.querySelectorAll("input,select,textarea")];
      const openFields = fields.filter((field) => !isBlocked(field));
      expect({ stage: stageId, open: openFields.map((f) => f.outerHTML.slice(0, 80)) }).toEqual({
        stage: stageId,
        open: [],
      });

      // ── Every control the stage keeps, it keeps disabled ───────
      // Spec § C2: the Sign & Lock, Submit Claim, Post 835 and Start over
      // buttons stay on screen — a student must see that the workflow has them.
      // What must never happen is one of them being pressable.
      const controlsInside = wrappers.flatMap((wrapper) => [...wrapper.querySelectorAll(INTERACTIVE)]);
      const pressable = controlsInside.filter((el) => !isBlocked(el));
      expect({
        stage: stageId,
        pressable: pressable.map((el) => `${el.tagName}:${(el.textContent ?? "").trim().slice(0, 30)}`),
      }).toEqual({ stage: stageId, pressable: [] });

      await screen.unmount();
    }
  }, 60000);
});

describe("a student write to the standard chart is refused where it happens", () => {
  test("Start over, the note and the demographics leave the saved record unchanged", async () => {
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

    const draft = pipeline?.getEncounter("DEMO");
    expect(draft?.tutorialSeed).toBe("tutorial-5");
    expect(draft?.claimNumber).toBeTruthy();
    // The claim opens filled and unsent — the student's own Submit is the one
    // write the reference chart allows (owner, 2026-11-23).
    expect(draft?.claimStatus).toBe("draft");
    expect(draft?.remittances).toHaveLength(0);

    await act(async () => {
      pressSubmitOnReferenceClaim(pipeline!);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });
    const seeded = pipeline?.getEncounter("DEMO");
    expect(seeded?.claimStatus).toBe("partially_paid");
    const before = JSON.stringify(loadUserData(PHONE)?.pipeline?.encounters?.DEMO);
    expect(before).toContain(seeded!.claimNumber!);

    // ── The three student write paths, called directly ─────────
    // Not through a disabled button: straight at the store, which is where the
    // spec says the refusal has to live. A disabled-looking screen whose store
    // still accepts the write is not read-only.
    const { clearTutorialRefusal, tutorialRefusal } = await import("../src/domain/tutorialReadOnly");
    clearTutorialRefusal();

    await act(async () => {
      pipeline?.resetEncounter("DEMO");
    });
    expect(tutorialRefusal()).toContain("Start over");
    expect(tutorialRefusal()).toContain("read-only");

    await act(async () => {
      pipeline?.writeNoteFor("DEMO", {
        subjective: "A note the student typed over the standard chart.",
        objective: "",
        assessment: "",
        plan: "",
      });
    });
    expect(tutorialRefusal()).toContain("The note");

    await act(async () => {
      useEhrStore.getState().updatePatientDemographics("DEMO", { phone: "0000000000" });
    });
    expect(tutorialRefusal()).toContain("demographics");

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });

    // ── Nothing moved ─────────────────────────────────────────
    const after = JSON.stringify(loadUserData(PHONE)?.pipeline?.encounters?.DEMO);
    expect(after).toBe(before);
    // And the in-memory record the screen draws from is the same one.
    const now = pipeline?.getEncounter("DEMO");
    expect(now?.claimNumber).toBe(seeded!.claimNumber);
    expect(now?.scribeNote).toBe(seeded!.scribeNote);
    expect(now?.tutorialSeed).toBe("tutorial-5");
    expect(now?.icdCodes).toEqual(seeded!.icdCodes);
    expect(now?.codingLines).toEqual(seeded!.codingLines);
    expect(now?.remittances).toHaveLength(1);
    expect(now?.remittances[0].postedAt).toBe(seeded!.remittances[0].postedAt);
    // The patient's own card is untouched too.
    const patient = useEhrStore
      .getState()
      .seedPatients.find((p) => p.id === "DEMO");
    expect(patient?.phone).not.toBe("0000000000");

    await act(async () => root.unmount());
    container.remove();
  }, 30000);
});
