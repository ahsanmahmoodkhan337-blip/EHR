/**
 * stageModel.ts — the one revenue-cycle stage model, for both tracks
 *
 * Inspired by: the shared encounter spine a real RCM department works to — front
 * desk clears the patient, the clinician charts, the coder codes, the prior-auth
 * desk clears the procedure, the biller drops the claim, the poster works the
 * remittance, AR chases what is left, and the case is graded at the end. Medical
 * and dental both walk the same spine; only the paperwork and the codes differ.
 *
 * Spec `phase-1-navigation.md` item 4: "One stage model everywhere: Front Desk
 * (registration + eligibility), Chart, Coding, Prior Auth, Claim, Remittance, AR,
 * Debrief (cases only). The role label is derived from the stage and printed
 * once. Dental uses the same eight names."
 *
 * WHY ONE FILE
 * Before this, the medical runner and the dental runner each kept their own list
 * of stage names and their own idea of what a step was called. "Claims" meant
 * two different screens, the dental list had both "Claim" and "Claims", and the
 * role label was printed twice on Home. One model, one name per stage, and the
 * role derived from the stage — nowhere else.
 *
 * WHAT A TRACK SHOWS
 * Each track renders the stages it actually implements, in model order, under
 * the model's own name. A track never invents a label for a model stage:
 *   medical — Front Desk, Chart, Coding, Prior Auth, Claim, AR, Debrief
 *             (its 835 posts inside the AR stage, so it has no Remittance screen)
 *   dental  — Chart, Coding, Prior Auth, Claim, Remittance, AR, Debrief
 *             (its 835/ERA screen is the claim status queue, so that is
 *             Remittance; there is no dental registration screen)
 * The frames either side of the spine — the case picker and the briefing — are
 * not encounter stages and are not in the model.
 *
 * Pure: no React, no storage, so both runners and the tests read the same rules.
 */

import type { ShellTrack } from "./navItems";

/** The eight stage names. Nothing outside this list is a stage. */
export type RcmStageId =
  | "front-desk"
  | "chart"
  | "coding"
  | "prior-auth"
  | "claim"
  | "remittance"
  | "ar"
  | "debrief";

export interface RcmStage {
  id: RcmStageId;
  /** The one name this stage is called in the rail, the stepper and the review banner. */
  label: string;
  /** The job role that owns the stage. Derived from the stage, never stored twice. */
  role: string;
}

/**
 * The model, in the order the work happens. Front Desk covers registration and
 * eligibility together: they are two screens of one job, done by one person.
 */
export const RCM_STAGE_MODEL: readonly RcmStage[] = [
  { id: "front-desk", label: "Front Desk", role: "Front Desk" },
  { id: "chart", label: "Chart", role: "Provider / Scribe" },
  { id: "coding", label: "Coding", role: "Medical Coder" },
  { id: "prior-auth", label: "Prior Auth", role: "Prior Auth Specialist" },
  { id: "claim", label: "Claim", role: "Medical Biller" },
  { id: "remittance", label: "Remittance", role: "Payment Poster" },
  { id: "ar", label: "AR", role: "AR Specialist" },
  { id: "debrief", label: "Debrief", role: "Case debrief" },
];

/**
 * The model both tracks read. It is deliberately the same array for both: a
 * track's differences live in its own stage-to-model mapping, never in a second
 * copy of the names.
 */
export function stageModelFor(_track: ShellTrack): readonly RcmStage[] {
  return RCM_STAGE_MODEL;
}

export function findRcmStage(id: RcmStageId): RcmStage {
  const stage = RCM_STAGE_MODEL.find((s) => s.id === id);
  // The list is exhaustive over RcmStageId, so this cannot happen; throwing beats
  // silently rendering a stage with no name.
  if (!stage) throw new Error(`Unknown stage: ${id}`);
  return stage;
}

export function rcmLabel(id: RcmStageId): string {
  return findRcmStage(id).label;
}

export function rcmRole(id: RcmStageId): string {
  return findRcmStage(id).role;
}

/**
 * The model stages a track implements, in model order.
 *
 * `mapping` is the track's own internal stage names → model stages. A track that
 * maps two of its screens to one model stage (medical's registration and
 * eligibility) still shows that stage once.
 */
export function modelStagesFor(
  mapping: Record<string, RcmStageId>,
  options: { hide?: readonly RcmStageId[] } = {},
): RcmStage[] {
  const present = new Set<RcmStageId>(Object.values(mapping));
  const hidden = new Set<RcmStageId>(options.hide ?? []);
  return RCM_STAGE_MODEL.filter((stage) => present.has(stage.id) && !hidden.has(stage.id));
}

/**
 * Which model stage an internal stage belongs to, or undefined for a frame
 * (the case picker, the briefing) that is not an encounter stage.
 */
export function modelStageOf(
  mapping: Record<string, RcmStageId>,
  internalId: string,
): RcmStageId | undefined {
  return mapping[internalId];
}

// ─── how each track's own screens map onto the model ────────────────────────
// The runners keep their own stage ids (they are what the URL and the saved
// record carry, so renaming one would strand a student's progress); this is the
// only place that says which model stage each id is.

/** Medical: registration + eligibility are one Front Desk stage. */
export const MEDICAL_STAGE_TO_MODEL: Record<string, RcmStageId> = {
  registration: "front-desk",
  eligibility: "front-desk",
  clinical: "chart",
  coding: "coding",
  "prior-auth": "prior-auth",
  claim: "claim",
  "ar-follow-up": "ar",
  debrief: "debrief",
};

/**
 * Dental: the stage whose screen is the claim status queue with its 835 and
 * sample ERAs was called "Claims" next to a different stage called "Claim". It
 * is the remittance stage, so it is called Remittance now — its stored id stays
 * `claims`, so no saved case has to be migrated. The patient ledger is this
 * track's own screen and is not one of the eight.
 */
export const DENTAL_STAGE_TO_MODEL: Record<string, RcmStageId> = {
  planning: "chart",
  predetermination: "prior-auth",
  coding: "coding",
  claim: "claim",
  claims: "remittance",
  ar: "ar",
  debrief: "debrief",
};
