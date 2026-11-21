/**
 * signNote.ts — the one place a progress note becomes "signed and locked"
 *
 * Inspired by: Epic's "Sign & Lock" on the note activity — the clinician's
 * signature is the moment the note stops being a draft and becomes the record
 * the coder, the biller and the payer all read.
 *
 * WHY ONE FUNCTION
 * The signature used to be built inline in the pipeline store, so the only way a
 * test could produce a signed encounter was to hand-write a `NOTE_SIGNED`
 * timeline entry — a fake signature that could differ from the real one. The
 * store, the Coding queue's tests and the encounter's own record now all go
 * through this function, so "signed" means exactly one thing.
 *
 * WHAT IT WRITES
 * One `NOTE_SIGNED` timeline entry and the note text, in a single record. It
 * invents nothing else: no code, no claim, no money. An encounter signed twice
 * keeps one signature, because `appendStatusEvent` refuses a duplicate key.
 */

import { appendStatusEvent, makeStatusEvent } from "./statusEvent";
import { encounterEventId, type PipelineEncounter } from "../store/pipelineEncounter";

/** The reason sentence every signature records, shown to the student. */
export const NOTE_SIGNED_REASON =
  "The progress note was signed and locked, so the encounter is ready for coding.";

/**
 * The encounter as it stands after the note is signed: the note text, the
 * `NOTE_SIGNED` timeline entry, and the visit handed to the coder.
 */
export function signNote(
  enc: PipelineEncounter,
  opts: { note: string; by: string; at?: string },
): PipelineEncounter {
  const event = makeStatusEvent(
    {
      entityType: "encounter",
      entityId: encounterEventId(enc.patientId),
      patientId: enc.patientId,
      from: "open",
      to: "signed",
      by: opts.by,
      jobRole: "scribe",
      reasonCode: "NOTE_SIGNED",
      reason: NOTE_SIGNED_REASON,
      ...(opts.at ? { at: opts.at } : {}),
    },
    enc.statusEvents,
  );
  return {
    ...enc,
    scribeNote: opts.note,
    stage: "coder",
    status: "charted",
    statusEvents: appendStatusEvent(enc.statusEvents, event),
  };
}
