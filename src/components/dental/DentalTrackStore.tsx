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
  findPracticeScenario,
  scorePracticeLine,
  type CaseTrap,
  type DentalCaseScenario,
} from "../../data/dental";
import { getLoggedInPhone } from "../../store/accessStore";
import { writeAutosaved } from "../../store/autosave";
import type { ADAFormData } from "../../data/claims/adaLayout";
import { mintClaimNumber, nextClaimNumber, type ClaimStatus } from "../../domain/claimStatus";
import { buildSubmissionEvents, type ClaimTrack } from "../../domain/clearinghouse";
import { appendStatusEvent, makeStatusEvent, type StatusEvent } from "../../domain/statusEvent";

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

/**
 * Every stage a dental case URL may name, in order. The stepper and the URL
 * both rank stages against this list.
 */
export const DENTAL_STAGE_ORDER: DentalStageName[] = [
  "case-select",
  "briefing",
  "planning",
  "predetermination",
  "coding",
  "claim",
  "claims",
  "ar",
  "ledger",
  "debrief",
];

function stageRank(stage: DentalStageName): number {
  const i = DENTAL_STAGE_ORDER.indexOf(stage);
  return i < 0 ? 0 : i;
}

/** The later of two stages — how "furthest reached" is advanced, never reset backwards. */
function furthestOf(a: DentalStageName, b: DentalStageName): DentalStageName {
  return stageRank(b) > stageRank(a) ? b : a;
}

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
  /** The AR line the call was made about — set by the practice bench only. */
  lineId?: string;
}

export type DentalLineResolution =
  | "not-handled"
  | "appealed"
  | "resubmitted"
  | "billed-patient"
  | "write-off"
  | "closed";

/** One line the student has committed in a practice scenario. */
export interface DentalPracticeDecision {
  resolution: DentalLineResolution;
  at: string;
}

/**
 * One practice scenario's own record. Keyed by scenario id in `state.practice`
 * and never written into a graded case's `lines`, `lineResolutions`,
 * `arCallLog` or rubric — the two namespaces cannot see each other.
 */
export interface DentalPracticeRun {
  scenarioId: string;
  openedAt: string;
  callLog: DentalCallLogEntry[];
  lineResolutions: Record<string, DentalLineResolution>;
  /** Committed lines. A line in here has had its answer key revealed. */
  decisions: Record<string, DentalPracticeDecision>;
}

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
  /**
   * v2 added the structured ADA claim form (`adaForm`); v3 added `furthestStage`;
   * v4 added the claim number and the append-only status timeline; v5 added the
   * AR practice bench slice (`practice`, `activePracticeId`).
   */
  version: 5;
  /** null = no case loaded (case-select screen). */
  caseId: string | null;
  stage: DentalStageName;
  /**
   * The furthest stage this student has reached for this case. The stepper reads
   * "done" and "locked" from it, so both survive a reload and a step backwards.
   */
  furthestStage: DentalStageName;
  startedAt: string | null;
  completedAt: string | null;
  lines: DentalClaimLine[];
  claimSubmitted: boolean;
  /**
   * The claim number minted for this case's claim (`domain/claimStatus.ts`).
   * Minted once, when the claim is first transmitted — never invented for a
   * migrated record beyond what `status-engine.md` §8 allows.
   */
  claimNumber: string | null;
  /** Where the claim stands. Null while no claim has been transmitted. */
  claimStatus: ClaimStatus | null;
  /** Append-only timeline: every status change, with who and why. */
  statusEvents: StatusEvent[];
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
  /**
   * AR practice runs, keyed by practice scenario id (`DAR-01`…). Separate from
   * everything above: a practice run can never appear in a graded case, its
   * debrief or its rubric.
   */
  practice: Record<string, DentalPracticeRun>;
  /** The practice scenario currently open, or null when the picker is showing. */
  activePracticeId: string | null;
  /** True while the student is on the AR practice bench (picker or a scenario). */
  practiceBenchOpen: boolean;
}

