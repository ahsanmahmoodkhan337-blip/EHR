/**
 * CMS-1500 (02/12) layout — the box geometry as data.
 *
 * Every box on the form is described here: its printed number, its caption,
 * which claim field it binds to, how many of the page's 12 columns it spans
 * and how tall its row is (in millimetres, so the same data drives the
 * on-screen paper and the PDF).
 *
 * The page is a two-column form above the service-line table: box 1 with its
 * insurance-type choices top-left, box 1a top-right, patient/insured blocks
 * down the left, condition/relationship blocks down the right, the A–L
 * diagnosis grid across the middle, box 24 as a full-width six-line table and
 * boxes 25–33 across the bottom — 25/26/27, then 28/29/30, then 31/32/33.
 *
 * Inspiration: the NUCC CMS-1500 Health Insurance Claim Form (02/12), the
 * layout Epic and every clearinghouse portal reproduce when they print a claim.
 */

import type { ClaimFormData } from "../../store/pipelineStore";

export type ClaimBoxKind = "text" | "date" | "select" | "money" | "number" | "checkbox";

export interface ClaimBoxOption {
  value: string;
  label: string;
}

/** One editable value inside a printed box (a box may hold several). */
export interface ClaimField {
  field: string;
  kind: ClaimBoxKind;
  /** Sub-caption printed above the value inside the box. */
  label?: string;
  options?: ClaimBoxOption[];
  /** Relative width inside a multi-field box. */
  flex?: number;
  placeholder?: string;
}

export interface ClaimCheck {
  field: string;
  label: string;
}

export interface ClaimBox {
  /** Printed box number, e.g. "24E". Also the id validation issues quote. */
  id: string;
  /** Printed caption, in the form's own words. */
  label: string;
  /** Editable values. Absent for structural boxes. */
  fields?: ClaimField[];
  /** Checkbox group (box 8, boxes 10a–c). */
  checks?: ClaimCheck[];
  /**
   * A box the 02/12 prints shaded and reserved: it carries no data, so it has
   * no fields and the paper draws it empty. Box 30 is the only one — "Balance
   * Due" was the 12/90 form and never came back.
   */
  reserved?: boolean;
  /**
   * A box whose values print one above the other instead of side by side.
   * Box 22 is the one: the resubmission code with `ORIGINAL REF. NO.` printed
   * beneath it, in a single cell — there is no separate 22a box on the 02/12.
   */
  stack?: boolean;
  /** Structural boxes: the A–L diagnosis grid, the service table, a band. */
  structural?: "pointerGrid" | "table" | "band";
  /** Columns out of 12. */
  colSpan: number;
  /**
   * The X12 segment and element this box becomes on an electronic claim, e.g.
   * `SBR05` on the 837P. Where the transaction set has no element for what the
   * paper prints, this says `paper-only` rather than inventing a name; where
   * the element exists but its qualifier is not settled, it says that too.
   * Source: `specs/x12-column-map.md`. A test holds every CMS-1500 box to it.
   */
  x12?: string;
  /**
   * Plain-language caveat about the mapping — the traps (box 1a is not
   * `SBR03`, box 27 is `CLM07` and not box 31's `CLM06`). A tooltip on screen;
   * never printed on the paper or in the PDF.
   */
  x12Note?: string;
  /** Small grey teaching hint, shown under the paper only (never printed). */
  hint?: string;
}

export interface ClaimRow {
  heightMm: number;
  cells: ClaimBox[];
}

export interface ClaimLayout {
  id: "cms1500" | "ada2019" | "ub04";
  title: string;
  formCode: string;
  rows: ClaimRow[];
  /**
   * The X12 transaction set this paper becomes — `837P` for the CMS-1500.
   * Printed once in the paper's header; each box carries its own segment.
   */
  x12Set?: string;
  /** Service lines allowed on the paper (CMS-1500 prints six). */
  maxLines: number;
  /** Field keys that must be present for a blank line to be added. */
  lineShape?: string[];
}

