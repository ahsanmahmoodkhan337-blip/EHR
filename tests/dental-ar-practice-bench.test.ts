/**
 * Dental AR practice bench — data and scoring guardrails.
 *
 * These tests hold the bench to the spec `dental-ar-practice-bench.md`:
 *  - every scenario produces exactly the denials it claims, from the real
 *    engine plus the documented seeds;
 *  - the group code decides the money, including the owner's ruling that
 *    frequency-limit and age-limit denials are CO write-offs with patient 0;
 *  - a COB (OA) return moves no money at all;
 *  - the answer key is only reachable through `scorePracticeLine`, i.e. after a
 *    commit, and the picker copy never names the action.
 */
import { describe, expect, test } from "bun:test";
import {
  DENTAL_AR_PRACTICE_SCENARIOS,
  findDenial,
  findDenialScenario,
  practiceMoneyForGroup,
  practiceMoneyForLine,
  scorePracticeLine,
  type DentalARPracticeScenario,
} from "../src/data/dental";
import { adjudicatePracticeScenario } from "../src/components/dental/adjudication";

const expectedDenials: Record<string, { code: string; denialId: string }[]> = {
  "DAR-01": [{ code: "D0274", denialId: "DEN-FREQ-XRAY" }],
  "DAR-02": [{ code: "D1206", denialId: "DEN-AGE-LIMIT" }],
  "DAR-03": [{ code: "D4341", denialId: "DEN-MED-NEC" }],
  "DAR-04": [{ code: "D2392", denialId: "DEN-SURFACE-MISMATCH" }],
  "DAR-05": [
    { code: "D6010", denialId: "DEN-NOT-COVERED" },
    { code: "D6058", denialId: "DEN-NOT-COVERED" },
  ],
  "DAR-06": [
    { code: "D1120", denialId: "DEN-COB-PRIMARY" },
    { code: "D0274", denialId: "DEN-COB-PRIMARY" },
  ],
  "DAR-07": [
    { code: "D2740", denialId: "DEN-TIMELY-FILING" },
    { code: "D2950", denialId: "DEN-TIMELY-FILING" },
  ],
};

function scenarioById(id: string): DentalARPracticeScenario {
  const found = DENTAL_AR_PRACTICE_SCENARIOS.find((s) => s.id === id);
  if (!found) throw new Error(`no scenario ${id}`);
  return found;
}

describe("scenarios produce the denials they claim", () => {
  test("seven scenarios, six distinct denial categories", () => {
    expect(DENTAL_AR_PRACTICE_SCENARIOS.length).toBe(7);
    const categories = new Set(
      DENTAL_AR_PRACTICE_SCENARIOS.flatMap((s) =>
        adjudicatePracticeScenario(s).denied.map((d) => d.denial.category),
      ),
    );
    expect(categories.size).toBeGreaterThanOrEqual(6);
  });

  for (const scenario of DENTAL_AR_PRACTICE_SCENARIOS) {
    test(`${scenario.id}: exactly the intended denied lines`, () => {
      const { denied } = adjudicatePracticeScenario(scenario);
      const actual = denied.map((d) => ({ code: d.code, denialId: d.denial.id }));
      expect(actual).toEqual(expectedDenials[scenario.id]);
    });

    test(`${scenario.id}: every denied line has a key, and no paid line does`, () => {
      const { denied } = adjudicatePracticeScenario(scenario);
      const deniedIds = new Set(denied.map((d) => d.lineId));
      for (const line of scenario.lines) {
        if (deniedIds.has(line.id)) {
          expect(line.key, `${scenario.id} ${line.code} is denied without a key`).toBeDefined();
        } else {
          expect(line.key, `${scenario.id} ${line.code} paid but carries a key`).toBeUndefined();
        }
      }
    });

    test(`${scenario.id}: the money follows the group code`, () => {
      const { denied } = adjudicatePracticeScenario(scenario);
      for (const line of denied) {
        const seeded = practiceMoneyForLine(line.practiceLine, line.denial);
        if (line.denial.groupCode === "CO") {
          expect(line.patientOwesUsd, `${scenario.id} ${line.code} bills a CO line to the patient`).toBe(0);
          // The whole charge is the write-off, except where a line is held in
          // dispute under appeal instead (DAR-03).
          expect(line.writeOffUsd).toBe(seeded.writeOffUsd);
        }
        if (line.denial.groupCode === "OA") {
          expect(line.patientOwesUsd, `${scenario.id} ${line.code} OA patient balance`).toBe(0);
          expect(line.writeOffUsd, `${scenario.id} ${line.code} OA written off`).toBe(0);
        }
        if (line.denial.groupCode === "PR") {
          expect(line.patientOwesUsd, `${scenario.id} ${line.code} PR balance`).toBe(line.allowedUsd);
          expect(line.writeOffUsd, `${scenario.id} ${line.code} PR write-off`).toBe(0);
        }
      }
    });
  }
});

