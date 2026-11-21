/**
 * inbasket.ts — the student's outstanding work, as the InBasket lists it
 *
 * Inspired by: Epic Hyperspace's InBasket, where every row is a real item the
 * clinician has to act on — a result to sign, a message to answer, an order to
 * cosign — and never a demo alert.
 *
 * The 19 November panel showed six invented alerts (Robert Johnson's "BNP: 850
 * pg/mL", a "2 min ago" that was a string) and a "Full InBasket coming soon"
 * box, while the same page's Work Queues counted the student's real work. This
 * module is the one place that turns the app's own records into inbox rows:
 *
 *   - claims awaiting a payer, ready to submit, or held      (`store.encounters`)
 *   - denials and patient balances from posted 835s           (`domain/arWorkQueue`)
 *   - a draft progress note with no NOTE_SIGNED event         (`domain/noteStatus`)
 *   - eligibility never checked on a patient with a payer     (`domain/eligibility`)
 *   - a copay collected at check-in and never posted          (`domain/checkIn`)
 *   - prior authorisations still open                         (`scopeRecordsToPatient`)
 *   - the dental track's own waiting claim, denials and case  (`domain/homeWorkQueues`)
 *
 * Pure: no React, no store, no clock. Every row's `at` is the timestamp the
 * record itself carries — an empty string when the record has none, so the
 * screen prints no time rather than inventing one. `priority` is derived from
 * the row's source and is never typed in by a caller.
 */

import { findCase } from "../data/dental";
import type { DentalTrackState } from "../components/dental/DentalTrackStore";
import { PA_STATUS_LABELS } from "../components/PriorAuthPortal/paData";
import {
  CLAIM_STATUS_LABELS,
  type ClaimHold,
  type ClaimStatus,
} from "./claimStatus";
import { postedCopayForPatient, type CopayAppointment } from "./checkIn";
import {
  ORPHAN_CLAIM_LABEL,
  isOrphanClaim,
  scopeRecordsToPatient,
} from "./dataScoping";
import { eligibilityOf, type EligibilityCoverage } from "./eligibility";
import {
  buildDentalQueueRows,
  formatWhen,
  isAwaitingPayer,
  isMidStage,
  isReadyToSubmit,
  usd,
  type QueueTarget,
} from "./homeWorkQueues";
import { isOwnPatient, TUTORIAL_PATIENT_ID } from "./inbox";
import { noteFieldsOf, noteStatus } from "./noteStatus";
import { statusEventsFor } from "./statusEvent";
import type { ArWorkItem } from "./arWorkQueue";
import type { PARecordStore } from "../store/pipelineStore";
import {
  restoredRoleFor,
  type PipelineEncounter,
  type Role,
} from "../store/pipelineEncounter";

/** What kind of work an inbox row is. Drives the icon and the wording. */
export type InboxKind =
  | "denial"
  | "balance"
  | "claim-awaiting"
  | "claim-ready"
  | "claim-hold"
  | "eligibility"
  | "copay"
  | "note-draft"
  | "mid-stage"
  | "prior-auth"
  | "dental";

/**
 * How far up the list a row belongs, from its source:
 * money already refused or owed, a hold and an unposted copay are `high`;
 * work that stops the money moving is `medium`; waiting and unfinished
 * encounters are `low`.
 */
export type InboxPriority = "high" | "medium" | "low";

export interface InboxItem {
  id: string;
  kind: InboxKind;
  /** What the row is about — the queue's own title for this kind of work. */
  title: string;
  /** The patient the work belongs to, from the patient record. */
  patient: string;
  /** The facts that put it here, read off the record. */
  detail: string;
  priority: InboxPriority;
  /**
   * ISO timestamp from the record this row was built from, or "" when the
   * record carries none. Never a relative time.
   */
  at: string;
  /** The existing route / stage that holds the work. */
  target: QueueTarget;
}

