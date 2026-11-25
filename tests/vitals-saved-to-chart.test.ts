import { describe, expect, test } from "bun:test";
import {
  EMPTY_VITALS_FORM,
  editableFromVitals,
  formFromVitals,
  latestVitals,
  missingCoreVitals,
  vitalsFromForm,
} from "../src/domain/vitalsRecord";
import { normalizeEncounter } from "../src/store/pipelineEncounter";

const FILLED = { ...EMPTY_VITALS_FORM, systolic: "142", diastolic: "91", heartRate: "78", temperatureF: "98.4", respiratoryRate: "16", oxygenSaturation: "97" };

describe("saved vitals become part of the chart", () => {
  test("the form opens empty — no made-up 120/80 or 98.6", () => {
    expect(Object.values(EMPTY_VITALS_FORM).every((v) => v === "")).toBe(true);
    expect(missingCoreVitals(EMPTY_VITALS_FORM)).toHaveLength(6);
  });

  test("Save waits for every core vital and names what is missing", () => {
    const partial = { ...FILLED, oxygenSaturation: "" };
    expect(missingCoreVitals(partial)).toEqual(["SpO2"]);
    expect(vitalsFromForm(partial, "2026-11-26T09:00:00.000Z", "me")).toBeNull();
  });

  test("a saved set keeps what was entered, and optional boxes only when filled", () => {
    const v = vitalsFromForm({ ...FILLED, weightKg: "68.5" }, "2026-11-26T09:00:00.000Z", "me")!;
    expect(v).toMatchObject({ systolic: 142, diastolic: 91, heartRate: 78, temperatureF: 98.4, weightKg: 68.5 });
    expect("heightCm" in v).toBe(false);
    expect(editableFromVitals(v)).toEqual({ bloodPressure: "142/91", heartRate: "78", temperature: "98.4", respiratoryRate: "16", oxygenSaturation: "97" });
    expect(formFromVitals(v).systolic).toBe("142");
  });

  test("the latest set is the newest by time", () => {
    const a = vitalsFromForm(FILLED, "2026-11-26T09:00:00.000Z", "me")!;
    const b = vitalsFromForm({ ...FILLED, systolic: "130" }, "2026-11-26T10:00:00.000Z", "me")!;
    expect(latestVitals([b, a])!.systolic).toBe(130);
    expect(latestVitals([])).toBeNull();
  });

  test("the flowsheet survives a save and a reload; an old record loads with none", () => {
    const v = vitalsFromForm(FILLED, "2026-11-26T09:00:00.000Z", "me")!;
    const reloaded = normalizeEncounter(JSON.parse(JSON.stringify({ patientId: "P1", vitals: [v, { junk: true }] })), "P1");
    expect(reloaded.vitals).toEqual([v]);
    expect(normalizeEncounter({ patientId: "P1" }, "P1").vitals).toEqual([]);
  });
});
