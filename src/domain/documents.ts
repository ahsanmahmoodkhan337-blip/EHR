/**
 * Documents — the papers a patient's chart actually produced
 * (`specs/patient-hub.md` § Documents).
 *
 * Inspired by: eClinicalWorks' Documents tab, where the claim form, the EOB and
 * the signed note sit in one list against the patient rather than being hunted
 * for on three different screens. The tab is deliberately small, and honest:
 *
 *   - A **generated** paper appears only when the record behind it exists. The
 *     claim form shows once the encounter holds one; the EOB shows once an 835
 *     has been posted. Nothing is listed in advance and nothing is invented —
 *     a patient with no work done has an empty tab that says so.
 *   - An **added** document is the student naming a paper the practice holds.
 *     It is a record, not a file: this build has no upload, and the tab says so
 *     instead of shipping a button that does nothing.
 *   - A superbill has no generator in this build yet, so none is listed. When
 *     the superbill stage lands it will emit one here the same way the claim
 *     form does.
 */

import { CLAIM_TYPE_PAPER, suggestClaimType, type ClaimType } from "../data/claims/claimType";

export type DocumentCategory = "claim-form" | "eob" | "superbill" | "note" | "other";

export type DocumentSource = "generated" | "added";

export interface DocumentRecord {
  id: string;
  patientId: string;
  /** The visit the paper belongs to, when it belongs to one. */
  encounterId?: string | null;
  name: string;
  category: DocumentCategory;
  createdAt: string;
  source: DocumentSource;
  /** One short line the student typed. Generated papers put the provenance here. */
  description?: string;
}

/** Short labels for the category select and the list. */
export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  "claim-form": "Claim form",
  eob: "EOB / 835",
  superbill: "Superbill",
  note: "Note",
  other: "Other",
};

/** The categories a student may file a document under. */
export const DOCUMENT_CATEGORY_OPTIONS: DocumentCategory[] = [
  "claim-form",
  "eob",
  "superbill",
  "note",
  "other",
];

/** What the tab prints instead of an upload button that would do nothing. */
export const DOCUMENTS_UPLOAD_NOTE =
  "File upload is not available yet — a document here is a named entry in the chart, not a stored file.";

/** The X12 transaction each claim type is submitted as. */
const CLAIM_X12: Record<ClaimType, string> = {
  professional: "837P",
  institutional: "837I",
  dental: "837D",
};

/** What an encounter has to tell the documents tab. */
export interface PaperSource {
  patientId: string;
  encounterId?: string | null;
  /** The encounter's claim number, when one exists. */
  claimNumber?: string | null;
  /** True when the encounter holds a generated claim form. */
  claimForm: boolean;
  /** The claim's place of service (box 24B), for choosing the paper. */
  placeOfService?: string | null;
  /** The patient's track — a dental encounter bills on the ADA form. */
  track?: string | null;
  /** One entry per 835 this encounter received. */
  remittances: { claimNumber?: string | null; postedAt?: string | null }[];
  /** ISO timestamp for a paper that carries no date of its own. */
  fallbackDate?: string;
}

/**
 * The papers the record already holds, newest first. Every entry names where it
 * came from: the printed form, the X12 transaction and the claim it belongs to.
 */
export function generatedDocuments(source: PaperSource): DocumentRecord[] {
  const papers: DocumentRecord[] = [];
  const at = source.fallbackDate ?? "";
  const encounterId = source.encounterId ?? null;

  if (source.claimForm) {
    const suggestion = suggestClaimType({
      placeOfService: source.placeOfService ?? null,
      track: source.track ?? null,
    });
    papers.push({
      id: `DOC-claim-form-${encounterId ?? source.patientId}`,
      patientId: source.patientId,
      encounterId,
      name: CLAIM_TYPE_PAPER[suggestion.claimType],
      category: "claim-form",
      createdAt: at,
      source: "generated",
      description: `${CLAIM_X12[suggestion.claimType]} claim${
        source.claimNumber ? ` ${source.claimNumber}` : " — no claim number yet"
      }`,
    });
  }

  for (const remittance of source.remittances) {
    const number = remittance.claimNumber ?? "";
    papers.push({
      id: `DOC-eob-${number || encounterId || source.patientId}`,
      patientId: source.patientId,
      encounterId,
      name: "835 remittance advice (EOB)",
      category: "eob",
      createdAt: remittance.postedAt ?? at,
      source: "generated",
      description: number ? `835 posted for claim ${number}` : "835 posted",
    });
  }

  return papers;
}

/**
 * Every document on the chart: the generated papers plus the ones the student
 * added, newest first. Two papers dated the same day keep a stable order by
 * name, so the list does not reshuffle between renders.
 */
export function documentsForPatient(
  added: DocumentRecord[] | null | undefined,
  generated: DocumentRecord[] | null | undefined,
  patientId?: string | null,
): DocumentRecord[] {
  const mine = (record: DocumentRecord) =>
    !patientId || record.patientId === patientId;
  return [...(generated ?? []), ...(added ?? [])]
    .filter(mine)
    .sort((a, b) => {
      const byDate = (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
      return byDate !== 0 ? byDate : a.name.localeCompare(b.name);
    });
}

export interface AddDocumentInput {
  patientId: string;
  name: string;
  category: DocumentCategory;
  description?: string;
  encounterId?: string | null;
  at: string;
  /** Idempotent id: one press, one entry. */
  id?: string;
}

/**
 * A document the student added, or null when there is no name to file it under.
 * Nothing is invented: an unnamed paper is refused rather than stored as
 * "Untitled".
 */
export function makeAddedDocument(input: AddDocumentInput): DocumentRecord | null {
  const name = input.name.trim();
  if (!name) return null;
  return {
    id: input.id ?? `DOC-${input.patientId}-${input.at}-${name}`,
    patientId: input.patientId,
    encounterId: input.encounterId ?? null,
    name,
    category: input.category,
    createdAt: input.at,
    source: "added",
    description: input.description?.trim() || undefined,
  };
}
