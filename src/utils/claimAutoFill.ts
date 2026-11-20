/**
 * Claim auto-fill — builds the CMS-1500 record from what earlier stages
 * already captured, so the Biller opens a claim and finds the paper filled in.
 *
 * Sources, box by box:
 *   2, 3, 5, 26  patient demographics (patientStore)
 *   1, 11, 11c   the patient's insurance string
 *   21           the Coder stage's final ICD-10 list (in priority order)
 *   23           the Prior Authorization stage's auth number
 *   24A–24J      the Coder's per-line data (date, POS, CPT, modifiers, pointer,
 *                charge, units), falling back to the CPT fee schedule
 *   25, 31, 32, 33  the demo provider profile
 *
 * The insured blocks (1a, 4, 7, 11, 11a–11d) default from the patient and stay
 * editable, because the insured is often someone else.
 *
 * Inspiration: the "claim pre-population" a practice-management system does
 * when the biller opens a coded encounter — Epic Resolute and DrChrono both
 * carry the encounter's codes and demographics onto the form.
 */

import type { ClaimFormData, ClaimServiceLine, PipelineState } from "../store/pipelineStore";
import type { Patient } from "../store/patientStore";
import { CPT_CODES } from "../components/CodingQueue/cptData";
import {
  MEDICAL_PROVIDER_PROFILE,
  DENTAL_PROVIDER_PROFILE,
  type ProviderProfile,
} from "../data/claims/providerProfile";
import { emptyADAForm, type ADAFormData, type ADAServiceLine } from "../data/claims/adaLayout";
import type { ClaimType } from "../data/claims/claimType";

const today = (): string => new Date().toISOString().slice(0, 10);

const OFFICE_EM = new Set([
  "99202", "99203", "99204", "99205",
  "99211", "99212", "99213", "99214", "99215",
]);

/** A completely blank paper — the starting point before anything is known. */
export function blankClaimForm(provider: ProviderProfile = MEDICAL_PROVIDER_PROFILE): ClaimFormData {
  return {
    claimType: "professional",
    insuranceType: "",
    insuredId: "",
    patientName: "",
    patientDob: "",
    patientSex: "",
    insuredName: "",
    patientAddress: "",
    patientRelationship: "Self",
    insuredAddress: "",
    otherInsuranceName: "",
    otherInsurancePlan: "",
    conditionEmployment: false,
    conditionAuto: false,
    conditionOther: false,
    insuredPolicyGroup: "",
    insuredDob: "",
    insuredEmployer: "",
    insuredPlanName: "",
    otherBenefitPlan: "No",
    patientSignature: true,
    insuredSignature: false,
    currentIllnessDate: today(),
    similarIllnessDate: "",
    unableToWorkFrom: "",
    unableToWorkTo: "",
    referringProvider: "",
    referringNpi: "",
    hospitalizationFrom: "",
    hospitalizationTo: "",
    additionalInfo: "",
    outsideLab: "No",
    diagnosisCodes: [],
    resubmissionCode: "",
    originalClaimNumber: "",
    priorAuthNumber: "",
    serviceLines: [],
    federalTaxId: provider.taxId,
    patientAccountNumber: "",
    acceptAssignment: "Yes",
    totalCharge: 0,
    amountPaid: 0,
    balanceDue: 0,
    providerSignature: provider.signatureName,
    providerSignatureDate: today(),
    facilityName: provider.legalName,
    facilityAddress: `${provider.address}, ${provider.cityStateZip}`,
    facilityNpi: provider.facilityNpi,
    billingProviderName: provider.legalName,
    billingProviderAddress: `${provider.address}, ${provider.cityStateZip}`,
    billingProviderNpi: provider.npi,
    billingProviderTaxId: provider.taxId,
  };
}

/** Blank box-24 row. */
export function blankServiceLine(provider: ProviderProfile = MEDICAL_PROVIDER_PROFILE): ClaimServiceLine {
  return {
    dateOfService: today(),
    placeOfService: "11",
    cpt: "",
    modifiers: [],
    diagnosisPointer: "A",
    charge: 0,
    units: 1,
    renderingNpi: provider.npi,
  };
}

