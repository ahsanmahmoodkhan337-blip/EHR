/**
 * DentalTrackStore.tsx — Dental RCM track state (context + per-phone persistence)
 *
 * Inspired by: the owner-required separation between dental and medical RCM
 * internals. This state lives entirely apart from the medical pipeline store:
 * different key, different shape, different lifecycle. Switching Medical ↔
 * Dental on the track switcher never reads or writes the other track's state.
 *
 * Persistence mirrors the app-wide pattern (localStorage keyed by the logged-in
 * phone, debounced saves, graceful degradation) but under its own namespace
 * `hh_dental_track_<phone>` so the two tracks cannot collide.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DENTAL_CASE_SCENARIOS,
  findCase,
  findDenial,
  type CaseTrap,
  type DentalCaseScenario,
} from "../../data/dental";
import { getLoggedInPhone } from "../../store/accessStore";
import type { ADAFormData } from "../../data/claims/adaLayout";

export type DentalStageName =
  | "case-select"
  | "briefing"
  | "planning"
  | "predetermination"
  | "coding"
  | "claim"
  | "claims"
  | "ar"
  | "ledger"
  | "debrief";

/** A single CDT line the student is building in the coding stage. */
export interface DentalClaimLine {
  id: string;
  code: string;
  tooth?: string;
  surfaces?: string;
  quadrant?: string; // area-of-oral-cavity code ("01".."04" | "10" | "20" | "00")
  priorPlacementDate?: string;
  dateOfService: string; // per-line DOS — Case 2 spans a benefit-year boundary
  feeUsd: number;
  predeterminationOnFile: boolean;
  attachments: string[];
  note?: string;
}

export interface DentalCallLogEntry {
  id: string;
  at: string;
  objective: string;
  note: string;
}

export type DentalLineResolution =
  | "not-handled"
  | "appealed"
  | "resubmitted"
  | "billed-patient"
  | "write-off"
  | "closed";

/** The six standard probing sites charted per tooth (buccal and lingual thirds). */
export type PerioSite = "mb" | "b" | "db" | "ml" | "l" | "dl";

/** Per-tooth periodontal findings, keyed by Universal designation. */
export interface PerioToothEntry {
  /** Probing depths in mm per site. Missing sites are unmeasured. */
  probing: Partial<Record<PerioSite, number | null>>;
  /** 0–3 (0 = normal, 3 = >1 mm of horizontal movement). */
  mobility: number | null;
  /** 0–3 furcation involvement — only meaningful on multi-rooted (molar) teeth. */
  furcation: number | null;
  /** Bleeding on probing. */
  bleeding: boolean;
  /** Gingival recession in mm (positive = recession). */
  recession: number | null;
}

/** A planned (not yet completed) treatment item in the treatment-planning stage. */
export interface TxPlanItem {
  id: string;
  code: string;
  tooth?: string;
  surfaces?: string;
  quadrant?: string;
  dateOfService: string;
  feeUsd: number;
  note?: string;
  /** Attachment types (attachmentRequirements.ts) gathered before treatment. */
  attachments: string[];
  /** "planned" = sitting in the plan; "accepted" = moved onto the claim. */
  status: "planned" | "accepted";
}

/** A patient or insurance payment posted to the ledger. */
export interface DentalPayment {
  id: string;
  amountUsd: number;
  source: "patient" | "insurance";
  method: string;
  at: string;
  note?: string;
}

/** A ledger adjustment (contractual write-off, courtesy, etc.). Positive = credit. */
export interface DentalAdjustment {
  id: string;
  amountUsd: number;
  type: "contractual-write-off" | "courtesy" | "other";
  at: string;
  note?: string;
}

