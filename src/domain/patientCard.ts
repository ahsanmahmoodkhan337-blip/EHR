/**
 * patientCard — the licence and insurance card the selected patient owns
 *
 * Inspired by: the coverage card behind Epic's Registration and eClinicalWorks'
 * patient header, where the member ID, payer and plan printed anywhere on the
 * patient's screen come from that patient's coverage record and nowhere else.
 *
 * The one rule: **a card belongs to one patient.** Every reader — the banner,
 * Registration's licence and insurance cards, the eligibility stage, the prior
 * auth panel, the claim's identity boxes — asks this module, and this module
 * reads only the patient it was handed. A patient with no card on file reads
 * "Not on file"; it never borrows the patient opened before it, and it never
 * borrows a seeded or demo record.
 *
 * Two documents, one patient:
 *   - the **government ID** carries identity — name, date of birth, sex, address,
 *     licence number and state — from the patient's own demographics;
 *   - the **insurance card** carries coverage — payer, plan, member ID, group,
 *     payer ID, relationship — from the patient's own `insuranceRecord`.
 * Registration used to print the same literal "Jonathan/Jonathon Doe" card for
 * every patient; before that, every patient's card was another patient's world.
 *
 * The licence number and state are not charted anywhere, so they are derived
 * once, here, from the patient's own record: the state from the state in the
 * patient's own address, the number from a hash of that patient's own MRN, name
 * and date of birth. That makes them stable for a patient across reloads and
 * different between patients — never a constant, never another patient's — and
 * "Not on file" when there is nothing on the chart to derive them from.
 *
 * One deliberate mismatch per case (`caseMismatch`): the insurance card prints a
 * name spelling the government ID does not have. It is generated from that
 * patient's own name — never a constant string — and the caller must not print
 * it until the student has committed an answer (standing rule 6). The Tutorial
 * Patient is the one chart that carries none: it is the standard reference, so
 * its two documents agree (`domain/tutorialIdentity.ts`).
 *
 * Nothing here writes. The card returned is a copy, so a caller that edits a
 * field cannot reach back into the patient record.
 */

import { TUTORIAL_PATIENT_ID } from "./tutorialIdentity";
import { box11Value } from "./claimParties";

/** What every screen prints when the selected patient has no card on file. */
export const NOT_ON_FILE = "Not on file";

/**
 * The part of a patient this module reads: the patient's own demographics, the
 * coverage record and the free-text payer label that predates it. A full
 * `Patient` satisfies it, and so does a banner built from one — nothing else is
 * accepted, which is what keeps a neighbour's card out.
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
  id?: string;
  mrn?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  insurance?: string;
  insuranceRecord?: {
    primary?: CardCoverage | null;
    secondary?: CardCoverage | null;
    cardIssued?: boolean;
  } | null;
}

/** The card fields the app reads. Empty string means "not captured". */
export interface PatientCard {
  /** True when the patient's own record holds a payer, plan or member ID. */
  onFile: boolean;
  // ── The government ID: identity, from the patient's own demographics ──
  /** "First Last", or "" when the chart holds no name. */
  fullName: string;
  /** MM/DD/YYYY, or "" when the chart holds no usable date of birth. */
  dateOfBirth: string;
  sex: string;
  address: string;
  licenceNumber: string;
  licenceState: string;
  // ── The insurance card: coverage, from the patient's own record ──
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
  fullName: "",
  dateOfBirth: "",
  sex: "",
  address: "",
  licenceNumber: "",
  licenceState: "",
  payerName: "",
  planName: "",
  memberId: "",
  groupNumber: "",
  payerId: "",
  relationship: "",
};

// ─── Small deterministic helpers ──────────────────────────────────

/** FNV-1a — a stable hash, so a patient's derived fields never change. */
function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** The chart's ISO `YYYY-MM-DD` date of birth as the card prints it. */
function cardDate(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) return `${iso[2]}/${iso[3]}/${iso[1]}`;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value;
  return "";
}

/** The state printed on the licence, taken from the patient's own address. */
function stateFromAddress(address: string): string {
  const value = address.trim();
  if (!value) return "";
  const withZip = /,\s*([A-Za-z]{2})\s+\d{5}(?:-\d{4})?\b/.exec(value);
  if (withZip) return withZip[1].toUpperCase();
  const trailing = /,\s*([A-Za-z]{2})\s*$/.exec(value);
  if (trailing) return trailing[1].toUpperCase();
  return "";
}

/**
 * The licence number on this patient's government ID.
 *
 * Derived from the patient's own MRN, name and date of birth — the same patient
 * gets the same number on every screen and after every reload, and two patients
 * get different numbers. "" (printed "Not on file") when the chart holds nothing
 * to derive it from.
 */
