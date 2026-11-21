/**
 * The 271 answers with numbers a student can trace — spec
 * `slice-j-claim-follows-record.md` item 4b.
 *
 * A 271 that printed a copay, a deductible and a coinsurance with no plan behind
 * it was inventing them (standing rule 6). `eligibility271()` reads the plan
 * table that prices this patient's 835, names the plan and the table it came
 * from, states the deductible unmet, and returns **no figures at all** for a
 * payer the table has no rule for.
 *
 * The same file covers the last constant demo claim values (boxes 1a, 9, 11,
 * 11c, 15, 19) and the Registration panel that called the Tutorial Patient
 * "Self-pay — the patient has no insurance" while its own card named a payer.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { eligibility271 } from "../src/domain/eligibility";
import { planForPayerName, planForPayerNameStrict } from "../src/domain/adjudication";
import { MEDICAL_PLANS } from "../src/data/medical/payerScenarios";
import { applyDemoFill, unfilledBoxes } from "../src/utils/demoClaimFill";
import { DEMO_CLAIM_DATA, UNFILLED_BOX_SOURCES } from "../src/data/claims/demoClaimData";

const ROOT = join(import.meta.dir, "..");
const read = (relative: string) => readFileSync(join(ROOT, relative), "utf8");

const coverage = (payerName: string) => ({ payerName, subscriberId: "M-1" });

describe("item 4b — the 271 reads the patient's own plan", () => {
  test("the figures come from that payer's plan, and the plan is named", () => {
    const answer = eligibility271(coverage("Meridian Advantage"));
    expect(answer.planName).toBe("Meridian Advantage HMO");
    expect(answer.planType).toBe("Medicare Advantage HMO");
    expect(answer.deductibleRemainingUsd).toBe(0);
    expect(answer.coinsurancePercent).toBe(20); // the plan pays 80, so the patient pays 20
    expect(answer.source).toContain("Meridian Advantage HMO");
    expect(answer.source).toContain("plan table");
  });

  test("a plan with a real deductible returns it, unmet", () => {
    const answer = eligibility271(coverage("Atlas Select PPO"));
    expect(answer.planName).toBe("Atlas Select PPO");
    expect(answer.deductibleRemainingUsd).toBe(1500);
    expect(answer.coinsurancePercent).toBe(30);
  });

  test("a 100 percent plan reads as 0 percent patient, not the reverse", () => {
    const answer = eligibility271(coverage("Northwind State Medicaid"));
    expect(answer.coinsurancePercent).toBe(0);
    expect(answer.deductibleRemainingUsd).toBe(0);
  });

  test("the copay is stated, not invented: this plan design has none", () => {
    // The plan table carries a deductible and a coinsurance, not a fixed copay,
    // so the 271 says so instead of printing a number the 835 never applies.
    for (const plan of MEDICAL_PLANS) {
      expect(eligibility271(coverage(plan.name)).copayUsd).toBeNull();
    }
  });

  test("every plan in the table answers when its name is the payer", () => {
    for (const plan of MEDICAL_PLANS) {
      const answer = eligibility271(coverage(plan.name));
      expect(answer.planName).toBe(plan.name);
      expect(answer.deductibleRemainingUsd).toBe(plan.deductibleUsd);
      expect(answer.coinsurancePercent).toBe(100 - plan.planCoinsurancePercent);
    }
  });

  test("a payer with no plan rule returns no figures and says so", () => {
    const answer = eligibility271(coverage("Sunrise Benefit Trust"));
    expect(answer.planName).toBeNull();
    expect(answer.copayUsd).toBeNull();
    expect(answer.deductibleRemainingUsd).toBeNull();
    expect(answer.coinsurancePercent).toBeNull();
    expect(answer.source).toContain("Sunrise Benefit Trust");
    expect(answer.source).toContain("no plan rule");
  });

  test("no payer on file returns no figures and says so", () => {
    for (const empty of [null, undefined, {}, { payerName: "   " }]) {
      const answer = eligibility271(empty);
      expect(answer.planName).toBeNull();
      expect(answer.deductibleRemainingUsd).toBeNull();
      expect(answer.coinsurancePercent).toBeNull();
      expect(answer.source).toContain("No payer on file");
    }
  });

  test("the strict resolver refuses where the pricing fallback still prices", () => {
    // The 271 must not borrow the teaching baseline's money for an unknown
    // payer; the adjudication path keeps its documented baseline fallback.
    expect(planForPayerNameStrict("Sunrise Benefit Trust")).toBeNull();
    expect(planForPayerNameStrict("")).toBeNull();
    expect(planForPayerName("Sunrise Benefit Trust")?.id).toBe(MEDICAL_PLANS[0]?.id);
    expect(planForPayerNameStrict("Medicare Part B")?.id).toBe("PLAN-MERIDIAN-ADVANTAGE");
  });
});

describe("item 4b — no constant demo value is left on the claim", () => {
  const cleared = [
    "insuredId", // 1a — 1EG4-TE5-MK72
    "otherInsuranceName", // 9 — NONE — NO OTHER COVERAGE ON FILE
    "insuredPolicyGroup", // 11 — MCB-4471
    "insuredPlanName", // 11c — MEDICARE PART B
    "similarIllnessQualifier", // 15 — 431
    "similarIllnessDate", // 15 — 2026-07-08
    "additionalInfo", // 19 — DEMO — TRAINING CLAIM…
  ];

  test("none of those boxes has a demo value; each names the stage that fills it", () => {
    for (const field of cleared) {
      expect(DEMO_CLAIM_DATA[field]).toBeUndefined();
      expect(UNFILLED_BOX_SOURCES[field]).toBeDefined();
      expect(UNFILLED_BOX_SOURCES[field].value).toBe("");
    }
  });

  test("a blank claim prints none of the old constants", () => {
    const { values, boxes } = applyDemoFill({});
    expect(boxes).toEqual([]);
    for (const stale of [
      "1EG4-TE5-MK72",
      "MCB-4471",
      "MEDICARE PART B",
      "NONE — NO OTHER COVERAGE ON FILE",
      "2026-07-08",
      "431",
      "DEMO — TRAINING CLAIM, NOT A REAL ENCOUNTER",
    ]) {
      expect(Object.values(values)).not.toContain(stale);
    }
  });

  test("the blank boxes are listed with their provenance, in box order", () => {
    const blank = unfilledBoxes({});
    expect(blank.map((b) => b.box)).toEqual([
      "1a",
      "9",
      "11",
      "11c",
      "15",
      "19",
      "9c",
      "16",
      "17",
      "17b",
      "23",
    ]);
    expect(blank.find((b) => b.box === "1a")?.stage).toContain("coverage record");
    expect(blank.find((b) => b.box === "11c")?.stage).toContain("plan name");
  });
});

describe("item 4b — Registration does not call an insured patient self-pay", () => {
  const REGISTRATION = read("src/components/WorkflowAthena/RegistrationStage.tsx");

  test("the self-pay control is an action, not a claim about this patient", () => {
    expect(REGISTRATION).not.toContain("Self-pay — the patient has no insurance");
    expect(REGISTRATION).toContain("Record as self-pay");
  });
});
