/**
 * Crown and buildup appeals have two endings (owner ruling 2026-11-20,
 * `specs/appeal-then-write-off.md`): the appeal stays the first action, but it
 * is not terminal — upheld pays the line, denied needs the contractual write-off
 * posted, and the patient balance is 0 either way. These tests fail the moment
 * the appeal goes back to always winning, or the write-off turns into a bill.
 */
import { describe, expect, test } from "bun:test";
import {
  appealOutcomeFor,
  denialActionLabel,
  denialMoney,
  findCase,
  findDenial,
  findPracticeScenario,
  scorePracticeLine,
} from "../src/data/dental";
import { dentalWriteOffEntry } from "../src/components/dental/DentalTrackStore";
import type { LedgerEntry } from "../src/domain/ledger";

const TWO_STEP = ["DEN-FREQ-CROWN", "DEN-BUNDLE-BUILDUP"];

describe("the two-step denial records", () => {
  for (const id of TWO_STEP) {
    test(`${id}: CO, never patient-billable, expectedOutcome unchanged`, () => {
      const denial = findDenial(id)!;
      expect(denial.expectedOutcome).toBe("appeal-with-documentation");
      expect(denial.appealResolvesTo).toBe("pay-or-write-off");
      expect(denial.groupCode).toBe("CO");
      expect(denial.patientBillable).toBe(false);
      expect(denialMoney(denial).patientBalance).toBe(false);
      expect(denialMoney(denial).providerWriteOff).toBe(true);
    });

    test(`${id}: the action label names both endings`, () => {
      const label = denialActionLabel(findDenial(id)!);
      expect(label).toContain("appeal with documentation");
      expect(label).toContain("if upheld the line pays");
      expect(label).toContain("contractual write-off with patient balance 0");
    });

    test(`${id}: the corrective actions keep the appeal first and the write-off second`, () => {
      const actions = findDenial(id)!.correctiveActions.join(" ").toLowerCase();
      expect(actions.indexOf("appeal")).toBeGreaterThanOrEqual(0);
      expect(actions.indexOf("write-off")).toBeGreaterThan(actions.indexOf("appeal"));
    });
  }

  test("other appealable denials keep their single-ending behaviour", () => {
    const denial = findDenial("DEN-MED-NEC")!;
    expect(denial.appealResolvesTo).toBeUndefined();
    expect(appealOutcomeFor(denial, { filmAttached: true, reasonId: "anything" })).toBeNull();
    expect(denialActionLabel(denial)).toBe("appeal with documentation");
  });
});

describe("the payer's answer to the appeal", () => {
  const crown = findDenial("DEN-FREQ-CROWN")!;
  const buildup = findDenial("DEN-BUNDLE-BUILDUP")!;

  test("a complete appeal stating a criterion is upheld, whatever the words say", () => {
    for (const narrative of ["", "see attached", "Please reconsider, the patient needed the crown."]) {
      expect(appealOutcomeFor(crown, { filmAttached: true, reasonId: "crown-fractured", narrative })).toBe("upheld");
    }
    expect(appealOutcomeFor(buildup, { filmAttached: true, reasonId: "insufficient-structure" })).toBe("upheld");
  });

  test("a complete appeal stating a reason the plan does not cover is denied — the second ending exists", () => {
    expect(appealOutcomeFor(crown, { filmAttached: true, reasonId: "shade-dissatisfied" })).toBe("denied");
    expect(appealOutcomeFor(buildup, { filmAttached: true, reasonId: "prep-shaping" })).toBe("denied");
  });
});

