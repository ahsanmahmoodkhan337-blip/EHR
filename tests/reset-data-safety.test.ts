/**
 * Reset data safety — the guardrail for `specs/reset-data-safety.md`.
 *
 * Reset used to remove `hh_userdata_<phone>` and `hh_dental_track_<phone>` under
 * a "legacy keys" comment while both were live, and left the graded case
 * progress behind. These tests seed every store a student has, run the reset
 * with ONE group checked, and assert that group is gone while every other store
 * — the chart, preferences, the approved-phone cache, the session keys — still
 * holds its exact value. A second group proves the delete reads the dialog's
 * list rather than a hardcoded set.
 *
 * The last test scans `src/` for `hh_` storage keys, so a store added later that
 * the dialog does not know about fails here instead of being deleted silently.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  RESET_GROUPS,
  UNTOUCHED_STORES,
  buildResetExport,
  deleteGroupStores,
  registerResetHandler,
  resetInMemory,
  storesForGroups,
} from "../src/store/resetData";

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

const PHONE = "923001234567";

/** Every store the app writes for this student, each with a recognisable value. */
function seedAll(storage: MemoryStorage): Record<string, string> {
  const seeded: Record<string, string> = {
    [`hh_userdata_${PHONE}`]: JSON.stringify({ v: 8, pipeline: { encounters: { "PAT-1": { note: "SOAP" } } } }),
    [`hh_dental_track_${PHONE}`]: JSON.stringify({ version: 6, caseId: "DEN-1", lines: ["D1110"] }),
    [`hh_medical_case_${PHONE}`]: JSON.stringify({ caseId: "MED-CASE-1", rubric: { coding: 3 } }),
    hh_scores: JSON.stringify([{ name: "Ayesha", score: 42 }]),
    hh_streak: "7",
    hh_challenges: JSON.stringify({ done: ["c1", "c2"] }),
    [`hh_ehr_${PHONE}`]: JSON.stringify({ app: "healthcare-hustlers-ehr", user: { patients: [] } }),
    [`hh_ehr_ls_${PHONE}`]: JSON.stringify({ app: "healthcare-hustlers-ehr", user: { patients: [] } }),
  };
  // Stores a reset must leave alone, whatever is checked.
  for (const key of UNTOUCHED_STORES) seeded[key] = JSON.stringify({ keep: key });
  for (const [key, value] of Object.entries(seeded)) storage.setItem(key, value);
  return seeded;
}

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

function expectOthersUntouched(seeded: Record<string, string>, removed: string[]): void {
  for (const [key, value] of Object.entries(seeded)) {
    if (removed.includes(key)) {
      expect(storage().getItem(key)).toBeNull();
    } else {
      expect(storage().getItem(key)).toBe(value);
    }
  }
}

describe("reset deletes exactly the checked group", () => {
  test("dental track only — every other store keeps its exact value", () => {
    const seeded = seedAll(storage());
    const removed = deleteGroupStores(PHONE, ["dental"]);

    expect(removed).toEqual([`hh_dental_track_${PHONE}`]);
    expect(storage().getItem(`hh_dental_track_${PHONE}`)).toBeNull();
    // The medical pipeline and the graded progress are the two the old button
    // got exactly wrong, so they are named here.
    expect(storage().getItem(`hh_userdata_${PHONE}`)).toBe(seeded[`hh_userdata_${PHONE}`] as string);
    expect(storage().getItem(`hh_medical_case_${PHONE}`)).toBe(
      seeded[`hh_medical_case_${PHONE}`] as string,
    );
    expectOthersUntouched(seeded, removed);
  });

  test("scores and streak only — proves it reads the dialog's list, not a fixed set", () => {
    const seeded = seedAll(storage());
    const removed = deleteGroupStores(PHONE, ["scores"]);

    expect(removed.sort()).toEqual(["hh_challenges", "hh_scores", "hh_streak"]);
    expectOthersUntouched(seeded, removed);
  });

  test("nothing checked deletes nothing", () => {
    const seeded = seedAll(storage());
    expect(deleteGroupStores(PHONE, [])).toEqual([]);
    expectOthersUntouched(seeded, []);
  });

  test("a group is offered for every store it names, keyed by the phone", () => {
    const chart = storesForGroups(PHONE, ["chart"]).map((store) => store.key);
    expect(chart).toEqual([`hh_ehr_${PHONE}`, `hh_ehr_ls_${PHONE}`]);
    // Another student's keys are never in the list.
    expect(storesForGroups("923009999999", ["encounters"]).map((s) => s.key)).toEqual([
      "hh_userdata_923009999999",
    ]);
  });
});

describe("in-memory stores are blanked in the same step", () => {
  test("only the checked group's handler runs", () => {
    const ran: string[] = [];
    const offDental = registerResetHandler("dental", () => ran.push("dental"));
    const offGraded = registerResetHandler("graded", () => ran.push("graded"));

    resetInMemory(["dental"]);

    expect(ran).toEqual(["dental"]);
    offDental();
    offGraded();
    resetInMemory(["dental", "graded"]);
    expect(ran).toEqual(["dental"]);
  });
});

describe("the export comes before anything is deleted", () => {
  test("holds every listed store and the chart, and deletes nothing", async () => {
    const seeded = seedAll(storage());
    const json = await buildResetExport(PHONE, RESET_GROUPS.map((group) => group.id), async () =>
      JSON.parse(seeded[`hh_ehr_${PHONE}`] as string),
    );
    const doc = JSON.parse(json) as { groups: { id: string; stores: Record<string, unknown> }[] };

    expect(doc.groups.map((group) => group.id)).toEqual(RESET_GROUPS.map((group) => group.id));
    const stores = Object.assign({}, ...doc.groups.map((group) => group.stores));
    const listed = RESET_GROUPS.flatMap((group) => group.stores(PHONE).map((store) => store.key));
    for (const key of listed) {
      if (key === `hh_ehr_${PHONE}`) continue; // IndexedDB, supplied by the reader
      expect(stores[key]).not.toBeUndefined();
    }
    expect(stores[`hh_ehr_${PHONE}`]).toEqual(JSON.parse(seeded[`hh_ehr_${PHONE}`] as string));
    // Nothing the dialog does not list is in the file either.
    expect(stores.hh_approved_phones).toBeUndefined();
    // Nothing was deleted while the export was being built.
    expectOthersUntouched(seeded, []);
  });
});

describe("a store the dialog does not know about fails this test", () => {
  /** Every `hh_` storage key literal in the app's source. */
  function hhKeyLiterals(): Set<string> {
    const found = new Set<string>();
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(path);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry.name)) continue;
        const text = readFileSync(path, "utf8");
        for (const match of text.matchAll(/["'`](hh_[A-Za-z0-9_]+)/g)) {
          found.add(match[1] as string);
        }
      }
    };
    walk(join(import.meta.dir, "..", "src"));
    return found;
  }

  test("every hh_ key is either listed by the dialog or explicitly untouched", () => {
    const literals = hhKeyLiterals();
    expect(literals.size).toBeGreaterThan(10); // the scan is real, not empty

    // What the dialog can delete, as prefixes for this student's phone.
    const listed = RESET_GROUPS.flatMap((group) =>
      group.stores("PHONE").map((store) => store.key.replace("PHONE", "")),
    );
    const known = [...listed, ...UNTOUCHED_STORES];
    const unknown = [...literals].filter(
      (literal) => !known.some((key) => key === literal || key.startsWith(literal)),
    );

    expect(unknown).toEqual([]);
  });
});
