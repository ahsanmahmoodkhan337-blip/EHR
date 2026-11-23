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

// ─── The one student write the reference chart allows: Submit ─────
//
// Owner, 2026-11-23: *"in billing section it should not be submitted, the
// CMS-1500 should be filled and student should submit too … himself."* The
// claim is filled by the seed and locked like the rest of the chart; pressing
// **Submit** on it is the exercise, so that one click — the 837P and its 277CA,
// the payer's 835, the posting and the AR row it creates — is let through.
//
// It is deliberately a call-scoped window, not a flag on the chart: the store
// refuses every other write the moment the click's handler returns, and only
// the submission path opens the window (`components/BillingLedger`).

let claimSubmitDepth = 0;

/**
 * Run the student's claim submission on the reference chart.
 *
 * Every write inside the call is allowed through — the submission is one
 * deliberate action by the person learning, not the seed filling the chart.
 */
export function withClaimSubmit<T>(fn: () => T): T {
  claimSubmitDepth += 1;
  try {
    return fn();
  } finally {
    claimSubmitDepth -= 1;
  }
}

/** True while the student's own Submit is writing. */
export function isClaimSubmit(): boolean {
  return claimSubmitDepth > 0;
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
  // The seed fills the chart; the student's own Submit is the one action the
  // reference chart exists to let them take.
  if (isSeedWrite() || isClaimSubmit()) return false;
  publish(refusalSentence(what));
  return true;
}

/** The refusal on screen, or null. Read-only chart, one sentence. */
export function useTutorialRefusal(): string | null {
  return useSyncExternalStore(subscribeTutorialRefusal, tutorialRefusal, tutorialRefusal);
}

// ─── One signal the screens share ──────────────────────────────────
//
// The lead's root-cause note (2026-11-23): the guard reached the stores but no
// stage component, so every write control on the Tutorial Patient rendered live
// and its refusal was invisible — Submit looked clickable and did nothing.
//
// `useReadOnlyChart` is the one signal. A stage takes it from the chart it is
// working on (or from the route, which passes the same value), disables every
// control that would write, prints `READ_ONLY_REASON` beside it, and its
// handlers call `useReadOnlyGuard` so a click that still gets through says the
// same sentence out loud instead of vanishing.

/** Why a write control on the standard chart cannot act — one sentence. */
export const READ_ONLY_REASON =
  "This is the standard reference chart and cannot be changed. Book a New Appointment or open a Practice Case to practise.";

/** True when this chart refuses the student's writes. */
export function useReadOnlyChart(patientId: string | null | undefined): boolean {
  return isTutorialChart(patientId);
}

/**
 * True when this chart's note must not be autosaved.
 *
 * The standard chart's note is filled by the seed and refuses student writes, so
 * an autosave — the 5-second timer, a blur, page hide, a panel closing — has
 * nothing to save. Attempting it anyway publishes the refusal, and the student
 * who typed nothing reads *"The note was not saved"* on a chart they never tried
 * to change (owner report, 2026-11-23). Skip the attempt instead: no write, no
 * sentence. A seed write is not a student write, so it is still allowed through.
 */
export function skipNoteAutosave(patientId: string | null | undefined): boolean {
  return isTutorialChart(patientId) && !isSeedWrite();
}

/**
 * True when this chart's claim auto-fill must not be attempted.
 *
 * The same false-failure class as the note's, one stage later: the Billing stage
 * carries the coded lines and the parties onto the claim in an effect, and on the
 * standard chart that write is refused — which printed *"The claim was not
 * saved"* under a claim that is saved, on a chart the student never tried to
 * change (lead's walk, 2026-11-23). The reference claim is the seed's, so there
 * is nothing to carry onto it: skip the attempt and say nothing. A seed write and
 * the student's own Submit are still allowed through.
 */
export function skipClaimAutosave(patientId: string | null | undefined): boolean {
  return isTutorialChart(patientId) && !isSeedWrite() && !isClaimSubmit();
}

/** Say the refusal out loud, for a handler that was reached anyway. */
export function refuseReadOnly(what: string): true {
  publish(refusalSentence(what));
  return true;
}

/**
 * A stage handler's first line.
 *
 *   const guard = useReadOnlyGuard(patientId);
 *   const submit = () => { if (guard("The claim")) return; … };
 *
 * Returns `true` when the write was refused, so the caller stops there.
 */
export function useReadOnlyGuard(
  patientId: string | null | undefined,
): (what: string) => boolean {
  const readOnly = useReadOnlyChart(patientId);
  return (what: string) => (readOnly ? refuseReadOnly(what) : false);
}