describe("the contractual write-off", () => {
  const caseScenario = findCase("DCASE-005")!;
  const lines = caseScenario.procedures.map((p, i) => ({
    id: `line-${i + 1}`,
    code: p.code,
    tooth: p.tooth,
    dateOfService: p.dateOfService,
    feeUsd: p.feeUsd,
    predeterminationOnFile: true,
    attachments: [],
  }));
  const crownLineId = lines[2]!.id;

  const charge: LedgerEntry = {
    id: "LEDG-1",
    patientId: caseScenario.patient.id,
    claimNumber: "CLM-1",
    date: "2027-05-01",
    type: "charge",
    code: "D2740",
    description: "Charge",
    amountCents: 132000,
    userId: "test",
    lineNumber: 3,
  };

  test("before the 835 posts there is no charge to adjust, so nothing is invented", () => {
    const result = dentalWriteOffEntry(
      { ledger: [], lines, claimNumber: "CLM-1" },
      crownLineId,
      { at: "2027-05-02T00:00:00.000Z", userId: "test", reasonCode: "CO-119" },
    );
    expect(result.entry).toBeNull();
    expect(result.reason.toLowerCase()).toContain("not on the ledger yet");
  });

  test("a line the 835 already wrote off is not written off twice", () => {
    const writtenOff: LedgerEntry = {
      ...charge,
      id: "LEDG-2",
      type: "adjustment",
      code: "CO-119",
      amountCents: -132000,
    };
    const result = dentalWriteOffEntry(
      { ledger: [charge, writtenOff], lines, claimNumber: "CLM-1" },
      crownLineId,
      { at: "2027-05-02T00:00:00.000Z", userId: "test", reasonCode: "CO-119" },
    );
    expect(result.entry).toBeNull();
    expect(result.reason).toContain("$0.00");
  });

  test("a charge still on the ledger takes a CO adjustment and lands at 0", () => {
    const result = dentalWriteOffEntry(
      { ledger: [charge], lines, claimNumber: "CLM-1" },
      crownLineId,
      { at: "2027-05-02T00:00:00.000Z", userId: "test", reasonCode: "CO-119" },
    );
    expect(result.entry).not.toBeNull();
    expect(result.entry!.type).toBe("adjustment");
    expect(result.entry!.code).toBe("CO-119");
    expect(result.amountUsd).toBe(1320);
    const balance = charge.amountCents + result.entry!.amountCents;
    expect(balance).toBe(0);
  });
});

describe("scoring accepts appeal-then-write-off", () => {
  // DAR-01's denied bitewing: the key is the contractual write-off, no call note.
  const scenario = findPracticeScenario("DAR-01")!;
  const line = scenario.lines.find((l) => l.key)!;

  test("a denied appeal followed by the write-off scores as the write-off", () => {
    const score = scorePracticeLine(scenario, line.id, "write-off", [], "denied");
    expect(score?.correct).toBe(true);
    expect(score?.expected).toBe("write-off");
  });

  test("an upheld appeal scores as the appeal, and billing the patient stays wrong", () => {
    const appealed = findPracticeScenario("DAR-03")!;
    const appealedLine = appealed.lines.find((l) => l.key?.resolution === "appealed")!;
    expect(scorePracticeLine(appealed, appealedLine.id, "appealed", [], "upheld")?.correct).toBe(true);
    expect(scorePracticeLine(scenario, line.id, "billed-patient", [], "denied")?.correct).toBe(false);
    expect(scorePracticeLine(scenario, line.id, "billed-patient", [], "upheld")?.correct).toBe(false);
  });

  test("the existing single-action scores are unchanged", () => {
    expect(scorePracticeLine(scenario, line.id, "write-off", [])?.correct).toBe(true);
    const dar05 = findPracticeScenario("DAR-05")!;
    expect(scorePracticeLine(dar05, dar05.lines[0]!.id, "closed", [])?.correct).toBe(false);
    expect(scorePracticeLine(dar05, dar05.lines[0]!.id, "closed", [], "upheld")?.correct).toBe(false);
  });
});

describe("DCASE-005 carries the crown that teaches it", () => {
  test("the case has a DEN-FREQ-CROWN line and two AR rubric rows", () => {
    const caseScenario = findCase("DCASE-005")!;
    const denied = caseScenario.expectedOutcome.filter((l) => l.denialId === "DEN-FREQ-CROWN");
    expect(denied.length).toBe(1);
    expect(denied[0]!.patientOwesUsd).toBe(0);
    const arRows = caseScenario.gradingRubric.criteria.filter((c) => c.stage === "ar-follow-up");
    expect(arRows.length).toBe(2);
  });
});
