/**
 * Claim auto-fill — builds the CMS-1500 record from what earlier stages
 * already captured, so the Biller opens a claim and finds the paper filled in.
 *
 * Sources, box by box:
 *   2, 3, 5, 26  patient demographics (patientStore)
 *   1a, 4, 6, 7, 11, 11a, 11c  the patient's insurance record (`insuranceRecord`)
 *   1, 9, 9a, 11d               the payer on that record, plus any secondary plan
 *   payerName, payerEdiId       the payer name and EDI payer ID — what the UB-04
 *                               prints in boxes 50 and 51, carried on the claim
 *                               so the institutional paper has a real source
 *   21           the Coder stage's final ICD-10 list (in priority order)
 *   23           the Prior Authorization stage's auth number
 *   24A–24J      the Coder's per-line data (date, POS, CPT, modifiers, pointer,
 *                charge, units), falling back to the CPT fee schedule and the
 *                encounter's date of service
 *   25, 31, 32, 33  the demo provider profile
 *
 * The insured blocks (1a, 4, 6, 7, 11, 11a–11d) are read from the insurance
 * record Registration & eligibility writes when the student verifies the card.
 * When the patient is a dependent, the record carries the subscriber's own name
 * and date of birth, so box 4 is the subscriber rather than the patient.
 *
 * Nothing here is invented. A box with no upstream source is left blank and is
 * filled at render time from the tagged demo values in
 * `data/claims/demoClaimData.ts`, via the rule in `utils/demoClaimFill.ts` — a
 * demo value that is grey italic, tagged, counted separately and never written
 * back onto the claim.
 *
 * Inspiration: the "claim pre-population" a practice-management system does
 * when the biller opens a coded encounter — Epic Resolute and DrChrono both
 * carry the encounter's codes, demographics and coverage onto the form.
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
    identitySeeded: false,
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
    payerName: "",
    payerEdiId: "",
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

/** Blank box-24 row. The date of service is never filled in for the student. */
export function blankServiceLine(
  provider: ProviderProfile = MEDICAL_PROVIDER_PROFILE,
  dateOfService = "",
): ClaimServiceLine {
  return {
    dateOfService,
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
 *
 * The date of service comes from the encounter. It used to be `today()`, which
 * printed a date nobody had captured — the last of the three invented values the
 * code audit found. With no encounter date either, the row is left blank and the
 * line renders the tagged demo date, so nothing on the paper claims a date that
 * is not in the record.
 */
function buildServiceLines(
  pipeline: PipelineState,
  provider: ProviderProfile,
  encounterDate: string,
): ClaimServiceLine[] {
  if (pipeline.codingLines && pipeline.codingLines.length > 0) {
    return pipeline.codingLines.slice(0, 6).map((l) => ({ ...l }));
  }
  const codes = pipeline.cptCodes ?? [];
  return codes.slice(0, 6).map((code, i) => {
    const cpt = CPT_CODES.find((c) => c.code === code);
    return {
      dateOfService: encounterDate,
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
  /** Date of service the encounter was registered at (box 24A fallback). */
  encounterDate?: string | null;
}

/**
 * Box 1's coverage type, read from the payer name. Box 1 is a coded choice
 * (MEDICARE / MEDICAID / …), so a payer label cannot be printed in it directly.
 */
function coverageTypeFor(payerName: string): string {
  const payer = payerName.toLowerCase();
  if (!payer.trim()) return "";
  if (payer.includes("medicare")) return "Medicare";
  if (payer.includes("medicaid")) return "Medicaid";
  if (payer.includes("tricare")) return "TRICARE";
  if (payer.includes("champva")) return "CHAMPVA";
  if (payer.includes("feca") || payer.includes("black lung")) return "FECA Black Lung";
  return "Group Health Plan";
}

/** The encounter's date of service, falling back to the patient's latest visit. */
function encounterDateFor(
  patient: Patient | null | undefined,
  explicit?: string | null,
): string {
  if (explicit) return explicit;
  const encounters = patient?.encounters ?? [];
  if (encounters.length === 0) return "";
  const dated = encounters
    .map((e) => e.date)
    .filter((d) => Boolean(d))
    .sort();
  return dated[dated.length - 1] ?? "";
}

/**
 * The identity boxes — 1, 1a, 2, 3, 4, 5, 6, 7, 9, 9a, 11, 11a, 11c, 11d, 26 —
 * from the patient record and its insurance record. Split out so a claim that
 * was opened before its patient was known can have exactly these boxes filled
 * in later, without touching the codes, charges or edits the student already
 * made.
 */
export function patientIdentityBoxes(
  patient: Patient | null | undefined,
  displayName?: string | null,
): Partial<ClaimFormData> {
  if (!patient && !displayName) return {};

  const name =
    displayName || (patient ? `${patient.lastName}, ${patient.firstName}` : "") || "";
  const insurance = (patient?.insurance ?? "").trim();

  // The coverage Registration & eligibility captured. A build before 2026-11-20
  // printed `INS-<mrn>` in box 1a and `GRP-<mrn digits>` in box 11 — invented
  // values that read as real member and group numbers, which is how a student
  // learns to invent one. Now every identifier comes from the record, and an
  // identifier the student never captured stays blank so the box falls through
  // to the tagged demo value in `demoClaimData.ts`.
  const coverage = patient?.insuranceRecord?.primary;
  const secondary = patient?.insuranceRecord?.secondary ?? null;
  const payerName = coverage?.payerName?.trim() || insurance;
  const relationship = coverage?.relationshipToSubscriber?.trim() || "Self";
  const isSelf = relationship.toLowerCase() === "self";

  return {
    insuranceType: coverageTypeFor(payerName) || "Group Health Plan",
    insuredId: coverage?.subscriberId?.trim() ?? "",
    patientName: name,
    patientDob: patient?.dateOfBirth ?? "",
    patientSex: patient?.gender ? patient.gender.charAt(0).toUpperCase() : "",
    // Box 4 is the INSURED, who is only the patient when the relationship is Self.
    insuredName: coverage?.subscriberName?.trim() || (isSelf ? name : ""),
    patientAddress: patient?.address ?? "",
    patientRelationship: relationship,
    insuredAddress: patient?.address ?? "",
    insuredPolicyGroup: coverage?.groupNumber?.trim() ?? "",
    insuredDob: coverage?.subscriberDob?.trim() || (isSelf ? patient?.dateOfBirth ?? "" : ""),
    insuredPlanName: coverage?.planName?.trim() || payerName,
    // Boxes 50 / 51 on the UB-04 — carried on the claim so the institutional
    // paper reads the payer from the same record the CMS-1500 uses.
    payerName,
    payerEdiId: coverage?.ediPayerId?.trim() ?? "",
    // Boxes 9 / 9a / 11d — other coverage, when registration captured any.
    otherInsuranceName: secondary?.payerName?.trim() ?? "",
    otherInsurancePlan: [secondary?.planName?.trim(), secondary?.groupNumber?.trim()]
      .filter(Boolean)
      .join(" · "),
    otherBenefitPlan: secondary ? "Yes" : "No",
    patientAccountNumber: patient?.mrn ?? "",
  };
}

const isBlank = (value: unknown): boolean =>
  value === undefined || value === null || (typeof value === "string" && value.trim() === "");

/** Values an earlier build invented from the MRN — never a real member or group ID. */
const FABRICATED_ID = /^(INS-|GRP-)/i;

/**
 * Clear the fabricated `INS-<mrn>` / `GRP-<mrn digits>` values a claim persisted
 * by an earlier build still carries, so the boxes fall through to the tagged
 * demo values instead of showing an invented ID as captured data.
 */
export function stripFabricatedIds(form: ClaimFormData): Partial<ClaimFormData> {
  const patch: Partial<ClaimFormData> = {};
  if (FABRICATED_ID.test(form.insuredId ?? "")) patch.insuredId = "";
  if (FABRICATED_ID.test(form.insuredPolicyGroup ?? "")) patch.insuredPolicyGroup = "";
  return patch;
}

/**
 * The identity boxes a claim is still missing, taken from the patient.
 *
 * A claim persisted by an earlier build was written before the encounter's
 * patient was known, so boxes 1a, 2, 3 (and 4, 5, 6, 7, 26) arrive empty. This
 * returns only the boxes that are blank on the claim, so nothing the student
 * typed is overwritten, plus the `identitySeeded` marker so the same claim is
 * not re-seeded on every render.
 */
export function backfillIdentityBoxes(
  form: ClaimFormData,
  patient: Patient | null | undefined,
  displayName?: string | null,
): Partial<ClaimFormData> {
  const known = patientIdentityBoxes(patient, displayName);
  const patch: Partial<ClaimFormData> = {};
  for (const [key, value] of Object.entries(known)) {
    if (value === undefined || value === null || value === "") continue;
    if (isBlank((form as unknown as Record<string, unknown>)[key])) {
      (patch as Record<string, unknown>)[key] = value;
    }
  }
  // Only mark the claim as seeded when there was a patient to seed it from —
  // otherwise the next open (with the encounter finally resolved) must try again.
  if (patient || displayName) patch.identitySeeded = true;
  return patch;
}

/**
 * The `identitySeed` marker for a claim: the values a seed from this patient
 * writes, plus a signature of them. Undefined when there is no patient (and no
 * display name) to seed from — the claim must try again later.
 */
export function identitySeedFor(
  patient: Patient | null | undefined,
  displayName?: string | null,
): ClaimFormData["identitySeed"] {
  if (!patient && !displayName) return undefined;
  const known = patientIdentityBoxes(patient, displayName) as Record<string, unknown>;
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(known)) {
    if (typeof value === "string" && value !== "") values[key] = value;
  }
  return { signature: JSON.stringify(values), values };
}

/**
 * Re-seed the identity boxes from the patient the encounter now resolves.
 *
 * `identitySeeded` used to be a one-shot marker: a claim opened while the chart
 * had no patient (the student's own registered patient, a restored session, the
 * Coder's "Skip to Billing") was stamped as seeded and never looked again, so
 * boxes 1a–7 stayed blank or kept another patient's values even after the chart
 * knew who it was working on.
 *
 * This compares the patient's identity boxes with what the last seed wrote
 * (`identitySeed`):
 *   - blank box            → filled from the patient;
 *   - box still holding the seeded value → follows the patient when its
 *     demographics or insurance change;
 *   - box the student typed (a value that is neither) → left untouched.
 *
 * Returns `null` when the claim already matches this patient, so the caller can
 * call it on every render without looping.
 */
export function reseedIdentityBoxes(
  form: ClaimFormData,
  patient: Patient | null | undefined,
  displayName?: string | null,
): Partial<ClaimFormData> | null {
  const seed = identitySeedFor(patient, displayName);
  if (!seed) return null;
  const { signature, values } = seed;
  if (form.identitySeed?.signature === signature && form.identitySeeded) return null;

  const previous = form.identitySeed?.values ?? {};
  const patch: Partial<ClaimFormData> = {};
  for (const [key, value] of Object.entries(values)) {
    const current = (form as unknown as Record<string, unknown>)[key];
    const wasSeeded = previous[key] !== undefined && current === previous[key];
    if (isBlank(current) || wasSeeded) {
      (patch as Record<string, unknown>)[key] = value;
    }
  }
  patch.identitySeeded = true;
  patch.identitySeed = seed;
  return patch;
}

/** Build the claim record from the encounter. */
export function buildClaimForm({
  patient,
  displayName,
  pipeline,
  paNumber,
  provider = MEDICAL_PROVIDER_PROFILE,
  claimType = "professional",
  encounterDate,
}: AutoFillArgs): ClaimFormData {
  const base = blankClaimForm(provider);

  const serviceLines = buildServiceLines(
    pipeline,
    provider,
    encounterDateFor(patient, encounterDate),
  );
  const totalCharge = serviceLines.reduce((sum, l) => sum + (l.charge || 0), 0);

  return {
    ...base,
    claimType,
    identitySeeded: Boolean(patient || displayName),
    identitySeed: identitySeedFor(patient, displayName),
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

