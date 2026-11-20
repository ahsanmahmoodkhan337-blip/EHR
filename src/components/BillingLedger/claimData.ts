/**
 * CMS-1500 Form Blocks — Educational Reference Data
 *
 * The printed blocks of the CMS-1500 (02/12) the biller works, with descriptions
 * and common billing errors for each. Box numbers and captions are the form's
 * own — 8 is PATIENT STATUS, 9c is the employer, 11b is OTHER CLAIM ID, 17b is
 * the referring NPI and 30 is reserved R.S. AMOUNT.
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
  { box: "8", label: "Patient Status", description: "Single, married, employed, full-time student or part-time student — the five boxes the 02/12 prints in box 8. It is a patient-status box, not a reserved one." },
  { box: "9", label: "Other Insurance Name", description: "Name of other insurance if coordinated benefits apply." },
  { box: "9a", label: "Other Insured's Policy or Group Number", description: "The other coverage's policy or group number. It used to be joined onto the plan name; it has its own box on the 02/12." },
  { box: "9b", label: "Other Insured's Date of Birth / Sex", description: "The other insured's date of birth and sex — the subscriber's, not the patient's." },
  { box: "9c", label: "Employer/School Name", description: "Employer's or school's name for the other insured — 9c sits inside box 9. It is not 11b." },
  { box: "9d", label: "Insurance Plan Name or Program Name", description: "The other coverage's plan or program name — the plan name only; the group number belongs in 9a." },
  { box: "10a-c", label: "Condition Related to Employment/Auto/Other", description: "Check boxes if condition is work-related, auto accident, or other accident.", commonError: "Missing accident-related information for injury claims." },
  { box: "10d", label: "Claim Codes (Designated by NUCC)", description: "Attachment or claim codes the payer requires, typed by the biller. No stage fills it, and a claim code that names an attachment that does not exist is a false claim." },
  { box: "11", label: "Insured's Policy/Group Number", description: "Policy number and group number from the insurance ID card.", commonError: "Policy number missing or incorrect digits." },
  { box: "11a", label: "Insured's DOB / Sex", description: "Date of birth and sex of the insured policyholder — 11a carries both." },
  { box: "11b", label: "Other Claim ID", description: "The other claim's ID number when the payer requires one. Employer and school go in 9c, not here." },
  { box: "11c", label: "Insurance Plan Name", description: "Name of the specific insurance plan." },
  { box: "11d", label: "Is There Another Health Benefit Plan?", description: "Yes/No — indicates if patient has additional coverage." },
  { box: "12", label: "Patient/Authorized Signature", description: "Patient's signature authorizing release of medical info.", commonError: "Unsigned or signature on file not documented." },
  { box: "13", label: "Assign Benefits Signature", description: "Signature to assign benefits directly to the provider." },
  { box: "14", label: "Date of Current Illness/Injury", description: "Date of onset — when symptoms first appeared for illness, or date of injury.", commonError: "Missing onset date for new conditions." },
  { box: "15", label: "Other Date / Qual.", description: "The other date with its QUAL. qualifier (431 onset of current symptoms, 484 last menstrual period, 454 initial treatment, 304 latest visit). A date with no qualifier is invalid on a real claim." },
  { box: "16", label: "Dates Patient Unable to Work", description: "Work loss dates related to the condition." },
  { box: "17", label: "Referring Provider Name", description: "Name of the referring physician or other source if applicable." },
  { box: "17a", label: "Other ID #", description: "The referring provider's other identifier, with its qualifier — the 02/12 prints this small box beside the name." },
  { box: "17b", label: "Referring Provider NPI", description: "National Provider Identifier of the referring physician. The NPI goes here, in 17b — not in 17a.", commonError: "Missing NPI — all providers must have one." },
  { box: "18", label: "Hospitalization Dates", description: "Inpatient admission and discharge dates if related to service." },
  { box: "19", label: "Additional Claim Information", description: "Reserved for additional info — 24G modifier, etc." },
  { box: "20", label: "Outside Lab?", description: "Check 'Yes' if lab work was performed by an outside lab." },
  { box: "21", label: "ICD-10 Diagnosis Codes", description: "List the ICD-10 codes that support medical necessity (A-L up to 12 codes).", autoFilled: true, commonError: "Missing or incorrect ICD-10 codes — most common denial reason." },
  { box: "22", label: "Medicaid Resubmission Code / Original Ref. No.", description: "One box, two values: the resubmission code (7 = replacement/corrected, 8 = void prior claim) with the ORIGINAL REF. NO. printed beneath it — the ICN/DCN of the claim being corrected or voided. There is no separate 22a box on the 02/12." },
  { box: "23", label: "Prior Authorization Number", description: "PA reference number if prior authorization was required.", commonError: "Missing PA number for services that require it." },
  { box: "24", label: "CPT Codes & Modifiers", description: "The service line: 24A date, 24B place of service, 24C EMG, 24D CPT + modifier, 24E diagnosis pointer, 24F charge, 24G days or units, 24H EPSDT family plan, 24I ID qualifier, 24J rendering provider ID #.", autoFilled: true, commonError: "CPT/diagnosis mismatch — procedure not supported by the diagnosis code." },
  { box: "25", label: "Federal Tax ID Number", description: "Provider's Tax ID (EIN or SSN).", commonError: "Wrong Tax ID type — EIN vs SSN selected incorrectly." },
  { box: "26", label: "Patient Account Number", description: "Provider's internal account number for the patient." },
  { box: "27", label: "Accept Assignment?", description: "Yes/No — whether provider accepts the insurance assignment." },
  { box: "28", label: "Total Charge", description: "Total amount billed for all services." },
  { box: "29", label: "Amount Paid", description: "Amount already paid by patient or other insurance." },
  { box: "30", label: "R.S. Amount", description: "Shaded and reserved on the 02/12 — no data is written here. 'Balance Due' was the 12/90 form; the patient's balance lives on the ledger." },
  { box: "31", label: "Provider Signature", description: "Signature of the treating provider.", commonError: "Unsigned claim is invalid." },
  { box: "32", label: "Service Facility Location", description: "Name, address, and NPI of the facility where services were rendered." },
  { box: "33", label: "Billing Provider Info", description: "Billing provider's name, address, NPI, and Tax ID.", commonError: "Billing NPI missing or incorrect." },
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