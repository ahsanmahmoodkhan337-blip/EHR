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

/**
 * One row of box 24 on the CMS-1500 (02/12).
 * The spec's field names are kept as-is; the printed box each one feeds is in
 * the comment, because that is how the form and its validation talk.
 */
export interface ClaimServiceLine {
  dateOfService: string;   // 24A
  placeOfService: string;  // 24B
  cpt: string;             // 24D
  modifiers: string[];     // 24D
  diagnosisPointer: string;// 24E  e.g. "A" or "AB"
  charge: number;          // 24F
  units: number;           // 24G
  renderingNpi: string;    // 24J
}

/**
 * The structured CMS-1500 claim record — every printed box, keyed by the box
 * number in the comment. Sits alongside the legacy `claimData` string map so
 * nothing that reads that map breaks.
 */
export interface ClaimFormData {
  insuranceType: string;        // 1
  insuredId: string;            // 1a
  patientName: string;          // 2
  patientDob: string;           // 3
  patientSex: string;           // 3
  insuredName: string;          // 4
  patientAddress: string;       // 5
  patientRelationship: string;  // 6
  insuredAddress: string;       // 7
  otherInsuranceName: string;   // 9
  otherInsurancePlan: string;   // 9a
  conditionEmployment: boolean; // 10a
  conditionAuto: boolean;       // 10b
  conditionOther: boolean;      // 10c
  insuredPolicyGroup: string;   // 11
  insuredDob: string;           // 11a
  insuredEmployer: string;      // 11b
  insuredPlanName: string;      // 11c
  otherBenefitPlan: string;     // 11d
  patientSignature: boolean;    // 12
  insuredSignature: boolean;    // 13
  currentIllnessDate: string;   // 14
  similarIllnessDate: string;   // 15
  unableToWorkFrom: string;     // 16
  unableToWorkTo: string;       // 16
  referringProvider: string;    // 17
  referringNpi: string;         // 17b
  hospitalizationFrom: string;  // 18
  hospitalizationTo: string;    // 18
  additionalInfo: string;       // 19
  outsideLab: string;           // 20
  diagnosisCodes: string[];     // 21, A–L (12 slots)
  resubmissionCode: string;     // 22
  originalClaimNumber: string;  // 22a
  priorAuthNumber: string;      // 23
  serviceLines: ClaimServiceLine[]; // 24A–24J, max 6
  federalTaxId: string;         // 25
  patientAccountNumber: string; // 26
  acceptAssignment: string;     // 27
  totalCharge: number;          // 28
  amountPaid: number;           // 29
  balanceDue: number;           // 30
  providerSignature: string;    // 31
  providerSignatureDate: string;// 31
  facilityName: string;         // 32
  facilityAddress: string;      // 32
  facilityNpi: string;          // 32
  billingProviderName: string;  // 33
  billingProviderAddress: string; // 33
  billingProviderNpi: string;   // 33
  billingProviderTaxId: string; // 33
}

export interface PipelineState {
  patientId: string | null;
  displayName: string | null;  // override for custom/new patients from calendar
  stage: Role | "complete";
  status: "charted" | "coded" | "billed" | "paid" | "denied" | "reprocessed" | "pending";
  scribeNote: string;
  icdCodes: string[];
  cptCodes: string[];
  claimData: Record<string, string>;
  /** Structured CMS-1500 record (box-by-box). Null until the claim is opened. */
  claimForm: ClaimFormData | null;
  /** Per-line coding data handed over by the Coder stage (seeds box 24). */
  codingLines: ClaimServiceLine[];
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
  submitToBilling: (icdCodes: string[], cptCodes: string[], lines?: ClaimServiceLine[]) => void;
  submitClaim: (claimData: Record<string, string>) => void;
  // Structured CMS-1500 record
  setClaimForm: (form: ClaimFormData | null) => void;
  patchClaimForm: (patch: Partial<ClaimFormData>) => void;
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
    claimForm: null,
    codingLines: [],
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
      claimForm: null,
      codingLines: [],
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
  const submitToBilling = (icdCodes: string[], cptCodes: string[], lines?: ClaimServiceLine[]) => {
    setPipeline((prev) => ({
      ...prev,
      icdCodes,
      cptCodes,
      codingLines: lines ?? prev.codingLines,
      stage: "prior-auth",
      status: "coded",
    }));
  };

  // ── Structured CMS-1500 record ──────────────────────────────────
  const setClaimForm = (form: ClaimFormData | null) => {
    setPipeline((prev) => ({ ...prev, claimForm: form }));
  };

  const patchClaimForm = (patch: Partial<ClaimFormData>) => {
    setPipeline((prev) => ({
      ...prev,
      claimForm: prev.claimForm ? { ...prev.claimForm, ...patch } : prev.claimForm,
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
        setClaimForm,
        patchClaimForm,
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