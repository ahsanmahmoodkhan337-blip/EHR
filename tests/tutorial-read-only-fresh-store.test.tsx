/**
 * A fresh store still seeds the Tutorial Patient to `tutorial-5`.
 *
 * Spec `specs/tutorial-patient-prefill.md` § C2, third regression test. § C also
 * says the seed is not a student write — the read-only guard must let the worked
 * example fill a locked chart — so the two halves are checked together here: a
 * store that refuses every student write still arrives holding the whole example,
 * with its claim filled and waiting for the student's own Submit.
 *
 * It lives in a file of its own on purpose. "A fresh store" means a store module
 * that has never been written to, and the pipeline store is a module singleton:
 * any earlier test that opened the chart would leave a record and a minted claim
 * number behind. Loading this file with an empty `localStorage` is what a student
 * on a new browser gets.
 *
 * The version is asserted as the literal string, not as the `TUTORIAL_SEED_VERSION`
 * constant — a bump of the constant must not let a seed that stopped upgrading
 * pass this test. The literal moved from `tutorial-4` to `tutorial-5` when the
 * claim half changed from "already sent" to "filled draft, the student presses
 * Submit" (owner, 2026-11-23): that bump is the deliberate act this literal
 * exists to make visible.
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
const { pressSubmitOnReferenceClaim } = await import("./support/referenceSubmit");

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
    /** The student's own Submit on the Billing stage. */
    async pressSubmit() {
      await act(async () => {
        pressSubmitOnReferenceClaim(pipeline!);
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 60));
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
  test("seeds the Tutorial Patient to tutorial-5, whole, on the first open", async () => {
    const screen = await mount();
    // Nothing on the chart before it is opened.
    expect(pipeline?.getEncounter("DEMO")).toBeUndefined();

    await screen.open("DEMO");
    const draft = pipeline?.getEncounter("DEMO");

    // The version the seed upgrades to, as a literal.
    expect(draft?.tutorialSeed).toBe("tutorial-5");
    // The claim half: a claim number minted by the store's own sequence (never a
    // blank or invented one) and the paper filled from the chart — and nothing
    // sent, priced or posted until the student presses Submit.
    expect(draft?.claimNumber).toMatch(/^CLM-\d{6}$/);
    const others = Object.entries(pipeline?.allEncounters ?? {})
      .filter(([key]) => key !== "DEMO")
      .map(([, record]) => record.claimNumber);
    expect(others).not.toContain(draft?.claimNumber);
    expect(draft?.claimStatus).toBe("draft");
    expect(draft?.claimForm?.serviceLines.map((line) => line.cpt)).toEqual(["99214", "93000"]);
    expect(draft?.remittances).toHaveLength(0);
    expect(draft?.ledger).toHaveLength(0);
    // The clinical half the seed is built on.
    expect(draft?.icdCodes).toEqual(["R07.9", "I10", "I25.10"]);
    expect(draft?.cptCodes).toEqual(["99214", "93000"]);

    // ── The student's own Submit ──────────────────────────────────
    await screen.pressSubmit();
    const enc = pipeline?.getEncounter("DEMO");
    expect(enc?.claimStatus).toBe("partially_paid");
    expect(enc?.remittances).toHaveLength(1);
    expect(enc?.remittances[0].postedAt).toBeTruthy();
    expect(enc?.ledger.length).toBeGreaterThan(0);

    // Let the store write itself, then read the record back the way a reload does.
    await screen.settle();
    const saved = loadUserData(PHONE)?.pipeline?.encounters?.DEMO;
    expect(saved?.tutorialSeed).toBe("tutorial-5");
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
