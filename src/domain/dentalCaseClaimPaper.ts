/**
 * dentalCaseClaimPaper — the ADA Dental Claim Form 2019 (J430D) a graded dental
 * case prints, drawn from the case's own record.
 *
 * Inspiration: the printed ADA claim as it leaves a Dentrix / Eaglesoft billing
 * worklist — the paper is the claim, so a case whose lines are already recorded
 * shows the payer's form and not a summary table. This is the dental counterpart
 * of `domain/caseClaimPaper.ts`, which does the same job for the UB-04.
 *
 * Every value here comes from the case (its patient, its plan, its recorded
 * procedures), so each box on the paper can be traced back to the record: the
 * tooth, surface and quadrant in box 31 are the ones the case recorded for that
 * CDT code, and the fee is the case's own. A line the student coded that the case
 * never recorded still prints — it is what they chose — but carries no tooth,
 * surface, quadrant, date or fee, because the case holds none for it.
 */

import { findCDT, findPlan, type DentalCaseScenario } from "../data/dental";
import { DENTAL_PROVIDER_PROFILE } from "../data/claims/providerProfile";

/** One box 31 service line as the paper prints it. */
export interface DentalCaseClaimLine {
  /** Box 31 procedure code (CDT). */
  cdt: string;
  /** Box 31 description — the code set's own short name. */
  description: string;
  /** Box 31 tooth, in the Universal designation. */
  tooth: string;
  /** Box 31 surface letters, e.g. "MO". */
  surface: string;
  /** Box 31 quadrant / area of the oral cavity. */
  quadrant: string;
  dateOfService: string;
  fee: number;
  units: number;
}

/** The whole paper: its form, its 837D set, its box values and its lines. */
export interface DentalCaseClaimPaper {
  /** The printed form, e.g. "ADA Dental Claim Form 2019 (J430D)". */
  paper: string;
  /** The X12 transaction set, e.g. "837D". */
  x12: string;
  /** Box values keyed by the ADA layout's own field names. */
  values: Record<string, string | number | boolean>;
  lines: DentalCaseClaimLine[];
}

/** A coded line the student built, reduced to what the paper needs to match it. */
export interface DentalCodedLine {
  code: string;
  tooth?: string;
  surfaces?: string;
  quadrant?: string;
}

/**
 * The case's service lines, in the order the student coded them. The record
 * supplies the tooth, surface, quadrant, date and fee for a code it holds; a code
 * it does not hold prints as the student chose it, with those cells blank.
 */
export function dentalCaseClaimLines(
  scenario: DentalCaseScenario,
  coded: DentalCodedLine[],
): DentalCaseClaimLine[] {
  return coded.slice(0, 6).map((line) => {
    const code = String(line.code ?? "").trim();
    const planned = scenario.procedures.find((p) => p.code === code);
    return {
      cdt: code,
      description: findCDT(code)?.shortName ?? "",
      tooth: String(planned?.tooth ?? line.tooth ?? "").trim(),
      surface: String(planned?.surfaces ?? line.surfaces ?? "").trim(),
      quadrant: String(planned?.quadrant ?? line.quadrant ?? "").trim(),
      dateOfService: planned?.dateOfService ?? "",
      fee: planned?.feeUsd ?? 0,
      units: 1,
    };
  });
}

/** The whole paper: the ADA form, its box values and its lines. */
export function dentalCaseClaimPaper(
  scenario: DentalCaseScenario,
  coded: DentalCodedLine[],
): DentalCaseClaimPaper {
  const lines = dentalCaseClaimLines(scenario, coded);
  const dates = lines
    .map((l) => l.dateOfService)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
  const patient = scenario.patient;
  const plan = findPlan(scenario.planId);
  const provider = DENTAL_PROVIDER_PROFILE;
  const total = lines.reduce((sum, l) => sum + (Number(l.fee) || 0), 0);
  const sex = patient.gender.trim().charAt(0).toUpperCase() === "M" ? "M" : "F";
  const relationship = patient.relationshipToSubscriber.replace(/^./, (c) => c.toUpperCase());

  return {
    paper: "ADA Dental Claim Form 2019 (J430D)",
    x12: "837D",
    values: {
      transactionType: "Statement of Actual Services",
      otherCoverage: patient.secondaryCoverage ? "Yes — secondary" : "No",
      insuredName: patient.subscriberName,
      insuredAddress: patient.address,
      insuredPhone: patient.phone,
      insuredDob: patient.dateOfBirth,
      insuredSex: sex,
      subscriberId: patient.memberId,
      groupNumber: plan?.groupNumber ?? "",
      planName: plan ? `${plan.payerName} ${plan.planName}`.trim() : scenario.planId,
      patientName: `${patient.lastName}, ${patient.firstName}`,
      patientAddress: patient.address,
      patientPhone: patient.phone,
      patientDob: patient.dateOfBirth,
      patientSex: sex,
      patientId: patient.id,
      relationship,
      dentistName: provider.legalName,
      dentistNpi: provider.npi,
      dentistAddress: `${provider.address}, ${provider.cityStateZip}`,
      dentistPhone: provider.phone,
      placeOfTreatment: "11 — Office",
      otherFees: 0,
      totalFee: total,
      amountPaid: 0,
      balanceDue: total,
      signatureDate: dates[dates.length - 1] ?? "",
      dentistSignature: provider.signatureName,
    },
    lines,
  };
}
