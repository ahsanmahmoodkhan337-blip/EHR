/**
 * UB-04 institutional code sets — teaching data.
 *
 * Source: specs/claim-forms-auto-generated.md §3 and §3a. These are the small
 * coded lists that sit in the middle of the CMS-1450 and that a student has to
 * recognise rather than invent: admission type, admission source, patient
 * status, condition codes, occurrence and occurrence-span codes, and value
 * codes. Each set is deliberately small — the codes the simulator's teaching
 * cases actually use, plus the near neighbours a coder must not confuse them
 * with. The picker shows the plain-language line; nothing here is free text.
 *
 * LICENSING: the NUBC's descriptors for these code sets are licensed material.
 * Every description below is our own plain-language paraphrase written for
 * teaching (owner decision 2026-09-29). The code numbers themselves are used
 * as-is. This is a teaching subset, not the full code set: where a code could
 * not be stated confidently it has been left out rather than guessed, because
 * a wrong code meaning teaches a harmful habit.
 */

export interface InstitutionalCode {
  /** The code as printed in the form locator. */
  code: string;
  /** Plain-language meaning for students. Never NUBC wording. */
  teachingDescription: string;
  /** Form locators this code is written into. */
  locators: string;
  /** Where the simulator suggests this code on its own, if anywhere. */
  defaultFor?: string;
  /** Extra teaching line — usually the mistake this code gets confused with. */
  note?: string;
  /** A reserved value that exists in the numbering but means nothing today. */
  reserved?: boolean;
}

// ─── Box 14 — Admission Type ─────────────────────────────────────────────

export const ADMISSION_TYPE_CODES: InstitutionalCode[] = [
  {
    code: "1",
    teachingDescription:
      "Emergency — the patient was admitted because the condition could not wait.",
    locators: "14",
    defaultFor: "An emergency department encounter that becomes an admission.",
  },
  {
    code: "2",
    teachingDescription:
      "Urgent — the patient needed to be admitted quickly, but it was not an emergency.",
    locators: "14",
  },
  {
    code: "3",
    teachingDescription:
      "Elective — the admission was planned in advance with the patient.",
    locators: "14",
    defaultFor: "A scheduled surgical or procedure admission.",
  },
  {
    code: "4",
    teachingDescription:
      "Newborn — the patient was born in this facility during this stay.",
    locators: "14",
    note: "A newborn admission is billed under the baby's own record, never the mother's.",
  },
  {
    code: "5",
    teachingDescription:
      "Trauma centre — the patient arrived through a designated trauma service.",
    locators: "14",
  },
  {
    code: "6",
    teachingDescription: "Not used in this numbering.",
    locators: "14",
    reserved: true,
  },
  {
    code: "7",
    teachingDescription: "Not used in this numbering.",
    locators: "14",
    reserved: true,
  },
  {
    code: "8",
    teachingDescription: "Not used in this numbering.",
    locators: "14",
    reserved: true,
  },
  {
    code: "9",
    teachingDescription:
      "Information not available — nobody could establish how the patient came to be admitted.",
    locators: "14",
  },
];

// ─── Box 15 — Admission Source ───────────────────────────────────────────

export const ADMISSION_SOURCE_CODES: InstitutionalCode[] = [
  {
    code: "1",
    teachingDescription:
      "Referred by a physician — the patient came on a doctor's direction.",
    locators: "15",
  },
  {
    code: "2",
    teachingDescription: "Referred through a clinic.",
    locators: "15",
  },
  {
    code: "3",
    teachingDescription:
      "Referred through a health maintenance organisation (HMO).",
    locators: "15",
  },
  {
    code: "4",
    teachingDescription:
      "Transferred from another hospital — the patient was already an inpatient somewhere else.",
    locators: "15",
    note: "A transfer is not the same as a referral: the other hospital had already admitted the patient.",
  },
  {
    code: "5",
    teachingDescription: "Transferred from a skilled nursing facility.",
    locators: "15",
  },
  {
    code: "6",
    teachingDescription:
      "Transferred from another health care facility — a type not named above.",
    locators: "15",
  },
  {
    code: "7",
    teachingDescription:
      "Came through the emergency room — the ER was the door into the admission.",
    locators: "15",
    defaultFor: "An emergency department encounter that becomes an admission.",
  },
  {
    code: "8",
    teachingDescription:
      "Brought in by court order or law enforcement.",
    locators: "15",
  },
  {
    code: "9",
    teachingDescription:
      "Information not available — the source of the admission is not known.",
    locators: "15",
  },
];

// ─── Box 17 — Patient Status ─────────────────────────────────────────────

