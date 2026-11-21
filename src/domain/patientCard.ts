/**
 * patientCard — the licence and the insurance card the selected patient owns
 *
 * Inspired by: the coverage card behind Epic's Registration and eClinicalWorks'
 * patient header, where the member ID, payer and plan printed anywhere on the
 * patient's screen come from that patient's coverage record and nowhere else.
 *
 * The one rule: **a card belongs to one patient.** Every reader — the banner,
 * Registration's two printed cards and its transcription form, the eligibility
 * stage, the prior auth panel, the claim's identity boxes — asks this module,
 * and this module reads only the patient it was handed. A patient with no value
 * reads "Not on file"; it never borrows the patient opened before it, and it
 * never borrows a seeded or demo record.
 *
 * `patientCardMismatch` is the one deliberate disagreement per case: a spelling
 * difference between the name on the government ID and the name on the
 * insurance card, derived from that patient's own name so it is never a constant
 * string. Registration prints it only after the student has answered the
 * identity question and pressed Verify (standing rule 6).
 *
 * Nothing here writes. The card returned is a copy, so a caller that edits a
 * field cannot reach back into the patient record.
 */

/** What every screen prints when the selected patient has no value on file. */
export const NOT_ON_FILE = "Not on file";

/**
 * The part of a patient this module reads: the patient's own demographics, the
 * licence the state issued, and the coverage record. A full `Patient` satisfies
 * it, and so does a banner built from one — nothing else is accepted, which is
 * what keeps a neighbour's card out.
 */
export interface CardCoverage {
  payerName?: string;
  planName?: string;
  subscriberId?: string;
  groupNumber?: string;
  ediPayerId?: string;
  relationshipToSubscriber?: string;
  subscriberName?: string;
}

export interface CardHolder {
  id?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  /** Licence number printed on the government ID, when the chart holds one. */
  licenseNumber?: string;
  /** State that issued it; falls back to the state in the patient's address. */
  licenseState?: string;
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
  /** True when the chart holds a name, a date of birth or a licence number. */
  identityOnFile: boolean;
  /** The patient's own name, as the government ID prints it. */
  fullName: string;
  firstName: string;
  lastName: string;
  /** MM/DD/YYYY — the way a licence and a card print it. */
  dateOfBirth: string;
  sex: string;
  address: string;
  licenseNumber: string;
  licenseState: string;
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
  identityOnFile: false,
  fullName: "",
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  sex: "",
  address: "",
  licenseNumber: "",
  licenseState: "",
  payerName: "",
  planName: "",
  memberId: "",
  groupNumber: "",
  payerId: "",
  relationship: "",
};

/** A value, or "Not on file" when the patient's record does not hold one. */
export function onFileValue(value: string | undefined | null): string {
  return (value ?? "").trim() || NOT_ON_FILE;
}

/**
 * The chart's `YYYY-MM-DD` date of birth as the licence prints it, MM/DD/YYYY.
 * Anything that is not a real date reads as empty, never as "Invalid Date".
 */
