/**
 * MedicalCaseStore.tsx — Medical case-runner state (context + per-phone persistence)
 *
 * Inspired by: the dental track's DentalTrackStore, applied to the medical
 * track's seven-stage spine (registration → eligibility → clinical → coding →
 * (conditional) prior-auth → claim → ar-follow-up). Lives entirely apart from
 * the free-form medical `pipelineStore` under its own localStorage namespace
 * `hh_medical_case_<phone>`, keyed by the logged-in phone exactly like the
 * dental track.
 *
 * The seven graded cases come from `~/data/medical` (caseScenarios.ts). This
 * store owns the student's per-stage inputs, the auto-scoring of the case's
 * grading rubric, and the derived "which traps did the student trip" set. Two
 * traps reuse mechanics that already ship in the medical UI (modifier 25 and
 * conditional prior authorisation) so the cases exercise the same habits the
 * free-form pipeline teaches.
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
  findCase,
  findPlan,
  type MedicalCaseScenario,
  type MedicalCaseTrap,
  type MedicalPlan,
} from "../../data/medical";
import { getLoggedInPhone } from "../../store/accessStore";

/** Stage spine for the case runner. "case-select"/"briefing"/"debrief" frame the seven RCM stages. */
export type MedicalCaseStageName =
  | "case-select"
  | "briefing"
  | "registration"
  | "eligibility"
  | "clinical"
  | "coding"
  | "prior-auth"
  | "claim"
  | "ar-follow-up"
  | "debrief";

/** A single CPT line the student is building in the coding stage. */
export interface MedicalProcedureLine {
  id: string;
  code: string;
  /** CPT modifier the line carries, where one applies (e.g. "25"). */
  modifier?: string;
  /** Diagnosis pointer letter the line links to ("A", "B", …) — CMS-1500 box 24. */
  linkedDiagnosisPointer?: string;
}

/** Canonical AR actions the student can take on a denial. Grading matches on these. */
export type MedicalARAction =
  | "resubmit-corrected"
  | "appeal"
  | "write-off"
  | "bill-patient"
  | "retrospective-review"
  | "explain-and-move";

/** A logged AR follow-up action taken on the claim. */
export interface MedicalARCallEntry {
  id: string;
  at: string;
  action: MedicalARAction;
  note: string;
}

/** The student's prior-authorisation decision (only relevant to PA cases). */
export type MedicalPriorAuthChoice = "obtained" | "skipped" | "wrong-study";

export interface MedicalCaseState {
  version: 1;
  /** null = no case loaded (case-select screen). */
  caseId: string | null;
  stage: MedicalCaseStageName;
  startedAt: string | null;
  completedAt: string | null;
  // registration (informational transcription; not rubric-graded)
  registration: {
    lastNameEntered: string;
    memberIdEntered: string;
    nameMatches: boolean;
    memberIdMatches: boolean;
    copayCollected: boolean;
  };
  // eligibility (MCASE-007 grades this)
  eligibilityChecked: boolean;
  // clinical / scribe (free-text; not rubric-graded)
  clinical: {
    hpi: string;
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  // coding
  diagnoses: string[];
  procedures: MedicalProcedureLine[];
  // prior authorisation
  priorAuth: {
    recognized: boolean;
    choice: MedicalPriorAuthChoice;
    authNumber: string;
  };
  // claim
  claimSubmitted: boolean;
  // ar
  arCalls: MedicalARCallEntry[];
  /** Rubric points earned, keyed `${stage}-${index}`. */
  rubricByCriterion: Record<string, number>;
}

const STORAGE_PREFIX = "hh_medical_case_";

function freshState(): MedicalCaseState {
  return {
    version: 1,
    caseId: null,
    stage: "case-select",
    startedAt: null,
    completedAt: null,
    registration: {
      lastNameEntered: "",
      memberIdEntered: "",
      nameMatches: false,
      memberIdMatches: false,
      copayCollected: false,
    },
    eligibilityChecked: false,
    clinical: { hpi: "", subjective: "", objective: "", assessment: "", plan: "" },
    diagnoses: [],
    procedures: [],
    priorAuth: { recognized: false, choice: "skipped", authNumber: "" },
    claimSubmitted: false,
    arCalls: [],
    rubricByCriterion: {},
  };
}

function keyFor(phone: string | null): string | null {
  return phone ? `${STORAGE_PREFIX}${phone}` : null;
}

function loadState(phone: string | null): MedicalCaseState {
  const key = keyFor(phone);
  if (!key) return freshState();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw) as MedicalCaseState;
    if (parsed.version !== 1) return freshState();
    return { ...freshState(), ...parsed };
  } catch {
    return freshState();
  }
}