export interface DentalTrackState {
  /** v2 added the structured ADA claim form (`adaForm`). */
  version: 2;
  /** null = no case loaded (case-select screen). */
  caseId: string | null;
  stage: DentalStageName;
  startedAt: string | null;
  completedAt: string | null;
  lines: DentalClaimLine[];
  claimSubmitted: boolean;
  /** Predetermination scenario (id) the student last requested, if any. */
  predeterminationScenarioId: string | null;
  /** Timestamp when the student requested a predetermination for the current plan. */
  predeterminationRequestedAt: string | null;
  /** Case-stage traps the student triggered (revealed in debrief), by trap id. */
  trapsTriggered: string[];
  /** Rubric points earned, keyed `stage-index`. */
  rubricByCriterion: Record<string, number>;
  arCallLog: DentalCallLogEntry[];
  lineResolutions: Record<string, DentalLineResolution>;
  /** Periodontal chart readings, keyed by Universal designation. */
  perio: Record<string, PerioToothEntry>;
  /** Treatment plan items (planning stage → seeding coding). */
  txPlan: TxPlanItem[];
  /** Posted payments (ledger). */
  payments: DentalPayment[];
  /** Posted adjustments / write-offs (ledger). */
  adjustments: DentalAdjustment[];
  /** Structured ADA 2019 claim record (box by box). Null until the claim opens. */
  adaForm: ADAFormData | null;
}

const STORAGE_PREFIX = "hh_dental_track_";

function freshState(): DentalTrackState {
  return {
    version: 2,
    caseId: null,
    stage: "case-select",
    startedAt: null,
    completedAt: null,
    lines: [],
    claimSubmitted: false,
    predeterminationScenarioId: null,
    predeterminationRequestedAt: null,
    trapsTriggered: [],
    rubricByCriterion: {},
    arCallLog: [],
    lineResolutions: {},
    perio: {},
    txPlan: [],
    payments: [],
    adjustments: [],
    adaForm: null,
  };
}

function keyFor(phone: string | null): string | null {
  return phone ? `${STORAGE_PREFIX}${phone}` : null;
}

function loadState(phone: string | null): DentalTrackState {
  const key = keyFor(phone);
  if (!key) return freshState();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw) as DentalTrackState;
    // v1 → v2: the ADA claim record was added; older tracks simply have none.
    if ((parsed as { version?: number }).version !== 1 && parsed.version !== 2) return freshState();
    return { ...freshState(), ...parsed, version: 2 };
  } catch {
    return freshState();
  }
}

interface DentalTrackApi {
  state: DentalTrackState;
  /** Structured ADA 2019 claim record (null until the claim screen seeds it). */
  adaForm: ADAFormData | null;
  /** Active case scenario (undefined when no case is selected). */
  activeCase: DentalCaseScenario | undefined;
  planId: string;
  // lifecycle
  selectCase: (caseId: string | null) => void;
  beginCase: () => void;
  goTo: (stage: DentalStageName) => void;
  resetTrack: () => void;
  // predetermination
  requestPredetermination: (scenarioId: string) => void;
  requestPredeterminationForPlan: () => void;
  // coding
  addLine: (line: DentalClaimLine) => void;
  updateLine: (id: string, patch: Partial<DentalClaimLine>) => void;
  removeLine: (id: string) => void;
  submitClaim: () => void;
  /** Persist the ADA claim form (debounced by the shell). */
  setAdaForm: (form: ADAFormData) => void;
  // ar
  logCall: (objective: string, note: string) => void;
  resolveLine: (lineId: string, resolution: DentalLineResolution) => void;
  triggerTrap: (trapId: string) => void;
  // perio
  setPerioTooth: (tooth: string, patch: Partial<PerioToothEntry>) => void;
  // treatment planning
  addPlanItem: (item: TxPlanItem) => void;
  updatePlanItem: (id: string, patch: Partial<TxPlanItem>) => void;
  removePlanItem: (id: string) => void;
  acceptPlan: () => void;
  // ledger
  postPayment: (payment: DentalPayment) => void;
  postAdjustment: (adjustment: DentalAdjustment) => void;
  removePayment: (id: string) => void;
  removeAdjustment: (id: string) => void;
  // scoring
  scoreTally: {
    maxPoints: number;
    earned: number;
    passingPoints: number;
    /** Points the app can actually score. */
    autoMaxPoints: number;
    /** Points the student has earned on the auto-scored rows. */
    autoEarned: number;
    /** Pass mark recalculated over the auto-scored rows only. */
    autoPassingPoints: number;
    /** Points sitting on instructor-reviewed rows. */
    pendingReviewPoints: number;
    criteria: { key: string; criterion: string; points: number; earned: number; autoScored: boolean }[];
  };
  traps: CaseTrap[];
}

