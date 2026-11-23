/**
 * A browser that saw the previous build is upgraded, not stranded.
 *
 * Owner report, 2026-11-22: the seed guard stopped at `tutorialSeed:
 * "tutorial-1"`, so any record that already held the clinical half — every
 * student whose browser had opened the chart on the previous build — never
 * received the money half, and the Tutorial Patient showed a coded chart with no
 * claim, no 835 and no denial.
 *
 * This test writes the record the previous build left behind (the clinical half,
 * stamped `tutorial-1`, with no claim on it), imports the store on top of it,
 * opens the chart through `selectPatient("DEMO")` — the same call `/patients` →
 * **Open encounter** makes — and reads the saved record back: the claim is there
 * as the filled draft, the clinical fields are untouched, and the record is
 * stamped with this build's version. The student's own Submit then produces the
 * 835, the posting and the denial (owner, 2026-11-23 — the CMS-1500 is filled and
 * the student sends it himself).
 *
 * Inspiration: Epic's Playground patient, and a training environment that fixes
 * a seeded chart in place rather than asking the student to start over.
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

const PHONE = "+920000000004";
const SEEDED_AT = "2026-11-22T09:00:00.000Z";

const React = (await import("react")).default;
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { createEncounter } = await import("../src/store/pipelineEncounter");
const { SEED_PATIENTS } = await import("../src/store/patientStore");
const { saveUserData, loadUserData } = await import("../src/store/persistence");
const { applyTutorialSeed, TUTORIAL_SEED_VERSION } = await import(
  "../src/domain/tutorialEncounter"
);
const { pressSubmitOnReferenceClaim } = await import("./support/referenceSubmit");

const demoPatient = SEED_PATIENTS.find((patient) => patient.id === "DEMO")!;

/**
 * The record the previous build left on a student's machine: the clinical half,
 * stamped `tutorial-1`, with no claim, no 835, no ledger and no AR state.
 */
const clinicalHalf = {
  ...applyTutorialSeed(createEncounter("DEMO"), demoPatient, SEEDED_AT),
  tutorialSeed: "tutorial-1",
};

// Saved BEFORE the pipeline store is imported: its first state is read from
// localStorage at module load, which is how a real browser restores the record.
win.localStorage.setItem("hh_logged_in_phone", PHONE);
saveUserData(PHONE, {
  pipeline: {
    activePatientId: "DEMO",
    encounters: { DEMO: clinicalHalf },
    demoFillMissingBoxes: true,
    currentRole: "scribe",
  },
  currentRole: "scribe",
});

const { PipelineProvider, usePipeline } = await import("../src/store/pipelineStore");
const { useEhrStore } = await import("../src/store/ehrStore");

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
    /** The student's own Submit on the Billing stage. */
    async pressSubmit() {
      await act(async () => {
        pressSubmitOnReferenceClaim(pipeline!);
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 60));
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

describe("a record holding the clinical half is upgraded in place", () => {
  test("opening it adds the claim, the 835, the posting and the denial", async () => {
    const screen = await mount();
    // The chart arrives as the previous build saved it: clinical half only.
    expect(pipeline?.getEncounter("DEMO")?.tutorialSeed).toBe("tutorial-1");
    expect(pipeline?.getEncounter("DEMO")?.claimNumber).toBeNull();

    await screen.open("DEMO");
    const draft = pipeline?.getEncounter("DEMO");

    // Stamped as the whole example, and the claim opens as the filled draft.
    expect(draft?.tutorialSeed).toBe(TUTORIAL_SEED_VERSION);
    expect(draft?.claimNumber).toMatch(/^CLM-\d{6}$/);
    expect(draft?.claimStatus).toBe("draft");
    expect(draft?.claimForm?.serviceLines.map((line) => line.cpt)).toEqual(["99214", "93000"]);
    // Nothing sent, priced, posted or queued: the money is the student's to earn.
    expect(draft?.remittances).toHaveLength(0);
    expect(draft?.ledger).toHaveLength(0);
    expect(draft?.statusEvents.some((event) => event.reasonCode === "277CA_ACCEPTED")).toBe(false);

    // The clinical half is untouched: same note, same signature, same codes, same
    // authorisation, same stage the chart opens on.
    expect(draft?.scribeNote).toBe(clinicalHalf.scribeNote);
    expect(draft?.noteUpdatedAt).toBe(clinicalHalf.noteUpdatedAt);
    expect(draft?.icdCodes).toEqual(clinicalHalf.icdCodes);
    expect(draft?.cptCodes).toEqual(clinicalHalf.cptCodes);
    expect(draft?.codingLines).toEqual(clinicalHalf.codingLines);
    expect(draft?.paData).toEqual(clinicalHalf.paData);
    expect(draft?.stage).toBe(clinicalHalf.stage);
    expect(draft?.role).toBe(clinicalHalf.role);
    expect(draft?.statusEvents.find((event) => event.reasonCode === "NOTE_SIGNED")?.id).toBe(
      clinicalHalf.statusEvents.find((event) => event.reasonCode === "NOTE_SIGNED")?.id,
    );

    // ── The student's own Submit ──────────────────────────────────
    await screen.pressSubmit();
    const enc = pipeline?.getEncounter("DEMO");
    expect(enc?.claimStatus).toBe("partially_paid");

    const remittance = enc?.remittances[0];
    expect(remittance?.postedAt).toBeTruthy();
    const denied = (remittance?.lines ?? []).filter((line) => line.denied);
    expect(denied).toHaveLength(1);
    expect(denied[0].adjustments.map((a) => a.carc)).toContain("CO-236");
    expect((enc?.ledger ?? []).length).toBeGreaterThan(0);
    expect(
      (pipeline?.arWorkItems ?? []).filter(
        (item) => item.claimNumber === enc!.claimNumber && item.kind === "denial",
      ),
    ).toHaveLength(1);

    // The saved record holds it, so a reload keeps the student there.
    await screen.settle();
    const saved = loadUserData(PHONE)?.pipeline?.encounters?.DEMO;
    expect(saved?.tutorialSeed).toBe(TUTORIAL_SEED_VERSION);
    expect(saved?.claimNumber).toBe(enc!.claimNumber);
    expect(saved?.claimStatus).toBe("partially_paid");
    expect(saved?.remittances[0]?.postedAt).toBeTruthy();
    expect(saved?.scribeNote).toBe(clinicalHalf.scribeNote);

    await screen.unmount();
  });

  test("a record already at the current version is left exactly as it is", async () => {
    const screen = await mount();
    await screen.open("DEMO");
    const draft = pipeline?.getEncounter("DEMO");
    expect(draft?.tutorialSeed).toBe(TUTORIAL_SEED_VERSION);

    // The student's own Submit, so there is money to leave alone.
    await screen.pressSubmit();
    const seeded = pipeline?.getEncounter("DEMO");
    expect(seeded?.claimStatus).toBe("partially_paid");

    // Open it a second time: no second claim, no second 835, no second posting.
    await screen.open("DEMO");
    const again = pipeline?.getEncounter("DEMO");
    expect(again?.claimNumber).toBe(seeded!.claimNumber);
    expect(again?.remittances).toHaveLength(1);
    expect(again?.ledger.length).toBe(seeded!.ledger.length);
    expect(again?.statusEvents.length).toBe(seeded!.statusEvents.length);

    await screen.unmount();
  });
});
