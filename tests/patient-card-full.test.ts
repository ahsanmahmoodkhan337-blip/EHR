/**
 * The full card — one patient's own licence and insurance card, and that case's
 * one deliberate mismatch.
 *
 * Before 2026-11-21 Registration printed two literal blocks ("Jonathan/Jonathon
 * Doe", subscriber XYZ987654321) for every patient, so two charts showed the same
 * documents and the same trap. `domain/patientCard.ts` now builds both documents
 * from the patient handed to it, derives the licence number and state from that
 * patient's own record, and generates exactly one mismatch per case from that
 * patient's own name.
 *
 * The promises tested here:
 *   1. Every field on both documents comes from that patient's record, and a
 *      field the chart does not hold reads "Not on file" — never a neighbour's.
 *   2. Two patients produce two different cards, including different derived
 *      licence numbers and different mismatch values.
 *   3. Exactly one mismatch per case, stable across calls, generated from the
 *      patient (never the constant "Jonathon"), and null when there is no card.
 *   4. Registration is scored against those generated values.
 */
import { describe, expect, test } from "bun:test";
import {
  NOT_ON_FILE,
  caseMismatch,
  onFileOr,
  patientCard,
  registrationExpectations,
} from "../src/domain/patientCard";
import { scoreRegistration } from "../src/utils/scoring";
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

function patient(over: Record<string, unknown>): Patient {
  return {
    id: "P001",
    mrn: "MRN-1001",
    firstName: "Jane",
    lastName: "Doe",
    dateOfBirth: "1979-03-15",
    gender: "Female",
    address: "123 Main St, Springfield, IL 62701",
    insurance: "",
    ...over,
  } as unknown as Patient;
}

/** Two patients, each with their own coverage on file. */
const JANE = patient({
  id: "P001",
  mrn: "MRN-1001",
  firstName: "Jane",
  lastName: "Doe",
  dateOfBirth: "1979-03-15",
  gender: "Female",
  address: "123 Main St, Springfield, IL 62701",
  insurance: "Northwind Health Plan PPO",
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
});

const OMAR = patient({
  id: "P002",
  mrn: "MRN-1002",
  firstName: "Omar",
  lastName: "Haddad",
  dateOfBirth: "1964-11-02",
  gender: "Male",
  address: "88 Cedar Ave, Austin, TX 78701",
  insurance: "Lakeshore Mutual",
  insuranceRecord: {
    primary: coverage({
      payerName: "Lakeshore Mutual",
      planName: "Lakeshore Silver",
      subscriberId: "LM-553117",
      groupNumber: "GRP-9920",
      ediPayerId: "LKSM01",
    }),
    secondary: null,
    source: "registration" as const,
    updatedAt: "2026-11-20T10:00:00.000Z",
  },
});

/** A patient with a name on the chart and no insurance at all. */
const NO_CARD = patient({
  id: "P-2026-0007",
  mrn: "MRN-2007",
  firstName: "Nadia",
  lastName: "Khan",
  dateOfBirth: "1990-01-09",
  address: "",
  insurance: "",
});

describe("the full card, per patient", () => {
  test("every field comes from that patient's own record", () => {
    const card = patientCard(JANE);
    expect(card.fullName).toBe("Jane Doe");
    expect(card.dateOfBirth).toBe("03/15/1979");
    expect(card.sex).toBe("Female");
    expect(card.address).toBe("123 Main St, Springfield, IL 62701");
    expect(card.licenceState).toBe("IL");
    expect(card.licenceNumber).toMatch(/^D\d{8}$/);
    expect(card.payerName).toBe("Northwind Health Plan");
    expect(card.planName).toBe("Northwind PPO");
    expect(card.memberId).toBe("NW-884210");
    expect(card.groupNumber).toBe("GRP-4471");
    expect(card.payerId).toBe("NWIND01");
    expect(card.relationship).toBe("Self");
    expect(card.onFile).toBe(true);
  });

  test("two patients produce two different licence and insurance cards", () => {
    const mine = patientCard(JANE);
    const theirs = patientCard(OMAR);
    for (const field of [
      "fullName",
      "dateOfBirth",
      "sex",
      "address",
      "licenceNumber",
      "licenceState",
      "payerName",
      "planName",
      "memberId",
      "groupNumber",
      "payerId",
    ] as const) {
      expect(theirs[field]).not.toBe(mine[field]);
    }
  });

  test("a field the chart does not hold reads Not on file", () => {
    const card = patientCard(NO_CARD);
    expect(card.fullName).toBe("Nadia Khan");
    expect(card.dateOfBirth).toBe("01/09/1990");
    expect(card.address).toBe("");
    expect(onFileOr(card.address)).toBe(NOT_ON_FILE);
    expect(onFileOr(card.licenceState)).toBe(NOT_ON_FILE);
    expect(card.onFile).toBe(false);
    expect(onFileOr(card.memberId)).toBe(NOT_ON_FILE);
    expect(onFileOr(card.payerName)).toBe(NOT_ON_FILE);
    expect(onFileOr(patientCard(null).fullName)).toBe(NOT_ON_FILE);
  });

  test("the derived licence number and state are stable for one patient", () => {
    expect(patientCard(JANE).licenceNumber).toBe(patientCard(JANE).licenceNumber);
    expect(patientCard(JANE).licenceState).toBe("IL");
    expect(patientCard(OMAR).licenceState).toBe("TX");
  });
});

