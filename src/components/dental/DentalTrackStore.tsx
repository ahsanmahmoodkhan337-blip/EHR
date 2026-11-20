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
  type DentalAppealOutcome,
  type DentalCaseScenario,
} from "../../data/dental";
import { getLoggedInPhone } from "../../store/accessStore";
import { writeAutosaved } from "../../store/autosave";
import { registerResetHandler } from "../../store/resetData";
import type { ADAFormData } from "../../data/claims/adaLayout";
import { mintClaimNumber, nextClaimNumber, type ClaimStatus } from "../../domain/claimStatus";
import { buildSubmissionEvents, type ClaimTrack } from "../../domain/clearinghouse";
import { appendStatusEvent, makeStatusEvent, type StatusEvent } from "../../domain/statusEvent";
import { appendLedgerEntries, type LedgerEntry } from "../../domain/ledger";
import { postDentalRemittanceToLedger } from "../../domain/dentalRemittance";
import type { EraRemittance } from "../../data/dental";

/**
 * The dental track's stages. The frames (`case-select`, `briefing`) are not
 * encounter stages; every other id is one of the shared model's stages
 * (`stageModel.ts`), which is why there is no `claims` and no `ledger` here any
 * more — the owner's mapping (`phase-1-navigation-addendum.md` item 3) puts the
 * claim status queue inside **Claim** and the patient ledger in **Remittance**.
 *
 * Old records and old URLs still carry `claims` and `ledger`: `DENTAL_LEGACY_STAGE`
 * translates them on load (`migrateDentalTrackState`) and on the way into a URL
 * (`normalizeDentalStageId`), so nothing a student saved is stranded.
 */
export type DentalStageName =
  | "case-select"
  | "briefing"
  | "planning"
  | "predetermination"
  | "coding"
  | "claim"
  | "remittance"
  | "ar"
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
  "remittance",
  "ar",
  "debrief",
];

/**
 * Stage ids that earlier builds wrote into a saved record or a URL, and the
 * stage each one is now. Reading the old key is deliberate (owner's
 * instruction): `claims` was the claim status queue, which is part of Claim, and
 * `ledger` was the patient ledger, which is Remittance.
 */
export const DENTAL_LEGACY_STAGE: Record<string, DentalStageName> = {
  claims: "claim",
  ledger: "remittance",
};

/**
 * The stage a URL or a saved record names, translated if it is an old id. An id
 * that is already current is returned unchanged, and an unknown id is returned
 * as-is so the URL sync can refuse it out loud instead of guessing.
 */
export function normalizeDentalStageId(id: string): string {
  return DENTAL_LEGACY_STAGE[id] ?? id;
}

/**
 * The dental spine as it stood before v7, when `claims` and `ledger` were steps
 * of their own. A saved record's `furthestStage` was written against **this**
 * order, so the migration has to read it against this order too — otherwise
 * `ledger` (position 8, AR already finished) becomes Remittance (6) and the
 * student's AR and Debrief render locked on work they already did.
 */
export const DENTAL_LEGACY_STAGE_ORDER = [
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
] as const;

/**
 * How far an old id had actually got, in the current order. A plain rename is
 * not enough: the old `claims` step held the claim queue (now a section of
 * Claim) and the old `ledger` step came **after** AR, so a record saved on the
 * ledger had already finished AR and must keep it unlocked.
 */
const LEGACY_FURTHEST_FLOOR: Record<string, DentalStageName> = {
  claims: "claim",
  ledger: "ar",
};

function stageRank(stage: DentalStageName): number {
  const i = DENTAL_STAGE_ORDER.indexOf(stage);
  return i < 0 ? 0 : i;
}

/** The later of two stages — how "furthest reached" is advanced, never reset backwards. */
function furthestOf(a: DentalStageName, b: DentalStageName): DentalStageName {
  return stageRank(b) > stageRank(a) ? b : a;
}

/**
 * A saved `furthestStage` translated into the current order, **never
 * backwards**: the renamed stage is the floor from the plain translation, and
 * the old step's real position raises it when that step covered more work.
 */
export function migrateFurthestStage(rawId: string | undefined): DentalStageName {
  const id = rawId ?? "case-select";
  const translated = normalizeDentalStageId(id);
  const current = (DENTAL_STAGE_ORDER as string[]).includes(translated)
    ? (translated as DentalStageName)
    : "case-select";
  const floor = LEGACY_FURTHEST_FLOOR[id];
  return floor ? furthestOf(current, floor) : current;
}

