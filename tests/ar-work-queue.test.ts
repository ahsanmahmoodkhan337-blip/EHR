/**
 * The AR work queue — money-cycle slice 3
 * (`specs/task-5-posting-denials-ar.md` items 5, 6, 7 and 13).
 *
 * What is checked here is the money, not the label: every queue item comes from
 * a posted 835 or from the ledger, and every action writes ledger entries that
 * move the patient balance by exactly the amount the action says it does.
 */

import { describe, expect, test } from "bun:test";
import {
  adjudicateClaim,
  planForPayerName,
  type Remittance835,
} from "../src/domain/adjudication";
import { appendLedgerEntries, ledgerBalance, postRemittanceToLedger } from "../src/domain/ledger";
import {
  agingBucketFor,
  arQueueTotals,
  arResolutionEntries,
  arResolutionOutcome,
  buildArWorkQueue,
  daysBetween,
  type ArQueueSource,
  type ArWorkItem,
} from "../src/domain/arWorkQueue";
import { normalizeEncounter } from "../src/store/pipelineEncounter";

const AT = "2026-11-20T10:00:00.000Z";
const NOW = "2026-12-05T10:00:00.000Z"; // 15 days after the 835
const PATIENT = "MPT-2001";

const MERIDIAN = planForPayerName("Meridian Health Plan")!;
const ATLAS = planForPayerName("Atlas Select PPO")!;

function adjudicate(input: {
  claimNumber?: string;
  payerName: string;
  plan: typeof MERIDIAN | null;
  lines: { cpt: string; chargeCents: number }[];
  priorAuthNumber?: string;
  at?: string;
}): Remittance835 {
  return adjudicateClaim({
    claimNumber: input.claimNumber ?? "CLM-000001",
    payerName: input.payerName,
    plan: input.plan,
    lines: input.lines,
    deductibleRemainingCents: 0,
    priorAuthNumber: input.priorAuthNumber ?? "",
    at: input.at ?? AT,
  });
}

/** Post the 835 the way the store does, and hand back the queue source. */
function sourceFor(remittance: Remittance835, claimNumber = remittance.claimNumber): ArQueueSource {
  const entries = postRemittanceToLedger(remittance, { patientId: PATIENT, userId: "+923000000000", at: AT });
  return {
    patientId: PATIENT,
    patientName: "Test Patient",
    claimNumber,
    remittances: [{ ...remittance, postedAt: AT }],
    ledger: entries,
    arItems: [],
  };
}

const RESOLVE_CTX = { patientId: PATIENT, userId: "+923000000000", at: NOW };

describe("the queue is built from money that exists", () => {
  test("a CO-197 denied line becomes an item, and an unposted 835 makes none", () => {
    const remittance = adjudicate({
      payerName: "Meridian Health Plan",
      plan: MERIDIAN,
      lines: [{ cpt: "72141", chargeCents: 46000 }],
    });
    // Not posted: nothing reached the ledger, so there is nothing to work.
    const unposted = buildArWorkQueue(
      [{ ...sourceFor(remittance), remittances: [remittance] }],
      NOW,
    );
    expect(unposted).toHaveLength(0);

    const queue = buildArWorkQueue([sourceFor(remittance)], NOW);
    expect(queue).toHaveLength(1);
    const item = queue[0];
    expect(item.kind).toBe("denial");
    expect(item.carc).toBe("CO-197");
    expect(item.amountCents).toBe(46000);
    expect(item.ageDays).toBe(15);
    expect(item.bucket).toBe("0-30");
    expect(item.appealDeadline).toBe("2027-03-20");
    expect(item.actions).toEqual(["rebill", "appeal", "transfer_to_patient", "write_off"]);
  });

  test("an ordinary contractual CO-45 is not a denial", () => {
    const remittance = adjudicate({
      payerName: "Cascadia Health Plan",
      plan: planForPayerName("Cascadia Health Plan"),
      lines: [{ cpt: "99213", chargeCents: 15000 }],
    });
    const queue = buildArWorkQueue([sourceFor(remittance)], NOW);
    // The patient owes their coinsurance, so a balance item exists — but the
    // contracted discount never becomes a denial item.
    expect(queue.every((i) => i.kind === "balance")).toBe(true);
  });

  test("a non-covered PR-96 line makes both a denied line and a patient balance", () => {
    const remittance = adjudicate({
      payerName: "Atlas Select PPO",
      plan: ATLAS,
      lines: [{ cpt: "17110", chargeCents: 12000 }],
    });
    const queue = buildArWorkQueue([sourceFor(remittance)], NOW);
    const denial = queue.find((i) => i.kind === "denial")!;
    const balance = queue.find((i) => i.kind === "balance")!;
    expect(denial.carc).toBe("PR-96");
    expect(denial.amountCents).toBe(12000);
    expect(balance.amountCents).toBe(12000);
    // A patient balance is not the payer's to appeal or rebill.
    expect(balance.actions).toEqual(["patient_statement", "patient_payment"]);
  });

  test("the two totals are kept apart and never added together", () => {
    const remittance = adjudicate({
      payerName: "Atlas Select PPO",
      plan: ATLAS,
      lines: [{ cpt: "17110", chargeCents: 12000 }],
    });
    const totals = arQueueTotals(buildArWorkQueue([sourceFor(remittance)], NOW));
    expect(totals.denialCount).toBe(1);
    expect(totals.denialCents).toBe(12000);
    expect(totals.balanceCount).toBe(1);
    expect(totals.balanceCents).toBe(12000);
  });

  test("aging buckets and the day count", () => {
    expect(daysBetween(AT, NOW)).toBe(15);
    expect(agingBucketFor(0)).toBe("0-30");
    expect(agingBucketFor(31)).toBe("31-60");
    expect(agingBucketFor(90)).toBe("61-90");
    expect(agingBucketFor(120)).toBe("91-120");
    expect(agingBucketFor(121)).toBe("120+");
  });
});

