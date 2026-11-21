/**
 * data-scoping.test.ts — a claim and a prior auth belong to a patient and an
 * encounter, and the coded charge arrives in the claim
 *
 * Spec `encounter-flow-audit-2026-11-20.md` item 5 (data scoping). What is
 * checked here, against the pure module `src/domain/dataScoping.ts`:
 *
 *  - **no patient / no encounter → no record.** `scopingRefusal` names what is
 *    missing for both, so a claim number is never minted and a PA is never
 *    stored for a patient that does not exist;
 *  - **the PA queue inside an encounter is that patient's queue**, and the
 *    records that belong to someone else are counted, not listed;
 *  - **CLM-000004 / CLM-000005 are flagged demo orphans**, never left reading as
 *    the student's own claim, and never deleted;
 *  - **the charge, units, place of service and modifiers coded in Coding arrive
 *    in the claim** (box 24F, 24G, 24B, 24D) with box 28 summed from the lines —
 *    the "CLM-000006 says no charge captured" case — and a value the student
 *    typed on the claim is never overwritten;
 *  - the screens and the store that write these records call the same module, so
 *    the visible rule and the saved rule cannot drift apart.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  canCreateRecord,
  carryCodingIntoClaim,
  claimRowTitle,
  encounterIdFor,
  isOrphanClaim,
  ORPHAN_CLAIM_LABEL,
  otherPatientsNote,
  recordsWithNoPatient,
  scopeRecordsToPatient,
  scopingRefusal,
} from "../src/domain/dataScoping";
import { buildClaimRows } from "../src/domain/railPages";
import { buildMedicalQueueRows } from "../src/domain/homeWorkQueues";
import { createEncounter, type ClaimServiceLine, type PipelineEncounter } from "../src/store/pipelineEncounter";
import { blankClaimForm, blankServiceLine } from "../src/utils/claimAutoFill";

const root = join(import.meta.dir, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const NAMES: Record<string, string> = { "MPT-2001": "Amara Okafor", "MPT-2002": "Luis Ferreira" };
const nameForPatient = (patientId: string | null | undefined, fallback?: string | null): string =>
  (patientId ? NAMES[patientId] : undefined) ?? fallback ?? "No patient attached";

/** The coder's handover for CPT 90471 — the code CLM-000006 was coded with. */
function coderLine(overrides: Partial<ClaimServiceLine> = {}): ClaimServiceLine {
  return {
    dateOfService: "2026-11-18",
    placeOfService: "11",
    cpt: "90471",
    modifiers: ["25"],
    diagnosisPointer: "A",
    charge: 145,
    units: 2,
    renderingNpi: "1999999999",
    ...overrides,
  };
}

/** A claim record as an earlier build left it: no lines, no charge. */
function emptyClaim() {
  return blankClaimForm();
}

function encounterWith(patientId: string | null, patch: Partial<PipelineEncounter> = {}): PipelineEncounter {
  return { ...createEncounter(patientId), ...patch };
}

// ─── 1. No patient or no encounter, no record ──────────────────────

describe("a claim or a PA needs a patient and an encounter", () => {
  test("both ids present → allowed", () => {
    expect(scopingRefusal({ patientId: "MPT-2001", encounterId: "MPT-2001" })).toBeNull();
    expect(canCreateRecord({ patientId: "MPT-2001", encounterId: "MPT-2001" })).toBe(true);
  });

  test("no patient → refused, and the refusal names the patient", () => {
    const refusal = scopingRefusal({ patientId: null, encounterId: null });
    expect(refusal?.code).toBe("no-patient");
    expect(refusal?.message).toContain("No patient");
    expect(refusal?.nextStep.length).toBeGreaterThan(0);
    expect(canCreateRecord({ patientId: null, encounterId: "MPT-2001" })).toBe(false);
  });

  test("a blank or stringified-empty id is not an id", () => {
    for (const blank of ["", "   ", "undefined", "null"]) {
      expect(scopingRefusal({ patientId: blank, encounterId: blank })?.code).toBe("no-patient");
    }
  });

  test("a patient with no encounter → refused", () => {
    const refusal = scopingRefusal({ patientId: "MPT-2001", encounterId: null });
    expect(refusal?.code).toBe("no-encounter");
    expect(refusal?.message).toContain("encounter");
  });

  test("the encounter id is the patient's id in this build", () => {
    expect(encounterIdFor("MPT-2001")).toBe("MPT-2001");
    expect(encounterIdFor(null)).toBeNull();
  });

  test("the store refuses a claim with no patient and a PA with no patient", () => {
    const store = read("src/store/pipelineStore.tsx");
    const setClaimForm = store.slice(store.indexOf("const setClaimForm"));
    expect(setClaimForm.slice(0, 1200)).toContain("scopingRefusal");
    // The refusal happens before a claim number is minted. The mint is the
    // student's shared sequence (`store/claimSequence.ts`), not the track's own.
    expect(setClaimForm.indexOf("scopingRefusal")).toBeLessThan(
      setClaimForm.indexOf("mintNextClaimNumber"),
    );

    const addPA = store.slice(store.indexOf("const addPARecord"));
    expect(addPA.slice(0, 600)).toContain("scopingRefusal");
    const submitPA = store.slice(store.indexOf("const submitPA"));
    expect(submitPA.slice(0, 600)).toContain("scopingRefusal");
  });

  test("the PA screen refuses visibly and reads the same module", () => {
    const portal = read("src/components/PriorAuthPortal/PriorAuthPortal.tsx");
    expect(portal).toContain("scopingRefusal");
    expect(portal).toContain("No prior authorisation can be created");
    expect(portal).toContain("disabled={!procedure || Boolean(paScope)}");
  });

  test("the Billing desk draws no paper and mints no claim with no patient", () => {
    const biller = read("src/components/BillingLedger/BillingLedger.tsx");
    expect(biller).toContain("scopingRefusal");
    expect(biller).toContain("No claim was created and no claim number was issued");
    // The seeding effect stands down before it can mint a number: the guard
    // precedes the first buildClaimForm call.
    expect(biller).toContain("if (!patientId) return;");
    expect(biller.indexOf("if (!patientId) return;")).toBeLessThan(biller.indexOf("setClaimForm(\n        buildClaimForm"));
  });
});