// ─── Coded choices ──────────────────────────────────────────────────

export const INSURANCE_TYPE_OPTIONS: ClaimBoxOption[] = [
  { value: "Medicare", label: "MEDICARE" },
  { value: "Medicaid", label: "MEDICAID" },
  { value: "TRICARE", label: "TRICARE" },
  { value: "CHAMPVA", label: "CHAMPVA" },
  { value: "Group Health Plan", label: "GROUP HEALTH PLAN" },
  { value: "FECA Black Lung", label: "FECA BLK LUNG" },
  { value: "Other", label: "OTHER" },
];

export const RELATIONSHIP_OPTIONS: ClaimBoxOption[] = [
  { value: "Self", label: "SELF" },
  { value: "Spouse", label: "SPOUSE" },
  { value: "Child", label: "CHILD" },
  { value: "Other", label: "OTHER" },
];

export const YES_NO_OPTIONS: ClaimBoxOption[] = [
  { value: "Yes", label: "YES" },
  { value: "No", label: "NO" },
];

export const RESUBMISSION_OPTIONS: ClaimBoxOption[] = [
  { value: "", label: "— none —" },
  { value: "7", label: "7 — REPLACEMENT / CORRECTED" },
  { value: "8", label: "8 — VOID PRIOR CLAIM" },
];

export const SEX_OPTIONS: ClaimBoxOption[] = [
  { value: "", label: "—" },
  { value: "M", label: "M" },
  { value: "F", label: "F" },
];

/** Box 24C — emergency indicator. Blank is the normal state. */
export const EMG_OPTIONS: ClaimBoxOption[] = [
  { value: "", label: "—" },
  { value: "Y", label: "Y" },
];

/**
 * Box 15's `QUAL.` — a teaching subset of the NUCC "other date" qualifiers.
 * The paper prints only `QUAL.`; the codes come from the form's instructions.
 * Illustrative, not the full list: extend only after checking the printed
 * instructions.
 */
export const OTHER_DATE_QUALIFIERS: ClaimBoxOption[] = [
  { value: "431", label: "431 — ONSET OF CURRENT SYMPTOMS OR ILLNESS" },
  { value: "484", label: "484 — LAST MENSTRUAL PERIOD" },
  { value: "454", label: "454 — INITIAL TREATMENT" },
  { value: "304", label: "304 — LATEST VISIT OR CONSULTATION" },
];

/**
 * Box 24I's ID qualifier — a teaching subset of the NUCC list. `XX` (NPI) is
 * the only one this app fills, because 24J is an NPI on every path.
 */
export const ID_QUALIFIER_OPTIONS: ClaimBoxOption[] = [
  { value: "XX", label: "XX — NPI" },
  { value: "1D", label: "1D — MEDICAID ID" },
  { value: "0B", label: "0B — STATE LICENSE" },
  { value: "G2", label: "G2 — PROVIDER COMMERCIAL NUMBER" },
];

/** Box 25 — which kind of federal tax I.D. the number is. */
export const TAX_ID_TYPE_OPTIONS: ClaimBoxOption[] = [
  { value: "EIN", label: "EIN" },
  { value: "SSN", label: "SSN" },
];

/** Box 24B — the place-of-service codes the paper offers. */
export const POS_CODE_OPTIONS: ClaimBoxOption[] = [
  { value: "11", label: "11" },
  { value: "12", label: "12" },
  { value: "21", label: "21" },
  { value: "22", label: "22" },
  { value: "23", label: "23" },
  { value: "24", label: "24" },
  { value: "31", label: "31" },
  { value: "41", label: "41" },
  { value: "50", label: "50" },
  { value: "71", label: "71" },
  { value: "81", label: "81" },
  { value: "99", label: "99" },
];

// ─── The paper ──────────────────────────────────────────────────────

