/**
 * One claim-number sequence for the whole student — medical and dental.
 *
 * Before 2026-11-21 the two tracks counted separately: the medical side minted
 * from its own encounters, and the dental side minted from a one-element array
 * (`nextClaimNumber([s.claimNumber])` on a record that had just been cleared),
 * so every dental case was `CLM-000001` and a dental claim and a medical claim
 * could carry the same number. A claim number is quoted on the printed paper,
 * in the 835/EFT control ids, in the AR item ids and in the status timeline, so
 * two claims sharing one number cannot be told apart.
 *
 * This module is the one counter. It keeps a high-water mark on the student's
 * own record (`claimSequence` in the per-phone blob, written by
 * `saveUserData`), and it never goes below any claim number already saved in
 * either track — so a number is never re-used, even when a dental case is
 * cleared (`beginCase`) and its claim number is no longer in memory.
 *
 * Inspiration: the claim-number counter a practice-management system keeps per
 * practice, shared by every claim it submits whatever the claim type.
 *
 * Nothing here invents a number for an existing claim: a legacy record that
 * already holds a number keeps it (`migrateDentalTrackState` carries it forward
 * unless it collides with a medical claim, and says so in the timeline).
 */
import { claimNumberSequence, mintClaimNumber } from "../domain/claimStatus";
import { getLoggedInPhone } from "./accessStore";
import { loadUserData, saveUserData, userDataKey } from "./persistence";

/** Where the dental track keeps its record. Declared here so the sequence can
 * read it without importing the dental store (which imports this module). */
export const DENTAL_TRACK_PREFIX = "hh_dental_track_";

/** The dental track's storage key for a student. */
export function dentalTrackStorageKey(phone: string): string {
  return `${DENTAL_TRACK_PREFIX}${phone}`;
}

const CLAIM_NUMBER_PATTERN = /^CLM-\d+$/;

function localStore(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function readStoredJson(key: string): unknown {
  const storage = localStore();
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

/**
 * Every claim number inside a saved record, whatever shape it has. Pure and
 * exported so the sequence's reading of a record can be tested without storage.
 *
 * It reads the `claimNumber` / `claimId` fields and any string that is itself a
 * claim number (status events and ledger ids quote it), and never counts
 * anything else.
 */
export function claimNumbersIn(value: unknown): string[] {
  const found = new Set<string>();
  const add = (candidate: unknown) => {
    if (typeof candidate !== "string") return;
    const trimmed = candidate.trim();
    if (CLAIM_NUMBER_PATTERN.test(trimmed)) found.add(trimmed);
  };
  const walk = (node: unknown) => {
    if (typeof node === "string") {
      add(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node && typeof node === "object") {
      for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
        if (key === "claimNumber" || key === "claimId") add(child);
        walk(child);
      }
    }
  };
  walk(value);
  return [...found];
}

/** Claim numbers saved in the medical track (the student's encounter blob). */
export function medicalClaimNumbers(phone: string | null = getLoggedInPhone()): string[] {
  if (!phone) return [];
  return claimNumbersIn(readStoredJson(userDataKey(phone)));
}

/** Claim numbers saved in the dental track. */
export function dentalClaimNumbers(phone: string | null = getLoggedInPhone()): string[] {
  if (!phone) return [];
  return claimNumbersIn(readStoredJson(dentalTrackStorageKey(phone)));
}

/** Every claim number this student already has, in either track. */
export function claimNumbersOnRecord(phone: string | null = getLoggedInPhone()): string[] {
  return [...new Set([...medicalClaimNumbers(phone), ...dentalClaimNumbers(phone)])];
}

/**
 * The highest sequence this student has already used: the saved mark, or any
 * claim number still on a record — whichever is higher.
 */
export function claimNumberHighWater(phone: string | null = getLoggedInPhone()): number {
  if (!phone) return 0;
  const mark = loadUserData(phone)?.claimSequence;
  const saved = Number.isFinite(mark) ? Math.floor(Number(mark)) : 0;
  return Math.max(0, saved, ...claimNumbersOnRecord(phone).map(claimNumberSequence));
}

/**
 * The next claim number for this student, shared by both tracks. The mark is
 * raised in the same call, so the number can never be minted twice — and it is
 * only ever raised, never lowered.
 */
export function mintNextClaimNumber(
  inMemory: (string | null | undefined)[] = [],
  phone: string | null = getLoggedInPhone(),
): string {
  const highest = Math.max(
    claimNumberHighWater(phone),
    ...inMemory.map((number) => claimNumberSequence(number)),
  );
  const sequence = highest + 1;
  if (phone && sequence > (loadUserData(phone)?.claimSequence ?? 0)) {
    saveUserData(phone, { claimSequence: sequence });
  }
  return mintClaimNumber(sequence);
}

/**
 * The number a legacy record is re-minted onto when it collides with a claim the
 * other track already holds. Pure — the caller writes the result — and always
 * above every number in play, so the re-mint cannot collide in turn.
 */
export function renumberedClaimNumber(
  taken: (string | null | undefined)[],
  own: string | null | undefined,
): string {
  const highest = Math.max(
    ...taken.map((number) => claimNumberSequence(number)),
    claimNumberSequence(own),
  );
  return mintClaimNumber(highest + 1);
}
