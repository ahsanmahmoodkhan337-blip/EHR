/**
 * Shell slice 4 — keyboard spine keys, read-only review and the help panel.
 *
 * Spec `task-1-app-shell.md` items 8, 10 and 11. Three promises are tested:
 *   1. A stage behind the one the student has reached opens for reading, and a
 *      stage they have not reached yet is not "review".
 *   2. Alt+← / Alt+→ find the right neighbour and never step past either end,
 *      and a locked stage is reported as locked rather than opened.
 *   3. The help panel advertises exactly the keys the shell listens for.
 */
import { describe, expect, test } from "bun:test";
import {
  SHELL_SHORTCUTS,
  adjacentStage,
  isReviewingStage,
  isStageUnlocked,
} from "../src/components/shell/stageReview";

// The medical spine as the runner builds it (prior auth present, so it is the
// longest version of the list).
const SPINE = ["case-select", "briefing", "registration", "eligibility", "clinical", "coding", "claim", "ar-follow-up", "debrief"];

describe("read-only review of a finished stage", () => {
  test("a stage behind the furthest one reached is review", () => {
    expect(isReviewingStage({ stageIds: SPINE, currentId: "coding", furthestId: "claim" })).toBe(true);
    expect(isReviewingStage({ stageIds: SPINE, currentId: "briefing", furthestId: "debrief" })).toBe(true);
  });

  test("the furthest stage and anything beyond it are not review", () => {
    expect(isReviewingStage({ stageIds: SPINE, currentId: "claim", furthestId: "claim" })).toBe(false);
    expect(isReviewingStage({ stageIds: SPINE, currentId: "ar-follow-up", furthestId: "claim" })).toBe(false);
  });

  test("the case picker stays usable — it is a frame, not an encounter stage", () => {
    expect(
      isReviewingStage({
        stageIds: SPINE,
        currentId: "case-select",
        furthestId: "debrief",
        exemptIds: ["case-select"],
      }),
    ).toBe(false);
  });

  test("an id the spine does not know is never treated as review", () => {
    // A conditional stage (medical prior auth) can be hidden while the record
    // still names it as furthest; showing it editable beats refusing to render.
    expect(isReviewingStage({ stageIds: SPINE, currentId: "prior-auth", furthestId: "claim" })).toBe(false);
    expect(isReviewingStage({ stageIds: SPINE, currentId: "coding", furthestId: "prior-auth" })).toBe(false);
  });
});

describe("Alt+← / Alt+→ spine keys", () => {
  test("next and previous are the neighbouring stages", () => {
    expect(adjacentStage(SPINE, "coding", "next")).toBe("claim");
    expect(adjacentStage(SPINE, "coding", "previous")).toBe("clinical");
  });

  test("the ends of the spine go nowhere", () => {
    expect(adjacentStage(SPINE, "case-select", "previous")).toBeNull();
    expect(adjacentStage(SPINE, "debrief", "next")).toBeNull();
    expect(adjacentStage(SPINE, "not-a-stage", "next")).toBeNull();
  });

  test("a stage is open at or before the furthest one reached, and locked beyond it", () => {
    expect(isStageUnlocked(SPINE, "coding", "coding")).toBe(true);
    expect(isStageUnlocked(SPINE, "registration", "coding")).toBe(true);
    expect(isStageUnlocked(SPINE, "claim", "coding")).toBe(false);
    expect(isStageUnlocked(SPINE, "not-a-stage", "coding")).toBe(false);
  });
});

describe("the help panel lists the shortcuts the shell listens for", () => {
  const keys = SHELL_SHORTCUTS.map((shortcut) => shortcut.keys);

  test("stage movement, the reference drawer and patient search are all advertised", () => {
    expect(keys).toContain("Alt + →");
    expect(keys).toContain("Alt + ←");
    expect(keys).toContain("Alt + R");
    expect(keys).toContain("/");
  });

  test("every shortcut says what it does", () => {
    for (const shortcut of SHELL_SHORTCUTS) {
      expect(shortcut.action.length).toBeGreaterThan(5);
    }
  });
});
