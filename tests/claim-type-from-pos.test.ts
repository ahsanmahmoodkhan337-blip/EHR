/**
 * claim-type-from-pos.test.ts — Phase 3, first slice.
 *
 * Three rules, each pinned here:
 *
 *  1. the claim type follows the place of service — 837P professional, 837I
 *     institutional, 837D dental — and selects the matching paper;
 *  2. the principal diagnosis is first-listed on the claim (box 21 A on the
 *     CMS-1500, box 67 on the UB-04);
 *  3. there is exactly one scrub control on the biller's screen.
 *
 * A wrong POS is flagged with the denial it would earn (CO-16 / MA130) and is
 * never rewritten for the student.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  checkPlaceOfService,
  claimTypeFromPos,
  paperForPos,
  principalDiagnosisOf,
} from "../src/domain/claimPaper";
import { validateCMS1500, validateUB04 } from "../src/utils/claimValidation";
import { blankClaimForm, buildClaimForm } from "../src/utils/claimAutoFill";
import type { ClaimFormData } from "../src/store/pipelineStore";
import type { PipelineState } from "../src/store/pipelineStore";

const root = join(import.meta.dir, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const form = (patch: Partial<ClaimFormData>): ClaimFormData => ({ ...blankClaimForm(), ...patch });

describe("the claim type follows the place of service", () => {
  test("POS 11 bills professional on the CMS-1500 as an 837P", () => {
    const paper = paperForPos({ placeOfService: "11", posDescription: "Office" });
    expect(paper.claimType).toBe("professional");
    expect(paper.paper).toBe("CMS-1500 (02/12)");
    expect(paper.x12).toBe("837P");
  });

  test("POS 21, 22 and 23 bill institutional on the UB-04 as an 837I", () => {
    for (const pos of ["21", "22", "23"]) {
      const paper = paperForPos({ placeOfService: pos });
      expect(paper.claimType, `POS ${pos}`).toBe("institutional");
      expect(paper.paper, `POS ${pos}`).toBe("UB-04 (CMS-1450)");
      expect(paper.x12, `POS ${pos}`).toBe("837I");
    }
  });

  test("a dental encounter bills dental on the ADA form as an 837D", () => {
    const paper = paperForPos({ placeOfService: "11", track: "dental" });
    expect(paper.claimType).toBe("dental");
    expect(paper.paper).toBe("ADA Dental Claim (J430D)");
    expect(paper.x12).toBe("837D");
  });

  test("the paper is derived from the POS, never read off the stored claim type", () => {
    // A claim written by the build that let the biller pick a paper carries
    // `claimType: "dental"`; its POS is an office visit, so it prints on the
    // CMS-1500. Nothing in the derivation reads the stored value.
    expect(claimTypeFromPos({ placeOfService: "11" })).toBe("professional");
    const src = read("src/components/BillingLedger/BillingLedger.tsx");
    expect(src).not.toContain("claimForm?.claimType ??");
    expect(src).toContain("const claimType: ClaimType = paper.claimType;");
  });

  test("the encounter's POS reaches the claim's box 24B lines", () => {
    const pipeline = {
      cptCodes: ["99213"],
      icdCodes: ["J06.9"],
      codingLines: [],
    } as unknown as PipelineState;
    const built = buildClaimForm({ pipeline, placeOfService: "23", encounterDate: "2026-11-20" });
    expect(built.serviceLines.length).toBeGreaterThan(0);
    for (const line of built.serviceLines) expect(line.placeOfService).toBe("23");
  });
});

describe("a wrong place of service is flagged with the denial it earns", () => {
  test("claim POS 11 on an encounter registered at POS 23 earns CO-16 with MA130", () => {
    const check = checkPlaceOfService({
      claimPos: "11",
      encounterPos: "23",
      linePositions: ["11"],
      posDescription: "Office",
    });
    expect(check.denial).not.toBeNull();
    expect(check.denial?.group).toBe("CO");
    expect(check.denial?.carc).toBe("CO-16");
    expect(check.denial?.rarc).toBe("MA130");
    expect(check.denial?.message).toContain("POS 23");
    expect(check.denial?.message).toContain("POS 11");
  });

  test("the POS is never corrected for the student", () => {
    const check = checkPlaceOfService({ claimPos: "11", encounterPos: "23", linePositions: ["11"] });
    expect(check.claimPos).toBe("11");
    expect(check.encounterPos).toBe("23");
    expect(check.denial?.message).toContain("left as you typed it");
    // The paper still follows the POS as submitted: an office POS is a CMS-1500.
    expect(check.paper.claimType).toBe("professional");
  });

  test("two places of service on one claim are flagged too", () => {
    const check = checkPlaceOfService({ claimPos: "11", encounterPos: "11", linePositions: ["11", "21"] });
    expect(check.denial?.carc).toBe("CO-16");
    expect(check.linePositions).toEqual(["11", "21"]);
  });

  test("a POS that matches the encounter raises no denial", () => {
    const check = checkPlaceOfService({ claimPos: "23", encounterPos: "23", linePositions: ["23"] });
    expect(check.denial).toBeNull();
    expect(check.paper.x12).toBe("837I");
  });
});

describe("the principal diagnosis is first-listed", () => {
  test("the principal is the first code of the Coder's final list", () => {
    expect(principalDiagnosisOf(["M54.5", "J06.9"], "")).toBe("M54.5");
    expect(principalDiagnosisOf([], "j06.9")).toBe("J06.9");
  });

  test("CMS-1500 box 21 flags a secondary code listed first, with its denial", () => {
    const issues = validateCMS1500(form({ diagnosisCodes: ["J06.9", "M54.5"] }), {
      principalDiagnosis: "M54.5",
    });
    const issue = issues.find((i) => i.box === "21" && /principal diagnosis/.test(i.message));
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("error");
    expect(issue?.message).toContain("CO-11");
    expect(issue?.message).toContain("M54.5");
  });

  test("CMS-1500 box 21 passes when the principal is code A", () => {
    const issues = validateCMS1500(form({ diagnosisCodes: ["M54.5", "J06.9"] }), {
      principalDiagnosis: "M54.5",
    });
    expect(issues.find((i) => /principal diagnosis/.test(i.message))).toBeUndefined();
  });

  test("UB-04 box 67 must carry the principal, not another code from the list", () => {
    const issues = validateUB04(
      form({ principalDiagnosis: "J06.9", typeOfBill: "131", statementFrom: "2026-11-20", statementThrough: "2026-11-20" }),
      { principalDiagnosis: "M54.5" },
    );
    const issue = issues.find((i) => i.box === "67" && /principal diagnosis/.test(i.message));
    expect(issue).toBeDefined();
    expect(issue?.message).toContain("M54.5");
    expect(issue?.message).toContain("CO-11");
  });
});

describe("exactly one scrub control on the biller's screen", () => {
  const src = read("src/components/BillingLedger/BillingLedger.tsx");

  test("one button runs the scrub, and it says so", () => {
    expect(src.match(/onClick=\{runScrubber\}/g)?.length).toBe(1);
    expect(src).toContain("Scrub claim");
  });

  test("the dead Claim Scrubber tab is gone", () => {
    expect(src).not.toContain('key: "scrubber"');
    expect(src).not.toContain('label: "Claim Scrubber"');
    expect(src).not.toContain("Run Clearinghouse Scrubber");
  });

  test("the POS is read from the claim, not from a second loose field", () => {
    expect(src).not.toContain("posCodeInput");
    expect(src).not.toContain("setPosCode");
  });
});
