/**
 * Status events — the append-only timeline of every status change.
 *
 * Inspiration: Epic's "Encounter Activity" / claim audit trail and athenahealth's
 * claim-status history: one row per change, in the order it happened, naming who
 * did it and why. This is the record the domain model later adopts as the audit
 * log, so the shape is deliberately boring and complete.
 *
 * Two guarantees, both enforced here rather than in a component:
 *
 *  1. **Append only.** There is no update and no delete anywhere in this file.
 *     `appendStatusEvent` adds one entry and returns a new array; nothing else
 *     can touch what is already in it.
 *  2. **Idempotent.** An entry's `id` *is* its idempotency key, so a double-click,
 *     a re-render or a replayed action cannot add a second copy: appending a key
 *     that already exists returns the list unchanged and mutates nothing.
 *
 * Ordering is on `seq` (per entity, monotonic) — never on `at`, because two
 * changes in the same millisecond would otherwise sort arbitrarily.
 */

import type { ClaimStatus, EncounterStatus, JobRole, ReasonCode } from "./claimStatus";

/** Anything a status change can move between. */
export type Status = ClaimStatus | EncounterStatus;

export interface StatusEventRefs {
  carc?: string;
  rarc?: string;
  ruleId?: string;
  lineIndex?: number;
  eraId?: string;
  checkNumber?: string;
  appealId?: string;
  appealLevel?: 1 | 2;
  authNumber?: string;
  approvedBy?: string;
  correctedClaimId?: string;
  refNumber?: string;
  /**
   * 277CA claim status category (A1 accepted, A3 rejected) and entity code.
   * Read back by `domain/clearinghouse.ts` so the outcome panel is a projection
   * of the timeline rather than a second copy of the truth.
   */
  ackCategory?: "A1" | "A3";
  ackEntity?: string;
  /**
   * The rejection rule that fired. Deliberately *not* named `ruleId`: `ruleId`
   * is an idempotency discriminator, and the same rejection after a correction
   * is a new event, not a duplicate.
   */
  rejectionRuleId?: string;
}

/** One row of the timeline. Append-only: see the file header. */
export interface StatusEvent {
  /** = the idempotency key, so a repeat of the same transition is impossible. */
  id: string;
  entityType: "encounter" | "claim";
  entityId: string;
  /** Denormalised so every AR row can name its patient. */
  patientId: string | null;
  claimNumber?: string;
  /** Per entity, monotonic. Sort on this, never on `at`. */
  seq: number;
  /** One clock read per transition. */
  at: string;
  from: Status | null;
  to: Status;
  /** Student phone, or "system". */
  by: string;
  jobRole: JobRole;
  reasonCode: ReasonCode;
  /** One plain-English sentence, shown to the student and to the instructor. */
  reason: string;
  /** Copied from the ledger entry. The engine computes no money. */
  amountCents?: number;
  refs?: StatusEventRefs;
}

/** What a caller supplies — the engine fills `id`, `seq` and `at`. */
export type StatusEventInput = Omit<StatusEvent, "id" | "seq" | "at"> & {
  /** Override the clock read (migration replays the blob's own timestamp). */
  at?: string;
};

/**
 * The discriminator that makes a transition unique within its entity, per
 * `status-engine.md` §1: `ruleId` (edit checks), the ERA line (posting),
 * `appealId`+level (appeals), the corrected claim's number (corrections).
 */
function discriminatorFor(refs: StatusEventRefs | undefined): string {
  if (!refs) return "";
  if (refs.ruleId) return refs.ruleId;
  if (refs.eraId) return refs.eraId;
  if (refs.appealId) return `${refs.appealId}+${refs.appealLevel ?? 1}`;
  if (refs.correctedClaimId) return refs.correctedClaimId;
  if (refs.refNumber) return refs.refNumber;
  return "";
}

/**
 * `entityType:entityId:reasonCode:discriminator` — the same transition, recorded
 * twice, produces the same key.
 */
export function statusEventKey(input: {
  entityType: StatusEvent["entityType"];
  entityId: string;
  reasonCode: ReasonCode;
  refs?: StatusEventRefs;
}): string {
  return `${input.entityType}:${input.entityId}:${input.reasonCode}:${discriminatorFor(input.refs)}`;
}

/** The events recorded against one entity, oldest first (by `seq`). */
export function statusEventsFor(
  events: StatusEvent[] | null | undefined,
  entityType: StatusEvent["entityType"],
  entityId: string | null | undefined,
): StatusEvent[] {
  if (!events || !entityId) return [];
  return events
    .filter((e) => e.entityType === entityType && e.entityId === entityId)
    .sort((a, b) => a.seq - b.seq);
}

/** The entry with this key, or undefined. */
export function findStatusEvent(events: StatusEvent[] | null | undefined, key: string): StatusEvent | undefined {
  return (events ?? []).find((e) => e.id === key);
}

/** The next `seq` for an entity — one past the highest already recorded. */
export function nextStatusSeq(
  events: StatusEvent[] | null | undefined,
  entityType: StatusEvent["entityType"],
  entityId: string,
): number {
  const forEntity = statusEventsFor(events, entityType, entityId);
  return forEntity.reduce((max, e) => Math.max(max, e.seq), 0) + 1;
}

/**
 * Build the entry a transition records. One clock read, one key, one seq — all
 * derived from what the entity already holds, so the caller cannot get them
 * wrong.
 */
export function makeStatusEvent(input: StatusEventInput, existing: StatusEvent[] | null | undefined): StatusEvent {
  const id = statusEventKey(input);
  return {
    id,
    entityType: input.entityType,
    entityId: input.entityId,
    patientId: input.patientId ?? null,
    ...(input.claimNumber ? { claimNumber: input.claimNumber } : {}),
    seq: nextStatusSeq(existing, input.entityType, input.entityId),
    at: input.at ?? new Date().toISOString(),
    from: input.from ?? null,
    to: input.to,
    by: input.by,
    jobRole: input.jobRole,
    reasonCode: input.reasonCode,
    reason: input.reason,
    ...(input.amountCents !== undefined ? { amountCents: input.amountCents } : {}),
    ...(input.refs ? { refs: input.refs } : {}),
  };
}

/**
 * Append one entry. Returns the same array when its key is already present — the
 * "no duplicate item on double-click or re-render" guarantee. There is no
 * counterpart that edits or removes an entry, and none may be added.
 */
export function appendStatusEvent(events: StatusEvent[] | null | undefined, event: StatusEvent): StatusEvent[] {
  const list = events ?? [];
  if (findStatusEvent(list, event.id)) return list;
  return [...list, event];
}
