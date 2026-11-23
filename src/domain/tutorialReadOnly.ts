/**
 * The Tutorial Patient's chart is the standard reference — read-only.
 *
 * Inspired by: Epic's "reference patient" / training environment, where the
 * worked example is shown whole and cannot be edited by the person learning
 * from it.
 *
 * Owner decision, 2026-11-22 — *"Keep the Tutorial Patient read-only so students
 * can't edit the standard chart"* — and 2026-11-23 — *"each section should be
 * pre written and locked"*. Spec `specs/tutorial-patient-prefill.md` § C.
 *
 * The rule is enforced where the write happens, never only in the UI: the stores
 * call `refuseStudentWrite` before they write, so a disabled-looking screen and
 * a store that still accepts the write can never disagree. Disabling and
 * labelling the controls is the second layer.
 *
 * The seed is **not** a student write. `withSeedWrite` marks the one call path
 * that fills the chart (`domain/tutorialEncounter.ts`,
 * `domain/tutorialClaim.ts`, and the card/271 written by the store's own open
 * path), so the seed and the `tutorial-1 → tutorial-2` upgrade still land on a
 * record the student cannot touch. Provenance, not "this encounter refuses
 * everything", is what keeps the seed working.
 */
import { useSyncExternalStore } from "react";
import { TUTORIAL_PATIENT_ID } from "./tutorialEncounter";

/** The one line at the top of every stage of the Tutorial Patient's chart. */
export const TUTORIAL_READ_ONLY_LINE =
  "Standard reference chart — read-only. Book a New Appointment or open a Practice Case to practise.";

/** True for the Tutorial Patient's chart and nothing else. */
export function isTutorialChart(patientId: string | null | undefined): boolean {
  return patientId === TUTORIAL_PATIENT_ID;
}

// ─── Provenance: the seed writes, the student does not ─────────────

let seedDepth = 0;

/**
 * Run a seed write. Every write inside the call is allowed through, even on a
 * chart that refuses student writes — that is how the worked example (and its
 * `tutorial-1 → tutorial-2` upgrade) can still fill a locked chart.
 */
export function withSeedWrite<T>(fn: () => T): T {
  seedDepth += 1;
  try {
    return fn();
  } finally {
    seedDepth -= 1;
  }
}

/** True while a seed is writing. */
export function isSeedWrite(): boolean {
  return seedDepth > 0;
}

// ─── The refusal, said out loud ────────────────────────────────────
//
// A refused write must say why. The message lives here rather than in a store
// so the pipeline store, the patient store and the screen that shows it share
// one sentence — and so a refusal that happens in a store still reaches the
// student on the next render.

let refusal: string | null = null;
const listeners = new Set<() => void>();

function publish(next: string | null): void {
  refusal = next;
  for (const listener of listeners) listener();
}

export function tutorialRefusal(): string | null {
  return refusal;
}

export function subscribeTutorialRefusal(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function clearTutorialRefusal(): void {
  if (refusal !== null) publish(null);
}

/** What the student is told when the standard chart refuses their edit. */
export function refusalSentence(what: string): string {
  return `The Tutorial Patient is the standard reference chart — read-only. ${what} was not saved. Book a New Appointment or open a Practice Case to practise.`;
}

/**
 * Refuse a student write to the Tutorial Patient's chart and say why.
 *
 * Returns `true` when the write was refused, so the caller returns before it
 * touches the store: `if (refuseStudentWrite(id, "The note")) return;`
 */
export function refuseStudentWrite(
  patientId: string | null | undefined,
  what: string,
): boolean {
  if (!isTutorialChart(patientId)) return false;
  if (isSeedWrite()) return false;
  publish(refusalSentence(what));
  return true;
}

/** The refusal on screen, or null. Read-only chart, one sentence. */
export function useTutorialRefusal(): string | null {
  return useSyncExternalStore(subscribeTutorialRefusal, tutorialRefusal, tutorialRefusal);
}
