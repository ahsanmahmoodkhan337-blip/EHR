/**
 * Reset data safety — the dialog's list IS the delete list.
 *
 * Owner decision 2026-11-20 (`specs/reset-data-safety.md`): reset used to remove
 * `hh_userdata_<phone>` and `hh_dental_track_<phone>` under a "legacy keys"
 * comment while both were live, and left the graded case progress behind. This
 * module is the one place that says which store belongs to which group, so the
 * screen can list them, the export can name them, and the delete can remove
 * exactly them — nothing else.
 *
 * A store that is not listed here is never touched by a reset. The test in
 * `tests/reset-data-safety.test.ts` scans `src/` for `hh_` storage keys and
 * fails when one is neither in a group nor in the explicit untouched list.
 *
 * Inspiration: athenahealth's "My Account / Data" screen — a short list of what
 * is stored, each row removable on its own.
 */

export type ResetGroupId = "encounters" | "dental" | "graded" | "scores" | "chart";

/** Where a store physically lives. `local` is localStorage, `idb` IndexedDB. */
export type ResetStore = { key: string; backend: "local" | "idb" };

export type ResetGroup = {
  id: ResetGroupId;
  /** Short row label. */
  label: string;
  /** One plain sentence: what goes. */
  holds: string;
  /** The exact stores, for this student's phone. */
  stores: (phone: string) => ResetStore[];
};

export const RESET_GROUPS: readonly ResetGroup[] = [
  {
    id: "encounters",
    label: "Medical encounters",
    holds: "Notes, codes, claims, 835s, ledger and AR decisions.",
    stores: (phone) => [{ key: `hh_userdata_${phone}`, backend: "local" }],
  },
  {
    id: "dental",
    label: "Dental track",
    holds: "Case, CDT lines, ADA claim, dental ledger, AR practice bench.",
    stores: (phone) => [{ key: `hh_dental_track_${phone}`, backend: "local" }],
  },
  {
    id: "graded",
    label: "Graded case progress",
    holds: "The graded case runner's answers and rubric.",
    stores: (phone) => [{ key: `hh_medical_case_${phone}`, backend: "local" }],
  },
  {
    id: "scores",
    label: "Scores and streak",
    holds: "Leaderboard entries, streak and challenges.",
    // Keyed by phone since the scores-per-student fix: a reset removes this
    // student's scores only, never another student's on the same machine.
    stores: (phone) => [
      { key: `hh_scores_${phone}`, backend: "local" },
      { key: `hh_streak_${phone}`, backend: "local" },
      { key: `hh_challenges_${phone}`, backend: "local" },
    ],
  },
  {
    id: "chart",
    label: "Patient chart",
    holds: "Patients you registered, appointments, notes, case states, activity log.",
    stores: (phone) => [
      { key: `hh_ehr_${phone}`, backend: "idb" },
      { key: `hh_ehr_ls_${phone}`, backend: "local" },
      // Codes picked on the Coding stage but not yet submitted, per patient.
      { key: `hh_coding_draft_${phone}`, backend: "local" },
    ],
  },
];

/** Keys a reset must never touch, whatever the student selects. */
export const UNTOUCHED_STORES = [
  "hh_approved_phones",
  "hh_access_requests",
  "hh_logged_in_phone",
  "hh_session_start",
  "hh_session_timeout",
  "hh_device_id",
  "hh_student_name",
  "hh_dark_mode",
  "hh_help_open",
  // Where the student parked the floating help head — a UI preference.
  "hh_help_pos",
  "hh_reference_open",
  "hh_reference_tab",
  "hh_shell_sidebar_collapsed",
  // Which track (medical / dental) the top bar switch last chose — a view
  // preference, not student work. Deleting it would silently flip the student's
  // track back to medical.
  "hh_active_track",
  "hh_selected_patient",
  "hh_custom_patients",
  "hh_scenario",
  "hh_scenario_patient",
  "hh_stage_pins",
  "hh_unlocked_stages",
  // One-time "this student already adopted the old device-wide scores" marker.
  // A reset must never touch it: if it did, the next page load would adopt the
  // old `hh_scores` value straight back and the scores the student just deleted
  // would reappear.
  "hh_scores_adopted",
] as const;

