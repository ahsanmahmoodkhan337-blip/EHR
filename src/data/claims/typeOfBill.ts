/**
 * UB-04 type of bill (form locator 4) — teaching data.
 *
 * Source: specs/claim-forms-auto-generated.md §3. The type of bill is three
 * digits and each digit answers a different question:
 *
 *   digit 1 — what kind of facility is billing
 *   digit 2 — what kind of care was given
 *   digit 3 — which bill in the sequence this one is (the "frequency")
 *
 * 131 therefore reads: hospital (1) + outpatient (3) + admit-through-discharge,
 * the single-date frequency (1). The simulator never hard-codes the code — it
 * derives it from the encounter and shows the meaning of each digit as the
 * picker changes, so a student can explain the number rather than copy it.
 *
 * LICENSING: the NUBC's type-of-bill descriptors are licensed material. Every
 * meaning here is our own plain-language paraphrase (owner decision
 * 2026-09-29). The digit values themselves are used as-is.
 */

export interface TypeOfBillDigit {
  /** The single digit, 0–9. */
  digit: string;
  /** Short label for the picker. */
  label: string;
  /** One line a student can repeat back. */
  meaning: string;
  /** Reserved digits exist in the numbering but mean nothing today. */
  reserved?: boolean;
}

/** Digit 1 — the facility (or provider type) that is billing. */
export const FACILITY_TYPE_DIGITS: TypeOfBillDigit[] = [
  {
    digit: "1",
    label: "Hospital",
    meaning:
      "A hospital is billing — inpatient, outpatient, emergency or same-day surgery under the hospital's own provider number.",
  },
  {
    digit: "2",
    label: "Skilled nursing facility",
    meaning: "A skilled nursing facility is billing a Medicare Part A stay.",
  },
  {
    digit: "3",
    label: "Home health agency",
    meaning: "A home health agency is billing care delivered in the patient's home.",
  },
  {
    digit: "4",
    label: "Religious non-medical facility",
    meaning:
      "A facility whose care is religious rather than medical is billing for the stay.",
  },
  {
    digit: "5",
    label: "Reserved",
    meaning: "Not used. A bill carrying 5 as its first digit will reject.",
    reserved: true,
  },
  {
    digit: "6",
    label: "Intermediate care facility",
    meaning:
      "An intermediate care facility is billing — a lower level of care than skilled nursing.",
  },
  {
    digit: "7",
    label: "Clinic / hospital outpatient department",
    meaning:
      "A clinic or a hospital's outpatient department is billing for a visit or service, not for a stay.",
  },
  {
    digit: "8",
    label: "Special facility",
    meaning:
      "A special facility is billing — a same-day surgery centre (ASC) is the usual example.",
  },
  {
    digit: "9",
    label: "Reserved",
    meaning: "Not used. A bill carrying 9 as its first digit will reject.",
    reserved: true,
  },
];

/** Digit 2 — the kind of care the bill covers. */
export const CARE_TYPE_DIGITS: TypeOfBillDigit[] = [
  {
    digit: "1",
    label: "Inpatient, Part A",
    meaning:
      "Inpatient care paid under Part A — a stay in the hospital, room and board included.",
  },
  {
    digit: "2",
    label: "Inpatient, Part B",
    meaning:
      "Inpatient care paid under Part B, or a home-health plan of treatment — services that are not covered as a Part A stay.",
  },
  {
    digit: "3",
    label: "Outpatient",
    meaning:
      "Outpatient care — the patient came in and went home, or was treated in the emergency department.",
  },
  {
    digit: "4",
    label: "Other",
    meaning:
      "A category of care that fits none of the named ones; the payer reads the rest of the bill to know what was done.",
  },
  {
    digit: "5",
    label: "Skilled nursing — level 1",
    meaning: "The lowest of the skilled-nursing levels of care.",
  },
  {
    digit: "6",
    label: "Skilled nursing — level 2",
    meaning: "The second skilled-nursing level of care.",
  },
  {
    digit: "7",
    label: "Skilled nursing — level 3",
    meaning: "The third skilled-nursing level of care.",
  },
  {
    digit: "8",
    label: "Skilled nursing — level 4",
    meaning: "The highest of the skilled-nursing levels of care.",
  },
  {
    digit: "9",
    label: "Other",
    meaning:
      "Any other care type not listed above, including swing beds and intermediate care.",
  },
];

/** Digit 3 — the frequency: which bill in the sequence this is. */
export const FREQUENCY_DIGITS: TypeOfBillDigit[] = [
  {
    digit: "0",
    label: "Non-payment / zero-pay",
    meaning:
      "Sent for information only — the provider expects no money on this bill (for example a bill showing the deductible).",
  },
  {
    digit: "1",
    label: "Admit through discharge",
    meaning:
      "The complete stay, admission to discharge, billed once. Normal on a single-date outpatient bill too.",
  },
  {
    digit: "2",
    label: "Interim — first",
    meaning:
      "The first of several bills for a long stay. Only exists when the stay runs across billing periods.",
  },
  {
    digit: "3",
    label: "Interim — continuing",
    meaning:
      "A middle bill in a long stay. Only exists when the stay runs across billing periods.",
  },
  {
    digit: "4",
    label: "Interim — last",
    meaning:
      "The final bill for a long stay, carrying the discharge information. Only exists for a multi-day stay.",
  },
  {
    digit: "5",
    label: "Late charge only",
    meaning:
      "A charge that was missed on an earlier bill and is being added now, on its own.",
  },
  {
    digit: "6",
    label: "Reserved",
    meaning:
      "Not used. A bill carrying 6 as its frequency will reject.",
    reserved: true,
  },
  {
    digit: "7",
    label: "Replacement of a prior claim",
    meaning:
      "A corrected copy of a bill already sent. The payer replaces the earlier bill — and needs its number (box 3b) to know which one.",
  },
  {
    digit: "8",
    label: "Void of a prior claim",
    meaning:
      "Cancels a bill already sent, with no replacement. The payer needs the original claim number (box 3b) to know which one to cancel.",
  },
  {
    digit: "9",
    label: "Reserved",
    meaning:
      "Not used. A bill carrying 9 as its frequency will reject.",
    reserved: true,
  },
];

