/**
 * Central Zustand Store — App-wide state engine
 *
 * Slices: patient, pipeline, access, ui
 * Replaces Context-based state for cross-component sharing.
 * Existing Context providers (PatientProvider, PipelineProvider) remain
 * functional; this store augments them for new features.
 */

import { create } from "zustand";

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

export const useAppStore = create<AppState>((set) => ({
  // Patient defaults
  patient: { selectedPatientId: null, displayName: null, encounterId: null },
  setPatientId: (id) =>
    set((s) => ({ patient: { ...s.patient, selectedPatientId: id } })),
  setDisplayName: (name) =>
    set((s) => ({ patient: { ...s.patient, displayName: name } })),

  // Pipeline defaults
  pipeline: {
    currentRole: "scribe",
    stage: "registration",
    status: "draft",
    icdCodes: [],
    cptCodes: [],
    soapNote: { subjective: "", objective: "", assessment: "", plan: "" },
  },
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
    darkMode: localStorage.getItem("hh_dark_mode") === "true",
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
}));
