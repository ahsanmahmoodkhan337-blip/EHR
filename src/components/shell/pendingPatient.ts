/**
 * Handoff for "open this patient" when the search or the schedule runs from a
 * page that has no patient workspace (the dental track, the medical cases
 * runner, /schedule, /patients).
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
 */

export interface PendingPatient {
  patientId: string | null;
  name?: string;
}

let requested: PendingPatient | null = null;

export function requestPatientOpen(patientId: string | null, name?: string): void {
  requested = { patientId, name };
}

/** Read and clear the pending request. Returns null when there is none. */
export function consumeRequestedPatient(): PendingPatient | null {
  const pending = requested;
  requested = null;
  return pending;
}
