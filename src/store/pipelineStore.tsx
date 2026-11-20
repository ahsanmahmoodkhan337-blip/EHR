/**
 * Pipeline Store — RCM Pipeline State (React Context)
 *
 * Tracks the full RCM pipeline for each patient encounter through 5 stages:
 *   [Charted] → [Coded] → [Billed (Bill)] → [Prior Auth] → [Paid/Denied/Reprocessed]
 *
 * Roles: Scribe, Coder, Biller, Prior Auth, AR Voice Specialist
 *
 * Inspiration: Epic's encounter list — one encounter per patient, with the
 * active encounter explicit. Every stage and every document (note, codes,
 * claim, prior auth, denial) is stored with the patient it belongs to, so
 * picking a patient loads their work and picking another never wipes it.
 *
 * Submission functions auto-advance the active patient's stage. The AR Voice
 * Specialist role handles denied claims with aging buckets and call resolution;
 * its ledger and worklists are legitimately multi-patient, so they stay global.
 */

import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from "react";
import { getLoggedInPhone } from "./accessStore";
import { loadUserData, saveUserData, syncUserDataFromSupabase } from "./persistence";
import {
  createEncounter,
  encounterKey,
  EMPTY_ENCOUNTER,
  normalizePipelineStore,
  restoredRoleFor,
  type ClaimFormData,
  type ClaimServiceLine,
  type PipelineEncounter,
  type PipelineState,
  type PipelineStoreState,
  type Role,
} from "./pipelineEncounter";

// Re-exported so every existing import path keeps working.
export type {
  ClaimFormData,
  ClaimServiceLine,
  PipelineEncounter,
  PipelineState,
  PipelineStatus,
  PipelineStoreState,
  Role,
} from "./pipelineEncounter";
export { encounterHasWork, encounterKey, UNASSIGNED_ENCOUNTER_KEY } from "./pipelineEncounter";

export interface DeniedClaim {
  id: string;
  encounterId: string;
  patientName: string;
  reason: string;
  amount: number;
  deniedAt: string;
  agingBucket: "0-30" | "31-60" | "61-90" | "90+";
  resolutionStatus: "unresolved" | "in-progress" | "resolved" | "escalated";
  assignedTo?: string;
  notes?: string;
}

export interface ARCallRecord {
  id: string;
  claimId: string;
  patientName: string;
  caller: string;
  timestamp: string;
  duration: number;
  outcome: "reached-patient" | "left-voicemail" | "wrong-number" | "promised-payment" | "escalated";
  notes?: string;
}

/** Prior Authorization record with lifecycle tracking */
export interface PARecordStore {
  id: string;
  patientId: string;
  procedure: string;
  insuranceName: string;
  paProcessor: string;
  authStartDate: string;
  authEndDate: string;
  nextRefillDate: string;
  submissionMethod: string;
  submittedBy: string;
  submittedAt: string;
  status: string; // matches PA_STATUS_FLOW key
  verificationStatus: "not-verified" | "verified" | "failed";
  verificationResult: string;
}

// ─── Context ───────────────────────────────────────────────────────

interface PipelineContextValue {
  /** The active patient's encounter (+ the global demo-fill switch). */
  state: PipelineState;
  /** The patient every stage reads and writes. */
  activePatientId: string | null;
  /** Load a patient's own encounter (creating an empty one on first visit). */
  selectPatient: (patientId: string | null) => void;
  /** This patient's stored encounter, or undefined when never visited. */
  getEncounter: (patientId: string | null) => PipelineEncounter | undefined;
  currentRole: Role;
  setRole: (role: Role) => void;
  submitToCoding: (note: string) => void;
  submitToBilling: (icdCodes: string[], cptCodes: string[], lines?: ClaimServiceLine[]) => void;
  submitClaim: (claimData: Record<string, string>) => void;
  // Structured CMS-1500 record
  setClaimForm: (form: ClaimFormData | null) => void;
  patchClaimForm: (patch: Partial<ClaimFormData>) => void;
  /** Instructor / exam-mode switch for the demo fill of missing claim boxes. */
  setDemoFillMissingBoxes: (enabled: boolean) => void;
  handleDenial: (denialCode: string, meta?: { amount?: number; patientName?: string }) => void;
  submitPA: (paData: Record<string, string>) => void;
  completePipeline: () => void;
  getRoleLabel: (role: Role) => string;
  // AR-specific
  deniedClaims: DeniedClaim[];
  arCalls: ARCallRecord[];
  resolveDenial: (claimId: string, status: DeniedClaim["resolutionStatus"]) => void;
  addCallRecord: (record: ARCallRecord) => void;
  assignDenial: (claimId: string, agent: string) => void;
  getClaimsByAging: () => Record<string, DeniedClaim[]>;
  // PA lifecycle
  paRecords: PARecordStore[];
  addPARecord: (record: PARecordStore) => void;
  updatePAStatus: (id: string, status: string) => void;
  /**
   * Start a patient's encounter over from blank. Pass an id to target that
   * patient, `null` for the unassigned bucket, or nothing for the active one.
   * Never called on a plain patient switch — switching only loads.
   */
  resetEncounter: (patientId?: string | null) => void;
  setPatientDisplayName: (name: string | null) => void;
  prefillForTutorial: () => void;
}

