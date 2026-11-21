/**
 * The Coding queue — read from the student's saved records, never seeded
 *
 * Owner's audit, 2026-11-20, item 2: Coding must list (a) every signed encounter
 * not yet coded and (b) every encounter coded but not yet sent to billing, and a
 * row must open that patient's own Coding stage. It showed 0 while a note was
 * signed.
 *
 * The signed encounters here are produced by `signNote` — the same function the
 * pipeline store's Sign & Lock calls — so nothing is hand-seeded: a blank
 * encounter plus the app's own signature is all it takes for a row to appear.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createEncounter, type PipelineEncounter } from "../src/store/pipelineEncounter";
import { signNote } from "../src/domain/signNote";
import { buildCodingQueue, codingBucket } from "../src/domain/codingQueue";

const root = join(import.meta.dir, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const NAMES: Record<string, string> = { EMILY: "Emily Chen", LUIS: "Luis Ferreira" };
const nameForPatient = (patientId: string | null | undefined, fallback?: string | null): string =>
  (patientId ? NAMES[patientId] : undefined) ?? fallback ?? "No patient attached";

/** A patient's encounter as the chart opens it, then signed and locked. */
function signedEncounter(patientId: string, at = "2026-11-20T10:00:00.000Z"): PipelineEncounter {
  return signNote(createEncounter(patientId), {
    note: "S: cough and wheeze. O: expiratory wheeze. A: asthma exacerbation. P: inhaler.",
    by: "+923000000000",
    at,
  });
}

describe("Coding queue — a signed note appears without any manual seeding", () => {
  test("a blank encounter the chart signed lands in the queue", () => {
    const queue = buildCodingQueue({ encounters: [signedEncounter("EMILY")], nameForPatient });

    expect(queue.signedNotCoded).toHaveLength(1);
    expect(queue.total).toBe(1);
    expect(queue.all[0].title).toBe("Emily Chen");
  });

  test("the row opens that patient's Coding address", () => {
    const queue = buildCodingQueue({ encounters: [signedEncounter("EMILY")], nameForPatient });

    expect(queue.all[0].encounterId).toBe("EMILY");
    expect(queue.all[0].target).toEqual({
      kind: "medical",
      patientId: "EMILY",
      role: "coder",
      stage: "coding",
    });
    expect(queue.all[0].fields.find((field) => field.label === "Waiting at")?.value).toBe("Coding");
  });

  test("the row prints the signature time from the encounter's own timeline", () => {
    const queue = buildCodingQueue({ encounters: [signedEncounter("EMILY")], nameForPatient });

    expect(queue.all[0].fields.find((field) => field.label === "Note signed")?.value).not.toBe(
      "an unrecorded time",
    );
    expect(queue.all[0].fields.find((field) => field.label === "Diagnoses")?.value).toBe("none submitted");
  });

  test("an unsigned encounter is the scribe's work, not the coder's", () => {
    const blank = createEncounter("LUIS");
    const queue = buildCodingQueue({ encounters: [blank], nameForPatient });

    expect(codingBucket(blank)).toBeNull();
    expect(queue.total).toBe(0);
  });

  test("an empty store yields no rows — the page, not the builder, says what fills it", () => {
    expect(buildCodingQueue({ encounters: [], nameForPatient }).total).toBe(0);
  });
});

describe("Coding queue — coded but not yet sent to Billing", () => {
  const coded: PipelineEncounter = {
    ...signedEncounter("LUIS"),
    icdCodes: ["J45.901"],
    cptCodes: ["99213"],
    stage: "prior-auth",
    status: "coded",
  };

  test("submitted codes move the encounter out of the signed list into the coded list", () => {
    const queue = buildCodingQueue({ encounters: [coded], nameForPatient });

    expect(queue.signedNotCoded).toHaveLength(0);
    expect(queue.codedNotBilled).toHaveLength(1);
    expect(queue.codedNotBilled[0].fields.find((field) => field.label === "Waiting at")?.value).toBe(
      "Billing",
    );
    expect(queue.codedNotBilled[0].fields.find((field) => field.label === "Claim")?.value).toBe(
      "not created yet",
    );
  });

  test("an encounter appears in exactly one list", () => {
    const queue = buildCodingQueue({
      encounters: [signedEncounter("EMILY"), coded],
      nameForPatient,
    });

    expect(queue.total).toBe(2);
    expect(queue.signedNotCoded).toHaveLength(1);
    expect(queue.codedNotBilled).toHaveLength(1);
  });

  test("once the claim exists the encounter has reached Billing and leaves the queue", () => {
    const billed: PipelineEncounter = { ...coded, claimNumber: "CLM-000009", claimStatus: "draft" };
    const queue = buildCodingQueue({ encounters: [billed], nameForPatient });

    expect(codingBucket(billed)).toBeNull();
    expect(queue.total).toBe(0);
  });

  test("newest signature first, across both lists", () => {
    const older = signedEncounter("EMILY", "2026-11-19T10:00:00.000Z");
    const newer = signedEncounter("LUIS", "2026-11-21T10:00:00.000Z");
    const queue = buildCodingQueue({ encounters: [older, newer], nameForPatient });

    expect(queue.all.map((row) => row.title)).toEqual(["Luis Ferreira", "Emily Chen"]);
  });
});

describe("Coding page — the counts and the rows come from the saved records", () => {
  const page = read("src/routes/coding.tsx");
  const frame = read("src/components/rail/RailPageFrame.tsx");
  const store = read("src/store/pipelineStore.tsx");

  test("the page builds both lists from the pipeline store's encounters", () => {
    expect(page).toContain("buildCodingQueue");
    expect(page).toContain("Object.values(allEncounters)");
    expect(page).not.toMatch(/count=\{\s*\d+\s*\}/);
  });

  test("Sign & Lock writes the signature the queue reads", () => {
    expect(store).toContain("signNote(");
  });

  test("a row is the encounter's own address, not a role switch", () => {
    expect(frame).toContain("/encounter/$encounterId/$stage");
  });
});
