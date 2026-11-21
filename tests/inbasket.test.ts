/**
 * The InBasket's rows come from the app's own records.
 *
 * The 19 November panel showed six invented alerts and a count derived from
 * them, so an empty practice read "3 items requiring attention" while the same
 * page's Work Queues said nothing was waiting. These tests hold the one pure
 * builder (`src/domain/inbasket.ts`) to the rules the panel and the tab badge
 * both depend on:
 *
 *   - an empty store gives zero items, and the count is the list length;
 *   - every source produces its own row, with the priority its source implies;
 *   - a demo chart's work never appears in the student's inbox;
 *   - a row's time is the record's own timestamp, never a relative string.
 */

import { describe, expect, test } from "bun:test";
import {
  buildInboxItems,
  inboxCount,
  inboxWhen,
  type InboxInput,
  type InboxPatient,
} from "../src/domain/inbasket";
import { createEncounter, type PipelineEncounter } from "../src/store/pipelineEncounter";
import type { PARecordStore } from "../src/store/pipelineStore";
import type { ArWorkItem } from "../src/domain/arWorkQueue";

const PATIENT: InboxPatient = {
  id: "MPT-2001",
  firstName: "Nadia",
  lastName: "Rahman",
  isSeed: false,
  insuranceRecord: {
    primary: { payerName: "Northwind Health Plan", subscriberId: "NW-99120", planName: "PPO 2000" },
  },
};

const DEMO_PATIENT: InboxPatient = {
  id: "DEMO-07",
  firstName: "Robert",
  lastName: "Johnson",
  isSeed: true,
  insuranceRecord: { primary: { payerName: "Northwind Health Plan", subscriberId: "NW-1" } },
};

function encounter(overrides: Partial<PipelineEncounter>): PipelineEncounter {
  return { ...createEncounter(PATIENT.id), ...overrides };
}

function paRecord(overrides: Partial<PARecordStore>): PARecordStore {
  return {
    id: "PA-9001",
    patientId: PATIENT.id,
    procedure: "MRI lumbar spine",
    insuranceName: "Northwind Health Plan",
    paProcessor: "K. Miller",
    authStartDate: "2026-07-01",
    authEndDate: "2026-10-01",
    nextRefillDate: "2026-09-01",
    submissionMethod: "Portal",
    submittedBy: "student",
    submittedAt: "2026-11-20T09:15:00.000Z",
    status: "pending",
    verificationStatus: "verified",
    verificationResult: "Verified",
    ...overrides,
  };
}

function arItem(overrides: Partial<ArWorkItem>): ArWorkItem {
  return {
    id: "AR-CLM-1-L1-CO-97",
    kind: "denial",
    patientId: PATIENT.id,
    patientName: "Nadia Rahman",
    claimNumber: "CLM-0007",
    payerName: "Northwind Health Plan",
    lineNumber: 1,
    cpt: "72148",
    group: "CO",
    carc: "97",
    amountCents: 45000,
    patientBalanceCents: 0,
    alreadyWrittenOffCents: 0,
    patientPortionCents: 0,
    datedAt: "2026-11-18T12:00:00.000Z",
    ageDays: 3,
    bucket: "0-30",
    status: "open",
    ...overrides,
  } as ArWorkItem;
}

const base = (overrides: Partial<InboxInput> = {}): InboxInput => ({
  encounters: [],
  arWorkItems: [],
  paRecords: [],
  appointments: [],
  patients: [PATIENT],
  ...overrides,
});

