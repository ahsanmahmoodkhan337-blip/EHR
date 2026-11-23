/**
 * Registration transcription score — "n of m fields transcribed correctly".
 *
 * Front Desk (Registration) is a read-then-transcribe exercise: the two
 * documents — the government ID and the insurance card — are on screen above
 * the form, and the student copies the facts across. The score line on the card
 * panel is therefore counted in FIELDS, not points: how many of the eight
 * identity and coverage boxes the student saved hold what the document prints.
 * (The older 0–10 point score in `utils/scoring.ts` still feeds the student's
 * stage score; this module is only the line the student reads.)
 *
 * It is computed at the moment the student saves, never while they type: a live
 * count would tell them which box is wrong before they have committed, which is
 * the answer key on a working screen (standing rule 6).
 *
 * Expected values come from the patient's own record (`domain/patientCard.ts`),
 * never from a hardcoded set. A field the record holds must be matched; a field
 * it holds nothing for is credited when the student filled it, because there is
 * no phantom answer to compare against.
 */

import { box11Value } from "./claimParties";
import { patientCard, registrationExpectations, type CardHolder } from "./patientCard";

/** The eight boxes the transcription form saves. */
export interface TranscribedRegistration {
  firstName: string;
  lastName: string;
  /** MM/DD/YYYY, as the form collects it. */
  dob: string;
  payerName: string;
  subscriberId: string;
  groupNumber: string;
  payerId: string;
  relationship: string;
}

export interface TranscriptionScore {
  correct: number;
  total: number;
}

/** The number of fields the line counts — fixed, so "of 8" never drifts. */
export const TRANSCRIPTION_FIELD_COUNT = 8;

const same = (typed: string, expected: string) =>
  typed.trim().toLowerCase() === expected.trim().toLowerCase();

/**
 * Count one box: matched when the record holds a value to match, credited when
 * it holds none and the student filled something.
 */
function counts(typed: string, expected: string): boolean {
  const onRecord = expected.trim();
  if (onRecord) return same(typed, onRecord);
  return Boolean(typed.trim());
}

export function scoreTranscription(
  entry: TranscribedRegistration,
  patient: CardHolder | null | undefined,
): TranscriptionScore {
  const card = patientCard(patient);
  const expected = registrationExpectations(patient);

  // Box 11 prints N/A for a payer that issues no group number (original
  // Medicare), and the form is pre-filled with that value, so a faithful
  // transcription of the card's blank group box must not be marked wrong.
  const expectedGroup = box11Value(card.groupNumber, card.payerName);

  const results = [
    // Identity — the government ID's spelling wins.
    counts(entry.firstName, expected.firstName),
    counts(entry.lastName, expected.lastName),
    counts(entry.dob, expected.dateOfBirth),
    // Coverage — the insurance card is the only document that carries it.
    counts(entry.payerName, card.payerName),
    counts(entry.subscriberId, expected.memberId),
    counts(entry.groupNumber, expectedGroup),
    counts(entry.payerId, expected.payerId),
    counts(entry.relationship, card.relationship || "Self"),
  ];

  return {
    correct: results.filter(Boolean).length,
    total: TRANSCRIPTION_FIELD_COUNT,
  };
}
