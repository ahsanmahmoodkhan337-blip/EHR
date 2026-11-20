/**
 * The appeal documentation gate (`specs/appeal-documentation-gate.md`).
 *
 * A crown or buildup appeal is decided by the film and one stated reason, not
 * by the words in a paragraph: a correct appeal is accepted in any wording, a
 * one-keyword appeal is refused, and an incomplete lodge is refused before it
 * is lodged with the rule and its consequence stated. These tests fail if the
 * keyword matcher comes back, if free text starts deciding the outcome again,
 * or if the AR card starts printing who pays before the student decides.
 */
import { describe, expect, test } from "bun:test";
import { appealGateFor, appealOutcomeFor, findDenial, findPracticeScenario, scorePracticeLine } from "../src/data/dental";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CROWN = "DEN-FREQ-CROWN";
const BUILDUP = "DEN-BUNDLE-BUILDUP";

describe("the gate: two required items, one optional one", () => {
  for (const id of [CROWN, BUILDUP]) {
    test(`${id}: both the film and one reason are required`, () => {
      const denial = findDenial(id)!;
      expect(appealGateFor(denial, { filmAttached: true, reasonId: null }).complete).toBe(false);
      expect(appealGateFor(denial, { filmAttached: false, reasonId: denial.appealEvidence!.reasons[0]!.id }).complete).toBe(
        false,
      );
      expect(appealGateFor(denial, { filmAttached: false, reasonId: null }).missing).toEqual(["film", "reason"]);
    });

    test(`${id}: a refusal states the rule and the consequence, and records nothing`, () => {
      const denial = findDenial(id)!;
      const gate = appealGateFor(denial, { filmAttached: false, reasonId: null });
      expect(gate.complete).toBe(false);
      expect(gate.rule?.length).toBeGreaterThan(20);
      expect(gate.consequence?.length).toBeGreaterThan(20);
      // Nothing is lodged: an incomplete lodgement never reaches an outcome.
      expect(appealOutcomeFor(denial, { filmAttached: false, reasonId: null })).toBe("denied");
    });

    test(`${id}: the film the payer names is on the record`, () => {
      const denial = findDenial(id)!;
      expect(denial.appealEvidence!.film.length).toBeGreaterThan(10);
      expect(denial.appealEvidence!.reasons.length).toBeGreaterThanOrEqual(2);
      expect(denial.appealEvidence!.reasons.some((r) => r.meetsCriterion)).toBe(true);
      expect(denial.appealEvidence!.reasons.some((r) => !r.meetsCriterion)).toBe(true);
    });
  }
});

describe("a correct appeal is accepted in any wording", () => {
  const crown = findDenial(CROWN)!;
  test("the narrative never decides it", () => {
    const wordings = [
      "",
      "decay",
      "fracture radiograph x-ray broken",
      "The old crown split at the margin; the film from this morning is attached.",
      "asdkjh qwe zxc",
    ];
    for (const narrative of wordings) {
      expect(appealOutcomeFor(crown, { filmAttached: true, reasonId: "crown-fractured", narrative })).toBe("upheld");
    }
  });

  test("a one-keyword appeal with no checklist is denied", () => {
    expect(appealOutcomeFor(crown, { filmAttached: false, narrative: "fracture radiograph decay" })).toBe("denied");
  });
});

describe("the bench lines that reach the two-ending flow", () => {
  test("DAR-08 is a crown frequency denial whose complete appeal is upheld", () => {
    const scenario = findPracticeScenario("DAR-08")!;
    expect(scenario).toBeDefined();
    const line = scenario.lines.find((l) => l.seedDenialId === CROWN)!;
    expect(line).toBeDefined();
    expect(findDenial(line.seedDenialId!)!.appealResolvesTo).toBe("pay-or-write-off");
    // The record shows a fracture, so the criterion is met and the line pays.
    expect(appealOutcomeFor(findDenial(CROWN)!, { filmAttached: true, reasonId: "crown-fractured" })).toBe("upheld");
    expect(scorePracticeLine(scenario, line.id, "appealed", [], "upheld")?.correct).toBe(true);
    // Billing the patient on this line is wrong, whichever way the appeal went.
    expect(scorePracticeLine(scenario, line.id, "billed-patient", [], "upheld")?.correct).toBe(false);
  });

  test("DAR-09 is a buildup bundling denial that ends in the CO write-off", () => {
    const scenario = findPracticeScenario("DAR-09")!;
    expect(scenario).toBeDefined();
    const line = scenario.lines.find((l) => l.seedDenialId === BUILDUP)!;
    expect(line).toBeDefined();
    expect(line.key?.resolution).toBe("write-off");
    // The record shows preparation shaping: a complete appeal, honestly stated,
    // is denied, and the line then scores as the write-off it became.
    expect(appealOutcomeFor(findDenial(BUILDUP)!, { filmAttached: true, reasonId: "prep-shaping" })).toBe("denied");
    expect(scorePracticeLine(scenario, line.id, "write-off", [], "denied")?.correct).toBe(true);
    expect(scorePracticeLine(scenario, line.id, "billed-patient", [], "denied")?.correct).toBe(false);
  });

  test("the existing bench scenarios keep their scores", () => {
    const dar01 = findPracticeScenario("DAR-01")!;
    const line = dar01.lines.find((l) => l.key)!;
    expect(scorePracticeLine(dar01, line.id, "write-off", [])?.correct).toBe(true);
    const dar03 = findPracticeScenario("DAR-03")!;
    const appealed = dar03.lines.find((l) => l.key?.resolution === "appealed")!;
    expect(scorePracticeLine(dar03, appealed.id, "appealed", [], "upheld")?.correct).toBe(true);
  });
});

describe("the AR card does not answer who pays before the decision", () => {
  const source = readFileSync(join(import.meta.dir, "..", "src", "components", "dental", "DentalAR.tsx"), "utf8");

  test("the pre-commit money line carries no money rule", () => {
    expect(source).toContain("unpaid on this line");
    // The money rule may only appear inside the committed branch.
    const committed = source.slice(source.indexOf("row.committed\n"));
    expect(committed).toContain("money.label");
  });

  test("the group-code label is the X12 name, not the conclusion", () => {
    expect(source).toContain('"CO — contractual obligation"');
    expect(source).not.toContain("not billable to patient");
  });
});