describe("the InBasket's rows", () => {
  test("an empty store gives no items and a zero count", () => {
    const items = buildInboxItems(base());
    expect(items).toHaveLength(0);
    expect(inboxCount(items)).toBe(0);
  });

  test("the count is the rendered list length, never a separate number", () => {
    const items = buildInboxItems(
      base({
        arWorkItems: [arItem({}), arItem({ id: "AR-CLM-1-BAL", kind: "balance" })],
        paRecords: [paRecord({})],
      }),
    );
    expect(items.length).toBe(3);
    expect(inboxCount(items)).toBe(items.length);
  });

  test("a denial from a posted 835 is high priority and carries the 835's date", () => {
    const [item] = buildInboxItems(base({ arWorkItems: [arItem({})] }));
    expect(item.kind).toBe("denial");
    expect(item.priority).toBe("high");
    expect(item.patient).toBe("Nadia Rahman");
    expect(item.detail).toContain("CO-97");
    expect(item.at).toBe("2026-11-18T12:00:00.000Z");
    expect(inboxWhen(item)).toContain("Nov");
    expect(inboxWhen(item)).not.toContain("ago");
    expect(item.target).toEqual({ kind: "medical", patientId: PATIENT.id, role: "ar-voice" });
  });

  test("a resolved AR item is not waiting", () => {
    const items = buildInboxItems(base({ arWorkItems: [arItem({ status: "resolved" })] }));
    expect(items).toHaveLength(0);
  });

  test("a claim ready to submit is medium; one awaiting the payer is low", () => {
    const ready = buildInboxItems(
      base({
        encounters: [encounter({ claimNumber: "CLM-0011", claimStatus: "draft", noteFields: { subjective: "s", objective: "o", assessment: "a", plan: "p" } })],
      }),
    );
    expect(ready.find((i) => i.kind === "claim-ready")?.priority).toBe("medium");

    const awaiting = buildInboxItems(
      base({
        encounters: [encounter({ claimNumber: "CLM-0012", claimStatus: "submitted" })],
      }),
    );
    const awaitingRow = awaiting.find((i) => i.kind === "claim-awaiting");
    expect(awaitingRow?.priority).toBe("low");
  });

  test("a draft note with no NOTE_SIGNED event is its own row", () => {
    const items = buildInboxItems(
      base({
        encounters: [
          encounter({
            stage: "scribe",
            noteFields: { subjective: "cough", objective: "", assessment: "", plan: "" },
            noteUpdatedAt: "2026-11-19T08:30:00.000Z",
          }),
        ],
      }),
    );
    const row = items.find((i) => i.kind === "note-draft");
    expect(row).toBeDefined();
    expect(row?.priority).toBe("low");
    expect(row?.at).toBe("2026-11-19T08:30:00.000Z");
    expect(row?.detail).toContain("1 of 4");
  });

  test("eligibility never checked on a patient with a payer is medium", () => {
    const items = buildInboxItems(
      base({ encounters: [encounter({ stage: "scribe" })] }),
    );
    const row = items.find((i) => i.kind === "eligibility");
    expect(row).toBeDefined();
    expect(row?.priority).toBe("medium");
    expect(row?.detail).toContain("Northwind Health Plan");
    expect(row?.at).toBe("");
  });

  test("a self-pay patient is not an unchecked coverage", () => {
    const items = buildInboxItems(
      base({
        encounters: [encounter({ stage: "scribe" })],
        patients: [{ ...PATIENT, insuranceRecord: { primary: { payerName: "" } } }],
      }),
    );
    expect(items.some((i) => i.kind === "eligibility")).toBe(false);
  });

  test("a copay taken at check-in and never posted is high", () => {
    const items = buildInboxItems(
      base({
        appointments: [
          { id: "APT-1", patientId: PATIENT.id, checkedInAt: "2026-11-20T09:00:00.000Z", copayUsd: 25 },
        ],
      }),
    );
    const row = items.find((i) => i.kind === "copay");
    expect(row).toBeDefined();
    expect(row?.priority).toBe("high");
    expect(row?.at).toBe("2026-11-20T09:00:00.000Z");
    expect(row?.detail).toContain("$25.00");
  });

  test("a posted copay is not waiting", () => {
    const items = buildInboxItems(
      base({
        appointments: [
          {
            id: "APT-1",
            patientId: PATIENT.id,
            checkedInAt: "2026-11-20T09:00:00.000Z",
            copayUsd: 25,
            copayPostedLedgerEntryId: "LED-1",
          },
        ],
      }),
    );
    expect(items.some((i) => i.kind === "copay")).toBe(false);
  });

  test("an open prior auth is a row, and its priority follows its status", () => {
    const items = buildInboxItems(
      base({ paRecords: [paRecord({ id: "PA-1", status: "info-required" }), paRecord({ id: "PA-2", status: "approved" })] }),
    );
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("prior-auth");
    expect(items[0].priority).toBe("high");
    expect(items[0].at).toBe("2026-11-20T09:15:00.000Z");
  });

  test("a claim hold is high priority and names the role that clears it", () => {
    const items = buildInboxItems(
      base({
        encounters: [
          encounter({
            claimNumber: "CLM-0031",
            claimStatus: "scrubbed",
            holds: [
              {
                kind: "auth",
                key: "72148",
                reason: "Prior auth required for 72148",
                raisedAt: "2026-11-21T10:00:00.000Z",
                raisedBy: "coder",
                clearedBy: "biller",
                blocking: true,
              },
            ],
          }),
        ],
      }),
    );
    const row = items.find((i) => i.kind === "claim-hold");
    expect(row).toBeDefined();
    expect(row?.priority).toBe("high");
    expect(row?.detail).toContain("biller");
    expect(row?.at).toBe("2026-11-21T10:00:00.000Z");
  });

  test("a demo chart's record never appears", () => {
    const items = buildInboxItems({
      ...base(),
      patients: [DEMO_PATIENT],
      encounters: [
        {
          ...createEncounter(DEMO_PATIENT.id),
          claimNumber: "CLM-0099",
          claimStatus: "submitted",
          stage: "scribe",
          noteFields: { subjective: "s", objective: "", assessment: "", plan: "" },
        },
      ],
      arWorkItems: [arItem({ patientId: DEMO_PATIENT.id })],
      paRecords: [paRecord({ patientId: DEMO_PATIENT.id })],
      appointments: [
        { id: "APT-9", patientId: DEMO_PATIENT.id, checkedInAt: "2026-11-20T09:00:00.000Z", copayUsd: 20 },
      ],
    });
    expect(items).toHaveLength(0);
  });

  test("the highest priority sorts first", () => {
    const items = buildInboxItems(
      base({
        encounters: [encounter({ claimNumber: "CLM-0012", claimStatus: "submitted" })],
        arWorkItems: [arItem({})],
      }),
    );
    expect(items[0].priority).toBe("high");
    expect(items[items.length - 1].priority).toBe("low");
  });
});
