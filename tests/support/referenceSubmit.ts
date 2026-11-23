/**
 * The student's own Submit on the Tutorial Patient's claim, for the tests.
 *
 * Owner, 2026-11-23: *"in billing section it should not be submitted, the
 * CMS-1500 should be filled and student should submit too … himself."* The
 * reference claim now opens as a filled **draft** — no 837P, no 277CA, no 835,
 * no posting and no AR row — and every one of those is produced by the student
 * pressing **Submit** on the Billing stage (`components/BillingLedger`).
 *
 * A test that asserted the old, already-sent state therefore has to make that
 * press itself. There are two ways, and each matches the layer the test works
 * at:
 *
 *   - `submitReferenceClaim` — the pure domain calls `BillingLedger`'s handler
 *     makes (the 837P + 277CA, the payer's 835, the posting), for a test that
 *     holds a record and no store.
 *   - `pressSubmitOnReferenceClaim` — the same four **store** actions, in the
 *     same order, inside `withClaimSubmit` (the one write the read-only chart
 *     lets through), for a test that mounts `PipelineProvider`.
 *
 * Neither invents a value: the boxes come from the claim on the record, exactly
 * as the paper's own Submit reads them.
 *
 * Inspired by: Epic's training environment, where the demo claim is filled and
 * the learner presses Send — the send is the exercise, not the setup.
 */
import type { Patient } from "../../src/store/patientStore";
import type { PipelineEncounter } from "../../src/store/pipelineEncounter";
import { adjudicateClaim, planForPayerName } from "../../src/domain/adjudication";
import { buildSubmissionEvents } from "../../src/domain/clearinghouse";
import { appendLedgerEntries, postRemittanceToLedger } from "../../src/domain/ledger";
import { withClaimSubmit } from "../../src/domain/tutorialReadOnly";

/** The claim's billable lines, read the way the paper's Submit reads them. */
function billableLines(form: Record<string, unknown> | null | undefined) {
  const lines = ((form?.serviceLines ?? []) as Record<string, unknown>[]).filter(
    (line) => String(line.cpt ?? "").trim() !== "",
  );
  return lines.map((line) => ({
    cpt: String(line.cpt).trim(),
    modifiers: (line.modifiers ?? []) as string[],
    units: Number(line.units) > 0 ? Number(line.units) : 1,
    chargeCents: Math.round((Number(line.charge) || 0) * 100),
  }));
}

/**
 * The student's Submit at the domain layer: the 837P and its 277CA, then the
 * payer's 835, then the posting — the same three modules, in the same order, on
 * one record.
 */
export function submitReferenceClaim(
  enc: PipelineEncounter,
  patient: Pick<Patient, "insuranceRecord" | "dateOfBirth">,
  at: string,
  by = "923001234567",
): PipelineEncounter {
  const form = enc.claimForm;
  if (!form) throw new Error("the reference claim has no paper");
  const lines = billableLines(form as unknown as Record<string, unknown>);
  const { events, ack } = buildSubmissionEvents({
    facts: {
      track: "medical",
      claimNumber: enc.claimNumber ?? "",
      subscriberId: form.insuredId,
      subscriberIdOnFile: patient.insuranceRecord?.primary?.subscriberId ?? "",
      patientDob: form.patientDob,
      patientDobOnFile: patient.dateOfBirth ?? "",
    },
    from: enc.claimStatus,
    patientId: enc.patientId,
    by,
    jobRole: "biller",
    lineCount: lines.length,
    payerName: form.payerName,
    existing: enc.statusEvents,
    at,
  });
  if (ack.category !== "A1") {
    throw new Error(`the clearinghouse rejected the reference claim: ${ack.reason}`);
  }
  const plan = planForPayerName(form.payerName);
  const remittance = adjudicateClaim({
    claimNumber: enc.claimNumber ?? "",
    payerName: form.payerName,
    payerId: form.payerEdiId,
    plan,
    lines,
    deductibleRemainingCents: Math.round((plan?.deductibleUsd ?? 0) * 100),
    priorAuthNumber: form.priorAuthNumber ?? "",
    at,
  });
  const entries = postRemittanceToLedger(remittance, { patientId: enc.patientId, userId: by, at });
  return {
    ...enc,
    claimStatus: "accepted",
    statusEvents: events,
    remittances: [{ ...remittance, postedAt: at }],
    ledger: appendLedgerEntries(enc.ledger, entries),
  };
}

/** The four store actions a mounted `PipelineProvider` exposes for Submit. */
export interface ReferenceClaimStore {
  getEncounter: (patientId: string) => PipelineEncounter | undefined;
  transmitClaim: (input: {
    subscriberId: string;
    subscriberIdOnFile: string;
    patientDob: string;
    patientDobOnFile: string;
    lineCount: number;
    payerName: string;
  }) => void;
  submitClaim: (claimData: Record<string, string>) => void;
  adjudicateClaim: (input?: { payerName?: string }) => void;
  postRemittance: () => void;
}

/**
 * The student's Submit at the store layer: `BillingLedger`'s handler, reduced to
 * the four calls it makes. The boxes are the claim's own — box 1a and box 3 —
 * so the 277CA is answered exactly as the paper answers it.
 */
export function pressSubmitOnReferenceClaim(
  store: ReferenceClaimStore,
  patientId = "DEMO",
): void {
  const enc = store.getEncounter(patientId);
  const form = enc?.claimForm as unknown as Record<string, unknown> | null | undefined;
  if (!form) throw new Error("the reference claim has no paper to submit");
  const lines = billableLines(form);
  const subscriberId = String(form.insuredId ?? "");
  const patientDob = String(form.patientDob ?? "");
  const payerName = String(form.payerName ?? "");
  // `withClaimSubmit` is the one window the read-only chart opens: the student's
  // press is the exercise, so the stores let this write through.
  withClaimSubmit(() => {
    store.transmitClaim({
      subscriberId,
      subscriberIdOnFile: subscriberId,
      patientDob,
      patientDobOnFile: patientDob,
      lineCount: lines.length,
      payerName,
    });
    store.submitClaim({});
    store.adjudicateClaim({ payerName });
    store.postRemittance();
  });
}
