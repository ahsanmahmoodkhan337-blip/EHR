/**
 * Adjudication, the 835 and the ledger — money cycle slice 2
 * (`specs/task-5-posting-denials-ar.md` items 1, 3, 5 and 13).
 *
 * The promises tested here:
 *   1. An accepted claim is priced against the plan's own rules, and the numbers
 *      match the graded case keys the student is taught from.
 *   2. Every line balances, by the one function that defines the rule.
 *   3. A CO adjustment never leaves a patient balance; a PR adjustment always is
 *      the patient's. That is the money rule TASK 0 fixed, enforced at posting.
 *   4. Posting the 835 writes ledger entries, and every balance the screen shows
 *      is summed from them: the patient balance equals the 835's patient
 *      responsibility, and the insurance payment equals what the plan paid.
 *   5. Posting twice adds no money, and a record saved before the ledger existed
 *      gains no invented money.
 */
import { describe, expect, test } from "bun:test";
import {
  adjudicateClaim,
  lineBalances,
  planForPayerName,
  remittanceBalances,
  remittanceForClaim,
  type Remittance835,
} from "../src/domain/adjudication";
import {
  appendLedgerEntries,
  ledgerAgreesWithRemittance,
  ledgerBalance,
  postRemittanceToLedger,
} from "../src/domain/ledger";
import { CARC_BY_CODE } from "../src/data/claims/carc";
import { MEDICAL_CASE_SCENARIOS, MEDICAL_PLANS } from "../src/data/medical";
import { normalizeEncounter } from "../src/store/pipelineEncounter";

const AT = "2026-11-20T10:00:00.000Z";

const CASCADIA = planForPayerName("Cascadia Health Plan")!;
const MERIDIAN = planForPayerName("Meridian Health Plan")!;
const ATLAS = planForPayerName("Atlas Select PPO")!;

function adjudicate(overrides: {
  claimNumber?: string;
  payerName?: string;
  plan?: typeof CASCADIA | null;
  lines: { cpt: string; chargeCents: number; modifiers?: string[]; units?: number }[];
  deductibleRemainingCents?: number;
  priorAuthNumber?: string;
}): Remittance835 {
  return adjudicateClaim({
    claimNumber: overrides.claimNumber ?? "CLM-000001",
    payerName: overrides.payerName ?? "Cascadia Health Plan",
    plan: overrides.plan === undefined ? CASCADIA : overrides.plan,
    lines: overrides.lines,
    deductibleRemainingCents: overrides.deductibleRemainingCents ?? 0,
    priorAuthNumber: overrides.priorAuthNumber ?? "",
    at: AT,
  });
}

function post(remittance: Remittance835) {
  const entries = postRemittanceToLedger(remittance, {
    patientId: "MPT-2001",
    userId: "+923000000000",
    at: AT,
  });
  return { entries, balance: ledgerBalance(entries) };
}

