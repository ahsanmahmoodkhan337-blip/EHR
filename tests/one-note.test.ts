/**
 * Slice G — one note record, one status
 *
 * Spec `specs/slice-g-one-note.md`. A visit's note used to exist twice: the
 * pipeline encounter's `scribeNote` (signed through `domain/signNote.ts`) and a
 * per-patient `noteDrafts` copy in `store/ehrStore.ts` with its own
 * `Draft | Signed` flag. A note could read signed on one screen and draft on
 * another. These tests hold the one record and the one status together:
 *
 *   - Sign once, read everywhere: `domain/noteStatus.ts` answers for the
 *     Progress Note, Sign & Lock, Charts, the Coding queue and the stepper.
 *   - A signed note is read-only everywhere.
 *   - A reload keeps it signed.
 *   - A note saved by the old split is migrated, verbatim, and still signed.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createEncounter,
  normalizePipelineStore,
  type PipelineEncounter,
} from "../src/store/pipelineEncounter";
import { signNote } from "../src/domain/signNote";
import {
  compileNoteText,
  noteFieldsOf,
  noteReadOnly,
  noteSignedAt,
  noteStatus,
  parseNoteText,
} from "../src/domain/noteStatus";
import { buildCodingQueue, codingBucket } from "../src/domain/codingQueue";

const root = join(import.meta.dir, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const NOTE = {
  subjective: "Cough and wheeze for three days.",
  objective: "Expiratory wheeze, afebrile.",
  assessment: "Asthma exacerbation.",
  plan: "Albuterol inhaler, review in a week.",
};

const nameForPatient = (patientId: string | null | undefined, fallback?: string | null): string =>
  patientId ?? fallback ?? "No patient attached";

/** Sign the way the encounter's Sign & Lock does. */
function signed(patientId = "EMILY", at = "2026-11-21T10:00:00.000Z"): PipelineEncounter {
  return signNote(createEncounter(patientId), { note: NOTE, by: "+923000000000", at });
}

/** What a reload does: the record goes to JSON and comes back through the migration. */
function reload(enc: PipelineEncounter): PipelineEncounter {
  const saved = JSON.parse(JSON.stringify({ encounters: { [enc.patientId as string]: enc } }));
  return normalizePipelineStore(saved).encounters[enc.patientId as string];
}

describe("one note record, one status", () => {
  test("an untouched encounter is empty, and nothing is read-only", () => {
    const enc = createEncounter("EMILY");

    expect(noteStatus(enc)).toBe("empty");
    expect(noteReadOnly(enc)).toBe(false);
  });

  test("typing a note makes it a draft — not signed", () => {
    const enc = { ...createEncounter("EMILY"), noteFields: { ...NOTE }, scribeNote: compileNoteText(NOTE) };

    expect(noteStatus(enc)).toBe("draft");
    expect(noteReadOnly(enc)).toBe(false);
  });

  test("Sign & Lock signs once and the note reads signed everywhere", () => {
    const enc = signed();

    expect(noteStatus(enc)).toBe("signed");
    expect(noteReadOnly(enc)).toBe(true);
    expect(noteSignedAt(enc)).toBe("2026-11-21T10:00:00.000Z");
    // The same record the coder reads.
    expect(codingBucket(enc)).toBe("signed-not-coded");
    expect(buildCodingQueue({ encounters: [enc], nameForPatient }).signedNotCoded).toHaveLength(1);
  });

  test("the note's text and its sections are one record, written by one call", () => {
    const enc = signed();

    expect(noteFieldsOf(enc)).toEqual(NOTE);
    expect(enc.scribeNote).toBe(compileNoteText(NOTE));
    expect(enc.scribeNote).toContain("Asthma exacerbation.");
  });

  test("a note is signed once — signing again keeps one signature", () => {
    const once = signed();
    const twice = signNote(once, { note: { ...NOTE, plan: "changed" }, by: "+923000000000" });

    expect(twice.statusEvents.filter((e) => e.reasonCode === "NOTE_SIGNED")).toHaveLength(1);
    expect(noteStatus(twice)).toBe("signed");
  });

  test("a reload keeps it signed, with the same note", () => {
    const back = reload(signed());

    expect(noteStatus(back)).toBe("signed");
    expect(noteReadOnly(back)).toBe(true);
    expect(noteFieldsOf(back)).toEqual(NOTE);
    expect(codingBucket(back)).toBe("signed-not-coded");
  });

  test("a draft is never in the Coding queue, however much text it holds", () => {
    const draft = {
      ...createEncounter("EMILY"),
      noteFields: { ...NOTE },
      scribeNote: compileNoteText(NOTE),
    };

    expect(codingBucket(draft)).toBeNull();
    expect(buildCodingQueue({ encounters: [draft], nameForPatient }).total).toBe(0);
  });
});