function licenceNumberFor(patient: CardHolder): string {
  const seed = [
    (patient.mrn ?? "").trim(),
    (patient.firstName ?? "").trim(),
    (patient.lastName ?? "").trim(),
    (patient.dateOfBirth ?? "").trim(),
  ].join("|");
  if (!seed.replace(/\|/g, "").trim()) return "";
  return `D${String(hash32(seed) % 100000000).padStart(8, "0")}`;
}

/**
 * The card on this patient's chart: identity from the chart's demographics,
 * coverage from the patient's own `insuranceRecord`.
 *
 * `patient.insurance` is the patient's own free-text payer label (kept for
 * display since before the structured record existed), so it may stand in for a
 * missing payer name — but nothing is read from any other patient, from a seed
 * list, or from a module-level default.
 */
export function patientCard(patient: CardHolder | null | undefined): PatientCard {
  if (!patient) return { ...EMPTY_CARD };

  const primary = patient.insuranceRecord?.primary ?? null;
  const payerName = (primary?.payerName ?? "").trim() || (patient.insurance ?? "").trim();
  const planName = (primary?.planName ?? "").trim();
  const memberId = (primary?.subscriberId ?? "").trim();

  const firstName = (patient.firstName ?? "").trim();
  const lastName = (patient.lastName ?? "").trim();
  const address = (patient.address ?? "").trim();

  return {
    onFile: Boolean(payerName || planName || memberId),
    fullName: [firstName, lastName].filter(Boolean).join(" "),
    dateOfBirth: cardDate(patient.dateOfBirth ?? ""),
    sex: (patient.gender ?? "").trim(),
    address,
    licenceNumber: licenceNumberFor(patient),
    licenceState: stateFromAddress(address),
    payerName,
    planName,
    memberId,
    groupNumber: (primary?.groupNumber ?? "").trim(),
    payerId: (primary?.ediPayerId ?? "").trim(),
    relationship: (primary?.relationshipToSubscriber ?? "").trim(),
  };
}

/**
 * The payer a claim bills, and the payer the 277CA and the 835 name: the
 * patient's own coverage record first (`patientCard`), the claim's own captured
 * payer second.
 *
 * Before 2026-11-21 the Biller's screen kept a local default of "Medicare", so a
 * payer saved at Registration reached the banner, eligibility and the printed
 * paper but never the acknowledgement or the remittance — the student changed
 * the card and the money still came from a different plan. One reader, so the
 * four screens cannot disagree.
 */
export function claimPayer(
  patient: CardHolder | null | undefined,
  claimPayerName?: string | null,
): string {
  return patientCard(patient).payerName || (claimPayerName ?? "").trim();
}

