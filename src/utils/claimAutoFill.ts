/**
 * Claim auto-fill — builds the CMS-1500 record from what earlier stages
 * already captured, so the Biller opens a claim and finds the paper filled in.
 *
 * Sources, box by box:
 *   2, 3, 5, 26  patient demographics (patientStore)
 *   1a, 4, 6, 7, 11, 11a, 11c  the patient's insurance record (`insuranceRecord`)
 *   1, 9, 9a–9d                the payer on that record, plus any secondary plan
 *   payerName, payerEdiId       the payer name and EDI payer ID — what the UB-04
 *                               prints in boxes 50 and 51, carried on the claim
 *                               so the institutional paper has a real source
 *   21           the Coder stage's final ICD-10 list (in priority order)
 *   23           the Prior Authorization stage's auth number
 *   24A–24J      the Coder's per-line data (date, POS, CPT, modifiers, pointer,
 *                charge, units), falling back to the CPT fee schedule and the
 *                encounter's date of service — but never to a modifier
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
 * Modifiers (box 24D) are one of those boxes, and the reason is teaching rather
 * than tidiness. The fallback path used to stamp `25` on every office E/M line,
 * so a claim the Coder left incomplete reached the Biller already carrying
 * modifier 25 — the decision the student is here to make, made for them. The
 * modifier is not a property of the code: it asserts that a significant,
 * separately identifiable E/M was paid alongside a procedure on the same day,
 * and it is defensible only if the note supports it. So modifiers are copied
 * from the Coder's per-line data and from nowhere else; a line the Coder did not
 * modify arrives with 24D empty and the student decides. The fee-schedule charge
 * and the POS 11 on that same fallback line stay, because they are the
 * practice's own reference values rather than a judgement about the encounter.
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
    otherInsuredPolicyGroup: "",
    otherInsuredDob: "",
    otherInsuredSex: "",
    conditionEmployment: false,
    conditionAuto: false,
    conditionOther: false,
    claimCodes: "",
    insuredPolicyGroup: "",
    insuredDob: "",
    insuredSex: "",
    insuredEmployer: "",
    otherClaimId: "",
    insuredPlanName: "",
    otherBenefitPlan: "No",
    patientStatusSingle: false,
    patientStatusMarried: false,
    patientStatusEmployed: false,
    patientStatusFullTimeStudent: false,
    patientStatusPartTimeStudent: false,
    payerName: "",
    payerEdiId: "",
    patientSignature: true,
    insuredSignature: false,
    currentIllnessDate: today(),
    similarIllnessQualifier: "",
    similarIllnessDate: "",
    unableToWorkFrom: "",
    unableToWorkTo: "",
    referringProvider: "",
    referringOtherId: "",
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
    federalTaxIdType: provider.taxIdType,
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
    // 24J is an NPI on every path this app builds, so 24I is XX by default.
    idQualifier: "XX",
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
    // A Coder line arrives without 24I, because the qualifier is not the
    // Coder's decision: 24J is an NPI on every path, so 24I is XX.
    return pipeline.codingLines
      .slice(0, 6)
      .map((l) => ({ ...l, idQualifier: l.idQualifier || "XX" }));
  }
  const codes = pipeline.cptCodes ?? [];
  return codes.slice(0, 6).map((code, i) => {
    const cpt = CPT_CODES.find((c) => c.code === code);
    return {
      dateOfService: encounterDate,
      placeOfService: "11",
      cpt: code,
      modifiers: [],
      diagnosisPointer: String.fromCharCode(65 + Math.min(i, 11)),
      charge: cpt?.medicareRate ?? 0,
      units: 1,
      idQualifier: "XX",
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
    // Box 11a's SEX sits beside the insured's date of birth. For Self it is the
    // patient's own sex; for a dependant it stays blank until the subscriber's
    // sex is captured on the coverage record — registration captures the
    // patient's, not the subscriber's, so nothing is invented here.
    insuredSex: isSelf
      ? patient?.gender
        ? patient.gender.charAt(0).toUpperCase()
        : ""
      : coverage?.subscriberSex?.trim().charAt(0).toUpperCase() ?? "",
    insuredPlanName: coverage?.planName?.trim() || payerName,
    // Boxes 50 / 51 on the UB-04 — carried on the claim so the institutional
    // paper reads the payer from the same record the CMS-1500 uses.
    payerName,
    payerEdiId: coverage?.ediPayerId?.trim() ?? "",
    // Boxes 9 / 9a / 9b / 9d — other coverage, when registration captured any.
    // 9d is the plan name only; the group number has its own box (9a) now.
    otherInsuranceName: secondary?.payerName?.trim() ?? "",
    otherInsurancePlan: secondary?.planName?.trim() ?? "",
    otherInsuredPolicyGroup: secondary?.groupNumber?.trim() ?? "",
    otherInsuredDob: secondary?.subscriberDob?.trim() ?? "",
    otherInsuredSex: secondary?.subscriberSex?.trim().charAt(0).toUpperCase() ?? "",
    otherBenefitPlan: secondary ? "Yes" : "No",
    patientAccountNumber: patient?.mrn ?? "",
  };
}

/**
 * A stable fingerprint of everything the identity boxes are seeded from: which
 * patient this is, their demographics, and their insurance record.
 *
 * The claim stores this so seeding can be re-evaluated per patient instead of
 * frozen by a one-shot `identitySeeded` flag. A patient the student registers
 * themselves starts with no insurance record and may gain an address later, so
 * the fingerprint has to cover the demographics too, not just the patient id.
 */