describe("one deliberate mismatch per case", () => {
  test("each patient gets exactly one, generated from their own name", () => {
    const mine = caseMismatch(JANE);
    const theirs = caseMismatch(OMAR);
    expect(mine).not.toBeNull();
    expect(theirs).not.toBeNull();
    expect(mine!.kind).toBe("name");
    expect(theirs!.kind).toBe("name");

    // The card's spelling differs from the ID's by one deliberate error, and the
    // ID's spelling is the chart's own.
    expect(mine!.onLicence).toBe("Jane Doe");
    expect(mine!.onCard).not.toBe(mine!.onLicence);
    expect(theirs!.onLicence).toBe("Omar Haddad");
    expect(theirs!.onCard).not.toBe(theirs!.onLicence);

    // Never the old constant.
    expect(mine!.onCard).not.toContain("Jonathon");
    expect(theirs!.onCard).not.toContain("Jonathon");
    // The two cases do not carry the same trap.
    expect(theirs!.onCard).not.toBe(mine!.onCard);

    // Exactly one field differs, and it is one letter pair.
    const differing = [...mine!.onCard].filter((ch, i) => ch !== mine!.onLicence[i]);
    expect(differing.length).toBeGreaterThan(0);
    expect(mine!.onCard.length).toBe(mine!.onLicence.length);
  });

  test("the answer is No, and the consequence names both spellings", () => {
    const mismatch = caseMismatch(JANE)!;
    const [cardFirst, cardLast] = mismatch.onCard.split(" ");
    const [idFirst, idLast] = mismatch.onLicence.split(" ");
    expect(cardFirst).toBe(idFirst);
    expect(mismatch.documentsAgree).toBe(false);
    expect(mismatch.field).toBe("Member name");
    expect(mismatch.consequence).toContain(cardLast);
    expect(mismatch.consequence).toContain(idLast);
    expect(mismatch.consequence.toLowerCase()).toContain("name mismatch");
  });

  test("it is stable across calls and does not touch the patient record", () => {
    const before = JSON.stringify(JANE);
    expect(caseMismatch(JANE)).toEqual(caseMismatch(JANE));
    expect(JSON.stringify(JANE)).toBe(before);
  });

  test("no card on file means nothing to compare — never an invented mismatch", () => {
    expect(caseMismatch(NO_CARD)).toBeNull();
    expect(caseMismatch(null)).toBeNull();
    expect(caseMismatch(undefined)).toBeNull();
  });
});

describe("registration is scored against the generated values", () => {
  const correct = {
    firstName: "Jane",
    lastName: "Doe",
    dob: "03/15/1979",
    subscriberId: "NW-884210",
    groupNumber: "GRP-4471",
    payerId: "NWIND01",
  };

  test("a faithful transcription of this patient's own card scores full marks", () => {
    expect(scoreRegistration(correct, registrationExpectations(JANE))).toBe(10);
    expect(
      scoreRegistration(
        { ...correct, firstName: "Omar", lastName: "Haddad", subscriberId: "LM-553117", groupNumber: "GRP-9920", payerId: "LKSM01", dob: "11/02/1964" },
        registrationExpectations(OMAR),
      ),
    ).toBe(10);
  });

  test("copying the card's misspelling costs the mismatch penalty", () => {
    const mismatch = caseMismatch(JANE)!;
    const [wrongFirst, wrongLast] = mismatch.onCard.split(" ");
    const copied = scoreRegistration(
      { ...correct, firstName: wrongFirst, lastName: wrongLast },
      registrationExpectations(JANE),
    );
    expect(copied).toBeLessThan(10);
    expect(copied).toBeLessThanOrEqual(3);
  });

  test("another patient's identifiers no longer score", () => {
    expect(
      scoreRegistration(
        { ...correct, subscriberId: "XYZ987654321", groupNumber: "GRP-4477", payerId: "NWIND01" },
        registrationExpectations(JANE),
      ),
    ).toBe(7);
  });
});
