/**
 * The seeded dental practice case that prints the ADA form — DCASE-010.
 *
 * It exists so a student meets the ADA Dental Claim Form 2019 (J430D) built from
 * a case's own record, the dental counterpart of MCASE-010's UB-04. These
 * assertions hold the case's record and the paper it draws together: the tooth,
 * the surface letters and the quadrant in box 31 are the ones the case charted,
 * and the fee on each line is the case's own.
 */

import { describe, expect, test } from "bun:test";
import { DENTAL_CASE_SCENARIOS, findCase } from "../src/data/dental/caseScenarios";
import { dentalCaseClaimPaper } from "../src/domain/dentalCaseClaimPaper";

describe("DCASE-010 — the dental case that prints the ADA form", () => {
  const scenario = findCase("DCASE-010");

  test("is seeded, listed, and marked as drawn from its own record", () => {
    expect(scenario).toBeDefined();
    expect(DENTAL_CASE_SCENARIOS.some((c) => c.id === "DCASE-010")).toBe(true);
    expect(scenario!.claimPaperFromRecord).toBe(true);
  });

  test("the paper it draws is the ADA 2019 (J430D), as an 837D", () => {
    const paper = dentalCaseClaimPaper(
      scenario!,
      scenario!.procedures.map((p) => ({ code: p.code })),
    );
    expect(paper.paper).toContain("ADA Dental Claim Form 2019");
    expect(paper.paper).toContain("J430D");
    expect(paper.x12).toBe("837D");
  });

  test("box 31 carries the case's own tooth, surface, quadrant and fee", () => {
    const paper = dentalCaseClaimPaper(
      scenario!,
      scenario!.procedures.map((p) => ({ code: p.code })),
    );
    expect(paper.lines.map((l) => l.cdt)).toEqual(["D0274", "D2392", "D4341"]);
    expect(paper.lines[1].tooth).toBe("19");
    expect(paper.lines[1].surface).toBe("MO");
    expect(paper.lines[2].quadrant).toBe("10");
    expect(paper.lines.map((l) => l.fee)).toEqual([78, 248, 312]);
    expect(paper.values.totalFee).toBe(638);
    expect(paper.lines.every((l) => l.description.length > 0)).toBe(true);
  });

  test("a code the case never recorded still prints, with nothing invented for it", () => {
    const paper = dentalCaseClaimPaper(scenario!, [{ code: "D9999" }]);
    expect(paper.lines).toHaveLength(1);
    expect(paper.lines[0].cdt).toBe("D9999");
    expect(paper.lines[0].tooth).toBe("");
    expect(paper.lines[0].fee).toBe(0);
    expect(paper.values.totalFee).toBe(0);
  });

  test("the other dental cases keep the sheet the student fills in", () => {
    for (const c of DENTAL_CASE_SCENARIOS.filter((x) => x.id !== "DCASE-010")) {
      expect(c.claimPaperFromRecord ?? false).toBe(false);
    }
  });
});
