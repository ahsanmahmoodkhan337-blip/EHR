/**
 * liveTracker — where this encounter is on its way to "paid and closed", read
 * from what the student has actually done.
 *
 * Every milestone is derived from a record that already exists — the
 * appointment's status, the 271 on the coverage, the note's signature, the
 * coded lines, and the status events the claim engine appends (837P, 277CA,
 * 835, posting, appeals, write-offs). Nothing is estimated: a milestone the
 * record cannot show is simply not reached yet.
 *
 * Pure: no store, no clock, no React. The LiveTracker strip draws this, and
 * the "what just happened" card explains the newest event.
 */

import type { StatusEvent } from "./statusEvent";
import type { LedgerEntry } from "./ledger";
import { ledgerBalance } from "./ledger";
import { isRoutineAdjustmentCode } from "./arWorkQueue";

export type MilestoneId =
  | "checked-in"
  | "eligibility"
  | "signed"
  | "coded"
  | "sent"
  | "accepted"
  | "remit"
  | "posted"
  | "closed";

export type MilestoneState = "done" | "current" | "todo" | "problem";

export interface Milestone {
  id: MilestoneId;
  label: string;
  state: MilestoneState;
  /** ISO time it was reached, when the record carries one. */
  at?: string;
  /** Why it is a problem, in one line (a rejected 277CA, an inactive 271). */
  note?: string;
}

export interface LiveTrackerInput {
  /** The visit's appointment status, if the visit was booked. */
  appointmentStatus?: string | null;
  /** The 271 on the primary coverage. */
  eligibility?: { status?: string; checkedAt?: string } | null;
  /** When the note was signed, if it has been. */
  signedAt?: string | null;
  /** The CPT codes the coder submitted. */
  cptCodes: string[];
  /** Every status event for this encounter and its claim. */
  events: StatusEvent[];
  ledger: LedgerEntry[];
  /** Open (not resolved) AR work items for this claim. */
  openArItems: number;
}

const LABELS: Record<MilestoneId, string> = {
  "checked-in": "Checked in",
  eligibility: "Eligibility",
  signed: "Note signed",
  coded: "Coded",
  sent: "837P sent",
  accepted: "277CA",
  remit: "835 received",
  posted: "Posted",
  closed: "Closed",
};

const lastOf = (events: StatusEvent[], codes: string[]) =>
  [...events].filter((e) => codes.includes(e.reasonCode)).sort((a, b) => a.seq - b.seq).pop();

/** What to do to reach each milestone — the button names as they appear on screen. */
export const MILESTONE_NEXT_STEP: Record<MilestoneId, string> = {
  "checked-in": "Check the patient in from the Schedule (Check In on the appointment).",
  eligibility: "On Registration, press Verify eligibility (270) and read the 271.",
  signed: "Finish the note, then Sign & Lock Note.",
  coded: "On Coding, add the codes and press Submit Coded Encounter to Billing.",
  sent: "On Billing / Claim, clear the edit checks and press Submit.",
  accepted: "Waiting for the clearinghouse's 277CA acknowledgement.",
  remit: "On Payments (835), press Adjudicate this claim.",
  posted: "Press Post this 835 to the ledger.",
  closed: "Work what is left in Denials & AR: bill the patient balance or fix the denial.",
};

export function liveMilestones(input: LiveTrackerInput): Milestone[] {
  const ev = input.events;
  const reached: Partial<Record<MilestoneId, { at?: string; problem?: string }>> = {};

  if (input.appointmentStatus && ["arrived", "in-progress", "completed"].includes(input.appointmentStatus)) {
    reached["checked-in"] = {};
  }
  const elig = input.eligibility;
  if (elig?.status === "active") reached.eligibility = { at: elig.checkedAt };
  else if (elig?.status === "inactive") reached.eligibility = { at: elig.checkedAt, problem: "The 271 says the coverage is not active." };

  const signed = input.signedAt ?? lastOf(ev, ["NOTE_SIGNED"])?.at;
  if (signed) reached.signed = { at: signed };
  if (input.cptCodes.length > 0) reached.coded = {};

  const sent = lastOf(ev, ["SUBMITTED_837P"]);
  if (sent) reached.sent = { at: sent.at };
  const ack = lastOf(ev, ["277CA_ACCEPTED", "277CA_REJECTED"]);
  if (ack) {
    reached.accepted =
      ack.reasonCode === "277CA_REJECTED"
        ? { at: ack.at, problem: "The clearinghouse rejected the claim — fix it and send it again." }
        : { at: ack.at };
  }
  const remit = lastOf(ev, ["ERA_RECEIVED"]);
  if (remit) reached.remit = { at: remit.at };
  const posted = lastOf(ev, ["ERA_POSTED", "ERA_PAID_IN_FULL", "ERA_PARTIAL", "ERA_DENIED"]);
  if (posted || input.ledger.some((e) => e.type === "insurance_payment" || e.type === "adjustment")) {
    reached.posted = { at: posted?.at };
  }
  if (reached.posted) {
    const balance = ledgerBalance(input.ledger).patientBalanceCents;
    if (balance <= 0 && input.openArItems === 0) {
      reached.closed = { at: lastOf(ev, ["PATIENT_PAID", "WRITE_OFF_APPROVED", "ERA_POSTED"])?.at };
    }
  }

  const order: MilestoneId[] = ["checked-in", "eligibility", "signed", "coded", "sent", "accepted", "remit", "posted", "closed"];
  let currentAssigned = false;
  return order.map((id) => {
    const r = reached[id];
    if (r?.problem) return { id, label: LABELS[id], state: "problem" as const, at: r.at, note: r.problem };
    if (r) return { id, label: LABELS[id], state: "done" as const, at: r.at };
    if (!currentAssigned) {
      currentAssigned = true;
      return { id, label: LABELS[id], state: "current" as const };
    }
    return { id, label: LABELS[id], state: "todo" as const };
  });
}

export interface LiveMoney {
  billedCents: number;
  allowedCents: number | null;
  /** Null until a remittance is posted — nothing has been paid or adjusted yet. */
  paidCents: number | null;
  /** Contractual and other routine write-offs only. */
  adjustedCents: number | null;
  /**
   * Refused by the payer on the 835 (CO-31, CO-197, CO-16…). A denial is not a
   * write-off: the money is being worked in Denials & AR. Zero when none.
   */
  deniedCents: number;
  patientOwesCents: number | null;
}

/**
 * The money as it stands: billed from the claim lines until a charge is
 * posted, allowed from the 835 once it arrives, the rest from the ledger. The
 * same figures the ledger shows — nothing is computed here that the ledger
 * does not already hold.
 */
export function liveMoney(input: {
  ledger: LedgerEntry[];
  claimChargeCents: number;
  remitAllowedCents?: number | null;
}): LiveMoney {
  const b = ledgerBalance(input.ledger);
  const posted = b.chargesCents > 0;
  // Adjustments posted from an 835 under a denial code; AR write-offs carry no
  // ERA id and stay in Adjusted.
  const deniedCents = input.ledger
    .filter((e) => e.type === "adjustment" && e.eraId && !isRoutineAdjustmentCode(e.code))
    .reduce((sum, e) => sum - e.amountCents, 0);
  return {
    billedCents: posted ? b.chargesCents : input.claimChargeCents,
    allowedCents: input.remitAllowedCents ?? null,
    paidCents: posted ? b.insurancePaidCents + b.patientPaidCents : null,
    adjustedCents: posted ? b.adjustmentsCents - deniedCents : null,
    deniedCents: Math.max(0, deniedCents),
    patientOwesCents: posted ? b.patientBalanceCents : null,
  };
}
