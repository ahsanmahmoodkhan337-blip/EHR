/**
 * Resolve the patient a claim belongs to from the encounter.
 *
 * The pipeline's `patientId` is nullable, and on two real paths it is empty
 * while the encounter (and the banner above the claim) clearly knows the
 * patient: a student who restores a saved session lands on the saved patient
 * without the pipeline being re-stamped, and a student who walks from the
 * Coder's "Skip to Billing" into the Biller can arrive before it was ever set.
 * Reading only that field left boxes 1a, 2, 3, 4, 5, 6 and 7 blank on the
 * paper.
 *
 * So read the encounter, in order of authority:
 *   1. the pipeline's own encounter patient id, when set;
 *   2. the persisted working context (where the student left off);
 *   3. the open encounter record in the central store.
 *
 * Inspiration: Epic's encounter context — every claim hangs off an encounter,
 * and the encounter, not the screen, carries the patient.
 */

import { useEhrStore, type EhrEncounter } from "../store/ehrStore";

/** The patient id for the encounter in progress, or null when there is none. */
export function resolveEncounterPatientId(
  pipelinePatientId: string | null | undefined,
): string | null {
  if (pipelinePatientId) return pipelinePatientId;

  const { user } = useEhrStore.getState();
  if (user.context?.patientId) return user.context.patientId;

  const open = user.encounters.find((e) => !e.locked && e.patientId);
  return open?.patientId ?? null;
}

/**
 * Reactive form of `resolveEncounterPatientId`: the central store hydrates
 * after the first render, so a screen that resolved the patient once would keep
 * a claim built before the encounter was known. Subscribing re-renders it the
 * moment the encounter's patient lands.
 */
export function useEncounterPatientId(
  pipelinePatientId: string | null | undefined,
): string | null {
  const contextPatientId = useEhrStore((s) => s.user.context?.patientId ?? null);
  const openEncounterPatientId = useEhrStore(
    (s) => s.user.encounters.find((e) => !e.locked)?.patientId ?? null,
  );
  return pipelinePatientId || contextPatientId || openEncounterPatientId || null;
}

/** The open encounter for a patient, falling back to any encounter for them. */
export function resolveEncounter(patientId: string | null): EhrEncounter | null {
  if (!patientId) return null;
  const { user } = useEhrStore.getState();
  return (
    user.encounters.find((e) => e.patientId === patientId && !e.locked) ??
    user.encounters.find((e) => e.patientId === patientId) ??
    null
  );
}

/** The place of service the encounter was registered at, e.g. "23". */
export function resolveEncounterPlaceOfService(patientId: string | null): string | null {
  return resolveEncounter(patientId)?.placeOfService ?? null;
}

/** Reactive form of `resolveEncounterPlaceOfService`. */
export function useEncounterPlaceOfService(patientId: string | null): string | null {
  return useEhrStore((s) => {
    if (!patientId) return null;
    const encounter =
      s.user.encounters.find((e) => e.patientId === patientId && !e.locked) ??
      s.user.encounters.find((e) => e.patientId === patientId);
    return encounter?.placeOfService ?? null;
  });
}

/**
 * The date of service the encounter was registered at. This is what box 24A
 * reads when the Coder handed over no per-line dates — the alternative was
 * `today()`, a date nobody captured.
 */
export function useEncounterDateOfService(patientId: string | null): string | null {
  return useEhrStore((s) => {
    if (!patientId) return null;
    const encounter =
      s.user.encounters.find((e) => e.patientId === patientId && !e.locked) ??
      s.user.encounters.find((e) => e.patientId === patientId);
    return encounter?.dateOfService || null;
  });
}