export const PATIENT_STATUS_CODES: InstitutionalCode[] = [
  {
    code: "01",
    teachingDescription: "Went home or to self-care, with no further care needed.",
    locators: "17",
    defaultFor: "A routine discharge.",
  },
  {
    code: "02",
    teachingDescription:
      "Sent to another short-term general hospital for inpatient care.",
    locators: "17",
  },
  {
    code: "03",
    teachingDescription:
      "Sent to a skilled nursing facility or to a hospital's swing bed for continued care.",
    locators: "17",
  },
  {
    code: "04",
    teachingDescription: "Sent to an intermediate care facility.",
    locators: "17",
  },
  {
    code: "05",
    teachingDescription:
      "Sent to another kind of institution that is not a hospital or a nursing home.",
    locators: "17",
  },
  {
    code: "06",
    teachingDescription:
      "Went home under the care of a home health agency.",
    locators: "17",
  },
  {
    code: "07",
    teachingDescription:
      "Left against medical advice — the patient chose to go before the team discharged them.",
    locators: "17",
    note: "Leaving against advice still closes the stay, but the plan of care and the follow-up risk have to be documented.",
  },
  {
    code: "20",
    teachingDescription: "Died in this facility.",
    locators: "17",
  },
  {
    code: "30",
    teachingDescription:
      "Still a patient — the stay has not ended, so this bill is an interim one.",
    locators: "17",
    note: "Only used with an interim frequency (2 or 3), never on a final bill.",
  },
  {
    code: "40",
    teachingDescription: "Died at home while under hospice care.",
    locators: "17",
  },
  {
    code: "41",
    teachingDescription: "Died in a medical facility while under hospice care.",
    locators: "17",
  },
  {
    code: "42",
    teachingDescription:
      "Died under hospice care, and the place of death is not known.",
    locators: "17",
  },
  {
    code: "43",
    teachingDescription:
      "Sent to a federal health care facility — a military or veterans hospital, for example.",
    locators: "17",
  },
  {
    code: "50",
    teachingDescription: "Sent home under hospice care.",
    locators: "17",
  },
  {
    code: "51",
    teachingDescription: "Sent to a medical facility for hospice care.",
    locators: "17",
  },
  {
    code: "61",
    teachingDescription:
      "Sent to a swing bed in a hospital that has been approved for swing-bed care.",
    locators: "17",
  },
  {
    code: "62",
    teachingDescription: "Sent to an inpatient rehabilitation facility.",
    locators: "17",
  },
  {
    code: "63",
    teachingDescription: "Sent to a long-term care hospital.",
    locators: "17",
  },
  {
    code: "64",
    teachingDescription:
      "Sent to a nursing facility that is certified under Medicaid but not under Medicare.",
    locators: "17",
  },
  {
    code: "65",
    teachingDescription:
      "Sent to a psychiatric hospital or to the psychiatric unit of a hospital.",
    locators: "17",
  },
  {
    code: "66",
    teachingDescription: "Sent to a critical access hospital.",
    locators: "17",
  },
  {
    code: "70",
    teachingDescription:
      "Sent to another kind of health care institution that no other status describes.",
    locators: "17",
  },
];

// ─── Boxes 18–28 — Condition Codes ───────────────────────────────────────

export const CONDITION_CODES: InstitutionalCode[] = [
  {
    code: "01",
    teachingDescription: "The condition being treated is related to military service.",
    locators: "18–28",
  },
  {
    code: "02",
    teachingDescription: "The condition being treated is related to the patient's employment.",
    locators: "18–28",
    note: "An employment-related injury usually means a workers' compensation payer, not the health plan.",
  },
  {
    code: "06",
    teachingDescription:
      "The patient has end-stage renal disease and is still inside the first 18 months of Medicare entitlement.",
    locators: "18–28",
    note: "Inside that window Medicare pays second to the employer group health plan.",
  },
  {
    code: "07",
    teachingDescription:
      "Hospice patient being treated for a condition that is not the terminal diagnosis.",
    locators: "18–28",
  },
  {
    code: "08",
    teachingDescription:
      "The patient would not give information about other insurance coverage.",
    locators: "18–28",
  },
  {
    code: "09",
    teachingDescription:
      "Neither the patient nor the spouse is working, so no employer plan applies.",
    locators: "18–28",
  },
  {
    code: "10",
    teachingDescription:
      "The patient or spouse is working, but the employer offers no health plan.",
    locators: "18–28",
  },
  {
    code: "11",
    teachingDescription:
      "The patient is disabled but is not covered by a large employer group health plan.",
    locators: "18–28",
  },
  {
    code: "21",
    teachingDescription:
      "Billing for a service the payer has already denied, so the denial is on the record.",
    locators: "18–28",
    note: "Used when the denial notice is what the patient needs to see, not a fresh claim for payment.",
  },
  {
    code: "26",
    teachingDescription:
      "The patient was eligible for care in a veterans facility but chose to be treated here.",
    locators: "18–28",
  },
  {
    code: "27",
    teachingDescription:
      "The patient was referred to a sole community hospital for a laboratory test.",
    locators: "18–28",
  },
  {
    code: "28",
    teachingDescription:
      "The patient moved from one distinct part of this facility to another distinct part of the same facility.",
    locators: "18–28",
    note: "A move inside the same building between two separately certified units is a new billing period, not a new facility.",
  },
];

// ─── Boxes 31–34 — Occurrence Codes and Dates ────────────────────────────