/** True when the student's coding has selected a CPT that requires prior authorisation. */
export function caseRequiresPriorAuth(
  procedures: MedicalProcedureLine[],
  plan: MedicalPlan | undefined,
): boolean {
  if (!plan) return false;
  const required = new Set(plan.priorAuthCptCodes);
  return procedures.some((p) => required.has(p.code));
}

/**
 * Auto-score the mechanically-verifiable rubric criteria. Judgment calls are
 * left at 0 for instructor review (mirrors the dental track's debrief note).
 * Each criterion is matched by its stable wording plus the case id.
 */
function computeEarned(
  state: MedicalCaseState,
  activeCase: MedicalCaseScenario | undefined,
): Record<string, number> {
  const earned: Record<string, number> = { ...state.rubricByCriterion };
  if (!activeCase) return earned;

  const hasDx = (c: string) => state.diagnoses.includes(c);
  const line = (c: string) => state.procedures.find((p) => p.code === c);
  const hasProc = (c: string) => Boolean(line(c));
  const procMod = (c: string) => line(c)?.modifier;
  const procLink = (c: string) => line(c)?.linkedDiagnosisPointer;
  const hasAr = (a: MedicalARAction) => state.arCalls.some((x) => x.action === a);
  const pa = state.priorAuth;

  activeCase.gradingRubric.criteria.forEach((c, idx) => {
    const key = `${c.stage}-${idx}`;
    if (earned[key] !== undefined) return;
    const t = c.criterion.toLowerCase();
    let hit = false;

    if (c.stage === "eligibility") {
      hit = state.eligibilityChecked;
    } else if (c.stage === "coding") {
      if (t.includes("99213") && t.includes("not 99214")) hit = hasProc("99213") && !hasProc("99214");
      else if (t.includes("i10")) hit = hasDx("I10");
      else if (t.includes("preventive")) hit = hasProc("99396");
      else if (t.includes("mammogram")) hit = hasDx("Z12.31") && hasProc("77067");
      else if (t.includes("e11.22")) hit = hasDx("E11.22");
      else if (t.includes("n18.3")) hit = hasDx("N18.3");
      else if (t.includes("fatigue")) hit = !hasDx("R53.1") && hasDx("E11.22");
      else if (t.includes("modifier 25")) hit = procMod("99213") === "25";
      else if (t.includes("injection")) hit = hasProc("20610") && procMod("20610") !== "25";
      else if (t.includes("separately evaluated")) hit = procLink("99213") === "B";
      else if (t.includes("definitive")) hit = hasProc("17000") && !hasProc("11102");
    } else if (c.stage === "claim") {
      if (t.includes("pointer correct")) hit = state.claimSubmitted && procLink("99213") === "A";
      else if (t.includes("same-day")) hit = state.claimSubmitted && !hasProc("99213");
      else if (t.includes("level-four")) hit = state.claimSubmitted && procLink("99214") === "A";
      else if (t.includes("both lines")) hit = state.claimSubmitted && procLink("99213") === "B" && procLink("20610") === "A";
      else if (t.includes("authorisation number"))
        hit = state.claimSubmitted && pa.choice === "obtained" && pa.authNumber.trim().length > 0;
      else if (t.includes("bundled")) hit = state.claimSubmitted && !hasProc("11102");
      else if (t.includes("coded the visit")) hit = hasProc("97110") && hasDx("M54.5");
    } else if (c.stage === "prior-auth") {
      if (t.includes("recogni")) hit = pa.recognized && pa.choice !== "skipped";
      else if (t.includes("obtained")) hit = pa.choice === "obtained";
    } else if (c.stage === "ar-follow-up") {
      if (t.includes("coinsurance")) hit = hasAr("bill-patient");
      else if (t.includes("corrected")) hit = hasAr("resubmit-corrected");
      else if (t.includes("retrospective")) hit = hasAr("retrospective-review");
      else if (t.includes("wrote off")) hit = hasAr("write-off");
      else if (t.includes("did not appeal")) hit = hasAr("explain-and-move");
    }

    if (hit) earned[key] = c.points;
  });

  return earned;
}

/**
 * Derived set of trap ids the student has tripped, based on their inputs.
 * (Traps are never stored; they are always recomputed from the current state so
 * the debrief is accurate even if the student backtracks and changes answers.)
 */