describe("the plan's rules, line by line", () => {
  test("MCASE-001: a clean 99213 pays 80% of the allowance and writes off the rest", () => {
    const key = MEDICAL_CASE_SCENARIOS.find((c) => c.id === "MCASE-001")!;
    const expected = key.expectedOutcome[0];
    const r = adjudicate({
      lines: [{ cpt: expected.code, chargeCents: Math.round(expected.chargedUsd * 100) }],
    });
    const line = r.lines[0];

    expect(line.billedCents).toBe(Math.round(expected.chargedUsd * 100));
    expect(line.allowedCents).toBe(Math.round(expected.allowedUsd * 100));
    expect(line.paidCents).toBe(Math.round(expected.planPaysUsd * 100));
    expect(line.patientRespCents).toBe(Math.round(expected.patientOwesUsd * 100));
    expect(line.writeOffCents).toBe(Math.round(expected.writeOffUsd * 100));
    expect(r.outcome).toBe("paid_in_full");
  });

  test("MCASE-005: a required authorisation that box 23 does not carry is CO-197, no patient balance", () => {
    const missing = adjudicate({
      payerName: "Meridian Health Plan",
      plan: MERIDIAN,
      lines: [{ cpt: "72141", chargeCents: 46000 }],
    });
    expect(missing.lines[0].adjustments.map((a) => a.carc)).toEqual(["CO-197"]);
    expect(missing.lines[0].paidCents).toBe(0);
    expect(missing.lines[0].patientRespCents).toBe(0);
    expect(missing.totals.writeOffCents).toBe(46000);
    expect(missing.outcome).toBe("denied");

    const onFile = adjudicate({
      payerName: "Meridian Health Plan",
      plan: MERIDIAN,
      lines: [{ cpt: "72141", chargeCents: 46000 }],
      priorAuthNumber: "AUTH-2027-1234",
    });
    expect(onFile.lines[0].paidCents).toBe(32000);
    expect(onFile.lines[0].patientRespCents).toBe(8000);
  });

  test("MCASE-006: a component billed with its comprehensive code is CO-236, a write-off", () => {
    const r = adjudicate({
      lines: [
        { cpt: "11102", chargeCents: 14500 },
        { cpt: "17000", chargeCents: 14500 },
      ],
    });
    expect(r.lines[0].adjustments.map((a) => a.carc)).toEqual(["CO-236"]);
    expect(r.lines[0].patientRespCents).toBe(0);
    expect(r.lines[1].paidCents).toBeGreaterThan(0);
    expect(r.outcome).toBe("partially_paid");
  });

  test("MCASE-009: an excluded service is PR-96 — the patient owes it, nothing is written off", () => {
    const r = adjudicate({
      payerName: "Atlas Select PPO",
      plan: ATLAS,
      lines: [{ cpt: "17110", chargeCents: 12000 }],
    });
    expect(r.lines[0].adjustments.map((a) => a.carc)).toEqual(["PR-96"]);
    expect(r.lines[0].patientRespCents).toBe(12000);
    expect(r.lines[0].writeOffCents).toBe(0);
    expect(r.outcome).toBe("patient_responsibility");
  });

  test("MCASE-008: a deductible eats the whole allowance before the plan pays anything", () => {
    const r = adjudicate({
      payerName: "Atlas Select PPO",
      plan: ATLAS,
      lines: [{ cpt: "99203", chargeCents: 16800 }],
      deductibleRemainingCents: 150000,
    });
    expect(r.lines[0].allowedCents).toBe(14000);
    expect(r.lines[0].deductibleCents).toBe(14000);
    expect(r.lines[0].paidCents).toBe(0);
    expect(r.outcome).toBe("patient_responsibility");
  });

  test("every line balances, by the one rule", () => {
    const claims: Remittance835[] = [
      adjudicate({ lines: [{ cpt: "99213", chargeCents: 15500 }] }),
      adjudicate({ payerName: "Meridian Health Plan", plan: MERIDIAN, lines: [{ cpt: "72141", chargeCents: 46000 }] }),
      adjudicate({ payerName: "Atlas Select PPO", plan: ATLAS, lines: [{ cpt: "17110", chargeCents: 12000 }] }),
      adjudicate({ payerName: "Atlas Select PPO", plan: ATLAS, lines: [{ cpt: "99203", chargeCents: 16800 }], deductibleRemainingCents: 150000 }),
      adjudicate({ lines: [{ cpt: "11102", chargeCents: 14500 }, { cpt: "17000", chargeCents: 14500 }] }),
    ];
    for (const r of claims) {
      expect(remittanceBalances(r), `${r.claimNumber} does not balance`).toBe(true);
      for (const line of r.lines) {
        const check = lineBalances(line);
        expect(check.differenceCents).toBe(0);
      }
    }
  });

  test("every CARC the 835 carries exists in the single table, with the group it names", () => {
    for (const plan of MEDICAL_PLANS) {
      const r = adjudicateClaim({
        claimNumber: "CLM-000009",
        payerName: plan.name,
        plan,
        lines: plan.priorAuthCptCodes.length
          ? plan.priorAuthCptCodes.map((cpt) => ({ cpt, chargeCents: 20000 }))
          : [{ cpt: "99213", chargeCents: 15500 }],
        deductibleRemainingCents: Math.round(plan.deductibleUsd * 100),
        priorAuthNumber: "",
        at: AT,
      });
      for (const line of r.lines) {
        for (const adj of line.adjustments) {
          const entry = CARC_BY_CODE[adj.carc];
          expect(entry, `${adj.carc} is not in carc.ts`).toBeDefined();
          expect(adj.group).toBe(entry.group);
          expect(adj.carc.startsWith(`${entry.group}-`)).toBe(true);
        }
      }
    }
  });
});

