/**
 * Claim and encounter status — the vocabulary of the status engine.
 *
 * Inspiration: Epic's claim status (Resolute Professional Billing) and
 * athenahealth's claim-status vocabulary, collapsed into the one closed set this
 * simulation teaches. Nothing here imports React, a store or a component: the
 * unions, the labels and the pure derivations are the single source of truth for
 * every screen that shows where an encounter or a claim stands.
 *
 * Rules this file exists to enforce (see `specs/status-engine.md` §2, §4, §8, §9):
 *  - a claim's status is never set by a button, only by a recorded transition;
 *  - a rejection is not a denial;
 *  - a claim with a patient balance can never be `closed`;
 *  - the engine computes no money — amounts are copied from the ledger.
 */

// ─── Who did it ────────────────────────────────────────────────────

/**
 * The roles a status change can be attributed to. `system` is for the engine
 * itself (migration, clocks); `payment-poster` is the one role the older
 * pipeline union never had.
 */
export type JobRole =
  | "front-desk"
  | "registration"
  | "scribe"
  | "coder"
  | "prior-auth"
  | "biller"
  | "payment-poster"
  | "ar-voice"
  | "instructor"
  | "admin"
  | "system";

export const JOB_ROLE_LABELS: Record<JobRole, string> = {
  "front-desk": "Front Desk",
  registration: "Registration",
  scribe: "Scribe / Provider",
  coder: "Medical Coder",
  "prior-auth": "Prior Authorization",
  biller: "Medical Biller",
  "payment-poster": "Payment Poster",
  "ar-voice": "AR Voice Specialist",
  instructor: "Instructor",
  admin: "Administrator",
  system: "System",
};

// ─── Claim states ──────────────────────────────────────────────────

/**
 * Where a claim stands. `draft → scrubbed → submitted → accepted →
 * adjudicated → paid | partially_paid | denied → patient_responsibility →
 * closed`, plus `rejected`, `appeal_pending`, `reprocessed` and the terminals
 * `written_off`, `voided`, `replaced`.
 *
 * - `rejected` — the clearinghouse or the payer refused the claim itself
 *   (999 reject / 277CA A3). **Not a denial**: nobody adjudicated it.
 * - `accepted` — 999 accepted *and* 277CA A1. Never reached by migration.
 */
export type ClaimStatus =
  | "draft"
  | "scrubbed"
  | "submitted"
  | "accepted"
  | "rejected"
  | "adjudicated"
  | "paid"
  | "partially_paid"
  | "denied"
  | "appeal_pending"
  | "reprocessed"
  | "patient_responsibility"
  | "closed"
  | "written_off"
  | "voided"
  | "replaced";

export const CLAIM_STATUSES: ClaimStatus[] = [
  "draft",
  "scrubbed",
  "submitted",
  "accepted",
  "rejected",
  "adjudicated",
  "paid",
  "partially_paid",
  "denied",
  "appeal_pending",
  "reprocessed",
  "patient_responsibility",
  "closed",
  "written_off",
  "voided",
  "replaced",
];

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  draft: "Draft",
  scrubbed: "Scrubbed — ready to submit",
  submitted: "Submitted",
  accepted: "Accepted by the payer",
  rejected: "Rejected",
  adjudicated: "Adjudicated",
  paid: "Paid in full",
  partially_paid: "Partially paid",
  denied: "Denied",
  appeal_pending: "Appeal pending",
  reprocessed: "Reprocessed",
  patient_responsibility: "Patient responsibility",
  closed: "Closed",
  written_off: "Written off",
  voided: "Voided",
  replaced: "Replaced",
};

/** One status colour, shared by every screen (design-token rule). */
export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

export const CLAIM_STATUS_TONE: Record<ClaimStatus, StatusTone> = {
  draft: "neutral",
  scrubbed: "info",
  submitted: "info",
  accepted: "success",
  rejected: "warning",
  adjudicated: "info",
  paid: "success",
  partially_paid: "warning",
  denied: "danger",
  appeal_pending: "warning",
  reprocessed: "info",
  patient_responsibility: "warning",
  closed: "success",
  written_off: "neutral",
  voided: "neutral",
  replaced: "neutral",
};

/** States a claim never leaves. */
export const TERMINAL_CLAIM_STATUSES: ClaimStatus[] = ["written_off", "voided", "replaced", "closed"];

export function isTerminalClaimStatus(status: ClaimStatus | null | undefined): boolean {
  return !!status && TERMINAL_CLAIM_STATUSES.includes(status);
}

