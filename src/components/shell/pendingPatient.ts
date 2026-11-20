/**
 * Handoff for "open this patient" when the search runs from a page that has no
 * patient workspace (the dental track, the medical cases runner).
 *
 * The shell's global search lives in the top bar on every page, but only the
 * medical workspace at "/" can actually open a chart. Picking a patient from
 * another page records the id here and navigates home; the workspace reads it
 * once on mount and opens that chart. Nothing is persisted — it is a single
 * in-memory hop, so a stale id can never outlive the navigation that set it.
 */

let requestedPatientId: string | null = null;

export function requestPatientOpen(patientId: string): void {
  requestedPatientId = patientId;
}

/** Read and clear the pending request. Returns null when there is none. */
export function consumeRequestedPatient(): string | null {
  const pending = requestedPatientId;
  requestedPatientId = null;
  return pending;
}
