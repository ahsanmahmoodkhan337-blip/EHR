/**
 * Clearinghouse submission and the 277CA — money-cycle spec items 8 and 9
 * (`specs/task-4-claims-clearinghouse.md`).
 *
 * Inspiration: the X12 837P / 837D submission and the 277CA claim
 * acknowledgement a clearinghouse (Availity, Change Healthcare, Trizetto-style)
 * returns, plus the Accepted / Rejected strip Epic and athenahealth put on a
 * claim. The 277CA vocabulary is the real one: a claim status **category** code
 * (A1 accepted, A3 rejected), an **entity** code naming whose data failed, and a
 * plain-language reason.
 *
 * Three things this file exists to keep straight:
 *
 *  1. **A submission has an ID and a timeline.** The claim number is minted once,
 *     by the store, when the claim is created (`domain/claimStatus.ts`). Every
 *     transmission after that records its own 837P control number and its own
 *     277CA control number, so a resubmission after a correction is a new row on
 *     the timeline and a double-click is not.
 *  2. **A rejection is not a denial.** A 277CA never carries a CARC and never
 *     carries money: the claim never reached adjudication, so there is nothing to
 *     pay, deny or bill. It goes back to the biller for correction.
 *  3. **Nothing here reads the clock, the store or React.** The caller hands in
 *     the claim's facts and the events already recorded; it gets back the events
 *     to append, in one write, and the outcome to show.
 *
 * Transition note: `specs/status-engine.md` §3 lists 24 claim transitions. Item 9
 * requires that a rejected claim "returns to the claim for correction", so this
 * file also uses **`rejected → submitted`** (a corrected claim transmitted again,
 * with its own 837P control number). Real payers differ on whether a
 * 277CA-rejected claim is resubmitted fresh or as a frequency-7 correction; the
 * simulator files it fresh and says so in the timeline reason.
 */

import type { ClaimStatus, JobRole } from "./claimStatus";
import {
  appendStatusEvent,
  makeStatusEvent,
  statusEventsFor,
  type StatusEvent,
} from "./statusEvent";

// ─── The 277CA vocabulary ──────────────────────────────────────────

/** Claim status category code. A1 = accepted, A3 = rejected. */
export type ClaimAckCategory = "A1" | "A3";

/**
 * Entity code — whose data the 277CA is about. The closed set
 * `specs/status-engine.md` §12 allows on screen: patient, referring provider,
 * rendering provider, billing provider, subscriber, payer.
 */
export type ClaimAckEntity = "QC" | "72" | "82" | "85" | "IL" | "PR";

export const CLAIM_ACK_ENTITY_LABELS: Record<ClaimAckEntity, string> = {
  QC: "Patient",
  "72": "Referring provider",
  "82": "Rendering provider",
  "85": "Billing provider",
  IL: "Subscriber",
  PR: "Payer",
};

export const CLAIM_ACK_CATEGORY_LABELS: Record<ClaimAckCategory, string> = {
  A1: "Accepted",
  A3: "Rejected",
};

/**
 * The sentence every rejected claim carries, so no screen has to invent it: a
 * student who reads this once should never call a rejection a denial again.
 */
export const REJECTION_IS_NOT_A_DENIAL =
  "A rejection is not a denial. The claim never reached the payer's adjudication, so no CARC, no payment and no patient balance exist — it goes back to the biller for correction.";

// ─── Rejection cases ───────────────────────────────────────────────

/**
 * One way a clearinghouse rejects a claim before adjudication. `box` is the box
 * on that track's paper the student corrects, in the paper's own numbering.
 */
export interface RejectionCase {
  /** Stable rule id, so an instructor can map a screen to the answer key. */
  id: string;
  entity: ClaimAckEntity;
  /** The box on this paper that carries the bad data, e.g. "1a". */
  box: string;
  /** What the 277CA says, in the clearinghouse's voice. */
  reason: string;
  /** What the biller does about it. */
  correction: string;
}

/**
 * Medical (CMS-1500 / 837P). Three cases, all caught by the payer's file rather
 * than by an edit engine: the scrubber checks the shape of a member ID, the
 * clearinghouse checks whether that member exists.
 */
