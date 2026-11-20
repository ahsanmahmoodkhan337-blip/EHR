/**
 * Claim validation — the edit checks a clearinghouse would run before it
 * accepts a claim, expressed against the paper's own box numbers so the form
 * can outline the offending box and quote it in the banner.
 *
 * Returns one issue per problem: `{ box, message, severity }`. `error` blocks
 * submission; `warn` is advice the student can override.
 *
 * Inspiration: the NUCC CMS-1500 (02/12) instructions' data-element rules and
 * the ADA claim form's edit checks, as implemented in a clearinghouse scrubber.
 */

import type { ClaimFormData } from "../store/pipelineStore";
import type { ADAFormData } from "../data/claims/adaLayout";

export interface ClaimIssue {
  box: string;
  message: string;
  severity: "error" | "warn";
}

const ICD10_RE = /^[A-TV-Z][0-9][0-9A-Z](\.[0-9A-Z]{1,4})?$/;
const CPT_RE = /^(\d{5}|[A-Z]\d{4})$/;
const TAX_ID_RE = /^\d{2}-\d{7}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const blank = (v: unknown): boolean => String(v ?? "").trim() === "";
const money = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const near = (a: number, b: number): boolean => Math.abs(a - b) < 0.011;

/**
 * NPI check: 10 digits, and the whole 10-digit number must pass the Luhn
 * mod-10 test once the health-industry prefix 80840 is prepended (the rule the
 * NPPES registry itself uses).
 */
