/**
 * Scores, streak, challenges and the command palette belong to the student, not
 * the device — the guardrail for `specs/scores-per-student.md`.
 *
 * On a shared classroom machine one student used to see another's scores and
 * inherit their note draft, because `hh_scores`, `hh_streak`, `hh_challenges`
 * and `ehr-store` were one device-wide copy. These four cases pin the new rule:
 *
 *   1. old device-wide value present, own key absent → adopted once, never twice;
 *   2. own key present, old value also present → own key wins, old value ignored;
 *   3. two phones in one browser → each reads only its own scores and streak;
 *   4. the palette store never carries one phone's role or note to another.
 *
 * The phone is the string the student typed (`hh_logged_in_phone`), never
 * normalised — case 3 also proves `03001234567` and `+923001234567` stay two
 * separate students.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  adoptLegacyScores,
  getLeaderboard,
  loadChallengeState,
  loadScores,
  loadStreak,
  saveChallengeState,
  saveScores,
  saveStreak,
  updateStageScore,
} from "../src/utils/scoring";
import { resetPaletteStore, useAppStore } from "../src/stores/appStore";

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

const PHONE_A = "03001234567";
const PHONE_B = "+923001234567";

const LEGACY = [
  {
    studentName: "Ayesha",
    totalScore: 42,
    stageScores: {
      registration: 10,
      eligibility: 10,
      scribe: 22,
      coder: 0,
      priorAuth: 0,
      biller: 0,
      arVoice: 0,
    },
    stagesCompleted: ["registration", "eligibility", "scribe"],
    timestamp: "2026-11-01T09:00:00.000Z",
  },
];

const originalLocalStorage = (globalThis as { localStorage?: unknown }).localStorage;

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  if (originalLocalStorage === undefined) {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  } else {
    Object.defineProperty(globalThis, "localStorage", {
      value: originalLocalStorage,
      configurable: true,
      writable: true,
    });
  }
});

function storage(): MemoryStorage {
  return globalThis.localStorage as unknown as MemoryStorage;
}

/** Sign in as `phone` the way `setLoggedInPhone()` does: the string as typed. */
function signIn(phone: string): void {
  storage().setItem("hh_logged_in_phone", phone);
}

function signOut(): void {
  storage().removeItem("hh_logged_in_phone");
}

