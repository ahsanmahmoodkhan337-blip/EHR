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
 *     read, so the screen and the engine cannot drift apart;
 *  4. a POS picked on a line that was already coded is written to that line's
 *     `placeOfService` on the claim the billing screen reads — the picker used
 *     to change only lines coded after it was set, so the claim stayed on POS 11
 *     and kept printing the CMS-1500.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { POS_REFERENCE } from "../src/components/CodingQueue/modifierPosData";
import { CLAIM_PAPER_RULE } from "../src/data/claims/claimType";
import { paperForPos } from "../src/domain/claimPaper";
import { applyCodingPlaceOfService, hasLineForCpt } from "../src/domain/codingPlaceOfService";
import {
  createEncounter,
  type ClaimFormData,
  type ClaimServiceLine,
  type PipelineEncounter,
} from "../src/store/pipelineEncounter";

const root = join(import.meta.dir, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

/** One box-24 row, as the Coder hands it over and as the claim carries it. */
const line = (cpt: string, placeOfService: string): ClaimServiceLine => ({
  dateOfService: "2026-11-22",
  placeOfService,
  cpt,
  modifiers: [],
  diagnosisPointer: "A",
  charge: 150,
  units: 1,
  renderingNpi: "1999999999",
});

/** An encounter already coded at POS 11 whose claim exists at POS 11. */
function codedEncounter(): PipelineEncounter {
  return {
    ...createEncounter("EMILY"),
    codingLines: [line("99213", "11")],
    claimForm: { serviceLines: [line("99213", "11")] } as unknown as ClaimFormData,
  };
}

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

describe("a picker change lands on the service line the biller reads", () => {
  test("POS 22 on an already-coded line is written to the claim's own line", () => {
    const after = applyCodingPlaceOfService(codedEncounter(), "99213", "22");

    expect(after.claimForm?.serviceLines[0].placeOfService).toBe("22");
    expect(after.codingLines[0].placeOfService).toBe("22");
  });

  test("the claim then bills on the UB-04 as an 837I, not the CMS-1500", () => {
    const after = applyCodingPlaceOfService(codedEncounter(), "99213", "22");
    const paper = paperForPos({
      placeOfService: after.claimForm?.serviceLines[0].placeOfService ?? "",
      posDescription: "Outpatient hospital",
    });

    expect(paper.paper).toBe("UB-04 (CMS-1450)");
    expect(paper.x12).toBe("837I");
  });

  test("the value is on the stored record, so a reload keeps the UB-04", () => {
    const after = applyCodingPlaceOfService(codedEncounter(), "99213", "22");
    const reloaded = JSON.parse(JSON.stringify(after)) as PipelineEncounter;

    expect(reloaded.claimForm?.serviceLines[0].placeOfService).toBe("22");
    expect(reloaded.codingLines[0].placeOfService).toBe("22");
  });

  test("only the line the picker touched changes", () => {
    const enc = codedEncounter();
    enc.codingLines = [line("99213", "11"), line("99214", "11")];
    const after = applyCodingPlaceOfService(enc, "99213", "22");

    expect(after.claimForm?.serviceLines[0].placeOfService).toBe("22");
    expect(after.codingLines[1].placeOfService).toBe("11");
  });

  test("a CPT with no line yet writes nothing", () => {
    expect(hasLineForCpt(createEncounter("EMILY"), "99213")).toBe(false);
  });

  test("the picker's onChange writes the choice through the store action", () => {
    const coding = read("src/components/CodingQueue/CodingQueue.tsx");
    expect(coding).toContain("setCodingLinePlaceOfService(cpt.code, chosen)");
    const store = read("src/store/pipelineStore.tsx");
    expect(store).toContain("applyCodingPlaceOfService(enc, cpt, placeOfService)");
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