const DentalTrackContext = createContext<DentalTrackApi | null>(null);

/**
 * Auto-score the mechanically-verifiable rubric criteria, and report which
 * criteria the app is able to score at all.
 *
 * TASK 0 item 9: some rubric rows describe work the UI gives the student no
 * scored action for — capturing subscriber details, asking the payer for the
 * last bitewing date, spotting the fluoride age cap. Those rows are
 * instructor-reviewed, so they are reported separately and excluded from the
 * pass threshold. A student who does everything the app offers must be able to
 * pass; before this change DCASE-001 put 50 of its 100 points on three steps
 * that could not be performed, against a pass mark of 70.
 *
 * Traps remain a parallel axis and are surfaced separately (spec §4.2:
 * rubric = the score, traps = the debrief).
 */
function computeEarned(
  state: DentalTrackState,
  activeCase: DentalCaseScenario | undefined,
): { earned: Record<string, number>; autoScored: Set<string> } {
  const earned: Record<string, number> = { ...state.rubricByCriterion };
  const autoScored = new Set<string>();
  if (!activeCase) return { earned, autoScored };

  const codes = state.lines.map((l) => l.code);
  const hasCode = (c: string) => codes.includes(c);
  const resolutions = Object.values(state.lineResolutions);
  const hasResolution = (r: DentalLineResolution) => resolutions.includes(r);

  activeCase.gradingRubric.criteria.forEach((c, idx) => {
    const key = `${c.stage}-${idx}`;
    const text = c.criterion.toLowerCase();
    let checkable = false;
    let hit = false;

    if (c.stage === "coding") {
      if (activeCase.id === "DCASE-001") {
        if (text.includes("routine recall")) {
          checkable = true;
          hit = hasCode("D0120") && !hasCode("D0150");
        }
        if (text.includes("cleaning code")) {
          checkable = true;
          hit = hasCode("D1110") && !hasCode("D1120");
        }
      } else if (activeCase.id === "DCASE-002") {
        if (text.includes("crown actually delivered")) {
          checkable = true;
          hit = hasCode("D2740") && !hasCode("D2790") && !hasCode("D2751");
        }
      } else if (activeCase.id === "DCASE-003") {
        if (text.includes("quadrant")) {
          checkable = true;
          hit = hasCode("D4341") && hasCode("D4342");
        }
      }
    } else if (c.stage === "claim") {
      // Submitting the claim is an action the app records, so every claim row
      // is machine-checkable.
      checkable = true;
      hit = state.claimSubmitted;
      if (activeCase.id === "DCASE-002") {
        const crown = state.lines.find((l) => l.code === "D2740");
        const buildup = state.lines.find((l) => l.code === "D2950");
        if (text.includes("cementation date")) hit = Boolean(crown && crown.dateOfService === "2027-01-08");
        if (text.includes("buildup documentation")) hit = Boolean(buildup && buildup.attachments.length > 0);
      }
    } else if (c.stage === "ar-follow-up") {
      if (activeCase.id === "DCASE-001" && text.includes("contractual")) {
        checkable = true;
        hit = hasResolution("write-off") && !hasResolution("appealed") && !hasResolution("billed-patient");
      } else if (activeCase.id === "DCASE-002" && text.includes("did not appeal")) {
        checkable = true;
        hit = !hasResolution("appealed") && state.arCallLog.length > 0;
      } else if (activeCase.id === "DCASE-003" && text.includes("periodontal maintenance")) {
        checkable = true;
        hit = state.arCallLog.some((e) => e.note.toLowerCase().includes("periodontal maintenance"));
      }
    }

    if (checkable) autoScored.add(key);
    if (hit) earned[key] = c.points;
  });

  return { earned, autoScored };
}

