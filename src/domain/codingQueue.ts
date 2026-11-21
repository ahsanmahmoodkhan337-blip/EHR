/**
 * codingQueue.ts — the work the Coding stage is waiting for
 *
 * Inspired by: Epic's coding workqueue and athenahealth's "Coding pending"
 * worklist — the counted list a coder opens first, one row per encounter, each
 * row opening that encounter's own Coding screen.
 *
 * WHERE THE NUMBERS COME FROM — the store, named
 * One store: the **pipeline store** (`src/store/pipelineStore.tsx`), which holds
 * one `PipelineEncounter` per patient under `pipeline.encounters` and is
 * persisted per student by `src/store/persistence.ts` under the key
 * `hh_userdata_<phone>`. This module is handed those records and reads nothing
 * else: no seed list, no demo row and no hand-kept number. A queue is empty only
 * because the student's saved records are, which is why the page says which
 * stage produces the first row instead of showing a sample one.
 *
 * THE TWO BUCKETS (owner's audit, 2026-11-20, item 2)
 *  (a) `signed-not-coded` — the note is signed and locked (the encounter's own
 *      `NOTE_SIGNED` entry, written by `signNote`) and no diagnosis or procedure
 *      has been submitted yet.
 *  (b) `coded-not-billed` — codes have been submitted and the encounter has no
 *      claim yet, so the work has not reached Billing.
 * An encounter sits in **exactly one** bucket: coded work leaves (a) the moment
 * its codes are submitted, and leaves (b) the moment its claim exists. A note
 * that was never signed is the scribe's work and appears in neither.
 *
 * WHAT IT DOES NOT DO
 * It never decides whether a code is right, never reads a draft note, and never
 * counts a claim. The row's address is the patient's own encounter id, so a row
 * opens `/encounter/<encounterId>/coding` — the same screen the stepper opens.
 */

import { formatWhen } from "./homeWorkQueues";
import type { RailField, RailRow } from "./railPages";
import type { PipelineEncounter } from "../store/pipelineEncounter";

/** The two lists the Coding page shows. */
export type CodingBucketId = "signed-not-coded" | "coded-not-billed";

/** One row: what it is about, the facts behind it and where it opens. */
export interface CodingQueueRow extends RailRow {
  bucket: CodingBucketId;
  /** The encounter id in the address bar — the patient's own id. */
  encounterId: string | null;
  /** When the note was signed, so the two lists can be sorted together. */
  signedAt: string;
}

export interface CodingQueue {
  signedNotCoded: CodingQueueRow[];
  codedNotBilled: CodingQueueRow[];
  /** Every row the page shows, newest signature first. */
  all: CodingQueueRow[];
  total: number;
}

export type NameForPatient = (
  patientId: string | null | undefined,
  fallback?: string | null,
) => string;

/**
 * When this encounter's note was signed, from its own `NOTE_SIGNED` timeline
 * entry — the event Sign & Lock writes. Null when no note was ever signed.
 */
export function noteSignedAt(enc: PipelineEncounter): string | null {
  const signed = (enc.statusEvents ?? []).filter((event) => event.reasonCode === "NOTE_SIGNED");
  if (signed.length === 0) return null;
  return signed.reduce((latest, event) => (event.at > latest ? event.at : latest), signed[0].at);
}

/** True once the coder has submitted at least one diagnosis or procedure. */
export function hasSubmittedCodes(enc: PipelineEncounter): boolean {
  return enc.icdCodes.length > 0 || enc.cptCodes.length > 0;
}

/**
 * True once this encounter has a claim — its number is minted the first time the
 * claim's paper is opened, so a numbered claim has reached Billing.
 */
export function hasClaim(enc: PipelineEncounter): boolean {
  return Boolean(enc.claimNumber) || enc.claimStatus !== null || enc.claimForm !== null;
}

/** Which list this encounter belongs in, or null when Coding is not waiting on it. */
export function codingBucket(enc: PipelineEncounter): CodingBucketId | null {
  if (!noteSignedAt(enc)) return null;
  if (!hasSubmittedCodes(enc)) return "signed-not-coded";
  if (hasClaim(enc)) return null;
  return "coded-not-billed";
}

/** "J06.9" or "3 submitted" — a count, never the code set's opinion. */
function codesField(codes: string[]): string {
  if (codes.length === 0) return "none submitted";
  if (codes.length <= 2) return codes.join(", ");
  return `${codes.length} submitted`;
}

function rowFor(enc: PipelineEncounter, bucket: CodingBucketId, nameForPatient: NameForPatient): CodingQueueRow {
  const signedAt = noteSignedAt(enc) ?? "";
  const encounterId = enc.patientId;
  const title = nameForPatient(enc.patientId, enc.displayName);
  const fields: RailField[] =
    bucket === "signed-not-coded"
      ? [
          { label: "Note signed", value: formatWhen(signedAt) },
          { label: "Diagnoses", value: "none submitted" },
          { label: "Procedures", value: "none submitted" },
          { label: "Waiting at", value: "Coding" },
        ]
      : [
          { label: "Note signed", value: formatWhen(signedAt) },
          { label: "Diagnoses", value: codesField(enc.icdCodes) },
          { label: "Procedures", value: codesField(enc.cptCodes) },
          { label: "Claim", value: "not created yet" },
          { label: "Waiting at", value: "Billing" },
        ];
  return {
    id: `coding-${bucket}-${encounterId ?? "unassigned"}`,
    bucket,
    encounterId,
    signedAt,
    title,
    fields,
    action: bucket === "signed-not-coded" ? "Code this encounter" : "Finish this coding",
    target: { kind: "medical", patientId: enc.patientId, role: "coder", stage: "coding" },
  };
}

/**
 * Both lists, from the student's saved encounters. Newest signature first, and
 * an encounter appears once — its bucket decides which list.
 */
export function buildCodingQueue({
  encounters,
  nameForPatient,
}: {
  encounters: PipelineEncounter[];
  nameForPatient: NameForPatient;
}): CodingQueue {
  const all = encounters
    .map((enc) => {
      const bucket = codingBucket(enc);
      return bucket ? rowFor(enc, bucket, nameForPatient) : null;
    })
    .filter((row): row is CodingQueueRow => row !== null)
    .sort((a, b) => (a.signedAt < b.signedAt ? 1 : a.signedAt > b.signedAt ? -1 : 0));

  return {
    signedNotCoded: all.filter((row) => row.bucket === "signed-not-coded"),
    codedNotBilled: all.filter((row) => row.bucket === "coded-not-billed"),
    all,
    total: all.length,
  };
}
