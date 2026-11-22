/**
 * The Tutorial Patient's money half (`specs/tutorial-patient-prefill.md` §B).
 *
 * Owner, 2026-11-22: the tutorial chart is the standard a student opens to see
 * what a complete encounter looks like — *"all data filled from start to end"*.
 * The clinical half is `tests/tutorial-encounter-seed.test.ts`; this file reads
 * the record back after the seed and asks the money stages whether they are
 * really there:
 *
 *   - the claim was **submitted**: its number exists, the timeline carries the
 *     837P and a 277CA **A1 accepted**, and box 23 carries the PA number;
 *   - the 835 was **posted**: one remittance with `postedAt`, every line
 *     balancing, and charge / insurance-payment / adjustment entries on the
 *     ledger;
 *   - **one line is denied**, and the AR queue derived from that same record
 *     shows it with its age, bucket and appeal deadline.
 *
 * Nothing here reads a screen or a constant: the queue is built from the saved
 * record by the same pure module the app uses, which is what a reload does.
 */
import { describe, expect, test } from "bun:test";
import { createEncounter, normalizeEncounter } from "../src/store/pipelineEncounter";
import type { Patient } from "../src/store/patientStore";
import {
  TUTORIAL_MEMBER_ID,
  TUTORIAL_PA_ID,
  TUTORIAL_SEED_VERSION,
  applyTutorialSeed,
  tutorialCardFor,
  type TutorialPatientSource,
} from "../src/domain/tutorialEncounter";
import { applyTutorialMoneySeed } from "../src/domain/tutorialClaim";
import { remittanceBalances } from "../src/domain/adjudication";
import { buildArWorkQueue, appealDeadlineFor, agingBucketFor, daysBetween } from "../src/domain/arWorkQueue";
import { ledgerBalance, ledgerEntriesForClaim } from "../src/domain/ledger";
import { isLuhnValidNpi } from "../src/data/claims/renderingProviders";

const AT = "2026-11-22T10:00:00.000Z";
const NOW = "2026-11-22T12:00:00.000Z";

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

/** The seeded record, as a reload reads it: JSON round trip, then normalised. */
function seededRecord() {
  // The two halves the store writes on one open: the clinical half, then the
  // money half onto it (`seedTutorialEncounter` → `seedTutorialClaim`).
  const clinical = applyTutorialSeed(createEncounter("DEMO"), TUTORIAL, AT);
  const seeded = applyTutorialMoneySeed(clinical, PATIENT, AT, "CLM-000001");
  return normalizeEncounter(JSON.parse(JSON.stringify(seeded)), "DEMO");
}

describe("the Tutorial Patient's claim", () => {
  test("is filled from the card, the coded lines and the provider", () => {
    const enc = seededRecord();
    const form = enc.claimForm;
    expect(form).not.toBeNull();
    if (!form) return;
    expect(enc.claimNumber).toBeTruthy();
    // Box 1a: the member ID the card carries and the 271 matched.
    expect(form.insuredId).toBe(TUTORIAL_MEMBER_ID);
    // Box 2 / 3: the patient the chart holds.
    expect(form.patientName).toBe("Patient, Tutorial");
    expect(form.patientDob).toBe("1971-06-20");
    // Box 23: the authorisation the PA stage decided.
    expect(form.priorAuthNumber).toBe(TUTORIAL_PA_ID);
    // Box 24: the coded lines, at the visit's own date and POS 11.
    expect(form.serviceLines.map((line) => line.cpt)).toEqual(["99214", "93000"]);
    for (const line of form.serviceLines) {
      expect(line.placeOfService).toBe("11");
      expect(line.dateOfService).toBe("2026-07-09");
      expect(line.charge).toBeGreaterThan(0);
      // Box 24J / 33: a Luhn-valid NPI, not a placeholder.
      expect(isLuhnValidNpi(line.renderingNpi)).toBe(true);
    }
    // Box 28 follows the lines it prices.
    expect(form.totalCharge).toBe(form.serviceLines.reduce((sum, line) => sum + line.charge, 0));
    // Box 21: the coded diagnosis, the visit's reason first.
    expect(form.principalDiagnosis).toBe("R07.9");
  });

  test("was submitted and came back 277CA A1 accepted", () => {
    const enc = seededRecord();
    expect(enc.claimStatus).toBe("partially_paid");
    const accepted = enc.statusEvents.find((event) => event.reasonCode === "277CA_ACCEPTED");
    expect(accepted).toBeDefined();
    expect(accepted?.refs?.ackCategory).toBe("A1");
    expect(enc.statusEvents.some((event) => event.reasonCode === "SUBMITTED_837P")).toBe(true);
  });
});

