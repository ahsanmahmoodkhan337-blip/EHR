/**
 * The standard chart's note is not autosaved (owner report, 2026-11-23).
 *
 * *"The note was not saved."* appeared on the Tutorial Patient's Progress Note
 * by itself: the encounter's autosave timer, a blur, or the note panel closing
 * tried to write a chart that refuses student writes, and the store answered
 * with the refusal sentence. Nothing was typed, so nothing was lost — but the
 * student was told something went wrong.
 *
 * The rule: on a read-only chart the autosave does not attempt the write and
 * does not report one. A seed write is still allowed through.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const {
  clearTutorialRefusal,
  isSeedWrite,
  refuseStudentWrite,
  skipNoteAutosave,
  tutorialRefusal,
  withSeedWrite,
} = await import("../src/domain/tutorialReadOnly");
const { TUTORIAL_PATIENT_ID } = await import("../src/domain/tutorialEncounter");

afterEach(() => clearTutorialRefusal());

describe("which chart skips the note autosave", () => {
  test("the Tutorial Patient's chart, and no other", () => {
    expect(TUTORIAL_PATIENT_ID).toBe("DEMO");
    expect(skipNoteAutosave(TUTORIAL_PATIENT_ID)).toBe(true);
    expect(skipNoteAutosave("P-0002")).toBe(false);
    expect(skipNoteAutosave(null)).toBe(false);
    expect(skipNoteAutosave(undefined)).toBe(false);
  });

  test("the seed still fills the chart, so it is not skipped", () => {
    expect(isSeedWrite()).toBe(false);
    withSeedWrite(() => {
      expect(isSeedWrite()).toBe(true);
      expect(skipNoteAutosave(TUTORIAL_PATIENT_ID)).toBe(false);
    });
    expect(skipNoteAutosave(TUTORIAL_PATIENT_ID)).toBe(true);
  });

  test("skipping is what keeps the refusal sentence off the screen", () => {
    // The store still refuses a student write to the standard chart — that is
    // the lock, and it stays. The autosave simply never gets that far.
    expect(tutorialRefusal()).toBeNull();
    expect(refuseStudentWrite(TUTORIAL_PATIENT_ID, "The note")).toBe(true);
    expect(tutorialRefusal()).toContain("The note was not saved");

    clearTutorialRefusal();
    if (!skipNoteAutosave(TUTORIAL_PATIENT_ID)) refuseStudentWrite(TUTORIAL_PATIENT_ID, "The note");
    expect(tutorialRefusal()).toBeNull();
  });
});

describe("every autosave path asks first", () => {
  // The encounter's 5-second timer, blur and page hide.
  const encounter = read("src/routes/index.tsx");
  // The Progress Note stage's own debounce and its write-on-close.
  const notePanel = read("src/components/TabsEpic/ActiveProgressNote.tsx");
  // The Charts page's note editor.
  const charts = read("src/routes/charts.tsx");

  test("the encounter autosave returns before it writes", () => {
    expect(encounter).toContain('import { skipNoteAutosave } from "../domain/tutorialReadOnly";');
    expect(encounter).toMatch(
      /const saveNoteDraftNow = \(\) => \{[\s\S]{0,400}skipNoteAutosave\(snap\.patientId\)\) return;[\s\S]{0,600}writeNoteFor\(snap\.patientId/,
    );
  });

  test("the Progress Note panel writes only through the guarded helper", () => {
    expect(notePanel).toContain('import { skipNoteAutosave } from "../../domain/tutorialReadOnly";');
    expect(notePanel).toMatch(
      /const saveNote = \(fields: NoteFields\) => \{\s*if \(!patientId \|\| skipNoteAutosave\(patientId\)\) return;/,
    );
    // No bare write is left in the panel — every save goes through `saveNote`.
    expect(notePanel).not.toMatch(/if \(patientId\) writeNoteFor\(/);
    expect(notePanel).not.toMatch(/if \(patientId && writeNoteFor\(/);
  });

  test("the Charts page writes only through the guarded helper", () => {
    expect(charts).toContain('import { skipNoteAutosave } from "../domain/tutorialReadOnly";');
    expect(charts).toMatch(
      /const saveNote = \(fields: typeof latest\.current\) => \{\s*if \(skipNoteAutosave\(patient\.id\)\) return;/,
    );
    expect(charts).not.toMatch(/if \(writeNoteFor\(patient\.id, (latest\.current|next)\)\)/);
  });
});
