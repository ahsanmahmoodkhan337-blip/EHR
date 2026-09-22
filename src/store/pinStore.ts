/**
 * PIN Store — Stage-level access PIN management
 *
 * Each RCM stage (Scribe, Coder, Biller, Prior Auth, AR Voice)
 * requires a PIN to access. Default PINs are preset.
 * Admin can view and change PINs.
 *
 * Also tracks which stages have been unlocked by the student.
 * Stages start locked and must be unlocked with the correct PIN.
 * When a submission function auto-advances, the next stage remains
 * locked until the student enters its PIN.
 *
 * Stored in localStorage under `hh_stage_pins` and `hh_unlocked_stages`.
 */

import { type Role } from "./pipelineStore";

const PINS_KEY = "hh_stage_pins";
const UNLOCKED_KEY = "hh_unlocked_stages";

const DEFAULT_PINS: Record<Role, string> = {
  scribe: "1111",
  coder: "2222",
  biller: "3333",
  "prior-auth": "4444",
  "ar-voice": "5555",
};


export type StagePinMap = Record<Role, string>;

// ─── PIN Read / Write ──────────────────────────────────────────────

function getPinMap(): StagePinMap {
  try {
    const raw = localStorage.getItem(PINS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_PINS, ...parsed };
    }
  } catch {
    // fall through
  }
  return { ...DEFAULT_PINS };
}

function savePinMap(pins: StagePinMap): void {
  localStorage.setItem(PINS_KEY, JSON.stringify(pins));
}

// ─── Unlocked Stages Read / Write ──────────────────────────────────

function getUnlockedSet(): Set<Role> {
  try {
    const raw = localStorage.getItem(UNLOCKED_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as Role[];
      return new Set(arr);
    }
  } catch {
    // fall through
  }
  return new Set<Role>();
}

function saveUnlockedSet(stages: Set<Role>): void {
  localStorage.setItem(UNLOCKED_KEY, JSON.stringify([...stages]));
}

// ─── Public PIN API ────────────────────────────────────────────────

/** Get the PIN for a specific stage */
export function getStagePin(role: Role): string {
  return getPinMap()[role] ?? DEFAULT_PINS[role];
}

/** Validate a PIN for a given stage (also unlocks the stage on success) */
export function verifyStagePin(role: Role, pin: string): boolean {
  const valid = getStagePin(role) === pin;
  if (valid) {
    unlockStage(role);
  }
  return valid;
}

/** Update a PIN for a specific stage (admin only) */
export function setStagePin(role: Role, newPin: string): void {
  const pins = getPinMap();
  pins[role] = newPin;
  savePinMap(pins);
}

/** Reset all PINs to defaults */
export function resetAllPins(): void {
  savePinMap({ ...DEFAULT_PINS });
}

/** Get all PINs (admin view) */
export function getAllPins(): StagePinMap {
  return getPinMap();
}

// ─── Public Unlock API ─────────────────────────────────────────────

/** Get the set of unlocked stages */
export function getUnlockedStages(): Set<Role> {
  return getUnlockedSet();
}

/** Unlock a specific stage */
export function unlockStage(role: Role): void {
  const stages = getUnlockedSet();
  stages.add(role);
  saveUnlockedSet(stages);
}

/** Lock a specific stage */
export function lockStage(role: Role): void {
  const stages = getUnlockedSet();
  stages.delete(role);
  saveUnlockedSet(stages);
}

/** Check if a stage is unlocked */
export function isStageUnlocked(role: Role): boolean {
  return getUnlockedSet().has(role);
}

/** Check if a stage is "available" — meaning the previous stage has been submitted and it can be unlocked with a PIN */
export function canAccessStage(role: Role): boolean {
  return getUnlockedSet().has(role);
}

/** Lock all stages (reset for a new student) */
export function lockAllStages(): void {
  saveUnlockedSet(new Set<Role>());
}

/** Unlock the first stage (Scribe) — called when a student is approved */
export function unlockFirstStage(): void {
  unlockStage("scribe");
}