export function groupById(id: ResetGroupId): ResetGroup | undefined {
  return RESET_GROUPS.find((group) => group.id === id);
}

/** Every store the given groups list, in dialog order. */
export function storesForGroups(phone: string, ids: readonly ResetGroupId[]): ResetStore[] {
  const wanted = new Set(ids);
  return RESET_GROUPS.filter((group) => wanted.has(group.id)).flatMap((group) =>
    group.stores(phone),
  );
}

function localStore(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * Delete the localStorage stores of exactly these groups. Returns the keys it
 * removed, so the caller can report what happened instead of guessing.
 * IndexedDB stores are returned by `storesForGroups` and deleted by the owner
 * of that database (`ehrStore`), which is the only module that can reach it.
 */
export function deleteGroupStores(
  phone: string,
  ids: readonly ResetGroupId[],
  storage: Storage | null = localStore(),
): string[] {
  const removed: string[] = [];
  for (const store of storesForGroups(phone, ids)) {
    if (store.backend !== "local" || !storage) continue;
    try {
      storage.removeItem(store.key);
      removed.push(store.key);
    } catch (e) {
      console.warn("resetData: could not remove", store.key, e);
    }
  }
  return removed;
}

// ─── In-memory stores ──────────────────────────────────────────────
// A key removed from storage while its React store still holds the state is
// written straight back by the next debounced save. Each store registers here
// so a reset can cancel its pending save and blank its state in the same step.

export type ResetHandler = () => void;
const handlers = new Map<ResetGroupId, Set<ResetHandler>>();

export function registerResetHandler(id: ResetGroupId, handler: ResetHandler): () => void {
  const set = handlers.get(id) ?? new Set<ResetHandler>();
  set.add(handler);
  handlers.set(id, set);
  return () => {
    set.delete(handler);
  };
}

/** Cancel pending saves and blank the in-memory state of these groups. */
export function resetInMemory(ids: readonly ResetGroupId[]): void {
  for (const id of ids) {
    for (const handler of handlers.get(id) ?? []) {
      try {
        handler();
      } catch (e) {
        console.warn("resetData: in-memory reset failed for", id, e);
      }
    }
  }
}

// ─── Export ────────────────────────────────────────────────────────

/** Read one stored value as JSON where possible, else as the raw string. */
function readValue(key: string, storage: Storage | null): unknown {
  if (!storage) return null;
  let raw: string | null = null;
  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

export type ResetExport = {
  app: string;
  exportedAt: string;
  phone: string;
  groups: { id: ResetGroupId; label: string; holds: string; stores: Record<string, unknown> }[];
};

/**
 * Everything the dialog lists, plus the chart, as one JSON document — built
 * before anything is deleted. `readIdb` is supplied by `ehrStore`, the only
 * module that can read the chart out of IndexedDB.
 */
export async function buildResetExport(
  phone: string,
  ids: readonly ResetGroupId[],
  readIdb?: (key: string) => Promise<unknown>,
): Promise<string> {
  const storage = localStore();
  const groups: ResetExport["groups"] = [];
  for (const group of RESET_GROUPS.filter((g) => ids.includes(g.id))) {
    const stores: Record<string, unknown> = {};
    for (const store of group.stores(phone)) {
      if (store.backend === "local") {
        stores[store.key] = readValue(store.key, storage);
      } else {
        let value: unknown = null;
        try {
          value = readIdb ? await readIdb(store.key) : null;
        } catch (e) {
          console.warn("resetData: could not read", store.key, e);
        }
        stores[store.key] = value ?? null;
      }
    }
    groups.push({ id: group.id, label: group.label, holds: group.holds, stores });
  }
  const doc: ResetExport = {
    app: "healthcare-hustlers-ehr",
    exportedAt: new Date().toISOString(),
    phone,
    groups,
  };
  return JSON.stringify(doc, null, 2);
}
