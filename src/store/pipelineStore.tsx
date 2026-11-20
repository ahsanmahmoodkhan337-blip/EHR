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
  encounterEventId,
  encounterKey,
  EMPTY_ENCOUNTER,
  jobRoleFor,
  normalizePipelineStore,
  restoredRoleFor,
  type ClaimFormData,
  type ClaimServiceLine,
  type PipelineEncounter,
  type PipelineState,
  type PipelineStoreState,
  type Role,
} from "./pipelineEncounter";
import { nextClaimNumber, type ClaimStatus, type ReasonCode } from "../domain/claimStatus";
import { buildSubmissionEvents } from "../domain/clearinghouse";
import {
  adjudicateClaim as adjudicateClaimDomain,
  planForPayerName,
  remittanceForClaim,
  type Remittance835,
} from "../domain/adjudication";
import { appendLedgerEntries, postRemittanceToLedger } from "../domain/ledger";
import {
  appendStatusEvent as appendEvent,
  makeStatusEvent,
  type StatusEventInput,
} from "../domain/statusEvent";

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
  /** Holds the patient id in records written before v4; kept for old callers. */
  encounterId: string;
  patientName: string;
  reason: string;
  amount: number;
  deniedAt: string;
  agingBucket: "0-30" | "31-60" | "61-90" | "90+";
  resolutionStatus: "unresolved" | "in-progress" | "resolved" | "escalated";
  assignedTo?: string;
  notes?: string;
  /**
   * The patient this denial belongs to. Null means unassigned — the row still
   * shows, as "no patient attached" (status-engine.md §8).
   */
  patientId?: string | null;
  /** The claim the denial belongs to. In this build a claim's id is its number. */
  claimId?: string;
  claimNumber?: string;
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
  /**
   * Append one entry to the active patient's timeline. Append-only and
   * idempotent: appending a transition that is already recorded changes
   * nothing, and there is no way to edit or delete an entry.
   */
  appendStatusEvent: (input: StatusEventInput) => void;
  /**
   * Transmit the active patient's claim to the clearinghouse: the 837P goes out
   * and the 277CA comes back. Ready, Submitted and the outcome are recorded in
   * one store write, so the claim's status never exists without its timeline.
   * The outcome is read back off the timeline with `ackForClaim`.
   */
  transmitClaim: (input: {
    /** Box 1a as submitted. */
    subscriberId: string;
    /** Box 1a as the coverage record holds it. */
    subscriberIdOnFile: string;
    /** Box 3 as submitted. */
    patientDob: string;
    /** Box 3 as the chart holds it. */
    patientDobOnFile: string;
    lineCount: number;
    payerName?: string;
  }) => void;
  handleDenial: (denialCode: string, meta?: { amount?: number; patientName?: string }) => void;
  /**
   * Ask the payer to adjudicate the active patient's accepted claim. The payer's
   * 835 comes back priced against the plan's rules (allowance, deductible,
   * coinsurance, contractual write-off, any denial CARC) and is stored on the
   * encounter. **No money moves here** — nothing is paid and the ledger is
   * untouched until the 835 is posted.
   */
  adjudicateClaim: (input?: { payerName?: string }) => void;
  /**
   * Post the 835 the payer sent to the patient ledger. One store write adds the
   * charge, insurance payment and adjustment entries, records the posting and
   * the patient balance on the claim's timeline, and moves the claim's status.
   * Idempotent: posting the same 835 twice adds no money.
   */
  postRemittance: () => void;
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

// ─── The money cycle: what a posted 835 does to the claim ──────────

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Where the claim stands once its 835 is posted. Read from the money alone:
 * a claim some of whose lines paid and some of whose lines were written off is
 * partially paid; a claim nobody paid and nobody owes is a contractual
 * write-off; a claim the plan paid nothing on but the patient owes is the
 * patient's. A patient balance never closes a claim (`domain/claimStatus.ts`).
 */
function claimStatusForRemittance(remittance: Remittance835): ClaimStatus {
  const { paidCents, deniedCents, patientRespCents } = remittance.totals;
  if (paidCents > 0 && deniedCents > 0) return "partially_paid";
  if (paidCents > 0) return "paid";
  if (deniedCents > 0) return patientRespCents === 0 ? "written_off" : "denied";
  if (patientRespCents > 0) return "patient_responsibility";
  return "denied";
}

