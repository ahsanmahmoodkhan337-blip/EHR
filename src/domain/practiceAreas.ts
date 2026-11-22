/**
 * practiceAreas.ts — the dashboard's four practice areas, in workflow order
 *
 * Inspired by: the activity groups an EHR home screen puts in the order the work
 * actually moves — the front desk books the visit, the clinician documents it,
 * the billing office gets it paid, and the student reviews what they did.
 *
 * Owner's student-experience work order, 2026-11-21, item 6
 * (`specs/owner-student-experience-2026-11-21.md` §3): the dashboard carried a
 * flat grid of nine identical buttons. It carries four labelled groups instead —
 *
 *   Front desk  Schedule · Patients
 *   Clinical    Charts · Coding
 *   Billing     Prior Auth · Billing / Claim · Payments (835) · Denials & AR
 *   Review      Reports · Practice Cases
 *
 * RULES THIS MODULE KEEPS
 *  - The five tiles that are a pipeline stage print **the stage's own name**,
 *    taken from `domain/encounterFlow.ts` rather than typed again here, so the
 *    dashboard and the encounter stepper cannot drift apart.
 *  - Every tile opens a real address: a page in the shell's one list
 *    (`components/shell/navItems.ts`) or, for Prior Auth — which has no page of
 *    its own — that patient's own Prior Auth stage on
 *    `/encounter/:encounterId/prior-auth`.
 *  - A count is read from the student's saved records through the same domain
 *    builders the page itself uses, so the number on a tile is the number the
 *    page prints. Nothing here is stored, estimated or kept by hand, and a tile
 *    with nothing honest to count (Reports) shows no number at all.
 *
 * Pure: no React, no storage. The dashboard reads its state and hands it in.
 */

import type { ShellNavId, ShellTrack } from "../components/shell/navItems";
import type { DentalTrackState } from "../components/dental/DentalTrackStore";
import type { PipelineEncounter } from "../store/pipelineEncounter";
import { flowStageLabel, type EncounterFlowStageId } from "./encounterFlow";
import { buildCodingQueue } from "./codingQueue";
import { buildArWorkQueue, type ArQueueSource, type ArWorkItem } from "./arWorkQueue";
import { isMidStage } from "./homeWorkQueues";
import {
  buildArRows,
  buildClaimRows,
  buildDenialRows,
  buildDentalClaimRow,
  buildDentalCodingRow,
  buildPaymentRows,
  claimRowsForTrack,
  dentalCaseLabel,
} from "./railPages";

/** The four groups, in the order the work moves. */
export type PracticeAreaGroupId = "front-desk" | "clinical" | "billing" | "review";

/** A tile's stable id — also the key its count is read under. */
export type PracticeAreaTileId =
  | "schedule"
  | "patients"
  | "charts"
  | "coding"
  | "prior-auth"
  | "claims"
  | "payments"
  | "denials-ar"
  | "reports"
  | "practice-cases";

export interface PracticeAreaTile {
  id: PracticeAreaTileId;
  /** What the tile prints. A stage tile prints the stage's own name. */
  label: string;
  /** One line: what the student does there. */
  description: string;
  /** The page it opens, when the work has a page of its own. */
  nav?: ShellNavId;
  /** The pipeline stage this work belongs to, when it belongs to one. */
  stage?: EncounterFlowStageId;
}

export interface PracticeAreaGroup {
  id: PracticeAreaGroupId;
  label: string;
  tiles: PracticeAreaTile[];
}

/** The stage a tile prints its name from, or the name it carries itself. */
function tile(
  id: PracticeAreaTileId,
  label: string,
  description: string,
  extra: { nav?: ShellNavId; stage?: EncounterFlowStageId },
): PracticeAreaTile {
  // A stage tile's label IS the stage label — never a second spelling of it.
  const printed = extra.stage ? flowStageLabel(extra.stage) || label : label;
  return { id, label: printed, description, ...extra };
}

export const PRACTICE_AREA_GROUPS: readonly PracticeAreaGroup[] = [
  {
    id: "front-desk",
    label: "Front desk",
    tiles: [
      tile("schedule", "Schedule", "Book an appointment, then start the visit.", { nav: "schedule" }),
      tile("patients", "Patients", "Your own charts, plus the pinned Tutorial Patient.", { nav: "patients" }),
    ],
  },
  {
    id: "clinical",
    label: "Clinical",
    tiles: [
      tile("charts", "Charts", "The open patient's chart: vitals, medications, labs, notes.", {
        nav: "charts",
      }),
      tile("coding", "Coding", "Stage 3 — a signed note waiting for ICD-10 and CPT codes.", {
        nav: "coding",
        stage: "coding",
      }),
    ],
  },
  {
    id: "billing",
    label: "Billing",
    tiles: [
      tile("prior-auth", "Prior Auth", "Stage 4 — clear the procedure with the payer first.", {
        stage: "prior-auth",
      }),
      tile("claims", "Claims", "Stage 5 — build the claim and choose its paper.", {
        nav: "claims",
        stage: "billing",
      }),
      tile("payments", "Payments", "Stage 6 — post an 835 remittance to the ledger.", {
        nav: "payments",
        stage: "payments",
      }),
      tile("denials-ar", "Denials & AR", "Stage 7 — work denied lines and the balances owed.", {
        nav: "denials-ar",
        stage: "denials-ar",
      }),
    ],
  },
  {
    id: "review",
    label: "Review",
    tiles: [
      tile("reports", "Reports", "Your own totals: claims, posted money, AR aging.", { nav: "reports" }),
      tile("practice-cases", "Practice Cases", "Graded cases with a briefing, traps and a debrief.", {
        nav: "practice-cases",
      }),
    ],
  },
];

