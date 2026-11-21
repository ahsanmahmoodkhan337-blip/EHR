/**
 * Slice I — the patient record is the single source of truth.
 *
 * The bug this pins: Registration printed the same two literal cards for every
 * patient ("Jonathan/Jonathon Doe", D45178239, XYZ987654321, GRP-4477,
 * NWIND01), the payer box defaulted to one hardcoded plan, the score compared
 * every answer to that one card, and the claim's demo fill carried another
 * patient's world into boxes 9c, 16, 17 and 23.
 *
 * The promises, tested with two patients side by side:
 *   1. The licence and the insurance card are built from that patient's own
 *      record, and a value the chart does not hold reads "Not on file".
 *   2. Each patient carries exactly one deliberate mismatch, derived from their
 *      own name, stable across reads and different between patients.
 *   3. Registration's score reads the generated values: the record's spelling
 *      scores, the card's spelling takes the blind-copy penalty.
 *   4. Saving registration updates the patient, and the card and the claim read
 *      the new value from that one record.
 *   5. Demo fill carries nothing from another patient.
 */
import { describe, expect, test } from "bun:test";
import {
  NOT_ON_FILE,
  cardMemberName,
  formatCardDate,
  onFileValue,
  patientCard,
  patientCardMismatch,
  registrationCardFor,
  stateFromAddress,
} from "../src/domain/patientCard";
import { scoreRegistration } from "../src/utils/scoring";
import { buildInsuranceRecord } from "../src/utils/insuranceRecord";
import { patientIdentityBoxes } from "../src/utils/claimAutoFill";
import { DEMO_CLAIM_DATA, DEMO_LINE_DATA } from "../src/data/claims/demoClaimData";
import { applyDemoFill } from "../src/utils/demoClaimFill";
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

const JANE = {
  id: "P001",
  mrn: "MRN-1001",
  firstName: "Jane",
  lastName: "Doe",
  dateOfBirth: "1979-03-15",
  gender: "Female",
  address: "123 Main St, Springfield, IL 62701",
  licenseNumber: "D45170274",
  licenseState: "IL",
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
    source: "seed" as const,
    updatedAt: "",
  },
} as unknown as Patient;

const RAJ = {
  id: "P002",
  mrn: "MRN-1002",
  firstName: "Rajesh",
  lastName: "Kumar",
  dateOfBirth: "1968-11-02",
  gender: "Male",
  address: "456 Oak Ave, Springfield, IL 62702",
  licenseNumber: "D45218043",
  licenseState: "IL",
  insurance: "Meridian Health Plan",
  insuranceRecord: {
    primary: coverage({
      payerName: "Meridian Health Plan",
      planName: "Meridian Choice",
      subscriberId: "MH-4471902",
      groupNumber: "GRP-9012",
      ediPayerId: "MERID01",
    }),
    secondary: null,
    source: "seed" as const,
    updatedAt: "",
  },
} as unknown as Patient;

describe("the licence and the insurance card come from the patient", () => {
  test("each patient's card is their own, field by field", () => {
    const jane = patientCard(JANE);
    const raj = patientCard(RAJ);

    expect(jane.fullName).toBe("Jane Doe");
    expect(jane.dateOfBirth).toBe("03/15/1979");
    expect(jane.licenseNumber).toBe("D45170274");
    expect(jane.licenseState).toBe("IL");
    expect(jane.memberId).toBe("NW-884210");
    expect(jane.payerName).toBe("Northwind Health Plan");

    expect(raj.fullName).toBe("Rajesh Kumar");
    expect(raj.dateOfBirth).toBe("11/02/1968");
    expect(raj.licenseNumber).toBe("D45218043");
    expect(raj.memberId).toBe("MH-4471902");

    expect(raj.licenseNumber).not.toBe(jane.licenseNumber);
    expect(raj.memberId).not.toBe(jane.memberId);
    expect(raj.payerName).not.toBe(jane.payerName);
  });

  test("a value the chart does not hold reads Not on file, never a neighbour's", () => {
    const bare = { id: "P-NEW", firstName: "Nadia", lastName: "Khan" } as unknown as Patient;
    const card = patientCard(bare);
    expect(card.onFile).toBe(false);
    expect(onFileValue(card.memberId)).toBe(NOT_ON_FILE);
    expect(onFileValue(card.licenseNumber)).toBe(NOT_ON_FILE);
    expect(onFileValue(card.dateOfBirth)).toBe(NOT_ON_FILE);
    expect(onFileValue(card.address)).toBe(NOT_ON_FILE);
    expect(onFileValue(patientCard(null).fullName)).toBe(NOT_ON_FILE);
    expect(registrationCardFor(bare).subscriberId).toBe("");
  });

  test("the state comes from the licence, or from the patient's own address", () => {
    expect(patientCard(JANE).licenseState).toBe("IL");
    const noLicenceState = { ...JANE, licenseState: undefined } as unknown as Patient;
    expect(patientCard(noLicenceState).licenseState).toBe("IL");
    expect(stateFromAddress("1 Training Lane, Medford, NY 11763")).toBe("NY");
    expect(stateFromAddress("")).toBe("");
    expect(formatCardDate("1979-03-15")).toBe("03/15/1979");
    expect(formatCardDate("not a date")).toBe("");
  });
});

