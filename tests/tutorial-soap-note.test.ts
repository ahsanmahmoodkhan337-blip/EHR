/**
 * The Tutorial Patient's progress note — the worked example's own text.
 *
 * Owner, 2026-11-23: the example note read as "just random words". It is the one
 * chart a student copies the shape of a real visit from, so this test reads the
 * note the way the Progress Note screen does — the seeded record's four sections
 * compiled into the one text a read-only screen prints (`noteTextOf`) — and
 * checks that the visit it describes is a cardiology visit whose figures, codes
 * and date agree with the rest of the chart. Spec:
 * `specs/tutorial-soap-note-rewrite.md`.
 */
import { describe, expect, test } from "bun:test";
import { createEncounter } from "../src/store/pipelineEncounter";
import { applyTutorialSeed, tutorialNoteFields } from "../src/domain/tutorialEncounter";
import { noteStatus, noteTextOf } from "../src/domain/noteStatus";

const AT = "2026-11-23T10:00:00.000Z";
const { SEED_PATIENTS } = await import("../src/store/patientStore");

/** The Tutorial Patient exactly as the store seeds it — not a hand-written copy. */
const chart = SEED_PATIENTS.find((patient) => patient.id === "DEMO")!;

function noteText(): string {
  const enc = applyTutorialSeed(createEncounter("DEMO"), chart, AT);
  return noteTextOf(enc);
}

describe("the Tutorial Patient's progress note", () => {
  test("reads as a cardiology visit, not filler", () => {
    const note = noteText();
    // Subjective: the complaint, then an HPI in the order a clinician asks.
    expect(note).toContain(
      "55-year-old man with hypertension and known coronary artery disease presents with two hours of chest pressure.",
    );
    expect(note).toContain("HPI: Onset — sudden, about two hours before this visit");
    expect(note).toContain("Radiation — to the left arm");
    expect(note).toContain("Reports he has missed doses of lisinopril over the past week.");
    expect(note).toContain("ROS: Constitutional — diaphoresis");
    expect(note).toContain("PMH: Essential hypertension (I10). Coronary artery disease (I25.10).");
    expect(note).toContain("Allergies: penicillin — anaphylaxis");
    // Objective: the chart's own vitals, an exam that matches the presentation,
    // the ECG the visit billed and the labs the chart holds.
    expect(note).toContain("Vitals: BP 145/92 mmHg, HR 92 bpm and regular, RR 20/min, temperature 99.1 °F, SpO2 94% on room air.");
    expect(note).toContain("General: anxious and diaphoretic, in moderate distress");
    expect(note).toContain("ECG: 12-lead, performed and interpreted in the office today");
    expect(note).toContain("Labs: troponin I 0.085 ng/mL (reference <0.04) — abnormal");
    // Plan: the work, the code it bills, and the follow-up.
    expect(note).toContain("1. ECG: 12-lead ECG with interpretation and report performed in the office today — CPT 93000.");
    expect(note).toContain("aspirin 325 mg chewed once now");
    expect(note).toContain("7. Follow-up: cardiology per the referral");
  });

  test("numbers its diagnoses in the order the codes are reported", () => {
    const note = noteText();
    const r079 = note.indexOf("1. Chest pain, suspected unstable angina");
    const i10 = note.indexOf("2. Essential hypertension, uncontrolled — I10.");
    const i2510 = note.indexOf("3. Coronary artery disease — I25.10.");
    expect(r079).toBeGreaterThan(-1);
    expect(i10).toBeGreaterThan(r079);
    expect(i2510).toBeGreaterThan(i10);
  });

  test("carries no demo tag, no uncoded diagnosis, no study the chart does not hold", () => {
    const note = noteText();
    expect(note).not.toContain("DEMO");
    // R73.09 is not on the problem list and not coded, so it is not in the note.
    expect(note).not.toContain("R73.09");
    // No imaging record exists on this chart, so no chest X-ray is reported.
    expect(note.toLowerCase()).not.toContain("x-ray");
    // No self-referential filler.
    expect(note).not.toContain("the chart holds the result above");
    expect(note).not.toContain("as recorded in the visit note");
    expect(note).not.toContain("reason for today's visit");
    // The exam agrees with the patient in front of the provider.
    expect(note).not.toContain("alert, in no acute distress");
  });

  test("names the day the banner shows, and stays signed", () => {
    // The chart's own visit is the day the banner prints, so the note, box 24A
    // and the banner cannot disagree.
    expect(chart.encounters[0].date).toBe("2026-11-23");
    expect(chart.vitals.recordedAt.slice(0, 10)).toBe("2026-11-23");
    for (const lab of chart.labResults) expect(lab.date).toBe("2026-11-23");
    const enc = applyTutorialSeed(createEncounter("DEMO"), chart, AT);
    for (const line of enc.codingLines) expect(line.dateOfService).toBe("2026-11-23");
    // Seeding the text does not change how the note is signed.
    expect(noteStatus(enc)).toBe("signed");
  });

  test("every other chart keeps its own derived note", () => {
    const other = SEED_PATIENTS.find((patient) => patient.id !== "DEMO")!;
    const fields = tutorialNoteFields(other);
    // Another patient's chart is never handed the Tutorial Patient's text.
    expect(fields.subjective).not.toContain("55-year-old man with hypertension");
    expect(fields.assessment).not.toContain("R07.9. Two hours of exertional");
  });
});
