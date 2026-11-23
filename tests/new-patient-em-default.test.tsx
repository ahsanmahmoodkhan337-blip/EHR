/**
 * new-patient-em-default.test.tsx — Coding opens a first visit on a new-patient
 * E/M code, and says why.
 *
 * Owner's work order, phase 2 (`specs/tutorial-dead-buttons.md` §2): a patient
 * with no earlier signed visit is a **new patient**, so the E/M picker opens on
 * 99202–99205 rather than the established-patient default 99212–99215. The
 * choice is shown with its provenance (the chart's own record of an earlier
 * signed visit, or the student's own change) and the student is free to change
 * it — a default is a starting value, never an auto-pick (STANDING-RULES 6).
 *
 * What is walked here:
 *  1. `domain/emDefault.ts` — the pure rule, and the two facts it reads;
 *  2. the rendered Coding stage for a booked patient with no earlier visit: the
 *     picker is on "new", the recommended code is a new-patient code with its
 *     level named, and the line under the picker says where that came from;
 *  3. the same screen for a patient whose chart already records a visit: the
 *     established-patient default is unchanged;
 *  4. the student changing the picker: the recommended code follows, and the
 *     line says the value is his.
 *
 * Inspiration: Epic's coding worksheet — the level the encounter's record
 * supports is open when the coder arrives, and the coder may change it.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

const win = new Window({ url: "http://localhost/encounter/PAT-NEW/coding" });
const globals = globalThis as unknown as Record<string, unknown>;
globals.window = win;
globals.document = win.document;
globals.navigator = win.navigator;
globals.HTMLElement = win.HTMLElement;
globals.HTMLInputElement = win.HTMLInputElement;
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

const PHONE = "+920000000031";
win.localStorage.setItem("hh_logged_in_phone", PHONE);
win.localStorage.setItem("hh_approved_phones", JSON.stringify([PHONE]));

const React = (await import("react")).default;
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { RouterProvider, createRouter, createMemoryHistory } = await import("@tanstack/react-router");
const { routeTree } = await import("../src/routeTree.gen");
const { useEhrStore } = await import("../src/store/ehrStore");
const { saveUserData } = await import("../src/store/persistence");
const { createEncounter, encounterKey } = await import("../src/store/pipelineEncounter");
const { signNote } = await import("../src/domain/signNote");
const { defaultEmPatientType, emPatientTypeProvenance, isFirstVisit } = await import(
  "../src/domain/emDefault"
);

// ─── The pure rule ────────────────────────────────────────────────

describe("a first visit is a chart with no earlier signed encounter", () => {
  test("no visit on the chart and no earlier signature is a first visit", () => {
    expect(isFirstVisit({ chartVisits: 0, priorSignedEncounters: 0 })).toBe(true);
  });

  test("a visit already on the chart is not a first visit", () => {
    expect(isFirstVisit({ chartVisits: 1, priorSignedEncounters: 0 })).toBe(false);
  });

  test("an earlier signed encounter is not a first visit, even with an empty chart", () => {
    expect(isFirstVisit({ chartVisits: 0, priorSignedEncounters: 1 })).toBe(false);
  });

  test("the picker's default is a new-patient code only on a first visit", () => {
    expect(defaultEmPatientType(true)).toBe("new");
    expect(defaultEmPatientType(false)).toBe("established");
  });

  test("the provenance line names the chart, and the student's own change", () => {
    expect(emPatientTypeProvenance("new", false)).toContain("Chart");
    expect(emPatientTypeProvenance("new", false)).toContain("no prior signed encounter");
    expect(emPatientTypeProvenance("established", false)).toContain("prior signed encounter");
    expect(emPatientTypeProvenance("new", true)).toContain("Typed");
  });
});

// ─── The rendered stage ───────────────────────────────────────────

/** A patient the practice has never seen: no visit on the chart. */
const NEW_PATIENT = {
  id: "PAT-NEW",
  mrn: "HH-900001",
  firstName: "Nadia",
  lastName: "Rahman",
  dateOfBirth: "1996-02-11",
  age: 30,
  gender: "Female",
  phone: "03000000031",
  email: "",
  address: "",
  emergencyContact: { name: "", phone: "", relation: "" },
  primaryCareProvider: "",
  insurance: "",
  chiefComplaint: "",
  vitals: {
    bloodPressure: "",
    heartRate: 0,
    temperature: 0,
    respiratoryRate: 0,
    oxygenSaturation: 0,
    recordedAt: "2026-11-23T09:00:00.000Z",
  },
  medications: [],
  allergies: [],
  labResults: [],
  encounters: [],
  problems: [],
  isSeed: true,
};