describe("posting the 835 writes the ledger", () => {
  test("the ledger's patient balance is the 835's patient responsibility", () => {
    const r = adjudicate({ lines: [{ cpt: "99213", chargeCents: 15500 }] });
    const { entries, balance } = post(r);

    expect(entries.length).toBeGreaterThan(0);
    expect(balance.chargesCents).toBe(15500);
    expect(balance.insurancePaidCents).toBe(11200);
    expect(balance.adjustmentsCents).toBe(1500);
    expect(balance.patientBalanceCents).toBe(2800);
    expect(balance.patientBalanceCents).toBe(r.totals.patientRespCents);
    expect(ledgerAgreesWithRemittance(entries, r)).toBe(true);
  });

  test("a contractual write-off leaves the patient owing nothing", () => {
    const r = adjudicate({
      payerName: "Meridian Health Plan",
      plan: MERIDIAN,
      lines: [{ cpt: "72141", chargeCents: 46000 }],
    });
    const { entries, balance } = post(r);
    expect(balance.patientBalanceCents).toBe(0);
    expect(balance.adjustmentsCents).toBe(46000);
    expect(entries.some((e) => e.code === "CO-197")).toBe(true);
    expect(ledgerAgreesWithRemittance(entries, r)).toBe(true);
  });

  test("a non-covered line leaves the whole charge as the patient's balance", () => {
    const r = adjudicate({
      payerName: "Atlas Select PPO",
      plan: ATLAS,
      lines: [{ cpt: "17110", chargeCents: 12000 }],
    });
    const { balance } = post(r);
    expect(balance.insurancePaidCents).toBe(0);
    expect(balance.adjustmentsCents).toBe(0);
    expect(balance.patientBalanceCents).toBe(12000);
  });

  test("posting twice adds no money", () => {
    const r = adjudicate({ lines: [{ cpt: "99213", chargeCents: 15500 }] });
    const first = postRemittanceToLedger(r, { patientId: "MPT-2001", userId: "+92300", at: AT });
    const again = postRemittanceToLedger(r, { patientId: "MPT-2001", userId: "+92300", at: AT });
    const merged = appendLedgerEntries(first, again);
    expect(merged).toBe(first);
    expect(merged.length).toBe(first.length);
  });

  test("every entry names its claim, its date and the user who posted it", () => {
    const r = adjudicate({ lines: [{ cpt: "99213", chargeCents: 15500 }] });
    for (const entry of post(r).entries) {
      expect(entry.claimNumber).toBe(r.claimNumber);
      expect(entry.date).toBe(AT.slice(0, 10));
      expect(entry.userId).toBe("+923000000000");
      expect(entry.eraId).toBe(r.id);
    }
  });

  test("the 835 is read back off the encounter, last one wins", () => {
    const first = adjudicate({ claimNumber: "CLM-000042", lines: [{ cpt: "99213", chargeCents: 15500 }] });
    expect(remittanceForClaim([first], "CLM-000042")).toBe(first);
    expect(remittanceForClaim([first], "CLM-000043")).toBeNull();
    expect(remittanceForClaim([], null)).toBeNull();
  });
});

describe("saved progress", () => {
  test("a record saved before the ledger existed gains an empty ledger and no money", () => {
    const v4 = normalizeEncounter(
      {
        patientId: "MPT-2001",
        claimNumber: "CLM-000007",
        claimStatus: "paid",
        claimStatusMigrated: true,
      },
      "MPT-2001",
    );
    expect(v4.claimNumber).toBe("CLM-000007");
    expect(v4.claimStatus).toBe("paid");
    expect(v4.ledger).toEqual([]);
    expect(v4.remittances).toEqual([]);
    expect(ledgerBalance(v4.ledger).patientBalanceCents).toBe(0);
  });

  test("a posted ledger survives normalisation unchanged", () => {
    const r = adjudicate({ lines: [{ cpt: "99213", chargeCents: 15500 }] });
    const entries = postRemittanceToLedger(r, { patientId: "MPT-2001", userId: "+92300", at: AT });
    const restored = normalizeEncounter(
      { patientId: "MPT-2001", claimNumber: r.claimNumber, claimStatus: "paid", ledger: entries, remittances: [r] },
      "MPT-2001",
    );
    expect(restored.ledger.length).toBe(entries.length);
    expect(restored.remittances.length).toBe(1);
    expect(ledgerBalance(restored.ledger).patientBalanceCents).toBe(r.totals.patientRespCents);
  });
});