/**
 * The dental stages that still owe a required action — so they are **not**
 * finished, and must stay editable however far the student has moved on.
 *
 * The case is not done until the money has moved: a claim that was never
 * transmitted, an 835 that was never posted and a denied line nobody has worked
 * are all unfinished work. Without this list a finished-stage frame would
 * swallow the Post button and strand the posting step (spec
 * `sidebar-stage-fixes.md`, defect 3).
 *
 * Pure: it reads the saved record and the claim's denied line ids only, so the
 * runner and the tests read the same rule.
 */
export function unfinishedDentalStages(
  state: DentalTrackState,
  deniedLineIds: readonly string[] = [],
): DentalStageName[] {
  const pending: DentalStageName[] = [];
  if (state.lines.length > 0 && !state.claimSubmitted) pending.push("claim");
  if (state.claimSubmitted && !state.ledger.some((entry) => Boolean(entry.eraId))) {
    pending.push("remittance");
  }
  if (deniedLineIds.some((id) => !state.lineResolutions[id])) pending.push("ar");
  return pending;
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
  /** How an appeal came back, where the appeal had two possible endings. */
  appealOutcome?: DentalAppealOutcome;
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
   * v4 added the claim number and the append-only status timeline; v5 replaced
   * the mock payment/adjustment arrays with the ledger — the one list of money
   * that actually moved, and the only thing the patient ledger sums; v6 added
   * the AR practice bench slice (`practice`, `activePracticeId`); v7 folded the
   * two out-of-model dental steps into the eight-stage model (`claims` → Claim,
   * `ledger` → Remittance).
   */
  version: 7;
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
  /**
   * How each line's appeal came back, where the denial's appeal has two
   * endings (`appealResolvesTo: "pay-or-write-off"`): `upheld` means the line
   * pays, `denied` means the student still owes the contractual write-off.
   *
   * Additive and defaulted to empty in `freshState`, so a record saved before
   * this field existed loads with no appeal outcomes — nothing is invented, and
   * `lineResolutions` keeps working exactly as it did.
   */
  appealOutcomes: Record<string, DentalAppealOutcome>;
  /** Periodontal chart readings, keyed by Universal designation. */
  perio: Record<string, PerioToothEntry>;
  /** Treatment plan items (planning stage → seeding coding). */
  txPlan: TxPlanItem[];
  /**
   * The ledger: every charge, insurance payment, adjustment and patient payment
   * that actually moved, appended by the 835 posting step or by hand. The
   * patient balance is summed from these entries and from nothing else.
   */
  ledger: LedgerEntry[];
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
    version: 7,
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
    appealOutcomes: {},
    perio: {},
    txPlan: [],
    ledger: [],
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

/**
 * v4 → v5: translate the two mock money arrays into ledger entries. The amount,
 * the date and the note are carried forward exactly as the student posted them;
 * the entry says `migrated` so nothing pretends it came from an 835.
 */
function migrateLegacyMoney(
  payments: DentalPayment[] | undefined,
  adjustments: DentalAdjustment[] | undefined,
  ctx: { patientId: string | null; claimNumber: string | null },
): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  for (const payment of payments ?? []) {
    entries.push({
      id: `LEDG-MIGRATED-${payment.id}`,
      patientId: ctx.patientId,
      claimNumber: ctx.claimNumber ?? "",
      date: (payment.at ?? "").slice(0, 10),
      type: payment.source === "patient" ? "patient_payment" : "insurance_payment",
      code: "MIGRATED",
      description: `Moved from the pre-ledger dental record: ${payment.source} payment${
        payment.method ? ` · ${payment.method}` : ""
      }${payment.note ? ` (${payment.note})` : ""}`,
      amountCents: -Math.round(payment.amountUsd * 100),
      userId: "migrated",
    });
  }
  for (const adjustment of adjustments ?? []) {
    entries.push({
      id: `LEDG-MIGRATED-${adjustment.id}`,
      patientId: ctx.patientId,
      claimNumber: ctx.claimNumber ?? "",
      date: (adjustment.at ?? "").slice(0, 10),
      type: "adjustment",
      code: "MIGRATED",
      description: `Moved from the pre-ledger dental record: ${adjustment.type}${
        adjustment.note ? ` (${adjustment.note})` : ""
      }`,
      amountCents: -Math.round(adjustment.amountUsd * 100),
      userId: "migrated",
    });
  }
  return entries;
}

