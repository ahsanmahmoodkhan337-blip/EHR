/**
 * noteStatus.ts — one note, one status
 *
 * Inspired by: Epic's note-status badge (Draft / Signed) and the read-only lock
 * that appears on a signed note in every activity that opens it. Once the
 * clinician signs, the note is the record the coder, the biller and the payer
 * read; nobody edits it in place.
 *
 * WHY ONE MODULE
 * The visit's note used to exist twice: the pipeline encounter's `scribeNote`
 * (signed through `domain/signNote.ts`) and a per-patient `noteDrafts` copy in
 * `store/ehrStore.ts` with its own `Draft | Signed` flag. The two disagreed, so a
 * note could read **signed** on the Coding queue and **draft** — or empty — on
 * Charts, and the encounter screen could call an unsigned note signed because it
 * kept a third flag of its own. Every screen now asks this module.
 *
 * THE RULE
 *   - The **signature** is the encounter's own `NOTE_SIGNED` timeline entry — the
 *     one event `domain/signNote.ts` writes. It is the only thing that makes a
 *     note signed, and it is never removed.
 *   - A note with text and no signature is a **draft**.
 *   - A note with neither is **empty**.
 * A signed note is read-only everywhere: `noteReadOnly` is the single answer to
 * "may this be edited", so a screen cannot invent its own rule.
 *
 * Nothing here invents content: `parseNoteText` carries an older build's compiled
 * note text into the four SOAP fields it was compiled from, and `compileNoteText`
 * is the inverse the app writes. A note that has no SOAP headings is carried
 * forward verbatim as one block rather than being split on a guess.
 */

import type { PipelineEncounter } from "../store/pipelineEncounter";