export function DentalTrackProvider({ children }: { children: ReactNode }) {
  const phone = getLoggedInPhone();
  const [state, setState] = useState<DentalTrackState>(() => loadState(phone));
  const phoneRef = useRef(phone);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-key on login change: a different phone must NEVER see the previous
  // student's dental track.
  useEffect(() => {
    if (phoneRef.current !== phone) {
      phoneRef.current = phone;
      setState(loadState(phone));
    }
  }, [phone]);

  // Debounced persisted save keyed by phone.
  useEffect(() => {
    const key = keyFor(phone);
    if (!key) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch {
        /* storage full / private mode — state stays in memory */
      }
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, phone]);

  const activeCase = useMemo(() => (state.caseId ? findCase(state.caseId) : undefined), [state.caseId]);
  const planId = activeCase?.planId ?? "PLAN-CASCADIA-PPO";

  const goTo = useCallback((stage: DentalStageName) => {
    setState((s) => ({ ...s, stage }));
  }, []);

  /** Record a requested predetermination scenario and jump to that stage. */
  const requestPredetermination = useCallback((scenarioId: string) => {
    setState((s) => ({ ...s, predeterminationScenarioId: scenarioId, stage: "predetermination" }));
  }, []);

  /** Request a predetermination of benefits for the current treatment plan. */
  const requestPredeterminationForPlan = useCallback(() => {
    setState((s) => ({ ...s, predeterminationRequestedAt: new Date().toISOString() }));
  }, []);

  const selectCase = useCallback((caseId: string | null) => {
    const found = caseId ? findCase(caseId) : undefined;
    if (caseId && !found) return;
    setState({
      ...freshState(),
      stage: found ? "briefing" : "case-select",
      caseId,
    });
  }, []);

  const beginCase = useCallback(() => {
    setState((s) => ({
      ...s,
      startedAt: new Date().toISOString(),
      stage: "planning",
      lines: [],
      claimSubmitted: false,
      predeterminationScenarioId: null,
      predeterminationRequestedAt: null,
      trapsTriggered: [],
      rubricByCriterion: {},
      arCallLog: [],
      lineResolutions: {},
      perio: {},
      txPlan: [],
      payments: [],
      adjustments: [],
    }));
  }, []);

  const resetTrack = useCallback(() => {
    setState(freshState());
  }, []);

  const addLine = useCallback((line: DentalClaimLine) => {
    setState((s) => ({ ...s, lines: [...s.lines, line] }));
  }, []);

  const updateLine = useCallback((id: string, patch: Partial<DentalClaimLine>) => {
    setState((s) => ({ ...s, lines: s.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  }, []);

  const removeLine = useCallback((id: string) => {
    setState((s) => ({ ...s, lines: s.lines.filter((l) => l.id !== id) }));
  }, []);

  const submitClaim = useCallback(() => {
    setState((s) => ({ ...s, claimSubmitted: true, stage: "claim" }));
  }, []);

  const setAdaForm = useCallback((form: ADAFormData) => {
    setState((s) => ({ ...s, adaForm: form }));
  }, []);

  const logCall = useCallback((objective: string, note: string) => {
    setState((s) => ({
      ...s,
      arCallLog: [...s.arCallLog, { id: `call-${Date.now()}`, at: new Date().toISOString(), objective, note }],
    }));
  }, []);

  const resolveLine = useCallback((lineId: string, resolution: DentalLineResolution) => {
    setState((s) => ({ ...s, lineResolutions: { ...s.lineResolutions, [lineId]: resolution } }));
  }, []);

  const triggerTrap = useCallback((trapId: string) => {
    setState((s) => (s.trapsTriggered.includes(trapId) ? s : { ...s, trapsTriggered: [...s.trapsTriggered, trapId] }));
  }, []);

  const setPerioTooth = useCallback((tooth: string, patch: Partial<PerioToothEntry>) => {
    setState((s) => {
      const existing = s.perio[tooth] ?? { probing: {}, mobility: null, furcation: null, bleeding: false, recession: null };
      return { ...s, perio: { ...s.perio, [tooth]: { ...existing, ...patch } } };
    });
  }, []);

  // ── treatment planning ───────────────────────────────────────────────
  const addPlanItem = useCallback((item: TxPlanItem) => {
    setState((s) => ({ ...s, txPlan: [...s.txPlan, item] }));
  }, []);

  const updatePlanItem = useCallback((id: string, patch: Partial<TxPlanItem>) => {
    setState((s) => ({ ...s, txPlan: s.txPlan.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  }, []);

  const removePlanItem = useCallback((id: string) => {
    setState((s) => ({ ...s, txPlan: s.txPlan.filter((p) => p.id !== id) }));
  }, []);

  /** Move every planned item onto the claim (seeds coding) and mark them accepted. */
  const acceptPlan = useCallback(() => {
    setState((s) => {
      const planned = s.txPlan.filter((p) => p.status === "planned");
      const lines: DentalClaimLine[] = planned.map((p) => ({
        id: p.id,
        code: p.code,
        tooth: p.tooth,
        surfaces: p.surfaces,
        quadrant: p.quadrant,
        dateOfService: p.dateOfService,
        feeUsd: p.feeUsd,
        predeterminationOnFile: false,
        attachments: p.attachments ?? [],
        note: p.note,
      }));
      return {
        ...s,
        lines,
        txPlan: s.txPlan.map((p) => (p.status === "planned" ? { ...p, status: "accepted" as const } : p)),
        stage: "coding",
      };
    });
  }, []);

  // ── ledger ───────────────────────────────────────────────────────────
  const postPayment = useCallback((payment: DentalPayment) => {
    setState((s) => ({ ...s, payments: [...s.payments, payment] }));
  }, []);

  const postAdjustment = useCallback((adjustment: DentalAdjustment) => {
    setState((s) => ({ ...s, adjustments: [...s.adjustments, adjustment] }));
  }, []);

  const removePayment = useCallback((id: string) => {
    setState((s) => ({ ...s, payments: s.payments.filter((p) => p.id !== id) }));
  }, []);

  const removeAdjustment = useCallback((id: string) => {
    setState((s) => ({ ...s, adjustments: s.adjustments.filter((a) => a.id !== id) }));
  }, []);

  const traps = useMemo(() => activeCase?.traps ?? [], [activeCase]);

  const scoreTally = useMemo(() => {
    const rubric = activeCase?.gradingRubric ?? { maxPoints: 0, passingPoints: 0, criteria: [] };
    const { earned: earnedMap, autoScored } = computeEarned(state, activeCase);
    const criteria = rubric.criteria.map((c, idx) => {
      const key = `${c.stage}-${idx}`;
      return {
        key,
        criterion: c.criterion,
        points: c.points,
        earned: earnedMap[key] ?? 0,
        autoScored: autoScored.has(key),
      };
    });
    const earned = criteria.reduce((sum, c) => sum + c.earned, 0);
    const autoRows = criteria.filter((c) => c.autoScored);
    const autoMaxPoints = autoRows.reduce((sum, c) => sum + c.points, 0);
    const autoEarned = autoRows.reduce((sum, c) => sum + c.earned, 0);
    // The pass mark keeps the rubric's own percentage, applied to the rows the
    // app can score — otherwise instructor-reviewed points would make it
    // unreachable.
    const passingPct = rubric.maxPoints > 0 ? rubric.passingPoints / rubric.maxPoints : 0;
    return {
      maxPoints: rubric.maxPoints,
      earned,
      passingPoints: rubric.passingPoints,
      autoMaxPoints,
      autoEarned,
      autoPassingPoints: Math.round(autoMaxPoints * passingPct),
      pendingReviewPoints: rubric.maxPoints - autoMaxPoints,
      criteria,
    };
  }, [state, activeCase]);

  const api: DentalTrackApi = {
    state,
    adaForm: state.adaForm,
    activeCase,
    planId,
    selectCase,
    beginCase,
    goTo,
    resetTrack,
    requestPredetermination,
    requestPredeterminationForPlan,
    addLine,
    updateLine,
    removeLine,
    submitClaim,
    setAdaForm,
    logCall,
    resolveLine,
    triggerTrap,
    setPerioTooth,
    addPlanItem,
    updatePlanItem,
    removePlanItem,
    acceptPlan,
    postPayment,
    postAdjustment,
    removePayment,
    removeAdjustment,
    scoreTally,
    traps,
  };

  return <DentalTrackContext.Provider value={api}>{children}</DentalTrackContext.Provider>;
}

export function useDentalTrack(): DentalTrackApi {
  const ctx = useContext(DentalTrackContext);
  if (!ctx) throw new Error("useDentalTrack must be used within a DentalTrackProvider");
  return ctx;
}

export const DENTAL_CASES = DENTAL_CASE_SCENARIOS;
export { findDenial };