describe("scores belong to the student", () => {
  test("old device-wide value, own key absent — adopted once, never twice", () => {
    storage().setItem("hh_scores", JSON.stringify(LEGACY));
    signIn(PHONE_A);

    // First load: the old value is copied into this student's key.
    expect(loadScores()).toHaveLength(1);
    expect(loadScores()[0]?.studentName).toBe("Ayesha");
    expect(storage().getItem(`hh_scores_${PHONE_A}`)).toBe(JSON.stringify(LEGACY));
    // The old value is left where it is — a second student can still adopt it.
    expect(storage().getItem("hh_scores")).toBe(JSON.stringify(LEGACY));

    // Second load: nothing is duplicated, and nothing is re-adopted.
    expect(loadScores()).toHaveLength(1);
    expect(adoptLegacyScores()).toBe(false);

    // A score earned now lands on the student's own key, once.
    updateStageScore("Ayesha", "biller", 15);
    expect(loadScores()).toHaveLength(1);
    expect(loadScores()[0]?.stageScores.biller).toBe(15);
    expect(loadScores()[0]?.totalScore).toBe(57);

    // Even after a reset deletes this student's scores, the old device-wide
    // value is not adopted back: adoption happens once per phone, ever.
    storage().removeItem(`hh_scores_${PHONE_A}`);
    expect(loadScores()).toEqual([]);
    expect(storage().getItem(`hh_scores_${PHONE_A}`)).toBeNull();
  });

  test("own key present and old value present — the own key wins", () => {
    const own = [{ ...LEGACY[0], studentName: "Ayesha", totalScore: 5 }];
    storage().setItem("hh_scores", JSON.stringify(LEGACY));
    storage().setItem(`hh_scores_${PHONE_A}`, JSON.stringify(own));
    signIn(PHONE_A);

    expect(adoptLegacyScores()).toBe(false);
    const scores = loadScores();
    expect(scores).toHaveLength(1);
    expect(scores[0]?.totalScore).toBe(5);
    // The old value is ignored, not overwritten and not deleted.
    expect(storage().getItem("hh_scores")).toBe(JSON.stringify(LEGACY));
  });

  test("two phones in one browser — each sees only its own scores and streak", () => {
    signIn(PHONE_A);
    saveScores([{ ...LEGACY[0], studentName: "Ayesha", totalScore: 30 }]);
    saveStreak(4);
    saveChallengeState({ "clean-claims": true });

    signIn(PHONE_B);
    // A different student: an empty history, not the previous student's.
    expect(loadScores()).toEqual([]);
    expect(getLeaderboard()).toEqual([]);
    expect(loadStreak()).toBe(0);
    expect(loadChallengeState()).toEqual({});

    saveScores([{ ...LEGACY[0], studentName: "Bilal", totalScore: 12 }]);
    saveStreak(1);

    // Each phone reads back its own numbers, keyed exactly as typed.
    expect(loadScores(PHONE_A)[0]?.totalScore).toBe(30);
    expect(loadScores(PHONE_A)[0]?.studentName).toBe("Ayesha");
    expect(loadStreak(PHONE_A)).toBe(4);
    expect(loadChallengeState(PHONE_A)).toEqual({ "clean-claims": true });
    expect(loadScores(PHONE_B)[0]?.totalScore).toBe(12);
    expect(loadStreak(PHONE_B)).toBe(1);

    // Signed out reads nothing at all — no device-wide fallback exists.
    signOut();
    expect(loadScores()).toEqual([]);
    expect(loadStreak()).toBe(0);
    expect(loadChallengeState()).toEqual({});
    // ...and writes nothing.
    saveScores([{ ...LEGACY[0], studentName: "Nobody", totalScore: 99 }]);
    expect(storage().getItem("hh_scores")).toBeNull();
    expect(storage().getItem(`hh_scores_${PHONE_A}`)).toBe(
      JSON.stringify([{ ...LEGACY[0], studentName: "Ayesha", totalScore: 30 }]),
    );
  });
});

describe("the command-palette store is keyed by the student", () => {
  test("one phone's role and note never reach the next phone", async () => {
    signIn(PHONE_A);

    useAppStore.getState().setRole("coder");
    useAppStore.getState().setSoapNote({ subjective: "Ayesha's private note" });
    useAppStore.getState().setStage("coding");

    // The store persists under the phone's key, not "ehr-store".
    expect(storage().getItem("ehr-store")).toBeNull();
    expect(storage().getItem(`ehr-store_${PHONE_A}`)).not.toBeNull();

    // Sign out: the in-memory draft goes with the student.
    resetPaletteStore();
    signOut();
    expect(useAppStore.getState().pipeline.currentRole).toBe("scribe");
    expect(useAppStore.getState().pipeline.soapNote.subjective).toBe("");

    // The next student on this machine starts from the defaults.
    signIn(PHONE_B);
    await useAppStore.persist.rehydrate();
    expect(useAppStore.getState().pipeline.currentRole).toBe("scribe");
    expect(useAppStore.getState().pipeline.soapNote.subjective).toBe("");
    expect(useAppStore.getState().pipeline.stage).toBe("registration");
    // Nothing was written under the second student's key by the first.
    expect(storage().getItem(`ehr-store_${PHONE_B}`)).toBeNull();

    // And the first student's own slice is still theirs when they come back.
    signIn(PHONE_A);
    await useAppStore.persist.rehydrate();
    expect(storage().getItem(`ehr-store_${PHONE_A}`)).not.toBeNull();
  });
});