/** The four SOAP sections of a progress note. */
export interface NoteFields {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

/** The sections in the order a note reads, with the heading the app writes. */
export const NOTE_FIELD_ORDER: readonly { key: keyof NoteFields; heading: string }[] = [
  { key: "subjective", heading: "SUBJECTIVE" },
  { key: "objective", heading: "OBJECTIVE" },
  { key: "assessment", heading: "ASSESSMENT" },
  { key: "plan", heading: "PLAN" },
];

/** A note nobody has typed into yet. */
export const EMPTY_NOTE_FIELDS: NoteFields = {
  subjective: "",
  objective: "",
  assessment: "",
  plan: "",
};

/** The four sections, each as a string, from whatever was stored. */
export function normalizeNoteFields(value: unknown): NoteFields {
  if (typeof value === "string") return parseNoteText(value);
  if (!value || typeof value !== "object") return { ...EMPTY_NOTE_FIELDS };
  const raw = value as Partial<Record<keyof NoteFields, unknown>>;
  const text = (key: keyof NoteFields) => (typeof raw[key] === "string" ? (raw[key] as string) : "");
  return {
    subjective: text("subjective"),
    objective: text("objective"),
    assessment: text("assessment"),
    plan: text("plan"),
  };
}

/**
 * A compiled note ("SUBJECTIVE:\n…") back into its four sections.
 *
 * The heading must start a line and be followed by a colon, which is exactly how
 * `compileNoteText` writes them. Text before the first heading, or a note with no
 * heading at all, is carried forward verbatim in Subjective — the old build wrote
 * free text there, and splitting it on a guess would invent structure.
 */
export function parseNoteText(text: string): NoteFields {
  const fields: NoteFields = { ...EMPTY_NOTE_FIELDS };
  const source = typeof text === "string" ? text : "";
  if (!source.trim()) return fields;

  const headings: { key: keyof NoteFields; index: number; end: number }[] = [];
  const headingPattern = /^[ \t]*(SUBJECTIVE|OBJECTIVE|ASSESSMENT|PLAN)[ \t]*:[ \t]*/gim;
  let match: RegExpExecArray | null;
  while ((match = headingPattern.exec(source)) !== null) {
    const key = match[1].toLowerCase() as keyof NoteFields;
    headings.push({ key, index: match.index, end: match.index + match[0].length });
  }
  if (headings.length === 0) {
    fields.subjective = source;
    return fields;
  }
  const before = source.slice(0, headings[0].index).trim();
  headings.forEach((heading, i) => {
    const stop = i + 1 < headings.length ? headings[i + 1].index : source.length;
    const body = source.slice(heading.end, stop).trim();
    fields[heading.key] = fields[heading.key] ? `${fields[heading.key]}\n\n${body}`.trim() : body;
  });
  if (before) fields.subjective = fields.subjective ? `${before}\n\n${fields.subjective}` : before;
  return fields;
}

/** The one text form of a note — what a read-only screen prints. */
export function compileNoteText(fields: NoteFields): string {
  return NOTE_FIELD_ORDER.map(({ key, heading }) => {
    const body = (fields[key] ?? "").trim();
    return body ? `${heading}:\n${body}` : "";
  })
    .filter(Boolean)
    .join("\n\n");
}

/** True when any section holds text the student typed. */
export function noteFieldsHaveText(fields: NoteFields | null | undefined): boolean {
  if (!fields) return false;
  return NOTE_FIELD_ORDER.some(({ key }) => (fields[key] ?? "").trim().length > 0);
}

/** The part of an encounter this module reads. */
export type NoteRecord = Pick<PipelineEncounter, "scribeNote" | "statusEvents"> &
  Partial<Pick<PipelineEncounter, "noteFields">>;

/** The encounter's note as its four sections, whatever shape it was saved in. */
export function noteFieldsOf(record: NoteRecord | null | undefined): NoteFields {
  if (!record) return { ...EMPTY_NOTE_FIELDS };
  if (record.noteFields) return normalizeNoteFields(record.noteFields);
  return normalizeNoteFields(record.scribeNote);
}

/** The encounter's note as one text, from its sections (or its saved text). */
export function noteTextOf(record: NoteRecord | null | undefined): string {
  if (!record) return "";
  const fields = noteFieldsOf(record);
  if (noteFieldsHaveText(fields)) return compileNoteText(fields);
  return typeof record.scribeNote === "string" ? record.scribeNote : "";
}

/**
 * When this encounter's note was signed, from its own `NOTE_SIGNED` timeline
 * entry — the event Sign & Lock writes. Null when no note was ever signed.
 */
export function noteSignedAt(record: NoteRecord | null | undefined): string | null {
  const events = (record?.statusEvents ?? []).filter((event) => event.reasonCode === "NOTE_SIGNED");
  if (events.length === 0) return null;
  return events.reduce((latest, event) => (event.at > latest ? event.at : latest), events[0].at);
}

/** Who signed it — the phone number the store stamped on the event. */
export function noteSignedBy(record: NoteRecord | null | undefined): string | null {
  const events = (record?.statusEvents ?? []).filter((event) => event.reasonCode === "NOTE_SIGNED");
  if (events.length === 0) return null;
  return events[events.length - 1].by ?? null;
}

/** `empty`, `draft` or `signed` — the one answer every screen uses. */
export type NoteStatus = "empty" | "draft" | "signed";

export function noteStatus(record: NoteRecord | null | undefined): NoteStatus {
  if (noteSignedAt(record)) return "signed";
  return noteFieldsHaveText(noteFieldsOf(record)) || Boolean(noteTextOf(record).trim())
    ? "draft"
    : "empty";
}

/** What a badge prints. No screen keeps its own wording. */
export const NOTE_STATUS_LABEL: Record<NoteStatus, string> = {
  empty: "Empty",
  draft: "Draft",
  signed: "Signed",
};

/**
 * May this note still be edited? False the moment it is signed — on every
 * screen, not only where it was signed.
 */
export function noteReadOnly(record: NoteRecord | null | undefined): boolean {
  return noteStatus(record) === "signed";
}
