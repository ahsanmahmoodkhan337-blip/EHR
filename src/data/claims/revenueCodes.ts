/**
 * UB-04 revenue codes — teaching table.
 *
 * Source: specs/claim-forms-auto-generated.md §3. On a UB-04 (CMS-1450) every
 * service line carries a 4-digit revenue code in form locator 42 that says
 * *what kind of charge* the line is, independently of the CPT/HCPCS code in
 * locator 44. The coder picks the CPT; the revenue code says which hospital
 * department earned the money — lab, imaging, OR time, the ER itself.
 *
 * LICENSING: the NUBC's revenue-code descriptors are licensed material. Every
 * description here is our own plain-language paraphrase written for teaching
 * (owner decision 2026-09-29). The 4-digit code numbers are not copyrightable
 * and are used as-is.
 *
 * This is a teaching subset, not the full code set — 18 codes that cover the
 * services the simulator actually bills. `cptFamilyDefaults` is the bridge the
 * claim builder uses to guess a line's revenue code from its CPT code: each
 * entry is either an exact 5-character code, or a family token ending in `*`
 * that matches by prefix (for example `J*` = the J-code drug family).
 *
 * Codes 0100, 0110 and 0120 are room and board. They belong on an inpatient
 * stay only — never on a 13x outpatient or emergency bill, which carries
 * ancillary codes only.
 */

export type RevenueAppliesTo = "inpatient" | "outpatient" | "both";

export interface RevenueCode {
  /** 4-digit revenue code, as printed in form locator 42. */
  code: string;
  /** Plain-language description for students. Never NUBC wording. */
  teachingDescription: string;
  /**
   * CPT/HCPCS matches that suggest this revenue code on a line.
   * An exact 5-character code, or a family token ending in `*` (prefix match).
   */
  cptFamilyDefaults: string[];
  /** Which kind of bill this code may appear on. */
  appliesTo: RevenueAppliesTo;
  /** Optional extra teaching line, for codes whose default is contextual. */
  note?: string;
}

export const REVENUE_CODES: RevenueCode[] = [
  {
    code: "0100",
    teachingDescription:
      "General inpatient room charge — room and board billed without naming the room type. The catch-all when the hospital has not broken the room out.",
    cptFamilyDefaults: [],
    appliesTo: "inpatient",
    note: "Room line only. Only appears on an inpatient stay (place of service 21).",
  },
  {
    code: "0110",
    teachingDescription:
      "Inpatient room charged at the private-room rate — one patient to the room.",
    cptFamilyDefaults: [],
    appliesTo: "inpatient",
    note: "Room line only. Some payers will only pay the shared-room rate unless private-room medical necessity is documented.",
  },
  {
    code: "0120",
    teachingDescription:
      "Inpatient room charged at the shared two-bed (semi-private) rate — the usual default for a standard admission.",
    cptFamilyDefaults: [],
    appliesTo: "inpatient",
    note: "Room line only. This is the shared two-bed rate, not the private rate — an earlier draft of the spec had it wrong.",
  },
  {
    code: "0250",
    teachingDescription:
      "Drugs and biologicals supplied by the hospital pharmacy as part of the stay.",
    cptFamilyDefaults: ["J*"],
    appliesTo: "both",
    note: "Pharmacy drugs. J-code drug lines land here when the hospital does not bill them individually on 0636.",
  },
  {
    code: "0270",
    teachingDescription:
      "General medical and surgical supplies — dressings, catheters, tubing and other stock items used on the patient.",
    cptFamilyDefaults: [],
    appliesTo: "both",
    note: "Supply line. No CPT equivalent, so nothing auto-fills this one.",
  },
  {
    code: "0300",
    teachingDescription: "Laboratory tests run in the hospital's own laboratory.",
    cptFamilyDefaults: ["80048", "80053", "80061", "81001", "81002", "85025"],
    appliesTo: "both",
  },
  {
    code: "0320",
    teachingDescription:
      "Diagnostic imaging using plain X-ray and general radiographic studies.",
    cptFamilyDefaults: ["71045", "71046", "77067"],
    appliesTo: "both",
  },
  {
    code: "0350",
    teachingDescription: "CT (computed tomography) scans.",
    cptFamilyDefaults: ["71250", "72125", "74177"],
    appliesTo: "both",
  },
  {
    code: "0360",
    teachingDescription:
      "Operating suite time — the room and staff cost of the surgical procedure itself.",
    cptFamilyDefaults: ["27130", "27447", "47562", "47563", "44140"],
    appliesTo: "both",
    note: "OR time only. The surgeon's own fee is a professional charge and does not go on this bill.",
  },
  {
    code: "0370",
    teachingDescription: "Anaesthesia delivered during a procedure.",
    cptFamilyDefaults: [],
    appliesTo: "both",
    note: "Anaesthesia lines are recognised by their own 5-digit code range (00100–01999), not by a family token.",
  },
  {
    code: "0450",
    teachingDescription:
      "Emergency department facility charge — the ER's own charge, separate from the physician's professional fee.",
    cptFamilyDefaults: ["99281", "99282", "99283", "99284", "99285"],
    appliesTo: "outpatient",
    note: "Every line on an emergency encounter (place of service 23) starts here until a more specific department code fits.",
  },
  {
    code: "0480",
    teachingDescription:
      "GI endoscopy — upper and lower scopes performed in the endoscopy suite.",
    cptFamilyDefaults: ["43239", "45380"],
    appliesTo: "both",
  },
  {
    code: "0610",
    teachingDescription: "MRI studies.",
    cptFamilyDefaults: ["70551", "72141"],
    appliesTo: "both",
  },
  {
    code: "0636",
    teachingDescription:
      "Drugs the hospital bills one by one under their own HCPCS J-code, so the payer can see exactly what was given.",
    cptFamilyDefaults: ["J*"],
    appliesTo: "both",
    note: "When a drug is billed individually here, the J-code is required in locator 44 and the units in locator 46.",
  },
  {
    code: "0710",
    teachingDescription:
      "Post-anaesthesia recovery (PACU) time after a surgical procedure.",
    cptFamilyDefaults: [],
    appliesTo: "both",
    note: "Defaulted from the surgical lines on a place-of-service 21 or 24 claim, not from a CPT family.",
  },
  {
    code: "0730",
    teachingDescription: "Electrocardiogram (ECG/EKG) tracings.",
    cptFamilyDefaults: ["93000", "93005", "93015"],
    appliesTo: "both",
  },
  {
    code: "0762",
    teachingDescription:
      "Observation status — monitoring and assessment while the team decides whether an admission is needed.",
    cptFamilyDefaults: [],
    appliesTo: "outpatient",
    note: "The teaching case for an ER visit that becomes observation instead of an inpatient admission.",
  },
  {
    code: "0920",
    teachingDescription:
      "Other diagnostic services that no other revenue code covers.",
    cptFamilyDefaults: ["93306", "94640"],
    appliesTo: "both",
  },
];

