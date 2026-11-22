/**
 * The seeded institutional practice case — MCASE-010.
 *
 * It exists so a student meets the UB-04 by walking a case, not by inventing a
 * place of service. These assertions hold the case's record and the paper it
 * draws together: place of service 22, type of bill 131, and two revenue codes,
 * each one valid for an outpatient bill.
 */

import { describe, expect, test } from "bun:test";
import { MEDICAL_CASE_SCENARIOS, findCase } from "../src/data/medical/caseScenarios";
import { REVENUE_CODES_BY_CODE } from "../src/data/claims/revenueCodes";
import { caseClaimPaper, caseTypeOfBill } from "../src/domain/caseClaimPaper";

describe("MCASE-010 — the institutional practice case", () => {
  const scenario = findCase("MCASE-010");

  test("is seeded and listed with the other practice cases", () => {
    expect(scenario).toBeDefined();
    expect(MEDICAL_CASE_SCENARIOS.some((c) => c.id === "MCASE-010")).toBe(true);
  });

  test("carries place of service 22 and type of bill 131", () => {
    expect(scenario!.placeOfService).toBe("22");
    expect(caseTypeOfBill(scenario!)).toBe("131");
  });

  test("its two lines carry two different, outpatient-valid revenue codes", () => {
    const codes = scenario!.procedures.map((p) => p.revenueCode ?? "");
    expect(codes).toEqual(["0320", "0300"]);
    expect(new Set(codes).size).toBe(2);
    for (const code of codes) {
      const row = REVENUE_CODES_BY_CODE[code];
      expect(row).toBeDefined();
      expect(row.appliesTo === "outpatient" || row.appliesTo === "both").toBe(true);
    }
  });

  test("the paper it draws is the UB-04, from the case's own record", () => {
    const paper = caseClaimPaper(
      scenario!,
      scenario!.procedures.map((p) => ({ code: p.code })),
    );
    expect(paper.claimType).toBe("institutional");
    expect(paper.paper).toContain("UB-04");
    expect(paper.x12).toBe("837I");
    expect(paper.typeOfBill).toBe("131");
    expect(paper.values.typeOfBill).toBe("131");
    expect(paper.lines.map((l) => l.revenueCode)).toEqual(["0320", "0300"]);
    expect(paper.lines.every((l) => l.revenueDescription.length > 0)).toBe(true);
  });

  test("the professional cases stay on the CMS-1500 with no revenue codes", () => {
    for (const c of MEDICAL_CASE_SCENARIOS.filter((x) => x.id !== "MCASE-010")) {
      const paper = caseClaimPaper(c, c.procedures.map((p) => ({ code: p.code })));
      expect(paper.claimType).toBe("professional");
      expect(paper.paper).toContain("CMS-1500");
      expect(paper.lines.every((l) => l.revenueCode === "")).toBe(true);
    }
  });
});
