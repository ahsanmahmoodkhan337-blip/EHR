/**
 * "Accept treatment →" on the dental planning stage used to be a dead end.
 *
 * `acceptPlan()` wrote `stage: "coding"` into the saved record but never moved
 * `furthestStage`, and `furthestStage` is what the stepper and the stage-URL
 * guard read. So the button seeded the lines, the URL tried to open Coding, the
 * guard saw Coding as locked and pushed the student back to /planning — with
 * every stepper button after Chart locked, and the Claim stage reachable only
 * by editing the saved record.
 *
 * The rule now lives in one pure function, `acceptDentalTreatmentPlan`, which
 * the store's `acceptPlan()` calls. These tests read that rule directly:
 *
 *   1. Accepting from Planning lands on Coding **and** records Coding as
 *      reached, so the stepper ticks Chart and unlocks Coding — and still keeps
 *      Claim locked.
 *   2. The plan's lines are seeded onto the claim, and the plan items become
 *      accepted — the student's own codes, teeth, surfaces and fees, nothing
 *      invented.
 *   3. `furthestStage` never moves backwards: a case already at Claim stays
 *      reachable after a second accept.
 *   4. The button path and the tested rule are the same code, not two copies.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  acceptDentalTreatmentPlan,
  DENTAL_STAGE_ORDER,
  migrateDentalTrackState,
  type DentalTrackState,
} from "../src/components/dental/DentalTrackStore";
import { isStageUnlocked } from "../src/components/shell/stageReview";

/** A case record as a student leaves Planning: two procedures still planned. */
function planningRecord(): DentalTrackState {
  return migrateDentalTrackState({
    version: 7,
    caseId: "DCASE-001",
    stage: "planning",
    furthestStage: "planning",
    txPlan: [
      {
        id: "tp-1",
        code: "D2740",
        tooth: "14",
        surfaces: "",
        quadrant: undefined,
        dateOfService: "2027-02-11",
        feeUsd: 980,
        attachments: [],
        status: "planned",
      },
      {
        id: "tp-2",
        code: "D2950",
        tooth: "14",
        surfaces: "",
        quadrant: undefined,
        dateOfService: "2027-02-11",
        feeUsd: 260,
        attachments: [],
        status: "planned",
      },
    ],
  });
}

describe("accepting treatment advances the stage the way every other stage moves", () => {
  test("from planning it lands on coding and records coding as reached", () => {
    const accepted = acceptDentalTreatmentPlan(planningRecord());

    expect(accepted.stage).toBe("coding");
    expect(accepted.furthestStage).toBe("coding");
  });

  test("Chart ticks and Coding unlocks, so the stepper is not left locked", () => {
    const accepted = acceptDentalTreatmentPlan(planningRecord());
    const ids = DENTAL_STAGE_ORDER as string[];

    // The stepper ticks a step when it sits behind furthestStage: Chart is
    // planning, so a furthest of coding is what puts the tick on it.
    expect(ids.indexOf("planning")).toBeLessThan(ids.indexOf(accepted.furthestStage));
    expect(isStageUnlocked(ids, "coding", accepted.furthestStage)).toBe(true);
    // One step forward is all it unlocks: Claim still owes a claim.
    expect(isStageUnlocked(ids, "claim", accepted.furthestStage)).toBe(false);
  });

  test("the plan's lines are seeded onto the claim, and the plan items are accepted", () => {
    const accepted = acceptDentalTreatmentPlan(planningRecord());

    expect(accepted.lines.map((l) => l.code)).toEqual(["D2740", "D2950"]);
    expect(accepted.lines.map((l) => l.id)).toEqual(["tp-1", "tp-2"]);
    expect(accepted.lines.map((l) => l.feeUsd)).toEqual([980, 260]);
    expect(accepted.lines.every((l) => l.tooth === "14")).toBe(true);
    expect(accepted.lines.every((l) => l.predeterminationOnFile === false)).toBe(true);
    expect(accepted.txPlan.map((p) => p.status)).toEqual(["accepted", "accepted"]);
  });

  test("furthestStage never moves backwards on a case already past coding", () => {
    const later: DentalTrackState = {
      ...planningRecord(),
      stage: "claim",
      furthestStage: "claim",
    };
    const accepted = acceptDentalTreatmentPlan(later);

    expect(accepted.stage).toBe("coding");
    expect(accepted.furthestStage).toBe("claim");
    expect(isStageUnlocked(DENTAL_STAGE_ORDER as string[], "claim", accepted.furthestStage)).toBe(true);
  });

  test("accepting a plan with nothing planned seeds no invented line", () => {
    const empty: DentalTrackState = { ...planningRecord(), txPlan: [] };
    const accepted = acceptDentalTreatmentPlan(empty);

    expect(accepted.lines).toEqual([]);
    expect(accepted.stage).toBe("coding");
    expect(accepted.furthestStage).toBe("coding");
  });
});

describe("the button runs the tested rule, not a copy of it", () => {
  test("the store's acceptPlan delegates to acceptDentalTreatmentPlan", () => {
    const source = readFileSync("src/components/dental/DentalTrackStore.tsx", "utf8");
    expect(source).toContain("setState((s) => acceptDentalTreatmentPlan(s))");
    // The stage move carries furthestStage with it — the field the old inline
    // body never wrote, which is what left Coding locked.
    expect(source).toContain('furthestStage: furthestOf(state.furthestStage, "coding")');
  });

  test("the planning screen's Accept treatment button calls acceptPlan", () => {
    const source = readFileSync("src/components/dental/DentalTreatmentPlan.tsx", "utf8");
    expect(source).toContain("acceptPlan();");
    expect(source).toContain("onClick={accept}");
  });
});
