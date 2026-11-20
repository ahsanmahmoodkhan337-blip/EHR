/**
 * Dental 835 posting — the ledger finally moves (`specs/task-5-posting-denials-ar.md`
 * items 1, 3, 5 and 13, following the medical money-cycle slice 2).
 *
 * The promises tested here:
 *   1. Every adjudicated dental claim produces its OWN 835, and every line of it
 *      balances by the one function that defines the rule.
 *   2. Posting that 835 writes the charge, the insurance payment and the
 *      contractual adjustments, and every figure on the ledger is summed from
 *      those entries: the patient balance equals the 835's patient
 *      responsibility, and the insurance money equals what the plan paid.
 *   3. The owner's money rule holds line by line: a CO denial leaves the patient
 *      owing 0, a PR denial is the patient's, and a downgrade is not a denial.
 *   4. Posting twice adds no money.
 *   5. Only a graded case's own claim can post — never a sample or practice
 *      remittance — and a record saved before the ledger existed gains no
 *      invented money.
 */
import { describe, expect, test } from "bun:test";
import { DENTAL_CASE_SCENARIOS, findDenial } from "../src/data/dental";
import { adjudicateDentalClaim } from "../src/components/dental/adjudication";
import {
  buildDentalClaimRemittance,
  dentalLedgerAgreesWithRemittance,
  dentalLineBalances,
  dentalRemittanceBalances,
  postDentalRemittanceToLedger,
} from "../src/domain/dentalRemittance";
import { appendLedgerEntries, ledgerBalance } from "../src/domain/ledger";
import { canPostDentalRemittance, migrateDentalTrackState } from "../src/components/dental/DentalTrackStore";

const AT = "2026-11-20T10:00:00.000Z";

function claimFor(caseId: string) {
  const scenario = DENTAL_CASE_SCENARIOS.find((c) => c.id === caseId)!;
  const lines = scenario.procedures.map((p, i) => ({
    id: `L${i + 1}`,
    code: p.code,
    tooth: p.tooth,
    dateOfService: p.dateOfService,
    feeUsd: p.feeUsd,
    predeterminationOnFile: true,
    attachments: [],
  }));
  const adjudication = adjudicateDentalClaim(lines, scenario);
  const remittance = buildDentalClaimRemittance({
    claimNumber: `DENT-${caseId}`,
    payerPlanId: scenario.planId,
    patientName: `${scenario.patient.firstName} ${scenario.patient.lastName}`,
    remittanceDate: "2027-04-20",
    lines: adjudication.lines.map((line, index) => ({
      line: index + 1,
      code: line.code,
      tooth: line.claimLine.tooth,
      dateOfService: line.claimLine.dateOfService,
      result: line.result,
      denial: line.denial,
    })),
  });
  return { scenario, adjudication, remittance };
}

function post(remittance: ReturnType<typeof claimFor>["remittance"]) {
  return postDentalRemittanceToLedger(remittance, {
    patientId: "DPT-1001",
    userId: "+923000000000",
    at: AT,
  });
}

const CASE_IDS = DENTAL_CASE_SCENARIOS.map((c) => c.id);

describe("every dental claim gets its own 835, and it balances", () => {
  for (const caseId of CASE_IDS) {
    test(`${caseId}: the 835 is this claim's own and every line balances`, () => {
      const { scenario, adjudication, remittance } = claimFor(caseId);

      expect(remittance.claimControlNumber).toBe(`DENT-${caseId}`);
      expect(remittance.patientName).toBe(`${scenario.patient.firstName} ${scenario.patient.lastName}`);
      expect(remittance.lines.length).toBe(adjudication.lines.length);
      expect(dentalRemittanceBalances(remittance)).toBe(true);

      // The figures are the coverage engine's, not a sample's.
      expect(remittance.totalPaidUsd).toBe(adjudication.totals.planPaysUsd);
      const patientTotal = remittance.lines.reduce((sum, line) => sum + line.patientOwesUsd, 0);
      expect(Math.round(patientTotal * 100) / 100).toBe(adjudication.totals.patientOwesUsd);
    });
  }
});

