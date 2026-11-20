/**
 * Insurance record — the payer and subscriber data Registration & eligibility
 * captures, stored on the patient and read back by the claim forms.
 *
 * Why it exists: `Patient` used to carry one free-text `insurance` string, which
 * could only ever supply a payer label. A claim needs a member ID, a group
 * number, the relationship to the subscriber and (for the UB-04) the payer's EDI
 * identifier — none of which a label can supply, which is why the CMS-1500 used
 * to print an invented `INS-<mrn>` in box 1a. RegistrationStage collected the
 * values but kept them in component state; this module is the record it now
 * writes them to.
 *
 * The one rule that matters: **nothing here invents an identifier.** A field
 * registration did not capture stays empty, so the claim box falls through to
 * the tagged demo value (see `utils/demoClaimFill.ts`) instead of showing a
 * plausible-looking number that reads as real.
 *
 * Inspiration: the insurance/coverage record behind Epic's Registration
 * (coverage → subscriber → plan) and the 270/271 eligibility request it drives.
 */

import type {
  InsuranceCoverage,
  Patient,
  PatientInsurance,
} from "../store/patientStore";

/** Relationship values the CMS-1500 box 6 / UB-04 box 59 accept. */
export const SUBSCRIBER_RELATIONSHIPS = ["Self", "Spouse", "Child", "Other"] as const;

/** A blank coverage — every field empty, relationship defaulted to Self. */
export function emptyCoverage(): InsuranceCoverage {
  return {
    payerName: "",
    ediPayerId: "",
    subscriberId: "",
    groupNumber: "",
    relationshipToSubscriber: "Self",
    subscriberName: "",
    subscriberDob: "",
    subscriberSex: "",
    planName: "",
  };
}

/** True when a coverage carries anything worth putting on a claim. */
export function hasCoverage(coverage: InsuranceCoverage | null | undefined): boolean {
  if (!coverage) return false;
  return Boolean(
    coverage.payerName.trim() ||
      coverage.ediPayerId.trim() ||
      coverage.subscriberId.trim() ||
      coverage.groupNumber.trim(),
  );
}

/** Trim every string field of a coverage, keeping the relationship valid. */
function normaliseCoverage(coverage: Partial<InsuranceCoverage> | null | undefined): InsuranceCoverage {
  const base = emptyCoverage();
  if (!coverage) return base;
  const relationship = (coverage.relationshipToSubscriber ?? "").trim();
  return {
    payerName: (coverage.payerName ?? "").trim(),
    ediPayerId: (coverage.ediPayerId ?? "").trim(),
    subscriberId: (coverage.subscriberId ?? "").trim(),
    groupNumber: (coverage.groupNumber ?? "").trim(),
    relationshipToSubscriber: (SUBSCRIBER_RELATIONSHIPS as readonly string[]).includes(relationship)
      ? relationship
      : base.relationshipToSubscriber,
    subscriberName: (coverage.subscriberName ?? "").trim(),
    subscriberDob: (coverage.subscriberDob ?? "").trim(),
    subscriberSex: (coverage.subscriberSex ?? "").trim().toUpperCase(),
    planName: (coverage.planName ?? "").trim(),
  };
}

/**
 * Build the record Registration writes onto the patient. The secondary coverage
 * is dropped when the student left it empty, so "no other coverage" is stored as
 * `null` rather than as a row of blanks.
 */
export function buildInsuranceRecord(input: {
  primary: Partial<InsuranceCoverage>;
  secondary?: Partial<InsuranceCoverage> | null;
  source?: PatientInsurance["source"];
  updatedAt?: string;
}): PatientInsurance {
  const secondary = normaliseCoverage(input.secondary);
  return {
    primary: normaliseCoverage(input.primary),
    secondary: hasCoverage(secondary) ? secondary : null,
    source: input.source ?? "registration",
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  };
}

/**
 * Migration (schema v3 → v4): derive a record for a patient saved before the
 * record existed. The old free-text `insurance` string becomes the payer name
 * and the plan name; every identifier stays empty, because none was ever
 * captured and inventing one is exactly what this record is here to stop.
 *
 * Returns `undefined` when the patient has neither a record nor a payer label —
 * an empty record would be indistinguishable from "no coverage captured".
 */
export function deriveInsuranceRecord(patient: Patient): PatientInsurance | undefined {
  if (patient.insuranceRecord) return patient.insuranceRecord;
  const payer = (patient.insurance ?? "").trim();
  if (!payer) return undefined;
  return {
    primary: { ...emptyCoverage(), payerName: payer, planName: payer },
    secondary: null,
    source: "migrated",
    updatedAt: "",
  };
}