function loadState(phone: string | null): DentalTrackState {
  const key = keyFor(phone);
  if (!key) return freshState();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return freshState();
    return migrateDentalTrackState(JSON.parse(raw));
  } catch {
    return freshState();
  }
}

/**
 * Read the persisted dental record for a phone **without mounting the provider**.
 *
 * The Home work queues count the dental side's claim status and undecided denied
 * lines, and Home is not inside the dental provider. This runs the same
 * `loadState` migration the provider runs, so the queues can never read a shape
 * the dental screens would not, and it never writes.
 */
export function readDentalTrackRecord(phone: string | null = getLoggedInPhone()): DentalTrackState {
  return loadState(phone);
}

/**
 * Translate a saved dental record into the current shape. Pure, exported and
 * used by both `loadState` and the tests, so a migration cannot pass a test the
 * app does not run.
 *
 * v1 → v2: the ADA claim record was added; older tracks simply have none.
 * v2 → v3: the stepper now remembers how far the student got. A v2 record only
 * knows the stage it stopped on, so that stage is carried forward as the
 * furthest reached — nothing is invented, and no work is dropped.
 * v3 → v4: the claim gets a number and a timeline. A record whose claim was
 * already submitted has no 277CA behind it, so it is carried forward as
 * `submitted` — never as accepted — and says so in its own MIGRATED entry.
 * v4 → v5: the ledger replaces the two mock money arrays. Every payment and
 * adjustment the student had already posted is translated into a ledger entry
 * with the same amount, date and note, marked `migrated` — carried forward
 * verbatim, never re-priced, and never dropped.
 * v5 → v6: the AR practice bench was added. An older record simply has no
 * practice runs, so it starts with none — nothing is invented, and no case work
 * is touched. Two builds both called themselves v5 while this landed, so the
 * ledger translation is driven by whether a record already HAS a ledger rather
 * than by its version number: a v5 record saved before the ledger existed still
 * has its payments and adjustments carried across.
 * v6 → v7: the two dental steps outside the eight-stage model are folded into it
 * (owner's mapping, `phase-1-navigation-addendum.md` item 3). A record saved on
 * `claims` is carried to `claim` (the claim status queue is a section of Claim)
 * and one saved on `ledger` to `remittance`. Only the stage names change: every
 * ledger entry, claim queue row and posted figure is carried across untouched,
 * and running the migration twice changes nothing the second time.
 * `furthestStage` is translated against the **old** order (`DENTAL_LEGACY_STAGE_ORDER`)
 * and never moves backwards: a record saved on `ledger` had already finished AR,
 * so AR stays unlocked instead of being re-locked behind a lower position.
 * v7 → v7 (no version bump): the crown/buildup appeal gained its second ending
 * (owner ruling 2026-11-20, `specs/appeal-then-write-off.md`), so a line can now
 * carry an `appealOutcomes` entry beside its resolution. The field is additive
 * and defaults to empty, so an older record loads with every resolution it had
 * and no appeal outcomes — nothing is invented, and no money moves.
 */