describe("the corrections from the engine check", () => {
  test("DAR-01: the denied bitewing writes off its whole charge", () => {
    const { denied, claim } = adjudicatePracticeScenario(scenarioById("DAR-01"));
    expect(denied[0]!.writeOffUsd).toBe(74);
    expect(denied[0]!.patientOwesUsd).toBe(0);
    // The engine's own totals already carry the denied line: 74 written off on
    // it, plus 4 and 13 contractual on the two paid lines.
    expect(claim.totals.writeOffUsd).toBe(91);
  });

  test("DAR-03: 30 written off, 290 held in dispute — never called a write-off", () => {
    const scenario = scenarioById("DAR-03");
    const { denied, claim } = adjudicatePracticeScenario(scenario);
    const line = denied[0]!;
    expect(line.denial.carc).toBe("CO-50");
    expect(line.writeOffUsd).toBe(22);
    // 22 on the appealed line plus 8 contractual on the exam — never 320.
    expect(claim.totals.writeOffUsd).toBe(30);
    const score = scorePracticeLine(scenario, line.lineId, "appealed", []);
    expect(score?.disputedUsd).toBe(290);
  });

  test("DAR-05: the patient balance is delivered through the call note", () => {
    const scenario = scenarioById("DAR-05");
    const line = scenario.lines[0]!;
    const noNote = scorePracticeLine(scenario, line.id, "closed", []);
    expect(noNote?.correct).toBe(false);
    expect(noNote?.noteRequired).toBe(true);
    const withNote = scorePracticeLine(scenario, line.id, "closed", [
      { lineId: line.id, note: "Payer confirmed the exclusion; the patient will be billed 4,095." },
    ]);
    expect(withNote?.correct).toBe(true);
    // A wrong action stays wrong however good the note is.
    const wrongAction = scorePracticeLine(scenario, line.id, "write-off", [
      { lineId: line.id, note: "Confirmed the patient owes 4,095." },
    ]);
    expect(wrongAction?.correct).toBe(false);
  });

  test("DAR-06: both lines are re-routed, so nothing moves", () => {
    const { denied } = adjudicatePracticeScenario(scenarioById("DAR-06"));
    expect(denied.map((d) => d.denial.groupCode)).toEqual(["OA", "OA"]);
    for (const line of denied) {
      expect(line.writeOffUsd).toBe(0);
      expect(line.patientOwesUsd).toBe(0);
    }
  });

  test("the COB remittance seed is OA-22 with no provider adjustment", () => {
    const era = findDenialScenario("DEN-SCEN-COB");
    expect(era).toBeDefined();
    const line = era!.expectedLines[0]!;
    expect(line.adjustments[0]!.groupCode).toBe("OA");
    expect(line.adjustments[0]!.reasonCode).toBe("22");
    expect(line.providerAdjustmentUsd).toBe(0);
    expect(line.adjustments[0]!.amountUsd).toBe(0);
  });

  test("DAR-07: the seed overrides the engine's own answer", () => {
    const { denied } = adjudicatePracticeScenario(scenarioById("DAR-07"));
    expect(denied.every((d) => d.denial.id === "DEN-TIMELY-FILING")).toBe(true);
    expect(denied.reduce((sum, d) => sum + d.writeOffUsd, 0)).toBe(1608);
  });
});

describe("the money rule is one table", () => {
  test("frequency and age denials are CO write-offs with patient 0", () => {
    for (const id of ["DEN-FREQ-XRAY", "DEN-AGE-LIMIT"]) {
      const denial = findDenial(id)!;
      const money = practiceMoneyForGroup(denial.groupCode, 100, 90);
      expect(money.patientOwesUsd).toBe(0);
      expect(money.writeOffUsd).toBe(100);
    }
  });

  test("OA moves nothing and PR moves the unpaid allowance", () => {
    expect(practiceMoneyForGroup("OA", 100, 90)).toEqual({ patientOwesUsd: 0, writeOffUsd: 0 });
    expect(practiceMoneyForGroup("PR", 100, 90)).toEqual({ patientOwesUsd: 90, writeOffUsd: 0 });
  });
});

describe("rule 6 — the picker never names the action", () => {
  const actionWords = ["write off", "written off", "write-off", "appeal", "resubmit", "bill the patient", "close"];

  for (const scenario of DENTAL_AR_PRACTICE_SCENARIOS) {
    test(`${scenario.id}: title, practice line and brief carry no action`, () => {
      const copy = `${scenario.title} ${scenario.whatYouWillPractise} ${scenario.brief}`.toLowerCase();
      for (const word of actionWords) {
        expect(copy.includes(word), `${scenario.id} reveals "${word}"`).toBe(false);
      }
    });

    test(`${scenario.id}: the key is only reachable through the scorer`, () => {
      const { denied } = adjudicatePracticeScenario(scenario);
      for (const line of denied) {
        // The key exists, but the scorer is the only reader of it — and it is
        // called only when a line is committed.
        expect(line.practiceLine.key).toBeDefined();
        expect(scorePracticeLine(scenario, line.lineId, "not-handled", [])).not.toBeNull();
      }
    });
  }
});