export function formatCardDate(iso: string | undefined | null): string {
  const value = (iso ?? "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return "";
  const [, year, month, day] = match;
  return `${month}/${day}/${year}`;
}

/**
 * The two-letter state a US address ends in ("… , Springfield, IL 62701").
 * Read from the patient's own address only — a patient with none gets "".
 */
export function stateFromAddress(address: string | undefined | null): string {
  const value = (address ?? "").trim();
  if (!value) return "";
  const match = /,\s*([A-Z]{2})\s+\d{5}(?:-\d{4})?\s*$/.exec(value);
  return match ? match[1] : "";
}

/**
 * The card on this patient's chart.
 *
 * `patient.insurance` is the patient's own free-text payer label (kept for
 * display since before the structured record existed), so it may stand in for a
 * missing payer name — but nothing is read from any other patient, from a seed
 * list, or from a module-level default.
 */
export function patientCard(patient: CardHolder | null | undefined): PatientCard {
  if (!patient) return { ...EMPTY_CARD };

  const primary = patient.insuranceRecord?.primary;
  const payerName = (primary?.payerName ?? "").trim() || (patient.insurance ?? "").trim();
  const planName = (primary?.planName ?? "").trim();
  const memberId = (primary?.subscriberId ?? "").trim();
  const firstName = (patient.firstName ?? "").trim();
  const lastName = (patient.lastName ?? "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const dateOfBirth = formatCardDate(patient.dateOfBirth);
  const address = (patient.address ?? "").trim();
  const licenseNumber = (patient.licenseNumber ?? "").trim();
  const licenseState = (patient.licenseState ?? "").trim() || stateFromAddress(address);

  return {
    onFile: Boolean(payerName || planName || memberId),
    identityOnFile: Boolean(fullName || dateOfBirth || licenseNumber),
    fullName,
    firstName,
    lastName,
    dateOfBirth,
    sex: (patient.gender ?? "").trim(),
    address,
    licenseNumber,
    licenseState,
    payerName,
    planName,
    memberId,
    groupNumber: (primary?.groupNumber ?? "").trim(),
    payerId: (primary?.ediPayerId ?? "").trim(),
    relationship: (primary?.relationshipToSubscriber ?? "").trim(),
  };
}

// ─── The one deliberate mismatch per case ───────────────────────────

/** The disagreement Registration reveals after the student presses Verify. */
export interface CardMismatch {
  /** Which document disagrees — always the name on the insurance card. */
  kind: "name";
  /** The field, as the reveal prints it. */
  field: string;
  /** The name the government ID prints — the patient's own record. */
  recordValue: string;
  /** The name the insurance card prints. */
  cardValue: string;
  /** What the disagreement costs at the payer. */
  consequence: string;
}

/** FNV-1a — a stable number per patient id, so a case always mismatches the same way. */
function stableHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

/**
 * The spelling variants a front desk actually sees on a card: a doubled letter,
 * a c/k, an ie/ei, a trailing a/ah. Each transform changes exactly one place in
 * the name, which is what keeps the case to one deliberate mismatch.
 */
const SPELLING_VARIANTS: [RegExp, string][] = [
  [/ie/, "ei"],
  [/k/, "c"],
  [/c/, "k"],
  [/ei/, "ie"],
  [/y$/, "ie"],
  [/a$/, "ah"],
  [/son$/, "sen"],
  [/ti/, "ci"],
  [/ci/, "ti"],
  [/ph/, "f"],
  [/ck/, "k"],
  [/k/, "ck"],
  [/ll/, "l"],
  [/l$/, "ll"],
  [/oe$/, "o"],
  [/z/, "s"],
  [/s$/, "z"],
];

/** One spelling difference in one word, chosen by the seed. "" when none applies. */
function misspell(word: string, seed: number): string {
  const value = word.trim().toLowerCase();
  if (value.length < 2) return "";
  const start = seed % SPELLING_VARIANTS.length;
  for (let i = 0; i < SPELLING_VARIANTS.length; i++) {
    const [pattern, replacement] = SPELLING_VARIANTS[(start + i) % SPELLING_VARIANTS.length];
    const next = value.replace(pattern, replacement);
    // Only a variant that keeps a word of the same length is a spelling
    // difference a card could carry; a transform that eats the name is skipped.
    if (next !== value && next.length >= 2) {
      return next.charAt(0).toUpperCase() + next.slice(1);
    }
  }
  return "";
}

/**
 * The one deliberate mismatch this case carries, or null when the chart holds
 * no name to disagree about.
 *
 * It is generated from the patient — the surname (or the given name when the
 * surname has no usable spelling variant) is spelled one letter differently on
 * the insurance card than on the government ID — so two patients never carry the
 * same string and no constant is hardcoded anywhere. Exactly one per case.
 */
export function patientCardMismatch(patient: CardHolder | null | undefined): CardMismatch | null {
  const card = patientCard(patient);
  if (!card.fullName) return null;

  const seed = stableHash(`${patient?.id ?? ""}|${card.fullName}`);
  const lastNameVariant = misspell(card.lastName, seed);
  const firstNameVariant = misspell(card.firstName, seed >> 3);

  let recordValue = card.fullName;
  let cardValue = "";
  if (lastNameVariant) {
    recordValue = [card.firstName, card.lastName].filter(Boolean).join(" ");
    cardValue = [card.firstName, lastNameVariant].filter(Boolean).join(" ");
  } else if (firstNameVariant) {
    recordValue = [card.firstName, card.lastName].filter(Boolean).join(" ");
    cardValue = [firstNameVariant, card.lastName].filter(Boolean).join(" ");
  } else {
    return null;
  }

  return {
    kind: "name",
    field: "Member name",
    recordValue,
    cardValue,
    consequence:
      "A subscriber name that differs from the payer's file fails eligibility at the payer (name mismatch, CARC 31) — the chart carries the government ID's spelling.",
  };
}

/**
 * The name the insurance card prints: the patient's own, spelled the way the
 * card in their hand spells it. With no mismatch it is simply their name.
 */
export function cardMemberName(patient: CardHolder | null | undefined): string {
  const card = patientCard(patient);
  const mismatch = patientCardMismatch(patient);
  if (mismatch) return mismatch.cardValue;
  return (patient?.insuranceRecord?.primary?.subscriberName ?? "").trim() || card.fullName;
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
