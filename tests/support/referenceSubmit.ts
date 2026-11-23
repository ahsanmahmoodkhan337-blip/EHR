/**
 * The student's own work on the Tutorial Patient's claim, for the tests.
 *
 * Owner, 2026-11-23: *"in billing section it should not be submitted, the
 * CMS-1500 should be filled and student should submit too … himself."* The
 * reference claim opens as a filled **draft** — no 837P, no 277CA, no 835, no
 * posting and no AR row — and the cycle is walked in two deliberate steps:
 *
 *   1. **Submit** on the Billing stage (`components/BillingLedger`): the 837P and
 *      its 277CA. The claim leaves `draft` as `accepted` (or `rejected`) and
 *      nothing is priced, posted or queued. Submit does not adjudicate
 *      (`specs/pr189-submit-evidence.md`, defect 1).
 *   2. **Adjudicate this claim** on the Payments stage: the payer's 835, then the
 *      posting that writes the ledger and the AR row the denial derives.
 *
 * There are two layers, and each helper matches the layer the test works at:
 *
 *   - `submitReferenceClaim` / `adjudicateReferenceClaim` — the pure domain calls
 *     `BillingLedger`'s handlers make, for a test that holds a record and no store.
 *   - `pressSubmitOnReferenceClaim` / `pressAdjudicateOnReferenceClaim` — the same
 *     **store** actions, in the same order, inside `withClaimSubmit` (the window
 *     the read-only chart opens for the student's own work), for a test that
 *     mounts `PipelineProvider`.
 *
 * Neither invents a value: the boxes come from the claim on the record, exactly
 * as the paper's own controls read them.
 *
 * Inspired by: Epic's training environment, where the demo claim is filled and
 * the learner presses Send — the send is the exercise, not the setup.
 */
import type { Patient } from "../../src/store/patientStore";
import type { PipelineEncounter } from "../../src/store/pipelineEncounter";
import { adjudicateClaim, planForPayerName } from "../../src/domain/adjudication";
import { buildSubmissionEvents } from "../../src/domain/clearinghouse";
import { appendLedgerEntries, postRemittanceToLedger } from "../../src/domain/ledger";
import { claimStatusForRemittance } from "../../src/domain/claimStatus";
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
 * Step 1, at the domain layer: the 837P and the 277CA it earns — and nothing
 * else. The claim leaves `draft` as `accepted`; no 835, no posting, no AR row.
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
  return {
    ...enc,
    claimStatus: "accepted",
    statusEvents: events,
  };
}

/**
 * Step 2, at the domain layer: the payer adjudicates the accepted claim and its
 * 835 arrives. Nothing reaches the ledger yet — that is the posting.
 */
export function adjudicateReferenceClaim(
  enc: PipelineEncounter,
  at: string,
): PipelineEncounter {
  const form = enc.claimForm;
  if (!form) throw new Error("the reference claim has no paper to adjudicate");
  if (enc.claimStatus !== "accepted") {
    throw new Error(`the reference claim is ${enc.claimStatus ?? "unset"}, not accepted`);
  }
  const plan = planForPayerName(form.payerName);
  const remittance = adjudicateClaim({
    claimNumber: enc.claimNumber ?? "",
    payerName: form.payerName,
    payerId: form.payerEdiId,
    plan,
    lines: billableLines(form as unknown as Record<string, unknown>),
    deductibleRemainingCents: Math.round((plan?.deductibleUsd ?? 0) * 100),
    priorAuthNumber: form.priorAuthNumber ?? "",
    at,
  });
  return {
    ...enc,
    claimStatus: "adjudicated",
    remittances: [...enc.remittances, remittance],
  };
}

/**
 * Step 3, at the domain layer: the posting writes the ledger entries and the
 * claim's status follows the money — `partially_paid` for the reference claim.
 */
export function postReferenceClaim(
  enc: PipelineEncounter,
  at: string,
  by = "923001234567",
): PipelineEncounter {
  const remittance = enc.remittances.find(
    (r) => r.claimNumber === enc.claimNumber && !r.postedAt,
  );
  if (!remittance) throw new Error("the reference claim has no 835 to post");
  const entries = postRemittanceToLedger(remittance, { patientId: enc.patientId, userId: by, at });
  return {
    ...enc,
    claimStatus: claimStatusForRemittance(remittance),
    remittances: enc.remittances.map((r) => (r.id === remittance.id ? { ...r, postedAt: at } : r)),
    ledger: appendLedgerEntries(enc.ledger, entries),
  };
}

/** All three steps, for a test that only needs the money to exist. */
export function submitAndAdjudicateReferenceClaim(
  enc: PipelineEncounter,
  patient: Pick<Patient, "insuranceRecord" | "dateOfBirth">,
  at: string,
  by = "923001234567",
): PipelineEncounter {
  return postReferenceClaim(adjudicateReferenceClaim(submitReferenceClaim(enc, patient, at, by), at), at, by);
}

/** The store actions a mounted `PipelineProvider` exposes for both steps. */
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

/** The claim's own boxes, read the way the paper's controls read them. */
function claimFacts(store: ReferenceClaimStore, patientId: string) {
  const enc = store.getEncounter(patientId);
  const form = enc?.claimForm as unknown as Record<string, unknown> | null | undefined;
  if (!form) throw new Error("the reference claim has no paper");
  return {
    lines: billableLines(form),
    subscriberId: String(form.insuredId ?? ""),
    patientDob: String(form.patientDob ?? ""),
    payerName: String(form.payerName ?? ""),
  };
}

/**
 * Step 1 at the store layer: `BillingLedger`'s Submit handler, reduced to the two
 * calls it makes. Box 1a and box 3 are the claim's own, so the 277CA is answered
 * exactly as the paper answers it.
 */
export function pressSubmitOnReferenceClaim(
  store: ReferenceClaimStore,
  patientId = "DEMO",
): void {
  const facts = claimFacts(store, patientId);
  // `withClaimSubmit` is the one window the read-only chart opens: the student's
  // press is the exercise, so the stores let this write through.
  withClaimSubmit(() => {
    store.transmitClaim({
      subscriberId: facts.subscriberId,
      subscriberIdOnFile: facts.subscriberId,
      patientDob: facts.patientDob,
      patientDobOnFile: facts.patientDob,
      lineCount: facts.lines.length,
      payerName: facts.payerName,
    });
    store.submitClaim({});
  });
}

/**
 * Step 2 at the store layer: the Payments stage's **Adjudicate this claim** and
 * the posting of the 835 it returns — the student's own second decision.
 */
export function pressAdjudicateOnReferenceClaim(
  store: ReferenceClaimStore,
  patientId = "DEMO",
): void {
  const facts = claimFacts(store, patientId);
  withClaimSubmit(() => {
    store.adjudicateClaim({ payerName: facts.payerName });
    store.postRemittance();
  });
}

/** Both presses, for a test that only needs the money to exist. */
export function pressSubmitAndAdjudicateOnReferenceClaim(
  store: ReferenceClaimStore,
  patientId = "DEMO",
): void {
  pressSubmitOnReferenceClaim(store, patientId);
  pressAdjudicateOnReferenceClaim(store, patientId);
}
