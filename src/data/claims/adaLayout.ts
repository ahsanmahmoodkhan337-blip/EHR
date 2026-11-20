/**
 * ADA Dental Claim Form (2019, J430) layout — the dental equivalent of the
 * CMS-1500 replica, on the same shell.
 *
 * Same idea as `cms1500Layout.ts`: every printed box is data — its number, its
 * caption, the claim field it binds to, its share of the page's 12 columns and
 * its row height in millimetres — so the on-screen paper and the PDF are drawn
 * from one description.
 *
 * Field coverage: boxes 1–3 (type of transaction, predetermination number,
 * other coverage), 4–11 insured/subscriber, 12–18 patient, 20–30 treating
 * dentist and claim detail, 31 the service-line table, 32–36 the fee summary,
 * 37–38 the signatures. The 2019 form's 39–52 misc block is not modelled: its
 * boxes are optional and mean different things per transaction type, and the
 * simulator carries no data for them.
 *
 * Inspiration: the ADA Dental Claim Form 2019 (J430D) as printed by Dentrix /
 * Eaglesoft and submitted through an ADA clearinghouse.
 */

import type { ClaimBox, ClaimLayout, ClaimRow } from "./cms1500Layout";
import { YES_NO_OPTIONS } from "./cms1500Layout";

/** One CDT line on the ADA paper (box 31). */
export interface ADAServiceLine {
  /** 31 — date of service (ISO). */
  dateOfService: string;
  /** 31 — procedure code (CDT). */
  cdt: string;
  /** 31 — short description carried with the code. */
  description: string;
  /** 31 — tooth number / letter (Universal). */
  tooth: string;
  /** 31 — tooth surface(s). */
  surface: string;
  /** 31 — quadrant / area of oral cavity. */
  quadrant: string;
  /** 31 — fee charged for the line. */
  fee: number;
  /** 31 — units. */
  units: number;
}

export interface ADAFormData {
  // 1–3
  transactionType: string;
  predeterminationNumber: string;
  otherCoverage: string;
  // 4–11 insured / subscriber
  insuredName: string;
  insuredAddress: string;
  insuredPhone: string;
  insuredDob: string;
  insuredSex: string;
  subscriberId: string;
  groupNumber: string;
  planName: string;
  // 12–18 patient
  patientName: string;
  patientAddress: string;
  patientPhone: string;
  patientDob: string;
  patientSex: string;
  patientId: string;
  relationship: string;
  // 20–30 treating dentist + claim detail
  dentistName: string;
  dentistNpi: string;
  dentistAddress: string;
  dentistPhone: string;
  placeOfTreatment: string;
  patientStatus: string;
  accidentDate: string;
  orthodontic: string;
  prosthesis: string;
  otherTreatmentInfo: string;
  diagnosisCodes: string;
  // 31
  lines: ADAServiceLine[];
  // 32–36
  otherFees: number;
  totalFee: number;
  amountPaid: number;
  balanceDue: number;
  signatureDate: string;
  // 37–38
  patientSignature: boolean;
  dentistSignature: string;
}

export const ADA_TRANSACTION_OPTIONS = [
  { value: "Statement of Actual Services", label: "STATEMENT OF ACTUAL SERVICES" },
  { value: "Request for Predetermination", label: "REQUEST FOR PREDETERMINATION" },
  { value: "Request for Post-Treatment Estimate", label: "REQUEST FOR POST-TREATMENT ESTIMATE" },
];

export const ADA_OTHER_COVERAGE_OPTIONS = [
  { value: "No", label: "NO" },
  { value: "Yes — primary", label: "YES — PRIMARY" },
  { value: "Yes — secondary", label: "YES — SECONDARY" },
];

export const ADA_RELATIONSHIP_OPTIONS = [
  { value: "Self", label: "SELF" },
  { value: "Spouse", label: "SPOUSE" },
  { value: "Child", label: "CHILD" },
  { value: "Other", label: "OTHER" },
];

export const ADA_PLACE_OF_TREATMENT_OPTIONS = [
  { value: "11 — Office", label: "11 — OFFICE" },
  { value: "21 — Inpatient hospital", label: "21 — INPATIENT HOSPITAL" },
  { value: "22 — Outpatient hospital", label: "22 — OUTPATIENT HOSPITAL" },
  { value: "03 — School", label: "03 — SCHOOL" },
  { value: "Other", label: "OTHER" },
];

export const ADA_PATIENT_STATUS_OPTIONS = [
  { value: "Single", label: "SINGLE" },
  { value: "Married", label: "MARRIED" },
  { value: "Child", label: "CHILD (under 19)" },
  { value: "Full-time student", label: "FULL-TIME STUDENT" },
  { value: "Part-time student", label: "PART-TIME STUDENT" },
];