describe("migration — a note saved by the old split", () => {
  /** A real old-shape record: text only, no `noteFields`, signed by the old build. */
  const oldSigned = {
    patientId: "EMILY",
    stage: "coder",
    status: "charted",
    scribeNote: "SUBJECTIVE:\nCough for three days.\n\nOBJECTIVE:\nWheeze.\n\nASSESSMENT:\nAsthma.\n\nPLAN:\nInhaler.",
    statusEvents: [
      {
        id: "encounter:EMILY:NOTE_SIGNED",
        entityType: "encounter",
        entityId: "EMILY",
        patientId: "EMILY",
        from: "open",
        to: "signed",
        at: "2026-11-19T09:00:00.000Z",
        by: "+923000000000",
        jobRole: "scribe",
        reasonCode: "NOTE_SIGNED",
        reason: "The progress note was signed and locked.",
      },
    ],
  };

  test("a note signed before this slice still reads signed", () => {
    const enc = normalizePipelineStore({ encounters: { EMILY: oldSigned } }).encounters.EMILY;

    expect(noteStatus(enc)).toBe("signed");
    expect(noteReadOnly(enc)).toBe(true);
    expect(codingBucket(enc)).toBe("signed-not-coded");
  });

  test("its text is carried forward verbatim, and its sections are parsed from it", () => {
    const enc = normalizePipelineStore({ encounters: { EMILY: oldSigned } }).encounters.EMILY;

    expect(enc.scribeNote).toBe(oldSigned.scribeNote);
    expect(noteFieldsOf(enc).subjective).toBe("Cough for three days.");
    expect(noteFieldsOf(enc).assessment).toBe("Asthma.");
  });

  test("an old unsigned draft is a draft, and never appears in the queue", () => {
    const enc = normalizePipelineStore({
      encounters: { EMILY: { ...oldSigned, statusEvents: [] } },
    }).encounters.EMILY;

    expect(noteStatus(enc)).toBe("draft");
    expect(noteReadOnly(enc)).toBe(false);
    expect(codingBucket(enc)).toBeNull();
  });

  test("a free-text note with no SOAP headings is not split on a guess", () => {
    expect(parseNoteText("Patient seen, doing well.")).toEqual({
      subjective: "Patient seen, doing well.",
      objective: "",
      assessment: "",
      plan: "",
    });
  });
});

describe("every screen asks the one module", () => {
  test("Charts and the Coding queue read the status, not a flag of their own", () => {
    const charts = read("src/routes/charts.tsx");
    const codingQueue = read("src/components/CodingQueue/CodingQueue.tsx");
    const encounterScreen = read("src/routes/index.tsx");

    for (const source of [charts, codingQueue, encounterScreen]) {
      expect(source).toContain("domain/noteStatus");
    }
    // No screen keeps its own signed flag.
    expect(encounterScreen).not.toContain("submittedToCoding");
    // Charts no longer keeps a second copy of the note.
    expect(charts).not.toContain("noteDrafts");
  });

  test("the queue's signature comes from the one module", () => {
    const queue = read("src/domain/codingQueue.ts");

    expect(queue).toContain('from "./noteStatus"');
    expect(queue).toContain("noteStatus(enc)");
  });
});