/**
 * Turn the Coder's per-line data into box-24 rows. When the Coder did not hand
 * over per-line data, fall back to the CPT list plus the fee-schedule charge.
 */
function buildServiceLines(pipeline: PipelineState, provider: ProviderProfile): ClaimServiceLine[] {
  if (pipeline.codingLines && pipeline.codingLines.length > 0) {
    return pipeline.codingLines.slice(0, 6).map((l) => ({ ...l }));
  }
  const codes = pipeline.cptCodes ?? [];
  return codes.slice(0, 6).map((code, i) => {
    const cpt = CPT_CODES.find((c) => c.code === code);
    return {
      dateOfService: today(),
      placeOfService: "11",
      cpt: code,
      modifiers: OFFICE_EM.has(code) ? ["25"] : [],
      diagnosisPointer: String.fromCharCode(65 + Math.min(i, 11)),
      charge: cpt?.medicareRate ?? 0,
      units: 1,
      renderingNpi: provider.npi,
    };
  });
}

export interface AutoFillArgs {
  patient?: Patient | null;
  displayName?: string | null;
  pipeline: PipelineState;
  /** Authorisation number captured by the Prior Auth stage, if any. */
  paNumber?: string;
  provider?: ProviderProfile;
  /** Claim type suggested from the encounter (POS / track). */
  claimType?: ClaimType;
}

/**
 * The identity boxes — 1, 1a, 2, 3, 4, 5, 6, 7, 11, 11a, 11c, 26 — from the
 * patient record. Split out so a claim that was opened before its patient was
 * known can have exactly these boxes filled in later, without touching the
 * codes, charges or edits the student already made.
 */
export function patientIdentityBoxes(
  patient: Patient | null | undefined,
  displayName?: string | null,
): Partial<ClaimFormData> {
  if (!patient && !displayName) return {};

  const name =
    displayName || (patient ? `${patient.lastName}, ${patient.firstName}` : "") || "";
  const insurance = (patient?.insurance ?? "").trim();
  const memberId = patient?.mrn ? `INS-${patient.mrn}` : "";
  const groupNumber = patient?.mrn
    ? `GRP-${patient.mrn.replace(/[^0-9]/g, "") || "0000"}`
    : "";

  return {
    insuranceType: insurance || "Group Health Plan",
    insuredId: memberId,
    patientName: name,
    patientDob: patient?.dateOfBirth ?? "",
    patientSex: patient?.gender ? patient.gender.charAt(0).toUpperCase() : "",
    insuredName: name,
    patientAddress: patient?.address ?? "",
    patientRelationship: "Self",
    insuredAddress: patient?.address ?? "",
    insuredPolicyGroup: groupNumber,
    insuredDob: patient?.dateOfBirth ?? "",
    insuredPlanName: insurance,
    patientAccountNumber: patient?.mrn ?? "",
  };
}

/** Build the claim record from the encounter. */
export function buildClaimForm({
  patient,
  displayName,
  pipeline,
  paNumber,
  provider = MEDICAL_PROVIDER_PROFILE,
  claimType = "professional",
}: AutoFillArgs): ClaimFormData {
  const base = blankClaimForm(provider);

  const serviceLines = buildServiceLines(pipeline, provider);
  const totalCharge = serviceLines.reduce((sum, l) => sum + (l.charge || 0), 0);

  return {
    ...base,
    claimType,
    ...patientIdentityBoxes(patient, displayName),
    diagnosisCodes: (pipeline.icdCodes ?? []).slice(0, 12),
    priorAuthNumber: paNumber ?? "",
    serviceLines,
    totalCharge,
    balanceDue: totalCharge,
  };
}

/**
 * Back-fill the structured record from the legacy `claimData` string map
 * (persistence schema migration v1 → v2). Only the boxes the old map could
 * hold are carried over; everything else keeps its blank default.
 */