/** What a screen prints for a card field: the value, or "Not on file". */
export function onFileOr(value: string | undefined | null): string {
  return (value ?? "").trim() || NOT_ON_FILE;
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

// ─── The one deliberate mismatch per case ─────────────────────────

export type CardMismatchKind = "name" | "member-id";

/**
 * The single error this case carries, and the two values it sits between.
 *
 * It is generated from the patient's own record, never a constant: the field, the
 * wrong value and its consequence all differ between patients. Exactly one per
 * case. A caller prints it only after the student has committed an answer
 * (standing rule 6).
 */
export interface CardMismatch {
  kind: CardMismatchKind;
  /** The field's label on both documents. */
  field: string;
  /** What the government ID and the chart hold — the spelling that wins. */
  onLicence: string;
  /** What the insurance card prints — differs from the ID by one error. */
  onCard: string;
  /** The answer the student should reach by comparing the two documents. */
  documentsAgree: false;
  /** Printed after Verify: what this mismatch costs at the payer. */
  consequence: string;
}

/**
 * Transpose two adjacent letters — the classic hand-transcription error.
 *
 * The pair is chosen from a hash of the patient's own name, so the misspelling is
 * stable for a patient and different between patients. `null` when the word is
 * too short to misspell recognisably.
 */
function misspell(word: string, salt: string): string | null {
  const value = word.trim();
  if (value.length < 3) return null;
  // Candidate pairs: inside the word, so the first and last letters stay put and
  // the misspelling still reads as the same name.
  const candidates: number[] = [];
  for (let i = 1; i <= value.length - 2; i += 1) {
    if (value[i] !== value[i + 1]) candidates.push(i);
  }
  if (candidates.length === 0) return null;
  const at = candidates[hash32(`${salt}|${value}`) % candidates.length];
  return value.slice(0, at) + value[at + 1] + value[at] + value.slice(at + 2);
}

/**
 * The one mismatch this patient's two documents carry, or `null` when there is
 * nothing to compare (no name, or no card on file to print a member name).
 *
 * The insurance card prints the name with one transposed pair of letters; the
 * government ID — and therefore the chart — keeps the correct spelling. A card
 * is authoritative for coverage data, a government ID for identity, which is why
 * the ID spelling wins and the card's is the error.
 */
export function caseMismatch(patient: CardHolder | null | undefined): CardMismatch | null {
  const card = patientCard(patient);
  if (!patient || !card.onFile || !card.fullName) return null;

  // The Tutorial Patient is the standard reference chart, so its two documents
  // must agree: the worked example is what a student reads to learn which datum
  // belongs where, and a card printing "Tutorial Pateint" beside a licence
  // printing "Tutorial Patient" is a typo there, not a lesson
  // (`domain/tutorialIdentity.ts`). The trap stays on every chart the student
  // works — their own bookings and the Practice Cases.
  if (patient.id === TUTORIAL_PATIENT_ID) return null;

  // No card existed when the student registered this patient: they typed the
  // coverage themselves, so there was no printed card whose spelling they could
  // have caught. Inventing a misspelt card afterwards marked a correct student
  // wrong (and promised a denial the claim never got).
  if (patient.insuranceRecord?.cardIssued === false) return null;

  const firstName = (patient.firstName ?? "").trim();
  const lastName = (patient.lastName ?? "").trim();
  const salt = `${(patient.id ?? "").trim()}|${(patient.mrn ?? "").trim()}`;

  // The surname carries the trap; the given name is the fallback for a chart
  // whose surname is too short to misspell recognisably.
  const surnameError = lastName ? misspell(lastName, salt) : null;
  if (surnameError) {
    return {
      kind: "name",
      field: "Member name",
      onLicence: card.fullName,
      onCard: [firstName, surnameError].filter(Boolean).join(" "),
      documentsAgree: false,
      consequence:
        `The insurance card spells the surname “${surnameError}”; the government ID — and so the chart — spells it “${lastName}”. ` +
        "The 270 carries the card's spelling and the 271 answers with a name mismatch — the subscriber name it holds is not the name on the chart — " +
        "and the claim denies until the payer's record carries the chart's spelling. The chart keeps the government ID spelling.",
    };
  }

  const givenNameError = firstName ? misspell(firstName, salt) : null;
  if (givenNameError) {
    return {
      kind: "name",
      field: "Member name",
      onLicence: card.fullName,
      onCard: [givenNameError, lastName].filter(Boolean).join(" "),
      documentsAgree: false,
      consequence:
        `The insurance card spells the given name “${givenNameError}”; the government ID — and so the chart — spells it “${firstName}”. ` +
        "The 270 carries the card's spelling and the 271 answers with a name mismatch — the subscriber name it holds is not the name on the chart — " +
        "and the claim denies until the payer's record carries the chart's spelling. The chart keeps the government ID spelling.",
    };
  }

  // No name on the chart to misspell: there is no honest mismatch to invent.
  return null;
}

/**
 * What Registration's transcription is scored against — this patient's own
 * values, never a hardcoded set.
 *
 * `cardMemberName` is what the insurance card prints, so scoring can tell a
 * faithful transcription of the chart from a blind copy of the card's spelling.
 */
export interface RegistrationExpectations {
  firstName: string;
  lastName: string;
  /** MM/DD/YYYY. */
  dateOfBirth: string;
  memberId: string;
  groupNumber: string;
  payerId: string;
  cardMemberName: string;
}

export function registrationExpectations(
  patient: CardHolder | null | undefined,
): RegistrationExpectations {
  const card = patientCard(patient);
  const mismatch = caseMismatch(patient);
  return {
    firstName: (patient?.firstName ?? "").trim(),
    lastName: (patient?.lastName ?? "").trim(),
    dateOfBirth: card.dateOfBirth,
    memberId: card.memberId,
    groupNumber: card.groupNumber,
    payerId: card.payerId,
    cardMemberName: mismatch?.onCard ?? card.fullName,
  };
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
    // A payer that issues no group number (original Medicare) prints `N/A`, the
    // same word box 11 uses — otherwise a Medicare chart could only be verified
    // by inventing one (`specs/blank-field-sweep.md` §A).
    groupNumber: box11Value(card.groupNumber, card.payerName),
    payerId: card.payerId,
    relationship: card.relationship || "Self",
    secondaryPayerName: (secondary?.payerName ?? "").trim(),
    secondaryPayerId: (secondary?.ediPayerId ?? "").trim(),
    secondarySubscriberId: (secondary?.subscriberId ?? "").trim(),
    secondaryGroupNumber: (secondary?.groupNumber ?? "").trim(),
  };
}

/**
 * The identity half of Registration's transcription form: the name and date of
 * birth the chart already holds.
 *
 * Read from the patient, never from the insurance card — the government ID's
 * spelling is the one that wins, and the card's own member name is this case's
 * deliberate misspelling. The date is MM/DD/YYYY, the form's format. A chart with
 * no name prints blanks rather than borrowing the previous patient's.
 */
export function registrationIdentityFor(patient: CardHolder | null | undefined): {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
} {
  const card = patientCard(patient);
  return {
    firstName: (patient?.firstName ?? "").trim(),
    lastName: (patient?.lastName ?? "").trim(),
    dateOfBirth: card.dateOfBirth,
  };
}