export function isValidNpi(npi: string): boolean {
  const digits = String(npi ?? "").replace(/\D/g, "");
  if (digits.length !== 10) return false;
  const full = `80840${digits}`;
  let sum = 0;
  let double = false;
  for (let i = full.length - 1; i >= 0; i--) {
    let d = Number(full[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

export function errorCount(issues: ClaimIssue[]): number {
  return issues.filter((i) => i.severity === "error").length;
}

/** Boxes carrying at least one error — used for the red outline on the paper. */
export function errorBoxes(issues: ClaimIssue[]): Set<string> {
  return new Set(issues.filter((i) => i.severity === "error").map((i) => i.box));
}

// ─── CMS-1500 ───────────────────────────────────────────────────────

export function validateCMS1500(form: ClaimFormData): ClaimIssue[] {
  const issues: ClaimIssue[] = [];
  const err = (box: string, message: string) => issues.push({ box, message, severity: "error" });
  const warn = (box: string, message: string) => issues.push({ box, message, severity: "warn" });

  if (blank(form.insuranceType)) err("1", "Box 1: select the type of insurance.");
  if (blank(form.insuredId)) err("1a", "Box 1a: insured's I.D. number is required.");
  if (blank(form.patientName)) err("2", "Box 2: patient name is required.");
  if (blank(form.patientDob)) err("3", "Box 3: patient date of birth is required.");
  else if (!ISO_DATE_RE.test(form.patientDob)) err("3", "Box 3: patient date of birth must be a date.");
  if (blank(form.patientSex)) warn("3", "Box 3: patient sex is blank.");
  if (blank(form.insuredName)) err("4", "Box 4: insured's name is required.");
  if (blank(form.patientAddress)) err("5", "Box 5: patient address is required.");
  if (blank(form.patientRelationship)) err("6", "Box 6: patient relationship to insured is required.");
  if (blank(form.insuredAddress)) err("7", "Box 7: insured's address is required.");
  if (blank(form.insuredPolicyGroup)) err("11", "Box 11: insured's policy / group number is required.");
  if (!form.patientSignature && !form.insuredSignature) {
    err("12", "Box 12 or 13: the claim needs a patient or insured signature on file.");
  }

  const codes = (form.diagnosisCodes || []).map((c) => String(c ?? "").trim()).filter(Boolean);
  const validCodes = codes.filter((c) => ICD10_RE.test(c));
  if (validCodes.length === 0) {
    err("21", "Box 21: enter at least one valid ICD-10-CM diagnosis code.");
  } else {
    codes.forEach((c) => {
      if (!ICD10_RE.test(c)) err("21", `Box 21: "${c}" is not a valid ICD-10-CM code.`);
    });
  }

  const lines = (form.serviceLines || []).filter(
    (l) => l && (!blank(l.cpt) || !blank(l.dateOfService) || money(l.charge) > 0),
  );
  if (lines.length === 0) {
    err("24", "Box 24: at least one service line is required.");
  }
  lines.forEach((line, i) => {
    const row = `line ${i + 1}`;
    if (blank(line.dateOfService)) err("24A", `Box 24A (${row}): date of service is required.`);
    else if (!ISO_DATE_RE.test(line.dateOfService)) err("24A", `Box 24A (${row}): date of service must be a date.`);
    if (blank(line.placeOfService)) err("24B", `Box 24B (${row}): place of service is required.`);
    if (blank(line.cpt)) err("24D", `Box 24D (${row}): CPT/HCPCS code is required.`);
    else if (!CPT_RE.test(line.cpt.trim())) err("24D", `Box 24D (${row}): "${line.cpt}" is not a CPT/HCPCS code.`);
    if (money(line.charge) <= 0) err("24F", `Box 24F (${row}): charge must be greater than zero.`);
    if (!Number.isFinite(line.units) || line.units < 1) err("24G", `Box 24G (${row}): units must be 1 or more.`);

    const pointer = String(line.diagnosisPointer ?? "").trim().toUpperCase();
    if (blank(pointer)) {
      err("24E", "Box 24E: diagnosis pointer required.");
      return;
    }
    const letters = pointer.split("").filter((ch) => /[A-L]/.test(ch));
    if (letters.length === 0) {
      err("24E", `Box 24E (${row}): "${pointer}" is not a diagnosis pointer (A–L).`);
      return;
    }
    letters.forEach((letter) => {
      const idx = letter.charCodeAt(0) - 65;
      if (blank(codes[idx])) {
        err("24E", `Box 24E (${row}) points to ${letter}, which is not in box 21.`);
      }
    });
  });

  if (!blank(form.federalTaxId) && !TAX_ID_RE.test(form.federalTaxId.trim())) {
    err("25", "Box 25: federal tax I.D. must be in XX-XXXXXXX form.");
  }
  if (blank(form.federalTaxId)) err("25", "Box 25: federal tax I.D. number is required.");

  const lineTotal = lines.reduce((sum, l) => sum + money(l.charge), 0);
  if (money(form.totalCharge) <= 0) {
    err("28", "Box 28: total charge must be greater than zero.");
  } else if (lines.length > 0 && !near(money(form.totalCharge), lineTotal)) {
    err("28", `Box 28: total charge (${money(form.totalCharge).toFixed(2)}) must equal the sum of box 24F (${lineTotal.toFixed(2)}).`);
  }

  if (blank(form.providerSignature)) err("31", "Box 31: provider signature is required.");
  if (blank(form.providerSignatureDate)) err("31", "Box 31: signature date is required.");

  if (blank(form.facilityNpi)) err("32", "Box 32: service facility NPI is required.");
  else if (!isValidNpi(form.facilityNpi)) err("32", "Box 32: NPI must be 10 digits and pass the NPI check digit test.");

  if (blank(form.billingProviderNpi)) err("33", "Box 33: billing provider NPI is required.");
  else if (!isValidNpi(form.billingProviderNpi)) err("33", "Box 33: NPI must be 10 digits and pass the NPI check digit test.");
  if (blank(form.billingProviderTaxId)) err("33", "Box 33: billing provider tax I.D. is required.");
  else if (!TAX_ID_RE.test(form.billingProviderTaxId.trim())) {
    err("33", "Box 33: billing provider tax I.D. must be in XX-XXXXXXX form.");
  }
  if (blank(form.billingProviderName)) err("33", "Box 33: billing provider name is required.");

  if (!blank(form.referringNpi) && !isValidNpi(form.referringNpi)) {
    err("17b", "Box 17b: referring provider NPI must be 10 digits and pass the check digit test.");
  }
  if (blank(form.priorAuthNumber)) {
    warn("23", "Box 23: no prior authorization number — leave blank only if the payer does not require one.");
  }
  if (!blank(form.resubmissionCode) && blank(form.originalClaimNumber)) {
    err("22a", "Box 22a: a corrected or voided claim must quote the original reference number.");
  }

  return issues;
}

// ─── ADA 2019 dental claim ──────────────────────────────────────────

export function validateADA(form: ADAFormData): ClaimIssue[] {
  const issues: ClaimIssue[] = [];
  const err = (box: string, message: string) => issues.push({ box, message, severity: "error" });
  const warn = (box: string, message: string) => issues.push({ box, message, severity: "warn" });

  if (blank(form.transactionType)) err("1", "Box 1: choose the type of transaction.");
  if (blank(form.insuredName)) err("4", "Box 4: insured / subscriber name is required.");
  if (blank(form.subscriberId)) err("9", "Box 9: subscriber ID is required.");
  if (blank(form.planName)) err("11", "Box 11: plan / program name is required.");
  if (blank(form.patientName)) err("12", "Box 12: patient name is required.");
  if (blank(form.patientDob)) err("15", "Box 15: patient date of birth is required.");
  else if (!ISO_DATE_RE.test(form.patientDob)) err("15", "Box 15: patient date of birth must be a date.");
  if (blank(form.relationship)) err("18", "Box 18: relationship to subscriber is required.");
  if (blank(form.dentistName)) err("20", "Box 20: treating dentist name is required.");
  if (blank(form.dentistNpi)) err("21", "Box 21: treating dentist NPI is required.");
  else if (!isValidNpi(form.dentistNpi)) err("21", "Box 21: NPI must be 10 digits and pass the NPI check digit test.");

  if (blank(form.diagnosisCodes)) {
    warn("30", "Box 30: no ICD-10 code — required when the service is billed for medical necessity.");
  }

  const lines = (form.lines || []).filter(
    (l) => l && (!blank(l.cdt) || !blank(l.dateOfService) || money(l.fee) > 0),
  );
  if (lines.length === 0) err("31", "Box 31: at least one service line is required.");
  lines.forEach((line, i) => {
    const row = `line ${i + 1}`;
    if (blank(line.cdt)) err("31", `Box 31 (${row}): CDT procedure code is required.`);
    if (blank(line.dateOfService)) err("31", `Box 31 (${row}): date of service is required.`);
    else if (!ISO_DATE_RE.test(line.dateOfService)) err("31", `Box 31 (${row}): date of service must be a date.`);
    if (money(line.fee) <= 0) err("31", `Box 31 (${row}): fee must be greater than zero.`);
    if (!Number.isFinite(line.units) || line.units < 1) err("31", `Box 31 (${row}): units must be 1 or more.`);
  });

  const feeTotal = lines.reduce((sum, l) => sum + money(l.fee), 0) + money(form.otherFees);
  if (money(form.totalFee) <= 0) err("33", "Box 33: total fee must be greater than zero.");
  else if (lines.length > 0 && !near(money(form.totalFee), feeTotal)) {
    err("33", `Box 33: total fee (${money(form.totalFee).toFixed(2)}) must equal the sum of box 31 fees + box 32 other fees (${feeTotal.toFixed(2)}).`);
  }
  if (money(form.balanceDue) > 0 && !near(money(form.balanceDue), money(form.totalFee) - money(form.amountPaid))) {
    warn("35", "Box 35: balance due does not equal box 33 minus box 34.");
  }
  if (!form.patientSignature && blank(form.dentistSignature)) {
    err("37", "Box 37 or 38: the claim needs the subscriber's or the dentist's signature.");
  }
  if (blank(form.signatureDate)) err("36", "Box 36: signature date is required.");

  return issues;
}
