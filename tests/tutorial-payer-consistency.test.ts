/**
 * One payer, named right — the Tutorial Patient's standard chart
 * (`specs/tutorial-payer-consistency.md`, second half).
 *
 * A payer is one fact: the 271, the 835 header and plan row, and the AR row must
 * all name the party the card and the banner name — **Medicare Part B** — and
 * the 835 must carry the same EDI payer id the claim's paper carries (`00102`).
 * A denial sentence names the party whose rule it is: *the payer's* same-day
 * edit, never "the plan's".
 *
 * The chart is built the way a student's open builds it (clinical seed, then the
 * money seed) and read back through a JSON round trip, which is what a reload
 * does. The last test reads the source itself, so the sentence cannot come back
 * on a screen this file does not mount.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createEncounter, normalizeEncounter } from "../src/store/pipelineEncounter";
import type { Patient } from "../src/store/patientStore";
import { applyTutorialSeed, tutorialCardFor, type TutorialPatientSource } from "../src/domain/tutorialEncounter";
import { applyTutorialMoneySeed } from "../src/domain/tutorialClaim";
import { eligibility271 } from "../src/domain/eligibility";
import { buildArWorkQueue } from "../src/domain/arWorkQueue";
import { submitReferenceClaim } from "./support/referenceSubmit";

const AT = "2026-11-22T10:00:00.000Z";
const NOW = "2026-11-22T12:00:00.000Z";

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
  vitals: { bloodPressure: "145/92", heartRate: 92, temperature: 99.1, respiratoryRate: 20, oxygenSaturation: 94 },
  problems: ["Hypertension (I10)", "Coronary Artery Disease (I25.10)", "Chest Pain (R07.9)"],
  medications: [{ name: "Lisinopril", dosage: "10mg", frequency: "Once daily", status: "active" }],
  encounters: [
    {
      date: "2026-07-09",
      provider: "Dr. Demo Instructor, MD",
      diagnosis: "Chest pain (R07.9), Essential hypertension (I10)",
      notes: "Chest pain and shortness of breath. ECG and cardiac enzymes ordered.",
    },
  ],
};

/** The chart as the store holds it once registration has written the card. */
const PATIENT = {
  ...TUTORIAL,
  insuranceRecord: tutorialCardFor(TUTORIAL),
} as unknown as Patient;

/** The seeded record as a reload reads it: JSON round trip, then normalised. */
function seededRecord() {
  const clinical = applyTutorialSeed(createEncounter("DEMO"), TUTORIAL, AT);
  const seeded = applyTutorialMoneySeed(clinical, PATIENT, AT, "CLM-000001");
  return normalizeEncounter(JSON.parse(JSON.stringify(seeded)), "DEMO");
}

/**
 * The record after the student's own Submit — the claim opens filled and
 * unsent, and the 835 the payer sends back exists only because the student
 * pressed Submit on the Billing stage (owner, 2026-11-23).
 */
function submittedRecord() {
  const draft = seededRecord();
  // The draft is what the chart opens: nothing sent, priced or posted yet.
  expect(draft.claimStatus).toBe("draft");
  expect(draft.remittances).toHaveLength(0);
  const submitted = submitReferenceClaim(draft, PATIENT, AT);
  return normalizeEncounter(JSON.parse(JSON.stringify(submitted)), "DEMO");
}

describe("the 271 answers the card's own payer", () => {
  test("names Medicare Part B and never another product", () => {
    const benefits = eligibility271(tutorialCardFor(TUTORIAL).primary);
    expect(benefits.planName).toBe("Medicare Part B");
    expect(benefits.source).toContain("Medicare Part B");
    expect(`${benefits.planName ?? ""} ${benefits.source}`).not.toContain("Meridian");
  });
});

describe("the 835 names the same payer as the paper", () => {
  test("the header and the plan row both read Medicare Part B", () => {
    const remittance = submittedRecord().remittances[0];
    expect(remittance.payerName).toBe("Medicare Part B");
    expect(remittance.planName).toBe("Medicare Part B");
    // The internal plan key may exist for traceability; it is never the name printed.
    expect(remittance.planName ?? "").not.toContain("PLAN-");
  });

  test("the payer id is the one the claim's box carries", () => {
    const enc = submittedRecord();
    expect(enc.claimForm?.payerEdiId).toBe("00102");
    expect(enc.remittances[0].payerId).toBe("00102");
    expect(enc.remittances[0].payerId).toBe(enc.claimForm?.payerEdiId);
  });
});

describe("the AR row names the same payer", () => {
  test("the posted CO-236 denial is Medicare Part B's", () => {
    const enc = submittedRecord();
    const items = buildArWorkQueue(
      [
        {
          patientId: enc.patientId,
          patientName: enc.displayName,
          claimNumber: enc.claimNumber,
          remittances: enc.remittances,
          ledger: enc.ledger,
          arItems: enc.arItems,
        },
      ],
      NOW,
    );
    const denial = items.find((item) => item.kind === "denial");
    expect(denial).toBeDefined();
    expect(denial?.payerName).toBe("Medicare Part B");
    expect(denial?.payerName).not.toContain("Meridian");
  });
});

describe("no sentence calls the same-day edit the plan's", () => {
  test("the seeded chart's own denial text names the payer", () => {
    const enc = submittedRecord();
    const remittance = enc.remittances[0];
    const denied = remittance.lines.find((line) => line.denied);
    expect(denied?.explanation).toContain("payer");
    const sentences = [
      ...remittance.lines.map((line) => line.explanation ?? ""),
      enc.denialInfo?.reason ?? "",
    ].join("\n");
    expect(sentences.toLowerCase()).not.toContain("the plan's same-day edit");
    expect(sentences.toLowerCase()).not.toContain("plan's own same-day edit");
  });

  test("the phrase is nowhere in the source either", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry)) continue;
        if (/plan['’]s (own )?same-day/i.test(readFileSync(full, "utf8"))) offenders.push(full);
      }
    };
    walk(join(import.meta.dir, "..", "src"));
    expect(offenders).toEqual([]);
  });
});
