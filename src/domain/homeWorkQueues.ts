/**
 * homeWorkQueues.ts — the pure builders behind Home's work queues
 *
 * Inspired by: Epic's "My Workqueue" worklist and athenahealth's Anytime
 * worklists — the counts a biller opens first. This module holds the counting
 * rules only: no React, no store, no DOM, so every rule below can be tested
 * directly (see `tests/home-work-queues.test.ts`).
 *
 * The one rule that matters most: **one piece of work lands in exactly one
 * queue.** A claim awaiting a payer response, a claim ready to submit and a
 * claim with posted money back (AR) each belong to their own queue and never to
 * "Encounters left mid-stage" — on the medical side and on the dental side
 * alike. `isMidStage` and `isDentalMidStage` are the guards that keep it true,
 * and each mirrors the other.
 */

import { findCase } from "../data/dental";
import { adjudicateDentalClaim } from "../components/dental/adjudication";
import type { DentalTrackState } from "../components/dental/DentalTrackStore";
import {
  CLAIM_STATUS_LABELS,
  isTerminalClaimStatus,
  type ClaimStatus,
} from "./claimStatus";
import { statusEventsFor } from "./statusEvent";
import type { ArWorkItem } from "./arWorkQueue";
import {
  encounterHasWork,
  restoredRoleFor,
  type PipelineEncounter,
  type Role,
} from "../store/pipelineEncounter";

/** Where one queue entry's work lives. */
export type QueueTarget =
  | { kind: "medical"; patientId: string | null; role: Role }
  | { kind: "dental"; caseId: string; stage: string }
  | { kind: "dental-picker" };

export interface QueueEntry {
  id: string;
  /** The claim number and the patient — what the row is about. */
  label: string;
  /** The facts that put it in this queue. */
  detail: string;
  target: QueueTarget;
}

export interface QueueRow {
  id: string;
  title: string;
  /** What the student would do here, said once. */
  purpose: string;
  /** The next step when this queue is empty. */
  emptyNextStep: string;
  entries: QueueEntry[];
}

