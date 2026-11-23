/**
 * The Tutorial Patient's claim half (`specs/tutorial-patient-prefill.md` §B).
 *
 * Owner, 2026-11-22: the tutorial chart is the standard a student opens to see
 * what a complete encounter looks like — *"all data filled from start to end"*.
 * Owner, 2026-11-23: *"in billing section it should not be submitted, the
 * CMS-1500 should be filled and student should submit too … himself."*
 *
 * So this file reads the record back after the seed and asks two questions:
 *
 *   - does the claim open as a **filled draft** — every box the chart can supply
 *     carrying a value, a claim number, and *nothing* sent: no 837P, no 277CA, no
 *     835, no posting and therefore no AR row;
 *   - and does the **student's own Submit** — the same domain calls the Billing
 *     screen's Submit makes — produce exactly those, in that order.
 *
 * Nothing here reads a screen or a constant: every figure is built from the saved
 * record by the same pure modules the app uses, which is what a reload does.
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
import { applyTutorialMoneySeed, tutorialMoneyPending } from "../src/domain/tutorialClaim";
import { adjudicateClaim, planForPayerName, remittanceBalances } from "../src/domain/adjudication";
import { buildSubmissionEvents } from "../src/domain/clearinghouse";
import { appendLedgerEntries, postRemittanceToLedger } from "../src/domain/ledger";
import { buildArWorkQueue } from "../src/domain/arWorkQueue";
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
      date: "2026-11-23",
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
  const clinical = applyTutorialSeed(createEncounter("DEMO"), TUTORIAL, AT);
  const seeded = applyTutorialMoneySeed(clinical, PATIENT, AT, "CLM-000001");
  return normalizeEncounter(JSON.parse(JSON.stringify(seeded)), "DEMO");
}

/**
 * The student's own Submit, as `components/BillingLedger` runs it: the 837P and
 * its 277CA, then the payer's 835, then the posting. Same three modules, same
 * order, one record.
 */
function studentSubmits(enc: ReturnType<typeof seededRecord>) {
  const form = enc.claimForm;
  if (!form) throw new Error("the reference claim has no paper");
  const lines = form.serviceLines
    .filter((line) => (line.cpt ?? "").trim() !== "")
    .map((line) => ({
      cpt: line.cpt.trim(),
      modifiers: line.modifiers ?? [],
      units: Number(line.units) > 0 ? Number(line.units) : 1,
      chargeCents: Math.round((Number(line.charge) || 0) * 100),
    }));
  const { events, ack } = buildSubmissionEvents({
    facts: {
      track: "medical",
      claimNumber: enc.claimNumber ?? "",
      subscriberId: form.insuredId,
      subscriberIdOnFile: PATIENT.insuranceRecord?.primary?.subscriberId ?? "",
      patientDob: form.patientDob,
      patientDobOnFile: PATIENT.dateOfBirth ?? "",
    },
    from: enc.claimStatus,
    patientId: enc.patientId,
    by: "923001234567",
    jobRole: "biller",
    lineCount: lines.length,
    payerName: form.payerName,
    existing: enc.statusEvents,
    at: AT,
  });
  expect(ack.category).toBe("A1");
  const plan = planForPayerName(form.payerName);
  const remittance = adjudicateClaim({
    claimNumber: enc.claimNumber ?? "",
    payerName: form.payerName,
    payerId: form.payerEdiId,
    plan,
    lines,
    deductibleRemainingCents: Math.round((plan?.deductibleUsd ?? 0) * 100),
    priorAuthNumber: form.priorAuthNumber ?? "",
    at: AT,
  });
  const entries = postRemittanceToLedger(remittance, { patientId: enc.patientId, userId: "923001234567", at: AT });
  return {
    ...enc,
    claimStatus: "accepted" as const,
    statusEvents: events,
    remittances: [{ ...remittance, postedAt: AT }],
    ledger: appendLedgerEntries(enc.ledger, entries),
  };
}