const STORAGE_PREFIX = "hh_dental_track_";

function freshState(): DentalTrackState {
  return {
    version: 5,
    caseId: null,
    stage: "case-select",
    furthestStage: "case-select",
    startedAt: null,
    completedAt: null,
    lines: [],
    claimSubmitted: false,
    claimNumber: null,
    claimStatus: null,
    statusEvents: [],
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
    practice: {},
    activePracticeId: null,
    practiceBenchOpen: false,
  };
}

/**
 * A fresh case record that keeps the AR practice runs. Starting, resetting or
 * switching a graded case must not delete practice work, and practice work must
 * never touch a graded case.
 */
function freshCase(state: DentalTrackState): DentalTrackState {
  return { ...freshState(), practice: state.practice };
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
    const parsed = JSON.parse(raw) as DentalTrackState & { version?: number };
    // v1 → v2: the ADA claim record was added; older tracks simply have none.
    // v2 → v3: the stepper now remembers how far the student got. A v2 record
    // only knows the stage it stopped on, so that stage is carried forward as
    // the furthest reached — nothing is invented, and no work is dropped.
    // v3 → v4: the claim gets a number and a timeline. A record whose claim was
    // already submitted has no 277CA behind it, so it is carried forward as
    // `submitted` — never as accepted — and says so in its own MIGRATED entry.
    const version = (parsed as { version?: number }).version;
    if (version !== 1 && version !== 2 && version !== 3 && version !== 4 && version !== 5) return freshState();
    // v4 → v5: the AR practice bench was added. An older record simply has no
    // practice runs, so it starts with none — nothing is invented and no case
    // work is touched.
    const migrated: DentalTrackState = {
      ...freshState(),
      ...parsed,
      version: 5,
      furthestStage: parsed.furthestStage ?? parsed.stage ?? "case-select",
      claimNumber: parsed.claimNumber ?? null,
      claimStatus: parsed.claimStatus ?? null,
      statusEvents: Array.isArray(parsed.statusEvents) ? parsed.statusEvents : [],
      practice: parsed.practice && typeof parsed.practice === "object" ? parsed.practice : {},
      activePracticeId: parsed.activePracticeId ?? null,
      practiceBenchOpen: parsed.practiceBenchOpen === true,
    };
    if (version < 4 && migrated.claimSubmitted && !migrated.claimNumber) {
      const claimNumber = mintClaimNumber(1);
      const patientId = migrated.caseId ? findCase(migrated.caseId)?.patient?.id ?? null : null;
      const event = makeStatusEvent(
        {
          entityType: "claim",
          entityId: claimNumber,
          patientId,
          claimNumber,
          from: null,
          to: "submitted",
          by: "system",
          jobRole: "system",
          reasonCode: "MIGRATED",
          reason:
            "Carried forward from an earlier saved dental record. The claim had been submitted, but no 277CA was ever recorded, so it is not marked accepted. Its claim number was minted at migration so the claim can be named.",
          ...(migrated.startedAt ? { at: migrated.startedAt } : {}),
        },
        [],
      );
      return {
        ...migrated,
        claimNumber,
        claimStatus: "submitted",
        statusEvents: appendStatusEvent([], event),
      };
    }
    return migrated;
  } catch {
    return freshState();
  }
}

/**
 * What the dental clearinghouse checks, read from the ADA claim as the student
 * submitted it: box 9 against the coverage record, box 15 against the chart.
 */
