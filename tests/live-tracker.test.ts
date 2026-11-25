import { describe, expect, test } from "bun:test";
import { liveMilestones, liveMoney } from "../src/domain/liveTracker";
import type { StatusEvent } from "../src/domain/statusEvent";

const ev = (reasonCode: string, seq: number, at = `2026-11-26T10:0${seq}:00.000Z`) =>
  ({ id: `e${seq}`, entityType: "claim", entityId: "CLM-1", patientId: "P1", seq, at, from: null, to: "submitted", by: "s", jobRole: "biller", reasonCode, reason: "r" }) as unknown as StatusEvent;

describe("the live tracker reads what the student has done", () => {
  test("a fresh visit has nothing reached and points at check-in", () => {
    const m = liveMilestones({ cptCodes: [], events: [], ledger: [], openArItems: 0 });
    expect(m.every((x) => x.state !== "done")).toBe(true);
    expect(m[0]).toMatchObject({ id: "checked-in", state: "current" });
  });

  test("each step lights up from its own record, in order", () => {
    const m = liveMilestones({
      appointmentStatus: "arrived",
      eligibility: { status: "active", checkedAt: "2026-11-26T09:00:00.000Z" },
      signedAt: "2026-11-26T09:30:00.000Z",
      cptCodes: ["99203"],
      events: [ev("SUBMITTED_837P", 1), ev("277CA_ACCEPTED", 2)],
      ledger: [],
      openArItems: 0,
    });
    const state = Object.fromEntries(m.map((x) => [x.id, x.state]));
    expect(state).toMatchObject({ "checked-in": "done", eligibility: "done", signed: "done", coded: "done", sent: "done", accepted: "done", remit: "current", posted: "todo" });
  });

  test("a rejected 277CA and an inactive 271 are shown as problems with the reason", () => {
    const m = liveMilestones({
      eligibility: { status: "inactive" },
      cptCodes: [],
      events: [ev("SUBMITTED_837P", 1), ev("277CA_REJECTED", 2)],
      ledger: [],
      openArItems: 0,
    });
    expect(m.find((x) => x.id === "eligibility")?.state).toBe("problem");
    expect(m.find((x) => x.id === "accepted")?.note).toContain("rejected");
  });

  test("the claim closes only when the patient owes nothing and no AR work is open", () => {
    const ledger = [
      { id: "c", type: "charge", amountCents: 17500 },
      { id: "p", type: "insurance_payment", amountCents: -14000 },
      { id: "a", type: "adjustment", amountCents: -3500 },
    ] as never;
    const base = { cptCodes: ["99203"], events: [ev("ERA_POSTED", 3)], ledger };
    expect(liveMilestones({ ...base, openArItems: 1 }).find((x) => x.id === "closed")?.state).not.toBe("done");
    expect(liveMilestones({ ...base, openArItems: 0 }).find((x) => x.id === "closed")?.state).toBe("done");
  });

  test("money comes from the ledger, billed from the claim until a charge is posted", () => {
    expect(liveMoney({ ledger: [], claimChargeCents: 17500 })).toMatchObject({ billedCents: 17500, paidCents: null, patientOwesCents: null });
    const ledger = [
      { id: "c", type: "charge", amountCents: 17500 },
      { id: "p", type: "insurance_payment", amountCents: -11200 },
      { id: "a", type: "adjustment", amountCents: -3500 },
    ] as never;
    expect(liveMoney({ ledger, claimChargeCents: 17500, remitAllowedCents: 14000 })).toEqual({
      billedCents: 17500, allowedCents: 14000, paidCents: 11200, adjustedCents: 3500, patientOwesCents: 2800,
    });
  });
});