/**
 * Holds are an **attribute**, not a state (deviation signed off by the lead,
 * `status-engine.md` §2): a state would replace the real status, so you could no
 * longer tell whether a held claim was `draft` or `scrubbed`. A blocking hold
 * keeps the claim out of Ready to Submit; the queue item says why and who clears
 * it. Phase A defines the shape only — nothing raises or clears a hold yet.
 */
export interface ClaimHold {
  kind: "auth" | "edit";
  /** The CPT that needs the auth, or the edit rule that failed. */
  key: string;
  reason: string;
  raisedAt: string;
  raisedBy: JobRole;
  /** Who has to clear it. */
  clearedBy: JobRole;
  blocking: boolean;
}

/** True when a hold keeps the claim out of Ready to Submit. */
export function hasBlockingHold(holds: ClaimHold[] | null | undefined): boolean {
  return (holds ?? []).some((h) => h.blocking);
}

/**
 * A claim with a patient balance can never be `closed` (§2). The engine takes
 * the balance from the ledger; it never computes it here.
 */
export function canCloseClaim(balance: { patientBalanceCents: number } | null | undefined): boolean {
  return !!balance && balance.patientBalanceCents === 0;
}

// ─── Encounter states ──────────────────────────────────────────────

/**
 * The encounter's own lifecycle (§4): `open → signed → coded → charged →
 * billed`. Every one of these is derived from the record — never from a stored
 * "done" flag and never from a checkbox.
 */
export type EncounterStatus = "open" | "signed" | "coded" | "charged" | "billed";

export const ENCOUNTER_STATUS_LABELS: Record<EncounterStatus, string> = {
  open: "Open",
  signed: "Signed",
  coded: "Coded",
  charged: "Charged",
  billed: "Billed",
};

/** What the encounter record holds, as far as status is concerned. */
export interface EncounterFacts {
  /** A signed, locked note exists (`signedBy` + `signedAt`, or `locked`). */
  signed: boolean;
  /** The diagnoses the coder assigned. */
  icdCodes: string[];
  /** The procedures the coder assigned. */
  cptCodes: string[];
  /** One charge per procedure — the thing that makes an encounter "charged". */
  charges: { cpt: string; chargeCents: number }[];
  /** The claim's status, or null when no claim exists yet. */
  claimStatus: ClaimStatus | null;
}

/** An ICD-10-CM code the coder could have assigned (shape check only). */
export function isCodeLikeIcd(code: string): boolean {
  return /^[A-TV-Z][0-9][0-9A-Z](\.[0-9A-Z]{1,4})?$/i.test((code ?? "").trim());
}

/** A CPT/HCPCS code the coder could have assigned (shape check only). */
export function isCodeLikeCpt(code: string): boolean {
  const value = (code ?? "").trim();
  return /^[0-9]{5}$/.test(value) || /^[0-9]{4}[A-Z]$/i.test(value) || /^[A-Z][0-9]{4}$/i.test(value);
}

/**
 * The encounter's status, read from its data (§4). `billed` comes only from the
 * claim having actually been submitted — never from a button.
 */
export function deriveEncounterStatus(facts: EncounterFacts): EncounterStatus {
  const icd = (facts.icdCodes ?? []).filter(isCodeLikeIcd);
  const cpt = (facts.cptCodes ?? []).filter(isCodeLikeCpt);
  const coded = icd.length > 0 && cpt.length > 0;
  const charged =
    coded && cpt.every((code) => (facts.charges ?? []).some((c) => c.cpt === code && c.chargeCents > 0));
  const submitted = !!facts.claimStatus && facts.claimStatus !== "draft";

  if (submitted) return "billed";
  if (charged) return "charged";
  if (coded) return "coded";
  if (facts.signed) return "signed";
  return "open";
}

// ─── Reason codes — the closed set a timeline entry carries ────────

export type ReasonCode =
  | "CLAIM_CREATED"
  | "SCRUB_PASS"
  | "SCRUB_FAIL"
  | "EDIT_HOLD_CLEARED"
  | "AUTH_HOLD_ADDED"
  | "AUTH_APPROVED"
  | "SUBMITTED_837P"
  | "277CA_ACCEPTED"
  | "277CA_REJECTED"
  | "ERA_POSTED"
  | "ERA_PAID_IN_FULL"
  | "ERA_PARTIAL"
  | "ERA_DENIED"
  | "TAKEBACK_POSTED"
  | "APPEAL_FILED"
  | "APPEAL_OVERTURNED"
  | "APPEAL_UPHELD"
  | "RETRO_AUTH_APPROVED"
  | "PATIENT_BALANCE_CREATED"
  | "PATIENT_PAID"
  | "WRITE_OFF_APPROVED"
  | "VOID_FILED"
  | "CORRECTED_CLAIM_FILED"
  | "REFUND_ISSUED"
  | "TRANSFER_SECONDARY"
  | "NOTE_SIGNED"
  | "EDITS_FAILED_BACK_TO_PROVIDER"
  | "MIGRATED";