export const OCCURRENCE_CODES: InstitutionalCode[] = [
  {
    code: "01",
    teachingDescription:
      "Date the patient retired — the event that ends employer coverage for a working-aged beneficiary.",
    locators: "31–34",
  },
  {
    code: "24",
    teachingDescription:
      "Date another payer denied the claim — the starting point for a timely-filing argument.",
    locators: "31–34",
    note: "Keep the denial notice: the date on this code is only as good as the document behind it.",
  },
  {
    code: "A3",
    teachingDescription:
      "Date the patient's benefits ran out — the day coverage for this stay stopped.",
    locators: "31–34",
    note: "From that date the days become the patient's responsibility or another payer's, so the date must match the benefit record exactly.",
  },
];

// ─── Boxes 35–36 — Occurrence Span Codes ─────────────────────────────────

export const OCCURRENCE_SPAN_CODES: InstitutionalCode[] = [
  {
    code: "70",
    teachingDescription:
      "The dates of a hospital stay that came immediately before this one.",
    locators: "35–36",
  },
  {
    code: "74",
    teachingDescription:
      "The dates of a period when the patient was in a level of care the payer does not cover.",
    locators: "35–36",
    note: "Non-covered days still get counted, but they are not billed as covered days.",
  },
];

// ─── Boxes 39–41 — Value Codes ───────────────────────────────────────────

export const VALUE_CODES: InstitutionalCode[] = [
  {
    code: "01",
    teachingDescription:
      "The hospital's most common semi-private room charge, used as the rate the payer compares the bill against.",
    locators: "39–41",
  },
  {
    code: "80",
    teachingDescription: "Number of days in the stay that the payer covers.",
    locators: "39–41",
  },
  {
    code: "81",
    teachingDescription: "Number of days in the stay that the payer does not cover.",
    locators: "39–41",
  },
  {
    code: "82",
    teachingDescription:
      "Number of days the patient owes a daily coinsurance amount on.",
    locators: "39–41",
  },
  {
    code: "A1",
    teachingDescription:
      "Amount of the deductible owed under payer A — the primary payer.",
    locators: "39–41",
  },
];

// ─── Grouped sets, for the pickers ───────────────────────────────────────

export type InstitutionalCodeSetKey =
  | "admissionType"
  | "admissionSource"
  | "patientStatus"
  | "condition"
  | "occurrence"
  | "occurrenceSpan"
  | "value";

export interface InstitutionalCodeSet {
  key: InstitutionalCodeSetKey;
  /** The form locator caption as printed on the CMS-1450. */
  locatorCaption: string;
  /** One line telling the student what the box is for. */
  teachingNote: string;
  codes: InstitutionalCode[];
}

export const INSTITUTIONAL_CODE_SETS: InstitutionalCodeSet[] = [
  {
    key: "admissionType",
    locatorCaption: "14. Type of Admission",
    teachingNote:
      "How the patient came to be admitted. It is a fact about the admission, not a judgement about how sick the patient was.",
    codes: ADMISSION_TYPE_CODES,
  },
  {
    key: "admissionSource",
    locatorCaption: "15. SRC (Source of Admission)",
    teachingNote:
      "Where the patient came from immediately before this admission. A transfer means another facility had already admitted them.",
    codes: ADMISSION_SOURCE_CODES,
  },
  {
    key: "patientStatus",
    locatorCaption: "17. Patient Status",
    teachingNote:
      "Where the patient went at the end of the stay, as of the last date in box 6. It is the box a follow-up home-health or nursing bill is built from, so it has to be true.",
    codes: PATIENT_STATUS_CODES,
  },
  {
    key: "condition",
    locatorCaption: "18–28. Condition Codes",
    teachingNote:
      "Special circumstances that change who pays or how the bill is read. Leave the box blank when none applies — a made-up condition code is a false statement about the patient.",
    codes: CONDITION_CODES,
  },
  {
    key: "occurrence",
    locatorCaption: "31–34. Occurrence Codes and Dates",
    teachingNote:
      "A dated event that affects this bill — a retirement, a denial, benefits running out. Each code carries its own date; a code without its date is ignored by the payer.",
    codes: OCCURRENCE_CODES,
  },
  {
    key: "occurrenceSpan",
    locatorCaption: "35–36. Occurrence Span Codes",
    teachingNote:
      "A range of dates, not a single date — used when a period inside or before the stay has to be described.",
    codes: OCCURRENCE_SPAN_CODES,
  },
  {
    key: "value",
    locatorCaption: "39–41. Value Codes and Amounts",
    teachingNote:
      "A number the payer needs to price the claim — a room rate, a day count, a deductible. Every value code carries an amount in the box beside it.",
    codes: VALUE_CODES,
  },
];

/** Lookup for one code set by key. */
export function institutionalCodeSet(
  key: InstitutionalCodeSetKey,
): InstitutionalCodeSet {
  const set = INSTITUTIONAL_CODE_SETS.find((s) => s.key === key);
  if (!set) throw new Error(`Unknown institutional code set: ${key}`);
  return set;
}
