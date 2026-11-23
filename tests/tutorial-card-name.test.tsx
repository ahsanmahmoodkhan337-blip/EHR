/**
 * The Tutorial Patient's insurance card reads "Tutorial Patient".
 *
 * Owner report, 2026-11-23: the card's MEMBER NAME printed "Tutorial Pateint".
 * The string was in no seed and in no saved record — it was generated at render
 * time by the deliberate one-mismatch trap in `domain/patientCard.ts`, which
 * transposes two letters of the patient's own surname. On the worked example that
 * reads as a typo, so the standard chart prints its own name and keeps the trap
 * for the charts a student works.
 *
 * Three things are checked, each one able to fail on the misspelling:
 *   1. the card's member name is the chart's own name, and the trap still fires
 *      on a student's chart;
 *   2. a record saved before the fix — one that does hold the transposed spelling
 *      — is corrected on open, and a name the student typed is left alone;
 *   3. opening the chart the way a student does writes the corrected name to the
 *      saved record, so a reload keeps it.
 *
 * Inspiration: Epic's Playground patient, whose reference chart cannot disagree
 * with itself.
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
const { useEhrStore, bootstrapEhrStore } = await import("../src/store/ehrStore");
const { SEED_PATIENTS } = await import("../src/store/patientStore");
const { TUTORIAL_PATIENT_ID } = await import("../src/domain/tutorialEncounter");
const {
  caseMismatch,
  patientCard,
  registrationExpectations,
} = await import("../src/domain/patientCard");
const { tutorialNameRepair } = await import("../src/domain/tutorialIdentity");

const PHONE = "+920000000098";
const ENVELOPE_KEY = `hh_ehr_ls_${PHONE}`;
const RIGHT_NAME = "Tutorial Patient";
/** What the old card printed: the same name with two letters swapped. */
const WRONG_NAME = "Tutorial Pateint";

/** The Tutorial Patient as the app seeds it. */
const TUTORIAL = SEED_PATIENTS.find((p) => p.id === TUTORIAL_PATIENT_ID)!;

/** A student's own chart — not the worked example. */
const JANE = {
  id: "P001",
  mrn: "MRN-1001",
  firstName: "Jane",
  lastName: "Doe",
  insurance: "Northwind Health Plan PPO",
  insuranceRecord: {
    primary: {
      payerName: "Northwind Health Plan",
      planName: "PPO",
      subscriberId: "NW-884210",
      groupNumber: "GRP-77",
      ediPayerId: "NWIND01",
      relationshipToSubscriber: "Self",
    },
  },
};

let pipeline: ReturnType<typeof usePipeline> | null = null;

function Probe() {
  pipeline = usePipeline();
  return null;
}

function savedTutorialPatient(): Record<string, unknown> | undefined {
  const raw = win.localStorage.getItem(ENVELOPE_KEY);
  const envelope = raw ? JSON.parse(raw) : null;
  const patients = (envelope?.user?.patients ?? []) as Record<string, unknown>[];
  return patients.find((p) => p.id === TUTORIAL_PATIENT_ID);
}

async function settle(ms: number) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

describe("the Tutorial Patient's card member name", () => {
  test("prints the chart's own name, not a transposition of it", () => {
    const card = patientCard(TUTORIAL);
    expect(card.fullName).toBe(RIGHT_NAME);
    // What the insurance card prints (RegistrationStage): the case's mismatch
    // when it has one, the chart's own name otherwise.
    const printed = caseMismatch(TUTORIAL)?.onCard ?? card.fullName;
    expect(printed).toBe(RIGHT_NAME);
    expect(printed).not.toBe(WRONG_NAME);
    // The score is written against the same spelling the card shows.
    expect(registrationExpectations(TUTORIAL).cardMemberName).toBe(RIGHT_NAME);
  });

  test("a student's own chart still carries the one deliberate mismatch", () => {
    const mismatch = caseMismatch(JANE as never);
    expect(mismatch).toBeTruthy();
    expect(mismatch!.documentsAgree).toBe(false);
    expect(mismatch!.onCard).not.toBe(patientCard(JANE as never).fullName);
  });
});

describe("a chart saved before the fix", () => {
  test("is corrected to the chart's own name", () => {
    const saved = {
      id: TUTORIAL_PATIENT_ID,
      firstName: "Tutorial",
      lastName: "Pateint",
      insuranceRecord: { primary: { subscriberName: WRONG_NAME } },
    };
    expect(tutorialNameRepair(saved)).toEqual({
      lastName: "Patient",
      subscriberName: RIGHT_NAME,
    });
  });

  test("a name the student typed is never overwritten", () => {
    // Not a letter-swap of the seeded name: theirs, and left exactly as typed.
    expect(
      tutorialNameRepair({ id: TUTORIAL_PATIENT_ID, firstName: "Tutorial", lastName: "Patient-Smith" }),
    ).toBeNull();
    expect(
      tutorialNameRepair({
        id: TUTORIAL_PATIENT_ID,
        firstName: "Tutorial",
        lastName: "Patient",
        insuranceRecord: { primary: { subscriberName: "Demo Support" } },
      }),
    ).toBeNull();
    // Another patient's chart is not the standard chart: nothing is touched.
    expect(tutorialNameRepair({ id: "P001", firstName: "Jane", lastName: "Doe" })).toBeNull();
  });
});

describe("opening the chart repairs a saved record", () => {
  beforeEach(() => {
    useEhrStore.getState().unload();
    win.localStorage.clear();
    win.localStorage.setItem("hh_logged_in_phone", PHONE);
    // A record saved by a build whose card printed the transposed surname.
    win.localStorage.setItem(
      ENVELOPE_KEY,
      JSON.stringify({
        app: "healthcare-hustlers-ehr",
        schemaVersion: 6,
        updatedAt: new Date(Date.now() - 60_000).toISOString(),
        phone: PHONE,
        user: {
          patients: [
            {
              ...TUTORIAL,
              firstName: "Tutorial",
              lastName: "Pateint",
              insurance: "Medicare Part B",
              insuranceRecord: {
                primary: {
                  payerName: "Medicare Part B",
                  planName: "Medicare Part B",
                  subscriberId: "1EG4TE5MK72",
                  groupNumber: "",
                  ediPayerId: "00102",
                  relationshipToSubscriber: "Self",
                  subscriberName: WRONG_NAME,
                },
                secondary: null,
              },
            },
          ],
        },
      }),
    );
    useEhrStore.getState().registerSeedPatients(SEED_PATIENTS);
    bootstrapEhrStore(PHONE);
    pipeline = null;
  });

  test("and the corrected name survives the save", async () => {
    const container = win.document.createElement("div");
    win.document.body.appendChild(container);
    const root = createRoot(container as unknown as HTMLElement);
    await act(async () => {
      root.render(React.createElement(PipelineProvider, null, React.createElement(Probe)));
    });
    await settle(40);

    // The student opens the chart: the store's own open path.
    await act(async () => {
      pipeline?.selectPatient(TUTORIAL_PATIENT_ID);
    });
    await settle(900);

    const saved = savedTutorialPatient();
    expect(saved).toBeTruthy();
    expect(saved!.firstName).toBe("Tutorial");
    expect(saved!.lastName).toBe("Patient");
    expect(patientCard(saved as never).fullName).toBe(RIGHT_NAME);
    const primary = (saved as { insuranceRecord?: { primary?: { subscriberName?: string } } })
      .insuranceRecord?.primary;
    expect(primary?.subscriberName).toBe(RIGHT_NAME);

    await act(async () => root.unmount());
    container.remove();
  });
});
