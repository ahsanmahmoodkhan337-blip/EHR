/**
 * The AR card prints what happened to the money, not the denial's standing rule
 * (`specs/appeal-then-write-off.md`). An upheld appeal released the allowed
 * amount, so that line must read as paid with a $0.00 patient balance — never
 * as a contractual write-off beside the same released amount. The denied ending
 * keeps the CO write-off sentence, and an unappealed line keeps the rule it had.
 */
import { describe, expect, test } from "bun:test";
import { findDenial, settledLineMoney } from "../src/data/dental";

const amounts = { allowedUsd: 1040, planPaysUsd: 0, writeOffUsd: 1240, patientOwesUsd: 0 };

describe("settledLineMoney", () => {
  test("an upheld appeal reads as paid, with nothing written off", () => {
    const settled = settledLineMoney(findDenial("DEN-FREQ-CROWN")!, "upheld", amounts);
    expect(settled.displayUsd).toBe(1040);
    expect(settled.planPaysUsd).toBe(1040);
    expect(settled.writeOffUsd).toBe(0);
    expect(settled.patientOwesUsd).toBe(0);
    expect(settled.label).toContain("paid by the plan");
    expect(settled.label).toContain("$0.00");
    expect(settled.label).not.toContain("write-off");
  });

  test("a denied appeal still reads as the contractual write-off", () => {
    const settled = settledLineMoney(findDenial("DEN-FREQ-CROWN")!, "denied", amounts);
    expect(settled.displayUsd).toBe(1240);
    expect(settled.patientOwesUsd).toBe(0);
    expect(settled.label).toContain("contractual (CO)");
    expect(settled.label).toContain("provider write-off");
  });

  test("before an outcome exists the denial's rule stands", () => {
    const settled = settledLineMoney(findDenial("DEN-FREQ-CROWN")!, undefined, amounts);
    expect(settled.label).toContain("provider write-off");
    expect(settled.patientOwesUsd).toBe(0);
  });

  test("a patient-responsibility denial is never turned into a write-off", () => {
    const pr = findDenial("DEN-ANNUAL-MAX")!;
    const rule = settledLineMoney(pr, undefined, { allowedUsd: 0, planPaysUsd: 0, writeOffUsd: 0, patientOwesUsd: 120 });
    expect(rule.label).toBe("patient responsibility — the patient owes this balance");
    expect(rule.patientOwesUsd).toBe(120);
    expect(rule.writeOffUsd).toBe(0);
  });
});