describe("the one deliberate mismatch", () => {
  test("each patient carries exactly one, and it is their own", () => {
    const jane = patientCardMismatch(JANE);
    const raj = patientCardMismatch(RAJ);
    expect(jane).not.toBeNull();
    expect(raj).not.toBeNull();
    expect(jane!.cardValue).not.toBe(raj!.cardValue);
    expect(jane!.recordValue).toBe("Jane Doe");
    expect(raj!.recordValue).toBe("Rajesh Kumar");
  });

  test("it is one word spelled differently, and it is stable", () => {
    for (const patient of [JANE, RAJ]) {
      const mismatch = patientCardMismatch(patient)!;
      const recordWords = mismatch.recordValue.split(" ");
      const cardWords = mismatch.cardValue.split(" ");
      expect(cardWords.length).toBe(recordWords.length);
      const differing = recordWords.filter((word, i) => word !== cardWords[i]);
      expect(differing.length).toBe(1);
      expect(mismatch.cardValue).not.toBe(mismatch.recordValue);
      // Asking again gives the same mismatch — never a fresh random one.
      expect(patientCardMismatch(patient)!.cardValue).toBe(mismatch.cardValue);
    }
  });

  test("the card prints the mismatch spelling; the licence prints the record", () => {
    const mismatch = patientCardMismatch(JANE)!;
    expect(cardMemberName(JANE)).toBe(mismatch.cardValue);
    expect(patientCard(JANE).fullName).toBe(mismatch.recordValue);
    expect(cardMemberName(JANE)).not.toBe(patientCard(JANE).fullName);
  });

  test("a patient with no name has nothing to mismatch", () => {
    expect(patientCardMismatch(null)).toBeNull();
    expect(patientCardMismatch({ id: "P-X" } as unknown as Patient)).toBeNull();
  });
});

describe("registration scores against the patient's own card", () => {
  const expectedFor = (patient: Patient) => {
    const card = patientCard(patient);
    return {
      firstName: card.firstName,
      lastName: card.lastName,
      dob: card.dateOfBirth,
      memberId: card.memberId,
      groupNumber: card.groupNumber,
      payerId: card.payerId,
      nameOnCard: patientCardMismatch(patient)?.cardValue ?? "",
    };
  };

  const answerFor = (patient: Patient) => {
    const card = patientCard(patient);
    return {
      firstName: card.firstName,
      lastName: card.lastName,
      dob: card.dateOfBirth,
      subscriberId: card.memberId,
      groupNumber: card.groupNumber,
      payerId: card.payerId,
    };
  };

  test("transcribing the licence and the record scores 10 for either patient", () => {
    expect(scoreRegistration(answerFor(JANE), expectedFor(JANE))).toBe(10);
    expect(scoreRegistration(answerFor(RAJ), expectedFor(RAJ))).toBe(10);
  });

  test("copying the card's spelling of the name takes the blind-copy penalty", () => {
    const cardName = patientCardMismatch(JANE)!.cardValue.split(" ");
    const copied = {
      ...answerFor(JANE),
      firstName: cardName[0],
      lastName: cardName.slice(1).join(" "),
    };
    const copiedScore = scoreRegistration(copied, expectedFor(JANE));
    const correctScore = scoreRegistration(answerFor(JANE), expectedFor(JANE));
    expect(copiedScore).toBeLessThan(correctScore);
    expect(copiedScore).toBeLessThanOrEqual(5);
  });

  test("another patient's member ID no longer scores", () => {
    const wrong = {
      ...answerFor(RAJ),
      subscriberId: patientCard(JANE).memberId,
      groupNumber: patientCard(JANE).groupNumber,
      payerId: patientCard(JANE).payerId,
    };
    expect(scoreRegistration(wrong, expectedFor(RAJ))).toBeLessThan(10);
    // The old hardcoded card scores nothing on a patient it does not belong to.
    const legacy = {
      firstName: "Jonathan",
      lastName: "Doe",
      dob: "04/15/1988",
      subscriberId: "XYZ987654321",
      groupNumber: "GRP-4477",
      payerId: "NWIND01",
    };
    expect(scoreRegistration(legacy, expectedFor(JANE))).toBeLessThan(5);
  });
});

