/**
 * A browser that already holds the Tutorial chart gets the new note.
 *
 * Owner report, 2026-11-23: the rewritten example note (the cardiology visit)
 * only appeared in a browser that had never opened the chart, because the seed
 * guard reads any `tutorialSeed` key as "already seeded". This test writes the
 * record the previous build left behind — the old note text, stamped
 * `tutorial-2`, with its claim on it — imports the store on top of it, opens the
 * chart through `selectPatient("DEMO")` (what `/patients` → **Open encounter**
 * makes) and reads the saved record back: the note is the new one, and the claim
 * is the filled draft the student sends himself (owner, 2026-11-23 — *"the
 * CMS-1500 should be filled and student should submit too … himself"*).
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
const {
  pressSubmitOnReferenceClaim,
  pressAdjudicateOnReferenceClaim,
} = await import("./support/referenceSubmit");

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
 * The same record after the money half landed on it — stamped `tutorial-2`, the
 * version the previous build left on a browser that had opened the chart.
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
    /** The student's own Submit on the Billing stage. */
    async pressSubmit() {
      await act(async () => {
        pressSubmitOnReferenceClaim(pipeline!);
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 60));
      });
    },
    /** The student's own adjudication, then posting, on the Payments stage. */
    async pressAdjudicate() {
      await act(async () => {
        pressAdjudicateOnReferenceClaim(pipeline!);
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

describe("a chart seeded by an older build receives the new note", () => {
  test("the note is refreshed and the money is left exactly as it was", async () => {
    const screen = await mount();
    // The chart arrives as the previous build saved it.
    expect(pipeline?.getEncounter("DEMO")?.scribeNote).toBe(compileNoteText(OLD_NOTE));
    expect(pipeline?.getEncounter("DEMO")?.tutorialSeed).toBe("tutorial-2");

    await screen.open("DEMO");
    const draft = pipeline?.getEncounter("DEMO");

    // The new note is on the record, section by section.
    expect(draft?.scribeNote).not.toBe(compileNoteText(OLD_NOTE));
    expect(draft?.scribeNote).toContain("HPI: Onset — sudden, about two hours before this visit");
    expect(draft?.scribeNote).toContain("troponin I 0.085 ng/mL");
    expect(draft?.noteFields.subjective).toContain("two hours of chest pressure");
    expect(draft?.noteFields.assessment).toContain("R07.9");
    expect(draft?.noteFields.plan).toContain("CPT 93000");
    expect(draft?.tutorialSeed).toBe(TUTORIAL_SEED_VERSION);

    // The claim an older build had already sent is brought back to the filled
    // draft: every box answered, nothing transmitted, priced or posted.
    expect(draft?.claimStatus).toBe("draft");
    expect(draft?.claimNumber).toMatch(/^CLM-\d{6}$/);
    expect(draft?.claimForm).not.toBeNull();
    expect(draft?.remittances).toHaveLength(0);
    expect(draft?.ledger).toHaveLength(0);
    expect(draft?.statusEvents.some((event) => event.reasonCode === "277CA_ACCEPTED")).toBe(false);

    // Everything that is not the note survives the refresh untouched: the
    // signature, the codes, the authorisation and the stage the chart opens on.
    expect(draft?.icdCodes).toEqual(oldRecord.icdCodes);
    expect(draft?.cptCodes).toEqual(oldRecord.cptCodes);
    expect(draft?.codingLines).toEqual(oldRecord.codingLines);
    expect(draft?.paData).toEqual(oldRecord.paData);
    expect(draft?.stage).toBe(oldRecord.stage);
    expect(draft?.statusEvents.find((event) => event.reasonCode === "NOTE_SIGNED")?.id).toBe(
      oldRecord.statusEvents.find((event) => event.reasonCode === "NOTE_SIGNED")?.id,
    );

    // ── The student's own Submit ──────────────────────────────────
    await screen.pressSubmit();
    const sent = pipeline?.getEncounter("DEMO");
    // Submit sends the claim and earns its 277CA. It does not adjudicate it.
    expect(sent?.claimStatus).toBe("accepted");
    expect(sent?.remittances).toHaveLength(0);
    expect(sent?.ledger).toHaveLength(0);

    // ── The student's own adjudication and posting on Payments ────
    await screen.pressAdjudicate();
    const enc = pipeline?.getEncounter("DEMO");
    expect(enc?.claimStatus).toBe("partially_paid");
    // One 835, posted, with the denial the plan's own same-day edit earns.
    expect(enc?.remittances).toHaveLength(1);
    const remittance = enc!.remittances[0];
    expect(remittance.postedAt).toBeTruthy();
    const denied = remittance.lines.filter((line) => line.denied);
    expect(denied).toHaveLength(1);
    expect(denied[0].adjustments.map((a) => a.carc)).toContain("CO-236");
    expect((enc?.ledger ?? []).length).toBeGreaterThan(0);
    expect(enc?.claimForm).toEqual(draft!.claimForm);

    // The saved record holds the new note and the money, so a reload keeps it.
    await screen.settle();
    const saved = loadUserData(PHONE)?.pipeline?.encounters?.DEMO;
    expect(saved?.tutorialSeed).toBe(TUTORIAL_SEED_VERSION);
    expect(saved?.scribeNote).toContain("HPI: Onset — sudden, about two hours before this visit");
    expect(saved?.remittances).toHaveLength(1);
    expect(saved?.remittances[0]?.postedAt).toBeTruthy();

    await screen.unmount();
  });

  test("opening the chart again changes nothing", async () => {
    const screen = await mount();
    await screen.open("DEMO");
    // The student's own Submit, then his adjudication, so there is money on the
    // record to be left alone.
    await screen.pressSubmit();
    await screen.pressAdjudicate();
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
    const draft = pipeline?.getEncounter("DEMO");
    expect(draft?.scribeNote).toContain("troponin I 0.085 ng/mL");
    expect(draft?.tutorialSeed).toBe(TUTORIAL_SEED_VERSION);
    expect(draft?.claimNumber).toMatch(/^CLM-\d{6}$/);
    // Still a draft: the money is the student's to earn.
    expect(draft?.remittances).toHaveLength(0);

    await second.pressSubmit();
    await second.pressAdjudicate();
    const enc = pipeline?.getEncounter("DEMO");
    expect(enc?.remittances).toHaveLength(1);
    await second.unmount();
  });
});
