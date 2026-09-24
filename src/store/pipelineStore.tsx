/**
 * Pipeline Store — RCM Pipeline State (React Context)
 *
 * Tracks the full RCM pipeline for each patient encounter through 5 stages:
 *   [Charted] → [Coded] → [Billed (Bill)] → [Prior Auth] → [Paid/Denied/Reprocessed]
 *
 * Roles: Scribe, Coder, Biller, Prior Auth, AR Voice Specialist
 *
 * Submission functions auto-advance stages. The AR Voice Specialist
 * role handles denied claims with aging buckets and call resolution.
 */

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { getLoggedInPhone } from "./accessStore";
import { loadUserData, saveUserData, syncUserDataFromSupabase } from "./persistence";

// ─── Types ────────────────────────────────────────────────────────

export type Role = "scribe" | "coder" | "biller" | "prior-auth" | "ar-voice";

export interface PipelineState {
  patientId: string | null;
  displayName: string | null;  // override for custom/new patients from calendar
  stage: Role | "complete";
  status: "charted" | "coded" | "billed" | "paid" | "denied" | "reprocessed" | "pending";
  scribeNote: string;
  icdCodes: string[];
  cptCodes: string[];
  claimData: Record<string, string>;
  denialInfo: { code: string; reason: string; amount: number } | null;
  paData: Record<string, string>;
}

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
  state: PipelineState;
  currentRole: Role;
  setRole: (role: Role) => void;
  submitToCoding: (note: string) => void;
  submitToBilling: (icdCodes: string[], cptCodes: string[]) => void;
  submitClaim: (claimData: Record<string, string>) => void;
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
  resetEncounter: (newPatientId?: string) => void;
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


// ─── Provider ──────────────────────────────────────────────────────

export function PipelineProvider({ children }: { children: ReactNode }) {
  const [pipeline, setPipeline] = useState<PipelineState>({
    patientId: null,
    displayName: null,
    stage: "scribe",
    status: "pending",
    scribeNote: "",
    icdCodes: [],
    cptCodes: [],
    claimData: {},
    denialInfo: null,
    paData: {},
  });

  const [currentRole, setCurrentRole] = useState<Role>("scribe");
  const [deniedClaims, setDeniedClaims] = useState<DeniedClaim[]>([]);
  const [arCalls, setArCalls] = useState<ARCallRecord[]>([]);
  const [paRecords, setPaRecords] = useState<PARecordStore[]>([]);

  // ── Per-user persistence ─────────────────────────────────────────
  // Keyed by the logged-in student's phone (localStorage, always on), with an
  // optional Supabase refresh. Providers remount on login/logout, so scoping
  // to the phone at mount gives correct per-user isolation.
  useEffect(() => {
    const phone = getLoggedInPhone();
    if (!phone) {
      setCurrentRole("scribe");
      return;
    }
    const local = loadUserData(phone);
    if (local?.pipeline) setPipeline(local.pipeline);
    if (local?.currentRole) setCurrentRole(local.currentRole);
    if (local?.deniedClaims) setDeniedClaims(local.deniedClaims);
    if (local?.arCalls) setArCalls(local.arCalls);
    if (local?.paRecords) setPaRecords(local.paRecords);
    // Layer 2 — optional cross-device refresh from Supabase.
    void syncUserDataFromSupabase(phone).then((remote) => {
      if (!remote) return;
      if (remote.pipeline && (remote.updatedAt || "") > (local?.updatedAt || "")) setPipeline(remote.pipeline);
      if (remote.currentRole) setCurrentRole(remote.currentRole);
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
      () => saveUserData(phone, { pipeline, currentRole, deniedClaims, arCalls, paRecords }),
      400
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline, currentRole, deniedClaims, arCalls, paRecords]);

  const setRole = (role: Role) => {
    setCurrentRole(role);
  };

  const setPatientDisplayName = (name: string | null) => {
    setPipeline((prev) => ({ ...prev, displayName: name }));
  };

  // Pre-fill coding data for tutorial patient
  const prefillForTutorial = () => {
    setPipeline((prev) => ({
      ...prev,
      icdCodes: ["I10", "I25.10", "R07.9"],
      cptCodes: ["99214", "93000"],
      status: "charted",
      stage: "coder",
    }));
  };

  // Reset per-encounter data when switching patients. Accepts new patientId.
  const resetEncounter = (newPatientId?: string) => {
    setPipeline((prev) => ({
      ...prev,
      patientId: newPatientId || prev.patientId,
      displayName: null,
      scribeNote: "",
      icdCodes: [],
      cptCodes: [],
      claimData: {},
      denialInfo: null,
      paData: {},
      status: "pending",
      stage: "scribe",
    }));
  };

  // Auto-advance: Scribe → Coder
  const submitToCoding = (note: string) => {
    setPipeline((prev) => ({
      ...prev,
      scribeNote: note,
      stage: "coder",
      status: "charted",
    }));
  };

  // Auto-advance: Coder → Prior Auth (PA first)
  const submitToBilling = (icdCodes: string[], cptCodes: string[]) => {
    setPipeline((prev) => ({
      ...prev,
      icdCodes,
      cptCodes,
      stage: "prior-auth",
      status: "coded",
    }));
  };

  // PA submission — don't change status; claim isn't submitted yet
  const submitPA = (paData: Record<string, string>) => {
    setPipeline((prev) => ({
      ...prev,
      paData,
      stage: "biller",
      // Keep existing status (typically "coded") — status = "paid" only after actual claim settlement
      denialInfo: null,
    }));
  };

  // Auto-advance: Biller submits claim → AR Voice
  const submitClaim = (claimData: Record<string, string>) => {
    setPipeline((prev) => ({
      ...prev,
      claimData,
      stage: "ar-voice",
      status: "billed",
    }));
  };

  // Denial from Biller stage — routes to AR queue
  const handleDenial = (denialCode: string, meta?: { amount?: number; patientName?: string }) => {
    setPipeline((prev) => {
      const denial: DeniedClaim = {
        id: `denial-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        encounterId: prev.patientId ?? "unknown",
        patientName: meta?.patientName ?? "",
        reason: denialCode,
        amount: meta?.amount ?? 0,
        deniedAt: new Date().toISOString(),
        agingBucket: "0-30",
        resolutionStatus: "unresolved",
      };
      setDeniedClaims((d) => [...d, denial]);
      return {
        ...prev,
        status: "denied",
        denialInfo: { code: denialCode, reason: "Claim denied", amount: meta?.amount ?? 0 },
      };
    });
  };

  // Complete pipeline — called when all stages are done
  const completePipeline = () => {
    setPipeline((prev) => ({
      ...prev,
      stage: "complete",
      status: "paid",
    }));
  };

  // AR functions
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
        state: pipeline,
        currentRole,
        setRole,
        submitToCoding,
        submitToBilling,
        submitClaim,
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