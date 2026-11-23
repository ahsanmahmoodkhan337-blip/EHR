/**
 * A fresh store still seeds the Tutorial Patient to `tutorial-4`.
 *
 * Spec `specs/tutorial-patient-prefill.md` § C2, third regression test: "one that
 * a fresh store still seeds to `tutorial-4`". § C also says the seed is not a
 * student write — the read-only guard must let the worked example fill a locked
 * chart — so the two halves are checked together here: a store that refuses every
 * student write still arrives holding the whole example.
 *
 * It lives in a file of its own on purpose. "A fresh store" means a store module
 * that has never been written to, and the pipeline store is a module singleton:
 * any earlier test that opened the chart would leave a record and a minted claim
 * number behind. Loading this file with an empty `localStorage` is what a student
 * on a new browser gets.
 *
 * The version is asserted as the literal string `tutorial-4`, not as the
 * `TUTORIAL_SEED_VERSION` constant — a bump of the constant must not let a seed
 * that stopped upgrading pass this test. The literal moved from `tutorial-2` to
 * `tutorial-4` when the example note's revision was bumped and the version ladder
 * (`SEED_VERSION_LADDER`, `domain/tutorialEncounter.ts`) was introduced: that
 * bump is the deliberate act this literal exists to make visible.
 *
 * Inspiration: Epic's Playground patient — open the training chart for the first
 * time and the whole worked example is already in it.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

const win = new Window({ url: "http://localhost/patients" });
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
globals.IS_REACT_ACT_ENVIRONMENT = true;

const PHONE = "+920000000022";

win.localStorage.setItem("hh_logged_in_phone", PHONE);

const React = (await import("react")).default;
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { PipelineProvider, usePipeline } = await import("../src/store/pipelineStore");
const { useEhrStore } = await import("../src/store/ehrStore");
const { SEED_PATIENTS } = await import("../src/store/patientStore");
const { loadUserData } = await import("../src/store/persistence");
const { buildArWorkQueue } = await import("../src/domain/arWorkQueue");

let pipeline: ReturnType<typeof usePipeline> | null = null;

function Probe() {
  pipeline = usePipeline();
  return null;
}

async function mount() {
  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  const root = createRoot(container as unknown as HTMLElement);
  await act(async () => {
    root.render(React.createElement(PipelineProvider, null, React.createElement(Probe)));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  return {
    async open(patientId: string) {
      await act(async () => {
        pipeline?.selectPatient(patientId);
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 40));
      });
    },
    async settle() {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 700));
      });
    },
    async unmount() {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

beforeEach(() => {
  useEhrStore.getState().registerSeedPatients(SEED_PATIENTS);
  pipeline = null;
});

describe("a fresh store", () => {
  test("seeds the Tutorial Patient to tutorial-4, whole, on the first open", async () => {
    const screen = await mount();
    // Nothing on the chart before it is opened.
    expect(pipeline?.getEncounter("DEMO")).toBeUndefined();

    await screen.open("DEMO");
    const enc = pipeline?.getEncounter("DEMO");

    // The version the seed upgrades to, as a literal.
    expect(enc?.tutorialSeed).toBe("tutorial-4");
    // The money half: a claim number minted by the store's own sequence (never a
    // blank or invented one), its 835 and the denial — the worked example, not a
    // blank chart with a stamp on it. The exact number is the store's next one,
    // which a high-water mark carried per student decides, so what is asserted is
    // that it is a real minted number and that no other chart holds it.
    expect(enc?.claimNumber).toMatch(/^CLM-\d{6}$/);
    const others = Object.entries(pipeline?.allEncounters ?? {})
      .filter(([key]) => key !== "DEMO")
      .map(([, record]) => record.claimNumber);
    expect(others).not.toContain(enc?.claimNumber);
    expect(enc?.remittances).toHaveLength(1);
    expect(enc?.remittances[0].postedAt).toBeTruthy();
    expect(enc?.ledger.length).toBeGreaterThan(0);
    // The clinical half the seed is built on.
    expect(enc?.icdCodes).toEqual(["R07.9", "I10", "I25.10"]);
    expect(enc?.cptCodes).toEqual(["99214", "93000"]);

    // Let the store write itself, then read the record back the way a reload does.
    await screen.settle();
    const saved = loadUserData(PHONE)?.pipeline?.encounters?.DEMO;
    expect(saved?.tutorialSeed).toBe("tutorial-4");
    expect(saved?.claimNumber).toBe(enc!.claimNumber);
    expect(saved?.claimStatus).toBe("partially_paid");
    expect(saved?.remittances[0]?.postedAt).toBeTruthy();
    expect((saved?.ledger ?? []).length).toBeGreaterThan(0);

    // The denied line reaches Denials & AR from the saved record alone.
    const items = buildArWorkQueue(
      [
        {
          patientId: saved!.patientId,
          patientName: saved!.displayName,
          claimNumber: saved!.claimNumber,
          remittances: saved!.remittances,
          ledger: saved!.ledger,
          arItems: saved!.arItems,
        },
      ],
      "2026-11-23T12:00:00.000Z",
    );
    expect(items.filter((item) => item.kind === "denial")).toHaveLength(1);

    await screen.unmount();
  }, 30000);
});