/** Plain-English name for each reason code, shown beside the timeline entry. */
export const REASON_CODE_LABELS: Record<ReasonCode, string> = {
  CLAIM_CREATED: "Claim created",
  SCRUB_PASS: "Edit checks passed",
  SCRUB_FAIL: "Edit check failed",
  EDIT_HOLD_CLEARED: "Edit hold cleared",
  AUTH_HOLD_ADDED: "Auth hold added",
  AUTH_APPROVED: "Authorization approved",
  SUBMITTED_837P: "837P submitted",
  "277CA_ACCEPTED": "277CA accepted",
  "277CA_REJECTED": "277CA rejected",
  ERA_POSTED: "835 posted",
  ERA_PAID_IN_FULL: "Paid in full",
  ERA_PARTIAL: "Partial payment",
  ERA_DENIED: "Denied",
  TAKEBACK_POSTED: "Takeback posted",
  APPEAL_FILED: "Appeal filed",
  APPEAL_OVERTURNED: "Appeal overturned",
  APPEAL_UPHELD: "Appeal upheld",
  RETRO_AUTH_APPROVED: "Retro authorization approved",
  PATIENT_BALANCE_CREATED: "Patient balance created",
  PATIENT_PAID: "Patient paid",
  WRITE_OFF_APPROVED: "Write-off approved",
  VOID_FILED: "Void filed",
  CORRECTED_CLAIM_FILED: "Corrected claim filed",
  REFUND_ISSUED: "Refund issued",
  TRANSFER_SECONDARY: "Transferred to secondary",
  NOTE_SIGNED: "Note signed and locked",
  EDITS_FAILED_BACK_TO_PROVIDER: "Sent back to the provider",
  MIGRATED: "Migrated from an earlier saved record",
};

// ─── Claim numbers ─────────────────────────────────────────────────

/**
 * The old `PipelineStatus` vocabulary this engine replaces. It is kept here only
 * so the v3 → v4 migration can name what it is reading — nothing else may use it.
 */
export type LegacyPipelineStatus =
  | "pending"
  | "charted"
  | "coded"
  | "billed"
  | "paid"
  | "denied"
  | "reprocessed";

/**
 * What the old status meant for the claim, per `status-engine.md` §8:
 * `pending`/`charted`/`coded` → no claim at all; `billed` → **submitted** (never
 * `accepted` — no 277CA ever happened); `denied` → denied; `paid` → paid with no
 * amount (invent no money); `reprocessed` → reprocessed.
 *
 * Returns null when the old status says there was no claim.
 */
export function claimStatusFromLegacy(legacy: LegacyPipelineStatus | undefined | null): ClaimStatus | null {
  switch (legacy) {
    case "billed":
      return "submitted";
    case "denied":
      return "denied";
    case "paid":
      return "paid";
    case "reprocessed":
      return "reprocessed";
    default:
      return null;
  }
}

const CLAIM_NUMBER_PREFIX = "CLM-";

/** A claim number from a sequence: `CLM-000001`. Deterministic, never random. */
export function mintClaimNumber(sequence: number): string {
  const safe = Number.isFinite(sequence) && sequence > 0 ? Math.floor(sequence) : 1;
  return `${CLAIM_NUMBER_PREFIX}${String(safe).padStart(6, "0")}`;
}

/** The sequence inside a claim number, or 0 when it is not one of ours. */
export function claimNumberSequence(claimNumber: string | null | undefined): number {
  if (!claimNumber) return 0;
  const match = /^CLM-(\d+)$/.exec(claimNumber.trim());
  return match ? Number(match[1]) : 0;
}

/**
 * The next claim number for a set of existing ones. Claim numbers must never be
 * reused, so the next number is one past the highest already minted.
 */
export function nextClaimNumber(existing: (string | null | undefined)[]): string {
  const highest = (existing ?? []).reduce((max, n) => Math.max(max, claimNumberSequence(n)), 0);
  return mintClaimNumber(highest + 1);
}