describe("the Tutorial Patient's claim opens as a filled draft", () => {
  test("every box the chart can supply carries a value", () => {
    const enc = seededRecord();
    const form = enc.claimForm;
    expect(form).not.toBeNull();
    if (!form) return;
    expect(enc.claimNumber).toBeTruthy();
    // Box 1a: the member ID the card carries and the 271 matched.
    expect(form.insuredId).toBe(TUTORIAL_MEMBER_ID);
    // Box 2 / 3 / 4 / 5: the patient the chart holds.
    expect(form.patientName).toBe("Patient, Tutorial");
    expect(form.patientDob).toBe("1971-06-20");
    expect(String(form.insuredName ?? "").trim()).not.toBe("");
    expect(String(form.patientAddress ?? "").trim()).not.toBe("");
    // Box 11: Medicare Part B issues no group number, so the record holds none
    // and the paper prints the stated `N/A` — a box that says why, never a blank.
    expect(String(form.payerName ?? "")).toBe("Medicare Part B");
    expect(String(form.insuredGroup ?? "").trim()).toBe("");
    // Box 21: the coded diagnosis, the visit's reason first.
    expect(form.principalDiagnosis).toBe("R07.9");
    // Box 23: the authorisation the PA stage decided.
    expect(form.priorAuthNumber).toBe(TUTORIAL_PA_ID);
    // Box 24: the coded lines, at the visit's own date and POS 11.
    expect(form.serviceLines.map((line) => line.cpt)).toEqual(["99214", "93000"]);
    for (const line of form.serviceLines) {
      expect(line.placeOfService).toBe("11");
      expect(line.dateOfService).toBe("2026-11-23");
      expect(line.charge).toBeGreaterThan(0);
      // Box 24J / 33: a Luhn-valid NPI, not a placeholder.
      expect(isLuhnValidNpi(line.renderingNpi)).toBe(true);
    }
    // Box 28 follows the lines it prices; boxes 31 / 32 / 33 are filled.
    expect(form.totalCharge).toBe(form.serviceLines.reduce((sum, line) => sum + line.charge, 0));
    expect(String(form.physicianSignature ?? "").trim()).not.toBe("");
    expect(String(form.federalTaxId ?? "").trim()).not.toBe("");
  });

  test("is a draft: nothing sent, priced, posted or queued", () => {
    const enc = seededRecord();
    expect(enc.claimStatus).toBe("draft");
    // No 837P, no 277CA.
    expect(enc.statusEvents.some((e) => e.reasonCode === "SUBMITTED_837P")).toBe(false);
    expect(enc.statusEvents.some((e) => e.reasonCode === "277CA_ACCEPTED")).toBe(false);
    // No 835, no ledger, no AR row — the queue is derived from a posted 835, so
    // an unsubmitted claim cannot have one.
    expect(enc.remittances).toHaveLength(0);
    expect(enc.ledger).toHaveLength(0);
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
    expect(items).toHaveLength(0);
    // The one timeline entry says what the record is.
    const created = enc.statusEvents.find((e) => e.entityType === "claim");
    expect(created?.reasonCode).toBe("CLAIM_CREATED");
    expect(created?.to).toBe("draft");
  });
});

describe("the student's own Submit is what produces the money", () => {
  test("the 277CA, the 835, the posting and the AR row all follow one press", () => {
    const submitted = studentSubmits(seededRecord());
    expect(submitted.claimStatus).toBe("accepted");
    expect(submitted.statusEvents.some((e) => e.reasonCode === "277CA_ACCEPTED")).toBe(true);
    expect(submitted.remittances).toHaveLength(1);
    const remittance = submitted.remittances[0];
    expect(remittance.postedAt).toBe(AT);
    expect(remittanceBalances(remittance)).toBe(true);
    expect(submitted.ledger.length).toBeGreaterThan(0);
    const items = buildArWorkQueue(
      [
        {
          patientId: submitted.patientId,
          patientName: submitted.displayName,
          claimNumber: submitted.claimNumber,
          remittances: submitted.remittances,
          ledger: submitted.ledger,
          arItems: submitted.arItems,
        },
      ],
      NOW,
    );
    expect(items.length).toBeGreaterThan(0);
  });
});

describe("a chart seeded by an older build", () => {
  test("its already-submitted seed claim is brought back to the draft", () => {
    const submitted = studentSubmits(seededRecord());
    // As an older build left it: the money on the record, stamped `tutorial-4`.
    const old = {
      ...submitted,
      tutorialSeed: "tutorial-4",
      statusEvents: submitted.statusEvents.map((e) => ({ ...e, by: "system" })),
    };
    expect(tutorialMoneyPending(old)).toBe(true);
    const reopened = applyTutorialMoneySeed(old, PATIENT, AT, "CLM-000009");
    expect(reopened.claimStatus).toBe("draft");
    expect(reopened.remittances).toHaveLength(0);
    expect(reopened.ledger).toHaveLength(0);
    expect(reopened.statusEvents.some((e) => e.reasonCode === "277CA_ACCEPTED")).toBe(false);
  });

  test("a claim the student submitted is never rewritten", () => {
    const submitted = studentSubmits(seededRecord());
    const theirs = { ...submitted, tutorialSeed: "tutorial-4" };
    expect(tutorialMoneyPending(theirs)).toBe(false);
    expect(applyTutorialMoneySeed(theirs, PATIENT, AT, "CLM-000010")).toBe(theirs);
  });
});

describe("the seed stays one written-once example", () => {
  test("a second open writes nothing more", () => {
    const first = seededRecord();
    const again = applyTutorialMoneySeed(first, PATIENT, "2026-12-01T00:00:00.000Z", "CLM-000002");
    expect(again).toBe(first);
    expect(again.claimNumber).toBe(first.claimNumber);
    expect(again.claimStatus).toBe("draft");
  });

  test("the claim number is the caller's own, never invented here", () => {
    const clinical = applyTutorialSeed(createEncounter("DEMO"), TUTORIAL, AT);
    // No number, no claim: the store mints it from the student's own sequence.
    expect(applyTutorialMoneySeed(clinical, PATIENT, AT, "")).toBe(clinical);
    const seeded = applyTutorialMoneySeed(clinical, PATIENT, AT, "CLM-000008");
    expect(seeded.claimNumber).toBe("CLM-000008");
    expect(seeded.tutorialSeed).toBe(TUTORIAL_SEED_VERSION);
  });
});
