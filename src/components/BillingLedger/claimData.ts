/**
 * CMS-1500 Form Blocks — Educational Reference Data
 *
 * All 33 blocks of the CMS-1500 form with descriptions
 * and common billing errors for each.
 *
 * Inspiration: CMS-1500 (02/12) form instructions / AAPC
 */

export interface FormBlock {
  box: string;
  label: string;
  description: string;
  commonError?: string;
  autoFilled?: boolean;
}

export const CMS1500_BLOCKS: FormBlock[] = [
  { box: "1", label: "Insurance Coverage", description: "Mark the appropriate insurance type — Medicare, Medicaid, TRICARE, CHAMPVA, Group Health Plan, FECA, or Other, as printed on the form.", commonError: "Checking multiple boxes or no box at all causes automatic denial." },
  { box: "2", label: "Patient Name", description: "Patient's full last name, first name, middle initial as it appears on the insurance card.", autoFilled: true, commonError: "Name mismatch with insurance records." },
  { box: "3", label: "Patient DOB & Sex", description: "Patient's date of birth (MM/DD/YYYY) and sex (M/F).", autoFilled: true, commonError: "DOB missing or incorrect." },
  { box: "4", label: "Insured Name", description: "Name of the person who holds the insurance policy (if different from patient).", commonError: "Left blank when patient is not the policyholder." },
  { box: "5", label: "Patient Address", description: "Patient's street address, city, state, and ZIP code.", commonError: "Outdated address on file." },
  { box: "6", label: "Patient Relationship to Insured", description: "Self, Spouse, Child, or Other — indicates the patient's relationship to the policyholder." },
  { box: "7", label: "Insured Address", description: "Policyholder's address (if different from patient)." },
  { box: "8", label: "Reserved for NUCC", description: "Unused — leave blank." },
  { box: "9", label: "Other Insurance Name", description: "Name of other insurance if coordinated benefits apply." },
  { box: "10a-c", label: "Condition Related to Employment/Auto/Other", description: "Check boxes if condition is work-related, auto accident, or other accident.", commonError: "Missing accident-related information for injury claims." },
  { box: "11", label: "Insured's Policy/Group Number", description: "Policy number and group number from the insurance ID card.", commonError: "Policy number missing or incorrect digits." },
  { box: "11a", label: "Insured's DOB", description: "Date of birth of the insured policyholder." },
  { box: "11b", label: "Employer/School Name", description: "Employer name if coverage is through employer." },
  { box: "11c", label: "Insurance Plan Name", description: "Name of the specific insurance plan." },
  { box: "11d", label: "Is There Another Health Benefit Plan?", description: "Yes/No — indicates if patient has additional coverage." },
  { box: "12", label: "Patient/Authorized Signature", description: "Patient's signature authorizing release of medical info.", commonError: "Unsigned or signature on file not documented." },
  { box: "13", label: "Assign Benefits Signature", description: "Signature to assign benefits directly to the provider." },
  { box: "14", label: "Date of Current Illness/Injury", description: "Date of onset — when symptoms first appeared for illness, or date of injury.", commonError: "Missing onset date for new conditions." },
  { box: "15", label: "First Date of Same/Similar Illness", description: "If patient had the same condition before, provide prior date." },
  { box: "16", label: "Dates Patient Unable to Work", description: "Work loss dates related to the condition." },
  { box: "17", label: "Referring Provider Name", description: "Name and NPI of the referring physician if applicable." },
  { box: "17a", label: "Referring Provider NPI", description: "National Provider Identifier of the referring physician.", commonError: "Missing NPI — all providers must have one." },
  { box: "18", label: "Hospitalization Dates", description: "Inpatient admission and discharge dates if related to service." },
  { box: "19", label: "Additional Claim Information", description: "Reserved for additional info — 24G modifier, etc." },
  { box: "20", label: "Outside Lab?", description: "Check 'Yes' if lab work was performed by an outside lab." },
  { box: "21", label: "ICD-10 Diagnosis Codes", description: "List the ICD-10 codes that support medical necessity (A-L up to 12 codes).", autoFilled: true, commonError: "Missing or incorrect ICD-10 codes — most common denial reason." },
  { box: "22", label: "Resubmission Code", description: "7 = replacement/corrected claim, 8 = void prior claim." },
  { box: "22a", label: "Original Claim Number", description: "The claim number of the original claim being corrected or voided." },
  { box: "23", label: "Prior Authorization Number", description: "PA reference number if prior authorization was required.", commonError: "Missing PA number for services that require it." },
  { box: "24", label: "CPT Codes & Modifiers", description: "Date of service, place of service, CPT code, modifier, diagnosis pointer, charges, units.", autoFilled: true, commonError: "CPT/diagnosis mismatch — procedure not supported by the diagnosis code." },
  { box: "25", label: "Federal Tax ID Number", description: "Provider's Tax ID (EIN or SSN).", commonError: "Wrong Tax ID type — EIN vs SSN selected incorrectly." },
  { box: "26", label: "Patient Account Number", description: "Provider's internal account number for the patient." },
  { box: "27", label: "Accept Assignment?", description: "Yes/No — whether provider accepts the insurance assignment." },
  { box: "28", label: "Total Charge", description: "Total amount billed for all services." },
  { box: "29", label: "Amount Paid", description: "Amount already paid by patient or other insurance." },
  { box: "30", label: "Balance Due", description: "Remaining balance after payments/adjustments." },
  { box: "31", label: "Provider Signature", description: "Signature of the treating provider.", commonError: "Unsigned claim is invalid." },
  { box: "32", label: "Service Facility Location", description: "Name, address, and NPI of the facility where services were rendered." },
  { box: "33", label: "Billing Provider Info", description: "Billing provider's name, address, NPI, and Tax ID.", commonError: "Billing NPI missing or incorrect." },
];

// ─── Revenue Codes ──────────────────────────────────────────────────────

export const REVENUE_CODES = [
  { code: "0250", description: "General Pharmacy", type: "Pharmacy" },
  { code: "0260", description: "IV Therapy", type: "Therapy" },
  { code: "0270", description: "Medical/Surgical Supplies", type: "Supplies" },
  { code: "0300", description: "General Laboratory", type: "Lab" },
  { code: "0320", description: "Radiology — Diagnostic", type: "Radiology" },
  { code: "0330", description: "Nuclear Medicine", type: "Radiology" },
  { code: "0370", description: "Anesthesia", type: "Surgery" },
  { code: "0450", description: "Emergency Room", type: "ER" },
  { code: "0500", description: "General ICU", type: "ICU" },
  { code: "0762", description: "Specialty — Observation", type: "Observation" },
];

// ─── Place of Service Codes ─────────────────────────────────────────────

export const POS_CODES = [
  { code: "11", description: "Office", setting: "Outpatient" },
  { code: "12", description: "Home", setting: "Home" },
  { code: "21", description: "Inpatient Hospital", setting: "Inpatient" },
  { code: "22", description: "Outpatient Hospital", setting: "Outpatient" },
  { code: "23", description: "Emergency Room — Hospital", setting: "ER" },
  { code: "24", description: "Ambulatory Surgical Center", setting: "Surgery" },
  { code: "31", description: "Skilled Nursing Facility", setting: "Facility" },
  { code: "41", description: "Ambulance — Land", setting: "Transport" },
  { code: "50", description: "Federally Qualified Health Center", setting: "Clinic" },
  { code: "71", description: "Public Health Clinic", setting: "Clinic" },
  { code: "81", description: "Independent Laboratory", setting: "Lab" },
  { code: "99", description: "Other Place of Service", setting: "Other" },
];