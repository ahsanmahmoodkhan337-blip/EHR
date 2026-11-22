/**
 * caseClaimPaper.ts — the claim paper a graded case prints, built from the
 * case's own record.
 *
 * A graded case now carries a place of service (and, for a facility, its type of
 * bill and a revenue code on each procedure). This module turns that record into
 * the values the real claim paper draws, so a case can show the UB-04 (CMS-1450)
 * with its own type of bill and its own revenue codes instead of a CMS-1500
 * summary — and so a test can prove the paper cannot disagree with the case.
 *
 * Three rules, all of them the same rules the free-form encounter follows:
 *   - **The place of service chooses the paper** (`domain/claimPaper.ts`), never
 *     the student and never a stored claim type.
 *   - **The type of bill is the case's own** when it states one, otherwise the
 *     one its place of service suggests (`data/claims/typeOfBill.ts`), otherwise
 *     blank. It is never invented.
 *   - **A revenue code belongs to the department that earned the line.** It is
 *     read from the case's procedure record, and only for the code the student
 *     actually put on the claim — so the paper shows what the student coded, and
 *     a line the case never planned simply carries no revenue code.
 *
 * Nothing here writes state; every function is pure.
 */

import { MEDICAL_PROVIDER_PROFILE } from "../data/claims/providerProfile";
import { REVENUE_CODES_BY_CODE } from "../data/claims/revenueCodes";
import { typeOfBillDefaultForPos } from "../data/claims/typeOfBill";
import type { MedicalCaseScenario } from "../data/medical/caseScenarios";
import { findPlan } from "../data/medical";
import { paperForPos } from "./claimPaper";

/** A line the student coded on the case's coding stage. */
export interface CaseCodedLine {
  code: string;
  modifier?: string | null;
}

/** One service line as the UB-04 prints it, locators 42 to 48. */
export interface CaseClaimLine {
  /** Locator 42 — the department that earned the line. Blank when the case has none for it. */
  revenueCode: string;
  /** Locator 43 — the teaching table's own description of that revenue code. */
  revenueDescription: string;
  /** Locator 44 — the CPT/HCPCS code the student coded. */
  cpt: string;
  modifier: string;
  dateOfService: string;
  units: number;
  charge: number;
}

export interface CaseClaimPaper {
  claimType: "professional" | "institutional" | "dental";
  /** The printed form, e.g. "UB-04 (CMS-1450)". */
  paper: string;
  /** The X12 transaction set, e.g. "837I". */
  x12: string;
  /** Locator 4 — the three digits, or "" when neither the case nor its POS states one. */
  typeOfBill: string;
  /** Box values keyed by the claim layout's own field names. */
  values: Record<string, string | number>;
  lines: CaseClaimLine[];
}

/** The case's place of service — a case that states none bills as a physician office. */
export function casePlaceOfService(scenario: MedicalCaseScenario): string {
  return String(scenario.placeOfService ?? "11").trim() || "11";
}

/** Locator 4 — the case's own type of bill, else the one its POS suggests, else "". */
export function caseTypeOfBill(scenario: MedicalCaseScenario): string {
  const stated = String(scenario.typeOfBill ?? "").trim();
  if (stated) return stated;
  return typeOfBillDefaultForPos(casePlaceOfService(scenario))?.typeOfBill ?? "";
}

/** True when the case's place of service bills the facility — the UB-04's own territory. */
export function caseBillsFacility(scenario: MedicalCaseScenario): boolean {
  return paperForPos({ placeOfService: casePlaceOfService(scenario), track: "medical" }).claimType ===
    "institutional";
}

/**
 * The case's service lines, in the order the student coded them. A line whose
 * code is not in the case's own procedure record still prints (it is what the
 * student chose); it simply has no revenue code, no date and no charge to show,
 * because the case never recorded one for it.
 */
export function caseClaimLines(
  scenario: MedicalCaseScenario,
  coded: CaseCodedLine[],
): CaseClaimLine[] {
  return coded.map((line) => {
    const code = String(line.code ?? "").trim();
    const planned = scenario.procedures.find((p) => p.code === code);
    const revenueCode = String(planned?.revenueCode ?? "").trim();
    return {
      revenueCode,
      revenueDescription: REVENUE_CODES_BY_CODE[revenueCode]?.teachingDescription ?? "",
      cpt: code,
      modifier: String(line.modifier ?? "").trim(),
      dateOfService: planned?.dateOfService ?? "",
      units: planned?.units ?? 1,
      charge: planned?.chargedUsd ?? 0,
    };
  });
}

/** The whole paper: which form, its type of bill, its boxes and its lines. */
export function caseClaimPaper(
  scenario: MedicalCaseScenario,
  coded: CaseCodedLine[],
): CaseClaimPaper {
  const pos = casePlaceOfService(scenario);
  const paper = paperForPos({ placeOfService: pos, track: "medical" });
  const lines = caseClaimLines(scenario, coded);
  const dates = lines
    .map((l) => l.dateOfService)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
  const diagnoses = scenario.diagnoses.map((d) => d.code);
  const provider = MEDICAL_PROVIDER_PROFILE;
  const patient = scenario.patient;

  return {
    claimType: paper.claimType,
    paper: paper.paper,
    x12: paper.x12,
    typeOfBill: caseTypeOfBill(scenario),
    values: {
      facilityName: provider.legalName,
      facilityAddress: `${provider.address}, ${provider.cityStateZip}`,
      payerName: findPlan(scenario.planId)?.name ?? scenario.planId,
      patientAccountNumber: scenario.id,
      typeOfBill: caseTypeOfBill(scenario),
      statementFrom: dates[0] ?? "",
      statementThrough: dates[dates.length - 1] ?? "",
      patientName: `${patient.lastName}, ${patient.firstName}`,
      patientDob: patient.dateOfBirth,
      patientSex: patient.gender.toLowerCase().startsWith("m") ? "M" : "F",
      billingProviderNpi: provider.npi,
      insuredName: patient.subscriberName,
      patientRelationship: patient.relationshipToSubscriber === "self" ? "SELF" : "",
      insuredId: patient.memberId,
      principalDiagnosis: diagnoses[0] ?? "",
      otherDiagnoses: diagnoses.slice(1).join(", "),
      patientReasonVisit: scenario.clinicalNote.chiefComplaint,
      attendingLastName: provider.signatureName,
    },
    lines,
  };
}