/** One plain sentence for the timeline, naming the money and who carries it. */
function remittanceReason(remittance: Remittance835): string {
  const { paidCents, patientRespCents, writeOffCents, allowedCents, deniedCents } = remittance.totals;
  if (remittance.outcome === "paid_in_full") {
    return `Paid in full: the plan paid ${money(paidCents)} of ${money(allowedCents)} allowed. The patient's ${money(
      patientRespCents,
    )} (deductible and coinsurance) is now on the ledger as their balance.`;
  }
  if (remittance.outcome === "partially_paid") {
    return `Partially paid: ${money(paidCents)} paid, ${money(deniedCents)} denied, ${money(
      writeOffCents,
    )} written off. The patient's ${money(patientRespCents)} is on the ledger; the denied lines are for the AR queue.`;
  }
  if (remittance.outcome === "patient_responsibility") {
    return `Nothing paid by the plan: the whole ${money(patientRespCents)} allowed is the patient's responsibility and is on the ledger. No write-off.`;
  }
  return `Denied with no patient balance: ${money(deniedCents)} written off as contractual (${money(
    writeOffCents,
  )} in total adjustments). Nothing is owed by the patient.`;
}

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
    updateActive((enc) => {
      // The timeline entry is written in the same store write as the status it
      // records — a status change never exists without its event.
      const event = makeStatusEvent(
        {
          entityType: "encounter",
          entityId: encounterEventId(enc.patientId),
          patientId: enc.patientId,
          from: "open",
          to: "signed",
          by: getLoggedInPhone() ?? "system",
          jobRole: "scribe",
          reasonCode: "NOTE_SIGNED",
          reason: "The progress note was signed and locked, so the encounter is ready for coding.",
        },
        enc.statusEvents,
      );
      return {
        ...enc,
        scribeNote: note,
        stage: "coder",
        status: "charted",
        statusEvents: appendEvent(enc.statusEvents, event),
      };
    });
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
    setStore((prev) => {
      const key = encounterKey(prev.activePatientId);
      const enc = prev.encounters[key] ?? createEncounter(prev.activePatientId);
      if (!form) {
        return { ...prev, encounters: { ...prev.encounters, [key]: { ...enc, claimForm: null } } };
      }
      // The claim exists from the first time its paper is opened. Its number is
      // minted once and recorded with its creation event in the same write — a
      // second open never mints a second number or a second event.
      if (enc.claimNumber) {
        return { ...prev, encounters: { ...prev.encounters, [key]: { ...enc, claimForm: form } } };
      }
      const claimNumber = nextClaimNumber(Object.values(prev.encounters).map((e) => e.claimNumber));
      const event = makeStatusEvent(
        {
          entityType: "claim",
          entityId: claimNumber,
          patientId: enc.patientId,
          claimNumber,
          from: null,
          to: "draft",
          by: getLoggedInPhone() ?? "system",
          jobRole: jobRoleFor(restoredRoleFor(enc)),
          reasonCode: "CLAIM_CREATED",
          reason: `Claim ${claimNumber} created from this encounter. Nothing has been scrubbed or submitted yet.`,
        },
        enc.statusEvents,
      );
      return {
        ...prev,
        encounters: {
          ...prev.encounters,
          [key]: {
            ...enc,
            claimForm: form,
            claimNumber,
            claimStatus: "draft" as ClaimStatus,
            claimStatusMigrated: false,
            statusEvents: appendEvent(enc.statusEvents, event),
          },
        },
      };
    });
  };

  /**
   * The one way to add a timeline entry. There is deliberately no update and no
   * delete: the engine's audit log has to be append-only to be worth anything.
   * A claim transition moves the claim's status in the same write.
   */
  const appendStatusEvent = (input: StatusEventInput) => {
    setStore((prev) => {
      const patientId = input.patientId ?? prev.activePatientId;
      const key = encounterKey(patientId);
      const enc = prev.encounters[key] ?? createEncounter(patientId);
      const event = makeStatusEvent({ ...input, patientId }, enc.statusEvents);
      const events = appendEvent(enc.statusEvents, event);
      if (events === enc.statusEvents) return prev; // already recorded — nothing changes
      return {
        ...prev,
        encounters: {
          ...prev.encounters,
          [key]: {
            ...enc,
            statusEvents: events,
            claimStatus:
              event.entityType === "claim" && event.claimNumber === enc.claimNumber
                ? (event.to as ClaimStatus)
                : enc.claimStatus,
          },
        },
      };
    });
  };

  /**
   * Clearinghouse submission (money-cycle items 8 and 9). One write appends the
   * 837P, the 277CA and — on a first transmission — the edit checks passing, and
   * moves the claim's status to whatever the 277CA said. A rejection leaves the
   * claim on the biller's desk: it never becomes a denial, and no money moves.
   */
  const transmitClaim: PipelineContextValue["transmitClaim"] = (input) => {
    setStore((prev) => {
      const key = encounterKey(prev.activePatientId);
      const enc = prev.encounters[key] ?? createEncounter(prev.activePatientId);
      // No claim number, no claim: the paper mints it when it first opens.
      if (!enc.claimNumber) return prev;
      const { events, ack } = buildSubmissionEvents({
        facts: {
          track: "medical",
          claimNumber: enc.claimNumber,
          subscriberId: input.subscriberId,
          subscriberIdOnFile: input.subscriberIdOnFile,
          patientDob: input.patientDob,
          patientDobOnFile: input.patientDobOnFile,
        },
        from: enc.claimStatus,
        patientId: enc.patientId,
        by: getLoggedInPhone() ?? "system",
        jobRole: "biller",
        lineCount: input.lineCount,
        payerName: input.payerName,
        existing: enc.statusEvents,
      });
      // Every row was already recorded — a double-click adds nothing.
      if (events === enc.statusEvents) return prev;
      return {
        ...prev,
        encounters: {
          ...prev.encounters,
          [key]: {
            ...enc,
            statusEvents: events,
            claimStatus: (ack.category === "A1" ? "accepted" : "rejected") as ClaimStatus,
            claimStatusMigrated: false,
          },
        },
      };
    });
  };

  /**
   * The payer adjudicates the accepted claim (money-cycle items 1, 3 and 5).
   * One write stores the 835 and records its arrival on the claim's timeline.
   * The 835 is priced against the plan's rules from `domain/adjudication.ts`;
   * nothing on this screen invents an amount, and no money moves yet.
   */
  const adjudicateClaim: PipelineContextValue["adjudicateClaim"] = (input) => {
    setStore((prev) => {
      const key = encounterKey(prev.activePatientId);
      const enc = prev.encounters[key] ?? createEncounter(prev.activePatientId);
      if (!enc.claimNumber) return prev;
      // Only an accepted claim reaches adjudication: a rejected or unsubmitted
      // claim has never been to the payer.
      if (enc.claimStatus !== "accepted") return prev;
      // Already adjudicated — a second press changes nothing.
      if (remittanceForClaim(enc.remittances, enc.claimNumber)) return prev;

      const payerName = (input?.payerName || enc.claimForm?.payerName || "").trim();
      const plan = planForPayerName(payerName);
      const lines = (enc.claimForm?.serviceLines ?? [])
        .filter((line) => (line.cpt ?? "").trim() !== "")
        .map((line) => ({
          cpt: line.cpt.trim(),
          modifiers: (Array.isArray(line.modifiers) ? line.modifiers : []).filter(Boolean),
          units: Number(line.units) > 0 ? Number(line.units) : 1,
          chargeCents: Math.round((Number(line.charge) || 0) * 100),
        }));
      if (lines.length === 0) return prev;

      const remittance = adjudicateClaimDomain({
        claimNumber: enc.claimNumber,
        payerName: payerName || "the payer",
        plan,
        lines,
        // The plan's deductible is what this member has still to meet; the
        // simulator records no accumulated deductible, so it starts unmet and
        // the 835 says so on every line it touches.
        deductibleRemainingCents: Math.round((plan?.deductibleUsd ?? 0) * 100),
        // Box 23: the authorisation number the claim actually carries.
        priorAuthNumber: enc.claimForm?.priorAuthNumber ?? "",
      });

      const event = makeStatusEvent(
        {
          entityType: "claim",
          entityId: enc.claimNumber,
          patientId: enc.patientId,
          claimNumber: enc.claimNumber,
          from: enc.claimStatus,
          to: "adjudicated",
          by: "system",
          jobRole: "system",
          reasonCode: "ERA_RECEIVED",
          reason: `835 ${remittance.checkOrEftNumber} received from ${remittance.payerName}: billed ${money(remittance.totals.billedCents)}, allowed ${money(
            remittance.totals.allowedCents,
          )}, paid ${money(remittance.totals.paidCents)}, patient ${money(remittance.totals.patientRespCents)}. Nothing has reached the ledger yet.`,
          amountCents: remittance.totals.paidCents,
          refs: { eraId: remittance.id, checkNumber: remittance.checkOrEftNumber },
        },
        enc.statusEvents,
      );

      return {
        ...prev,
        encounters: {
          ...prev.encounters,
          [key]: {
            ...enc,
            remittances: [...enc.remittances, remittance],
            claimStatus: "adjudicated" as ClaimStatus,
            claimStatusMigrated: false,
            statusEvents: appendEvent(enc.statusEvents, event),
          },
        },
      };
    });
  };

  /**
   * Post the 835 to the patient ledger (items 5 and 13). This is the write that
   * makes money move: charges, the insurance payment and the contractual
   * adjustments become ledger entries, the claim's timeline records the posting
   * and the patient balance, and the claim's status follows the money. One store
   * write, so a status never exists without the entries behind it.
   */
  const postRemittance: PipelineContextValue["postRemittance"] = () => {
    setStore((prev) => {
      const key = encounterKey(prev.activePatientId);
      const enc = prev.encounters[key] ?? createEncounter(prev.activePatientId);
      const remittance = remittanceForClaim(enc.remittances, enc.claimNumber);
      if (!remittance || remittance.postedAt) return prev;

      const at = new Date().toISOString();
      const by = getLoggedInPhone() ?? "system";
      const entries = postRemittanceToLedger(remittance, {
        patientId: enc.patientId,
        userId: by,
        at,
      });
      const ledger = appendLedgerEntries(enc.ledger, entries);
      if (ledger === enc.ledger) return prev; // already on the ledger — no second posting

      const posted: typeof remittance = { ...remittance, postedAt: at };
      const status = claimStatusForRemittance(remittance);
      let events = enc.statusEvents;

      const postEvent = makeStatusEvent(
        {
          entityType: "claim",
          entityId: remittance.claimNumber,
          patientId: enc.patientId,
          claimNumber: remittance.claimNumber,
          at,
          from: enc.claimStatus,
          to: "adjudicated",
          by,
          jobRole: "payment-poster",
          reasonCode: "ERA_POSTED",
          reason: `835 ${remittance.checkOrEftNumber} posted: ${entries.length} ledger entr${entries.length === 1 ? "y" : "ies"} — charges ${money(
            remittance.totals.billedCents,
          )}, insurance payment ${money(remittance.totals.paidCents)}, contractual write-off ${money(remittance.totals.writeOffCents)}.`,
          amountCents: remittance.totals.paidCents,
          refs: { eraId: remittance.id, checkNumber: remittance.checkOrEftNumber },
        },
        events,
      );
      events = appendEvent(events, postEvent);

      const outcomeCode: ReasonCode =
        remittance.outcome === "paid_in_full"
          ? "ERA_PAID_IN_FULL"
          : remittance.outcome === "partially_paid"
            ? "ERA_PARTIAL"
            : remittance.outcome === "patient_responsibility"
              ? "PATIENT_BALANCE_CREATED"
              : "ERA_DENIED";
      const outcomeEvent = makeStatusEvent(
        {
          entityType: "claim",
          entityId: remittance.claimNumber,
          patientId: enc.patientId,
          claimNumber: remittance.claimNumber,
          at,
          from: "adjudicated",
          to: status,
          by,
          jobRole: "payment-poster",
          reasonCode: outcomeCode,
          reason: remittanceReason(remittance),
          amountCents:
            remittance.outcome === "patient_responsibility"
              ? remittance.totals.patientRespCents
              : remittance.totals.paidCents,
          refs: { eraId: remittance.id, checkNumber: remittance.checkOrEftNumber },
        },
        events,
      );
      events = appendEvent(events, outcomeEvent);

      return {
        ...prev,
        encounters: {
          ...prev.encounters,
          [key]: {
            ...enc,
            ledger,
            remittances: enc.remittances.map((r) => (r.id === remittance.id ? posted : r)),
            claimStatus: status,
            claimStatusMigrated: false,
            statusEvents: events,
          },
        },
      };
    });
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
      patientId,
      claimId: activeEncounter.claimNumber ?? undefined,
      claimNumber: activeEncounter.claimNumber ?? undefined,
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
        appendStatusEvent,
        transmitClaim,
        adjudicateClaim,
        postRemittance,
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
