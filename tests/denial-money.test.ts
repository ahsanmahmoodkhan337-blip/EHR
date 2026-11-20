/**
 * Denial money rules — the guardrail for TASK 0 item 1.
 *
 * A denial's group code decides who carries the money, and nothing else may
 * override it: a CO (contractual) line never leaves a patient balance, and an
 * OA (other payer) line never does either. These tests fail the moment a
 * screen, a case or a denial record starts telling a student to bill a patient
 * for a contractual write-off.
 */
import { describe, expect, test } from "bun:test";
import { DENTAL_DENIALS, DENTAL_CASE_SCENARIOS, findDenial, denialMoney } from "../src/data/dental";
import { MEDICAL_CASE_SCENARIOS } from "../src/data/medical";
import { CARC_BY_CODE } from "../src/data/claims/carc";

describe("denial records", () => {
  test("every CARC exists in the single table and its group letter matches groupCode", () => {
    for (const d of DENTAL_DENIALS) {
      const entry = CARC_BY_CODE[d.carc as keyof typeof CARC_BY_CODE];
      expect(entry, `${d.id} uses ${d.carc}, which is not in carc.ts`).toBeDefined();
      expect(d.carc.startsWith(`${d.groupCode}-`), `${d.id}: ${d.carc} vs group ${d.groupCode}`).toBe(true);
    }
  });

  test("no CO or OA denial is marked billable to the patient", () => {
    for (const d of DENTAL_DENIALS) {
      if (d.groupCode === "CO" || d.groupCode === "OA") {
        expect(d.patientBillable, `${d.id} (${d.carc}) is billable`).toBe(false);
      }
    }
  });

  test("denialMoney never gives a CO line a patient balance", () => {
    for (const d of DENTAL_DENIALS) {
      const money = denialMoney(d);
      expect(money.patientBalance).toBe(d.groupCode === "PR");
      expect(money.providerWriteOff).toBe(d.groupCode === "CO");
    }
  });
});

describe("case data", () => {
  for (const c of DENTAL_CASE_SCENARIOS) {
    test(`${c.id}: a CO denial carries no patient balance`, () => {
      for (const line of c.expectedOutcome) {
        const denial = line.denialId ? findDenial(line.denialId) : undefined;
        if (!denial || denial.groupCode !== "CO") continue;
        expect(line.patientOwesUsd, `${c.id} ${line.code} (${denial.carc}) bills the patient`).toBe(0);
        expect(line.contractualWriteOffUsd, `${c.id} ${line.code} write-off must equal the charge`).toBe(
          line.chargedUsd,
        );
      }
    });
  }
});

describe("medical case answer keys", () => {
  test("every CARC a medical case teaches exists in the single table", () => {
    for (const c of MEDICAL_CASE_SCENARIOS) {
      for (const line of c.expectedOutcome) {
        if (!line.carcCode) continue;
        expect(CARC_BY_CODE[line.carcCode], `${c.id} ${line.code} uses ${line.carcCode}`).toBeDefined();
      }
      for (const trap of c.traps) {
        if (!trap.producesDenialCarc) continue;
        expect(
          CARC_BY_CODE[trap.producesDenialCarc],
          `${c.id} ${trap.id} uses ${trap.producesDenialCarc}`,
        ).toBeDefined();
      }
    }
  });

  for (const c of MEDICAL_CASE_SCENARIOS) {
    test(`${c.id}: a CO line carries no patient balance`, () => {
      for (const line of c.expectedOutcome) {
        if (!line.carcCode?.startsWith("CO-")) continue;
        expect(line.patientOwesUsd, `${c.id} ${line.code} (${line.carcCode}) bills the patient`).toBe(0);
        expect(line.writeOffUsd, `${c.id} ${line.code} write-off must equal the charge`).toBe(line.chargedUsd);
      }
    });

    test(`${c.id}: the rubric adds up and can be passed`, () => {
      const { maxPoints, passingPoints, criteria } = c.gradingRubric;
      const sum = criteria.reduce((total, row) => total + row.points, 0);
      expect(sum, `${c.id} criteria total ${sum} against maxPoints ${maxPoints}`).toBe(maxPoints);
      expect(passingPoints, `${c.id} needs ${passingPoints} of ${maxPoints}`).toBeLessThanOrEqual(maxPoints);
    });
  }
});

describe("the item-1 rule", () => {
  test("frequency and age-cap denials are contractual write-offs", () => {
    for (const id of ["DEN-FREQ-XRAY", "DEN-FREQ-CROWN", "DEN-AGE-LIMIT"]) {
      const d = findDenial(id)!;
      expect(d.groupCode).toBe("CO");
      expect(denialMoney(d).patientBalance).toBe(false);
      expect(denialMoney(d).providerWriteOff).toBe(true);
    }
  });
});