/** A patient whose chart already records a visit. */
const RETURNING_PATIENT = {
  ...NEW_PATIENT,
  id: "PAT-RETURN",
  mrn: "HH-900002",
  firstName: "Omar",
  lastName: "Farooq",
  encounters: [
    {
      id: "enc-r1",
      date: "2026-06-02",
      type: "Office Visit — Follow Up",
      provider: "Dr. Sarah Chen, MD",
      diagnosis: "Essential hypertension (I10)",
      notes: "Blood pressure reviewed. Continue lisinopril.",
      department: "Internal Medicine",
    },
  ],
};

/** The encounter for a patient whose note has been signed — Coding is open. */
function chartedEncounter(patientId: string) {
  return signNote(createEncounter(patientId), {
    note: "S: cough. O: wheeze. A: asthma exacerbation. P: inhaler.",
    by: PHONE,
    at: "2026-11-23T10:00:00.000Z",
  });
}

async function openCoding(patientId: string) {
  saveUserData(PHONE, {
    pipeline: {
      activePatientId: patientId,
      encounters: { [encounterKey(patientId)]: chartedEncounter(patientId) },
      demoFillMissingBoxes: false,
      currentRole: "coder",
    },
    currentRole: "coder",
  });
  const router = createRouter({
    routeTree: routeTree as never,
    history: createMemoryHistory({ initialEntries: [`/encounter/${patientId}/coding`] }),
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

function picker(container: HTMLElement): HTMLSelectElement {
  const el = container.querySelector("#em-patient-type");
  expect(el).not.toBeNull();
  return el as unknown as HTMLSelectElement;
}

function provenance(container: HTMLElement): string {
  return (container.querySelector("#em-patient-type-provenance")?.textContent ?? "").trim();
}

function recommendedCode(container: HTMLElement): string {
  const line = [...container.querySelectorAll("p")].find(
    (p) => (p.textContent ?? "").trim() === "Recommended Code",
  );
  expect(line).not.toBeUndefined();
  const code = line!.nextElementSibling;
  return (code?.textContent ?? "").trim();
}

function recommendedName(container: HTMLElement): string {
  const line = [...container.querySelectorAll("p")].find(
    (p) => (p.textContent ?? "").trim() === "Recommended Code",
  );
  return (line!.nextElementSibling?.nextElementSibling?.textContent ?? "").trim();
}

beforeEach(() => {
  win.localStorage.setItem("hh_logged_in_phone", PHONE);
  win.localStorage.setItem("hh_approved_phones", JSON.stringify([PHONE]));
  useEhrStore.getState().registerSeedPatients([NEW_PATIENT, RETURNING_PATIENT] as never);
});

describe("Coding opens on the right patient type", () => {
  test("a first visit opens on a new-patient code, and the screen says why", async () => {
    const screen = await openCoding("PAT-NEW");

    expect(picker(screen.container).value).toBe("new");
    // 99202–99205, with its level named.
    expect(recommendedCode(screen.container)).toMatch(/^9920[2-5]$/);
    expect(recommendedName(screen.container)).toContain("New Patient");
    expect(provenance(screen.container)).toContain("no prior signed encounter");

    await screen.unmount();
  }, 90000);

  test("a patient with an earlier visit keeps the established-patient default", async () => {
    const screen = await openCoding("PAT-RETURN");

    expect(picker(screen.container).value).toBe("established");
    expect(recommendedCode(screen.container)).toMatch(/^9921[2-5]$/);
    expect(provenance(screen.container)).toContain("prior signed encounter");

    await screen.unmount();
  }, 90000);

  test("the student can change it, and the line says the choice is his", async () => {
    const screen = await openCoding("PAT-NEW");
    const select = picker(screen.container);

    await act(async () => {
      select.value = "established";
      select.dispatchEvent(new win.Event("change", { bubbles: true }) as never);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(picker(screen.container).value).toBe("established");
    expect(recommendedCode(screen.container)).toMatch(/^9921[2-5]$/);
    expect(provenance(screen.container)).toContain("Typed");

    await screen.unmount();
  }, 90000);
});