/** Lookup by 4-digit code, for the builder and the teaching picker. */
export const REVENUE_CODES_BY_CODE: Record<string, RevenueCode> =
  Object.fromEntries(REVENUE_CODES.map((rc) => [rc.code, rc]));

/** Room-and-board codes. Never valid on a 13x outpatient or emergency bill. */
export const ROOM_AND_BOARD_REVENUE_CODES = ["0100", "0110", "0120"] as const;

/** True for a room-and-board line (0100 / 0110 / 0120). */
export function isRoomAndBoardRevenueCode(code: string): boolean {
  return (ROOM_AND_BOARD_REVENUE_CODES as readonly string[]).includes(code);
}

/** True when a revenue code may appear on a bill of this setting. */
export function isRevenueCodeAllowedOn(
  code: string,
  setting: "inpatient" | "outpatient",
): boolean {
  const rc = REVENUE_CODES_BY_CODE[code];
  if (!rc) return false;
  if (setting === "outpatient") return rc.appliesTo !== "inpatient";
  return rc.appliesTo !== "outpatient";
}

/**
 * Revenue codes whose defaults match this CPT/HCPCS code, most specific first.
 * Used to pre-fill locator 42 on a new service line; the student can override.
 */
export function revenueCodesForCpt(cpt: string): RevenueCode[] {
  const code = cpt.trim().toUpperCase();
  if (!code) return [];
  return REVENUE_CODES.filter((rc) =>
    rc.cptFamilyDefaults.some((match) =>
      match.endsWith("*")
        ? code.startsWith(match.slice(0, -1))
        : match === code,
    ),
  );
}

/**
 * The teaching line printed under locator 42 on an outpatient or ER bill:
 * why the room codes are absent rather than missing.
 */
export const OUTPATIENT_REVENUE_TEACHING_NOTE =
  "Room-and-board codes (0100, 0110, 0120) do not appear on an outpatient or emergency bill. That bill carries ancillary codes only — lab, imaging, OR time, the ER charge itself — because there was no room to charge for. A blank room code here is correct, not missing.";
