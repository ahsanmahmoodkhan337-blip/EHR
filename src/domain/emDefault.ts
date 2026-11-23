/**
 * emDefault.ts — which patient type the Coding stage's E/M picker opens on
 *
 * Inspiration: Epic's coding worklist and athenahealth's coding worksheet — the
 * worksheet opens on the level the encounter's own record supports, and the
 * coder is told why it opened there before changing it.
 *
 * THE RULE (owner's work order, phase 2; STANDING-RULES 6)
 * A patient with no earlier signed visit is a **new patient**, so the E/M
 * calculator opens on a new-patient code (99202–99205) rather than an
 * established-patient one (99212–99215). A default is a starting value, never an
 * auto-pick: the student sees the reason under the picker and can change it, and
 * nothing here writes a code into the chart.
 *
 * WHERE "NO EARLIER SIGNED VISIT" COMES FROM — two saved records, both named
 *  1. the patient's chart (`Patient.encounters`) — the visits already recorded
 *     for them. A chart with no visit on it is a patient the practice has not
 *     seen;
 *  2. the student's encounter records (`ehrStore.user.encounters`) — an
 *     encounter for this patient, other than the one being coded, that carries a
 *     signature. The visit being coded is not an earlier visit to itself.
 * The module is handed those two facts as counts and reads nothing else: no
 * seed list, no demo row, no hand-kept flag. A chart this build cannot find
 * (unknown patient) is not called a first visit.
 */

/** The two patient types an office/outpatient E/M code is chosen between. */
export type EmPatientType = "new" | "established";

export interface FirstVisitFacts {
  /** Visits the patient's chart already records (`Patient.encounters.length`). */
  chartVisits: number;
  /**
   * Encounters for this patient, other than the one being coded, that carry a
   * signature (`signedAt` or a lock) in `ehrStore.user.encounters`.
   */
  priorSignedEncounters: number;
}

/**
 * True when this is the patient's first visit: the chart holds no earlier visit
 * and no earlier encounter for them was signed.
 */
export function isFirstVisit({ chartVisits, priorSignedEncounters }: FirstVisitFacts): boolean {
  return chartVisits <= 0 && priorSignedEncounters <= 0;
}

/**
 * The patient type the E/M picker opens on. A first visit opens on a
 * new-patient code; every other visit keeps the established-patient default it
 * has always had.
 */
export function defaultEmPatientType(firstVisit: boolean): EmPatientType {
  return firstVisit ? "new" : "established";
}

/**
 * The one-line provenance drawn under the picker: where the open value came
 * from — the chart, or the student's own change.
 */
export const EM_PATIENT_TYPE_PROVENANCE: Record<EmPatientType | "typed", string> = {
  new: "Chart — no prior signed encounter, so a new-patient code",
  established: "Chart — a prior signed encounter is on file, so an established-patient code",
  typed: "Typed — your choice",
};

/** The provenance sentence for the value the picker is showing. */
export function emPatientTypeProvenance(
  patientType: EmPatientType,
  chosenByStudent: boolean,
): string {
  return chosenByStudent ? EM_PATIENT_TYPE_PROVENANCE.typed : EM_PATIENT_TYPE_PROVENANCE[patientType];
}
