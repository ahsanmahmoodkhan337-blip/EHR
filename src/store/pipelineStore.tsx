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

import { createContext, useContext, useState, type ReactNode } from "react";

// ─── Types ────────────────────────────────────────────────────────

export type Role = "scribe" | "coder" | "biller" | "prior-auth" | "ar-voice";

export interface PipelineState {
  patientId: string | null;
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
  handleDenial: (denialCode: string) => void;
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
  resetEncounter: () => void;
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

const STAGE_ORDER: Role[] = ["scribe", "coder", "prior-auth", "biller", "ar-voice"];

// ─── Provider ──────────────────────────────────────────────────────

export function PipelineProvider({ children }: { children: ReactNode }) {
  const [pipeline, setPipeline] = useState<PipelineState>({
    patientId: null,
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

  const setRole = (role: Role) => {
    setCurrentRole(role);
  };

  // Reset per-encounter data when switching patients
  const resetEncounter = () => {
    setPipeline((prev) => ({
      ...prev,
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
  const handleDenial = (denialCode: string) => {
    setPipeline((prev) => {
      const denial: DeniedClaim = {
        id: `denial-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        encounterId: prev.patientId ?? "unknown",
        patientName: "",
        reason: denialCode,
        amount: 0,
        deniedAt: new Date().toISOString(),
        agingBucket: "0-30",
        resolutionStatus: "unresolved",
      };
      setDeniedClaims((d) => [...d, denial]);
      return {
        ...prev,
        status: "denied",
        denialInfo: { code: denialCode, reason: "Claim denied", amount: 0 },
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