/** Every tile, in the order the dashboard prints them. */
export const PRACTICE_AREA_TILES: readonly PracticeAreaTile[] = PRACTICE_AREA_GROUPS.flatMap(
  (group) => group.tiles,
);

/**
 * The prior-auth statuses that need nothing more from the student. Everything
 * else — ordered, submitted, pending, info required, denied, an appeal — is
 * still open work, so a denial stays on the count until it is answered.
 */
export const PA_CLOSED_STATUSES: readonly string[] = ["approved", "closed", "completed"];

/** A small number on a tile, already worded ("3 claims", "1 to post"). */
export interface PracticeAreaCount {
  count: number;
  label: string;
}

/** Everything the counts are read from — the student's own saved records. */
export interface PracticeAreaCountInput {
  encounters: readonly PipelineEncounter[];
  dental: DentalTrackState | null;
  track: ShellTrack;
  /** The charts `/patients` lists: the student's own, never the demo charts. */
  ownPatientCount: number;
  /** Appointments booked for today, on this student's own charts. */
  appointmentsToday: number;
  /** The student's saved prior-auth records. */
  paRecords: readonly { status: string }[];
  /** How many graded cases are on offer. */
  caseCount: number;
  /** The moment the AR queue ages against. */
  now: string;
  nameForPatient: (patientId: string | null | undefined, fallback?: string | null) => string;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * The number each tile prints. Read through the same builders the pages use, so
 * a tile and its page never disagree; a tile with nothing honest to count is
 * simply absent from the result.
 */
export function practiceAreaCounts(
  input: PracticeAreaCountInput,
): Partial<Record<PracticeAreaTileId, PracticeAreaCount>> {
  const encounters = [...input.encounters];
  const { dental, nameForPatient } = input;

  const codingQueue = buildCodingQueue({ encounters, nameForPatient });
  const dentalCoding = dental && dental.caseId ? buildDentalCodingRow(dental, dentalCaseLabel(dental)) : null;

  const claimRows = claimRowsForTrack({
    track: input.track,
    medical: buildClaimRows({ encounters, nameForPatient }),
    dental: dental && dental.caseId ? buildDentalClaimRow(dental, dentalCaseLabel(dental)) : null,
  });

  const paymentRows = buildPaymentRows({ encounters, nameForPatient });

  // The AR queue is derived from posted money, exactly as `/denials-ar` derives it.
  const arSources: ArQueueSource[] = encounters.map((enc) => ({
    patientId: enc.patientId,
    patientName: enc.displayName,
    claimNumber: enc.claimNumber,
    remittances: enc.remittances,
    ledger: enc.ledger,
    arItems: enc.arItems,
  }));
  const arItems: ArWorkItem[] = buildArWorkQueue(arSources, input.now);
  const denialRows = buildDenialRows({ items: arItems, encounters, nameForPatient });
  const arRows = buildArRows({ items: arItems, nameForPatient });

  const openPriorAuths = input.paRecords.filter(
    (record) => !PA_CLOSED_STATUSES.includes(record.status),
  ).length;
  const chartsInProgress = encounters.filter((enc) => isMidStage(enc)).length;

  return {
    schedule: { count: input.appointmentsToday, label: `${input.appointmentsToday} today` },
    patients: {
      count: input.ownPatientCount,
      label: plural(input.ownPatientCount, "chart", "charts"),
    },
    charts: {
      count: chartsInProgress,
      label: `${chartsInProgress} in progress`,
    },
    coding: {
      count: codingQueue.total + (dentalCoding ? 1 : 0),
      label: `${codingQueue.total + (dentalCoding ? 1 : 0)} waiting`,
    },
    "prior-auth": { count: openPriorAuths, label: `${openPriorAuths} open` },
    claims: { count: claimRows.length, label: plural(claimRows.length, "claim", "claims") },
    payments: { count: paymentRows.length, label: `${paymentRows.length} to post` },
    "denials-ar": {
      count: denialRows.length + arRows.length,
      label: plural(denialRows.length + arRows.length, "item", "items"),
    },
    "practice-cases": { count: input.caseCount, label: plural(input.caseCount, "case", "cases") },
  };
}