describe("the Tutorial Patient's 835", () => {
  test("is adjudicated line by line and posted", () => {
    const enc = seededRecord();
    expect(enc.remittances).toHaveLength(1);
    const remittance = enc.remittances[0];
    expect(remittance.postedAt).toBe(AT);
    expect(remittance.lines).toHaveLength(2);
    expect(remittanceBalances(remittance)).toBe(true);
    // Real group + CARC codes on the money that moved.
    for (const line of remittance.lines) {
      for (const adj of line.adjustments) {
        expect(["CO", "PR", "OA", "PI"]).toContain(adj.group);
        expect(adj.carc.startsWith(`${adj.group}-`)).toBe(true);
      }
    }
  });

  test("wrote charge, insurance-payment and adjustment entries to the ledger", () => {
    const enc = seededRecord();
    const entries = ledgerEntriesForClaim(enc.ledger, enc.claimNumber);
    const types = new Set(entries.map((entry) => entry.type));
    expect(types.has("charge")).toBe(true);
    expect(types.has("insurance_payment")).toBe(true);
    expect(types.has("adjustment")).toBe(true);
    // Every entry belongs to this claim, and the money balances against the 835.
    const balance = ledgerBalance(entries);
    expect(balance.chargesCents).toBe(enc.remittances[0].totals.billedCents);
    expect(balance.insurancePaidCents).toBe(enc.remittances[0].totals.paidCents);
  });
});

describe("Denials & AR, read from the same saved record", () => {
  test("shows exactly one denied line, with its age, bucket and appeal deadline", () => {
    const enc = seededRecord();
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
    const denials = items.filter((item) => item.kind === "denial");
    expect(denials).toHaveLength(1);
    const denial = denials[0];
    expect(denial.claimNumber).toBe(enc.claimNumber);
    expect(denial.cpt).toBe("93000");
    expect(denial.carc).toBe("CO-236");
    // The money the payer refused is the line's own charge, and the patient
    // carries none of it — a CO line is a provider write-off.
    expect(denial.amountCents).toBe(enc.remittances[0].lines[1].billedCents);
    expect(denial.patientPortionCents).toBe(0);
    // Age, bucket and deadline all come from the 835's own date.
    const datedAt = enc.remittances[0].paymentDate;
    expect(denial.datedAt).toBe(datedAt);
    expect(denial.ageDays).toBe(daysBetween(datedAt, NOW));
    expect(denial.bucket).toBe(agingBucketFor(denial.ageDays));
    expect(denial.appealDeadline).toBe(appealDeadlineFor(datedAt));
    expect(denial.status).toBe("open");
  });
});

describe("the seed stays one written-once example", () => {
  test("a second open writes nothing more", () => {
    const first = seededRecord();
    const again = applyTutorialMoneySeed(first, PATIENT, "2026-12-01T00:00:00.000Z", "CLM-000002");
    expect(again).toBe(first);
    expect(again.claimNumber).toBe(first.claimNumber);
    expect(again.remittances).toHaveLength(1);
  });

  test("the claim number is the caller's own, never invented here", () => {
    const clinical = applyTutorialSeed(createEncounter("DEMO"), TUTORIAL, AT);
    // No number, no money: the store mints it from the student's own sequence.
    expect(applyTutorialMoneySeed(clinical, PATIENT, AT, "")).toBe(clinical);
    const seeded = applyTutorialMoneySeed(clinical, PATIENT, AT, "CLM-000008");
    expect(seeded.claimNumber).toBe("CLM-000008");
    expect(seeded.tutorialSeed).toBe(TUTORIAL_SEED_VERSION);
  });
});