export interface DentalSubmissionFacts {
  subscriberId: string;
  subscriberIdOnFile: string;
  patientDob: string;
  patientDobOnFile: string;
  lineCount: number;
  payerName?: string;
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
  /**
   * Transmit the ADA claim to the clearinghouse: the 837D, then the 277CA.
   * Ready, Submitted and the outcome land in one write. A rejection returns the
   * claim to this stage for correction and never becomes a denial.
   */
  submitClaim: (facts: DentalSubmissionFacts) => void;
  /** Persist the ADA claim form (debounced by the shell). */
  setAdaForm: (form: ADAFormData) => void;
  // ar
  logCall: (objective: string, note: string) => void;
  resolveLine: (lineId: string, resolution: DentalLineResolution) => void;
  triggerTrap: (trapId: string) => void;
  // ar practice bench (its own namespace — never a graded case's record)
  practice: Record<string, DentalPracticeRun>;
  activePracticeId: string | null;
  /** True while the bench is on screen (picker or a scenario). */
  practiceBenchOpen: boolean;
  /** Open the bench on a scenario, or on the picker with `null`. */
  openPractice: (scenarioId: string | null) => void;
  /** Leave the bench and go back to the case picker. */
  closePractice: () => void;
  practiceLogCall: (scenarioId: string, lineId: string, objective: string, note: string) => void;
  /** Commit one line. The key is scored here and nowhere earlier. */
  practiceResolveLine: (scenarioId: string, lineId: string, resolution: DentalLineResolution) => void;
  /** Clear a committed line so the student can decide again. */
  practiceResetLine: (scenarioId: string, lineId: string) => void;
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
      // Reports into the one autosave indicator (spec item 9): "Saving…", then
      // "Saved 14:32" or "Not saved" with the reason. Never swallowed.
      writeAutosaved(key, JSON.stringify(state), "Dental case");
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, phone]);

  // The provider unmounts when the student moves between the case-picker route
  // and a stage route, and the save above is debounced. Flush the latest state
  // on unmount so a route change can never reload an older copy of the record.
  const latestState = useRef(state);
  latestState.current = state;
  useEffect(() => {
    return () => {
      const key = keyFor(phoneRef.current);
      if (!key) return;
      writeAutosaved(key, JSON.stringify(latestState.current), "Dental case");
    };
  }, []);

  const activeCase = useMemo(() => (state.caseId ? findCase(state.caseId) : undefined), [state.caseId]);
  const planId = activeCase?.planId ?? "PLAN-CASCADIA-PPO";

  const goTo = useCallback((stage: DentalStageName) => {
    setState((s) => ({ ...s, stage, furthestStage: furthestOf(s.furthestStage, stage) }));
  }, []);

  /** Record a requested predetermination scenario and jump to that stage. */
  const requestPredetermination = useCallback((scenarioId: string) => {
    setState((s) => ({
      ...s,
      predeterminationScenarioId: scenarioId,
      stage: "predetermination",
      furthestStage: furthestOf(s.furthestStage, "predetermination"),
    }));
  }, []);

  /** Request a predetermination of benefits for the current treatment plan. */
  const requestPredeterminationForPlan = useCallback(() => {
    setState((s) => ({ ...s, predeterminationRequestedAt: new Date().toISOString() }));
  }, []);

  const selectCase = useCallback((caseId: string | null) => {
    const found = caseId ? findCase(caseId) : undefined;
    if (caseId && !found) return;
    const openingStage: DentalStageName = found ? "briefing" : "case-select";
    setState((s) => ({
      ...freshCase(s),
      stage: openingStage,
      furthestStage: openingStage,
      caseId,
    }));
  }, []);

  const beginCase = useCallback(() => {
    setState((s) => ({
      ...s,
      activePracticeId: null,
      practiceBenchOpen: false,
      startedAt: new Date().toISOString(),
      stage: "planning",
      furthestStage: furthestOf(s.furthestStage, "planning"),
      lines: [],
      claimSubmitted: false,
      claimNumber: null,
      claimStatus: null,
      statusEvents: [],
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
    // A case reset clears the case, not the practice bench: practice runs are
    // the student's own drills and are kept.
    setState((s) => freshCase(s));
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

  const submitClaim = useCallback((facts: DentalSubmissionFacts) => {
    setState((s) => {
      const claimNumber = s.claimNumber ?? nextClaimNumber([s.claimNumber]);
      const patientId = s.caseId ? findCase(s.caseId)?.patient?.id ?? null : null;
      const { events, ack } = buildSubmissionEvents({
        facts: {
          track: "dental" as ClaimTrack,
          claimNumber,
          subscriberId: facts.subscriberId,
          subscriberIdOnFile: facts.subscriberIdOnFile,
          patientDob: facts.patientDob,
          patientDobOnFile: facts.patientDobOnFile,
        },
        from: s.claimStatus,
        patientId,
        by: getLoggedInPhone() ?? "system",
        jobRole: "biller",
        lineCount: facts.lineCount,
        payerName: facts.payerName,
        existing: s.statusEvents,
      });
      return {
        ...s,
        claimNumber,
        claimSubmitted: true,
        claimStatus: (ack.category === "A1" ? "accepted" : "rejected") as ClaimStatus,
        statusEvents: events,
        stage: "claim",
      };
    });
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

  // ── AR practice bench ────────────────────────────────────────────────
  const openPractice = useCallback((scenarioId: string | null) => {
    if (scenarioId && !findPracticeScenario(scenarioId)) return;
    setState((s) => {
      if (!scenarioId) return { ...s, practiceBenchOpen: true, activePracticeId: null };
      const existing = s.practice[scenarioId];
      return {
        ...s,
        practiceBenchOpen: true,
        activePracticeId: scenarioId,
        practice: existing
          ? s.practice
          : {
              ...s.practice,
              [scenarioId]: {
                scenarioId,
                openedAt: new Date().toISOString(),
                callLog: [],
                lineResolutions: {},
                decisions: {},
              },
            },
      };
    });
  }, []);

  const closePractice = useCallback(() => {
    setState((s) => ({ ...s, practiceBenchOpen: false, activePracticeId: null }));
  }, []);

  const practiceLogCall = useCallback((scenarioId: string, lineId: string, objective: string, note: string) => {
    setState((s) => {
      const run = s.practice[scenarioId];
      if (!run) return s;
      return {
        ...s,
        practice: {
          ...s.practice,
          [scenarioId]: {
            ...run,
            callLog: [
              ...run.callLog,
              { id: `prac-call-${Date.now()}`, at: new Date().toISOString(), objective, note, lineId },
            ],
          },
        },
      };
    });
  }, []);

  const practiceResolveLine = useCallback(
    (scenarioId: string, lineId: string, resolution: DentalLineResolution) => {
      const scenario = findPracticeScenario(scenarioId);
      if (!scenario) return;
      setState((s) => {
        const run = s.practice[scenarioId];
        if (!run) return s;
        // Scoring happens at the commit and nowhere earlier.
        if (!scorePracticeLine(scenario, lineId, resolution, run.callLog)) return s;
        return {
          ...s,
          practice: {
            ...s.practice,
            [scenarioId]: {
              ...run,
              lineResolutions: { ...run.lineResolutions, [lineId]: resolution },
              decisions: {
                ...run.decisions,
                [lineId]: { resolution, at: new Date().toISOString() },
              },
            },
          },
        };
      });
    },
    [],
  );

  const practiceResetLine = useCallback((scenarioId: string, lineId: string) => {
    setState((s) => {
      const run = s.practice[scenarioId];
      if (!run) return s;
      const lineResolutions = { ...run.lineResolutions };
      delete lineResolutions[lineId];
      const decisions = { ...run.decisions };
      delete decisions[lineId];
      return { ...s, practice: { ...s.practice, [scenarioId]: { ...run, lineResolutions, decisions } } };
    });
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
    practice: state.practice,
    activePracticeId: state.activePracticeId,
    practiceBenchOpen: state.practiceBenchOpen,
    openPractice,
    closePractice,
    practiceLogCall,
    practiceResolveLine,
    practiceResetLine,
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