export const ADA_GENDER_OPTIONS = [
  { value: "", label: "—" },
  { value: "M", label: "M" },
  { value: "F", label: "F" },
];

const band = (label: string): ClaimBox => ({
  id: label.split(".")[0],
  label,
  colSpan: 12,
  structural: "band",
});

const ADA_ROWS: ClaimRow[] = [
  {
    heightMm: 13,
    cells: [
      {
        id: "1",
        label: "1. TYPE OF TRANSACTION",
        colSpan: 7,
        fields: [{ field: "transactionType", kind: "select", options: ADA_TRANSACTION_OPTIONS }],
      },
      {
        id: "2",
        label: "2. PREDETERMINATION / PREAUTHORIZATION NUMBER",
        colSpan: 5,
        fields: [{ field: "predeterminationNumber", kind: "text" }],
      },
    ],
  },
  {
    heightMm: 10,
    cells: [
      {
        id: "3",
        label: "3. OTHER COVERAGE?",
        colSpan: 12,
        fields: [{ field: "otherCoverage", kind: "select", options: ADA_OTHER_COVERAGE_OPTIONS }],
      },
    ],
  },
  { heightMm: 7, cells: [band("4. INSURED / SUBSCRIBER INFORMATION")] },
  {
    heightMm: 10,
    cells: [
      {
        id: "4",
        label: "4. INSURED / SUBSCRIBER NAME",
        colSpan: 7,
        fields: [{ field: "insuredName", kind: "text" }],
      },
      {
        id: "5",
        label: "5. INSURED / SUBSCRIBER ADDRESS",
        colSpan: 5,
        fields: [{ field: "insuredAddress", kind: "text" }],
      },
    ],
  },
  {
    heightMm: 10,
    cells: [
      { id: "6", label: "6. INSURED / SUBSCRIBER PHONE", colSpan: 4, fields: [{ field: "insuredPhone", kind: "text" }] },
      { id: "7", label: "7. INSURED / SUBSCRIBER DATE OF BIRTH", colSpan: 4, fields: [{ field: "insuredDob", kind: "date" }] },
      { id: "8", label: "8. INSURED / SUBSCRIBER GENDER", colSpan: 4, fields: [{ field: "insuredSex", kind: "select", options: ADA_GENDER_OPTIONS }] },
    ],
  },
  {
    heightMm: 10,
    cells: [
      { id: "9", label: "9. SUBSCRIBER ID / MEMBER ID", colSpan: 4, fields: [{ field: "subscriberId", kind: "text" }] },
      { id: "10", label: "10. GROUP NUMBER", colSpan: 4, fields: [{ field: "groupNumber", kind: "text" }] },
      { id: "11", label: "11. PLAN / PROGRAM NAME", colSpan: 4, fields: [{ field: "planName", kind: "text" }] },
    ],
  },
  { heightMm: 7, cells: [band("12. PATIENT INFORMATION")] },
  {
    heightMm: 10,
    cells: [
      { id: "12", label: "12. PATIENT NAME", colSpan: 7, fields: [{ field: "patientName", kind: "text" }] },
      { id: "13", label: "13. PATIENT ADDRESS", colSpan: 5, fields: [{ field: "patientAddress", kind: "text" }] },
    ],
  },
  {
    heightMm: 10,
    cells: [
      { id: "14", label: "14. PATIENT PHONE", colSpan: 4, fields: [{ field: "patientPhone", kind: "text" }] },
      { id: "15", label: "15. PATIENT DATE OF BIRTH", colSpan: 4, fields: [{ field: "patientDob", kind: "date" }] },
      { id: "16", label: "16. PATIENT GENDER", colSpan: 4, fields: [{ field: "patientSex", kind: "select", options: ADA_GENDER_OPTIONS }] },
    ],
  },
  {
    heightMm: 10,
    cells: [
      { id: "17", label: "17. PATIENT ID / ACCOUNT #", colSpan: 6, fields: [{ field: "patientId", kind: "text" }] },
      { id: "18", label: "18. RELATIONSHIP TO SUBSCRIBER", colSpan: 6, fields: [{ field: "relationship", kind: "select", options: ADA_RELATIONSHIP_OPTIONS }] },
    ],
  },
  { heightMm: 7, cells: [band("20. TREATING DENTIST AND CLAIM DETAIL")] },
  {
    heightMm: 10,
    cells: [
      { id: "20", label: "20. TREATING DENTIST NAME", colSpan: 7, fields: [{ field: "dentistName", kind: "text" }] },
      { id: "21", label: "21. TREATING DENTIST NPI", colSpan: 5, fields: [{ field: "dentistNpi", kind: "text" }] },
    ],
  },
  {
    heightMm: 10,
    cells: [
      { id: "22", label: "22. TREATING DENTIST ADDRESS", colSpan: 8, fields: [{ field: "dentistAddress", kind: "text" }] },
      { id: "23", label: "23. TREATING DENTIST PHONE", colSpan: 4, fields: [{ field: "dentistPhone", kind: "text" }] },
    ],
  },
  {
    heightMm: 10,
    cells: [
      { id: "24", label: "24. PLACE OF TREATMENT", colSpan: 4, fields: [{ field: "placeOfTreatment", kind: "select", options: ADA_PLACE_OF_TREATMENT_OPTIONS }] },
      { id: "25", label: "25. PATIENT'S STATUS", colSpan: 4, fields: [{ field: "patientStatus", kind: "select", options: ADA_PATIENT_STATUS_OPTIONS }] },
      { id: "26", label: "26. DATE OF ACCIDENT", colSpan: 4, fields: [{ field: "accidentDate", kind: "date" }] },
    ],
  },
  {
    heightMm: 10,
    cells: [
      { id: "27", label: "27. ORTHODONTIC TREATMENT?", colSpan: 3, fields: [{ field: "orthodontic", kind: "select", options: YES_NO_OPTIONS }] },
      { id: "28", label: "28. PROSTHESIS?", colSpan: 3, fields: [{ field: "prosthesis", kind: "select", options: YES_NO_OPTIONS }] },
      { id: "29", label: "29. OTHER TREATMENT INFORMATION", colSpan: 6, fields: [{ field: "otherTreatmentInfo", kind: "text" }] },
    ],
  },
  {
    heightMm: 10,
    cells: [
      {
        id: "30",
        label: "30. DIAGNOSIS CODE(S) — ICD-10 (required for oral surgery / medical cross-coding)",
        colSpan: 12,
        fields: [{ field: "diagnosisCodes", kind: "text" }],
      },
    ],
  },
  {
    heightMm: 46,
    cells: [
      {
        id: "31",
        label: "31. SERVICES — DATE  PROCEDURE CODE  DESCRIPTION  TOOTH  SURFACE  QUADRANT  FEE  UNITS",
        colSpan: 12,
        structural: "table",
      },
    ],
  },
  {
    heightMm: 10,
    cells: [
      { id: "32", label: "32. OTHER FEES", colSpan: 4, fields: [{ field: "otherFees", kind: "money" }] },
      { id: "33", label: "33. TOTAL FEE", colSpan: 4, fields: [{ field: "totalFee", kind: "money" }] },
      { id: "34", label: "34. AMOUNT PAID", colSpan: 4, fields: [{ field: "amountPaid", kind: "money" }] },
    ],
  },
  {
    heightMm: 10,
    cells: [
      { id: "35", label: "35. BALANCE DUE", colSpan: 4, fields: [{ field: "balanceDue", kind: "money" }] },
      { id: "36", label: "36. DATE OF SIGNATURE", colSpan: 4, fields: [{ field: "signatureDate", kind: "date" }] },
      { id: "37", label: "37. SIGNATURE OF SUBSCRIBER / PATIENT", colSpan: 4, fields: [{ field: "patientSignature", kind: "checkbox", label: "SIGNATURE ON FILE" }] },
    ],
  },
  {
    heightMm: 12,
    cells: [
      { id: "38", label: "38. SIGNATURE OF DENTIST", colSpan: 12, fields: [{ field: "dentistSignature", kind: "text" }] },
    ],
  },
];

