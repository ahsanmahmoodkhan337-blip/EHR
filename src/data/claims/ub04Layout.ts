/**
 * UB-04 (CMS-1450) — the institutional claim paper, as a field table.
 *
 * One row of data per printed row of the form: form locator → printed caption →
 * the claim field that fills it. The same table draws the on-screen paper
 * (`components/BillingLedger/Ub04Form.tsx` walks it through `ClaimPaper`) and the
 * PDF (`utils/claimFormPdf.ts` walks it), so the screen and the download cannot
 * disagree about a box number or a caption.
 *
 * Captions are the printed CMS-1450 locators and are public CMS material. The
 * NUBC *descriptors* behind locators 4 (type of bill), 42 (revenue code) and
 * 18–41 (condition / occurrence / value codes) stay our own paraphrase and live
 * in `typeOfBill.ts`, `revenueCodes.ts` and `institutionalCodes.ts` — this file
 * imports them and never restates them.
 *
 * Boxes the encounter cannot honestly fill are printed with their real caption
 * and no field: the student sees the box, the caption, and a hint naming the
 * stage that supplies it. Nothing is invented to make the paper look complete.
 *
 * Inspiration: the printed UB-04 (CMS-1450) and the UB-04 billing screens of
 * hospital revenue-cycle systems.
 */

import type { ClaimBoxOption, ClaimLayout } from "./cms1500Layout";
import { SEX_OPTIONS, YES_NO_OPTIONS } from "./cms1500Layout";
import { REVENUE_CODES } from "./revenueCodes";
import {
  ADMISSION_SOURCE_CODES,
  ADMISSION_TYPE_CODES,
  PATIENT_STATUS_CODES,
} from "./institutionalCodes";

// ─── Coded choices ──────────────────────────────────────────────────

/** The institutional code tables spell their teaching line differently. */
type Describable = {
  code: string;
  teachingDescription?: string;
  description?: string;
  label?: string;
  meaning?: string;
};
const describe = (c: Describable): string =>
  String(c.teachingDescription ?? c.description ?? c.label ?? c.meaning ?? "");

/**
 * Box 4 — type of bill. A teaching subset: the codes this simulator's own
 * place-of-service table suggests (`POS_TYPE_OF_BILL_DEFAULTS`), each labelled
 * with its three digits read out. The full set is in `typeOfBill.ts`.
 */
export const UB04_TYPE_OF_BILL_OPTIONS: ClaimBoxOption[] = [
  { value: "", label: "— select —" },
  { value: "111", label: "111 — HOSPITAL INPATIENT · PART A · ADMIT THROUGH DISCHARGE" },
  { value: "112", label: "112 — HOSPITAL INPATIENT · PART B · INTERIM FIRST" },
  { value: "113", label: "113 — HOSPITAL INPATIENT · PART B · INTERIM CONTINUING" },
  { value: "121", label: "121 — HOSPITAL INPATIENT · PART B · ADMIT THROUGH DISCHARGE" },
  { value: "131", label: "131 — HOSPITAL OUTPATIENT · SINGLE DATE" },
  { value: "141", label: "141 — HOSPITAL OUTPATIENT · OTHER" },
  { value: "831", label: "831 — AMBULATORY SURGICAL CENTRE · OUTPATIENT · SINGLE DATE" },
];

/** Box 14 — admission type. The codes are NUBC's; the words are ours. */
export const UB04_ADMISSION_TYPE_OPTIONS: ClaimBoxOption[] = [
  { value: "", label: "—" },
  ...ADMISSION_TYPE_CODES.map((c) => ({ value: c.code, label: `${c.code} — ${describe(c)}` })),
];

/** Box 15 — source of admission (SRC). */
export const UB04_ADMISSION_SOURCE_OPTIONS: ClaimBoxOption[] = [
  { value: "", label: "—" },
  ...ADMISSION_SOURCE_CODES.map((c) => ({ value: c.code, label: `${c.code} — ${describe(c)}` })),
];

