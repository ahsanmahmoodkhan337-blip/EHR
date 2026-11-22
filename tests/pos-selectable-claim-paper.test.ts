/**
 * pos-selectable-claim-paper.test.ts — the institutional POS is reachable, and
 * the claim-type line states which paper follows which place of service.
 *
 * Three rules pinned here:
 *
 *  1. POS 21, 22 and 23 are selectable in the Coding stage's place-of-service
 *     control (a picker built from `POS_REFERENCE`, not a free-text box);
 *  2. the paper follows the POS — 11 → CMS-1500 (837P), 21/22/23 → UB-04
 *     (837I), dental → ADA J430D (837D);
 *  3. the biller's claim-type line states that rule in the same words the tests
 *     read, so the screen and the engine cannot drift apart.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { POS_REFERENCE } from "../src/components/CodingQueue/modifierPosData";
import { CLAIM_PAPER_RULE } from "../src/data/claims/claimType";
import { paperForPos } from "../src/domain/claimPaper";

const root = join(import.meta.dir, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("the institutional places of service are selectable at Coding", () => {
  test("POS 21, 22 and 23 are options in the reference the picker is built from", () => {
    const codes = POS_REFERENCE.map((p) => p.code);
    for (const pos of ["11", "21", "22", "23"]) {
      expect(codes, `POS ${pos}`).toContain(pos);
    }
  });

  test("the place-of-service control is a picker over POS_REFERENCE, not a text box", () => {
    const src = read("src/components/CodingQueue/CodingQueue.tsx");
    // The 24B control is a <select> fed by the reference table.
    expect(src).toContain("id={`pos-${cpt.code}`}");
    expect(src).toMatch(/<select[\s\S]{0,400}id=\{`pos-\$\{cpt\.code\}`\}/);
    expect(src).toContain("{POS_REFERENCE.map(p => (");
    // A text input at the POS control would let a student type a code that
    // selects no paper; that is the bug this replaced.
    expect(src).not.toMatch(/id=\{`pos-\$\{cpt\.code\}`\}[\s\S]{0,120}type="text"/);
  });

  test("a POS saved by an older build stays selectable, so a stored claim never changes", () => {
    const src = read("src/components/CodingQueue/CodingQueue.tsx");
    expect(src).toContain("!POS_REFERENCE.some(p => p.code === data.pos)");
  });
});

describe("each place of service picks its own paper", () => {
  test("POS 11 → CMS-1500 (02/12) as an 837P", () => {
    const paper = paperForPos({ placeOfService: "11", posDescription: "Office" });
    expect(paper.claimType).toBe("professional");
    expect(paper.paper).toBe("CMS-1500 (02/12)");
    expect(paper.x12).toBe("837P");
  });

  test("POS 21 → UB-04 (CMS-1450) as an 837I", () => {
    const paper = paperForPos({ placeOfService: "21", posDescription: "Inpatient hospital" });
    expect(paper.claimType).toBe("institutional");
    expect(paper.paper).toBe("UB-04 (CMS-1450)");
    expect(paper.x12).toBe("837I");
    expect(paper.reason).toContain("POS 21");
  });

  test("POS 22 → UB-04 (CMS-1450) as an 837I", () => {
    const paper = paperForPos({ placeOfService: "22", posDescription: "Outpatient hospital" });
    expect(paper.claimType).toBe("institutional");
    expect(paper.paper).toBe("UB-04 (CMS-1450)");
    expect(paper.x12).toBe("837I");
  });

  test("POS 23 → UB-04 (CMS-1450) as an 837I", () => {
    const paper = paperForPos({ placeOfService: "23", posDescription: "Emergency room — hospital" });
    expect(paper.claimType).toBe("institutional");
    expect(paper.paper).toBe("UB-04 (CMS-1450)");
    expect(paper.x12).toBe("837I");
  });

  test("a dental encounter → ADA Dental Claim (J430D) as an 837D, whatever the POS", () => {
    for (const pos of ["11", "21", "23"]) {
      const paper = paperForPos({ placeOfService: pos, track: "dental" });
      expect(paper.claimType, `POS ${pos}`).toBe("dental");
      expect(paper.paper, `POS ${pos}`).toBe("ADA Dental Claim (J430D)");
      expect(paper.x12, `POS ${pos}`).toBe("837D");
    }
  });
});

describe("the claim-type line states the rule", () => {
  test("the rule names all three papers and the POS that picks each", () => {
    expect(CLAIM_PAPER_RULE).toContain("POS 11");
    expect(CLAIM_PAPER_RULE).toContain("CMS-1500");
    expect(CLAIM_PAPER_RULE).toContain("837P");
    expect(CLAIM_PAPER_RULE).toContain("POS 21/22/23");
    expect(CLAIM_PAPER_RULE).toContain("UB-04");
    expect(CLAIM_PAPER_RULE).toContain("837I");
    expect(CLAIM_PAPER_RULE).toContain("dental");
    expect(CLAIM_PAPER_RULE).toContain("J430D");
    expect(CLAIM_PAPER_RULE).toContain("837D");
  });

  test("the biller's claim-type line renders that rule, not a second copy of it", () => {
    const src = read("src/components/BillingLedger/BillingLedger.tsx");
    expect(src).toContain("CLAIM_PAPER_RULE");
    expect(src).toContain('data-testid="claim-paper-rule"');
    expect(src).toContain("{CLAIM_PAPER_RULE}");
  });
});
