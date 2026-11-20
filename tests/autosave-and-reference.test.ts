/**
 * Autosave indicator + reference drawer — spec `task-1-app-shell.md` items 9 and 6.
 *
 * Two promises are tested here:
 *   1. A save either says "Saved" or says "Not saved" with a reason — it is never
 *      silent, and a failed write can be tried again (item 9, plan Known Risks).
 *   2. The reference drawer reopens on the tab the student was reading, and
 *      falls back to the first tab when that tab no longer exists (item 6).
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  canRetry,
  describeStorageError,
  getAutosave,
  markFailed,
  markSaved,
  markSaving,
  resetAutosave,
  retryLastSave,
  subscribeAutosave,
  writeAutosaved,
} from "../src/store/autosave";
import { resolveReferenceTab } from "../src/components/shell/ReferenceDrawer";

type FakeStorage = { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };

function installStorage(store: FakeStorage): void {
  Object.defineProperty(globalThis, "localStorage", { value: store, configurable: true, writable: true });
}

function memoryStorage(): FakeStorage & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

const originalLocalStorage = (globalThis as { localStorage?: unknown }).localStorage;

beforeEach(() => resetAutosave());
afterEach(() => {
  resetAutosave();
  if (originalLocalStorage === undefined) {
    // @ts-expect-error — removing the stub the test installed
    delete globalThis.localStorage;
  } else {
    Object.defineProperty(globalThis, "localStorage", { value: originalLocalStorage, configurable: true, writable: true });
  }
});

describe("autosave state", () => {
  test("starts with nothing saved and says so honestly", () => {
    const snapshot = getAutosave();
    expect(snapshot.status).toBe("idle");
    expect(snapshot.savedAt).toBeNull();
    expect(snapshot.error).toBeNull();
  });

  test("saving → saved carries the time of the write", () => {
    markSaving("Medical case");
    expect(getAutosave().status).toBe("saving");
    markSaved("Medical case", 1_700_000_000_000);
    const snapshot = getAutosave();
    expect(snapshot.status).toBe("saved");
    expect(snapshot.savedAt).toBe(1_700_000_000_000);
    expect(snapshot.scope).toBe("Medical case");
    expect(snapshot.error).toBeNull();
  });

  test("a failure keeps its reason and can be retried", () => {
    let attempts = 0;
    markFailed("Dental case", "this browser's storage is full", () => {
      attempts += 1;
    });
    const snapshot = getAutosave();
    expect(snapshot.status).toBe("failed");
    expect(snapshot.error).toContain("storage is full");
    expect(canRetry()).toBe(true);
    retryLastSave();
    expect(attempts).toBe(1);
  });

  test("subscribers are told about every change", () => {
    let calls = 0;
    const unsubscribe = subscribeAutosave(() => {
      calls += 1;
    });
    markSaving("Chart");
    markSaved("Chart");
    expect(calls).toBe(2);
    unsubscribe();
    markSaving("Chart");
    expect(calls).toBe(2);
  });

  test("storage errors are turned into sentences a student can act on", () => {
    expect(describeStorageError(new DOMException("x", "QuotaExceededError"))).toContain("storage is full");
    expect(describeStorageError(new DOMException("x", "SecurityError"))).toContain("blocking site storage");
    expect(describeStorageError(new Error("boom"))).toBe("boom");
  });
});

describe("writeAutosaved", () => {
  test("a write that lands reports Saved", () => {
    const storage = memoryStorage();
    installStorage(storage);
    expect(writeAutosaved("hh_test", "value", "Encounter")).toBe(true);
    expect(storage.data.hh_test).toBe("value");
    expect(getAutosave().status).toBe("saved");
  });

  test("a write that is refused reports Not saved, keeps the reason, and offers the retry", () => {
    let refuse = true;
    const storage: FakeStorage & { data: Record<string, string> } = {
      data: {},
      getItem: () => null,
      removeItem: () => {},
      setItem(key: string, value: string) {
        if (refuse) throw new DOMException("full", "QuotaExceededError");
        this.data[key] = value;
      },
    };
    installStorage(storage);

    expect(writeAutosaved("hh_test", "value", "Chart")).toBe(false);
    const failed = getAutosave();
    expect(failed.status).toBe("failed");
    expect(failed.error).toContain("storage is full");
    expect(canRetry()).toBe(true);

    // The same write succeeds when the student clears space and retries.
    refuse = false;
    retryLastSave();
    expect(getAutosave().status).toBe("saved");
    expect(storage.data.hh_test).toBe("value");
  });
});

describe("reference drawer tab memory", () => {
  const tabs = [{ id: "chart-note" }, { id: "insurance-card" }, { id: "payer-policy" }, { id: "code-reference" }];

  test("reopens on the tab the student had open", () => {
    expect(resolveReferenceTab("payer-policy", tabs)).toBe("payer-policy");
  });

  test("falls back to the first tab when the remembered one is gone", () => {
    expect(resolveReferenceTab("eligibility-response", tabs)).toBe("chart-note");
    expect(resolveReferenceTab(null, tabs)).toBe("chart-note");
  });

  test("no tabs means no tab", () => {
    expect(resolveReferenceTab("payer-policy", [])).toBe("");
  });
});
