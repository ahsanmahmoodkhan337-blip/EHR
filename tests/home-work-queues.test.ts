/**
 * Home's work queues — one item, one queue.
 *
 * A dental case whose claim was transmitted used to appear in both "Claims
 * awaiting a payer response" and "Encounters left mid-stage", so Home counted
 * one piece of work twice. These tests hold the two pure row builders
 * (`src/domain/homeWorkQueues.ts`) to the rule the medical side already states:
 * a claim awaiting a payer, a claim ready to submit and a finished case each
 * belong to one queue only.
 */

import { describe, expect, test } from "bun:test";
import { buildDentalQueueRows, buildMedicalQueueRows, type QueueRow } from "../src/domain/homeWorkQueues";
import { migrateDentalTrackState } from "../src/components/dental/DentalTrackStore";
import { createEncounter, type PipelineEncounter } from "../src/store/pipelineEncounter";

const CASE_ID = "DCASE-001";
const CLAIM = "DCLM-0001";

function entriesOf(rows: QueueRow[], id: string) {
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error(`no queue row ${id}`);
  return row.entries;
}

/** A dental record as the dental track would have saved it. */
function dentalRecord(overrides: Record<string, unknown>) {
  return migrateDentalTrackState({
    version: 6,
    caseId: CASE_ID,
    stage: "claim",
    furthestStage: "claim",
    completedAt: null,
    lines: [
      {
        id: "L1",
        code: "D0274",
        dateOfService: "2026-03-02",
        feeUsd: 60,
        predeterminationOnFile: false,
        attachments: [],
      },
    ],
    claimSubmitted: false,
    claimNumber: null,
    claimStatus: null,
    statusEvents: [],
    lineResolutions: {},
    ledger: [],
    ...overrides,
  });
}

function medicalEncounter(overrides: Partial<PipelineEncounter>): PipelineEncounter {
  return { ...createEncounter("MPT-1001"), stage: "biller", scribeNote: "note", ...overrides };
}

const medicalInput = (encounters: PipelineEncounter[]) => ({
  encounters,
  arWorkItems: [],
  nameForPatient: (patientId: string | null | undefined, fallback?: string | null) =>
    fallback ?? patientId ?? "No patient attached",
  roleLabel: (role: string) => role,
});

describe("dental work queues", () => {
  test("a submitted claim counts once — awaiting, never mid-stage", () => {
    const rows = buildDentalQueueRows(
      dentalRecord({ claimSubmitted: true, claimNumber: CLAIM, claimStatus: "submitted" }),
    );

    expect(entriesOf(rows, "dental-awaiting")).toHaveLength(1);
    expect(entriesOf(rows, "dental-mid")).toHaveLength(0);

    const namedTwice = rows.filter((r) => r.entries.some((e) => e.label.includes(CLAIM)));
    expect(namedTwice).toHaveLength(1);
  });

  test("a coded, not transmitted claim counts in ready only", () => {
    const rows = buildDentalQueueRows(dentalRecord({}));

    expect(entriesOf(rows, "dental-ready")).toHaveLength(1);
    expect(entriesOf(rows, "dental-awaiting")).toHaveLength(0);
    expect(entriesOf(rows, "dental-mid")).toHaveLength(0);
    expect(rows.reduce((n, r) => n + r.entries.length, 0)).toBe(1);
  });

  test("a debriefed case counts nowhere", () => {
    const rows = buildDentalQueueRows(
      dentalRecord({
        stage: "debrief",
        furthestStage: "debrief",
        completedAt: "2026-11-20T10:00:00.000Z",
        claimSubmitted: true,
        claimNumber: CLAIM,
        claimStatus: "submitted",
      }),
    );

    expect(rows.reduce((n, r) => n + r.entries.length, 0)).toBe(0);
  });
});

describe("medical work queues", () => {
  test("a submitted claim counts once — awaiting, never mid-stage", () => {
    const rows = buildMedicalQueueRows(
      medicalInput([medicalEncounter({ claimNumber: CLAIM, claimStatus: "submitted" })]),
    );

    expect(entriesOf(rows, "medical-awaiting")).toHaveLength(1);
    expect(entriesOf(rows, "medical-mid")).toHaveLength(0);
  });

  test("a scrubbed claim counts in ready only", () => {
    const rows = buildMedicalQueueRows(
      medicalInput([medicalEncounter({ claimNumber: CLAIM, claimStatus: "scrubbed" })]),
    );

    expect(entriesOf(rows, "medical-ready")).toHaveLength(1);
    expect(entriesOf(rows, "medical-mid")).toHaveLength(0);
  });

  test("an encounter with no claim yet stays mid-stage", () => {
    const rows = buildMedicalQueueRows(medicalInput([medicalEncounter({})]));

    expect(entriesOf(rows, "medical-mid")).toHaveLength(1);
  });
});
