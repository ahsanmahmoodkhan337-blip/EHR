/**
 * The v7 dental stage migration, from a real old-shape record.
 *
 * Spec `sidebar-stage-fixes.md`, defect 1 and 4. Before v7 the dental spine had
 * two steps of its own — `claims` (the claim status queue) and `ledger` (the
 * patient ledger):
 *
 *   case-select, briefing, planning, predetermination, coding, claim,
 *   claims(6), ar(7), ledger(8), debrief(9)
 *
 * v7 folded them into the eight-stage model, where `claims` is a section of
 * Claim and `ledger` is Remittance. A plain rename moves `furthestStage`
 * **backwards** — `ledger` (8) became Remittance (6) — which re-locks AR and
 * Debrief on work the student had already finished. These tests start from a
 * record saved in the old shape and check that:
 *
 *   1. nothing the student recorded is lost;
 *   2. `furthestStage` never moves backwards, so AR stays reachable from a
 *      `ledger` record;
 *   3. running the migration twice changes nothing.
 */
import { describe, expect, test } from "bun:test";
import {
  DENTAL_STAGE_ORDER,
  migrateDentalTrackState,
  migrateFurthestStage,
  unfinishedDentalStages,
  type DentalTrackState,
} from "../src/components/dental/DentalTrackStore";
import { isReviewingStage, isStageUnlocked } from "../src/components/shell/stageReview";

/**
 * A record exactly as a v6 build wrote it — every field that build saved, with
 * the student's own work in it: two coded lines, a transmitted claim, an 835
 * already posted to the ledger, one denied line appealed, a perio reading and a
 * treatment-plan item.
 */
function oldShapeRecord(stage: "claims" | "ledger" | "debrief") {
  return {
    version: 6,
    caseId: "DCASE-001",
    stage,
    furthestStage: stage,
    startedAt: "2026-11-10T08:00:00.000Z",
    completedAt: null,
    lines: [
      {
        id: "line-1",
        code: "D2740",
        tooth: "14",
        dateOfService: "2026-11-01",
        feeUsd: 980,
        predeterminationOnFile: false,
        attachments: [],
      },
      {
        id: "line-2",
        code: "D2950",
        tooth: "14",
        dateOfService: "2026-11-01",
        feeUsd: 260,
        predeterminationOnFile: false,
        attachments: [],
      },
    ],
    claimSubmitted: true,
    claimNumber: "DENT-000123",
    claimStatus: "accepted",
    statusEvents: [
      {
        id: "EV-1",
        entityType: "claim",
        entityId: "DENT-000123",
        patientId: "PAT-1001",
        claimNumber: "DENT-000123",
        from: null,
        to: "submitted",
        at: "2026-11-10T09:00:00.000Z",
        by: "+923001234567",
        jobRole: "biller",
        reasonCode: "A1",
        reason: "Accepted by the clearinghouse.",
      },
    ],
    predeterminationScenarioId: "D-PRED-01",
    predeterminationRequestedAt: "2026-11-09T10:00:00.000Z",
    trapsTriggered: ["TRAP-CROWN-DOWNGRADE"],
    rubricByCriterion: { "1-0": 4, "2-1": 2 },
    arCallLog: [
      {
        id: "CALL-1",
        at: "2026-11-12T11:00:00.000Z",
        objective: "Confirm the crown was denied for frequency, not for the tooth.",
        note: "Representative confirmed the five-year rule.",
      },
    ],
    lineResolutions: { "line-2": "appealed" },
    perio: {
      "14": { probing: { mb: 3, b: 2, db: 3, ml: 2, l: 2, dl: 2 }, mobility: 0, furcation: 0, bleeding: false, recession: 0 },
    },
    txPlan: [
      {
        id: "tx-1",
        code: "D2740",
        tooth: "14",
        dateOfService: "2026-11-01",
        feeUsd: 980,
        attachments: [],
        status: "accepted",
      },
    ],
    ledger: [
      {
        id: "LEDG-1",
        patientId: "PAT-1001",
        claimNumber: "DENT-000123",
        date: "2026-11-01",
        serviceDate: "2026-11-01",
        type: "charge",
        code: "D2740",
        description: "Crown, porcelain/ceramic — charge",
        amountCents: 98000,
        userId: "student",
        eraId: "ERA-CLAIM-1",
      },
      {
        id: "LEDG-2",
        patientId: "PAT-1001",
        claimNumber: "DENT-000123",
        date: "2026-11-12",
        serviceDate: "2026-11-01",
        type: "insurance_payment",
        code: "D2740",
        description: "Payer payment from the 835",
        amountCents: -58800,
        userId: "student",
        eraId: "ERA-CLAIM-1",
      },
      {
        id: "LEDG-3",
        patientId: "PAT-1001",
        claimNumber: "DENT-000123",
        date: "2026-11-12",
        serviceDate: "2026-11-01",
        type: "adjustment",
        code: "CO-45",
        description: "Contractual adjustment from the 835",
        amountCents: -39200,
        userId: "student",
        eraId: "ERA-CLAIM-1",
      },
    ],
    adaForm: null,
    practice: {
      "DAR-01": {
        scenarioId: "DAR-01",
        openedAt: "2026-11-08T09:00:00.000Z",
        callLog: [],
        lineResolutions: { "p-line-1": "appealed" },
        decisions: { "p-line-1": { resolution: "appealed", at: "2026-11-08T09:30:00.000Z" } },
      },
    },
    activePracticeId: null,
    practiceBenchOpen: false,
  };
}

const rank = (id: string) => DENTAL_STAGE_ORDER.indexOf(id as DentalTrackState["stage"]);

