/**
 * tutorialClaim.ts — the Tutorial Patient's money half (seed version tutorial-5)
 *
 * Inspired by: the worked example a billing instructor hands out — the same
 * patient, the same encounter, carried past the code into a claim that is
 * **filled and waiting for the student to send it**. Epic's training environment
 * and athenahealth's demo claims both hand the learner a claim with every box
 * answered; the send itself is the exercise.
 *
 * Owner, 2026-11-22: *"tutorial patient needs to have all data filled from start
 * to end so that can act as a standard which data should be where."*
 * Owner, 2026-11-23: *"in billing section it should not be submitted, the
 * CMS-1500 should be filled and student should submit too … himself"* and
 * *"just the main point in all these sections from start is that all information
 * should be pre filled"*.
 *
 * So this file fills the claim and stops there:
 *
 *   - the CMS-1500 record, built by `utils/claimAutoFill.ts` from the patient's
 *     own card and the Coder's own lines — boxes 1, 2, 4, 11, 21, 24A–J, 28, 31,
 *     32 and 33 all carry a value read from the chart; box 23 is the encounter's
 *     own authorisation (`domain/priorAuthNumber.ts`), never another chart's;
 *   - the claim number, minted from the student's own sequence
 *     (`store/claimSequence.ts`) exactly as the paper mints it on a real claim;
 *   - one timeline entry saying the claim was built from the coded encounter and
 *     is a draft;
 *   - and **nothing else**. No 837P, no 277CA, no 835, no posting and therefore
 *     no AR row: the AR queue is derived from a posted 835
 *     (`domain/arWorkQueue.ts`), so an unsubmitted claim cannot have one. Every
 *     one of those is produced by the student's own Submit on the Billing stage,
 *     which is the one write this read-only chart allows
 *     (`withClaimSubmit`, `domain/tutorialReadOnly.ts`).
 *
 * WHAT A CHART SEEDED BY AN OLDER BUILD GETS
 * The builds before 2026-11-23 sent the claim for the student: 277CA, 835,
 * posting, AR row and a status read from the money. A record stamped with one of
 * those versions (`tutorial-2`, `tutorial-4` — `claim: 1` on the ladder in
 * `domain/tutorialEncounter.ts`) is brought back to the draft: the seed's own
 * money is removed, because it was the seed's and not the student's, and the
 * claim opens where the exercise starts.
 *
 * The guard is `tutorialMoneyPending`. It never touches a chart whose claim was
 * submitted by a person — a claim timeline entry written by a phone number rather
 * than by the seed is the student's own Submit, and it stays exactly as it is.
 * Nor does it touch a chart that was never seeded: the clinical half runs first
 * and stamps the record, and only then is the claim considered.
 */

import type { Patient } from "../store/patientStore";
import type { PipelineEncounter } from "../store/pipelineEncounter";
import { buildClaimForm } from "../utils/claimAutoFill";
import type { ClaimStatus } from "./claimStatus";
import { priorAuthForClaim } from "./priorAuthNumber";
import { appendStatusEvent, makeStatusEvent } from "./statusEvent";
import {
  TUTORIAL_PATIENT_ID,
  TUTORIAL_SEED_VERSION,
  tutorialClaimDraftOnRecord,
  tutorialSeedState,
} from "./tutorialEncounter";

/** The staff member a seed is written as: the engine itself, not a student. */
const SEED_BY = "system";

/**
 * True when a claim timeline entry was written by a person rather than the seed.
 *
 * The student's Submit records its 837P, 277CA, 835 and posting under their own
 * phone number (`store/pipelineStore.tsx`), the seed under `"system"`. That is
 * the one thing that tells a submitted claim the student made from a submitted
 * claim an older build made for them.
 */
function claimSubmittedByStudent(encounter: PipelineEncounter): boolean {
  return encounter.statusEvents.some(
    (event) => event.entityType === "claim" && !!event.by && event.by !== SEED_BY,
  );
}

/**
 * True when this record's claim still has to be opened as the filled draft.
 *
 * `false` for a chart that was never seeded (the clinical half has not run yet,
 * and `store/pipelineStore.tsx` asks this again once it has), `false` for a chart
 * already carrying this build's draft, and `false` for a claim a person
 * submitted — that one is the student's work and is never rewritten.
 */
