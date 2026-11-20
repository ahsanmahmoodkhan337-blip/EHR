/**
 * patientCard — the insurance card the selected patient owns
 *
 * Inspired by: the coverage card behind Epic's Registration and eClinicalWorks'
 * patient header, where the member ID, payer and plan printed anywhere on the
 * patient's screen come from that patient's coverage record and nowhere else.
 *
 * The one rule: **a card belongs to one patient.** Every reader — the banner,
 * Registration's transcription form, the eligibility stage, the prior auth
 * panel, the claim's identity boxes — asks this module, and this module reads
 * only the patient it was handed. A patient with no card on file reads
 * "Not on file"; it never borrows the patient opened before it, and it never
 * borrows a seeded or demo record.
 *
 * Nothing here writes. The card returned is a copy, so a caller that edits a
 * field cannot reach back into the patient record.
 */

/** What every screen prints when the selected patient has no card on file. */
export const NOT_ON_FILE = "Not on file";

/**
 * The part of a patient this module reads: the patient's own coverage record and
 * the free-text payer label that predates it. A full `Patient` satisfies it, and
 * so does a banner built from one — nothing else is accepted, which is what
 * keeps a neighbour's card out.
 */
export interface CardCoverage {
  payerName?: string;
  planName?: string;
  subscriberId?: string;
  groupNumber?: string;
  ediPayerId?: string;
  relationshipToSubscriber?: string;
}

export interface CardHolder {
  insurance?: string;
  insuranceRecord?: {
    primary?: CardCoverage | null;
    secondary?: CardCoverage | null;
  } | null;
}

/** The card fields the app reads. Empty string means "not captured". */
export interface PatientCard {
  /** True when the patient's own record holds a payer, plan or member ID. */
  onFile: boolean;
  payerName: string;
  planName: string;
  /** Box 1a on the CMS-1500 / box 3 on the ADA claim — the member ID. */
  memberId: string;
  groupNumber: string;
  payerId: string;
  relationship: string;
}

const EMPTY_CARD: PatientCard = {
  onFile: false,
  payerName: "",
  planName: "",
  memberId: "",
  groupNumber: "",
  payerId: "",
  relationship: "",
};

/**
 * The card on this patient's chart.
 *
 * `patient.insurance` is the patient's own free-text payer label (kept for
 * display since before the structured record existed), so it may stand in for a
 * missing payer name — but nothing is read from any other patient, from a seed
 * list, or from a module-level default.
 */
export function patientCard(patient: CardHolder | null | undefined): PatientCard {
  const primary = patient?.insuranceRecord?.primary;
  if (!patient || !primary) return { ...EMPTY_CARD };

  const payerName = (primary.payerName ?? "").trim() || (patient.insurance ?? "").trim();
  const planName = (primary.planName ?? "").trim();
  const memberId = (primary.subscriberId ?? "").trim();

  return {
    onFile: Boolean(payerName || planName || memberId),
    payerName,
    planName,
    memberId,
    groupNumber: (primary.groupNumber ?? "").trim(),
    payerId: (primary.ediPayerId ?? "").trim(),
    relationship: (primary.relationshipToSubscriber ?? "").trim(),
  };
}

/**
 * The one line the banner prints: payer, plan and member ID, or "Not on file".
 * A field the record does not hold is simply left out — no dashes standing in
 * for an identifier, and no value borrowed from anywhere else.
 */
export function cardLine(card: PatientCard): string {
  if (!card.onFile) return NOT_ON_FILE;
  return [card.payerName, card.planName, card.memberId ? `ID ${card.memberId}` : ""]
    .filter(Boolean)
    .join(" · ");
}

/** The member ID, or "Not on file" when this patient has none. */
export function memberIdOnFile(card: PatientCard): string {
  return card.memberId || NOT_ON_FILE;
}

/** The payer, or "Not on file" when this patient has none. */
export function payerOnFile(card: PatientCard): string {
  return card.payerName || NOT_ON_FILE;
}

/**
 * What Registration's transcription form starts from.
 *
 * Read from the selected patient only. A patient with no card gets blanks — the
 * form must not keep the previous patient's card in its fields, because pressing
 * Verify would then write that card onto this patient's chart.
 */
export function registrationCardFor(patient: CardHolder | null | undefined): {
  payerName: string;
  subscriberId: string;
  groupNumber: string;
  payerId: string;
  relationship: string;
  secondaryPayerName: string;
  secondaryPayerId: string;
  secondarySubscriberId: string;
  secondaryGroupNumber: string;
} {
  const card = patientCard(patient);
  const secondary = patient?.insuranceRecord?.secondary ?? null;
  return {
    payerName: card.payerName,
    subscriberId: card.memberId,
    groupNumber: card.groupNumber,
    payerId: card.payerId,
    relationship: card.relationship || "Self",
    secondaryPayerName: (secondary?.payerName ?? "").trim(),
    secondaryPayerId: (secondary?.ediPayerId ?? "").trim(),
    secondarySubscriberId: (secondary?.subscriberId ?? "").trim(),
    secondaryGroupNumber: (secondary?.groupNumber ?? "").trim(),
  };
}