/** The fields the builder reads from a patient record. */
export interface InboxPatient {
  id: string;
  firstName: string;
  lastName: string;
  /** True on the built-in demo charts and the Tutorial Patient. */
  isSeed?: boolean;
  insuranceRecord?: { primary?: EligibilityCoverage | null } | null;
}

export interface InboxInput {
  encounters: PipelineEncounter[];
  arWorkItems: ArWorkItem[];
  paRecords: PARecordStore[];
  appointments: CopayAppointment[];
  patients: readonly InboxPatient[];
  dental?: DentalTrackState | null;
  /** Human label for a role, e.g. "Medical Biller". Defaults to the role id. */
  roleLabel?: (role: Role) => string;
}

/** PA statuses that are still waiting on somebody, and how urgent each is. */
const PA_OPEN: Record<string, InboxPriority> = {
  ordered: "low",
  submitted: "medium",
  "in-progress": "medium",
  pending: "medium",
  "info-required": "high",
  denied: "high",
  appeal: "high",
  "next-followup": "low",
};

/** The one number the tab badge and the panel's subtitle both print. */
export function inboxCount(items: readonly InboxItem[]): number {
  return items.length;
}

/** A row's time as the panel prints it, or "" when the record carries none. */
export function inboxWhen(item: InboxItem): string {
  return item.at ? formatWhen(item.at) : "";
}

/**
 * Every outstanding item, one row per piece of work, newest and most urgent
 * first. The same work never appears twice: an encounter's claim is either
 * awaiting a payer, ready to submit, held, in AR, or simply mid-stage — the
 * predicates in `homeWorkQueues` decide which, and each is asked once.
 */
