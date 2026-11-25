/**
 * The denial loop closes: CO-31 denial → Correct and resubmit → the corrected
 * claim (…-R1) is paid → posted → the patient pays → nothing is owed.
 *
 * Money must reconcile at every step: every ledger figure is summed from the
 * entries, the denied claim never goes into credit, the charge is never billed
 * twice, and until the payer answers the corrected claim the money is the
 * payer's, not the patient's.
 */
import { describe, expect, test } from "bun:test";
import { adjudicateClaim } from "../src/domain/adjudication";
import { MEDICAL_PLANS } from "../src/data/medical/payerScenarios";
import {
  appendLedgerEntries,
  chargeCarriedByTransfer,
  ledgerBalance,
  postRemittanceToLedger,
  type LedgerEntry,
} from "../src/domain/ledger";
import {
  arResolutionEntries,
  buildArWorkQueue,
  correctedClaimForm,
  type ArQueueSource,
} from "../src/domain/arWorkQueue";
import { liveMilestones, liveMoney } from "../src/domain/liveTracker";

const NOW = "2026-11-26T12:00:00.000Z";
const CTX = { patientId: "P1", userId: "student", at: NOW };
const PLAN = MEDICAL_PLANS[0];

function adjudicate(claimNumber: string, mismatch: boolean) {
  return adjudicateClaim({
    claimNumber,
    payerName: "Cascadia Health PPO",
    plan: PLAN,
    lines: [{ cpt: "99203", chargeCents: 17500 }],
    deductibleRemainingCents: 0,
    priorAuthNumber: "",
    subscriberNameMismatch: mismatch ? { payerHolds: "Maria Lpoez", claimCarries: "LOPEZ, MARIA" } : null,
  });
}

function sources(ledger: LedgerEntry[], remittances: ReturnType<typeof adjudicate>[], arItems: ArQueueSource["arItems"] = []): ArQueueSource[] {
  const claims = [...new Set(ledger.map((e) => e.claimNumber))];
  return claims.map((claimNumber) => ({
    patientId: "P1",
    patientName: "Maria Lopez",
    claimNumber,
    remittances: remittances.map((r) => ({ ...r, postedAt: NOW })),
    ledger,
    arItems,
  }));
}

/** charges = insurance paid + adjustments + patient paid + patient balance + payer-owed. */
function reconciles(ledger: LedgerEntry[]) {
  const b = ledgerBalance(ledger);
  const transfers = ledger.filter((e) => e.type === "transfer").reduce((s, e) => s + e.amountCents, 0);
  expect(b.chargesCents + transfers + b.refundsCents).toBe(
    b.insurancePaidCents + b.adjustmentsCents + b.patientPaidCents + b.patientBalanceCents + b.insuranceBalanceCents,
  );
}

describe("a denied claim corrected and resubmitted closes with the money reconciled", () => {
  test("the whole loop, step by step", () => {
    // 1. The 835 denies CO-31 and is posted.
    const denied = adjudicate("CLM-000003", true);
    expect(denied.lines[0].adjustments[0].carc).toBe("CO-31");
    let ledger = appendLedgerEntries([], postRemittanceToLedger(denied, CTX));
    reconciles(ledger);
    expect(ledgerBalance(ledger).patientBalanceCents).toBe(0);
    expect(liveMoney({ ledger, claimChargeCents: 17500 }).deniedCents).toBe(17500);

    // 2. Correct and resubmit: the refusal is reversed and moves to R1.
    const item = buildArWorkQueue(sources(ledger, [denied]), NOW).find((i) => i.kind === "denial")!;
    expect(item.carc).toBe("CO-31");
    ledger = appendLedgerEntries(ledger, arResolutionEntries(item, "rebill", CTX));
    reconciles(ledger);
    let b = ledgerBalance(ledger);
    expect(b.patientBalanceCents).toBe(0);
    expect(b.insuranceBalanceCents).toBe(17500); // the payer has been asked again
    expect(ledgerBalance(ledger.filter((e) => e.claimNumber === "CLM-000003")).patientBalanceCents).toBe(0);
    const money = liveMoney({ ledger, claimChargeCents: 17500 });
    expect(money.deniedCents).toBe(0);
    expect(money.withPayerCents).toBe(17500);
    expect(money.adjustedCents).toBe(0);

    // The tracker does not call the visit closed while the payer owes money.
    const stillOpen = liveMilestones({
      cptCodes: ["99203"],
      events: [],
      ledger,
      openArItems: 0,
      claimNumber: "CLM-000003-R1",
    });
    expect(stillOpen.find((m) => m.id === "closed")!.state).not.toBe("done");
    expect(stillOpen.find((m) => m.id === "sent")!.label).toBe("Corrected claim");

    // 3. The corrected claim carries the payer's spelling and is paid.
    expect(chargeCarriedByTransfer(ledger, "CLM-000003-R1")).toBe(true);
    const paid = adjudicate("CLM-000003-R1", false);
    expect(paid.totals.paidCents).toBeGreaterThan(0);
    const posting = postRemittanceToLedger(paid, { ...CTX, chargeCarried: true });
    expect(posting.some((e) => e.type === "charge")).toBe(false); // never billed twice
    ledger = appendLedgerEntries(ledger, posting);
    reconciles(ledger);
    b = ledgerBalance(ledger);
    expect(b.insuranceBalanceCents).toBe(0);
    expect(b.chargesCents).toBe(17500);
    expect(b.patientBalanceCents).toBe(paid.totals.patientRespCents);

    // 4. The patient's share is a balance item on R1; the patient pays it.
    const queue = buildArWorkQueue(sources(ledger, [denied, paid], [{ id: item.id, claimNumber: item.claimNumber, status: "resolved", action: "rebill", at: NOW, by: "student" }]), NOW);
    const balance = queue.find((i) => i.kind === "balance");
    if (paid.totals.patientRespCents > 0) {
      expect(balance?.claimNumber).toBe("CLM-000003-R1");
      ledger = appendLedgerEntries(ledger, arResolutionEntries(balance!, "patient_payment", CTX));
    } else {
      expect(balance).toBeUndefined();
    }
    reconciles(ledger);
    b = ledgerBalance(ledger);
    expect(b.patientBalanceCents).toBe(0);
    expect(b.insuranceBalanceCents).toBe(0);
  });

  test("the corrected claim paper says it replaces the original (Box 22 code 7)", () => {
    const form = correctedClaimForm({ resubmissionCode: "", originalClaimNumber: "", insuredName: "LOPEZ, MARIA" }, "CLM-000003");
    expect(form.resubmissionCode).toBe("7");
    expect(form.originalClaimNumber).toBe("CLM-000003");
    expect(form.insuredName).toBe("LOPEZ, MARIA");
  });

  test("an appeal keeps the visit open: the payer owes the money until it answers", () => {
    const denied = adjudicate("CLM-000009", true);
    let ledger = appendLedgerEntries([], postRemittanceToLedger(denied, CTX));
    const item = buildArWorkQueue(sources(ledger, [denied]), NOW).find((i) => i.kind === "denial")!;
    ledger = appendLedgerEntries(ledger, arResolutionEntries(item, "appeal", CTX));
    reconciles(ledger);
    expect(ledgerBalance(ledger).insuranceBalanceCents).toBe(17500);
    expect(ledgerBalance(ledger).patientBalanceCents).toBe(0);
  });
});
