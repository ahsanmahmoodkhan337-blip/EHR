/**
 * The Tutorial Patient's worked example (`specs/tutorial-patient-prefill.md`).
 *
 * Owner, 2026-11-22: the tutorial chart is the standard a student opens to see
 * what a complete encounter looks like, so its clinical half is seeded once from
 * the patient's own record — the card and the 271 that matches it, the signed
 * note, the codes with their charge, units and place of service, and a decided
 * prior authorisation.
 *
 * These tests read the seeded record itself: the note's status comes from its own
 * `NOTE_SIGNED` event, the card's member ID from the coverage record, the box 23
 * number from `priorAuthForClaim`, and the whole thing again after a JSON round
 * trip, which is what a reload does to it.
 */
import { describe, expect, test } from "bun:test";
import { createEncounter, normalizeEncounter } from "../src/store/pipelineEncounter";
import {
  TUTORIAL_CPT_CODES,
  TUTORIAL_MEMBER_ID,
  TUTORIAL_SEED_VERSION,
  applyTutorialSeed,
  tutorialCardFor,
  tutorialCardPending,
  tutorialEligibilityFor,
  tutorialIcdCodes,
  tutorialNoteFields,
  tutorialSeedPending,
  type TutorialPatientSource,
} from "../src/domain/tutorialEncounter";
import { noteFieldsHaveText, noteSignedAt, noteSignedBy, noteStatus } from "../src/domain/noteStatus";
import { priorAuthForClaim } from "../src/domain/priorAuthNumber";
import { MEDICAL_PROVIDER_PROFILE } from "../src/data/claims/providerProfile";

const AT = "2026-11-22T10:00:00.000Z";

/** The Tutorial Patient as the chart holds it — the demo patient's own data. */
const TUTORIAL: TutorialPatientSource = {
  id: "DEMO",
  mrn: "TUTORIAL-001",
  firstName: "Tutorial",
  lastName: "Patient",
  dateOfBirth: "1971-06-20",
  gender: "Male",
  address: "1 Training Lane, Medford, NY 11763",
  insurance: "Medicare Part B",
  chiefComplaint: "Chest pain and shortness of breath — DEMO",
  vitals: {
    bloodPressure: "145/92",
    heartRate: 92,
    temperature: 99.1,
    respiratoryRate: 20,
    oxygenSaturation: 94,
    recordedAt: "2026-01-01T09:00:00Z",
  },
  problems: ["Hypertension (I10)", "Coronary Artery Disease (I25.10)", "Chest Pain (R07.9)"],
  medications: [
    { name: "Lisinopril", dosage: "10mg", frequency: "Once daily", status: "active" },
    { name: "Atorvastatin", dosage: "40mg", frequency: "Once daily at bedtime", status: "active" },
    { name: "Aspirin", dosage: "81mg", frequency: "Once daily", status: "active" },
  ],
  labResults: [
    { testName: "Cardiac Enzymes (Troponin I)", value: "0.085", referenceRange: "< 0.04", unit: "ng/mL", status: "abnormal" },
  ],
  encounters: [
    {
      date: "2026-07-09",
      provider: "Dr. Demo Instructor, MD",
      diagnosis: "Chest pain (R07.9), Essential hypertension (I10)",
      notes: "Tutorial patient presenting with chest pain and shortness of breath. ECG and cardiac enzymes ordered. Cardiology consult placed.",
    },
  ],
};

function seeded() {
  return applyTutorialSeed(createEncounter("DEMO"), TUTORIAL, AT);
}

describe("the Tutorial Patient's card and its 271", () => {
  test("the card carries a Medicare Part B member ID, so the 271 can succeed", () => {
    expect(tutorialCardPending(TUTORIAL)).toBe(true);
    const card = tutorialCardFor(TUTORIAL);
    expect(card.primary.payerName).toBe("Medicare Part B");
    expect(card.primary.subscriberId).toBe(TUTORIAL_MEMBER_ID);
    expect(card.primary.ediPayerId).toBe("00102");
    expect(card.source).toBe("seed");
    // A card the student filled is never overwritten.
    expect(tutorialCardPending({ ...TUTORIAL, insuranceRecord: { primary: { subscriberId: "STUDENT-1" } } })).toBe(false);
  });

  test("the 271 answers active, naming the member it matched", () => {
    const record = tutorialEligibilityFor(TUTORIAL, AT);
    expect(record.status).toBe("active");
    expect(record.checkedAt).toBe(AT);
    expect(record.payerResponse).toContain(TUTORIAL_MEMBER_ID);
    expect(record.payerResponse).toContain("Medicare Part B");
  });
});

