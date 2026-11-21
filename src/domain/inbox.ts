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
 *   4. Then everyone else in the patient list, in list order.
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
}

/** The patient the tutorial runs on — pinned first, as 19 November did. */
export const TUTORIAL_PATIENT_ID = "DEMO";

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
 */
export function inboxPatients<P extends InboxPatientLike>(
  patients: readonly P[],
  appointments: readonly EhrAppointment[],
  selectedDate: string,
): P[] {
  const tutorial = patients.find((p) => p.id === TUTORIAL_PATIENT_ID);
  const rest = patients.filter((p) => p.id !== TUTORIAL_PATIENT_ID);

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