export function migrateClaimData(map: Record<string, string> | undefined): ClaimFormData | null {
  if (!map || Object.keys(map).length === 0) return null;
  const base = blankClaimForm();
  const val = (k: string) => (map[k] ?? "").trim();
  const cptList = val("24")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  const charge = parseFloat(val("28")) || 0;
  const perLine = cptList.length > 0 ? charge / cptList.length : 0;

  return {
    ...base,
    insuranceType: val("1") || base.insuranceType,
    patientName: val("2"),
    patientDob: val("3"),
    patientAddress: val("5"),
    insuredName: val("4") || val("2"),
    insuredPolicyGroup: val("11"),
    insuredPlanName: val("11c"),
    currentIllnessDate: val("14") || base.currentIllnessDate,
    referringProvider: val("17"),
    referringNpi: val("17a"),
    diagnosisCodes: val("21")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean),
    resubmissionCode: val("22"),
    originalClaimNumber: val("22a"),
    priorAuthNumber: val("23"),
    serviceLines: cptList.map((cpt, i) => ({
      ...blankServiceLine(),
      cpt,
      diagnosisPointer: String.fromCharCode(65 + Math.min(i, 11)),
      charge: perLine,
    })),
    federalTaxId: val("25") || base.federalTaxId,
    totalCharge: charge,
    balanceDue: charge,
    facilityName: val("32") || base.facilityName,
    billingProviderName: val("33") || base.billingProviderName,
  };
}

// ─── Dental (ADA 2019) ─────────────────────────────────────────────

export interface ADAFillArgs {
  /** The dental case the student is working. */
  patient?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    gender?: string;
    phone?: string;
    address?: string;
    subscriberName?: string;
    relationshipToSubscriber?: string;
    memberId?: string;
  } | null;
  plan?: { payerName?: string; planName?: string; groupNumber?: string } | null;
  /** CDT lines the coding stage produced. */
  lines?: {
    code: string;
    tooth?: string;
    surfaces?: string;
    quadrant?: string;
    dateOfService: string;
    feeUsd: number;
    description?: string;
  }[];
  predeterminationNumber?: string;
  provider?: ProviderProfile;
}

/** Build the ADA claim record from the dental case and its CDT lines. */
export function buildADAForm({
  patient,
  plan,
  lines = [],
  predeterminationNumber = "",
  provider = DENTAL_PROVIDER_PROFILE,
}: ADAFillArgs): ADAFormData {
  const base = emptyADAForm();
  const todayIso = today();
  const adaLines: ADAServiceLine[] = lines.slice(0, 6).map((l) => ({
    dateOfService: l.dateOfService,
    cdt: l.code,
    description: l.description ?? "",
    tooth: l.tooth ?? "",
    surface: l.surfaces ?? "",
    quadrant: l.quadrant ?? "",
    fee: l.feeUsd,
    units: 1,
  }));
  const total = adaLines.reduce((sum, l) => sum + (l.fee || 0), 0);
  const relation = (patient?.relationshipToSubscriber ?? "self").replace(/^./, (c) => c.toUpperCase());
  const sex = patient?.gender ? patient.gender.charAt(0).toUpperCase() : "";
  const name = patient ? `${patient.lastName ?? ""}, ${patient.firstName ?? ""}`.replace(/^, /, "") : "";

  return {
    ...base,
    predeterminationNumber,
    insuredName: patient?.subscriberName ?? name,
    insuredAddress: patient?.address ?? "",
    insuredPhone: patient?.phone ?? "",
    insuredDob: patient?.dateOfBirth ?? "",
    insuredSex: sex,
    subscriberId: patient?.memberId ?? "",
    groupNumber: plan?.groupNumber ?? "",
    planName: plan ? `${plan.payerName ?? ""} ${plan.planName ?? ""}`.trim() : "",
    patientName: name,
    patientAddress: patient?.address ?? "",
    patientPhone: patient?.phone ?? "",
    patientDob: patient?.dateOfBirth ?? "",
    patientSex: sex,
    patientId: patient?.id ?? "",
    relationship: relation,
    dentistName: provider.legalName,
    dentistNpi: provider.npi,
    dentistAddress: `${provider.address}, ${provider.cityStateZip}`,
    dentistPhone: provider.phone,
    lines: adaLines,
    otherFees: 0,
    totalFee: total,
    amountPaid: 0,
    balanceDue: total,
    signatureDate: todayIso,
    patientSignature: false,
    dentistSignature: provider.signatureName,
  };
}

