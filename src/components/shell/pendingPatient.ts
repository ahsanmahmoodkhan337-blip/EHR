/**
 * Handoff for "open this patient" when the search, the schedule or one of the
 * money-cycle rail pages runs from a page that has no patient workspace (the
 * dental track, the medical cases runner, /schedule, /patients, /coding,
 * /claims, /payments, /denials-ar, /reports).
 *
 * The shell's global search and the schedule live on their own pages now
 * (spec `phase-1-navigation.md`), but only the medical workspace at "/" can
 * actually open a chart. Picking a patient elsewhere records it here and
 * navigates home; the workspace reads it once on mount and opens that chart.
 * Nothing is persisted — it is a single in-memory hop, so a stale id can never
 * outlive the navigation that set it.
 *
 * `name` is carried for an appointment booked against someone who is not in the
 * patient database yet: the workspace opens a blank encounter under that name
 * rather than silently dropping the visit.
 *
 * `role` is carried by the rail pages (`specs/eleven-rail-pages.md`): a Coding
 * row opens the chart at the Coder's screen, an AR row at the AR specialist's.
 * The workspace applies it once, the same way it applies the patient, so a row
 * lands on the stage that holds its work instead of on whatever was open last.
 */

import type { Role } from "../../store/pipelineEncounter";

export interface PendingPatient {
  patientId: string | null;
  name?: string;
  /** The stage whose screen should open, when the caller knows it. */
  role?: Role;
}

let requested: PendingPatient | null = null;

export function requestPatientOpen(patientId: string | null, name?: string, role?: Role): void {
  requested = { patientId, name, role };
}

/** Read and clear the pending request. Returns null when there is none. */
export function consumeRequestedPatient(): PendingPatient | null {
  const pending = requested;
  requested = null;
  return pending;
}
