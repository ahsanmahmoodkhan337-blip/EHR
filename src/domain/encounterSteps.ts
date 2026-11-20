/**
 * encounterSteps.ts — the one step order for a patient's visit
 *
 * Inspired by: the encounter spine a real EHR walks a visit through — front desk
 * registers and checks eligibility, the clinician documents intake, history,
 * exam, assessment and plan, then signs and locks the note before anything is
 * coded or billed.
 *
 * Owner, 2026-11-20: "whenever I should open a patient, scribing should follow
 * the sequence it was earlier and take us step by step to last step — now all
 * steps are dissociated." Spec `encounter-continuity.md`.
 *
 * WHY ONE MODULE
 * The order used to live inside `store/pipelineEncounter.ts` next to the saved
 * record's shapes, and the chart opened wherever the student last was
 * (`resumeChartStep`). This module owns the order and nothing else: it is pure —
 * no React, no storage — so the chart, the step bar, the Back / Next controls
 * and the tests all read the same list.
 *
 * WHAT IT DOES NOT DO
 * It holds no completion state. Whether a step is done is read from the record
 * (the note, the vitals, the signature) and passed in, so a tick on the step bar
 * can never disagree with the work the student actually did.
 */

/** One step of a visit, in the order the work happens. */
export interface EncounterStepDef {
  /** The id a saved record and a route carry. Never renumbered or renamed. */
  id: string;
  label: string;
}

/**
 * The visit, step by step. Registration is step 1 and the only place a patient
 * opens (owner decision, 2026-11-20) — the chart then walks forward one step at
 * a time to Sign & Lock.
 */
export const ENCOUNTER_STEPS: readonly EncounterStepDef[] = [
  { id: "registration", label: "Registration" },
  { id: "intake-vitals", label: "Intake / Vitals" },
  { id: "hpi", label: "History of Present Illness" },
  { id: "exam-ros", label: "Review of Systems" },
  { id: "assessment-plan", label: "Assessment & Plan" },
  { id: "sign-lock", label: "Sign & Lock Note" },
];

/** The step every patient opens on. */
export const ENCOUNTER_OPENING_STEP = "registration";

/** Where a step sits in the order; -1 for an id this build does not know. */
export function encounterStepIndex(id: string | null | undefined): number {
  if (!id) return -1;
  return ENCOUNTER_STEPS.findIndex((step) => step.id === id);
}

/** The 1-based number the step bar prints; 0 for an id this build does not know. */
export function encounterStepNumber(id: string | null | undefined): number {
  return encounterStepIndex(id) + 1;
}

/** The step's label, or "" for an id this build does not know. */
export function encounterStepLabel(id: string | null | undefined): string {
  return ENCOUNTER_STEPS.find((step) => step.id === id)?.label ?? "";
}

/** The step after this one, or undefined on the last step. */
export function nextEncounterStep(id: string | null | undefined): EncounterStepDef | undefined {
  const index = encounterStepIndex(id);
  return index >= 0 ? ENCOUNTER_STEPS[index + 1] : undefined;
}

/** The step before this one, or undefined on step 1. */
export function previousEncounterStep(id: string | null | undefined): EncounterStepDef | undefined {
  const index = encounterStepIndex(id);
  return index > 0 ? ENCOUNTER_STEPS[index - 1] : undefined;
}

/** The id of the last step — Sign & Lock Note. */
export function lastEncounterStepId(): string {
  return ENCOUNTER_STEPS[ENCOUNTER_STEPS.length - 1].id;
}

/**
 * The later of two steps — how "furthest reached" advances. Never backwards, so
 * going back to Registration does not forget the note work already done.
 */
export function furthestEncounterStep(
  a: string | null | undefined,
  b: string,
): string {
  if (!a || encounterStepIndex(a) < 0) return b;
  return encounterStepIndex(b) > encounterStepIndex(a) ? b : a;
}

/**
 * The steps the record says are finished, in order. The caller reads the flags
 * from the record (registration filled, vitals taken, note sections written,
 * note signed); this maps them onto the one step list, so a step added here
 * cannot be silently left out of the tick logic.
 */
export function completedEncounterSteps(
  flags: Partial<Record<string, boolean>>,
): string[] {
  return ENCOUNTER_STEPS.filter((step) => flags[step.id] === true).map((step) => step.id);
}

export type EncounterStepState = "done" | "current" | "open";

/** One row of the step bar: the step, its number and the state it is drawn in. */
export interface EncounterStepRow extends EncounterStepDef {
  number: number;
  state: EncounterStepState;
}

/**
 * The step bar's rows. `completed` is the record's answer; the step on screen is
 * always "current", never "done", so the bar and the screen agree.
 */
export function encounterStepRows(
  completed: Iterable<string>,
  current: string | null | undefined,
): EncounterStepRow[] {
  const done = new Set(completed);
  return ENCOUNTER_STEPS.map((step, i) => ({
    ...step,
    number: i + 1,
    state: step.id === current ? "current" : done.has(step.id) ? "done" : "open",
  }));
}