/** Box 17 — patient status: where the patient went at discharge. */
export const UB04_PATIENT_STATUS_OPTIONS: ClaimBoxOption[] = [
  { value: "", label: "—" },
  ...PATIENT_STATUS_CODES.map((c) => ({ value: c.code, label: `${c.code} — ${describe(c)}` })),
];

/** Box 42 — the revenue-code picker, built from the one revenue table. */
export const UB04_REVENUE_OPTIONS: ClaimBoxOption[] = [
  { value: "", label: "— select revenue code —" },
  ...REVENUE_CODES.map((r) => ({
    value: r.code,
    label: `${r.code} — ${r.teachingDescription}${
      r.appliesTo === "inpatient" ? " (inpatient only)" : ""
    }`,
  })),
];

/** Box 11 — the sex codes the paper prints. */
export const UB04_SEX_OPTIONS: ClaimBoxOption[] = SEX_OPTIONS;

/** Boxes 52 / 53 — the printed Y / N release and assignment boxes. */
export const UB04_YES_NO_OPTIONS: ClaimBoxOption[] = YES_NO_OPTIONS;

// ─── Service-line columns (42–49) ───────────────────────────────────

export interface Ub04LineColumn {
  key: string;
  /** The printed locator and caption. */
  label: string;
  /** Share of the table width (sums to 1). */
  width: number;
  kind?: "text" | "money" | "date" | "number";
  /** Read-only: the value is derived from another column, never typed. */
  derived?: boolean;
}

/**
 * The UB-04 service-line table. Box 43 prints the revenue code read out in
 * words, box 47 is the line's charge, box 48 the part of it the payer does not
 * cover. Box 49 is the blank 23rd row on the printed form and carries no data.
 */
export const UB04_LINE_COLUMNS: Ub04LineColumn[] = [
  { key: "revenueCode", label: "42 · REVENUE CODE", width: 0.1 },
  { key: "revenueDescription", label: "43 · DESCRIPTION", width: 0.26, derived: true },
  { key: "cpt", label: "44 · HCPCS / RATE / HIPPS", width: 0.14 },
  { key: "dateOfService", label: "45 · SERV. DATE", width: 0.11, kind: "date" },
  { key: "units", label: "46 · SERV. UNITS", width: 0.08, kind: "number" },
  { key: "charge", label: "47 · TOTAL CHARGES", width: 0.12, kind: "money" },
  { key: "nonCovered", label: "48 · NON-COVERED CHARGES", width: 0.12, kind: "money" },
];

/** The same columns, in the shape the PDF renderer takes. */
export const UB04_PDF_COLUMNS = UB04_LINE_COLUMNS.map((c) => ({
  key: c.key,
  label: c.label,
  width: c.width,
  kind: c.kind,
}));

// ─── The paper ──────────────────────────────────────────────────────

const BLANK_HINT =
  "The printed form carries this locator; nothing on this encounter fills it. A blank here is correct on an outpatient bill.";