export const MEDICAL_REJECTION_CASES: RejectionCase[] = [
  {
    id: "MED-IL-SUBSCRIBER-NOT-ON-FILE",
    entity: "IL",
    box: "1a",
    reason: "The subscriber ID on the claim is not the ID on the member's file.",
    correction:
      "Correct box 1a from the patient's insurance record, then transmit the claim again.",
  },
  {
    id: "MED-QC-DOB-MISMATCH",
    entity: "QC",
    box: "3",
    reason: "The patient's date of birth on the claim does not match the subscriber's file.",
    correction: "Correct box 3 from the chart, then transmit the claim again.",
  },
  {
    id: "MED-85-DUPLICATE",
    entity: "85",
    box: "22",
    reason: "This claim is already on the payer's file; it is a duplicate submission.",
    correction:
      "Do not transmit an accepted claim again. A change is filed as a corrected claim — frequency 7 in box 22 quoting the original claim number in box 22a.",
  },
];

/**
 * Dental (ADA 2019 / 837D). The same three failures, on the ADA paper's own box
 * numbers — box 9 subscriber ID, box 15 patient date of birth, box 22 for a
 * correction.
 */
export const DENTAL_REJECTION_CASES: RejectionCase[] = [
  {
    id: "DEN-IL-SUBSCRIBER-NOT-ON-FILE",
    entity: "IL",
    box: "9",
    reason: "The subscriber ID on the claim is not the ID on the member's file.",
    correction:
      "Correct box 9 from the patient's coverage record, then transmit the claim again.",
  },
  {
    id: "DEN-QC-DOB-MISMATCH",
    entity: "QC",
    box: "15",
    reason: "The patient's date of birth on the claim does not match the subscriber's file.",
    correction: "Correct box 15 from the chart, then transmit the claim again.",
  },
  {
    id: "DEN-85-DUPLICATE",
    entity: "85",
    box: "2",
    reason: "This claim is already on the payer's file; it is a duplicate submission.",
    correction:
      "Do not transmit an accepted claim again. A change is filed as a corrected claim quoting the original claim number.",
  },
];

export type ClaimTrack = "medical" | "dental";

export function rejectionCasesFor(track: ClaimTrack): RejectionCase[] {
  return track === "dental" ? DENTAL_REJECTION_CASES : MEDICAL_REJECTION_CASES;
}

// ─── Facts the clearinghouse checks ────────────────────────────────

/**
 * What the payer's file knows about this member, and what the claim submitted.
 * Dates are compared on their digits only, so `1984-03-02` and `03/02/1984` are
 * the same date — a formatting difference is not a rejection.
 */
export interface SubmissionFacts {
  track: ClaimTrack;
  claimNumber: string;
  /** Box 1a (CMS-1500) / box 9 (ADA), as submitted. */
  subscriberId: string;
  /** The subscriber ID the coverage record holds, or "" when none is recorded. */
  subscriberIdOnFile: string;
  /** Box 3 (CMS-1500) / box 15 (ADA), as submitted. */
  patientDob: string;
  /** The date of birth the chart holds, or "" when none is recorded. */
  patientDobOnFile: string;
  /** True when this claim already came back A1 — a second transmission is a duplicate. */
  alreadyAccepted: boolean;
}

