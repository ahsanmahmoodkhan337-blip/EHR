/**
 * The patient hub's tabs (`specs/patient-hub.md`): the ledger roll-up, the
 * documents list and the encounter list's own record.
 *
 * The promises tested here:
 *   1. The Ledger tab's total is the sum of that patient's entries, and the
 *      running balance reads down the screen the way the money moved.
 *   2. A patient with no eligibility record shows "not checked", never a fake
 *      active — and the Front Desk stage and the banner read the same record.
 *   3. A generated claim form appears once a claim exists, and a patient with no
 *      work done has an empty documents list rather than an invented paper.
 *   4. Two patients keep separate documents and separate ledger money.
 */
import { describe, expect, test } from "bun:test";
import {
  ledgerBalance,
  ledgerEntriesForPatient,
  patientBalanceCents,
  patientLedgerRows,
  type LedgerEntry,
} from "../src/domain/ledger";
import {
  documentsForPatient,
  generatedDocuments,
  makeAddedDocument,
} from "../src/domain/documents";
import { eligibilityOf, eligibilitySummary } from "../src/domain/eligibility";

const entry = (over: Partial<LedgerEntry>): LedgerEntry => ({
  id: "LEDG-1",
  patientId: "PAT-1",
  claimNumber: "CLM-000001",
  date: "2026-11-20",
  type: "charge",
  code: "99213",
  description: "Charge — CPT 99213",
  amountCents: 15000,
  userId: "front-desk",
  ...over,
});

describe("the Ledger tab", () => {
  const entries: LedgerEntry[] = [
    entry({ id: "A", type: "charge", amountCents: 15000 }),
    entry({ id: "B", type: "insurance_payment", amountCents: -10000, code: "PAYER-PMT" }),
    entry({ id: "C", type: "adjustment", amountCents: -2000, code: "45" }),
    entry({ id: "D", type: "patient_payment", amountCents: -1000, code: "COPAY" }),
    entry({ id: "OTHER", patientId: "PAT-2", amountCents: 9900 }),
  ];

  test("the total is the sum of that patient's own entries", () => {
    expect(patientBalanceCents(entries, "PAT-1")).toBe(2000);
    expect(ledgerBalance(ledgerEntriesForPatient(entries, "PAT-1")).patientBalanceCents).toBe(2000);
    // The other patient's money never lands on this chart.
    expect(patientBalanceCents(entries, "PAT-2")).toBe(9900);
  });

  test("the running balance is the balance after each entry, newest first", () => {
    const rows = patientLedgerRows(entries, "PAT-1");
    expect(rows.map((row) => row.entry.id)).toEqual(["D", "C", "B", "A"]);
    expect(rows[0].balanceCents).toBe(2000);
    expect(rows[3].balanceCents).toBe(15000);
  });

  test("a patient with nothing posted has an empty ledger, not a zero entry", () => {
    expect(patientLedgerRows(entries, "PAT-3")).toEqual([]);
    expect(patientBalanceCents(entries, "PAT-3")).toBe(0);
  });
});

describe("the Documents tab", () => {
  test("a generated claim form appears once the claim exists", () => {
    const papers = generatedDocuments({
      patientId: "PAT-1",
      encounterId: "PAT-1",
      claimNumber: "CLM-000001",
      claimForm: true,
      placeOfService: "11",
      track: "medical",
      remittances: [],
      fallbackDate: "2026-11-20",
    });
    expect(papers).toHaveLength(1);
    expect(papers[0].category).toBe("claim-form");
    expect(papers[0].source).toBe("generated");
    expect(papers[0].name).toContain("CMS-1500");
    expect(papers[0].description).toContain("837P");
  });

  test("no claim form, no EOB, no documents — nothing is invented", () => {
    const papers = generatedDocuments({
      patientId: "PAT-1",
      claimForm: false,
      remittances: [],
    });
    expect(papers).toEqual([]);
    expect(documentsForPatient([], papers, "PAT-1")).toEqual([]);
  });

  test("an 835 posts an EOB, and an added document keeps its own patient", () => {
    const papers = generatedDocuments({
      patientId: "PAT-1",
      claimNumber: "CLM-000001",
      claimForm: false,
      remittances: [{ claimNumber: "CLM-000001", postedAt: "2026-11-21T10:00:00.000Z" }],
    });
    expect(papers.map((paper) => paper.category)).toEqual(["eob"]);

    const added = makeAddedDocument({
      patientId: "PAT-2",
      name: "  Referral letter ",
      category: "other",
      at: "2026-11-21T11:00:00.000Z",
    });
    expect(added?.name).toBe("Referral letter");
    expect(documentsForPatient([added!], papers, "PAT-1")).toHaveLength(1);
    expect(documentsForPatient([added!], papers, "PAT-2")).toHaveLength(1);
    expect(documentsForPatient([added!], papers, "PAT-2")[0].patientId).toBe("PAT-2");
  });

  test("an unnamed document is refused rather than stored as Untitled", () => {
    expect(makeAddedDocument({ patientId: "PAT-1", name: "   ", category: "other", at: "x" })).toBeNull();
  });
});

describe("the eligibility the hub and the banner share", () => {
  test("a patient with no 271 reads not checked, never a fake active", () => {
    expect(eligibilityOf(null).status).toBe("not-checked");
    expect(eligibilityOf({ payerName: "Northwind Health Plan" }).status).toBe("not-checked");
    expect(eligibilitySummary(eligibilityOf({}))).toBe("Eligibility not checked");
  });
});