describe("clearing an item moves money in the ledger", () => {
  function denialItem(): { item: ArWorkItem; source: ArQueueSource } {
    const remittance = adjudicate({
      payerName: "Meridian Health Plan",
      plan: MERIDIAN,
      lines: [{ cpt: "72141", chargeCents: 46000 }],
    });
    const source = sourceFor(remittance);
    const item = buildArWorkQueue([source], NOW).find((i) => i.kind === "denial")!;
    return { item, source };
  }

  test("rebill moves the refused money onto a corrected claim and leaves the patient balance alone", () => {
    const { item, source } = denialItem();
    const before = ledgerBalance(source.ledger).patientBalanceCents;
    const entries = arResolutionEntries(item, "rebill", RESOLVE_CTX);

    // The refusal is reversed on the denied claim, then the money moves.
    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({ type: "adjustment", code: item.carc, amountCents: 46000, claimNumber: "CLM-000001" });
    expect(entries[1]).toMatchObject({ type: "transfer", amountCents: -46000, claimNumber: "CLM-000001" });
    expect(entries[2]).toMatchObject({ type: "transfer", amountCents: 46000, claimNumber: "CLM-000001-R1" });

    const ledger = appendLedgerEntries(source.ledger, entries);
    const after = ledgerBalance(ledger);
    expect(after.patientBalanceCents).toBe(before);
    // The payer has been asked again: it owes the money now, not the patient.
    expect(after.insuranceBalanceCents).toBe(46000);
    // The denied claim is settled at zero, never in credit.
    expect(ledgerBalance(ledger.filter((e) => e.claimNumber === "CLM-000001")).patientBalanceCents).toBe(0);
    expect(arResolutionOutcome("rebill")).toEqual({ to: "replaced", reasonCode: "CORRECTED_CLAIM_FILED" });
  });

  test("an appeal moves it onto an appeal record, not the patient", () => {
    const { item, source } = denialItem();
    const before = ledgerBalance(source.ledger).patientBalanceCents;
    const entries = arResolutionEntries(item, "appeal", RESOLVE_CTX);
    expect(entries[2].claimNumber).toBe("CLM-000001-A1");
    const after = ledgerBalance(appendLedgerEntries(source.ledger, entries));
    expect(after.patientBalanceCents).toBe(before);
    expect(after.insuranceBalanceCents).toBe(46000);
    expect(arResolutionOutcome("appeal").to).toBe("appeal_pending");
  });

  test("transfer to patient puts the refused money on the patient's balance", () => {
    const { item, source } = denialItem();
    const before = ledgerBalance(source.ledger).patientBalanceCents;
    const entries = arResolutionEntries(item, "transfer_to_patient", RESOLVE_CTX);
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe("transfer");
    const after = ledgerBalance(appendLedgerEntries(source.ledger, entries)).patientBalanceCents;
    expect(after - before).toBe(46000);
  });

  test("a write-off reduces the patient balance and never goes below zero", () => {
    // A PR-96 balance: the patient owes the money, so writing it off is real.
    const remittance = adjudicate({
      payerName: "Atlas Select PPO",
      plan: ATLAS,
      lines: [{ cpt: "17110", chargeCents: 12000 }],
    });
    const source = sourceFor(remittance);
    const balanceItem = buildArWorkQueue([source], NOW).find((i) => i.kind === "balance")!;
    const before = ledgerBalance(source.ledger).patientBalanceCents;
    const entries = arResolutionEntries(balanceItem, "write_off", { ...RESOLVE_CTX, reasonCode: "CO-45" });
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe("adjustment");
    expect(entries[0].code).toBe("CO-45");
    const after = ledgerBalance(appendLedgerEntries(source.ledger, entries)).patientBalanceCents;
    expect(after).toBe(before - 12000);
    expect(after).toBe(0);

    // A CO denial leaves the patient owing nothing, so writing it off writes
    // nothing rather than inventing a credit on the patient's account.
    const coClaim = adjudicate({
      claimNumber: "CLM-000002",
      payerName: "Meridian Health Plan",
      plan: MERIDIAN,
      lines: [{ cpt: "72141", chargeCents: 46000 }],
    });
    const coDenial = buildArWorkQueue([sourceFor(coClaim)], NOW).find((i) => i.kind === "denial")!;
    expect(coDenial.patientPortionCents).toBe(0);
    expect(arResolutionEntries(coDenial, "write_off", { ...RESOLVE_CTX, reasonCode: "CO-45" })).toHaveLength(0);
  });

  test("clearing the same item twice cannot double the money", () => {
    const { item, source } = denialItem();
    const entries = arResolutionEntries(item, "transfer_to_patient", RESOLVE_CTX);
    const once = appendLedgerEntries(source.ledger, entries);
    const twice = appendLedgerEntries(once, entries);
    expect(twice).toHaveLength(once.length);
    expect(ledgerBalance(twice).patientBalanceCents).toBe(ledgerBalance(once).patientBalanceCents);

    // An already-resolved item writes nothing at all.
    const resolved: ArWorkItem = { ...item, status: "resolved" };
    expect(arResolutionEntries(resolved, "transfer_to_patient", RESOLVE_CTX)).toHaveLength(0);
  });

  test("a stored resolution shows on the item and drops it from the open totals", () => {
    const { item, source } = denialItem();
    const withState: ArQueueSource = {
      ...source,
      arItems: [
        { id: item.id, claimNumber: item.claimNumber, status: "resolved", action: "rebill", at: NOW, by: "+923000000000" },
      ],
    };
    const queue = buildArWorkQueue([withState], NOW);
    const resolved = queue.find((i) => i.id === item.id)!;
    expect(resolved.status).toBe("resolved");
    expect(resolved.action).toBe("rebill");
    expect(arQueueTotals(queue).denialCount).toBe(0);
  });
});

