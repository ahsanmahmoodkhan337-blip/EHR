/**
 * tutorialIdentity — the Tutorial Patient's own name, spelled once
 *
 * Inspired by: Epic's training patient, whose reference chart prints one name on
 * every screen — the banner, the licence, the insurance card, claim box 2 and box
 * 4 — and never a second spelling of it.
 *
 * THE DEFECT THIS FIXES (owner report, 2026-11-23)
 * The Tutorial Patient's insurance card printed MEMBER NAME "Tutorial Pateint".
 * That string was in no seed and in no saved record: it was generated at render
 * time by the deliberate one-mismatch trap in `domain/patientCard.ts`
 * (`caseMismatch`), which transposes two letters of the patient's own surname to
 * teach that a card and a government ID can disagree. On the worked example it
 * reads as a typo, and the standard chart must not contradict itself, so the trap
 * is switched off for this one chart. The spelling it prints lives here, once, so
 * the seed, the card and the repair below cannot drift apart.
 *
 * THE REPAIR — a chart saved before the fix
 * A record written by an earlier build can hold the transposed spelling, so it is
 * corrected on open. The correction is narrow on purpose: a value is replaced only
 * when it is a single adjacent transposition of this chart's own seeded name. A
 * name the student typed that is anything else — or a subscriber who is genuinely
 * someone else — is left exactly as it is.
 *
 * No imports: `domain/patientCard.ts` reads the id from here and this module must
 * never import it back (that would be a cycle, and the card is a leaf on purpose).
 */

/** The Tutorial Patient's id — the one chart that is a worked example, not practice. */
export const TUTORIAL_PATIENT_ID = "DEMO";

/** The given name the chart is seeded with, and the one its card prints. */
export const TUTORIAL_PATIENT_FIRST_NAME = "Tutorial";

/** The surname the chart is seeded with, and the one its card prints. */
export const TUTORIAL_PATIENT_LAST_NAME = "Patient";

/** The part of a patient the repair reads. */
export interface TutorialNameSource {
  id?: string;
  firstName?: string;
  lastName?: string;
  insuranceRecord?: {
    primary?: { subscriberName?: string } | null;
  } | null;
}

/** The fields to correct. A field that is absent is left exactly as it is. */
export interface TutorialNameRepair {
  firstName?: string;
  lastName?: string;
  /** The subscriber name on the coverage record — CMS-1500 box 4. */
  subscriberName?: string;
}

/** True when `value` is `right` with one adjacent pair of letters swapped. */
function isTranspositionOf(value: string, right: string): boolean {
  if (!value || value.length !== right.length || value === right) return false;
  let at = -1;
  for (let i = 0; i < value.length; i += 1) {
    if (value[i] !== right[i]) {
      at = i;
      break;
    }
  }
  if (at < 0 || at + 1 >= value.length) return false;
  const swapped = value.slice(0, at) + value[at + 1] + value[at] + value.slice(at + 2);
  return swapped === right;
}

/** `right` when `value` is a transposition of it, otherwise undefined. */
function corrected(value: string | undefined, right: string): string | undefined {
  const held = (value ?? "").trim();
  return held && isTranspositionOf(held, right) ? right : undefined;
}

/**
 * What to correct on this chart, or `null` when there is nothing to correct.
 *
 * Only the Tutorial Patient is touched, and only the known hand-transcription
 * error: the given name, the surname and the subscriber name on its coverage
 * record are each replaced when they are one adjacent swap away from the name
 * this chart is seeded with. Nothing else — a name the student typed, or a
 * subscriber who is not the patient — is ever overwritten.
 */
export function tutorialNameRepair(
  patient: TutorialNameSource | null | undefined,
): TutorialNameRepair | null {
  if (!patient || patient.id !== TUTORIAL_PATIENT_ID) return null;

  const firstName = corrected(patient.firstName, TUTORIAL_PATIENT_FIRST_NAME);
  const lastName = corrected(patient.lastName, TUTORIAL_PATIENT_LAST_NAME);

  // The card's subscriber name is the patient's own on a SELF chart, so it is
  // compared with the name this chart is about to print — after the repair.
  const fullName = [
    firstName ?? (patient.firstName ?? "").trim(),
    lastName ?? (patient.lastName ?? "").trim(),
  ]
    .filter(Boolean)
    .join(" ");
  const subscriberName = corrected(
    patient.insuranceRecord?.primary?.subscriberName,
    fullName,
  );

  if (!firstName && !lastName && !subscriberName) return null;
  return {
    ...(firstName ? { firstName } : {}),
    ...(lastName ? { lastName } : {}),
    ...(subscriberName ? { subscriberName } : {}),
  };
}