// ─── 2. The PA queue inside an encounter ───────────────────────────

describe("a PA queue inside an encounter lists that patient's PAs only", () => {
  const records = [
    { id: "PA-1", patientId: "MPT-2001", procedure: "MRI lumbar spine" },
    { id: "PA-2", patientId: "MPT-2002", procedure: "CT abdomen" },
    { id: "PA-3", patientId: "MPT-2001", procedure: "Epidural injection" },
    { id: "PA-4", patientId: null, procedure: "No patient attached" },
  ];

  test("only the patient on screen's records", () => {
    const mine = scopeRecordsToPatient(records, "MPT-2001");
    expect(mine.map((r) => r.id)).toEqual(["PA-1", "PA-3"]);
  });

  test("another patient's records are not shown", () => {
    const mine = scopeRecordsToPatient(records, "MPT-2002");
    expect(mine.map((r) => r.id)).toEqual(["PA-2"]);
  });

  test("no patient on screen means no queue at all", () => {
    expect(scopeRecordsToPatient(records, null)).toEqual([]);
    expect(scopeRecordsToPatient(records, "")).toEqual([]);
  });

  test("records with no patient are identifiable, and are not deleted", () => {
    expect(recordsWithNoPatient(records).map((r) => r.id)).toEqual(["PA-4"]);
    expect(records).toHaveLength(4);
  });

  test("the queue says how many belong to someone else", () => {
    const mine = scopeRecordsToPatient(records, "MPT-2001");
    const note = otherPatientsNote(records.length, mine.length);
    expect(note).toContain("2 more prior authorisations");
    expect(otherPatientsNote(2, 2)).toBeNull();
  });

  test("the PA screen builds its queue through the scoping module", () => {
    const portal = read("src/components/PriorAuthPortal/PriorAuthPortal.tsx");
    expect(portal).toContain("scopeRecordsToPatient(paRecords, patientId)");
    expect(portal).toContain("otherPatientsNote(paRecords.length, myPaRecords.length)");
    // The queue is no longer every record the student ever made.
    expect(portal).not.toContain("return paRecords.map((r) => {");
  });
});

// ─── 3. A claim with no patient is a flagged demo orphan ───────────

describe("CLM-000004 and CLM-000005 are flagged demo orphans", () => {
  const orphan = encounterWith(null, { claimNumber: "CLM-000004", claimStatus: "draft" });

  test("the orphan is recognised by its missing patient", () => {
    expect(isOrphanClaim(orphan)).toBe(true);
    expect(isOrphanClaim(encounterWith("MPT-2001", { claimNumber: "CLM-000006" }))).toBe(false);
    // An encounter with no claim at all is not an orphan claim.
    expect(isOrphanClaim(encounterWith(null))).toBe(false);
  });

  test("the label says exactly what it is", () => {
    expect(claimRowTitle("CLM-000004", "No patient attached", true)).toContain(ORPHAN_CLAIM_LABEL);
    expect(claimRowTitle("CLM-000006", "Amara Okafor", false)).toBe("CLM-000006 · Amara Okafor");
  });

  test("the Claims list leaves it out — the record is kept, the row is not printed", () => {
    // Owner's student-experience work order, 2026-11-21, item 4: "fix or remove
    // claims showing 'No patient attached'". A claim with no patient cannot be
    // billed, coded or opened, so /claims no longer lists it; the encounter record
    // itself is untouched (nothing here deletes it).
    const rows = buildClaimRows({
      encounters: [orphan, encounterWith("MPT-2001", { claimNumber: "CLM-000006" })],
      nameForPatient,
    });
    expect(rows.find((row) => row.claimNumber === "CLM-000004")).toBeUndefined();
    const real = rows.find((row) => row.claimNumber === "CLM-000006")!;
    expect(real.title).not.toContain("demo orphan");
    expect(real.title).not.toContain("No patient attached");
    expect(real.fields.some((f) => f.label === "Record")).toBe(false);
    // The record that produced it is still an orphan in the store.
    expect(isOrphanClaim(orphan)).toBe(true);
  });

  test("Home's claim queues label it too, and still list it", () => {
    const rows = buildMedicalQueueRows({
      encounters: [orphan],
      arWorkItems: [],
      nameForPatient,
      roleLabel: (role) => role,
    });
    const all = rows.flatMap((queue) => queue.entries);
    const row = all.find((r) => r.id.includes("CLM-000004"));
    expect(row).toBeDefined();
    expect(row!.label).toContain(ORPHAN_CLAIM_LABEL);
  });
});