export function migrateDentalTrackState(raw: unknown): DentalTrackState {
  const parsed = (raw ?? {}) as DentalTrackState & { version?: number };
  if (typeof parsed !== "object") return freshState();
  const version: number | undefined = (parsed as { version?: number }).version;
  if (
    version !== 1 &&
    version !== 2 &&
    version !== 3 &&
    version !== 4 &&
    version !== 5 &&
    version !== 6 &&
    version !== 7
  ) {
    return freshState();
  }
  const legacy = parsed as DentalTrackState & {
    payments?: DentalPayment[];
    adjustments?: DentalAdjustment[];
  };
  const { payments: legacyPayments, adjustments: legacyAdjustments, ...rest } = legacy;
  const hadLedger = Array.isArray(parsed.ledger);
  /**
   * A saved stage id as the current stage. An id from before the fold is
   * translated; anything unrecognised falls back rather than rendering a stage
   * that does not exist.
   */
  const asStage = (id: string | undefined, fallback: DentalStageName): DentalStageName => {
    const next = normalizeDentalStageId(id ?? fallback);
    return (DENTAL_STAGE_ORDER as string[]).includes(next) ? (next as DentalStageName) : fallback;
  };
  const migrated: DentalTrackState = {
    ...freshState(),
    ...rest,
    version: 7,
    stage: asStage(parsed.stage, "case-select"),
    // Never backwards: a record saved on `ledger` had already finished AR, so
    // AR (and Debrief behind it) stay reachable.
    furthestStage: migrateFurthestStage(parsed.furthestStage ?? parsed.stage),
    claimNumber: parsed.claimNumber ?? null,
    claimStatus: parsed.claimStatus ?? null,
    statusEvents: Array.isArray(parsed.statusEvents) ? parsed.statusEvents : [],
    ledger: hadLedger ? (parsed.ledger as DentalTrackState["ledger"]) : [],
    appealOutcomes:
      parsed.appealOutcomes && typeof parsed.appealOutcomes === "object" ? parsed.appealOutcomes : {},
    practice: parsed.practice && typeof parsed.practice === "object" ? parsed.practice : {},
    activePracticeId: parsed.activePracticeId ?? null,
    practiceBenchOpen: parsed.practiceBenchOpen === true,
  };
  if (!hadLedger) {
    const patientId = migrated.caseId ? findCase(migrated.caseId)?.patient?.id ?? null : null;
    migrated.ledger = [
      ...migrated.ledger,
      ...migrateLegacyMoney(legacyPayments, legacyAdjustments, {
        patientId,
        claimNumber: migrated.claimNumber,
      }),
    ];
  }
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
  /** Log a follow-up call. `lineId` ties the note to the line it was about. */
  logCall: (objective: string, note: string, lineId?: string) => void;
  /**
   * Record one line's action. Where the denial's appeal has two endings
   * (`appealResolvesTo: "pay-or-write-off"`) the outcome goes in the same write:
   * `upheld` means the line pays, `denied` means the student still owes the
   * contractual write-off.
   */
  resolveLine: (lineId: string, resolution: DentalLineResolution, appealOutcome?: DentalAppealOutcome) => void;
  /**
   * Post the contractual write-off a denied appeal leaves behind: a CO
   * adjustment for what is still outstanding on the line, never a patient
   * balance. Returns what it did, so the screen can say it.
   */
  postContractualWriteOff: (
    lineId: string,
    reasonCode?: string,
  ) => { posted: boolean; amountUsd: number; reason: string };
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
  practiceResolveLine: (
    scenarioId: string,
    lineId: string,
    resolution: DentalLineResolution,
    appealOutcome?: DentalAppealOutcome,
  ) => void;
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
  /**
   * Post this claim's 835 to the patient ledger: the charge, the insurance
   * payment and every contractual adjustment, in one store write. **Graded case
   * claims only** — the claim must have been submitted, so a practice-bench
   * remittance (which never carries a graded claim number) cannot post here.
   */
  postRemittance: (remittance: EraRemittance) => void;
  /** True when this 835 is already on the ledger — a second press adds nothing. */
  isRemittancePosted: (remittance: EraRemittance) => boolean;
  /** Append one hand-posted entry (a patient payment or a courtesy adjustment). */
  postLedgerEntry: (entry: LedgerEntry) => void;
  /** Remove a hand-posted entry. An entry that came from an 835 cannot be removed. */
  removeLedgerEntry: (id: string) => void;
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
      /**
       * DCASE-005's crown is the case's appeal-then-write-off line (owner ruling
       * 2026-11-20): the appeal is the first action, and the line then either
       * pays (upheld) or is written off contractually (denied). Billing the
       * patient on it is wrong however the appeal ended.
       */
      const crown = activeCase.id === "DCASE-005" ? state.lines.find((l) => l.code === "D2740") : undefined;
      const crownResolution = crown ? state.lineResolutions[crown.id] : undefined;
      const crownAppeal = crown ? state.appealOutcomes[crown.id] : undefined;
      if (activeCase.id === "DCASE-005" && crown && text.includes("write-off")) {
        checkable = true;
        hit =
          crownResolution !== "billed-patient" &&
          (crownResolution === "write-off" || crownAppeal === "upheld");
      } else if (activeCase.id === "DCASE-005" && crown && text.includes("appeal")) {
        checkable = true;
        hit = Boolean(crownAppeal) || crownResolution === "appealed";
      } else if (activeCase.id === "DCASE-001" && text.includes("contractual")) {
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

/**
 * May this 835 be posted to the ledger? **Graded case claims only.**
 *
 * A remittance can post only when a graded case is open, its claim was
 * submitted (so the 835 is that claim's own answer) and the 835 names that
 * claim. The sample ERAs and any future practice-bench slice therefore cannot
 * reach the ledger, and a second press is refused rather than doubling money.
 */
export function canPostDentalRemittance(
  state: Pick<DentalTrackState, "caseId" | "claimSubmitted" | "claimNumber" | "ledger">,
  remittance: EraRemittance,
): { ok: boolean; reason?: string } {
  if (!state.caseId) {
    return { ok: false, reason: "No graded case is open, so there is no claim to post against." };
  }
  if (!state.claimSubmitted || !state.claimNumber) {
    return { ok: false, reason: "This claim has not been submitted, so no 835 exists for it yet." };
  }
  if (remittance.claimControlNumber !== state.claimNumber) {
    return { ok: false, reason: "That 835 belongs to another claim. Only this case's own claim can be posted." };
  }
  if (state.ledger.some((entry) => entry.eraId === remittance.id)) {
    return { ok: false, reason: "This 835 is already on the ledger — posting it again adds nothing." };
  }
  return { ok: true };
}

/**
 * The contractual write-off a denied appeal leaves behind — one CO adjustment
 * entry, or none where there is nothing left to write off.
 *
 * The amount is what is still outstanding on that claim line in the ledger: the
 * charge, less anything already paid or adjusted. That cap is the whole safety
 * rule. A CO denial is written off by the 835 the moment the remittance posts,
 * so pressing this a second time posts nothing instead of crediting the patient
 * twice; and before the 835 posts there is no charge to adjust, so nothing is
 * invented. Either way the patient balance stays 0 — never a bill.
 */
export function dentalWriteOffEntry(
  state: Pick<DentalTrackState, "ledger" | "lines" | "claimNumber">,
  lineId: string,
  ctx: { at: string; userId: string; patientId?: string | null; reasonCode?: string },
): { entry: LedgerEntry | null; amountUsd: number; reason: string } {
  const index = state.lines.findIndex((l) => l.id === lineId);
  if (index < 0) return { entry: null, amountUsd: 0, reason: "That line is not on this claim." };
  if (!state.claimNumber) {
    return {
      entry: null,
      amountUsd: 0,
      reason: "This claim has no number yet, so there is no account to write the line off against.",
    };
  }
  const lineNumber = index + 1;
  const onLine = state.ledger.filter(
    (entry) => entry.claimNumber === state.claimNumber && entry.lineNumber === lineNumber,
  );
  const chargedCents = onLine
    .filter((entry) => entry.type === "charge")
    .reduce((sum, entry) => sum + entry.amountCents, 0);
  if (chargedCents <= 0) {
    return {
      entry: null,
      amountUsd: 0,
      reason:
        "The charge is not on the ledger yet, so there is nothing to adjust. The CO write-off posts with this claim's 835 in Remittance, and the patient balance stays $0.00.",
    };
  }
  const outstandingCents = onLine.reduce((sum, entry) => sum + entry.amountCents, 0);
  if (outstandingCents <= 0) {
    return {
      entry: null,
      amountUsd: 0,
      reason:
        "Nothing left to write off — the ledger already carries the contractual adjustment for this line, and the patient balance stays $0.00.",
    };
  }
  const code = (ctx.reasonCode ?? "CO-45").trim();
  const amountUsd = Math.round(outstandingCents) / 100;
  return {
    amountUsd,
    reason: `${code} adjustment posted — $${amountUsd.toFixed(2)} written off contractually. The patient balance stays $0.00.`,
    entry: {
      id: `LEDG-${state.claimNumber}-dental-writeoff-${lineNumber}`,
      patientId: ctx.patientId ?? null,
      claimNumber: state.claimNumber,
      date: ctx.at.slice(0, 10),
      type: "adjustment",
      code,
      description: `Write-off ${code} — $${amountUsd.toFixed(2)} on claim line ${lineNumber} written off contractually after the appeal was denied. Not billable to the patient.`,
      amountCents: -outstandingCents,
      userId: ctx.userId,
      lineNumber,
    },
  };
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

  // A reset deletes the stored track. Blank it in memory in the same step, and
  // keep that blank state out of both the debounced save and the unmount flush,
  // so a deleted record cannot be written straight back.
  const resetState = useRef<DentalTrackState | null>(null);
  useEffect(
    () =>
      registerResetHandler("dental", () => {
        if (saveTimer.current) {
          clearTimeout(saveTimer.current);
          saveTimer.current = null;
        }
        const fresh = freshState();
        resetState.current = fresh;
        setState(fresh);
      }),
    [],
  );

  // Debounced persisted save keyed by phone.
  useEffect(() => {
    if (resetState.current && state === resetState.current) return;
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
      if (resetState.current && latestState.current === resetState.current) return;
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
      ledger: [],
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

  const logCall = useCallback((objective: string, note: string, lineId?: string) => {
    setState((s) => ({
      ...s,
      arCallLog: [
        ...s.arCallLog,
        { id: `call-${Date.now()}`, at: new Date().toISOString(), objective, note, ...(lineId ? { lineId } : {}) },
      ],
    }));
  }, []);

  const resolveLine = useCallback(
    (lineId: string, resolution: DentalLineResolution, appealOutcome?: DentalAppealOutcome) => {
      setState((s) => ({
        ...s,
        lineResolutions: { ...s.lineResolutions, [lineId]: resolution },
        appealOutcomes: appealOutcome
          ? { ...s.appealOutcomes, [lineId]: appealOutcome }
          : s.appealOutcomes,
      }));
    },
    [],
  );

  /**
   * Finish a denied appeal: record the write-off on the line and, where the
   * charge is already on the ledger and something is still outstanding, post the
   * CO adjustment that takes it off. Never a patient balance, and never twice.
   */
  const postContractualWriteOff = useCallback(
    (lineId: string, reasonCode?: string) => {
      const at = new Date().toISOString();
      const userId = getLoggedInPhone() ?? "system";
      const result = dentalWriteOffEntry(state, lineId, { at, userId, reasonCode });
      setState((s) => {
        const written = dentalWriteOffEntry(s, lineId, { at, userId, reasonCode });
        return {
          ...s,
          lineResolutions: { ...s.lineResolutions, [lineId]: "write-off" as DentalLineResolution },
          appealOutcomes: { ...s.appealOutcomes, [lineId]: "denied" as DentalAppealOutcome },
          ledger: written.entry ? appendLedgerEntries(s.ledger, [written.entry]) : s.ledger,
        };
      });
      return {
        posted: Boolean(result.entry),
        amountUsd: result.amountUsd,
        reason: result.reason,
      };
    },
    [state],
  );

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
  /**
   * Post the claim's 835 (spec item 13: "insurance payments and write-offs post
   * from the ERA step, not left at zero"). Refuses anything that is not a
   * graded case claim: no case, or a claim that was never submitted, posts
   * nothing. The entry ids are derived from the 835, so a double press is a
   * no-op instead of double money.
   */
  const postRemittance = useCallback((remittance: EraRemittance) => {
    setState((s) => {
      if (!canPostDentalRemittance(s, remittance).ok) return s;

      const entries = postDentalRemittanceToLedger(remittance, {
        patientId: s.caseId ? findCase(s.caseId)?.patient?.id ?? null : null,
        userId: getLoggedInPhone() ?? "system",
        at: new Date().toISOString(),
      });
      const ledger = appendLedgerEntries(s.ledger, entries);
      if (ledger === s.ledger) return s;
      return { ...s, ledger };
    });
  }, []);

  const isRemittancePosted = useCallback(
    (remittance: EraRemittance) => state.ledger.some((entry) => entry.eraId === remittance.id),
    [state.ledger],
  );

  const postLedgerEntry = useCallback((entry: LedgerEntry) => {
    setState((s) => ({ ...s, ledger: appendLedgerEntries(s.ledger, [entry]) }));
  }, []);

  const removeLedgerEntry = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      // An entry that came from an 835 is a record of what the payer said, not a
      // typo: only hand-posted entries can be taken back.
      ledger: s.ledger.filter((entry) => entry.id !== id || Boolean(entry.eraId)),
    }));
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
    (
      scenarioId: string,
      lineId: string,
      resolution: DentalLineResolution,
      appealOutcome?: DentalAppealOutcome,
    ) => {
      const scenario = findPracticeScenario(scenarioId);
      if (!scenario) return;
      setState((s) => {
        const run = s.practice[scenarioId];
        if (!run) return s;
        // Scoring happens at the commit and nowhere earlier.
        if (!scorePracticeLine(scenario, lineId, resolution, run.callLog, appealOutcome)) return s;
        return {
          ...s,
          practice: {
            ...s.practice,
            [scenarioId]: {
              ...run,
              lineResolutions: { ...run.lineResolutions, [lineId]: resolution },
              decisions: {
                ...run.decisions,
                [lineId]: {
                  resolution,
                  at: new Date().toISOString(),
                  ...(appealOutcome ? { appealOutcome } : {}),
                },
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
    postContractualWriteOff,
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
    postRemittance,
    isRemittancePosted,
    postLedgerEntry,
    removeLedgerEntry,
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
