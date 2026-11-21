/**
 * inbox.ts — who the encounter's Inbox lists
 *
 * Inspired by: eClinicalWorks' Inbox / Epic's Patient Lists activity, where the
 * left-hand list is the practice's patients with today's visits at the top.
 *
 * Owner's audit, 2026-11-20, item 3: "A patient created through New Appointment
 * also appears in the Inbox and the Patients list." The 19 November panel only
 * listed patients with an appointment on the one date the workspace had picked
 * at mount, so a patient booked through New Appointment for any other date was
 * missing from the Inbox the moment it was created.
 *
 * The rule here is that the panel never drops a patient:
 *
 *   1. The Tutorial patient stays pinned first, where 19 November put it.
 *   2. Then the patients booked on the date on screen — the day's list.
 *   3. Then every other patient who has an appointment at all, so a visit booked
 *      for another day is still one click away.
 *   4. Then the student's own registered patients with no appointment yet.
 *
 * **The 18 built-in demo charts are never live inbox work**
 * (`specs/slice-inbox-patients.md`). They are teaching charts and stay reachable
 * only through Practice Cases. This module holds that rule for every list the
 * student reads — the Inbox, `/patients`, the header search and the New
 * Appointment picker — while the *lookup* by id (`useAllPatients`,
 * `getPatientById`) keeps every chart, so a claim on a demo chart still names
 * its patient.
 *
 * Pure: no store, no clock, no mutation of the arrays handed in (the old
 * expression unshifted into the store's own memoised array).
 */

import type { EhrAppointment } from "../store/ehrStore";

/** The fields the list needs from a patient. */
export interface InboxPatientLike {
  id: string;
  firstName: string;
  lastName: string;
  /** True on the 18 built-in demo charts and on the Tutorial Patient. */
  isSeed?: boolean;
}

/** The patient the tutorial runs on — pinned first, as 19 November did. */
export const TUTORIAL_PATIENT_ID = "DEMO";

/** True for a chart the student owns: registered by them or booked by them. */
export function isOwnPatient(patient: { isSeed?: boolean }): boolean {
  return patient.isSeed !== true;
}

/** True for the pinned Tutorial Patient. */
export function isTutorialPatient(patient: { id: string }): boolean {
  return patient.id === TUTORIAL_PATIENT_ID;
}

/**
 * The charts a student may *search* or *pick*: their own, plus the pinned
 * Tutorial Patient they practise on. The 18 demo charts are not offered here —
 * they belong to Practice Cases.
 */
export function studentPatientList<P extends InboxPatientLike>(patients: readonly P[]): P[] {
  return patients.filter((p) => isOwnPatient(p) || isTutorialPatient(p));
}

/**
 * The student's own charts only — what `/patients` lists and what the Inbox
 * badge counts. The Tutorial Patient is pinned practice, not a chart of theirs.
 */
export function ownPatientList<P extends InboxPatientLike>(patients: readonly P[]): P[] {
  return patients.filter(isOwnPatient);
}

/**
 * An appointment's patient. `patientId` is null on a legacy row, which only
 * carries the typed name; matching that row to a patient is by full name.
 */
function appointmentIsFor(appointment: EhrAppointment, patient: InboxPatientLike): boolean {
  if (appointment.patientId) return appointment.patientId === patient.id;
  const booked = appointment.patientName.trim().toLowerCase();
  if (!booked) return false;
  const full = `${patient.firstName} ${patient.lastName}`.trim().toLowerCase();
  return booked === full || booked.includes(full);
}

/** Whether the patient has any appointment on `date` (YYYY-MM-DD). */
export function hasAppointmentOn(
  patient: InboxPatientLike,
  appointments: readonly EhrAppointment[],
  date: string,
): boolean {
  return appointments.some((a) => a.date === date && appointmentIsFor(a, patient));
}

/** Whether the patient has any appointment at all, on any date. */
export function hasAnyAppointment(
  patient: InboxPatientLike,
  appointments: readonly EhrAppointment[],
): boolean {
  return appointments.some((a) => appointmentIsFor(a, patient));
}

/**
 * The Inbox list, in the order above. Every patient handed in appears exactly
 * once; a new one is never left out because of the date it was booked for.
 *
 * Only the Tutorial Patient and the student's own charts are listed: a demo
 * chart handed in is dropped here, so no caller can turn one into live work.
 */
export function inboxPatients<P extends InboxPatientLike>(
  patients: readonly P[],
  appointments: readonly EhrAppointment[],
  selectedDate: string,
): P[] {
  const tutorial = patients.find((p) => isTutorialPatient(p));
  // The Tutorial Patient is pinned above and never listed twice, even when an
  // older saved record carries no `isSeed` flag.
  const rest = patients.filter((p) => isOwnPatient(p) && !isTutorialPatient(p));

  const onTheDay: P[] = [];
  const bookedElsewhere: P[] = [];
  const everyoneElse: P[] = [];
  for (const patient of rest) {
    if (hasAppointmentOn(patient, appointments, selectedDate)) onTheDay.push(patient);
    else if (hasAnyAppointment(patient, appointments)) bookedElsewhere.push(patient);
    else everyoneElse.push(patient);
  }

  return [...(tutorial ? [tutorial] : []), ...onTheDay, ...bookedElsewhere, ...everyoneElse];
}
