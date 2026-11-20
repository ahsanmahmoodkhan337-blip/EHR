/**
 * stageReview.ts — the rules behind read-only review of a finished stage
 *
 * Inspired by: Epic Hyperspace, where an activity you have already completed
 * reopens for reading (the values are there, the fields do not take edits) and
 * athenaOne's encounter checklist, where a finished step is clickable to review
 * but not to change.
 *
 * Spec `task-1-app-shell.md` items 5 and 11: "Completed steps are clickable for
 * review in read-only mode." The stepper and both runners read the same three
 * rules from this file, so medical and dental cannot drift apart:
 *
 *   reviewing   the stage on screen is *behind* the furthest stage the student
 *               reached, so it opens for reading.
 *   unlocked    a stage is open when it is at or before the furthest stage.
 *   adjacent    the stage before / after the one on screen, for the Alt+← and
 *               Alt+→ keyboard shortcuts (item 8).
 *
 * Pure functions only: no React, no storage. That is what lets the rules be
 * tested without a browser (`tests/shell-slice4.test.ts`).
 */

/** Which way Alt+← / Alt+→ moves through the spine. */
export type StageDirection = "next" | "previous";

/** Position of a stage in the spine, or -1 when the spine does not name it. */
export function stageIndex(stageIds: readonly string[], id: string): number {
  return stageIds.indexOf(id);
}

export interface StageReviewInput {
  /** Every stage id the track's spine shows, in order. */
  stageIds: readonly string[];
  /** The stage on screen. */
  currentId: string;
  /** The furthest stage this student has reached. */
  furthestId: string;
  /**
   * Frame stages that are not part of the encounter. The case picker is one:
   * it must stay usable, otherwise a student who has started a case could
   * never pick another one.
   */
  exemptIds?: readonly string[];
  /**
   * Stages that still owe a required action — an 835 that has not been posted,
   * a denied line nobody has worked. Such a stage is **not** finished, so it
   * stays live however far the student has moved on. Without this, the posting
   * step is dead the moment the student reaches AR: the frame's `fieldset
   * disabled` would swallow the Post button and strand the money.
   */
  unfinishedIds?: readonly string[];
}

/**
 * True when the stage on screen is a finished one — behind the furthest stage
 * reached — and therefore opens read-only.
 */
export function isReviewingStage({
  stageIds,
  currentId,
  furthestId,
  exemptIds = [],
  unfinishedIds = [],
}: StageReviewInput): boolean {
  if (exemptIds.includes(currentId)) return false;
  if (unfinishedIds.includes(currentId)) return false;
  const current = stageIndex(stageIds, currentId);
  const furthest = stageIndex(stageIds, furthestId);
  // An id the spine does not know (a conditional stage that is hidden right
  // now) is never treated as review: refusing to render would be worse than
  // showing it editable.
  if (current < 0 || furthest < 0) return false;
  return current < furthest;
}

/** The stage before or after `currentId`, or null at either end of the spine. */
export function adjacentStage(
  stageIds: readonly string[],
  currentId: string,
  direction: StageDirection,
): string | null {
  const current = stageIndex(stageIds, currentId);
  if (current < 0) return null;
  const target = direction === "next" ? current + 1 : current - 1;
  return stageIds[target] ?? null;
}

/** A stage the student is allowed to open: at or before the furthest reached. */
export function isStageUnlocked(
  stageIds: readonly string[],
  targetId: string,
  furthestId: string,
): boolean {
  const target = stageIndex(stageIds, targetId);
  if (target < 0) return false;
  const furthest = stageIndex(stageIds, furthestId);
  if (furthest < 0) return true;
  return target <= furthest;
}

/** One keyboard shortcut, as printed in the help panel and the drawer. */
export interface ShellShortcut {
  /** The keys, in the order they are pressed. */
  keys: string;
  /** What pressing them does, in one sentence a student can act on. */
  action: string;
}

/**
 * The shell's keyboard shortcuts. Item 8 of the spec, kept in one list so the
 * help panel (item 10) cannot advertise a key the app does not listen for.
 */
export const SHELL_SHORTCUTS: ShellShortcut[] = [
  { keys: "Alt + →", action: "Next stage of the case" },
  { keys: "Alt + ←", action: "Previous stage of the case" },
  { keys: "Alt + R", action: "Open or close the reference panel" },
  { keys: "/", action: "Search patients" },
  { keys: "Esc", action: "Close the open panel or menu" },
];
