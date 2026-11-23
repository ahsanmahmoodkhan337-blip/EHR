/**
 * The patient record is the truth, and demo-fill never imports another patient's
 * world — spec `slice-i-patient-record.md` items 2 and 3.
 *
 * Item 2: the name, date of birth, payer, member ID and group saved at
 * Registration are written to the patient record, and the banner, eligibility,
 * claim and 835 read that record. Before 2026-11-21 the Biller's screen kept a
 * local `useState("Medicare")`, so a payer saved at Registration reached the
 * banner, eligibility and the printed paper but never the 277CA or the 835.
 *
 * Item 3: boxes 9c, 16, 17 / 17b and 23 are never filled with another patient's
 * world. Box 23 carries only this encounter's own authorisation, matched against
 * its coded procedures; with none it stays blank and its provenance names the
 * stage that fills it.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { claimPayer, patientCard } from "../src/domain/patientCard";
import { priorAuthForClaim } from "../src/domain/priorAuthNumber";
import { patientIdentityBoxes, reseedIdentityBoxes, blankClaimForm } from "../src/utils/claimAutoFill";
import { applyDemoFill, unfilledBoxes } from "../src/utils/demoClaimFill";
import { DEMO_CLAIM_DATA, UNFILLED_BOX_SOURCES } from "../src/data/claims/demoClaimData";
import { buildInsuranceRecord } from "../src/utils/insuranceRecord";
import { planForPayerName } from "../src/domain/adjudication";
import type { Patient } from "../src/store/patientStore";

const ROOT = join(import.meta.dir, "..");
const read = (relative: string) => readFileSync(join(ROOT, relative), "utf8");
const BILLING = read("src/components/BillingLedger/BillingLedger.tsx");
const STORE = read("src/store/ehrStore.ts");

/** A chart the student registered themselves: no coverage, no identifiers. */
function chart(over: Record<string, unknown> = {}): Patient {
  return {
    id: "P-OWN-1",
    mrn: "MRN-2001",
    firstName: "Amara",
    lastName: "Okafor",
    dateOfBirth: "1991-06-02",
    gender: "Female",
    address: "88 Cedar Ave, Boise, ID 83702",
    insurance: "",
    insuranceRecord: null,
    ...over,
  } as unknown as Patient;
}

describe("item 2 — saving registration updates the patient everywhere", () => {
  // The exact record RegistrationStage writes on Verify.
  const saved = buildInsuranceRecord({
    primary: {
      payerName: "Cascadia Health Plan",
      planName: "Cascadia Choice PPO",
      ediPayerId: "CASC01",
      subscriberId: "CSC-778812",
      groupNumber: "CAS-90210",
      relationshipToSubscriber: "Self",
    },
  });

  test("the payer, member ID and group land on the patient's own card", () => {
    const patient = chart({ insuranceRecord: saved });
    const card = patientCard(patient);
    expect(card.payerName).toBe("Cascadia Health Plan");
    expect(card.planName).toBe("Cascadia Choice PPO");
    expect(card.memberId).toBe("CSC-778812");
    expect(card.groupNumber).toBe("CAS-90210");
    expect(card.payerId).toBe("CASC01");
  });

  test("the claim's identity boxes read the saved record", () => {
    const boxes = patientIdentityBoxes(chart({ insuranceRecord: saved }));
    expect(boxes.insuredId).toBe("CSC-778812"); // box 1a
    expect(boxes.insuredPolicyGroup).toBe("CAS-90210"); // box 11
    expect(boxes.insuredPlanName).toBe("Cascadia Choice PPO"); // box 11c
    expect(boxes.payerName).toBe("Cascadia Health Plan"); // UB-04 boxes 50 / 51
    expect(boxes.payerEdiId).toBe("CASC01");
  });

  test("a claim opened before Registration re-seeds onto the saved payer", () => {
    // The claim was opened on the blank chart, so it carries no card.
    const before = chart();
    const claim = { ...blankClaimForm(), ...patientIdentityBoxes(before) };
    expect(claim.insuredId).toBe("");

    const patch = reseedIdentityBoxes(claim, chart({ insuranceRecord: saved }));
    expect(patch.insuredId).toBe("CSC-778812");
    expect(patch.insuredPolicyGroup).toBe("CAS-90210");
    expect(patch.payerName).toBe("Cascadia Health Plan");
  });

  test("the 277CA and 835 name the payer on the record, not a screen default", () => {
    const patient = chart({ insuranceRecord: saved });
    expect(claimPayer(patient, "")).toBe("Cascadia Health Plan");
    // …and the 835 prices on that payer's plan.
    expect(planForPayerName(claimPayer(patient, ""))?.id).toBe("PLAN-CASCADIA-HEALTH-PPO");

    // The Biller's screen no longer starts from a constant.
    expect(BILLING).toContain("claimPayer(patient, claimForm?.payerName)");
    expect(BILLING).not.toContain('useState("Medicare")');
    // The 277CA, the 835 and the money sentences all use that one payer.
    expect(BILLING).toContain("payerName: payer");
    expect(BILLING).toContain("adjudicateClaim({ payerName: payer })");
  });

  test("the patient's payer label is written with the record — one write, one place", () => {
    // Older screens (the patient list, the chart header) print the free-text
    // label; writing the record alone left them showing the previous payer.
    expect(STORE).toContain("insurance: payerLabel");
    expect(STORE).toContain("record.primary.payerName?.trim() || existing.insurance");
  });

  test("a patient with no payer falls back to the claim's own value, never a default", () => {
    expect(claimPayer(chart(), "")).toBe("");
    expect(claimPayer(undefined, "Meridian Health Plan")).toBe("Meridian Health Plan");
    expect(claimPayer(undefined, null)).toBe("");
  });
});

