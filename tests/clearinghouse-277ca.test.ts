/**
 * Clearinghouse submission and the 277CA — money-cycle items 8 and 9.
 *
 * The promises tested here (spec `task-4-claims-clearinghouse.md`):
 *   1. A submission records Ready → Submitted → Accepted or Rejected on the
 *      claim's own append-only timeline, with a claim number and control numbers.
 *   2. A rejection carries a 277CA category (A3), an entity and a plain reason —
 *      never a CARC, never money — and the claim comes back for correction.
 *   3. A double-click records one transmission, and a corrected claim transmitted
 *      again is a new one.
 *   4. At least two rejection cases exist per track, and the panel is a
 *      projection of the timeline (a reload shows the same answer).
 */
import { describe, expect, test } from "bun:test";
import {
  DENTAL_REJECTION_CASES,
  MEDICAL_REJECTION_CASES,
  REJECTION_IS_NOT_A_DENIAL,
  ackForClaim,
  buildSubmissionEvents,
  controlNumber,
  evaluateSubmission,
  submissionAttempt,
  type SubmissionFacts,
} from "../src/domain/clearinghouse";
import { statusEventsFor, appendStatusEvent, type StatusEvent } from "../src/domain/statusEvent";

const CLEAN: SubmissionFacts = {
  track: "medical",
  claimNumber: "CLM-000001",
  subscriberId: "MED77120",
  subscriberIdOnFile: "MED77120",
  patientDob: "1971-06-20",
  patientDobOnFile: "1971-06-20",
  alreadyAccepted: false,
};

const CLEAN_DENTAL: SubmissionFacts = {
  ...CLEAN,
  track: "dental",
  subscriberId: "CDG884120901",
  subscriberIdOnFile: "CDG884120901",
};

function transmit(
  facts: Partial<SubmissionFacts> = {},
  existing: StatusEvent[] = [],
  from: "draft" | "rejected" | "accepted" | null = "draft",
) {
  return buildSubmissionEvents({
    facts: { ...CLEAN, ...facts } as Omit<SubmissionFacts, "alreadyAccepted">,
    from,
    patientId: "PAT-1",
    by: "+923000000000",
    jobRole: "biller",
    lineCount: 2,
    payerName: "Northwind Health Plan",
    existing,
    at: "2026-11-20T10:00:00.000Z",
  });
}

describe("a clean claim is accepted, not paid", () => {
  test("Ready → Submitted → Accepted, in one write, on the claim's timeline", () => {
    const { events, ack } = transmit();
    const rows = statusEventsFor(events, "claim", "CLM-000001");

    expect(rows.map((e) => e.to)).toEqual(["scrubbed", "submitted", "accepted"]);
    expect(rows.map((e) => e.reasonCode)).toEqual(["SCRUB_PASS", "SUBMITTED_837P", "277CA_ACCEPTED"]);
    expect(ack.category).toBe("A1");
    expect(ack.entity).toBeNull();
  });

  test("acceptance says adjudication is still to come, and carries no money", () => {
    const { ack, events } = transmit();
    expect(ack.reason.toLowerCase()).toContain("awaits adjudication");
    expect(ack.reason.toLowerCase()).not.toContain("paid in full");
    for (const event of events) expect(event.amountCents).toBeUndefined();
  });

  test("every row names the patient and the claim", () => {
    const { events } = transmit();
    for (const event of events) {
      expect(event.patientId).toBe("PAT-1");
      expect(event.claimNumber).toBe("CLM-000001");
      expect(event.by).toBe("+923000000000");
      expect(event.jobRole).toBe("biller");
    }
  });

  test("the timeline is ordered by seq, and the 277CA is last", () => {
    const { events } = transmit();
    const rows = statusEventsFor(events, "claim", "CLM-000001");
    expect(rows.map((e) => e.seq)).toEqual([1, 2, 3]);
  });
});

