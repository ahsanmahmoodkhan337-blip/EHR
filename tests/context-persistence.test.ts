/**
 * Patient, encounter and track context survive navigation and a reload
 *
 * Owner's audit, 2026-11-20, item 4: "patient and track context persist across
 * navigation and reload." Opening /coding, /claims, /payments or /denials-ar
 * directly must show the same patient in the banner and the same encounter, and a
 * refresh or a Back must never drop a working student to the Tutorial Patient —
 * who is simply the first patient in the list.
 *
 * These are source assertions on the one place each rule lives, in the style of
 * the other tests in this folder: the store is the source of truth, the pages
 * read it, and nothing here writes a patient of its own.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const RAIL_PAGES = [
  ["src/routes/coding.tsx", "coding"],
  ["src/routes/claims.tsx", "claims"],
  ["src/routes/payments.tsx", "payments"],
  ["src/routes/denials-ar.tsx", "denials-ar"],
] as const;

describe("the banner on a money-cycle page is the encounter's own patient", () => {
  test("the shared banner reads the pipeline's active patient and never picks one", () => {
    const source = read("src/components/shell/ActivePatientBanner.tsx");
    expect(source).toContain("usePipeline()");
    expect(source).toContain("activePatientId");
    expect(source).toContain("getPatientById");
    expect(source).toContain("<PatientBanner patient={banner} />");
    // Reading only: no patient is selected and no encounter is created by opening
    // a list page (spec `encounter-continuity.md` item 6).
    expect(source).not.toContain("selectPatient");
    expect(source).not.toContain("resetEncounter");
    expect(source).not.toContain("setStore");
  });

  for (const [path, navId] of RAIL_PAGES) {
    test(`${path} draws that banner and names the same patient to the header`, () => {
      const source = read(path);
      expect(source).toContain('import { ActivePatientBanner } from "../components/shell/ActivePatientBanner";');
      expect(source).toContain("activePatientId");
      expect(source).toContain("banner={<ActivePatientBanner />}");
      expect(source).toContain("selectedPatientId={activePatientId ?? undefined}");
      expect(source).toContain(`activeNav="${navId}"`);
      // The track comes from the one persisted key, so the header does not flip.
      expect(source).toContain("track={readActiveTrack()}");
      // Still the pipeline store's encounters — the same encounter the chart has.
      expect(source).toContain("usePipeline()");
    });
  }
});

describe("Home reopens the patient the encounter store still has open", () => {
  const source = read("src/routes/index.tsx");
  const initializer = source.slice(
    source.indexOf("const [selectedPatientId, setSelectedPatientId] = useState(() => {"),
    source.indexOf("const [showRightPanel, setShowRightPanel] = useState(true);"),
  );

  test("an address still wins, then the tab's patient, then the stored one", () => {
    expect(initializer).toContain("encounterIdFromRoute");
    expect(initializer).toContain('sessionStorage.getItem("hh_selected_patient")');
    expect(initializer).toContain("activePatientId");
    // The remembered patient is preferred to the list's first entry.
    expect(initializer.indexOf("activePatientId")).toBeLessThan(initializer.indexOf("patients[0]"));
    // The list is only the last resort.
    expect(initializer).toContain("return remembered || patients[0]?.id");
  });

  test("the pipeline is read before the patient is chosen, so the pick can use it", () => {
    const pipelineAt = source.indexOf("state: pipelineState } = usePipeline();");
    const chooseAt = source.indexOf("const [selectedPatientId, setSelectedPatientId] = useState(");
    expect(pipelineAt).toBeGreaterThan(-1);
    expect(chooseAt).toBeGreaterThan(-1);
    expect(pipelineAt).toBeLessThan(chooseAt);
  });

  test("the tab's patient is written back, so a reload reopens it", () => {
    expect(source).toContain('sessionStorage.setItem("hh_selected_patient", selectedPatientId)');
  });
});

describe("choosing a patient makes them the one active patient", () => {
  const store = read("src/store/pipelineStore.tsx");

  test("the store writes the pick through, before the next page reads it", () => {
    expect(store).toContain("export function rememberActivePatient(patientId: string | null): void {");
    const pick = store.slice(
      store.indexOf("export function rememberActivePatient"),
      store.indexOf("// ─── Provider"),
    );
    // The one field the pick changes is saved straight away.
    expect(pick).toContain("saveUserData(phone, { pipeline: { ...saved, activePatientId: patientId } })");
    expect(pick).toContain("loadUserData(phone)");
    // A pick is not a note, a code, a claim or money.
    expect(pick).not.toContain("createEncounter");
    expect(pick).not.toContain("ledger");
    // The provider's own selectPatient writes through too, so every screen that
    // picks a patient agrees with the pages that read the banner.
    expect(store).toContain("rememberActivePatient(patientId);");
  });

  test("the Patients directory sets the pick before it navigates", () => {
    const source = read("src/routes/patients.tsx");
    expect(source).toContain('import { rememberActivePatient } from "../store/pipelineStore";');
    const open = source.slice(source.indexOf("const openPatient = (patientId: string) => {"));
    expect(open.indexOf("rememberActivePatient(patientId);")).toBeLessThan(open.indexOf("void navigate("));
  });

  test("a chart opened by its own address becomes the active patient", () => {
    const source = read("src/routes/patients.$id.tsx");
    expect(source).toContain("selectPatient");
    expect(source).toContain("activePatientId");
    const effect = source.slice(source.indexOf("useEffect(() => {"), source.indexOf("const copayUsd"));
    expect(effect).toContain("if (activePatientId === id) return;");
    expect(effect).toContain("selectPatient(id);");
  });
});

describe("the empty-state Create Appointment button behind the dialog is disabled", () => {
  const source = read("src/components/TabsEpic/DailySchedule.tsx");
  const button = source.slice(
    source.indexOf("Create an appointment for this date"),
    source.indexOf("Create Appointment\n                </button>"),
  );

  test("it is a real disabled button while the New Appointment dialog is open", () => {
    expect(source).toContain("disabled={showModal}");
    expect(source).toContain("disabled:cursor-not-allowed");
    expect(source).toContain('type="button"');
    expect(source).toContain('aria-label="Create an appointment for this date"');
    // A disabled control still states why in its tooltip.
    expect(button.length).toBeGreaterThan(0);
    expect(source).toContain("The New Appointment form is already open");
  });
});