export function buildInboxItems({
  encounters,
  arWorkItems,
  paRecords,
  appointments,
  patients,
  dental,
  roleLabel = (role) => role,
}: InboxInput): InboxItem[] {
  const items: InboxItem[] = [];
  const byId = new Map(patients.map((p) => [p.id, p]));

  /** The patient's name, the encounter's own label, or the orphan label. */
  const nameOf = (patientId: string | null | undefined, fallback?: string | null): string => {
    const patient = patientId ? byId.get(patientId) : undefined;
    if (patient) return `${patient.firstName} ${patient.lastName}`;
    return fallback?.trim() || "No patient attached";
  };

  /**
   * A demo chart's work is teaching practice, not the student's queue
   * (`specs/slice-inbox-patients.md`). A record with no patient at all is still
   * counted — it is labelled a demo orphan rather than hidden.
   */
  const own = (patientId: string | null | undefined): boolean => {
    if (!patientId) return true;
    const patient = byId.get(patientId);
    return patient ? isOwnPatient(patient) : true;
  };

  // ── The medical encounter store ──────────────────────────────────────
  for (const enc of encounters) {
    if (!own(enc.patientId)) continue;
    const who = isOrphanClaim(enc) ? ORPHAN_CLAIM_LABEL : nameOf(enc.patientId, enc.displayName);
    const timeline = enc.claimNumber
      ? statusEventsFor(enc.statusEvents, "claim", enc.claimNumber)
      : [];
    const lastClaimAt = timeline.length > 0 ? timeline[timeline.length - 1].at : "";

    if (enc.claimNumber && isAwaitingPayer(enc.claimStatus)) {
      items.push({
        id: `inbox-awaiting-${enc.claimNumber}`,
        kind: "claim-awaiting",
        title: "Claim awaiting a payer response",
        patient: who,
        detail: `${enc.claimNumber} · ${CLAIM_STATUS_LABELS[enc.claimStatus as ClaimStatus]} — no 835 has come back yet`,
        priority: "low",
        at: lastClaimAt,
        target: { kind: "medical", patientId: enc.patientId, role: "biller" },
      });
    }

    if (enc.claimNumber && isReadyToSubmit(enc.claimStatus)) {
      items.push({
        id: `inbox-ready-${enc.claimNumber}`,
        kind: "claim-ready",
        title: "Claim ready to submit",
        patient: who,
        detail: `${enc.claimNumber} · ${CLAIM_STATUS_LABELS[enc.claimStatus as ClaimStatus]} — not transmitted to the clearinghouse`,
        priority: "medium",
        at: lastClaimAt,
        target: { kind: "medical", patientId: enc.patientId, role: "biller" },
      });
    }

    for (const hold of enc.holds ?? []) {
      items.push(holdItem(hold, enc, who, nameOf));
    }

    // The Tutorial Patient is filled in by the app itself on first open, so its
    // note is not work the student did (`homeWorkQueues`, `isMidStage`).
    if (isMidStage(enc) && enc.patientId !== TUTORIAL_PATIENT_ID) {
      const role = restoredRoleFor(enc);
      const draft = noteStatus(enc) === "draft";
      const written = Object.values(noteFieldsOf(enc)).filter((text) => text.trim()).length;
      items.push({
        id: `inbox-${draft ? "note" : "mid"}-${enc.patientId ?? "unassigned"}`,
        kind: draft ? "note-draft" : "mid-stage",
        title: draft ? "Progress note not signed" : "Encounter left mid-stage",
        patient: who,
        detail: draft
          ? `${written} of 4 note sections written${enc.claimNumber ? ` · claim ${enc.claimNumber}` : " · no claim yet"} — sign and lock it to move on`
          : `Stopped at ${roleLabel(role)}${enc.claimNumber ? ` · claim ${enc.claimNumber}` : " · no claim yet"}`,
        priority: "low",
        at: enc.noteUpdatedAt ?? lastClaimAt,
        target: { kind: "medical", patientId: enc.patientId, role },
      });
    }
  }

  // ── Denials and patient balances, from posted 835s ───────────────────
  for (const item of arWorkItems) {
    if (item.status === "resolved") continue;
    if (!own(item.patientId)) continue;
    const denied = item.kind === "denial";
    items.push({
      id: `inbox-${item.id}`,
      kind: denied ? "denial" : "balance",
      title: denied ? "Denied line to work" : "Patient balance to work",
      patient: nameOf(item.patientId, item.patientName),
      detail: denied
        ? `${item.claimNumber} · ${item.group}-${item.carc} · line ${item.lineNumber ?? "—"}${
            item.cpt ? ` (${item.cpt})` : ""
          } · ${usd(item.amountCents)} · ${item.bucket}`
        : `${item.claimNumber} · patient owes ${usd(item.amountCents)} · ${item.bucket}`,
      priority: "high",
      at: item.datedAt,
      target: { kind: "medical", patientId: item.patientId, role: "ar-voice" },
    });
  }

  // ── Eligibility and prior authorisations, per patient ────────────────
  const withEncounter = new Set(encounters.map((enc) => enc.patientId));

  for (const patient of patients) {
    if (!isOwnPatient(patient)) continue;
    const who = `${patient.firstName} ${patient.lastName}`;
    const coverage = patient.insuranceRecord?.primary ?? null;
    const payer = (coverage?.payerName ?? "").trim();

    // A payer on file with no 270/271 run is front-desk work still to do. A
    // patient with no payer at all is self-pay, not an unchecked coverage.
    if (payer && withEncounter.has(patient.id) && eligibilityOf(coverage).status === "not-checked") {
      items.push({
        id: `inbox-eligibility-${patient.id}`,
        kind: "eligibility",
        title: "Eligibility not checked",
        patient: who,
        detail: `${payer} — run the 270/271 at Registration`,
        priority: "medium",
        at: "",
        target: { kind: "medical", patientId: patient.id, role: "scribe" },
      });
    }

    for (const pa of scopeRecordsToPatient(paRecords, patient.id)) {
      const priority = PA_OPEN[pa.status];
      if (!priority) continue; // approved, closed or completed: nothing waiting
      items.push({
        id: `inbox-pa-${pa.id}`,
        kind: "prior-auth",
        title: `Prior authorisation ${PA_STATUS_LABELS[pa.status]?.label ?? pa.status}`,
        patient: who,
        detail: `${pa.procedure} · ${pa.insuranceName}`,
        priority,
        at: pa.submittedAt,
        target: { kind: "medical", patientId: patient.id, role: "prior-auth" },
      });
    }
  }

  // ── A copay collected at check-in and never posted ───────────────────
  const seenCopay = new Set<string>();
  for (const appointment of appointments) {
    const patientId = appointment.patientId;
    if (!patientId || seenCopay.has(patientId)) continue;
    if (!own(patientId)) continue;
    const amount = appointment.copayUsd;
    if (!appointment.checkedInAt || typeof amount !== "number" || amount <= 0) continue;
    // The copay on this visit is posted when the appointment records the ledger
    // entry it wrote (`domain/checkIn`, `postedCopayForPatient`).
    const posted = postedCopayForPatient(appointments, patientId);
    if (posted && posted.appointmentId === appointment.id) continue;
    seenCopay.add(patientId);
    items.push({
      id: `inbox-copay-${appointment.id}`,
      kind: "copay",
      title: "Copay collected, not posted",
      patient: nameOf(patientId),
      detail: `${usd(Math.round(amount * 100))} taken at check-in — post it to the ledger`,
      priority: "high",
      at: appointment.checkedInAt,
      target: { kind: "medical", patientId, role: "biller" },
    });
  }

  // ── The dental track's own waiting work ──────────────────────────────
  if (dental) {
    const caseName = dental.caseId ? dentalCaseName(dental.caseId) : "No dental case open";
    const claimAt = dentalTimelineAt(dental);
    for (const row of buildDentalQueueRows(dental)) {
      // Only the rows about the claim carry the claim's own timestamp; a case
      // that is merely open has no time to print.
      const at = row.id.endsWith("-awaiting") || row.id.endsWith("-ar") ? claimAt : "";
      for (const entry of row.entries) {
        items.push({
          id: `inbox-${entry.id}`,
          kind: "dental",
          title: row.title,
          patient: caseName,
          detail: entry.detail,
          priority: row.id.endsWith("-ar")
            ? "high"
            : row.id.endsWith("-ready")
              ? "medium"
              : "low",
          at,
          target: entry.target,
        });
      }
    }
  }

  return sortItems(items);
}

