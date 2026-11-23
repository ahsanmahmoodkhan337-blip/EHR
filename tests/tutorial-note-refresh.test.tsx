/**
 * A browser that already holds the Tutorial chart gets the new note.
 *
 * Owner report, 2026-11-23: the rewritten example note (the cardiology visit)
 * only appeared in a browser that had never opened the chart, because the seed
 * guard reads any `tutorialSeed` key as "already seeded". This test writes the
 * record the previous build left behind — the old note text, stamped
 * `tutorial-2`, with its claim, typed boxes, 835, ledger and AR state on it —
 * imports the store on top of it, opens the chart through
 * `selectPatient("DEMO")` (what `/patients` → **Open encounter** makes) and reads
 * the saved record back: the note is the new one, and every piece of money is
 * exactly as it was.
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

const PHONE = "+920000000005";
const SEEDED_AT = "2026-11-22T09:00:00.000Z";

const React = (await import("react")).default;
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { createEncounter } = await import("../src/store/pipelineEncounter");
const { SEED_PATIENTS } = await import("../src/store/patientStore");
const { saveUserData, loadUserData } = await import("../src/store/persistence");
const { compileNoteText } = await import("../src/domain/noteStatus");
const { applyTutorialSeed, TUTORIAL_SEED_VERSION } = await import(
  "../src/domain/tutorialEncounter"
);
const { applyTutorialMoneySeed } = await import("../src/domain/tutorialClaim");

const demoPatient = SEED_PATIENTS.find((patient) => patient.id === "DEMO")!;

/** The note the previous build wrote: the placeholder text the owner rejected. */
const OLD_NOTE = {
  subjective: "Patient here for follow up. Feeling better overall.",
  objective: "Vitals reviewed. Exam unremarkable.",
  assessment: "Hypertension, stable.",
  plan: "Continue current medications. Follow up as needed.",
};

/** The record the previous build left: old note, stamped `tutorial-1`. */
const oldClinical = {
  ...applyTutorialSeed(createEncounter("DEMO"), demoPatient, SEEDED_AT),
  noteFields: OLD_NOTE,
  scribeNote: compileNoteText(OLD_NOTE),
  tutorialSeed: "tutorial-1",
};

/**
 * The same record after the money half landed on it: the claim, its typed boxes,
 * the 835, the posting and the AR state — stamped `tutorial-2`, the version the
 * previous build left on a browser that had opened the chart.
 */
const oldRecord = {
  ...applyTutorialMoneySeed(oldClinical, demoPatient, SEEDED_AT, "CLM-000001"),
  noteFields: OLD_NOTE,
  scribeNote: compileNoteText(OLD_NOTE),
  tutorialSeed: "tutorial-2",
};

// Saved BEFORE the pipeline store is imported: its first state is read from
// localStorage at module load, which is how a real browser restores the record.
win.localStorage.setItem("hh_logged_in_phone", PHONE);
saveUserData(PHONE, {
  pipeline: {
    activePatientId: "DEMO",
    encounters: { DEMO: oldRecord },
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

describe("a chart seeded by an older build receives the new note", () => {
  test("the note is refreshed and the money is left exactly as it was", async () => {
    const screen = await mount();
    // The chart arrives as the previous build saved it.
    expect(pipeline?.getEncounter("DEMO")?.scribeNote).toBe(compileNoteText(OLD_NOTE));
    expect(pipeline?.getEncounter("DEMO")?.tutorialSeed).toBe("tutorial-2");

    await screen.open("DEMO");
    const enc = pipeline?.getEncounter("DEMO");

    // The new note is on the record, section by section.
    expect(enc?.scribeNote).not.toBe(compileNoteText(OLD_NOTE));
    expect(enc?.scribeNote).toContain("HPI: Onset — sudden, about two hours before this visit");
    expect(enc?.scribeNote).toContain("troponin I 0.085 ng/mL");
    expect(enc?.noteFields.subjective).toContain("two hours of chest pressure");
    expect(enc?.noteFields.assessment).toContain("R07.9");
    expect(enc?.noteFields.plan).toContain("CPT 93000");
    expect(enc?.tutorialSeed).toBe(TUTORIAL_SEED_VERSION);

    // Everything that is not the note survives untouched: the signature, the
    // codes, the authorisation, the claim with its typed boxes, the 835, the
    // posting, the ledger and the AR state.
    expect(enc?.claimNumber).toBe(oldRecord.claimNumber);
    expect(enc?.claimStatus).toBe(oldRecord.claimStatus);
    expect(enc?.claimForm).toEqual(oldRecord.claimForm);
    expect(enc?.remittances).toEqual(oldRecord.remittances);
    expect(enc?.ledger).toEqual(oldRecord.ledger);
    expect(enc?.arItems).toEqual(oldRecord.arItems);
    expect(enc?.icdCodes).toEqual(oldRecord.icdCodes);
    expect(enc?.cptCodes).toEqual(oldRecord.cptCodes);
    expect(enc?.codingLines).toEqual(oldRecord.codingLines);
    expect(enc?.paData).toEqual(oldRecord.paData);
    expect(enc?.stage).toBe(oldRecord.stage);
    expect(enc?.statusEvents).toEqual(oldRecord.statusEvents);
    // No second claim, no second 835: the money seed did not re-run.
    expect(enc?.remittances).toHaveLength(1);

    // The saved record holds the new note, so a reload keeps it.
    await screen.settle();
    const saved = loadUserData(PHONE)?.pipeline?.encounters?.DEMO;
    expect(saved?.tutorialSeed).toBe(TUTORIAL_SEED_VERSION);
    expect(saved?.scribeNote).toContain("HPI: Onset — sudden, about two hours before this visit");
    expect(saved?.claimForm).toEqual(oldRecord.claimForm);
    expect(saved?.remittances).toEqual(oldRecord.remittances);

    await screen.unmount();
  });

  test("opening the chart again changes nothing", async () => {
    const screen = await mount();
    await screen.open("DEMO");
    const refreshed = pipeline?.getEncounter("DEMO");

    await screen.open("DEMO");
    const again = pipeline?.getEncounter("DEMO");
    expect(again?.scribeNote).toBe(refreshed!.scribeNote);
    expect(again?.noteUpdatedAt).toBe(refreshed!.noteUpdatedAt);
    expect(again?.claimNumber).toBe(refreshed!.claimNumber);
    expect(again?.remittances).toHaveLength(1);
    expect(again?.statusEvents).toHaveLength(refreshed!.statusEvents.length);

    await screen.unmount();
  });

  test("a chart holding the clinical half only is refreshed and then priced once", async () => {
    const screen = await mount();
    // Overwrite the saved record with the clinical half only, as the build before
    // the money seed left it.
    saveUserData(PHONE, {
      pipeline: {
        activePatientId: "DEMO",
        encounters: { DEMO: oldClinical },
        demoFillMissingBoxes: true,
        currentRole: "scribe",
      },
      currentRole: "scribe",
    });
    await screen.unmount();

    const second = await mount();
    await second.open("DEMO");
    const enc = pipeline?.getEncounter("DEMO");
    expect(enc?.scribeNote).toContain("troponin I 0.085 ng/mL");
    expect(enc?.tutorialSeed).toBe(TUTORIAL_SEED_VERSION);
    expect(enc?.claimNumber).toMatch(/^CLM-\d{6}$/);
    expect(enc?.remittances).toHaveLength(1);
    await second.unmount();
  });
});