export const CMS1500_LAYOUT: ClaimLayout = {
  id: "cms1500",
  title: "HEALTH INSURANCE CLAIM FORM",
  formCode: "CMS-1500 (02/12)",
  // The CMS-1500 is the only one of the three papers that is an 837P; the
  // UB-04 is an 837I and the ADA form an 837D, so the set is stated per layout.
  x12Set: "837P",
  maxLines: 6,
  lineShape: ["dateOfService", "placeOfService", "cpt", "diagnosisPointer", "charge", "units", "renderingNpi"],
  rows: [
    {
      heightMm: 15,
      cells: [
        {
          id: "1",
          label: "1. TYPE OF INSURANCE",
          x12: "SBR05",
          x12Note:
            "SBR05 is the insurance type code. SBR01 — who is responsible — is required and has no box.",
          colSpan: 7,
          fields: [
            { field: "insuranceType", kind: "select", options: INSURANCE_TYPE_OPTIONS, flex: 1 },
          ],
        },
        {
          id: "1a",
          label: "1a. INSURED'S I.D. NUMBER",
          x12: "NM1*IL NM108=MI NM109",
          x12Note:
            "Loop 2010BA, the subscriber's member ID. Box 1a is not SBR03/SBR04 — those are the group number (box 11) and group name (box 11c).",
          colSpan: 5,
          fields: [{ field: "insuredId", kind: "text", placeholder: "MEMBER ID" }],
        },
      ],
    },
    {
      heightMm: 11,
      cells: [
        {
          id: "2",
          label: "2. PATIENT'S NAME (Last Name, First Name, Middle Initial)",
          x12: "NM1*QC NM103-105 (2010CA)",
          x12Note:
            "When the patient is the subscriber there is no 2010CA: the name is NM1*IL in 2010BA.",
          colSpan: 7,
          fields: [{ field: "patientName", kind: "text", placeholder: "LAST, FIRST MI" }],
        },
        {
          id: "3",
          label: "3. PATIENT'S BIRTH DATE / SEX",
          x12: "DMG02 / DMG03",
          x12Note:
            "2010CA DMG: DMG01=D8, the birth date in DMG02 and the sex in DMG03 — two facts, one segment.",
          colSpan: 5,
          fields: [
            { field: "patientDob", kind: "date", flex: 2 },
            { field: "patientSex", kind: "select", options: SEX_OPTIONS, flex: 1 },
          ],
        },
      ],
    },
    {
      heightMm: 11,
      cells: [
        {
          id: "4",
          label: "4. INSURED'S NAME (Last Name, First Name, Middle Initial)",
          x12: "NM1*IL NM103-105 (2010BA)",
          colSpan: 7,
          fields: [{ field: "insuredName", kind: "text" }],
        },
        {
          id: "7",
          label: "7. INSURED'S ADDRESS (No., Street)",
          x12: "N3 / N4 (2010BA)",
          x12Note:
            "Two segments: street in N3, city/state/ZIP in N4. The telephone half of box 7 has no standard 837P home — PER is payer-specific.",
          colSpan: 5,
          fields: [{ field: "insuredAddress", kind: "text" }],
        },
      ],
    },
    {
      heightMm: 11,
      cells: [
        {
          id: "5",
          label: "5. PATIENT'S ADDRESS (No., Street, City, State, ZIP)",
          x12: "N3 / N4 (2010CA)",
          x12Note:
            "Two segments: street in N3, city/state/ZIP in N4.",
          colSpan: 7,
          fields: [{ field: "patientAddress", kind: "text" }],
        },
        {
          id: "6",
          label: "6. PATIENT RELATIONSHIP TO INSURED",
          x12: "PAT01 (2000C)",
          x12Note:
            "SBR02=18 when the patient is the subscriber; loop 2000C exists only when the patient is not.",
          colSpan: 3,
          fields: [{ field: "patientRelationship", kind: "select", options: RELATIONSHIP_OPTIONS }],
        },
        {
          id: "8",
          label: "8. PATIENT STATUS",
          x12: "paper-only",
          x12Note:
            "The 837P carries no marital or student status, so box 8 has no 837P segment.",
          colSpan: 4,
          checks: [
            { field: "patientStatusSingle", label: "SINGLE" },
            { field: "patientStatusMarried", label: "MARRIED" },
            { field: "patientStatusEmployed", label: "EMPLOYED" },
            { field: "patientStatusFullTimeStudent", label: "FULL-TIME STUDENT" },
            { field: "patientStatusPartTimeStudent", label: "PART-TIME STUDENT" },
          ],
        },
      ],
    },
    {
      heightMm: 11,
      cells: [
        {
          id: "9",
          label: "9. OTHER INSURED'S NAME (Last Name, First Name, Middle Initial)",
          x12: "NM1*IL (2330A)",
          x12Note:
            "COB: loop 2320, then 2330A NM1*IL with NM103/104/105.",
          colSpan: 4,
          fields: [{ field: "otherInsuranceName", kind: "text" }],
        },
        {
          id: "9c",
          label: "9c. EMPLOYER'S OR SCHOOL'S NAME",
          x12: "paper-only",
          x12Note:
            "No element carries the other insured's employer or school. The plan's group name is SBR04 (box 11c).",
          colSpan: 3,
          fields: [{ field: "insuredEmployer", kind: "text" }],
        },
        {
          id: "10",
          label: "10. IS PATIENT'S CONDITION RELATED TO:",
          x12: "CLM11",
          x12Note:
            "One composite for three checks: 10a→EM, 10b→AA, 10c→OA. 10d's NUCC claim codes have no confirmed 837P element, so none is printed.",
          colSpan: 5,
          checks: [
            { field: "conditionEmployment", label: "a. EMPLOYMENT?" },
            { field: "conditionAuto", label: "b. AUTO ACCIDENT?" },
            { field: "conditionOther", label: "c. OTHER ACCIDENT?" },
          ],
          // 10d has no upstream source and no demo value: a fabricated claim
          // code declares an attachment that does not exist.
          fields: [
            { field: "claimCodes", kind: "text", label: "10d. CLAIM CODES (Designated by NUCC)" },
          ],
        },
      ],
    },
    {
      // The 9 block prints on two rows here: the row model is horizontal, so
      // 9a / 9b / 9d sit beneath 9 / 9c / 10 instead of inside one tall cell.
      heightMm: 11,
      cells: [
        {
          id: "9a",
          label: "9a. OTHER INSURED'S POLICY OR GROUP NUMBER",
          x12: "SBR03 (2320)",
          x12Note:
            "The other insured's policy or group number, in the COB loop's own SBR.",
          colSpan: 4,
          fields: [{ field: "otherInsuredPolicyGroup", kind: "text" }],
        },
        {
          id: "9b",
          label: "9b. OTHER INSURED'S DATE OF BIRTH  SEX",
          x12: "DMG02 / DMG03 (2330A)",
          colSpan: 4,
          fields: [
            { field: "otherInsuredDob", kind: "date", flex: 2 },
            { field: "otherInsuredSex", kind: "select", options: SEX_OPTIONS, flex: 1, label: "SEX" },
          ],
        },
        {
          id: "9d",
          label: "9d. INSURANCE PLAN NAME OR PROGRAM NAME",
          x12: "SBR04 (2320)",
          colSpan: 4,
          fields: [{ field: "otherInsurancePlan", kind: "text" }],
        },
      ],
    },
    {
      heightMm: 10,
      cells: [
        {
          id: "11",
          label: "11. INSURED'S POLICY, GROUP OR FECA NUMBER",
          x12: "SBR03",
          colSpan: 7,
          fields: [{ field: "insuredPolicyGroup", kind: "text" }],
        },
        {
          id: "11a",
          label: "11a. INSURED'S DATE OF BIRTH  SEX",
          x12: "DMG02 / DMG03 (2010BA)",
          x12Note:
            "DMG02 is the insured's date of birth; DMG03 carries the SEX printed beside it.",
          colSpan: 5,
          fields: [
            { field: "insuredDob", kind: "date", flex: 2 },
            { field: "insuredSex", kind: "select", options: SEX_OPTIONS, flex: 1, label: "SEX" },
          ],
        },
      ],
    },
    {
      heightMm: 10,
      cells: [
        {
          id: "11b",
          label: "11b. OTHER CLAIM ID (ID)",
          x12: "REF — qualifier undetermined",
          x12Note:
            "The nearest is REF*F8, but F8 is box 22a's original reference number. No qualifier is printed until the NUCC crosswalk is checked.",
          colSpan: 4,
          fields: [{ field: "otherClaimId", kind: "text" }],
        },
        {
          id: "11c",
          label: "11c. INSURANCE PLAN NAME OR PROGRAM NAME",
          x12: "SBR04",
          colSpan: 4,
          fields: [{ field: "insuredPlanName", kind: "text" }],
        },
        {
          id: "11d",
          label: "11d. IS THERE ANOTHER HEALTH BENEFIT PLAN?",
          x12: "paper-only",
          x12Note:
            "The 837P has no yes/no element for another benefit plan — COB is expressed by sending loop 2320.",
          colSpan: 4,
          fields: [{ field: "otherBenefitPlan", kind: "text" }],
        },
      ],
    },
    {
      heightMm: 12,
      cells: [
        {
          id: "12",
          label: "12. PATIENT'S OR AUTHORIZED PERSON'S SIGNATURE",
          x12: "CLM09 / CLM10",
          x12Note:
            "CLM09 is the release of information, CLM10 the signature source — one-to-many.",
          colSpan: 6,
          fields: [{ field: "patientSignature", kind: "checkbox", label: "SIGNATURE ON FILE" }],
        },
        {
          id: "13",
          label: "13. INSURED'S OR AUTHORIZED PERSON'S SIGNATURE",
          x12: "CLM08",
          x12Note:
            "Benefits assignment. The assignment itself is box 27's CLM07.",
          colSpan: 6,
          fields: [{ field: "insuredSignature", kind: "checkbox", label: "SIGNATURE ON FILE" }],
        },
      ],
    },
    {
      heightMm: 10,
      cells: [
        {
          id: "14",
          label: "14. DATE OF CURRENT ILLNESS, INJURY OR PREGNANCY",
          x12: "DTP*431",
          colSpan: 4,
          fields: [{ field: "currentIllnessDate", kind: "date" }],
        },
        {
          id: "15",
          label: "15. OTHER DATE  QUAL.",
          x12: "DTP (DTP01 = QUAL.)",
          x12Note:
            "DTP01 is the qualifier printed in QUAL. (454, 304, 453, 471, 484); DTP03 carries the date.",
          colSpan: 4,
          fields: [
            { field: "similarIllnessQualifier", kind: "select", options: OTHER_DATE_QUALIFIERS, flex: 1, label: "QUAL." },
            { field: "similarIllnessDate", kind: "date", flex: 2 },
          ],
        },
        {
          id: "16",
          label: "16. DATES PATIENT UNABLE TO WORK",
          x12: "DTP*314",
          x12Note:
            "A date range in DTP03.",
          colSpan: 4,
          fields: [
            { field: "unableToWorkFrom", kind: "date", flex: 1 },
            { field: "unableToWorkTo", kind: "date", flex: 1 },
          ],
        },
      ],
    },
    {
      heightMm: 10,
      cells: [
        {
          id: "17",
          label: "17. NAME OF REFERRING PROVIDER OR OTHER SOURCE",
          x12: "NM1*DN (2310A)",
          x12Note:
            "NM103/104/105 carry the referring provider's name.",
          colSpan: 5,
          fields: [{ field: "referringProvider", kind: "text" }],
        },
        {
          id: "17a",
          label: "17a. OTHER ID #",
          x12: "REF*G2 (2310A)",
          colSpan: 2,
          fields: [{ field: "referringOtherId", kind: "text" }],
        },
        {
          id: "17b",
          label: "17b. NPI",
          x12: "NM108=XX / NM109 (2310A)",
          x12Note:
            "2310A NM1*DN: NM108=XX, and NM109 is the NPI.",
          colSpan: 2,
          fields: [{ field: "referringNpi", kind: "text" }],
        },
        {
          id: "18",
          label: "18. HOSPITALIZATION DATES RELATED TO CURRENT SERVICES",
          x12: "DTP*435 + DTP*096",
          x12Note:
            "Two segments — one for each printed date.",
          colSpan: 3,
          fields: [
            { field: "hospitalizationFrom", kind: "date", flex: 1 },
            { field: "hospitalizationTo", kind: "date", flex: 1 },
          ],
        },
      ],
    },
    {
      heightMm: 10,
      cells: [
        {
          id: "19",
          label: "19. ADDITIONAL CLAIM INFORMATION",
          x12: "NTE (NTE01=ADD)",
          x12Note:
            "Additional information goes in NTE; a PWK segment carries an attachment.",
          colSpan: 8,
          fields: [{ field: "additionalInfo", kind: "text" }],
        },
        {
          id: "20",
          label: "20. OUTSIDE LAB?",
          x12: "PS1 / PS102 (2400)",
          x12Note:
            "PS102 needs a dollar charge that this paper never collects — box 20 is YES/NO only.",
          colSpan: 4,
          fields: [{ field: "outsideLab", kind: "select", options: YES_NO_OPTIONS }],
        },
      ],
    },
    {
      heightMm: 22,
      cells: [
        {
          id: "21",
          label: "21. DIAGNOSIS OR NATURE OF ILLNESS OR INJURY (ICD Ind.) — A–L",
          x12: "HI (ABK, then ABF)",
          x12Note:
            "Loop 2300 HI: HI01-1=ABK for the principal diagnosis, ABF for the rest, up to 12. Box 24E's SV107 points into these — SV1 never carries a diagnosis.",
          colSpan: 12,
          structural: "pointerGrid",
          hint: "Box 24E points at these letters. The pointer must name a diagnosis that is filled in here.",
        },
      ],
    },
    {
      // Box 22 prints below 21, as it does on the 02/12. One cell, two stacked
      // values: the resubmission code with ORIGINAL REF. NO. beneath it. There
      // is no separate 22a box — the field key is kept so saved values survive.
      heightMm: 14,
      cells: [
        {
          id: "22",
          label: "22. MEDICAID RESUBMISSION CODE",
          x12: "CLM05-3",
          x12Note:
            "1 original, 7 replacement, 8 void.",
          colSpan: 7,
          stack: true,
          fields: [
            { field: "resubmissionCode", kind: "select", options: RESUBMISSION_OPTIONS, label: "MEDICAID RESUBMISSION CODE" },
            { field: "originalClaimNumber", kind: "text", label: "ORIGINAL REF. NO." },
          ],
        },
        {
          id: "23",
          label: "23. PRIOR AUTHORIZATION NUMBER",
          x12: "REF*G1",
          colSpan: 5,
          fields: [{ field: "priorAuthNumber", kind: "text" }],
        },
      ],
    },
    {
      heightMm: 52,
      cells: [
        {
          id: "24",
          label: "24. SERVICE LINES — A. DATE(S) OF SERVICE (From–To)  B. PLACE OF SERVICE  C. EMG  D. PROCEDURES, SERVICES, OR SUPPLIES (Explain Unusual Circumstances) CPT/HCPCS + MODIFIER  E. DIAGNOSIS POINTER  F. $ CHARGES  G. DAYS OR UNITS  H. EPSDT FAMILY PLAN  I. ID. QUAL.  J. RENDERING PROVIDER ID. #",
          x12: "2400 loop · SV1",
          x12Note:
            "Every service line is one 2400 loop; columns A–J carry their own element in the table header.",
          colSpan: 12,
          structural: "table",
        },
      ],
    },
    {
      heightMm: 10,
      cells: [
        {
          id: "25",
          label: "25. FEDERAL TAX I.D. NUMBER  SSN / EIN",
          x12: "REF*EI / REF*SY (2010AA)",
          x12Note:
            "The qualifier is the box's own SSN/EIN choice, which this paper does not capture.",
          colSpan: 4,
          fields: [
            { field: "federalTaxIdType", kind: "select", options: TAX_ID_TYPE_OPTIONS, flex: 1 },
            { field: "federalTaxId", kind: "text", flex: 3 },
          ],
        },
        {
          id: "26",
          label: "26. PATIENT'S ACCOUNT NO.",
          x12: "CLM01",
          colSpan: 5,
          fields: [{ field: "patientAccountNumber", kind: "text" }],
        },
        {
          id: "27",
          label: "27. ACCEPT ASSIGNMENT?",
          x12: "CLM07",
          x12Note:
            "A/B/C. Not CLM06 — that is box 31's signature on file, and swapping the two is the classic 837P error.",
          colSpan: 3,
          fields: [{ field: "acceptAssignment", kind: "select", options: YES_NO_OPTIONS }],
        },
      ],
    },
    {
      heightMm: 10,
      cells: [
        {
          id: "28",
          label: "28. TOTAL CHARGE",
          x12: "CLM02",
          x12Note:
            "Must equal the sum of every line's SV102.",
          colSpan: 4,
          fields: [{ field: "totalCharge", kind: "money" }],
        },
        {
          id: "29",
          label: "29. AMOUNT PAID",
          x12: "AMT*F5 (2300)",
          colSpan: 4,
          fields: [{ field: "amountPaid", kind: "money" }],
        },
        {
          id: "30",
          // 02/12: box 30 is R.S. AMOUNT — shaded and reserved, no data. The
          // "BALANCE DUE" that used to print here was the 12/90 form. A
          // patient's balance belongs on the ledger, not on a claim.
          label: "30. R.S. AMOUNT",
          x12: "paper-only",
          x12Note:
            "Reserved on the 02/12 by design — it carries no data, so no 837P element.",
          colSpan: 4,
          reserved: true,
          hint: "Box 30 is R.S. AMOUNT — shaded and reserved on the 02/12, with no data. The patient's balance lives on the ledger, not on the claim.",
        },
      ],
    },
    {
      heightMm: 20,
      cells: [
        {
          id: "31",
          label: "31. SIGNATURE OF PHYSICIAN OR SUPPLIER",
          x12: "CLM06",
          x12Note:
            "Provider signature on file. The date half of box 31 is paper-only, and CLM06 is not box 27's CLM07.",
          colSpan: 4,
          fields: [
            { field: "providerSignature", kind: "text", flex: 2 },
            { field: "providerSignatureDate", kind: "date", flex: 1 },
          ],
        },
        {
          id: "32",
          label: "32. SERVICE FACILITY LOCATION INFORMATION",
          x12: "NM1*77 (2310C)",
          x12Note:
            "Service facility: NM108/109 plus N3/N4.",
          colSpan: 4,
          fields: [
            { field: "facilityName", kind: "text", flex: 1 },
            { field: "facilityAddress", kind: "text", flex: 1 },
            { field: "facilityNpi", kind: "text", label: "NPI", flex: 1 },
          ],
        },
        {
          id: "33",
          label: "33. BILLING PROVIDER INFO & PH #",
          x12: "NM1*85 (2010AA)",
          x12Note:
            "Billing provider: NM109, N3/N4 and PER*BL for the phone. The tax ID printed inside box 33 duplicates box 25 — one of them must go before this maps cleanly.",
          colSpan: 4,
          fields: [
            { field: "billingProviderName", kind: "text", flex: 1 },
            { field: "billingProviderAddress", kind: "text", flex: 1 },
            { field: "billingProviderNpi", kind: "text", label: "NPI", flex: 1 },
            { field: "billingProviderTaxId", kind: "text", label: "TAX ID", flex: 1 },
          ],
        },
      ],
    },
  ],
};