/** A claim hold: blocking work for the job role that has to clear it. */
function holdItem(
  hold: ClaimHold,
  enc: PipelineEncounter,
  who: string,
  nameOf: (patientId: string | null | undefined, fallback?: string | null) => string,
): InboxItem {
  return {
    id: `inbox-hold-${enc.claimNumber ?? enc.patientId ?? "unassigned"}-${hold.kind}-${hold.key}`,
    kind: "claim-hold",
    title: hold.blocking ? "Claim on a blocking hold" : "Claim on hold",
    patient: who || nameOf(enc.patientId, enc.displayName),
    detail: `${hold.reason} · ${hold.key} · to clear: ${hold.clearedBy}`,
    priority: "high",
    at: hold.raisedAt,
    target: { kind: "medical", patientId: enc.patientId, role: "biller" },
  };
}

/** "DCASE-001 · Ada Lovelace", the way the dental queues name a case. */
function dentalCaseName(caseId: string): string {
  const activeCase = findCase(caseId);
  if (!activeCase) return caseId;
  return `${caseId} · ${activeCase.patient.firstName} ${activeCase.patient.lastName}`;
}

/** The dental claim's last recorded status change, or "". */
function dentalTimelineAt(dental: DentalTrackState): string {
  if (!dental.claimNumber) return "";
  const timeline = statusEventsFor(dental.statusEvents, "claim", dental.claimNumber);
  return timeline.length > 0 ? timeline[timeline.length - 1].at : "";
}

const PRIORITY_RANK: Record<InboxPriority, number> = { high: 0, medium: 1, low: 2 };

/** High first, then newest first, then by id so the order never flickers. */
function sortItems(items: InboxItem[]): InboxItem[] {
  return [...items].sort((a, b) => {
    const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (byPriority !== 0) return byPriority;
    if (a.at !== b.at) return a.at < b.at ? 1 : -1;
    return a.id.localeCompare(b.id);
  });
}