export interface PosTypeOfBillDefault {
  /** Place of service code the encounter carries. */
  pos: string;
  /** Setting in plain words. */
  setting: string;
  /**
   * The type of bill the simulator suggests, or null when the encounter is a
   * professional one and gets no UB-04 at all.
   */
  typeOfBill: string | null;
  /** The paper the claim should default to. */
  claimType: "institutional" | "professional";
  /** Why the suggestion is what it is — printed next to the picker. */
  reason: string;
  /** An alternative the biller may choose, with its own reason. */
  alternative?: { typeOfBill: string; reason: string };
}

/**
 * Place of service → type-of-bill defaults. These are teaching defaults, not
 * payer rules: the biller can override every one of them.
 */
export const POS_TYPE_OF_BILL_DEFAULTS: PosTypeOfBillDefault[] = [
  {
    pos: "23",
    setting: "Emergency room, hospital",
    typeOfBill: "131",
    claimType: "institutional",
    reason:
      "An emergency visit is a facility charge billed by the hospital: 1 hospital, 3 outpatient, 1 admit-through-discharge for a single-date visit.",
  },
  {
    pos: "22",
    setting: "Hospital outpatient department",
    typeOfBill: "131",
    claimType: "institutional",
    reason:
      "Outpatient hospital care is still a hospital facility charge: 1 hospital, 3 outpatient, 1 for a single date of service.",
  },
  {
    pos: "21",
    setting: "Hospital inpatient",
    typeOfBill: "111",
    claimType: "institutional",
    reason:
      "An inpatient stay is billed by the hospital under Part A: 1 hospital, 1 inpatient Part A, 1 admit through discharge.",
    alternative: {
      typeOfBill: "112",
      reason:
        "Use 112 when the stay is paid under Part B instead of a Part A inpatient stay.",
    },
  },
  {
    pos: "24",
    setting: "Ambulatory surgical centre",
    typeOfBill: "831",
    claimType: "institutional",
    reason:
      "A same-day surgery centre bills as a special facility: 8 special facility, 3 outpatient, 1 for a single date.",
  },
  {
    pos: "11",
    setting: "Physician office",
    typeOfBill: null,
    claimType: "professional",
    reason:
      "An office visit is the physician's professional charge, so it goes on a CMS-1500 and never gets a UB-04.",
  },
];

/** Lookup by place of service. Returns undefined for a POS we do not teach. */
export function typeOfBillDefaultForPos(
  pos: string,
): PosTypeOfBillDefault | undefined {
  return POS_TYPE_OF_BILL_DEFAULTS.find((d) => d.pos === pos);
}

/**
 * The frequency that goes with a resubmission code (CMS-1500 box 22):
 * 7 = replacement, 8 = void. Anything else is a first, normal bill (1).
 */
export function frequencyFromResubmissionCode(
  resubmissionCode: string | undefined | null,
): "7" | "8" | "1" {
  const code = (resubmissionCode ?? "").trim();
  if (code === "7") return "7";
  if (code === "8") return "8";
  return "1";
}

/** True when the frequency says the payer must be told which claim this replaces. */
export function frequencyNeedsOriginalClaimNumber(frequency: string): boolean {
  return frequency === "7" || frequency === "8";
}

/** Join the three digits into the printed type of bill. */
export function buildTypeOfBill(
  facility: string,
  careType: string,
  frequency: string,
): string {
  return `${facility}${careType}${frequency}`;
}

/**
 * The meaning of each digit of a 3-digit type of bill, in reading order, for
 * the line printed under form locator 4. Returns null for a code that is not
 * three digits.
 */
export function describeTypeOfBill(
  code: string,
): { digit: string; label: string; meaning: string }[] | null {
  const digits = code.trim();
  if (!/^[0-9]{3}$/.test(digits)) return null;
  const sets = [FACILITY_TYPE_DIGITS, CARE_TYPE_DIGITS, FREQUENCY_DIGITS];
  const described = digits.split("").map((digit, index) => {
    const found = sets[index].find((d) => d.digit === digit);
    return {
      digit,
      label: found?.label ?? "Unknown",
      meaning: found?.meaning ?? "This digit is not one this simulator teaches.",
    };
  });
  return described;
}

/**
 * Teaching note printed under form locator 4 on every UB-04 the simulator
 * draws. It is the answer to "why is this box blank / why is it 131".
 */
export const TYPE_OF_BILL_TEACHING_NOTE =
  "Frequency 1 is normal on a single-date outpatient bill: the visit starts and ends the same day. Interim frequencies 2, 3 and 4 only exist for a multi-day stay that is billed in pieces. On a 13x outpatient bill, boxes 12–17 (admission and discharge) and 18–41 (condition, occurrence and value codes) are generally not required — a blank there is correct rather than missing.";

/** Printed beside a replacement or void bill (frequency 7 or 8). */
export const REPLACEMENT_TEACHING_NOTE =
  "Frequency 7 replaces an earlier bill and frequency 8 voids one. Both require the original claim number in box 3b — without it the payer cannot tell which claim is being corrected or cancelled, and the bill is returned unpaid.";