/**
 * One printed column of box 24, with the 837P element it becomes. Box 24 is a
 * table rather than a box, so its eleven columns carry their own X12 name in
 * the table's header — on screen and in the PDF, from this one list.
 */
export interface ClaimLineColumn {
  key: string;
  /** Printed column letter, e.g. "24A". */
  box: string;
  /** Printed caption, e.g. "DATE(S)". */
  caption: string;
  /** Share of the table width — the shares sum to 1. */
  width: number;
  kind: "text" | "money" | "date" | "number";
  /** 837P segment and element this column becomes, per `specs/x12-column-map.md`. */
  x12: string;
  /** Plain-language caveat about the mapping — a tooltip on screen. */
  x12Note?: string;
}

export const CMS1500_LINE_COLUMNS: ClaimLineColumn[] = [
  { key: "dateOfService", box: "24A", caption: "DATE(S)", width: 0.12, kind: "date", x12: "DTP*472" },
  {
    key: "placeOfService",
    box: "24B",
    caption: "POS",
    width: 0.06,
    kind: "text",
    x12: "CLM05-1 / SV105",
    x12Note: "CLM05-1 is the claim-level place of service; SV105 carries it per line, which is what this paper allows.",
  },
  { key: "emg", box: "24C", caption: "EMG", width: 0.05, kind: "text", x12: "SV109" },
  {
    key: "cpt",
    box: "24D",
    caption: "CPT/HCPCS",
    width: 0.12,
    kind: "text",
    x12: "SV101-1=HC / SV101-2",
    x12Note: "SV101-3 to SV101-6 carry the modifiers.",
  },
  { key: "modifiers", box: "24D", caption: "MOD", width: 0.09, kind: "text", x12: "SV101-3…-6" },
  {
    key: "diagnosisPointer",
    box: "24E",
    caption: "PTR",
    width: 0.07,
    kind: "text",
    x12: "SV107",
    x12Note: "Pointers into box 21's HI segments.",
  },
  { key: "charge", box: "24F", caption: "CHARGE", width: 0.11, kind: "money", x12: "SV102" },
  { key: "units", box: "24G", caption: "UNITS", width: 0.06, kind: "number", x12: "SV104 (SV103=UN)" },
  {
    key: "epsdt",
    box: "24H",
    caption: "EPSDT",
    width: 0.07,
    kind: "text",
    x12: "SV111 / SV112",
    x12Note: "EPSDT indicator SV111, family-plan indicator SV112; CLM12 at claim level.",
  },
  {
    key: "idQualifier",
    box: "24I",
    caption: "QUAL",
    width: 0.08,
    kind: "text",
    x12: "NM108 (2420A)",
    x12Note: "Implied by the rendering provider's own qualifier — no separate element.",
  },
  { key: "renderingNpi", box: "24J", caption: "ID #", width: 0.17, kind: "text", x12: "NM1*82 / NM109 (2420A)" },
];

/** The 12 diagnosis-pointer letters, in order. */
export const DIAGNOSIS_POINTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"] as const;

/** Field keys the CMS-1500 paper binds to (used to seed a blank claim). */
export type CMS1500FieldKey = keyof Omit<ClaimFormData, "serviceLines">;