export const UB04_LAYOUT: ClaimLayout = {
  id: "ub04",
  title: "UB-04 — Uniform Bill (CMS-1450)",
  formCode: "UB-04 (CMS-1450)",
  maxLines: 22,
  lineShape: ["revenueCode"],
  rows: [
    {
      heightMm: 12,
      cells: [
        {
          id: "1",
          label: "1. PROVIDER NAME, STREET ADDRESS, CITY, STATE, ZIP, TELEPHONE",
          colSpan: 5,
          fields: [
            { field: "facilityName", kind: "text", flex: 1 },
            { field: "facilityAddress", kind: "text", flex: 1 },
          ],
        },
        { id: "2", label: "2. PAYER NAME", colSpan: 3, fields: [{ field: "payerName", kind: "text" }] },
        {
          id: "3a",
          label: "3a. PATIENT CONTROL NO.",
          colSpan: 2,
          fields: [{ field: "patientAccountNumber", kind: "text" }],
        },
        {
          id: "3b",
          label: "3b. MEDICAL RECORD NO.",
          colSpan: 2,
          fields: [{ field: "medicalRecordNumber", kind: "text" }],
        },
      ],
    },
    {
      heightMm: 11,
      cells: [
        {
          id: "4",
          label: "4. TYPE OF BILL",
          colSpan: 3,
          fields: [
            { field: "typeOfBill", kind: "select", options: UB04_TYPE_OF_BILL_OPTIONS },
          ],
          hint: "Derived from the encounter's place of service (POS 23 → 131, POS 21 → 111, POS 24 → 831). Typing a different code is allowed — it is then a typed value, and it must agree with the setting.",
        },
        {
          id: "5",
          label: "5. FEDERAL TAX NO.",
          colSpan: 2,
          fields: [{ field: "federalTaxId", kind: "text" }],
        },
        {
          id: "6",
          label: "6. STATEMENT COVERS PERIOD  FROM / THROUGH",
          colSpan: 4,
          fields: [
            { field: "statementFrom", kind: "date", label: "FROM", flex: 1 },
            { field: "statementThrough", kind: "date", label: "THROUGH", flex: 1 },
          ],
        },
        {
          id: "7",
          label: "7. COVERED DAYS",
          colSpan: 3,
          fields: [{ field: "coveredDays", kind: "number" }],
          hint: "A day count, not a charge. Blank on a single-date outpatient bill.",
        },
      ],
    },
    {
      heightMm: 11,
      cells: [
        {
          id: "8",
          label: "8. PATIENT NAME (Last, First, MI)",
          colSpan: 4,
          fields: [{ field: "patientName", kind: "text" }],
        },
        {
          id: "9",
          label: "9. PATIENT ADDRESS",
          colSpan: 4,
          fields: [{ field: "patientAddress", kind: "text" }],
        },
        {
          id: "10",
          label: "10. BIRTH DATE",
          colSpan: 2,
          fields: [{ field: "patientDob", kind: "date" }],
        },
        {
          id: "11",
          label: "11. SEX",
          colSpan: 2,
          fields: [{ field: "patientSex", kind: "select", options: UB04_SEX_OPTIONS }],
        },
      ],
    },
    {
      heightMm: 11,
      cells: [
        {
          id: "12",
          label: "12. ADMISSION DATE",
          colSpan: 2,
          fields: [{ field: "admissionDate", kind: "date" }],
          hint: "Front Desk (check-in — the admission). Blank on a 13x outpatient bill.",
        },
        {
          id: "13",
          label: "13. ADMISSION HOUR",
          colSpan: 2,
          fields: [{ field: "admissionHour", kind: "text", placeholder: "HHMM" }],
        },
        {
          id: "14",
          label: "14. ADMISSION TYPE",
          colSpan: 2,
          fields: [
            { field: "admissionType", kind: "select", options: UB04_ADMISSION_TYPE_OPTIONS },
          ],
        },
        {
          id: "15",
          label: "15. SRC",
          colSpan: 2,
          fields: [
            { field: "admissionSource", kind: "select", options: UB04_ADMISSION_SOURCE_OPTIONS },
          ],
          hint: "SRC — source of admission: where the patient came from.",
        },
        {
          id: "16",
          label: "16. DHR",
          colSpan: 2,
          fields: [{ field: "dischargeHour", kind: "text", placeholder: "HHMM" }],
          hint: "DHR — discharge hour.",
        },
        {
          id: "17",
          label: "17. PATIENT STATUS",
          colSpan: 2,
          fields: [
            { field: "patientStatus", kind: "select", options: UB04_PATIENT_STATUS_OPTIONS },
          ],
          hint: "Front Desk (check-out — where the patient went).",
        },
      ],
    },
    {
      heightMm: 11,
      cells: [
        {
          id: "18",
          label: "18–28. CONDITION CODES",
          colSpan: 5,
          fields: [
            { field: "conditionCodes", kind: "text", placeholder: "up to 11 codes" },
          ],
          hint: "Codes that change how the claim is priced (e.g. an employment-related injury). Pick from the condition-code table in `institutionalCodes.ts`.",
        },
        {
          id: "29",
          label: "29. ACCIDENT STATE",
          colSpan: 2,
          fields: [{ field: "accidentState", kind: "text", placeholder: "ST" }],
        },
        { id: "30", label: "30. RESERVED", colSpan: 1, reserved: true },
        {
          id: "31",
          label: "31–34. OCCURRENCE CODES & DATES",
          colSpan: 4,
          fields: [{ field: "occurrenceCodes", kind: "text" }],
        },
      ],
    },
    {
      heightMm: 11,
      cells: [
        {
          id: "35",
          label: "35–36. OCCURRENCE SPAN CODE & DATES",
          colSpan: 4,
          fields: [{ field: "occurrenceSpan", kind: "text" }],
        },
        { id: "37", label: "37. RESERVED", colSpan: 1, reserved: true },
        {
          id: "38",
          label: "38. RESPONSIBLE PARTY NAME AND ADDRESS",
          colSpan: 4,
          fields: [{ field: "responsibleParty", kind: "text" }],
        },
        {
          id: "39",
          label: "39–41. VALUE CODES & AMOUNTS",
          colSpan: 3,
          fields: [{ field: "valueCodes", kind: "text" }],
        },
      ],
    },
    {
      heightMm: 46,
      cells: [
        {
          id: "42",
          label:
            "42–49. SERVICE LINES — 42 REVENUE CODE · 43 DESCRIPTION · 44 HCPCS/RATE/HIPPS · 45 SERV. DATE · 46 SERV. UNITS · 47 TOTAL CHARGES · 48 NON-COVERED CHARGES",
          colSpan: 12,
          structural: "table",
        },
      ],
    },
    {
      heightMm: 13,
      cells: [
        {
          id: "50",
          label: "50. PAYER NAME  A / B / C",
          colSpan: 4,
          stack: true,
          fields: [{ field: "payerName", kind: "text", label: "A" }],
          hint: "Row A is the primary payer. B and C print blank on a single-payer claim.",
        },
        {
          id: "51",
          label: "51. HEALTH PLAN ID  A / B / C",
          colSpan: 4,
          stack: true,
          fields: [{ field: "payerEdiId", kind: "text", label: "A" }],
          hint: "The plan's electronic payer ID, not its phone number. No ID captured → the box stays blank rather than guessed.",
        },
        {
          id: "52",
          label: "52. RELEASE OF INFORMATION  A / B / C",
          colSpan: 4,
          stack: true,
          fields: [
            {
              field: "releaseOfInformation",
              kind: "select",
              options: UB04_YES_NO_OPTIONS,
              label: "A",
            },
          ],
        },
      ],
    },
    {
      heightMm: 13,
      cells: [
        {
          id: "53",
          label: "53. ASSIGNMENT OF BENEFITS  A / B / C",
          colSpan: 4,
          stack: true,
          fields: [
            {
              field: "assignmentOfBenefits",
              kind: "select",
              options: UB04_YES_NO_OPTIONS,
              label: "A",
            },
          ],
        },
        {
          id: "54",
          label: "54. PRIOR PAYMENTS  A / B / C",
          colSpan: 4,
          stack: true,
          fields: [{ field: "priorPayments", kind: "money", label: "A" }],
        },
        {
          id: "55",
          label: "55. ESTIMATED AMOUNT DUE  A / B / C",
          colSpan: 4,
          stack: true,
          fields: [{ field: "estimatedAmountDue", kind: "money", label: "A" }],
        },
      ],
    },
    {
      heightMm: 13,
      cells: [
        {
          id: "56",
          label: "56. NPI",
          colSpan: 3,
          fields: [{ field: "billingProviderNpi", kind: "text" }],
          hint: "The billing provider's NPI — 10 digits, Luhn-checked.",
        },
        {
          id: "57",
          label: "57. OTHER PROVIDER ID",
          colSpan: 5,
          fields: [
            {
              field: "otherProviderIdQualifier",
              kind: "text",
              label: "QUAL",
              flex: 1,
              placeholder: "0B",
            },
            { field: "otherProviderId", kind: "text", label: "ID #", flex: 2 },
          ],
        },
        {
          id: "58",
          label: "58. INSURED'S NAME  A / B / C",
          colSpan: 4,
          stack: true,
          fields: [{ field: "insuredName", kind: "text", label: "A" }],
        },
      ],
    },
    {
      heightMm: 13,
      cells: [
        {
          id: "59",
          label: "59. P. REL  A / B / C",
          colSpan: 4,
          stack: true,
          fields: [{ field: "patientRelationship", kind: "text", label: "A" }],
          hint: "P. REL — the patient's relationship to the insured (01 self, 02 spouse, 03 child, …).",
        },
        {
          id: "60",
          label: "60. INSURED'S UNIQUE ID  A / B / C",
          colSpan: 4,
          stack: true,
          fields: [{ field: "insuredId", kind: "text", label: "A" }],
        },
        {
          id: "61",
          label: "61. INSURED'S GROUP NAME  A / B / C",
          colSpan: 4,
          stack: true,
          fields: [{ field: "insuredGroupName", kind: "text", label: "A" }],
        },
      ],
    },
    {
      heightMm: 13,
      cells: [
        {
          id: "62",
          label: "62. INSURANCE GROUP NO.  A / B / C",
          colSpan: 4,
          stack: true,
          fields: [{ field: "insuranceGroupNumber", kind: "text", label: "A" }],
        },
        {
          id: "63",
          label: "63. TREATMENT AUTHORIZATION CODES  A / B / C",
          colSpan: 4,
          stack: true,
          fields: [{ field: "treatmentAuthorizationCode", kind: "text", label: "A" }],
          hint: "The payer's own authorisation number, never the internal PA record id.",
        },
        {
          id: "64",
          label: "64. DOCUMENT CONTROL NUMBER  A / B / C",
          colSpan: 4,
          stack: true,
          fields: [{ field: "documentControlNumber", kind: "text", label: "A" }],
          hint: "The payer's ICN/DCN for the claim being replaced or voided.",
        },
      ],
    },
    {
      heightMm: 11,
      cells: [
        { id: "65", label: "65. RESERVED", colSpan: 1, reserved: true },
        {
          id: "66",
          label: "66. DX VERSION",
          colSpan: 2,
          fields: [{ field: "diagnosisVersion", kind: "text", placeholder: "0" }],
          hint: "Diagnosis coding method: 0 = ICD-10-CM. Fixed at 0 for this simulator.",
        },
        {
          id: "67",
          label: "67. PRINCIPAL DIAGNOSIS CODE",
          colSpan: 3,
          fields: [{ field: "principalDiagnosis", kind: "text" }],
          hint: "Coded — the first code of the Coder's final ICD-10 list, in priority order.",
        },
        {
          id: "67A",
          label: "67A–67Q. OTHER DIAGNOSIS CODES",
          colSpan: 6,
          fields: [{ field: "otherDiagnoses", kind: "text" }],
        },
      ],
    },
    {
      heightMm: 13,
      cells: [
        { id: "68", label: "68. RESERVED", colSpan: 1, reserved: true },
        {
          id: "69",
          label: "69. ADMITTING DIAGNOSIS CODE",
          colSpan: 3,
          fields: [{ field: "admittingDiagnosis", kind: "text" }],
          hint: "Scribe / Provider (the admission note's assessment).",
        },
        {
          id: "70",
          label: "70. PATIENT'S REASON FOR VISIT  A / B / C",
          colSpan: 4,
          stack: true,
          fields: [{ field: "patientReasonVisit", kind: "text", label: "A" }],
        },
        {
          id: "71",
          label: "71. PPS CODE",
          colSpan: 2,
          fields: [{ field: "ppsCode", kind: "text" }],
        },
        {
          id: "72",
          label: "72. ECI",
          colSpan: 2,
          fields: [{ field: "eciCode", kind: "text" }],
          hint: "ECI — external cause of injury code.",
        },
      ],
    },
    {
      heightMm: 13,
      cells: [
        {
          id: "73",
          label: "73. PRINCIPAL PROCEDURE CODE",
          colSpan: 6,
          stack: true,
          fields: [
            { field: "principalProcedureCode", kind: "text", label: "a. CODE" },
            { field: "principalProcedureDate", kind: "date", label: "b. DATE" },
            { field: "principalProcedureQualifier", kind: "text", label: "c. QUAL" },
          ],
        },
        {
          id: "74",
          label: "74. OTHER PROCEDURE CODE",
          colSpan: 6,
          stack: true,
          fields: [
            { field: "otherProcedureCode", kind: "text", label: "a. CODE" },
            { field: "otherProcedureDate", kind: "date", label: "b. DATE" },
          ],
        },
      ],
    },
    {
      heightMm: 13,
      cells: [
        { id: "75", label: "75. RESERVED", colSpan: 1, reserved: true },
        {
          id: "76",
          label: "76. ATTENDING PROVIDER — NPI / QUAL / LAST / FIRST",
          colSpan: 5,
          fields: [
            { field: "attendingNpi", kind: "text", label: "NPI", flex: 1 },
            { field: "attendingQualifier", kind: "text", label: "QUAL", flex: 1 },
            { field: "attendingLastName", kind: "text", label: "LAST", flex: 1 },
            { field: "attendingFirstName", kind: "text", label: "FIRST", flex: 1 },
          ],
          hint: "From the provider profile — the enrolled attending physician.",
        },
        {
          id: "77",
          label: "77. OPERATING PHYSICIAN — NPI / QUAL / LAST / FIRST",
          colSpan: 3,
          fields: [{ field: "operatingProviderNpi", kind: "text", label: "NPI" }],
        },
        {
          id: "78",
          label: "78. OTHER PROVIDER — NPI / QUAL / LAST / FIRST",
          colSpan: 3,
          fields: [{ field: "otherProviderNpi", kind: "text", label: "NPI" }],
        },
      ],
    },
    {
      heightMm: 13,
      cells: [
        {
          id: "79",
          label: "79. OTHER PROVIDER — NPI / QUAL / LAST / FIRST",
          colSpan: 5,
          fields: [{ field: "otherProviderNpi2", kind: "text", label: "NPI" }],
        },
        {
          id: "80",
          label: "80. REMARKS",
          colSpan: 4,
          fields: [{ field: "remarks", kind: "text" }],
        },
        {
          id: "81",
          label: "81. CODE-CODE  a. CODE / b. QUAL / c. CODE / d. QUAL",
          colSpan: 3,
          fields: [
            { field: "codeCodeA", kind: "text", label: "a", flex: 1 },
            { field: "codeCodeB", kind: "text", label: "b", flex: 1 },
            { field: "codeCodeC", kind: "text", label: "c", flex: 1 },
            { field: "codeCodeD", kind: "text", label: "d", flex: 1 },
          ],
          hint: "The tax-ID / qualifier pairs. Box 5 already carries the federal tax number.",
        },
      ],
    },
  ],
};

/** Hint shown on a box the encounter has nothing honest to put in. */
export const UB04_BLANK_BOX_HINT = BLANK_HINT;

/**
 * The printed caption of one locator, for validation messages and teaching
 * copy that must quote the paper in its own words.
 */
export function ub04Caption(locator: string): string {
  for (const row of UB04_LAYOUT.rows) {
    const cell = row.cells.find((c) => c.id === locator);
    if (cell) return cell.label;
  }
  return `Box ${locator}`;
}
