/**
 * One patient, one insurance card — the selected patient's own.
 *
 * The bug this pins: another patient's screen could print the Tutorial Patient's
 * member ID and plan. Every reader now asks `domain/patientCard.ts`, which reads
 * only the patient it is handed.
 *
 * The promises, tested with two patients side by side (one with a card, one with
 * none):
 *   1. The card, the banner line and the "not on file" wording come from that
 *      patient alone — the second patient never shows the first one's card.
 *   2. Registration's form starts from the selected patient: blanks for a patient
 *      with no card, never the patient opened before it.
 *   3. The claim's identity boxes are seeded from that patient, and a claim that
 *      last carried another patient's card has it cleared — a student-typed box
 *      is never touched.
 *   4. Nothing writes back: the card is a copy, and the patient record is
 *      unchanged after a caller edits it.
 */
import { describe, expect, test } from "bun:test";
import {
  NOT_ON_FILE,
  cardLine,
  memberIdOnFile,
  patientCard,
  registrationCardFor,
} from "../src/domain/patientCard";
import { blankClaimForm, patientIdentityBoxes, reseedIdentityBoxes } from "../src/utils/claimAutoFill";
import type { InsuranceCoverage, Patient } from "../src/store/patientStore";

function coverage(over: Partial<InsuranceCoverage> = {}): InsuranceCoverage {
  return {
    payerName: "",
    ediPayerId: "",
    subscriberId: "",
    groupNumber: "",
    relationshipToSubscriber: "Self",
    subscriberName: "",
    subscriberDob: "",
    subscriberSex: "",
    planName: "",
    ...over,
  };
}

/** The Tutorial Patient: has a card of its own. */
const TUTORIAL = {
  id: "DEMO",
  mrn: "TUTORIAL-001",
  firstName: "Tutorial",
  lastName: "Patient",
  insurance: "Northwind Health Plan",
  insuranceRecord: {
    primary: coverage({
      payerName: "Northwind Health Plan",
      planName: "Northwind PPO",
      subscriberId: "NW-884210",
      groupNumber: "GRP-4471",
      ediPayerId: "NWIND01",
    }),
    secondary: null,
    source: "registration" as const,
    updatedAt: "2026-11-20T10:00:00.000Z",
  },
} as unknown as Patient;

/** A patient the student registered with no insurance on file. */
const NO_CARD = {
  id: "P-2026-0007",
  mrn: "MRN-2007",
  firstName: "Nadia",
  lastName: "Khan",
  insurance: "",
} as unknown as Patient;

describe("the selected patient's own card", () => {
  test("the patient with a card prints their own member ID, payer and plan", () => {
    const card = patientCard(TUTORIAL);
    expect(card.onFile).toBe(true);
    expect(card.memberId).toBe("NW-884210");
    expect(card.payerName).toBe("Northwind Health Plan");
    expect(card.planName).toBe("Northwind PPO");
    expect(cardLine(card)).toBe("Northwind Health Plan · Northwind PPO · ID NW-884210");
  });

  test("the patient with no insurance reads not on file — not the neighbour's card", () => {
    const card = patientCard(NO_CARD);
    expect(card.onFile).toBe(false);
    expect(card.memberId).toBe("");
    expect(card.payerName).toBe("");
    expect(card.planName).toBe("");
    expect(cardLine(card)).toBe(NOT_ON_FILE);
    expect(memberIdOnFile(card)).toBe(NOT_ON_FILE);
  });

  test("side by side, neither patient's card reaches the other", () => {
    const mine = patientCard(TUTORIAL);
    const theirs = patientCard(NO_CARD);
    expect(theirs.memberId).not.toBe(mine.memberId);
    expect(theirs.payerName).not.toBe(mine.payerName);
    expect(theirs.planName).not.toBe(mine.planName);
    expect(cardLine(theirs)).not.toContain("NW-884210");
    // Asking twice for the same patient is stable, and asking for no patient at
    // all is "not on file" rather than the last patient seen.
    expect(cardLine(patientCard(TUTORIAL))).toBe(cardLine(mine));
    expect(cardLine(patientCard(null))).toBe(NOT_ON_FILE);
    expect(cardLine(patientCard(undefined))).toBe(NOT_ON_FILE);
  });

  test("Registration starts from this patient: blanks when they have no card", () => {
    const mine = registrationCardFor(TUTORIAL);
    expect(mine.payerName).toBe("Northwind Health Plan");
    expect(mine.subscriberId).toBe("NW-884210");
    expect(mine.groupNumber).toBe("GRP-4471");
    expect(mine.payerId).toBe("NWIND01");

    const theirs = registrationCardFor(NO_CARD);
    expect(theirs).toEqual({
      payerName: "",
      subscriberId: "",
      groupNumber: "",
      payerId: "",
      relationship: "Self",
      secondaryPayerName: "",
      secondaryPayerId: "",
      secondarySubscriberId: "",
      secondaryGroupNumber: "",
    });
  });

  test("nothing writes back into the patient record", () => {
    const before = JSON.stringify(TUTORIAL);
    const card = patientCard(TUTORIAL);
    card.memberId = "TAMPERED";
    card.payerName = "TAMPERED";
    const form = registrationCardFor(TUTORIAL);
    form.subscriberId = "TAMPERED";
    expect(JSON.stringify(TUTORIAL)).toBe(before);
    expect(patientCard(TUTORIAL).memberId).toBe("NW-884210");
  });
});

describe("the claim's identity boxes", () => {
  test("each patient's boxes are their own", () => {
    const mine = patientIdentityBoxes(TUTORIAL);
    expect(mine.insuredId).toBe("NW-884210");
    expect(mine.insuredPolicyGroup).toBe("GRP-4471");
    expect(mine.insuredPlanName).toBe("Northwind PPO");
    expect(mine.payerName).toBe("Northwind Health Plan");

    const theirs = patientIdentityBoxes(NO_CARD);
    expect(theirs.insuredId).toBe("");
    expect(theirs.insuredPolicyGroup).toBe("");
    expect(theirs.insuredPlanName).toBe("");
    expect(theirs.payerName).toBe("");
  });

  test("a claim that last carried another patient's card has it cleared", () => {
    // A claim seeded from the Tutorial Patient's card.
    const seeded = {
      ...blankClaimForm(),
      ...reseedIdentityBoxes(blankClaimForm(), TUTORIAL),
    };
    expect(seeded.insuredId).toBe("NW-884210");
    expect(seeded.insuredPlanName).toBe("Northwind PPO");

    // The same claim record re-seeded onto the patient with no card.
    const patch = reseedIdentityBoxes(seeded, NO_CARD);
    expect(patch.insuredId).toBe("");
    expect(patch.insuredPolicyGroup).toBe("");
    expect(patch.insuredPlanName).toBe("");
    expect(patch.payerName).toBe("");
    expect(JSON.stringify(patch.identitySeedValues ?? {})).not.toContain("NW-884210");
  });

  test("a box the student typed is never cleared or overwritten", () => {
    const seeded = {
      ...blankClaimForm(),
      ...reseedIdentityBoxes(blankClaimForm(), TUTORIAL),
    };
    const typed = { ...seeded, insuredId: "TYPED-BY-STUDENT" };
    const patch = reseedIdentityBoxes(typed, NO_CARD);
    expect(patch.insuredId).toBeUndefined();
  });
});
