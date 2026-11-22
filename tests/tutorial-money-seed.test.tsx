/**
 * The Tutorial Patient's money half is written when the chart is opened.
 *
 * Owner, 2026-11-22: the tutorial chart is the standard that shows which datum
 * belongs in which stage. The clinical half (`tutorial-1`) fills registration,
 * the note, the codes and the authorisation; this proves the money half — the
 * claim, its 277CA A1, the 835 with one denial, the posting and the AR queue it
 * derives — lands on the same record from a cleared store.
 *
 * Opened the way a student opens it: `selectPatient("DEMO")`, which is what
 * `/patients` → **Open encounter** calls, and read back both from the live store
 * and from the record the store saved.
 *
 * Inspiration: Epic's Playground patient — the demo chart is filled the moment it
 * is opened, whichever door the student came through.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

// ── A DOM, before React DOM is imported ────────────────────────────
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
globals.getComputedStyle = win.getComputedStyle.bind(win);
globals.requestAnimationFrame = (cb: FrameRequestCallback) =>
  setTimeout(() => cb(Date.now()), 0) as unknown as number;
globals.cancelAnimationFrame = (id: number) => clearTimeout(id);
globals.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import("react")).default;
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { PipelineProvider, usePipeline } = await import("../src/store/pipelineStore");
const { useEhrStore } = await import("../src/store/ehrStore");
const { SEED_PATIENTS } = await import("../src/store/patientStore");
const { loadUserData } = await import("../src/store/persistence");
const { TUTORIAL_SEED_VERSION, TUTORIAL_MEMBER_ID } = await import(
  "../src/domain/tutorialEncounter"
);

const PHONE = "+920000000003";

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
        await new Promise((resolve) => setTimeout(resolve, 30));
      });
    },
    async settle() {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
      });
    },
    async unmount() {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

beforeEach(() => {
  win.localStorage.clear();
  win.localStorage.setItem("hh_logged_in_phone", PHONE);
  useEhrStore.getState().registerSeedPatients(SEED_PATIENTS);
  pipeline = null;
});

describe("a cleared store gets the whole worked example", () => {
  test("opening the Tutorial Patient writes the claim, the 835 and its posting", async () => {
    const screen = await mount();
    expect(pipeline?.getEncounter("DEMO")).toBeUndefined();

    await screen.open("DEMO");
    const enc = pipeline?.getEncounter("DEMO");
    expect(enc).toBeTruthy();

    // Both halves are on the record.
    expect(enc?.tutorialSeed).toBe(TUTORIAL_SEED_VERSION);
    expect(enc?.cptCodes).toEqual(["99214", "93000"]);

    // The claim: a number, a status, and the paper filled from the chart.
    expect(enc?.claimNumber).toMatch(/^CLM-\d{6}$/);
    expect(enc?.claimStatus).toBe("partially_paid");
    expect(enc?.claimForm?.insuredId).toBe(TUTORIAL_MEMBER_ID);
    expect(enc?.claimForm?.priorAuthNumber).toBe("PA-2026-TUTORIAL-01");
    expect(enc?.claimForm?.serviceLines.map((line) => line.cpt)).toEqual(["99214", "93000"]);

    // The 277CA came back A1 and the 835 was received and posted.
    const codes = (enc?.statusEvents ?? []).map((event) => event.reasonCode);
    expect(codes).toContain("SUBMITTED_837P");
    expect(codes).toContain("277CA_ACCEPTED");
    expect(codes).toContain("ERA_RECEIVED");
    expect(codes).toContain("ERA_POSTED");

    // The 835: posted, one denial, and every line balances.
    expect(enc?.remittances).toHaveLength(1);
    const remittance = enc!.remittances[0];
    expect(remittance.postedAt).toBeTruthy();
    const denied = remittance.lines.filter((line) => line.denied);
    expect(denied).toHaveLength(1);
    expect(denied[0].cpt).toBe("99214");
    expect(denied[0].adjustments.map((a) => a.carc)).toContain("CO-236");
    expect(remittance.totals.paidCents).toBeGreaterThan(0);

    // The posting: charge, insurance payment and adjustment entries on the ledger.
    expect(enc?.ledger.length).toBeGreaterThan(0);
    expect(enc?.ledger.some((entry) => entry.type === "charge")).toBe(true);
    expect(enc?.ledger.some((entry) => entry.type === "insurance_payment")).toBe(true);
    expect(enc?.ledger.some((entry) => entry.type === "adjustment" && entry.code === "CO-236")).toBe(true);

    // The AR queue derives the denial from that posted 835.
    const denialItems = (pipeline?.arWorkItems ?? []).filter(
      (item) => item.claimNumber === enc!.claimNumber && item.kind === "denial",
    );
    expect(denialItems).toHaveLength(1);
    expect(denialItems[0].carc).toBe("CO-236");

    // And the record the store saved holds the same claim.
    await screen.settle();
    const saved = loadUserData(PHONE)?.pipeline?.encounters?.DEMO;
    expect(saved?.tutorialSeed).toBe(TUTORIAL_SEED_VERSION);
    expect(saved?.claimNumber).toBe(enc!.claimNumber);
    expect(saved?.claimStatus).toBe("partially_paid");
    expect(saved?.remittances[0]?.postedAt).toBeTruthy();

    await screen.unmount();
  });
});
