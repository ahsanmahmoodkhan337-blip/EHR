/**
 * Stage-PIN removal — the guardrail for TASK 0b item 4.
 *
 * The PIN store is deleted, so the only thing that can still go wrong quietly is
 * the cleanup: deleting the wrong key would reset a student's saved work. These
 * tests run the cleanup over a browser that holds BOTH the retired lock keys and
 * a full saved-progress blob, and assert the blob and every other key come
 * through byte-for-byte unchanged.
 */
import { describe, expect, test } from "bun:test";
import { removeStagePinState, RETIRED_STAGE_PIN_KEYS } from "../src/store/removeStagePinState";

/** A minimal localStorage stand-in, so the test needs no DOM. */
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

/** A saved student record: progress the cleanup must not touch. */
const SAVED_PROGRESS = JSON.stringify({
  v: 4,
  updatedAt: "2026-11-19T10:00:00.000Z",
  currentRole: "coder",
  appointments: [{ id: "appt-1", patientId: "MCASE-001", time: "09:00" }],
  pipeline: {
    activePatientId: "MCASE-001",
    encounters: {
      "MCASE-001": {
        patientId: "MCASE-001",
        status: "billed",
        claimNumber: "CLM-000001",
        claimStatus: "submitted",
        soapNote: { subjective: "Student's own note text" },
        codingLines: [{ code: "99214", charge: 15000 }],
        claimForm: { "1": "MCASE-001", "21A": "11" },
        typedBoxes: { "30": "0.00" },
      },
    },
  },
  deniedClaims: [{ id: "d-1", encounterId: "MCASE-001", claimNumber: "CLM-000001" }],
  paRecords: [{ id: "pa-1", status: "submitted" }],
});

function seededStorage(): MemoryStorage {
  const storage = new MemoryStorage();
  // The retired keys, exactly as the old gate wrote them.
  storage.setItem("hh_stage_pins", JSON.stringify({ scribe: "1111", coder: "2222", biller: "3333", "prior-auth": "4444", "ar-voice": "5555" }));
  storage.setItem("hh_unlocked_stages", JSON.stringify(["scribe", "coder"]));
  // Everything else a student has saved.
  storage.setItem("hh_userdata_15551234567", SAVED_PROGRESS);
  storage.setItem("hh_access_phone", "15551234567");
  storage.setItem("hh_security_15551234567", JSON.stringify({ devices: ["d1", "d2"], activeSession: "s1" }));
  storage.setItem("hh_unrelated_setting", "keep me");
  return storage;
}

describe("stage-PIN cleanup", () => {
  test("removes only the two retired lock keys", () => {
    const storage = seededStorage();
    const before = new Map<string, string>();
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i) as string;
      before.set(key, storage.getItem(key) as string);
    }

    const removed = removeStagePinState(storage);

    expect(removed.sort()).toEqual([...RETIRED_STAGE_PIN_KEYS].sort());
    for (const key of RETIRED_STAGE_PIN_KEYS) {
      expect(storage.getItem(key), `${key} should be gone`).toBeNull();
    }
    // Every other key survives with the exact same value.
    for (const [key, value] of before) {
      if ((RETIRED_STAGE_PIN_KEYS as readonly string[]).includes(key)) continue;
      expect(storage.getItem(key), `${key} must be untouched`).toBe(value);
    }
  });

  test("saved progress is byte-for-byte intact after the cleanup", () => {
    const storage = seededStorage();
    removeStagePinState(storage);
    const blob = storage.getItem("hh_userdata_15551234567");
    expect(blob).toBe(SAVED_PROGRESS);
    const parsed = JSON.parse(blob as string);
    expect(parsed.pipeline.encounters["MCASE-001"].claimNumber).toBe("CLM-000001");
    expect(parsed.pipeline.encounters["MCASE-001"].typedBoxes["30"]).toBe("0.00");
    expect(parsed.currentRole).toBe("coder");
  });

  test("a browser that never saw a PIN is left alone, and a second run is a no-op", () => {
    const fresh = new MemoryStorage();
    fresh.setItem("hh_userdata_15551234567", SAVED_PROGRESS);
    expect(removeStagePinState(fresh)).toEqual([]);
    expect(fresh.getItem("hh_userdata_15551234567")).toBe(SAVED_PROGRESS);

    const storage = seededStorage();
    removeStagePinState(storage);
    expect(removeStagePinState(storage)).toEqual([]);
    expect(storage.getItem("hh_userdata_15551234567")).toBe(SAVED_PROGRESS);
  });

  test("no storage available (private mode / server render) does not throw", () => {
    expect(removeStagePinState(undefined)).toEqual([]);
  });
});