describe("a record saved before the work queue existed", () => {
  test("gains an empty arItems list and no money", () => {
    const encounter = normalizeEncounter(
      { patientId: PATIENT, ledger: [], remittances: [] } as never,
      PATIENT,
    );
    expect(encounter.arItems).toEqual([]);
  });
});

describe("a patient balance is billed to the patient, not written off", () => {
  test("posting the patient's payment writes a patient payment that clears their share", async () => {
    const { arResolutionEntries, arResolutionOutcome } = await import("../src/domain/arWorkQueue");
    const item = {
      id: "bal-1", kind: "balance", patientId: "P1", claimNumber: "CLM-9", status: "open",
      amountCents: 3500, patientPortionCents: 3500, patientBalanceCents: 3500,
      actions: ["patient_statement", "patient_payment"],
    } as never;
    const ctx = { userId: "u", at: "2026-11-26T10:00:00.000Z" };
    const paid = arResolutionEntries(item, "patient_payment", ctx);
    expect(paid).toHaveLength(1);
    expect(paid[0].type).toBe("patient_payment");
    expect(paid[0].amountCents).toBe(-3500);
    expect(arResolutionOutcome("patient_payment")).toEqual({ to: "closed", reasonCode: "PATIENT_PAID" });
    expect(arResolutionEntries(item, "patient_statement", ctx)).toEqual([]);
  });
});