// ─── 4. The coded charge arrives in the claim ──────────────────────

describe("charge, units, place of service and modifiers carry from Coding into the claim", () => {
  test("an empty box 24 takes the coder's lines and box 28 sums them", () => {
    const form = emptyClaim();
    const result = carryCodingIntoClaim(form, [coderLine()]);
    expect(result.changed).toBe(true);
    expect(result.carried).toEqual(["90471"]);
    expect(result.form.serviceLines).toHaveLength(1);
    const line = result.form.serviceLines[0];
    expect(line.cpt).toBe("90471");
    expect(line.charge).toBe(145);        // 24F
    expect(line.units).toBe(2);           // 24G
    expect(line.placeOfService).toBe("11"); // 24B
    expect(line.modifiers).toEqual(["25"]); // 24D
    expect(line.idQualifier).toBe("XX");  // 24I — 24J is an NPI
    expect(result.form.totalCharge).toBe(145); // 28
  });

  test("the CLM-000006 case: a claim opened before Coding finished picks the charge up", () => {
    const form = emptyClaim();
    form.serviceLines = [{ ...blankServiceLine(), cpt: "90471", charge: 0, units: 1 }];
    const result = carryCodingIntoClaim(form, [coderLine()]);
    expect(result.changed).toBe(true);
    expect(result.form.serviceLines[0].charge).toBe(145);
    expect(result.form.serviceLines[0].units).toBe(2);
    expect(result.form.serviceLines[0].modifiers).toEqual(["25"]);
    expect(result.form.totalCharge).toBe(145);
    // And the Claims list no longer reads "no charge coded yet" for it.
    const enc = encounterWith("MPT-2001", {
      claimNumber: "CLM-000006",
      claimForm: result.form,
      codingLines: [coderLine()],
    });
    const row = buildClaimRows({ encounters: [enc], nameForPatient }).find((r) => r.claimNumber === "CLM-000006")!;
    expect(row.billedCents).toBe(14500);
    expect(row.fields.find((f) => f.label === "Billed")!.value).toBe("$145.00");
  });

  test("a value the student typed on the claim is never overwritten", () => {
    const form = emptyClaim();
    form.totalCharge = 300;
    form.serviceLines = [
      { ...blankServiceLine(), cpt: "90471", charge: 200, units: 3, placeOfService: "22", modifiers: ["59"] },
    ];
    const result = carryCodingIntoClaim(form, [coderLine()]);
    expect(result.changed).toBe(false);
    expect(result.form.serviceLines[0].charge).toBe(200);
    expect(result.form.serviceLines[0].units).toBe(3);
    expect(result.form.serviceLines[0].placeOfService).toBe("22");
    expect(result.form.serviceLines[0].modifiers).toEqual(["59"]);
    expect(result.form.totalCharge).toBe(300);
  });

  test("running it twice changes nothing the second time", () => {
    const once = carryCodingIntoClaim(emptyClaim(), [coderLine()]);
    const twice = carryCodingIntoClaim(once.form, [coderLine()]);
    expect(twice.changed).toBe(false);
    expect(twice.form).toBe(once.form);
  });

  test("no coded lines leaves the claim exactly as it was", () => {
    const form = emptyClaim();
    expect(carryCodingIntoClaim(form, []).changed).toBe(false);
    expect(carryCodingIntoClaim(form, undefined).form).toBe(form);
    // A coder line with no CPT is not a line.
    expect(carryCodingIntoClaim(form, [coderLine({ cpt: "  " })]).changed).toBe(false);
  });

  test("a line the coder never coded is left alone", () => {
    const form = emptyClaim();
    form.serviceLines = [{ ...blankServiceLine(), cpt: "99214", charge: 0 }];
    const result = carryCodingIntoClaim(form, [coderLine()]);
    expect(result.changed).toBe(false);
    expect(result.form.serviceLines[0].charge).toBe(0);
  });

  test("the Billing desk carries the coder's lines into the claim it has open", () => {
    const biller = read("src/components/BillingLedger/BillingLedger.tsx");
    expect(biller).toContain("carryCodingIntoClaim(claimForm, state.codingLines)");
    expect(biller).toContain("patch.serviceLines = carried.form.serviceLines");
    expect(biller).toContain("patch.totalCharge = carried.form.totalCharge");
  });
});