describe("item 3 — demo-fill never imports another patient's world", () => {
  const borrowed = [
    "insuredEmployer", // 9c — RETIREE — MEDFORD CITY SCHOOLS
    "unableToWorkFrom", // 16
    "unableToWorkTo", // 16
    "referringProvider", // 17 — CHEN, SARAH, MD
    "referringNpi", // 17b
    "priorAuthNumber", // 23 — PA-2026-004418
  ];

  test("no demo value exists for boxes 9c, 16, 17, 17b or 23", () => {
    for (const field of borrowed) {
      expect(DEMO_CLAIM_DATA[field]).toBeUndefined();
      expect(UNFILLED_BOX_SOURCES[field]).toBeDefined();
    }
  });

  test("a blank claim renders none of those boxes", () => {
    const { values, boxes } = applyDemoFill({});
    for (const field of borrowed) {
      expect(values[field]).toBeUndefined();
      expect(boxes.some((b) => b.field === field)).toBe(false);
    }
    expect(Object.values(values)).not.toContain("PA-2026-004418");
    expect(Object.values(values)).not.toContain("CHEN, SARAH, MD");
    expect(Object.values(values)).not.toContain("RETIREE — MEDFORD CITY SCHOOLS");
  });

  test("each blank box names the stage that should have filled it", () => {
    const blank = unfilledBoxes({});
    const boxes = blank.map((b) => b.box);
    // Box 15 is one printed box with two fields and box 16 likewise: each is
    // listed once. Boxes 1a, 9, 11, 11c, 15 and 19 joined this list on
    // 2026-11-21 (slice J item 4b) — they used to print the tutorial case's
    // member ID, group, plan, symptom date and training note. Boxes 11b and 17a
    // joined on 2026-11-23 (`specs/blank-field-sweep.md` §E): each has a field on
    // the paper and no stage that captures it, so it reads "Undetermined" rather
    // than sitting unnamed.
    expect(boxes).toEqual(["1a", "9", "11", "11b", "11c", "15", "19", "9c", "16", "17", "17a", "17b", "23"]);
    const box23 = blank.find((b) => b.box === "23");
    expect(box23?.stage).toContain("Prior authorization");
    expect(box23?.value).toBe("");
  });

  test("a box the encounter filled drops off the blank list", () => {
    const blank = unfilledBoxes({ priorAuthNumber: "PA-1-ABC", referringProvider: "KIM, JO, MD" });
    expect(blank.some((b) => b.box === "23")).toBe(false);
    expect(blank.some((b) => b.box === "17")).toBe(false);
  });
});

describe("item 3 — box 23 carries only this encounter's authorisation", () => {
  test("no PA on the encounter leaves box 23 empty", () => {
    expect(priorAuthForClaim({ paData: {}, cptCodes: ["99213"] })).toBe("");
    expect(priorAuthForClaim({})).toBe("");
    expect(priorAuthForClaim()).toBe("");
  });

  test("this encounter's own PA is printed", () => {
    const paData = { paId: "PA-2026-77", cptCodes: "27447, 99213", procedure: "Total knee" };
    expect(priorAuthForClaim({ paData, cptCodes: ["99213"] })).toBe("PA-2026-77");
  });

  test("a PA for a procedure this encounter did not perform is not printed", () => {
    const paData = { paId: "PA-2026-78", cptCodes: "27447" };
    expect(priorAuthForClaim({ paData, cptCodes: ["99213", "99214"] })).toBe("");
  });

  test("the Biller's screen seeds box 23 from the encounter, not the patient's last PA", () => {
    expect(BILLING).toContain("priorAuthForClaim({ paData: state.paData, cptCodes: state.cptCodes })");
    expect(BILLING).not.toContain("paRecords.filter((r) => r.patientId === patientId).slice(-1)[0]?.id");
  });
});
