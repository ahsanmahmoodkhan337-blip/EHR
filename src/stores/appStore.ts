/**
 * Central Zustand Store — App-wide state engine
 *
 * Slices: patient, pipeline, access, ui
 * Persisted to localStorage under `ehr-store_<phone>` — the signed-in
 * student's own key (owner decision 2026-11-20, `specs/scores-per-student.md`).
 * On a shared classroom machine the next student must not inherit the previous
 * one's role or note draft, so the key follows the phone.
 *
 * The `pipeline` slice is no longer persisted: nothing reads it back from
 * storage (only `CommandPalette` and `ScenarioInjector` touch this store, and
 * they write the role; the role is never restored from disk). Leaving it in
 * storage was a write-only copy of one student's draft sitting under the next
 * student's key.
 *
 * Inspiration: Epic's per-user workstation state — the session follows the
 * user, not the machine.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { scopedKey } from "../store/studentScope";

// ─── Types ─────────────────────────────────────────────────────────

export type Role = "scribe" | "coder" | "biller" | "prior-auth" | "ar-voice";

export interface PatientState {
  selectedPatientId: string | null;
  displayName: string | null;
  encounterId: string | null;
}

export interface PipelineState {
  currentRole: Role;
  stage: string;
  status: string;
  icdCodes: string[];
  cptCodes: string[];
  soapNote: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
}

export interface UIState {
  activeWorkspace: string;
  activeTab: string;
  sidebarOpen: boolean;
  commandPaletteOpen: boolean;
  darkMode: boolean;
}

interface AppState {
  // Patient slice
  patient: PatientState;
  setPatientId: (id: string | null) => void;
  setDisplayName: (name: string | null) => void;

  // Pipeline slice
  pipeline: PipelineState;
  setRole: (role: Role) => void;
  setStage: (stage: string) => void;
  setSoapNote: (note: Partial<PipelineState["soapNote"]>) => void;

  // UI slice
  ui: UIState;
  setActiveWorkspace: (ws: string) => void;
  setActiveTab: (tab: string) => void;
  toggleSidebar: () => void;
  toggleCommandPalette: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleDarkMode: () => void;
}

// ─── Store ─────────────────────────────────────────────────────────

/**
 * localStorage adapter for zustand's persist, keyed by the signed-in phone.
 * `name` is the store's base name ("ehr-store"); the real key is
 * `ehr-store_<phone>`, the same phone string the rest of the app keys on.
 */
const studentScopedStorage = {
  getItem: (name: string): string | null => {
    const key = scopedKey(name);
    if (!key) return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    const key = scopedKey(name);
    if (!key) return;
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn("appStore: could not persist", name, e);
    }
  },
  removeItem: (name: string): void => {
    const key = scopedKey(name);
    if (!key) return;
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn("appStore: could not remove", name, e);
    }
  },
};

/** A fresh pipeline slice — no role, stage, codes or note draft from anyone. */
function createInitialPipeline(): PipelineState {
  return {
    currentRole: "scribe",
    stage: "registration",
    status: "draft",
    icdCodes: [],
    cptCodes: [],
    soapNote: { subjective: "", objective: "", assessment: "", plan: "" },
  };
}

/** The saved dark-mode preference, safe to read where there is no storage. */
function readDarkMode(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem("hh_dark_mode") === "true";
  } catch {
    return false;
  }
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Patient defaults
      patient: { selectedPatientId: null, displayName: null, encounterId: null },
      setPatientId: (id) =>
        set((s) => ({ patient: { ...s.patient, selectedPatientId: id } })),
      setDisplayName: (name) =>
        set((s) => ({ patient: { ...s.patient, displayName: name } })),

      // Pipeline defaults
      pipeline: createInitialPipeline(),
      setRole: (role) =>
        set((s) => ({ pipeline: { ...s.pipeline, currentRole: role } })),
      setStage: (stage) =>
        set((s) => ({ pipeline: { ...s.pipeline, stage } })),
      setSoapNote: (note) =>
        set((s) => ({
          pipeline: { ...s.pipeline, soapNote: { ...s.pipeline.soapNote, ...note } },
        })),

      // UI defaults
      ui: {
        activeWorkspace: "chart",
        activeTab: "summary",
        sidebarOpen: true,
        commandPaletteOpen: false,
        darkMode: readDarkMode(),
      },
      setActiveWorkspace: (ws) =>
        set((s) => ({ ui: { ...s.ui, activeWorkspace: ws } })),
      setActiveTab: (tab) =>
        set((s) => ({ ui: { ...s.ui, activeTab: tab } })),
      toggleSidebar: () =>
        set((s) => ({ ui: { ...s.ui, sidebarOpen: !s.ui.sidebarOpen } })),
      toggleCommandPalette: () =>
        set((s) => ({ ui: { ...s.ui, commandPaletteOpen: !s.ui.commandPaletteOpen } })),
      setCommandPaletteOpen: (open) =>
        set((s) => ({ ui: { ...s.ui, commandPaletteOpen: open } })),
      toggleDarkMode: () =>
        set((s) => {
          const next = !s.ui.darkMode;
          localStorage.setItem("hh_dark_mode", String(next));
          return { ui: { ...s.ui, darkMode: next } };
        }),
    }),
    {
      name: "ehr-store",
      // The key is resolved at every read and write: `ehr-store_<phone>`. With
      // nobody signed in the storage is inert, so nothing is written to a
      // device-wide key and nothing is read from one.
      storage: createJSONStorage(() => studentScopedStorage),
      // Only UI preferences. The pipeline slice is in memory only — see the
      // header comment: nothing reads it back, so persisting it would leave one
      // student's role and note draft on disk for the next student.
      partialize: (state) => ({
        ui: state.ui,
      }),
    }
  )
);

/**
 * Load the signed-in student's palette state. Called right after sign-in,
 * because the store is created before a phone exists.
 */
export function rehydratePaletteStore(): void {
  void useAppStore.persist.rehydrate();
}

/**
 * Drop the in-memory role, stage and note draft. Called on sign-out so the next
 * student on the same machine starts from the defaults, not from the previous
 * student's draft (the persisted slice is already keyed per phone).
 */
export function resetPaletteStore(): void {
  useAppStore.setState({
    patient: { selectedPatientId: null, displayName: null, encounterId: null },
    pipeline: createInitialPipeline(),
  });
}

// ─── Cross-component reactivity subscriber ─────────────────────────

useAppStore.subscribe((state, prev) => {
  // activePatientId change triggers dependent views
  if (state.patient.selectedPatientId !== prev.patient.selectedPatientId) {
    // Views re-render automatically via Zustand selectors — no manual trigger needed
  }
});
