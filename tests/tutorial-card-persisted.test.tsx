/**
 * The Tutorial Patient's insurance card and its 271 survive the open.
 *
 * Owner report, 2026-11-23 (production, `990c21b`): the Front Desk card printed
 * "SUBSCRIBER ID / GROUP NUMBER / PAYER ID — Not on file" and the 271 printed
 * "Member ID: Not on file" for the standard reference chart. The seed writes the
 * card and the 271 into the chart store (`updatePatientInsurance`,
 * `recordEligibility`), and the chart store persists through its own
 * `hh_ehr_ls_<phone>` envelope — so this test opens the chart the way a student
 * does (a signed-in phone, a saved record, the store's own `selectPatient`),
 * lets the save run, and reads the saved envelope back.
 *
 * Inspiration: Epic's Playground patient — the demo chart is filled the moment it
 * is opened, and still filled after a reload.
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
const { TUTORIAL_MEMBER_ID, TUTORIAL_PATIENT_ID } = await import(
  "../src/domain/tutorialEncounter"
);
const { patientCard, NOT_ON_FILE } = await import("../src/domain/patientCard");

const PHONE = "+920000000099";
/** Medicare Part B's EDI payer ID — what the card's PAYER ID box prints. */
const MEDICARE_PART_B_EDI_ID = "00102";

/** The chart store's own persisted key for this student. */
const ENVELOPE_KEY = `hh_ehr_ls_${PHONE}`;

let pipeline: ReturnType<typeof usePipeline> | null = null;

function Probe() {
  pipeline = usePipeline();
  return null;
}

function savedEnvelope(): {
  user?: { patients?: Record<string, unknown>[] };
} | null {
  const raw = win.localStorage.getItem(ENVELOPE_KEY);
  return raw ? JSON.parse(raw) : null;
}

/** The Tutorial Patient as the saved record holds them. */
function savedTutorialPatient(): Record<string, unknown> | undefined {
  const patients = (savedEnvelope()?.user?.patients ?? []) as Record<string, unknown>[];
  return patients.find((p) => p.id === TUTORIAL_PATIENT_ID);
}

async function settle(ms: number) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

beforeEach(() => {
  // Drop the previous test's in-memory record first, so its save cannot land on
  // this test's storage.
  useEhrStore.getState().unload();
  win.localStorage.clear();
  win.localStorage.setItem("hh_logged_in_phone", PHONE);
  // A student who has signed in before: a saved chart with no patients in it —
  // the record production was reading when the card printed "Not on file".
  win.localStorage.setItem(
    ENVELOPE_KEY,
    JSON.stringify({
      app: "healthcare-hustlers-ehr",
      schemaVersion: 6,
      updatedAt: new Date(Date.now() - 60_000).toISOString(),
      phone: PHONE,
      user: { patients: [] },
    }),
  );
  useEhrStore.getState().registerSeedPatients(SEED_PATIENTS);
  // Boot: the app loads this student's saved record before the first screen.
  bootstrapEhrStore(PHONE);
  pipeline = null;
});

describe("the Tutorial Patient's card and 271", () => {
  test("are in the saved record after the chart is opened", async () => {
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
    // Let both debounced saves run (chart store 300 ms, encounter store 400 ms).
    await settle(900);

    // ── The card, read off the record the way the Front Desk card reads it ──
    const saved = savedTutorialPatient();
    expect(saved).toBeTruthy();
    const card = patientCard(saved as never);
    expect(card.memberId).not.toBe(NOT_ON_FILE);
    expect(card.memberId).toBe(TUTORIAL_MEMBER_ID);
    expect(card.payerId).not.toBe(NOT_ON_FILE);
    expect(card.payerId).toBe(MEDICARE_PART_B_EDI_ID);
    expect(card.payerName).toBe("Medicare Part B");

    // ── The 271, read off the same record the eligibility screen prints ──
    const primary = (
      saved as {
        insuranceRecord?: {
          primary?: { eligibility?: { status?: string; payerResponse?: string } };
        };
      }
    ).insuranceRecord?.primary;
    expect(primary?.eligibility?.status).toBe("active");
    expect(primary?.eligibility?.payerResponse).toContain(TUTORIAL_MEMBER_ID);
    expect(primary?.eligibility?.payerResponse).not.toContain("no member ID");

    await act(async () => root.unmount());
    container.remove();
  });

  /**
   * The returning student: the worked example is already on the encounter
   * (clinical and money halves both written) but the chart store's saved record
   * holds no patient — the state production was reading when the card printed
   * "Not on file". Opening the chart must fill the card and the 271 anyway.
   */
  test("are filled on a chart whose example is already seeded", async () => {
    // A record saved by an earlier visit: the example on the encounter, nothing
    // in the chart store's patient list.
    win.localStorage.setItem(
      "hh_userdata_" + PHONE,
      JSON.stringify({
        v: 1,
        updatedAt: new Date().toISOString(),
        pipeline: {
          encounters: {
            DEMO: {
              patientId: TUTORIAL_PATIENT_ID,
              tutorialSeed: "tutorial-2",
              claimNumber: "CLM-000001",
            },
          },
        },
      }),
    );

    const container = win.document.createElement("div");
    win.document.body.appendChild(container);
    const root = createRoot(container as unknown as HTMLElement);
    await act(async () => {
      root.render(React.createElement(PipelineProvider, null, React.createElement(Probe)));
    });
    await settle(40);
    await act(async () => {
      pipeline?.selectPatient(TUTORIAL_PATIENT_ID);
    });
    await settle(900);

    const saved = savedTutorialPatient();
    expect(saved).toBeTruthy();
    const card = patientCard(saved as never);
    expect(card.memberId).toBe(TUTORIAL_MEMBER_ID);
    expect(card.payerId).toBe(MEDICARE_PART_B_EDI_ID);
    const primary = (
      saved as { insuranceRecord?: { primary?: { eligibility?: { status?: string } } } }
    ).insuranceRecord?.primary;
    expect(primary?.eligibility?.status).toBe("active");

    await act(async () => root.unmount());
    container.remove();
  });
});