describe("v7 dental stage migration — from a real old-shape record", () => {
  test("a record saved on `claims` lands on Claim and loses nothing", () => {
    const old = oldShapeRecord("claims");
    const migrated = migrateDentalTrackState(old);

    expect(migrated.version).toBe(7);
    expect(migrated.stage).toBe("claim");
    expect(migrated.furthestStage).toBe("claim");

    // Every field the student filled in is carried across untouched.
    expect(migrated.lines).toEqual(old.lines);
    expect(migrated.ledger).toEqual(old.ledger);
    expect(migrated.claimNumber).toBe("DENT-000123");
    expect(migrated.claimStatus).toBe("accepted");
    expect(migrated.claimSubmitted).toBe(true);
    expect(migrated.statusEvents).toEqual(old.statusEvents);
    expect(migrated.lineResolutions).toEqual(old.lineResolutions);
    expect(migrated.arCallLog).toEqual(old.arCallLog);
    expect(migrated.perio).toEqual(old.perio);
    expect(migrated.txPlan).toEqual(old.txPlan);
    expect(migrated.trapsTriggered).toEqual(old.trapsTriggered);
    expect(migrated.rubricByCriterion).toEqual(old.rubricByCriterion);
    expect(migrated.predeterminationScenarioId).toBe("D-PRED-01");
    expect(migrated.predeterminationRequestedAt).toBe("2026-11-09T10:00:00.000Z");
    expect(migrated.startedAt).toBe("2026-11-10T08:00:00.000Z");
    expect(migrated.practice).toEqual(old.practice);
  });

  test("a record saved on `ledger` keeps AR — and Debrief — reachable", () => {
    const migrated = migrateDentalTrackState(oldShapeRecord("ledger"));

    expect(migrated.stage).toBe("remittance");
    // Old `ledger` came AFTER AR, so the student had finished AR.
    expect(migrated.furthestStage).toBe("ar");
    expect(isStageUnlocked(DENTAL_STAGE_ORDER as string[], "ar", migrated.furthestStage)).toBe(true);
    expect(isStageUnlocked(DENTAL_STAGE_ORDER as string[], "remittance", migrated.furthestStage)).toBe(true);
    expect(isStageUnlocked(DENTAL_STAGE_ORDER as string[], "debrief", migrated.furthestStage)).toBe(false);

    // Nothing is lost on the way: the posted 835 money is still there.
    expect(migrated.ledger).toHaveLength(3);
    expect(migrated.ledger.every((entry) => entry.eraId === "ERA-CLAIM-1")).toBe(true);
  });

  test("furthestStage never moves backwards for any old id", () => {
    const cases: [string, string][] = [
      ["case-select", "case-select"],
      ["briefing", "briefing"],
      ["planning", "planning"],
      ["predetermination", "predetermination"],
      ["coding", "coding"],
      ["claim", "claim"],
      ["claims", "claim"],
      ["ar", "ar"],
      ["ledger", "ar"],
      ["debrief", "debrief"],
    ];
    for (const [oldId, expected] of cases) {
      expect(migrateFurthestStage(oldId)).toBe(expected as DentalTrackState["stage"]);
    }
    // The one thing that matters: a ledger record keeps a position at or after
    // the stage it was working, never behind it.
    expect(rank(migrateFurthestStage("ledger"))).toBeGreaterThanOrEqual(rank("ar"));
  });

  test("a record saved on `debrief` stays on Debrief", () => {
    const migrated = migrateDentalTrackState(oldShapeRecord("debrief"));
    expect(migrated.stage).toBe("debrief");
    expect(migrated.furthestStage).toBe("debrief");
  });

  test("running the migration twice changes nothing", () => {
    for (const stage of ["claims", "ledger", "debrief"] as const) {
      const once = migrateDentalTrackState(oldShapeRecord(stage));
      const twice = migrateDentalTrackState(once);
      expect(twice).toEqual(once);
    }
  });
});

describe("a stage that still owes a required action is not finished", () => {
  const posted = migrateDentalTrackState(oldShapeRecord("ledger"));

  test("an unposted 835 keeps Remittance editable", () => {
    const unposted: DentalTrackState = {
      ...posted,
      furthestStage: "ar",
      ledger: posted.ledger.filter((entry) => !entry.eraId),
    };
    expect(unfinishedDentalStages(unposted)).toContain("remittance");
    expect(
      isReviewingStage({
        stageIds: DENTAL_STAGE_ORDER as string[],
        currentId: "remittance",
        furthestId: "ar",
        unfinishedIds: unfinishedDentalStages(unposted),
      }),
    ).toBe(false);
    // Without the rule it would have opened read-only, with the Post button dead.
    expect(
      isReviewingStage({
        stageIds: DENTAL_STAGE_ORDER as string[],
        currentId: "remittance",
        furthestId: "ar",
      }),
    ).toBe(true);
  });

  test("a denied line nobody has worked keeps AR editable", () => {
    const unworked: DentalTrackState = { ...posted, furthestStage: "debrief", lineResolutions: {} };
    expect(unfinishedDentalStages(unworked, ["line-2"])).toContain("ar");
    expect(unfinishedDentalStages(posted, ["line-2"])).not.toContain("ar");
  });

  test("once the money has moved and the lines are worked, the stage is finished again", () => {
    const done: DentalTrackState = { ...posted, furthestStage: "debrief" };
    expect(unfinishedDentalStages(done, ["line-2"])).toEqual([]);
    expect(
      isReviewingStage({
        stageIds: DENTAL_STAGE_ORDER as string[],
        currentId: "remittance",
        furthestId: "debrief",
        unfinishedIds: unfinishedDentalStages(done, ["line-2"]),
      }),
    ).toBe(true);
  });
});