function detectTriggeredTraps(state: MedicalCaseState, activeCase: MedicalCaseScenario | undefined): string[] {
  const ids: string[] = [];
  if (!activeCase) return ids;

  const hasDx = (c: string) => state.diagnoses.includes(c);
  const line = (c: string) => state.procedures.find((p) => p.code === c);
  const hasProc = (c: string) => Boolean(line(c));
  const procMod = (c: string) => line(c)?.modifier;
  const hasAr = (a: MedicalARAction) => state.arCalls.some((x) => x.action === a);
  const pa = state.priorAuth;

  switch (activeCase.id) {
    case "MCASE-001":
      if (hasProc("99214")) ids.push("MTRAP-1A");
      if (state.diagnoses.length > 0 && !hasDx("I10")) ids.push("MTRAP-1B");
      break;
    case "MCASE-002":
      if (hasProc("99213")) ids.push("MTRAP-2A", "MTRAP-2C");
      if (hasProc("77067") && !hasDx("Z12.31")) ids.push("MTRAP-2B");
      break;
    case "MCASE-003":
      if (hasDx("R53.1")) ids.push("MTRAP-3A");
      if (hasDx("E11.9")) ids.push("MTRAP-3B");
      break;
    case "MCASE-004":
      if (hasProc("99213") && hasProc("20610") && procMod("99213") !== "25") ids.push("MTRAP-4A");
      if (procMod("20610") === "25") ids.push("MTRAP-4B");
      break;
    case "MCASE-005":
      if (hasProc("72141") && pa.choice === "skipped") ids.push("MTRAP-5A");
      if (hasProc("72141") && pa.choice === "wrong-study") ids.push("MTRAP-5B");
      break;
    case "MCASE-006":
      if (hasProc("11102") && hasProc("17000")) ids.push("MTRAP-6A");
      if (hasAr("appeal")) ids.push("MTRAP-6B");
      break;
    case "MCASE-007":
      if (!state.eligibilityChecked && state.claimSubmitted) ids.push("MTRAP-7A");
      if (hasAr("appeal")) ids.push("MTRAP-7B");
      break;
  }
  return ids;
}

export interface MedicalCaseApi {
  state: MedicalCaseState;
  activeCase: MedicalCaseScenario | undefined;
  plan: MedicalPlan | undefined;
  /** True when the current coding requires prior authorisation (conditional PA). */
  paTriggered: boolean;
  // lifecycle
  selectCase: (caseId: string | null) => void;
  beginCase: () => void;
  goTo: (stage: MedicalCaseStageName) => void;
  resetTrack: () => void;
  // registration
  setRegistration: (patch: Partial<MedicalCaseState["registration"]>) => void;
  // eligibility
  setEligibilityChecked: (checked: boolean) => void;
  // clinical
  setClinical: (patch: Partial<MedicalCaseState["clinical"]>) => void;
  // coding
  toggleDiagnosis: (code: string) => void;
  addProcedure: (code: string) => void;
  updateProcedure: (id: string, patch: Partial<MedicalProcedureLine>) => void;
  removeProcedure: (id: string) => void;
  // prior auth
  setPriorAuth: (patch: Partial<MedicalCaseState["priorAuth"]>) => void;
  // claim
  submitClaim: () => void;
  // ar
  logARCall: (action: MedicalARAction, note: string) => void;
  // scoring
  scoreTally: {
    maxPoints: number;
    earned: number;
    passingPoints: number;
    criteria: { key: string; stage: MedicalCaseScenario["gradingRubric"]["criteria"][number]["stage"]; criterion: string; points: number; earned: number }[];
  };
  traps: MedicalCaseTrap[];
  triggeredTrapIds: string[];
}

const MedicalCaseContext = createContext<MedicalCaseApi | null>(null);