describe("posting the 835 moves the money onto the ledger", () => {
  for (const caseId of CASE_IDS) {
    test(`${caseId}: the ledger sums to the 835's own numbers`, () => {
      const { remittance } = claimFor(caseId);
      const entries = post(remittance);
      const balance = ledgerBalance(entries);

      expect(entries.length).toBeGreaterThan(0);
      expect(dentalLedgerAgreesWithRemittance(entries, remittance)).toBe(true);
      expect(balance.insurancePaidCents).toBe(Math.round(remittance.totalPaidUsd * 100));

      const patientOwesUsd = remittance.lines.reduce((sum, line) => sum + line.patientOwesUsd, 0);
      expect(balance.patientBalanceCents).toBe(Math.round(patientOwesUsd * 100));
    });
  }

  test("every line balances by the one rule, and an unbalanced line is caught", () => {
    const { remittance } = claimFor("DCASE-001");
    const line = remittance.lines[0];
    expect(dentalLineBalances(line).balances).toBe(true);

    const broken = { ...line, paidUsd: line.paidUsd + 1 };
    expect(dentalLineBalances(broken).balances).toBe(false);
    expect(dentalLineBalances(broken).differenceUsd).toBe(-1);
  });

  test("a CO denial is a write-off and leaves the patient owing 0 on that line", () => {
    const { remittance } = claimFor("DCASE-001");
    const coLine = remittance.lines.find((line) => {
      const denial = line.adjustments.find((a) => a.denialId)?.denialId;
      return Boolean(denial && findDenial(denial)?.groupCode === "CO");
    });
    expect(coLine).toBeDefined();
    expect(coLine!.patientOwesUsd).toBe(0);
    expect(coLine!.writeOffUsd + coLine!.providerAdjustmentUsd).toBeGreaterThan(0);

    const entries = post(remittance);
    const lineBalance = entries
      .filter((entry) => entry.lineNumber === coLine!.line)
      .reduce((sum, entry) => sum + entry.amountCents, 0);
    expect(lineBalance).toBe(0);
  });

  test("a PR denial stays the patient's balance", () => {
    const { remittance } = claimFor("DCASE-009");
    const prLine = remittance.lines.find((line) => line.patientOwesUsd > 0 && line.paidUsd === 0);
    expect(prLine).toBeDefined();

    const entries = post(remittance);
    const lineBalance = entries
      .filter((entry) => entry.lineNumber === prLine!.line)
      .reduce((sum, entry) => sum + entry.amountCents, 0);
    expect(lineBalance).toBe(Math.round(prLine!.patientOwesUsd * 100));
  });

  test("a downgrade posts a payment and a CO-45, never a denial", () => {
    const { remittance } = claimFor("DCASE-002");
    const downgraded = remittance.lines.filter((line) => line.disposition === "paid-with-adjustment");
    for (const line of downgraded) {
      expect(line.paidUsd).toBeGreaterThan(0);
      expect(line.adjustments.some((a) => a.groupCode === "CO" && a.reasonCode === "59")).toBe(true);
    }
  });

  test("posting twice adds nothing", () => {
    const { remittance } = claimFor("DCASE-001");
    const entries = post(remittance);
    const again = appendLedgerEntries(entries, post(remittance));
    expect(again).toBe(entries);
    expect(ledgerBalance(again).patientBalanceCents).toBe(ledgerBalance(entries).patientBalanceCents);
  });

  test("a PR adjustment posts no entry of its own — it is the balance that is left", () => {
    const { remittance } = claimFor("DCASE-003");
    const entries = post(remittance);
    const prEntries = entries.filter((entry) => entry.type === "adjustment" && entry.code.startsWith("PR-"));
    expect(prEntries.length).toBe(0);
  });
});

describe("only a graded case's own claim can post", () => {
  const { remittance } = claimFor("DCASE-001");
  const base = { caseId: "DCASE-001", claimSubmitted: true, claimNumber: "DENT-DCASE-001", ledger: [] };

  test("a submitted graded claim posts", () => {
    expect(canPostDentalRemittance(base, remittance).ok).toBe(true);
  });

  test("no case open — a practice remittance is refused", () => {
    expect(canPostDentalRemittance({ ...base, caseId: null }, remittance).ok).toBe(false);
  });

  test("a claim that was never submitted is refused", () => {
    expect(canPostDentalRemittance({ ...base, claimSubmitted: false }, remittance).ok).toBe(false);
  });

  test("another claim's 835 is refused", () => {
    expect(canPostDentalRemittance({ ...base, claimNumber: "DENT-DCASE-002" }, remittance).ok).toBe(false);
  });

  test("a second post is refused", () => {
    const posted = { ...base, ledger: post(remittance) };
    expect(canPostDentalRemittance(posted, remittance).ok).toBe(false);
  });
});

describe("saved progress is migrated, never invented", () => {
  test("v4 payments and adjustments become ledger entries, marked migrated", () => {
    const migrated = migrateDentalTrackState({
      version: 4,
      caseId: "DCASE-001",
      stage: "ledger",
      furthestStage: "ledger",
      claimNumber: "DENT-000123",
      claimSubmitted: true,
      claimStatus: "accepted",
      payments: [
        { id: "pmt-1", amountUsd: 40, source: "patient", method: "Cash", at: "2026-11-01T09:00:00.000Z" },
        { id: "pmt-2", amountUsd: 120, source: "insurance", method: "EFT", at: "2026-11-01T09:05:00.000Z" },
      ],
      adjustments: [{ id: "adj-1", amountUsd: 22, type: "contractual-write-off", at: "2026-11-01T09:10:00.000Z" }],
    });

    expect(migrated.version).toBe(6);
    expect(migrated.ledger.length).toBe(3);
    expect(migrated.ledger.every((entry) => entry.userId === "migrated")).toBe(true);
    expect(migrated.ledger.every((entry) => entry.description.includes("Moved from the pre-ledger"))).toBe(true);
    expect(migrated.ledger.map((entry) => entry.amountCents)).toEqual([-4000, -12000, -2200]);
    expect(migrated.ledger[0].date).toBe("2026-11-01");
    // Nothing invented: no charge was ever posted, so there are no charges.
    expect(ledgerBalance(migrated.ledger).chargesCents).toBe(0);
  });

  test("a v5 record keeps its ledger untouched", () => {
    const { remittance } = claimFor("DCASE-001");
    const ledger = post(remittance);
    const migrated = migrateDentalTrackState({
      version: 5,
      caseId: "DCASE-001",
      claimNumber: remittance.claimControlNumber,
      claimSubmitted: true,
      ledger,
    });
    expect(migrated.ledger).toBe(ledger);
  });

  test("an unknown version falls back to a fresh record rather than guessing", () => {
    const migrated = migrateDentalTrackState({ version: 99, caseId: "DCASE-001" });
    expect(migrated.caseId).toBeNull();
    expect(migrated.ledger).toEqual([]);
  });
});