function digitsOnly(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/**
 * A date reduced to `YYYY-MM-DD`, whatever the student typed it in: `1984-03-02`
 * and `03/02/1984` are the same date, so a formatting difference never rejects a
 * claim. Anything unparseable falls back to its digits.
 */
function dateKey(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(raw);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const us = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(raw);
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  return digitsOnly(raw);
}

/**
 * A member ID the payer cannot match: the claim carries one and the coverage
 * record carries a different one. When the simulator holds no ID for this member
 * nothing is rejected — the engine never invents a payer record to fail against.
 */
function memberIdMismatch(facts: SubmissionFacts): boolean {
  const submitted = (facts.subscriberId ?? "").trim();
  const onFile = (facts.subscriberIdOnFile ?? "").trim();
  if (!onFile) return false;
  if (!submitted) return true;
  return submitted.toUpperCase() !== onFile.toUpperCase();
}

/** A date of birth the payer cannot match. Formats are normalised first. */
function dobMismatch(facts: SubmissionFacts): boolean {
  const submitted = dateKey(facts.patientDob);
  const onFile = dateKey(facts.patientDobOnFile);
  if (!onFile || !submitted) return false;
  return submitted !== onFile;
}

function findRejection(facts: SubmissionFacts): RejectionCase | null {
  const cases = rejectionCasesFor(facts.track);
  const pick = (suffix: string) => cases.find((c) => c.id.endsWith(suffix)) ?? null;
  if (facts.alreadyAccepted) return pick("DUPLICATE");
  if (memberIdMismatch(facts)) return pick("SUBSCRIBER-NOT-ON-FILE");
  if (dobMismatch(facts)) return pick("DOB-MISMATCH");
  return null;
}

// ─── Control numbers ───────────────────────────────────────────────

/**
 * The interchange control number a transmission carries. Deterministic: the same
 * claim and the same attempt always produce the same number, which is also what
 * makes a double-click land on the same timeline entry instead of a second one.
 */
export function controlNumber(claimNumber: string, kind: "837P" | "277CA", attempt: number): string {
  const n = Number.isFinite(attempt) && attempt > 0 ? Math.floor(attempt) : 1;
  return `${claimNumber}-${kind}-${String(n).padStart(2, "0")}`;
}

/** How many times this claim has been transmitted. 1 for the first submission. */
export function submissionAttempt(events: StatusEvent[] | null | undefined, claimNumber: string): number {
  const sent = statusEventsFor(events, "claim", claimNumber).filter((e) => e.reasonCode === "SUBMITTED_837P");
  return sent.length + 1;
}

// ─── The outcome ───────────────────────────────────────────────────

export interface ClaimAck {
  claimNumber: string;
  category: ClaimAckCategory;
  /** 837P / 837D interchange control number. */
  batchControlNumber: string;
  /** 277CA interchange control number. */
  responseControlNumber: string;
  /** The entity the 277CA names, or null when the claim was accepted. */
  entity: ClaimAckEntity | null;
  /** The rejection that fired, or null when accepted. */
  rejection: RejectionCase | null;
  /** One plain sentence, safe to show on screen. */
  reason: string;
}

/**
 * What the clearinghouse answers. Pure: same facts and same attempt, same answer.
 */
export function evaluateSubmission(
  facts: SubmissionFacts,
  attempt = 1,
  payerName?: string,
): ClaimAck {
  const batchControlNumber = controlNumber(facts.claimNumber, "837P", attempt);
  const responseControlNumber = controlNumber(facts.claimNumber, "277CA", attempt);
  const payer = payerName?.trim() || "the payer";
  const rejection = findRejection(facts);

  if (!rejection) {
    return {
      claimNumber: facts.claimNumber,
      category: "A1",
      batchControlNumber,
      responseControlNumber,
      entity: null,
      rejection: null,
      reason: `277CA ${responseControlNumber}: accepted (A1). The claim is on ${payer}'s file and awaits adjudication — nothing has been paid, part-paid or denied yet.`,
    };
  }

  return {
    claimNumber: facts.claimNumber,
    category: "A3",
    batchControlNumber,
    responseControlNumber,
    entity: rejection.entity,
    rejection,
    reason: `277CA ${responseControlNumber}: rejected (A3, entity ${rejection.entity} — ${CLAIM_ACK_ENTITY_LABELS[rejection.entity]}). ${rejection.reason} ${REJECTION_IS_NOT_A_DENIAL}`,
  };
}

// ─── The timeline ──────────────────────────────────────────────────

export interface SubmissionContext {
  /** Everything the payer checks, minus what the caller cannot know here. */
  facts: Omit<SubmissionFacts, "alreadyAccepted">;
  /** The claim's status before this transmission (null = no claim yet). */
  from: ClaimStatus | null;
  patientId: string | null;
  /** Student phone, or "system". */
  by: string;
  jobRole: JobRole;
  lineCount: number;
  payerName?: string;
  /** Everything already recorded for this encounter. */
  existing: StatusEvent[];
  /** One clock read for the whole transmission; the caller may pin it in tests. */
  at?: string;
}

/**
 * Build the rows one transmission adds: the edit checks passing (Ready), the
 * 837P going out (Submitted) and the 277CA coming back (Accepted or Rejected).
 * All three belong to one store write, so a status never exists without its
 * timeline entry (`status-engine.md` §9).
 */
export function buildSubmissionEvents(ctx: SubmissionContext): { events: StatusEvent[]; ack: ClaimAck } {
  const { facts } = ctx;
  const attempt = submissionAttempt(ctx.existing, facts.claimNumber);
  const ack = evaluateSubmission(
    { ...facts, alreadyAccepted: ctx.from === "accepted" },
    attempt,
    ctx.payerName,
  );
  const at = ctx.at ?? new Date().toISOString();

  const base = {
    entityType: "claim" as const,
    entityId: facts.claimNumber,
    patientId: ctx.patientId,
    claimNumber: facts.claimNumber,
    by: ctx.by,
    jobRole: ctx.jobRole,
    at,
  };

  let events = ctx.existing;
  let current: ClaimStatus = ctx.from ?? "draft";

  // Ready — the claim's blocking edit checks passed. Recorded on the first
  // transmission only: after that the claim has been further than `scrubbed`.
  if (ctx.from === null || ctx.from === "draft") {
    const scrubPass = makeStatusEvent(
      {
        ...base,
        from: current,
        to: "scrubbed",
        reasonCode: "SCRUB_PASS",
        reason: `The claim's blocking edit checks passed, so it is ready to submit on ${ctx.payerName?.trim() || "the payer's"} paper.`,
        refs: { refNumber: ack.batchControlNumber },
      },
      events,
    );
    events = appendStatusEvent(events, scrubPass);
    current = "scrubbed";
  }

  // Submitted — the 837P goes out with its own control number.
  const submitted = makeStatusEvent(
    {
      ...base,
      from: current,
      to: "submitted",
      reasonCode: "SUBMITTED_837P",
      reason: `837P ${ack.batchControlNumber} transmitted with ${ctx.lineCount} service line${
        ctx.lineCount === 1 ? "" : "s"
      } to ${ctx.payerName?.trim() || "the payer"}. The claim is with the clearinghouse.`,
      refs: { refNumber: ack.batchControlNumber },
    },
    events,
  );
  events = appendStatusEvent(events, submitted);

  // Accepted or rejected — the 277CA comes back.
  const response = makeStatusEvent(
    {
      ...base,
      from: "submitted",
      to: ack.category === "A1" ? "accepted" : "rejected",
      reasonCode: ack.category === "A1" ? "277CA_ACCEPTED" : "277CA_REJECTED",
      reason: ack.reason,
      refs: {
        refNumber: ack.responseControlNumber,
        ackCategory: ack.category,
        ...(ack.entity ? { ackEntity: ack.entity } : {}),
        ...(ack.rejection ? { rejectionRuleId: ack.rejection.id } : {}),
      },
    },
    events,
  );
  events = appendStatusEvent(events, response);

  return { events, ack };
}

/**
 * The 277CA this claim last received, read back off its timeline. The timeline is
 * the truth; every panel that shows an outcome is a projection of it, so a reload
 * shows the same answer.
 */
export function ackForClaim(
  events: StatusEvent[] | null | undefined,
  claimNumber: string | null | undefined,
): ClaimAck | null {
  if (!claimNumber) return null;
  const responses = statusEventsFor(events, "claim", claimNumber).filter(
    (e) => e.reasonCode === "277CA_ACCEPTED" || e.reasonCode === "277CA_REJECTED",
  );
  const last = responses[responses.length - 1];
  if (!last) return null;

  const category: ClaimAckCategory = last.reasonCode === "277CA_ACCEPTED" ? "A1" : "A3";
  const entity = (last.refs?.ackEntity as ClaimAckEntity | undefined) ?? null;
  const ruleId = last.refs?.rejectionRuleId;
  const track: ClaimTrack = ruleId?.startsWith("DEN-") ? "dental" : "medical";
  const rejection = ruleId ? rejectionCasesFor(track).find((c) => c.id === ruleId) ?? null : null;
  const transmissions = statusEventsFor(events, "claim", claimNumber).filter(
    (e) => e.reasonCode === "SUBMITTED_837P",
  );

  return {
    claimNumber,
    category,
    batchControlNumber: transmissions[transmissions.length - 1]?.refs?.refNumber ?? "",
    responseControlNumber: last.refs?.refNumber ?? "",
    entity,
    rejection,
    reason: last.reason,
  };
}

/** True when the claim's last 277CA was a rejection — the biller's queue item. */
export function isRejected(ack: ClaimAck | null): boolean {
  return ack?.category === "A3";
}
