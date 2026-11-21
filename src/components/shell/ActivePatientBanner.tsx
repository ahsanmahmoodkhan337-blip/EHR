/**
 * ActivePatientBanner — the patient banner on a money-cycle list page.
 *
 * Inspired by: Epic Hyperspace's persistent patient context strip, which stays
 * on screen when the coder or the biller leaves the chart for a work queue and
 * comes back — the queue is a view of the encounter you were in, not a separate
 * place with its own patient.
 *
 * Owner's audit, 2026-11-20, item 4 ("patient and track context persist across
 * navigation and reload"). Coding, Claims, Payments and Denials & AR are lists of
 * the student's saved encounters; before this component they drew no banner at
 * all, so opening one directly lost the patient the student was working on.
 *
 * It reads **the one patient the pipeline store has open**
 * (`store/pipelineStore.tsx` — `activePatientId`, persisted per student by
 * `store/persistence.ts` under `hh_userdata_<phone>`), so a refresh, a Back and a
 * pasted address all show the same patient the encounter shows. Nothing here
 * writes: no patient is selected, no encounter is created, and a student with no
 * patient open gets no banner rather than a made-up one.
 */

import { usePatientStore } from "../../store/patientStore";
import { usePipeline } from "../../store/pipelineStore";
import { PatientBanner, type BannerPatient } from "./PatientBanner";

export function ActivePatientBanner() {
  const { activePatientId } = usePipeline();
  const { getPatientById } = usePatientStore();
  const patient = activePatientId ? getPatientById(activePatientId) : undefined;

  const banner: BannerPatient | null = patient
    ? {
        firstName: patient.firstName,
        lastName: patient.lastName,
        mrn: patient.mrn,
        dateOfBirth: patient.dateOfBirth,
        gender: patient.gender,
        allergies: (patient.allergies ?? []).map((a) => ({ allergen: a.allergen, severity: a.severity })),
        insurance: patient.insurance,
        insuranceRecord: patient.insuranceRecord,
        primaryCareProvider: patient.primaryCareProvider,
      }
    : null;

  // No patient open — the strip stays out of the way (PatientBanner returns null).
  return <PatientBanner patient={banner} />;
}