describe("a rejection is not a denial", () => {
  test("a wrong subscriber ID comes back A3 with an entity and no CARC", () => {
    const { ack } = transmit({ subscriberId: "MED99999" });
    expect(ack.category).toBe("A3");
    expect(ack.entity).toBe("IL");
    expect(ack.rejection?.box).toBe("1a");
    // No CARC, no RARC, no money anywhere on a rejection.
    expect(ack.rejection?.id).toBe("MED-IL-SUBSCRIBER-NOT-ON-FILE");
    expect(ack.reason).not.toMatch(/\bCO-\d/);
    expect(ack.reason).toContain(REJECTION_IS_NOT_A_DENIAL);
  });

  test("a rejected claim's status is rejected, never denied", () => {
    const { events } = transmit({ patientDob: "1971-06-21" });
    const last = statusEventsFor(events, "claim", "CLM-000001").at(-1);
    expect(last?.to).toBe("rejected");
    expect(last?.reasonCode).toBe("277CA_REJECTED");
  });

  test("a mismatch is carried on the 277CA event so the panel can read it back", () => {
    const { events } = transmit({ patientDob: "1971-06-21" });
    const ack = ackForClaim(events, "CLM-000001");
    expect(ack?.category).toBe("A3");
    expect(ack?.entity).toBe("QC");
    expect(ack?.rejection?.box).toBe("3");
  });

  test("a date written in a different format is not a rejection", () => {
    expect(evaluateSubmission({ ...CLEAN, patientDob: "06/20/1971" }).category).toBe("A1");
  });

  test("at least two rejection cases exist per track, on the right paper boxes", () => {
    expect(MEDICAL_REJECTION_CASES.length).toBeGreaterThanOrEqual(2);
    expect(DENTAL_REJECTION_CASES.length).toBeGreaterThanOrEqual(2);
    expect(DENTAL_REJECTION_CASES.map((c) => c.box)).toContain("9");
    expect(DENTAL_REJECTION_CASES.every((c) => c.id.startsWith("DEN-"))).toBe(true);
    expect(MEDICAL_REJECTION_CASES.every((c) => c.id.startsWith("MED-"))).toBe(true);
  });

  test("the dental paper rejects on its own box numbers", () => {
    const wrongId = evaluateSubmission({ ...CLEAN_DENTAL, subscriberId: "CDG000000000" });
    expect(wrongId.entity).toBe("IL");
    expect(wrongId.rejection?.box).toBe("9");
    const wrongDob = evaluateSubmission({ ...CLEAN_DENTAL, patientDob: "1980-01-01" });
    expect(wrongDob.rejection?.box).toBe("15");
  });
});

describe("idempotency and resubmission", () => {
  test("a double-click records one transmission, not two", () => {
    // Two clicks in the same tick both see the same record and the same clock,
    // so they produce the same idempotency keys — and merging them adds nothing.
    const first = transmit();
    const second = transmit();
    expect(second.events.map((e) => e.id)).toEqual(first.events.map((e) => e.id));

    const merged = first.events.reduce((acc, e) => appendStatusEvent(acc, e), second.events);
    expect(merged.length).toBe(first.events.length);
    expect(statusEventsFor(merged, "claim", "CLM-000001").filter((e) => e.reasonCode === "SUBMITTED_837P")).toHaveLength(1);
  });

  test("a corrected claim transmitted again is a new, separate transmission", () => {
    const rejected = transmit({ subscriberId: "MED99999" });
    const corrected = buildSubmissionEvents({
      facts: { ...CLEAN },
      from: "rejected",
      patientId: "PAT-1",
      by: "+923000000000",
      jobRole: "biller",
      lineCount: 2,
      payerName: "Northwind Health Plan",
      existing: rejected.events,
      at: "2026-11-20T10:05:00.000Z",
    });

    const rows = statusEventsFor(corrected.events, "claim", "CLM-000001");
    expect(rows.map((e) => e.to)).toEqual([
      "scrubbed",
      "submitted",
      "rejected",
      "submitted",
      "accepted",
    ]);
    expect(corrected.ack.category).toBe("A1");
    expect(submissionAttempt(corrected.events, "CLM-000001")).toBe(3);
  });

  test("transmitting an accepted claim again is a duplicate rejection", () => {
    const accepted = transmit();
    const duplicate = buildSubmissionEvents({
      facts: { ...CLEAN },
      from: "accepted",
      patientId: "PAT-1",
      by: "+923000000000",
      jobRole: "biller",
      lineCount: 2,
      payerName: "Northwind Health Plan",
      existing: accepted.events,
      at: "2026-11-20T10:09:00.000Z",
    });
    expect(duplicate.ack.category).toBe("A3");
    expect(duplicate.ack.entity).toBe("85");
    expect(duplicate.ack.rejection?.id).toBe("MED-85-DUPLICATE");
  });

  test("control numbers are deterministic per claim and attempt", () => {
    expect(controlNumber("CLM-000007", "837P", 2)).toBe("CLM-000007-837P-02");
    const a = transmit({ claimNumber: "CLM-000007" });
    const b = transmit({ claimNumber: "CLM-000007" });
    expect(a.ack.responseControlNumber).toBe(b.ack.responseControlNumber);
    expect(a.ack.batchControlNumber).not.toBe(a.ack.responseControlNumber);
  });
});

describe("the panel is a projection of the timeline", () => {
  test("no 277CA yet means no acknowledgement", () => {
    expect(ackForClaim([], "CLM-000001")).toBeNull();
    expect(ackForClaim(transmit().events, null)).toBeNull();
  });

  test("reading the timeline back gives the same outcome as the transmission", () => {
    const { events, ack } = transmit({ subscriberId: "MED99999" });
    const read = ackForClaim(events, "CLM-000001");
    expect(read).toEqual(ack);
  });
});