export function identitySeedFor(
  patient: Patient | null | undefined,
  displayName?: string | null,
): string {
  if (!patient && !displayName) return "";
  return JSON.stringify({
    id: patient?.id ?? "",
    name: patient
      ? `${patient.lastName}, ${patient.firstName}`
      : displayName ?? "",
    dob: patient?.dateOfBirth ?? "",
    sex: patient?.gender ?? "",
    address: patient?.address ?? "",
    insurance: patient?.insurance ?? "",
    coverage: patient?.insuranceRecord ?? null,
  });
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
 * Re-seed the identity boxes when the claim's patient fingerprint changed.
 *
 * This replaces the one-shot `identitySeeded` gate: the fingerprint
 * (`identitySeedFor`) covers the patient id, demographics and insurance record,
 * so a claim opened before the student registered their own patient — or before
 * that patient's insurance was captured — fills in as soon as the record exists,
 * and a claim that belongs to a different patient re-seeds onto the right one.
 *
 * A box is only written when it is blank or still holds the value this claim
 * last seeded it with. Anything else was typed by the student and is left
 * exactly as they typed it.
 */
export function reseedIdentityBoxes(
  form: ClaimFormData,
  patient: Patient | null | undefined,
  displayName?: string | null,
): Partial<ClaimFormData> {
  const key = identitySeedFor(patient, displayName);
  if (!key) return {};                       // nothing known yet — try again later
  if (form.identitySeedKey === key) return {};

  const known = patientIdentityBoxes(patient, displayName) as Record<string, unknown>;
  const seededBefore = (form.identitySeedValues ?? {}) as Record<string, unknown>;
  const values: Record<string, string> = { ...(form.identitySeedValues ?? {}) };
  const patch: Partial<ClaimFormData> = {};

  for (const [box, value] of Object.entries(known)) {
    if (typeof value !== "string" || value === "") continue;
    const current = (form as unknown as Record<string, unknown>)[box];
    const untouched =
      isBlank(current) || (box in seededBefore && current === seededBefore[box]);
    if (!untouched) continue;                // the student typed this box
    (patch as Record<string, unknown>)[box] = value;
    values[box] = value;
  }

  patch.identitySeedKey = key;
  patch.identitySeedValues = values;
  patch.identitySeeded = true;
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
  const identityBoxes = patientIdentityBoxes(patient, displayName);
  const seedKey = identitySeedFor(patient, displayName);

  return {
    ...base,
    claimType,
    identitySeeded: Boolean(patient || displayName),
    identitySeedKey: seedKey,
    identitySeedValues: Object.fromEntries(
      Object.entries(identityBoxes).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== "",
      ),
    ),
    ...identityBoxes,
    diagnosisCodes: (pipeline.icdCodes ?? []).slice(0, 12),
    priorAuthNumber: paNumber ?? "",
    serviceLines,
    totalCharge,
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
    // The NPI is box 17b. The legacy map's "17a" key held the referring NPI
    // (the old block list mislabelled 17a), so it is read second — the value is
    // carried forward rather than dropped, and new records use the real box.
    referringNpi: val("17b") || val("17a"),
    // Box 11b is OTHER CLAIM ID. The old map's "11b" key held the employer, which
    // the 02/12 prints in 9c — so an old employer value lands there, verbatim.
    insuredEmployer: val("9c") || val("11b"),
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
    // No balanceDue: box 30 is reserved on the 02/12 and prints no money.
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