describe("the seeded encounter's clinical half", () => {
  test("the note is filled, signed and locked, with a provider and a timestamp", () => {
    const enc = seeded();
    const fields = tutorialNoteFields(TUTORIAL);
    expect(noteFieldsHaveText(fields)).toBe(true);
    // The vitals the chart holds are in the note's objective.
    expect(fields.objective).toContain("145/92");
    expect(fields.objective).toContain("0.085");
    // The assessment is the coded problem list, the visit's reason first.
    expect(fields.assessment).toContain("R07.9");
    expect(noteStatus(enc)).toBe("signed");
    expect(noteSignedBy(enc)).toBe(MEDICAL_PROVIDER_PROFILE.signatureName);
    expect(noteSignedAt(enc)).toBe(AT);
    expect(enc.noteUpdatedAt).toBe(AT);
    // Signed means read-only, everywhere.
    expect(enc.stage).toBe("scribe");
    // `billed` since the money half landed: the record holds a submitted claim
    // and a posted 835, so the encounter's own status says so.
    expect(enc.status).toBe("billed");
  });

  test("the codes match the note's assessment and carry charge, units and POS 11", () => {
    const enc = seeded();
    const icd = tutorialIcdCodes(TUTORIAL);
    // The visit's reason first (box 21 A), then the chart's own problem order.
    expect(icd).toEqual(["R07.9", "I10", "I25.10"]);
    expect(enc.icdCodes).toEqual(icd);
    expect(enc.cptCodes).toEqual([...TUTORIAL_CPT_CODES]);
    expect(enc.codingLines).toHaveLength(TUTORIAL_CPT_CODES.length);
    for (const line of enc.codingLines) {
      expect(line.placeOfService).toBe("11");
      expect(line.charge).toBeGreaterThan(0);
      expect(line.units).toBe(1);
      expect(line.renderingNpi).toBe(MEDICAL_PROVIDER_PROFILE.npi);
      expect(line.dateOfService).toBe("2026-07-09");
    }
    // Every line points at a diagnosis this encounter actually reported.
    const letters = "ABCDEFGHIJKL";
    for (const line of enc.codingLines) {
      for (const pointer of line.diagnosisPointer) {
        expect(icd[letters.indexOf(pointer)]).toBeTruthy();
      }
    }
  });

  test("the prior authorisation is decided, and covers a code the visit billed", () => {
    const enc = seeded();
    expect(enc.paData.status).toBe("approved");
    expect(enc.paData.paId).toBeTruthy();
    expect(priorAuthForClaim({ paData: enc.paData, cptCodes: enc.cptCodes })).toBe(enc.paData.paId);
  });
});

describe("the seed is written once", () => {
  test("a second open does not overwrite the chart the student worked", () => {
    const first = seeded();
    expect(first.tutorialSeed).toBe(TUTORIAL_SEED_VERSION);
    // The student codes something of their own on the chart.
    const worked = { ...first, icdCodes: ["I10"], cptCodes: ["99213"] };
    const again = applyTutorialSeed(worked, TUTORIAL, "2026-12-01T00:00:00.000Z");
    expect(again).toBe(worked);
    expect(again.icdCodes).toEqual(["I10"]);
    expect(again.cptCodes).toEqual(["99213"]);
  });

  test("a chart with work but no seed key is never filled either", () => {
    const worked = { ...createEncounter("DEMO"), scribeNote: "the student's own note" };
    expect(tutorialSeedPending(worked)).toBe(false);
  });

  test("nothing is written for any other patient", () => {
    const other = createEncounter("P-2026-0001");
    expect(applyTutorialSeed(other, { ...TUTORIAL, id: "P-2026-0001" }, AT)).toBe(other);
  });
});

describe("read back from storage", () => {
  test("the record still holds the signed note, the codes and the authorisation", () => {
    const stored = JSON.parse(JSON.stringify(seeded()));
    const read = normalizeEncounter(stored, "DEMO");
    expect(read.tutorialSeed).toBe(TUTORIAL_SEED_VERSION);
    expect(noteStatus(read)).toBe("signed");
    expect(read.icdCodes).toEqual(["R07.9", "I10", "I25.10"]);
    expect(read.cptCodes).toEqual([...TUTORIAL_CPT_CODES]);
    expect(read.codingLines[0].charge).toBeGreaterThan(0);
    expect(read.paData.status).toBe("approved");
  });

  test("a record saved before the seed existed reads as never seeded", () => {
    const old = { ...createEncounter("DEMO") } as Record<string, unknown>;
    delete old.tutorialSeed;
    expect(normalizeEncounter(old, "DEMO").tutorialSeed).toBeNull();
    expect(tutorialSeedPending(normalizeEncounter(old, "DEMO"))).toBe(true);
  });
});