describe("saving registration updates the patient everywhere", () => {
  test("the card, the banner line and the claim read the one written record", () => {
    const before = patientCard(JANE);
    expect(before.memberId).toBe("NW-884210");

    // What Registration writes on Verify: one record, built from what was typed.
    const record = buildInsuranceRecord({
      primary: {
        payerName: "Meridian Health Plan",
        ediPayerId: "MERID01",
        subscriberId: "MH-9900112",
        groupNumber: "GRP-7788",
        relationshipToSubscriber: "Self",
        planName: "Meridian Choice",
      },
    });
    const updated = { ...JANE, insuranceRecord: record } as unknown as Patient;

    // The card (Registration + banner), the transcription form and the claim's
    // identity boxes all read that record — no second copy anywhere.
    expect(patientCard(updated).memberId).toBe("MH-9900112");
    expect(patientCard(updated).payerName).toBe("Meridian Health Plan");
    expect(registrationCardFor(updated).subscriberId).toBe("MH-9900112");
    const boxes = patientIdentityBoxes(updated);
    expect(boxes.insuredId).toBe("MH-9900112");
    expect(boxes.insuredPolicyGroup).toBe("GRP-7788");
    expect(boxes.payerName).toBe("Meridian Health Plan");
    expect(boxes.payerEdiId).toBe("MERID01");

    // The patient record it was read from is unchanged by any reader.
    expect(patientCard(JANE).memberId).toBe("NW-884210");
  });
});

describe("demo fill carries nothing from another patient", () => {
  const OTHER_PATIENT_FIELDS = [
    "insuredId",
    "insuredPolicyGroup",
    "insuredPlanName",
    "insuredEmployer",
    "otherInsuranceName",
    "similarIllnessQualifier",
    "similarIllnessDate",
    "unableToWorkFrom",
    "unableToWorkTo",
    "referringProvider",
    "referringNpi",
    "priorAuthNumber",
  ];

  test("boxes 23, 9c, 16, 17 and 17b are never filled with demo data", () => {
    for (const field of OTHER_PATIENT_FIELDS) {
      expect(DEMO_CLAIM_DATA[field]).toBeUndefined();
    }
    expect(Object.keys(DEMO_LINE_DATA)).toHaveLength(0);
  });

  test("applying demo fill leaves those boxes empty", () => {
    const values = Object.fromEntries(OTHER_PATIENT_FIELDS.map((f) => [f, ""]));
    const result = applyDemoFill(values, { patient: { mrn: "MRN-1001" } });
    for (const field of OTHER_PATIENT_FIELDS) {
      expect(result.values[field]).toBe("");
      expect(result.byField[field]).toBeUndefined();
    }
    // Nothing invented reaches the claim either.
    expect(JSON.stringify(result.values)).not.toContain("PA-2026-004418");
    expect(JSON.stringify(result.values)).not.toContain("RETIREE");
    expect(JSON.stringify(result.values)).not.toContain("CHEN, SARAH");
  });

  test("the demo that remains is built from the patient on screen", () => {
    const mine = applyDemoFill({}, { patient: { mrn: "MRN-1001" } });
    const theirs = applyDemoFill({}, { patient: { mrn: "MRN-1002" } });
    expect(String(mine.values.additionalInfo)).toContain("MRN-1001");
    expect(String(theirs.values.additionalInfo)).toContain("MRN-1002");
    expect(String(mine.values.additionalInfo)).not.toBe(String(theirs.values.additionalInfo));
    // With no patient on screen the marker names no chart at all.
    const none = applyDemoFill({}, {});
    expect(String(none.values.additionalInfo)).not.toContain("MRN");
  });
});
