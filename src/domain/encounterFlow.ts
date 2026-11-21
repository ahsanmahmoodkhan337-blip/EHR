/**
 * encounterFlow.ts — the owner's seven-stage encounter, in the owner's order
 *
 * Inspired by: the one encounter a real practice works end to end — the clinician
 * writes and signs the progress note, the coder codes it, the prior-auth desk
 * clears the procedure, the biller drops the claim, the poster works the 835, and
 * AR chases what is left.
 *
 * Owner's audit, 2026-11-20 (`specs/encounter-flow-audit-2026-11-20.md` item 1) —
 * the order is authoritative and is NOT the order the app shipped with:
 *
 *   1 Progress Note (SOAP) · 2 Sign & Lock · 3 Coding · 4 Prior Auth ·
 *   5 Billing / Claim · 6 Payments (835) · 7 Denials & AR
 *
 * Registration and eligibility are front-desk work, not a numbered stage of this
 * flow, so they are not here — they are the first sections of the progress note's
 * own step bar (`domain/encounterSteps.ts`).
 *
 * WHY A SEPARATE MODULE
 * `encounterSteps.ts` is the *note's* own steps (registration → sign & lock) and
 * its ids are what a saved `chartStage` carries. This module is the *encounter's*
 * stages and its ids are what the stepper, the Back / Continue controls and the
 * stage numbers read. Keeping them apart means a step added to the note can never
 * renumber the money cycle, and a stage added here can never strand a chart step.
 *
 * Pure: no React, no storage. The record decides what is done; this module only
 * holds the order, the names and the numbers.
 */

/** The seven stages, in the owner's order. Nothing outside this list is a stage. */
export type EncounterFlowStageId =
  | "progress-note"
  | "sign-lock"
  | "coding"
  | "prior-auth"
  | "billing"
  | "payments"
  | "denials-ar";

/** The workspace role whose screen draws a stage. */
export type EncounterFlowRole = "scribe" | "coder" | "prior-auth" | "biller" | "ar-voice";

/** The biller's two screens: the claim paper, and the 835 posting desk. */
export type BillingDeskTab = "form" | "remittance";

export interface EncounterFlowStage {
  id: EncounterFlowStageId;
  /** The name the stepper, the badge and the Back / Continue controls print. */
  label: string;
  /** The Home workspace role that draws this stage. */
  role: EncounterFlowRole;
  /** The chart step to open when the stage is the note's own work. */
  chartStage?: string;
  /** For the two billing-desk stages, which of its two screens to open. */
  billingTab?: BillingDeskTab;
}

export const ENCOUNTER_FLOW_STAGES: readonly EncounterFlowStage[] = [
  { id: "progress-note", label: "Progress Note (SOAP)", role: "scribe", chartStage: "registration" },
  { id: "sign-lock", label: "Sign & Lock", role: "scribe", chartStage: "sign-lock" },
  { id: "coding", label: "Coding", role: "coder" },
  { id: "prior-auth", label: "Prior Auth", role: "prior-auth" },
  { id: "billing", label: "Billing / Claim", role: "biller", billingTab: "form" },
  { id: "payments", label: "Payments (835)", role: "biller", billingTab: "remittance" },
  { id: "denials-ar", label: "Denials & AR", role: "ar-voice" },
];

/** The stage the encounter opens on. */
export const ENCOUNTER_FLOW_OPENING_STAGE: EncounterFlowStageId = "progress-note";

/** Where a stage sits in the order; -1 for an id this build does not know. */
export function flowStageIndex(id: string | null | undefined): number {
  if (!id) return -1;
  return ENCOUNTER_FLOW_STAGES.findIndex((stage) => stage.id === id);
}

/** The 1-based number the badge and the stepper print; 0 for an unknown id. */
export function flowStageNumber(id: string | null | undefined): number {
  return flowStageIndex(id) + 1;
}

/** The stage's definition, or undefined for an id this build does not know. */
export function flowStage(id: string | null | undefined): EncounterFlowStage | undefined {
  return ENCOUNTER_FLOW_STAGES.find((stage) => stage.id === id);
}

/**
 * How a stage opens: the role whose screen draws it, the chart step it lands on
 * (the two scribe stages) and the biller's tab. The stepper, Back / Continue and
 * the address `/encounter/:encounterId/:stage` all open a stage through this one
 * function, so a stage cannot open on one screen from the stepper and another
 * from a pasted link.
 */
export function stageOpenTarget(id: string | null | undefined):
  | { role: EncounterFlowRole; chartStage?: string; billingTab: BillingDeskTab }
  | undefined {
  const stage = flowStage(id);
  if (!stage) return undefined;
  return {
    role: stage.role,
    ...(stage.chartStage ? { chartStage: stage.chartStage } : {}),
    billingTab: stage.billingTab ?? "form",
  };
}

/** The stage's name, or "" for an id this build does not know. */
export function flowStageLabel(id: string | null | undefined): string {
  return flowStage(id)?.label ?? "";
}

/** The stage after this one, or undefined on the last stage. */
export function nextFlowStage(id: string | null | undefined): EncounterFlowStage | undefined {
  const index = flowStageIndex(id);
  return index >= 0 ? ENCOUNTER_FLOW_STAGES[index + 1] : undefined;
}

/** The stage before this one, or undefined on the first stage. */
export function previousFlowStage(id: string | null | undefined): EncounterFlowStage | undefined {
  const index = flowStageIndex(id);
  return index > 0 ? ENCOUNTER_FLOW_STAGES[index - 1] : undefined;
}

/** The last stage — Denials & AR. Its button ends the encounter. */
export function lastFlowStageId(): EncounterFlowStageId {
  return ENCOUNTER_FLOW_STAGES[ENCOUNTER_FLOW_STAGES.length - 1].id;
}

/**
 * Which stage the workspace is on, from the role and the screen in front of the
 * student. One function, so the stepper's highlight and the screen cannot
 * disagree.
 */
export function currentFlowStage(input: {
  role: string;
  chartStage?: string | null;
  billingTab?: BillingDeskTab | null;
}): EncounterFlowStageId {
  switch (input.role) {
    case "scribe":
      return input.chartStage === "sign-lock" ? "sign-lock" : "progress-note";
    case "coder":
      return "coding";
    case "prior-auth":
      return "prior-auth";
    case "biller":
      return input.billingTab === "remittance" ? "payments" : "billing";
    case "ar-voice":
      return "denials-ar";
    default:
      return ENCOUNTER_FLOW_OPENING_STAGE;
  }
}

/**
 * The stages the encounter's own record says are finished. The caller reads the
 * flags (note written, note signed, codes captured, claim created, 835 posted,
 * AR cleared); this maps them onto the one stage list, so a stage added here
 * cannot be silently left out of the tick logic.
 */
export function completedFlowStages(
  flags: Partial<Record<EncounterFlowStageId, boolean>>,
): EncounterFlowStageId[] {
  return ENCOUNTER_FLOW_STAGES.filter((stage) => flags[stage.id] === true).map(
    (stage) => stage.id,
  );
}
