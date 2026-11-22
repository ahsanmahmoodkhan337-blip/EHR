/**
 * stageProgress.ts — what the seven-stage stepper may tick, read from the record
 *
 * Phase 1 of the owner's work order (`specs/phase1-data-integrity.md` item 2):
 * "the seven-stage stepper's checkmarks come from saved encounter state, never
 * in-memory state. The stage list and its order live in
 * `src/domain/encounterFlow.ts`."
 *
 * The order and the tick rule live there; this module answers only *what the
 * encounter's own record says is finished*, so the workspace, the stepper and the
 * end-to-end reload test all ask one function instead of each screen assembling
 * its own flags. It reads the record and nothing else:
 *
 *   - the note was written      → its four SOAP sections hold text (`noteStatus`);
 *   - the note was signed       → its own NOTE_SIGNED timeline entry (`noteStatus`);
 *   - the codes were captured   → `hasSubmittedCodes` (`domain/codingQueue`);
 *   - the claim exists          → its minted `claimNumber`;
 *   - the 835 was posted        → a remittance with `postedAt`;
 *   - AR was cleared            → every AR item on the claim resolved.
 *
 * Pure: no React, no storage, no clock.
 */

import type { PipelineEncounter } from "../store/pipelineEncounter";
import { noteFieldsHaveText, noteFieldsOf, noteStatus } from "./noteStatus";
import { hasSubmittedCodes } from "./codingQueue";
import { completedFlowStages, type EncounterFlowStageId } from "./encounterFlow";

/** What the record says about each stage. */
export interface StageEvidence {
  noteWritten: boolean;
  noteSigned: boolean;
  coded: boolean;
  claimCreated: boolean;
  remittancePosted: boolean;
  arCleared: boolean;
}

/** The blank evidence — nothing captured. */
export const EMPTY_STAGE_EVIDENCE: StageEvidence = {
  noteWritten: false,
  noteSigned: false,
  coded: false,
  claimCreated: false,
  remittancePosted: false,
  arCleared: false,
};

/** What one encounter's saved record says is finished. */
export function stageEvidenceOf(
  encounter: PipelineEncounter | null | undefined,
): StageEvidence {
  if (!encounter) return { ...EMPTY_STAGE_EVIDENCE };
  const arItems = encounter.arItems ?? [];
  return {
    noteWritten: noteFieldsHaveText(noteFieldsOf(encounter)),
    noteSigned: noteStatus(encounter) === "signed",
    coded: hasSubmittedCodes(encounter),
    claimCreated: Boolean(encounter.claimNumber),
    remittancePosted: (encounter.remittances ?? []).some((r) => Boolean(r.postedAt)),
    arCleared: arItems.length > 0 && arItems.every((item) => item.status === "resolved"),
  };
}

/**
 * The stages the encounter has finished, in the owner's order.
 *
 * A claim can only be submitted once the prior-auth desk has settled its
 * question, so a claim on the encounter is the PA stage's own answer as well as
 * the biller's — the same mapping the workspace has always used.
 */
export function completedStagesOf(
  encounter: PipelineEncounter | null | undefined,
): EncounterFlowStageId[] {
  const evidence = stageEvidenceOf(encounter);
  return completedFlowStages({
    "progress-note": evidence.noteWritten,
    "sign-lock": evidence.noteSigned,
    coding: evidence.coded,
    "prior-auth": evidence.claimCreated,
    billing: evidence.claimCreated,
    payments: evidence.remittancePosted,
    "denials-ar": evidence.arCleared,
  });
}