export function tutorialMoneyPending(encounter: PipelineEncounter | null | undefined): boolean {
  if (!encounter) return false;
  const state = tutorialSeedState(encounter);
  if (!state) return false;
  if (tutorialClaimDraftOnRecord(encounter)) return false;
  if (claimSubmittedByStudent(encounter)) return false;
  return true;
}

/** The draft, said the same way in the claim's timeline. */
const DRAFT_REASON =
  "The claim was built from this encounter's coded lines and the patient's own coverage card. " +
  "Every box is filled; nothing has been transmitted. Press Submit to send it to the clearinghouse.";

/**
 * The Tutorial Patient's encounter with the claim filled in as a draft.
 *
 * `at` is the seed's timestamp and `claimNumber` is minted by the caller from the
 * student's own sequence, so two encounters can never share a number. Nothing
 * the clinical half wrote is touched: the note, its signature, the codes, the
 * authorisation, the stage the chart opens on and the role all stay as they were.
 *
 * A record that carries an older, already-submitted seed claim is brought back to
 * the draft in this same write: its remittances, ledger entries, denial and
 * claim-timeline entries are the seed's, and they are replaced by the one draft
 * entry below, so the paper, the money and the queue cannot disagree about a
 * claim that has not been sent.
 */
export function applyTutorialMoneySeed(
  encounter: PipelineEncounter,
  patient: Patient,
  at: string,
  claimNumber: string,
): PipelineEncounter {
  if (!tutorialMoneyPending(encounter)) return encounter;
  if ((patient.id ?? "") !== TUTORIAL_PATIENT_ID) return encounter;
  if (!claimNumber) return encounter;

  // Every box that can be read off the chart is read off the chart: the card for
  // 1a / 4 / 11, the patient for 2 / 3 / 5, the Coder's lines for 21 / 24A–J /
  // 28, the practice profile for 32 / 33 and the encounter's provider for 31 /
  // 24J. `demoFillMissingBoxes` is on for the reference chart, so a box the chart
  // genuinely cannot supply (the patient's own signature in box 12, a payer that
  // issues no group number in box 11) still prints rather than sitting blank.
  const claimForm = buildClaimForm({
    patient,
    displayName: encounter.displayName,
    pipeline: { ...encounter, demoFillMissingBoxes: true },
    paNumber: priorAuthForClaim({ paData: encounter.paData, cptCodes: encounter.cptCodes }) || undefined,
    encounterDate: encounter.codingLines[0]?.dateOfService,
    placeOfService: encounter.codingLines[0]?.placeOfService,
  });
  // A claim with no line on it is not a filled claim: leave the record alone
  // rather than hand the student an empty paper to submit.
  const billable = claimForm.serviceLines.filter((line) => (line.cpt ?? "").trim() !== "");
  if (billable.length === 0) return encounter;

  // The claim's timeline starts here and holds one entry until the student acts.
  // Everything an older build recorded *for this claim* was the seed's, so the
  // claim's own entries are dropped — a 277CA the student never asked for must
  // not sit above the draft they are about to send. The encounter's own entries
  // (the note's signature, the codes, the authorisation) are not the claim's and
  // are kept exactly as the clinical half wrote them.
  // The encounter's own entries stay, so the claim's first entry takes its
  // sequence number from them — two entries can never share an id.
  const keptEvents = encounter.statusEvents.filter((event) => event.entityType !== "claim");
  const created = makeStatusEvent(
    {
      entityType: "claim",
      entityId: claimNumber,
      patientId: encounter.patientId,
      claimNumber,
      at,
      from: "coded",
      to: "draft",
      by: SEED_BY,
      jobRole: "biller",
      reasonCode: "CLAIM_CREATED",
      reason: DRAFT_REASON,
    },
    keptEvents,
  );

  return {
    ...encounter,
    claimForm,
    claimNumber,
    claimStatus: "draft" as ClaimStatus,
    claimStatusMigrated: false,
    statusEvents: appendStatusEvent(keptEvents, created),
    // Nothing has been sent, so nothing has been priced, posted or queued.
    remittances: [],
    ledger: [],
    denialInfo: null,
    // The claim is coded and on the biller's desk; the money is not in yet.
    status: "coded",
    tutorialSeed: TUTORIAL_SEED_VERSION,
  };
}