export function MedicalCaseProvider({ children }: { children: ReactNode }) {
  const phone = getLoggedInPhone();
  const [state, setState] = useState<MedicalCaseState>(() => loadState(phone));
  const phoneRef = useRef(phone);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-key on login change so a different phone never sees the previous student's case.
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

  const activeCase = useMemo(
    () => (state.caseId ? findCase(state.caseId) : undefined),
    [state.caseId],
  );
  const plan = useMemo(
    () => (activeCase ? findPlan(activeCase.planId) : undefined),
    [activeCase],
  );
  const paTriggered = useMemo(
    () => caseRequiresPriorAuth(state.procedures, plan),
    [state.procedures, plan],
  );

  const goTo = useCallback((stage: MedicalCaseStageName) => {
    setState((s) => ({ ...s, stage }));
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
      stage: "registration",
      diagnoses: [],
      procedures: [],
      claimSubmitted: false,
      rubricByCriterion: {},
      arCalls: [],
      eligibilityChecked: false,
      priorAuth: { recognized: false, choice: "skipped", authNumber: "" },
    }));
  }, []);

  const resetTrack = useCallback(() => {
    setState(freshState());
  }, []);

  const setRegistration = useCallback((patch: Partial<MedicalCaseState["registration"]>) => {
    setState((s) => ({ ...s, registration: { ...s.registration, ...patch } }));
  }, []);

  const setEligibilityChecked = useCallback((checked: boolean) => {
    setState((s) => ({ ...s, eligibilityChecked: checked }));
  }, []);

  const setClinical = useCallback((patch: Partial<MedicalCaseState["clinical"]>) => {
    setState((s) => ({ ...s, clinical: { ...s.clinical, ...patch } }));
  }, []);

  const toggleDiagnosis = useCallback((code: string) => {
    setState((s) => ({
      ...s,
      diagnoses: s.diagnoses.includes(code)
        ? s.diagnoses.filter((d) => d !== code)
        : [...s.diagnoses, code],
    }));
  }, []);

  const addProcedure = useCallback((code: string) => {
    setState((s) => {
      if (s.procedures.some((p) => p.code === code)) return s;
      return {
        ...s,
        procedures: [
          ...s.procedures,
          { id: `proc-${code}-${Date.now()}`, code, modifier: undefined, linkedDiagnosisPointer: undefined },
        ],
      };
    });
  }, []);

  const updateProcedure = useCallback((id: string, patch: Partial<MedicalProcedureLine>) => {
    setState((s) => ({
      ...s,
      procedures: s.procedures.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  }, []);

  const removeProcedure = useCallback((id: string) => {
    setState((s) => ({ ...s, procedures: s.procedures.filter((p) => p.id !== id) }));
  }, []);

  const setPriorAuth = useCallback((patch: Partial<MedicalCaseState["priorAuth"]>) => {
    setState((s) => ({ ...s, priorAuth: { ...s.priorAuth, ...patch } }));
  }, []);

  const submitClaim = useCallback(() => {
    setState((s) => ({ ...s, claimSubmitted: true }));
  }, []);

  const logARCall = useCallback((action: MedicalARAction, note: string) => {
    setState((s) => ({
      ...s,
      arCalls: [...s.arCalls, { id: `ar-${Date.now()}`, at: new Date().toISOString(), action, note }],
    }));
  }, []);

  const traps = useMemo(() => activeCase?.traps ?? [], [activeCase]);
  const triggeredTrapIds = useMemo(
    () => detectTriggeredTraps(state, activeCase),
    [state, activeCase],
  );

  const scoreTally = useMemo(() => {
    const rubric = activeCase?.gradingRubric ?? { maxPoints: 0, passingPoints: 0, criteria: [] };
    const earnedMap = computeEarned(state, activeCase);
    const criteria = rubric.criteria.map((c, idx) => ({
      key: `${c.stage}-${idx}`,
      stage: c.stage,
      criterion: c.criterion,
      points: c.points,
      earned: earnedMap[`${c.stage}-${idx}`] ?? 0,
    }));
    const earned = criteria.reduce((sum, c) => sum + c.earned, 0);
    return { maxPoints: rubric.maxPoints, earned, passingPoints: rubric.passingPoints, criteria };
  }, [state, activeCase]);

  const api: MedicalCaseApi = {
    state,
    activeCase,
    plan,
    paTriggered,
    selectCase,
    beginCase,
    goTo,
    resetTrack,
    setRegistration,
    setEligibilityChecked,
    setClinical,
    toggleDiagnosis,
    addProcedure,
    updateProcedure,
    removeProcedure,
    setPriorAuth,
    submitClaim,
    logARCall,
    scoreTally,
    traps,
    triggeredTrapIds,
  };

  return <MedicalCaseContext.Provider value={api}>{children}</MedicalCaseContext.Provider>;
}

export function useMedicalCase(): MedicalCaseApi {
  const ctx = useContext(MedicalCaseContext);
  if (!ctx) throw new Error("useMedicalCase must be used within a MedicalCaseProvider");
  return ctx;
}
