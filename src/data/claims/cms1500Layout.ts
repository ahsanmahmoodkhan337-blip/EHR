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
  maxLines: 6,
  lineShape: ["dateOfService", "placeOfService", "cpt", "diagnosisPointer", "charge", "units", "renderingNpi"],
  rows: [
    {
      heightMm: 15,
      cells: [
        {
          id: "1",
          label: "1. TYPE OF INSURANCE",
          colSpan: 7,
          fields: [
            { field: "insuranceType", kind: "select", options: INSURANCE_TYPE_OPTIONS, flex: 1 },
          ],
        },
        {
          id: "1a",
          label: "1a. INSURED'S I.D. NUMBER",
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
          colSpan: 7,
          fields: [{ field: "patientName", kind: "text", placeholder: "LAST, FIRST MI" }],
        },
        {
          id: "3",
          label: "3. PATIENT'S BIRTH DATE / SEX",
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
          colSpan: 7,
          fields: [{ field: "insuredName", kind: "text" }],
        },
        {
          id: "7",
          label: "7. INSURED'S ADDRESS (No., Street)",
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
          colSpan: 7,
          fields: [{ field: "patientAddress", kind: "text" }],
        },
        {
          id: "6",
          label: "6. PATIENT RELATIONSHIP TO INSURED",
          colSpan: 3,
          fields: [{ field: "patientRelationship", kind: "select", options: RELATIONSHIP_OPTIONS }],
        },
        {
          id: "8",
          label: "8. PATIENT STATUS",
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
          colSpan: 4,
          fields: [{ field: "otherInsuranceName", kind: "text" }],
        },
        {
          id: "9c",
          label: "9c. EMPLOYER'S OR SCHOOL'S NAME",
          colSpan: 3,
          fields: [{ field: "insuredEmployer", kind: "text" }],
        },
        {
          id: "10",
          label: "10. IS PATIENT'S CONDITION RELATED TO:",
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
          colSpan: 4,
          fields: [{ field: "otherInsuredPolicyGroup", kind: "text" }],
        },
        {
          id: "9b",
          label: "9b. OTHER INSURED'S DATE OF BIRTH  SEX",
          colSpan: 4,
          fields: [
            { field: "otherInsuredDob", kind: "date", flex: 2 },
            { field: "otherInsuredSex", kind: "select", options: SEX_OPTIONS, flex: 1, label: "SEX" },
          ],
        },
        {
          id: "9d",
          label: "9d. INSURANCE PLAN NAME OR PROGRAM NAME",
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
          colSpan: 7,
          fields: [{ field: "insuredPolicyGroup", kind: "text" }],
        },
        {
          id: "11a",
          label: "11a. INSURED'S DATE OF BIRTH  SEX",
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
          colSpan: 4,
          fields: [{ field: "otherClaimId", kind: "text" }],
        },
        {
          id: "11c",
          label: "11c. INSURANCE PLAN NAME OR PROGRAM NAME",
          colSpan: 4,
          fields: [{ field: "insuredPlanName", kind: "text" }],
        },
        {
          id: "11d",
          label: "11d. IS THERE ANOTHER HEALTH BENEFIT PLAN?",
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
          colSpan: 6,
          fields: [{ field: "patientSignature", kind: "checkbox", label: "SIGNATURE ON FILE" }],
        },
        {
          id: "13",
          label: "13. INSURED'S OR AUTHORIZED PERSON'S SIGNATURE",
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
          colSpan: 4,
          fields: [{ field: "currentIllnessDate", kind: "date" }],
        },
        {
          id: "15",
          label: "15. OTHER DATE  QUAL.",
          colSpan: 4,
          fields: [
            { field: "similarIllnessQualifier", kind: "select", options: OTHER_DATE_QUALIFIERS, flex: 1, label: "QUAL." },
            { field: "similarIllnessDate", kind: "date", flex: 2 },
          ],
        },
        {
          id: "16",
          label: "16. DATES PATIENT UNABLE TO WORK",
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
          colSpan: 5,
          fields: [{ field: "referringProvider", kind: "text" }],
        },
        {
          id: "17a",
          label: "17a. OTHER ID #",
          colSpan: 2,
          fields: [{ field: "referringOtherId", kind: "text" }],
        },
        {
          id: "17b",
          label: "17b. NPI",
          colSpan: 2,
          fields: [{ field: "referringNpi", kind: "text" }],
        },
        {
          id: "18",
          label: "18. HOSPITALIZATION DATES RELATED TO CURRENT SERVICES",
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
          colSpan: 8,
          fields: [{ field: "additionalInfo", kind: "text" }],
        },
        {
          id: "20",
          label: "20. OUTSIDE LAB?",
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
          colSpan: 4,
          fields: [
            { field: "federalTaxIdType", kind: "select", options: TAX_ID_TYPE_OPTIONS, flex: 1 },
            { field: "federalTaxId", kind: "text", flex: 3 },
          ],
        },
        {
          id: "26",
          label: "26. PATIENT'S ACCOUNT NO.",
          colSpan: 5,
          fields: [{ field: "patientAccountNumber", kind: "text" }],
        },
        {
          id: "27",
          label: "27. ACCEPT ASSIGNMENT?",
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
          colSpan: 4,
          fields: [{ field: "totalCharge", kind: "money" }],
        },
        {
          id: "29",
          label: "29. AMOUNT PAID",
          colSpan: 4,
          fields: [{ field: "amountPaid", kind: "money" }],
        },
        {
          id: "30",
          // 02/12: box 30 is R.S. AMOUNT — shaded and reserved, no data. The
          // "BALANCE DUE" that used to print here was the 12/90 form. A
          // patient's balance belongs on the ledger, not on a claim.
          label: "30. R.S. AMOUNT",
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
          colSpan: 4,
          fields: [
            { field: "providerSignature", kind: "text", flex: 2 },
            { field: "providerSignatureDate", kind: "date", flex: 1 },
          ],
        },
        {
          id: "32",
          label: "32. SERVICE FACILITY LOCATION INFORMATION",
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

/** The 12 diagnosis-pointer letters, in order. */
export const DIAGNOSIS_POINTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"] as const;

/** Field keys the CMS-1500 paper binds to (used to seed a blank claim). */
export type CMS1500FieldKey = keyof Omit<ClaimFormData, "serviceLines">;
