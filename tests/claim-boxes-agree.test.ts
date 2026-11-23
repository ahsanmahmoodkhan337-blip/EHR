/**
 * The claim's own boxes agree with each other (`specs/claim-boxes-agree.md`).
 *
 * Three faults, one standard: a paper the student reads must not contain a fact
 * that contradicts another box on the same paper, and a read-only chart must not
 * carry an error no student could clear.
 *
 *   1. box 11 is required only of a payer that issues a group number — Medicare
 *      Part B issues none, so the paper prints N/A and the check passes;
 *   2. box 13 is box 12's signature on a SELF claim (box 6 = SELF), and its own
 *      value on a dependent's claim;
 *   3. box 4 prints exactly what box 2 prints on a SELF claim, and the same
 *      `Last, First` format for a dependent's subscriber.
 *
 * Everything here is read back from the claim the Tutorial Patient's chart
 * builds — the same record a reload reads — or from `repairClaimParties`, which
 * is what the Billing stage runs when a claim saved by the old build is opened.
 */
import { describe, expect, test } from "bun:test";
import { createEncounter } from "../src/store/pipelineEncounter";
import type { Patient } from "../src/store/patientStore";
import { tutorialCardFor } from "../src/domain/tutorialEncounter";
import { buildClaimForm, patientIdentityBoxes, repairClaimParties } from "../src/utils/claimAutoFill";
import { validateCMS1500 } from "../src/utils/claimValidation";

const TUTORIAL = {
  id: "DEMO",
  mrn: "TUTORIAL-001",
  firstName: "Tutorial",
  lastName: "Patient",
  dateOfBirth: "1971-06-20",
  gender: "Male",
  address: "1 Training Lane, Medford, NY 11763",
  insurance: "Medicare Part B",
};

/** The Tutorial Patient as the chart holds it, with its Medicare Part B card. */
const PATIENT = {
  ...TUTORIAL,
  insuranceRecord: tutorialCardFor(TUTORIAL),
} as unknown as Patient;

/** The same patient as a spouse on someone else's plan — box 6 is not SELF. */
const DEPENDENT = {
  ...TUTORIAL,
  id: "P-DEPENDENT",
  insuranceRecord: {
    primary: {
      payerName: "Cascadia Health PPO",
      planName: "Cascadia Health PPO",
      subscriberId: "C-4471",
      groupNumber: "GRP-9001",
      ediPayerId: "94275",
      relationshipToSubscriber: "Spouse",
      subscriberName: "Jordan Patient",
      subscriberDob: "1969-02-11",
      subscriberSex: "Female",
    },
  },
} as unknown as Patient;

/** The claim the Tutorial Patient's chart builds, as the paper reads it. */
function tutorialClaim() {
  return buildClaimForm({
    patient: PATIENT,
    displayName: "Patient, Tutorial",
    pipeline: createEncounter("DEMO"),
  });
}

describe("box 11 — a payer that issues no group number", () => {
  test("the Tutorial Patient's claim prints N/A and carries no box 11 error", () => {
    const form = tutorialClaim();
    expect(form.payerName).toBe("Medicare Part B");
    expect(form.insuredPolicyGroup).toBe("N/A");
    const issues = validateCMS1500(form, { principalDiagnosis: form.principalDiagnosis });
    expect(issues.filter((issue) => issue.box === "11")).toEqual([]);
  });

  test("a payer that does issue a group number keeps the requirement and its wording", () => {
    const form = { ...tutorialClaim(), payerName: "Meridian Advantage HMO", insuredPolicyGroup: "" };
    const issue = validateCMS1500(form).find((i) => i.box === "11");
    expect(issue?.severity).toBe("error");
    expect(issue?.message).toBe("Box 11: insured's policy / group number is required.");
  });

  test("a group number the card really holds is printed as it is", () => {
    const known = patientIdentityBoxes(DEPENDENT, "Patient, Tutorial");
    expect(known.insuredPolicyGroup).toBe("GRP-9001");
  });
});

describe("box 13 — the insured's signature", () => {
  test("on a SELF claim box 13 carries box 12's signature instead of reading unsigned", () => {
    const form = tutorialClaim();
    expect(form.patientRelationship).toBe("Self");
    expect(form.patientSignature).toBe(true);
    expect(form.insuredSignature).toBe(true);
  });

  test("on a dependent's claim box 13 is genuinely separate and keeps its own value", () => {
    const form = buildClaimForm({
      patient: DEPENDENT,
      displayName: "Patient, Tutorial",
      pipeline: createEncounter("P-DEPENDENT"),
    });
    expect(form.patientRelationship).toBe("Spouse");
    expect(form.patientSignature).toBe(true);
    expect(form.insuredSignature).toBe(false);
  });
});

describe("boxes 2 and 4 — one person, one spelling", () => {
  test("on a SELF claim box 4 prints exactly what box 2 prints", () => {
    const form = tutorialClaim();
    expect(form.patientName).toBe("Patient, Tutorial");
    expect(form.insuredName).toBe(form.patientName);
  });

  test("a dependent's insured keeps the same Last, First format", () => {
    const form = buildClaimForm({
      patient: DEPENDENT,
      displayName: "Patient, Tutorial",
      pipeline: createEncounter("P-DEPENDENT"),
    });
    expect(form.insuredName).toBe("Patient, Jordan");
    // One format across the paper: both boxes are last-first, never one of each.
    expect(form.insuredName).toMatch(/^[^,]+, \S/);
    expect(form.patientName).toMatch(/^[^,]+, \S/);
  });
});

describe("a claim saved by the old build is repaired when it is opened", () => {
  /** The three contradictions the previous build wrote onto the paper. */
  const oldClaim = () => ({
    ...tutorialClaim(),
    insuredName: "Tutorial Patient",
    insuredPolicyGroup: "",
    insuredSignature: false,
  });

  test("box 11 becomes N/A, box 4 box 2's name, box 13 signed", () => {
    const patch = repairClaimParties(oldClaim(), PATIENT, "Patient, Tutorial");
    expect(patch.insuredPolicyGroup).toBe("N/A");
    expect(patch.insuredName).toBe("Patient, Tutorial");
    expect(patch.insuredSignature).toBe(true);
  });

  test("the repaired claim passes the box 11 and 12/13 checks", () => {
    const repaired = { ...oldClaim(), ...repairClaimParties(oldClaim(), PATIENT, "Patient, Tutorial") };
    const issues = validateCMS1500(repaired, { principalDiagnosis: repaired.principalDiagnosis });
    expect(issues.filter((issue) => issue.box === "11" || issue.box === "12")).toEqual([]);
    expect(repaired.insuredName).toBe(repaired.patientName);
  });

  test("a box the student typed is left exactly as typed", () => {
    const typed = { ...oldClaim(), insuredName: "Patient, T.", insuredPolicyGroup: "GRP-TYPED" };
    const patch = repairClaimParties(typed, PATIENT, "Patient, Tutorial");
    expect(patch.insuredName).toBeUndefined();
    expect(patch.insuredPolicyGroup).toBeUndefined();
  });
});