const PipelineContext = createContext<PipelineContextValue | null>(null);

// ─── Helpers ───────────────────────────────────────────────────────

function determineAgingBucket(deniedAt: string): DeniedClaim["agingBucket"] {
  const daysSince = Math.floor(
    (Date.now() - new Date(deniedAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysSince <= 30) return "0-30";
  if (daysSince <= 60) return "31-60";
  if (daysSince <= 90) return "61-90";
  return "90+";
}

const ROLE_LABELS: Record<Role, string> = {
  scribe: "Scribe / Provider",
  coder: "Medical Coder",
  biller: "Medical Biller",
  "prior-auth": "Prior Authorization",
  "ar-voice": "AR Voice Specialist",
};

/** Initial store — read straight from localStorage so the first render has it. */
function initialState(): PipelineStoreState {
  const phone = getLoggedInPhone();
  const local = phone ? loadUserData(phone) : null;
  return normalizePipelineStore(local?.pipeline, local?.currentRole ?? "scribe");
}

// ─── Provider ──────────────────────────────────────────────────────

export function PipelineProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<PipelineStoreState>(initialState);

  const [deniedClaims, setDeniedClaims] = useState<DeniedClaim[]>([]);
  const [arCalls, setArCalls] = useState<ARCallRecord[]>([]);
  const [paRecords, setPaRecords] = useState<PARecordStore[]>([]);

  // ── Per-user persistence ─────────────────────────────────────────
  // Keyed by the logged-in student's phone (localStorage, always on), with an
  // optional Supabase refresh. Providers remount on login/logout, so scoping
  // to the phone at mount gives correct per-user isolation.
  useEffect(() => {
    const phone = getLoggedInPhone();
    if (!phone) return;
    const local = loadUserData(phone);
    if (local?.deniedClaims) setDeniedClaims(local.deniedClaims);
    if (local?.arCalls) setArCalls(local.arCalls);
    if (local?.paRecords) setPaRecords(local.paRecords);
    // Layer 2 — optional cross-device refresh from Supabase.
    void syncUserDataFromSupabase(phone).then((remote) => {
      if (!remote) return;
      if (remote.pipeline && (remote.updatedAt || "") > (local?.updatedAt || "")) {
        setStore(normalizePipelineStore(remote.pipeline, remote.currentRole ?? "scribe"));
      }
      if (remote.deniedClaims) setDeniedClaims(remote.deniedClaims);
      if (remote.arCalls) setArCalls(remote.arCalls);
      if (remote.paRecords) setPaRecords(remote.paRecords);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Debounced save whenever encounter/AR/PA state changes.
  useEffect(() => {
    const phone = getLoggedInPhone();
    if (!phone) return;
    const t = setTimeout(
      () => saveUserData(phone, { pipeline: store, currentRole: store.currentRole, deniedClaims, arCalls, paRecords }),
      400
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, deniedClaims, arCalls, paRecords]);

  // ── Active encounter ─────────────────────────────────────────────
  const activeKey = encounterKey(store.activePatientId);
  const activeEncounter = store.encounters[activeKey] ?? EMPTY_ENCOUNTER;

  const state = useMemo<PipelineState>(
    () => ({ ...activeEncounter, demoFillMissingBoxes: store.demoFillMissingBoxes }),
    [activeEncounter, store.demoFillMissingBoxes],
  );

  const currentRole: Role = store.currentRole;

  /** Every mutation goes through here, so it always lands on the active patient. */
  const updateActive = (fn: (enc: PipelineEncounter) => PipelineEncounter) => {
    setStore((prev) => {
      const key = encounterKey(prev.activePatientId);
      const current = prev.encounters[key] ?? createEncounter(prev.activePatientId);
      return { ...prev, encounters: { ...prev.encounters, [key]: fn(current) } };
    });
  };

  const getEncounter = (patientId: string | null) => store.encounters[encounterKey(patientId)];

  /** Load a patient's encounter. Creates a blank one the first time only. */
  const selectPatient = (patientId: string | null) => {
    setStore((prev) => {
      const key = encounterKey(patientId);
      const existing = prev.encounters[key];
      const encounter = existing ?? createEncounter(patientId);
      // Reopen the patient where they were left: their own role when the
      // student picked one, otherwise the stage their work reached.
      const restoredRole = restoredRoleFor(encounter);
      if (prev.activePatientId === patientId && existing) {
        return prev.currentRole === restoredRole ? prev : { ...prev, currentRole: restoredRole };
      }
      return {
        ...prev,
        activePatientId: patientId,
        encounters: existing ? prev.encounters : { ...prev.encounters, [key]: encounter },
        currentRole: restoredRole,
      };
    });
  };

  const setRole = (role: Role) => {
    setStore((prev) => {
      const key = encounterKey(prev.activePatientId);
      // Write the role onto the encounter even when it does not exist yet, so a
      // role picked before the encounter was created still belongs to it.
      const enc = prev.encounters[key] ?? createEncounter(prev.activePatientId);
      return {
        ...prev,
        currentRole: role,
        encounters: { ...prev.encounters, [key]: { ...enc, role } },
      };
    });
  };

  const setPatientDisplayName = (name: string | null) => {
    updateActive((enc) => ({ ...enc, displayName: name }));
  };

  // Pre-fill coding data for the tutorial patient.
  const prefillForTutorial = () => {
    updateActive((enc) => ({
      ...enc,
      icdCodes: ["I10", "I25.10", "R07.9"],
      cptCodes: ["99214", "93000"],
      status: "charted",
      stage: "coder",
      role: "coder",
    }));
  };

  // Start an encounter over. A plain patient switch must never call this.
  const resetEncounter = (patientId?: string | null) => {
    setStore((prev) => {
      const target = patientId === undefined ? prev.activePatientId : patientId;
      const key = encounterKey(target);
      return {
        ...prev,
        activePatientId: target,
        encounters: { ...prev.encounters, [key]: createEncounter(target) },
        currentRole: "scribe",
      };
    });
  };

  // Auto-advance: Scribe → Coder
  const submitToCoding = (note: string) => {
    updateActive((enc) => ({
      ...enc,
      scribeNote: note,
      stage: "coder",
      status: "charted",
    }));
  };

  // Auto-advance: Coder → Prior Auth (PA first)
  const submitToBilling = (icdCodes: string[], cptCodes: string[], lines?: ClaimServiceLine[]) => {
    updateActive((enc) => ({
      ...enc,
      icdCodes,
      cptCodes,
      codingLines: lines ?? enc.codingLines,
      stage: "prior-auth",
      status: "coded",
    }));
  };

  // ── Structured CMS-1500 record ──────────────────────────────────
  const setClaimForm = (form: ClaimFormData | null) => {
    updateActive((enc) => ({ ...enc, claimForm: form }));
  };

  const patchClaimForm = (patch: Partial<ClaimFormData>) => {
    updateActive((enc) => ({
      ...enc,
      claimForm: enc.claimForm ? { ...enc.claimForm, ...patch } : enc.claimForm,
    }));
  };

  // Instructor / exam-mode switch. Persisted with the rest of the store, so an
  // assessment session keeps the paper free of demo values.
  const setDemoFillMissingBoxes = (enabled: boolean) => {
    setStore((prev) => ({ ...prev, demoFillMissingBoxes: enabled }));
  };

  // PA submission — don't change status; claim isn't submitted yet
  const submitPA = (paData: Record<string, string>) => {
    updateActive((enc) => ({
      ...enc,
      paData,
      stage: "biller",
      // Keep existing status (typically "coded") — status = "paid" only after actual claim settlement
      denialInfo: null,
    }));
  };

  // Auto-advance: Biller submits claim → AR Voice
  const submitClaim = (claimData: Record<string, string>) => {
    updateActive((enc) => ({
      ...enc,
      claimData,
      stage: "ar-voice",
      status: "billed",
    }));
  };

  // Denial from Biller stage — routes to the active patient's AR row
  const handleDenial = (denialCode: string, meta?: { amount?: number; patientName?: string }) => {
    const patientId = store.activePatientId;
    const denial: DeniedClaim = {
      id: `denial-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      encounterId: patientId ?? "unknown",
      patientName: meta?.patientName ?? activeEncounter.displayName ?? "",
      reason: denialCode,
      amount: meta?.amount ?? 0,
      deniedAt: new Date().toISOString(),
      agingBucket: "0-30",
      resolutionStatus: "unresolved",
    };
    setDeniedClaims((d) => [...d, denial]);
    updateActive((enc) => ({
      ...enc,
      status: "denied",
      denialInfo: { code: denialCode, reason: "Claim denied", amount: meta?.amount ?? 0 },
    }));
  };

  // Complete pipeline — called when all stages are done
  const completePipeline = () => {
    updateActive((enc) => ({
      ...enc,
      stage: "complete",
      status: "paid",
    }));
  };

  // AR functions — the ledger spans patients, so these stay global.
  const resolveDenial = (claimId: string, status: DeniedClaim["resolutionStatus"]) => {
    setDeniedClaims((prev) =>
      prev.map((c) =>
        c.id === claimId
          ? { ...c, resolutionStatus: status, agingBucket: determineAgingBucket(c.deniedAt) }
          : c
      )
    );
  };

  const addCallRecord = (record: ARCallRecord) => {
    setArCalls((prev) => [...prev, record]);
  };

  const assignDenial = (claimId: string, agent: string) => {
    setDeniedClaims((prev) =>
      prev.map((c) => (c.id === claimId ? { ...c, assignedTo: agent } : c))
    );
  };

  const getClaimsByAging = () => {
    const buckets: Record<string, DeniedClaim[]> = {
      "0-30": [],
      "31-60": [],
      "61-90": [],
      "90+": [],
    };
    deniedClaims.forEach((c) => {
      const bucket = determineAgingBucket(c.deniedAt);
      buckets[bucket].push(c);
    });
    return buckets;
  };

  // PA lifecycle functions
  const addPARecord = (record: PARecordStore) => {
    setPaRecords((prev) => {
      // Replace existing record for same patient/procedure, or add new
      const existing = prev.findIndex((r) => r.patientId === record.patientId && r.id === record.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = record;
        return updated;
      }
      return [...prev, record];
    });
  };

  const updatePAStatus = (id: string, status: string) => {
    setPaRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r))
    );
  };

  const getRoleLabel = (role: Role) => ROLE_LABELS[role] ?? role;

  return (
    <PipelineContext.Provider
      value={{
        state,
        activePatientId: store.activePatientId,
        selectPatient,
        getEncounter,
        currentRole,
        setRole,
        submitToCoding,
        submitToBilling,
        submitClaim,
        setClaimForm,
        patchClaimForm,
        setDemoFillMissingBoxes,
        handleDenial,
        submitPA,
        completePipeline,
        getRoleLabel,
        deniedClaims,
        arCalls,
        resolveDenial,
        addCallRecord,
        assignDenial,
        getClaimsByAging,
        paRecords,
        addPARecord,
        updatePAStatus,
        resetEncounter,
        setPatientDisplayName,
        prefillForTutorial,
      }}
    >
      {children}
    </PipelineContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────

export function usePipeline(): PipelineContextValue {
  const ctx = useContext(PipelineContext);
  if (!ctx) throw new Error("usePipeline must be used within a PipelineProvider");
  return ctx;
}