/** Cents to dollars, for a figure that came out of the ledger or an 835. */
export function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** "12 Nov 14:32" — the time a recorded status change happened. */
export function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "an unrecorded time";
  return d.toLocaleString([], { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" });
}

/** A claim status that means "with the payer, no 835 back yet". */
export function isAwaitingPayer(status: ClaimStatus | null): boolean {
  return status === "submitted" || status === "accepted";
}

/** A claim that exists and has not been transmitted, or was sent back to fix. */
export function isReadyToSubmit(status: ClaimStatus | null): boolean {
  return status === "draft" || status === "scrubbed" || status === "rejected";
}

/**
 * A medical encounter the money cycle has not put in another queue. Once a 835
 * is posted the claim belongs to the AR queue, and while it is waiting on a
 * payer or ready to submit it belongs to that queue — so no claim is ever
 * counted twice.
 */
export function isMidStage(enc: PipelineEncounter): boolean {
  if (!encounterHasWork(enc)) return false;
  if (enc.stage === "complete") return false;
  if (isTerminalClaimStatus(enc.claimStatus)) return false;
  // Belongs to "Claims awaiting a payer response" or "Claims ready to submit".
  if (enc.claimStatus && (isAwaitingPayer(enc.claimStatus) || isReadyToSubmit(enc.claimStatus))) {
    return false;
  }
  return !enc.claimStatus;
}

/**
 * The dental mirror of `isMidStage`: a case whose claim is awaiting a payer, or
 * whose coded lines are waiting to be transmitted, belongs to that queue only.
 * A debriefed case is finished and counts nowhere.
 */
export function isDentalMidStage(dental: DentalTrackState): boolean {
  if (dental.completedAt !== null) return false;
  if (dental.stage === "case-select" || dental.stage === "debrief") return false;
  if (dental.claimNumber && isAwaitingPayer(dental.claimStatus)) return false;
  if (dental.lines.length > 0 && !dental.claimSubmitted) return false;
  return true;
}

export interface MedicalQueueInput {
  encounters: PipelineEncounter[];
  arWorkItems: ArWorkItem[];
  /** Patient name for an id, falling back to the encounter's own label. */
  nameForPatient: (patientId: string | null | undefined, fallback?: string | null) => string;
  /** Human label for a role, e.g. "Medical Biller". */
  roleLabel: (role: Role) => string;
}

export function buildMedicalQueueRows({
  encounters,
  arWorkItems,
  nameForPatient,
  roleLabel,
}: MedicalQueueInput): QueueRow[] {
  const awaiting: QueueEntry[] = [];
  const ready: QueueEntry[] = [];
  const mid: QueueEntry[] = [];

  for (const enc of encounters) {
    const who = nameForPatient(enc.patientId, enc.displayName);

    if (enc.claimNumber && isAwaitingPayer(enc.claimStatus)) {
      const timeline = statusEventsFor(enc.statusEvents, "claim", enc.claimNumber);
      const last = timeline[timeline.length - 1];
      awaiting.push({
        id: `awaiting-${enc.claimNumber}`,
        label: `${enc.claimNumber} · ${who}`,
        detail: `${CLAIM_STATUS_LABELS[enc.claimStatus as ClaimStatus]}${
          last ? ` since ${formatWhen(last.at)}` : ""
        } — no 835 has come back yet`,
        target: { kind: "medical", patientId: enc.patientId, role: "biller" },
      });
    }

    if (enc.claimNumber && isReadyToSubmit(enc.claimStatus)) {
      ready.push({
        id: `ready-${enc.claimNumber}`,
        label: `${enc.claimNumber} · ${who}`,
        detail: `${CLAIM_STATUS_LABELS[enc.claimStatus as ClaimStatus]} — not transmitted to the clearinghouse`,
        target: { kind: "medical", patientId: enc.patientId, role: "biller" },
      });
    }

    // The tutorial patient is filled in by the app itself on first open, so its
    // note is not work the student did. Everything the student *does* to it — a
    // claim, an 835, AR — still counts, in the queues above.
    if (isMidStage(enc) && enc.patientId !== "DEMO") {
      const role = restoredRoleFor(enc);
      mid.push({
        id: `mid-${enc.patientId ?? "unassigned"}`,
        label: who,
        detail: `Stopped at ${roleLabel(role)}${enc.claimNumber ? ` · claim ${enc.claimNumber}` : " · no claim yet"}`,
        target: { kind: "medical", patientId: enc.patientId, role },
      });
    }
  }

  // One item per unpaid or denied line of a posted 835 (`domain/arWorkQueue`).
  const ar: QueueEntry[] = arWorkItems
    .filter((item) => item.status !== "resolved")
    .map((item) => ({
      id: item.id,
      label: `${item.claimNumber} · ${nameForPatient(item.patientId, item.patientName)}`,
      detail:
        item.kind === "denial"
          ? `${item.group}-${item.carc} · line ${item.lineNumber}${item.cpt ? ` (${item.cpt})` : ""} · ${usd(
              item.amountCents,
            )} · ${item.ageDays} days old · ${item.bucket}`
          : `Patient balance ${usd(item.amountCents)} · ${item.ageDays} days old · ${item.bucket}`,
      target: { kind: "medical", patientId: item.patientId, role: "ar-voice" },
    }));

  return [
    {
      id: "medical-awaiting",
      title: "Claims awaiting a payer response",
      purpose: "Sent, with no 277CA outcome or 835 back yet.",
      emptyNextStep: "submit a claim from the Biller stage and it will wait here for the payer.",
      entries: awaiting,
    },
    {
      id: "medical-ar",
      title: "Denials and AR items to work",
      purpose: "Unpaid or denied lines of a posted 835, oldest first.",
      emptyNextStep: "post an 835 from the Biller stage — only posted money can create AR work.",
      entries: ar,
    },
    {
      id: "medical-ready",
      title: "Claims ready to submit",
      purpose: "Draft, scrubbed or rejected claims with no transmission yet.",
      emptyNextStep: "open the Biller stage and scrub a claim to move it here.",
      entries: ready,
    },
    {
      id: "medical-mid",
      title: "Encounters left mid-stage",
      purpose: "Work captured, no payer money back, not finished.",
      emptyNextStep: "open a patient and sign a note to start an encounter.",
      entries: mid,
    },
  ];
}

/** The dental track's four rows, from the saved dental record and nothing else. */
export function buildDentalQueueRows(dental: DentalTrackState): QueueRow[] {
  const activeCase = dental.caseId ? findCase(dental.caseId) : undefined;
  const caseName = activeCase
    ? `${dental.caseId} · ${activeCase.patient.firstName} ${activeCase.patient.lastName}`
    : "No dental case open";

  const awaiting: QueueEntry[] = [];
  const denials: QueueEntry[] = [];
  const ready: QueueEntry[] = [];
  const mid: QueueEntry[] = [];

  // A debriefed case is finished: its claim, its denials and its stage are the
  // student's record of work already done, so nothing on it is still waiting.
  const finished = dental.completedAt !== null || dental.stage === "debrief";

  if (!finished && dental.caseId && dental.claimNumber && isAwaitingPayer(dental.claimStatus)) {
    const timeline = statusEventsFor(dental.statusEvents, "claim", dental.claimNumber);
    const last = timeline[timeline.length - 1];
    awaiting.push({
      id: `dental-awaiting-${dental.claimNumber}`,
      label: `${dental.claimNumber} · ${caseName}`,
      detail: `${CLAIM_STATUS_LABELS[dental.claimStatus as ClaimStatus]}${
        last ? ` since ${formatWhen(last.at)}` : ""
      } — no 835 has come back yet`,
      target: { kind: "dental", caseId: dental.caseId, stage: "claims" },
    });
  }

  // Only a transmitted claim can have denied lines; the denial list comes from
  // the same adjudication the dental AR screen renders.
  if (!finished && dental.caseId && dental.claimSubmitted && activeCase) {
    const adjudication = adjudicateDentalClaim(dental.lines, activeCase);
    for (const line of adjudication.lines) {
      if (!line.denial) continue; // a downgrade is covered, never a denial
      if (dental.lineResolutions[line.lineId]) continue; // already decided
      denials.push({
        id: `dental-denial-${line.lineId}`,
        label: `${line.code} · ${caseName}`,
        detail: `${line.denial.id} — ${line.denial.title} · ${usd(Math.round(line.result.patientOwesUsd * 100))} patient share`,
        target: { kind: "dental", caseId: dental.caseId, stage: "ar" },
      });
    }
  }

  if (!finished && dental.caseId && dental.lines.length > 0 && !dental.claimSubmitted) {
    ready.push({
      id: "dental-ready",
      label: `${caseName}`,
      detail: `${dental.lines.length} claim line${dental.lines.length === 1 ? "" : "s"} coded, not transmitted`,
      target: { kind: "dental", caseId: dental.caseId, stage: "claim" },
    });
  }

  if (dental.caseId && isDentalMidStage(dental)) {
    mid.push({
      id: `dental-mid-${dental.caseId}`,
      label: caseName,
      detail: `Stopped at the ${dental.stage} stage · furthest reached: ${dental.furthestStage}`,
      target: { kind: "dental", caseId: dental.caseId, stage: dental.stage },
    });
  }

  return [
    {
      id: "dental-awaiting",
      title: "Claims awaiting a payer response",
      purpose: "Sent, with no 277CA outcome or 835 back yet.",
      emptyNextStep: "transmit an ADA claim from the dental claim stage.",
      entries: awaiting,
    },
    {
      id: "dental-ar",
      title: "Denials and AR items to work",
      purpose: "Denied lines of this case's claim with no decision yet.",
      emptyNextStep: "transmit a dental claim — its denied lines appear here.",
      entries: denials,
    },
    {
      id: "dental-ready",
      title: "Claims ready to submit",
      purpose: "Coded lines on a claim that has not been transmitted.",
      emptyNextStep: "code a treatment plan in the dental track to build a claim.",
      entries: ready,
    },
    {
      id: "dental-mid",
      title: "Encounters left mid-stage",
      purpose: "A dental case opened and not yet debriefed.",
      emptyNextStep: "start a dental case from the case picker.",
      entries: mid,
    },
  ];
}