export const ADA_LAYOUT: ClaimLayout = {
  id: "ada2019",
  title: "DENTAL CLAIM FORM",
  formCode: "ADA 2019 (J430)",
  maxLines: 6,
  lineShape: ["dateOfService", "cdt", "description", "tooth", "surface", "quadrant", "fee", "units"],
  rows: ADA_ROWS,
};

/** A blank ADA claim — used when a dental case opens with no saved form. */
export function emptyADAForm(): ADAFormData {
  return {
    transactionType: "Statement of Actual Services",
    predeterminationNumber: "",
    otherCoverage: "No",
    insuredName: "",
    insuredAddress: "",
    insuredPhone: "",
    insuredDob: "",
    insuredSex: "",
    subscriberId: "",
    groupNumber: "",
    planName: "",
    patientName: "",
    patientAddress: "",
    patientPhone: "",
    patientDob: "",
    patientSex: "",
    patientId: "",
    relationship: "Self",
    dentistName: "",
    dentistNpi: "",
    dentistAddress: "",
    dentistPhone: "",
    placeOfTreatment: "11 — Office",
    patientStatus: "Single",
    accidentDate: "",
    orthodontic: "No",
    prosthesis: "No",
    otherTreatmentInfo: "",
    diagnosisCodes: "",
    lines: [],
    otherFees: 0,
    totalFee: 0,
    amountPaid: 0,
    balanceDue: 0,
    signatureDate: "",
    patientSignature: false,
    dentistSignature: "",
  };
}
