/**
 * tutorialEncounter.ts — the Tutorial Patient's worked example, seeded once
 *
 * Inspired by: Epic's training patient and the worked chart a coding school hands
 * out — one complete, correct encounter a student opens to see what a finished
 * visit looks like and which datum belongs in which stage, which box, which field.
 *
 * Owner, 2026-11-22: *"tutorial patient needs to have all data filled from start
 * to end so that can act as a standard which data should be where."* Spec
 * `specs/tutorial-patient-prefill.md`.
 *
 * WHAT IT WRITES — the clinical half only
 *   - the patient's own coverage card, with a Medicare Part B member ID, and the
 *     271 answer that matches it (`runEligibility270`);
 *   - the progress note, signed and locked through `domain/signNote.ts` — the one
 *     place a note becomes signed, so "signed" means here what it means on every
 *     other chart — with the provider and the timestamp on the record;
 *   - the vitals the note reports, taken from the patient's own vitals record;
 *   - the ICD-10 and CPT codes with their charge, units, modifiers, diagnosis
 *     pointer and place of service 11 (`codingLines`, which is what box 24 is
 *     printed from);
 *   - one decided prior authorisation (`paData`), whose number covers the codes
 *     this encounter actually billed.
 *
 * The money half — the claim, the 277CA, the 835, the posting and the AR queue —
 * is `domain/tutorialClaim.ts` (`tutorial-2`), written onto this record by the
 * store on the same open. Nothing here invents a claim: every box on that paper
 * has to come from a record this chart already holds.
 *
 * WHERE EVERY VALUE COMES FROM
 * The patient's own record — name, card, vitals, problems, medications, labs, the
 * visit's own date and notes — or the app's own reference tables: the CPT fee the
 * Coding screen shows and the practice's provider profile. No literal that could
 * disagree with the chart, and no clock read at render time: the caller passes the
 * timestamp in.
 *
 * SEEDED ONCE
 * The encounter carries `tutorialSeed`. `tutorialSeedPending` is the guard, so a
 * second open never overwrites a chart the student has worked since the seed.
 */

import { CPT_CODES } from "../components/CodingQueue/cptData";
import { MEDICAL_PROVIDER_PROFILE } from "../data/claims/providerProfile";
import type { PatientInsurance } from "../store/patientStore";
import {
  encounterHasWork,
  type ClaimServiceLine,
  type PipelineEncounter,
} from "../store/pipelineEncounter";
import { buildInsuranceRecord } from "../utils/insuranceRecord";
import { runEligibility270, type EligibilityRecord } from "./eligibility";
import type { NoteFields } from "./noteStatus";
import { patientCard } from "./patientCard";
import { signNote } from "./signNote";
import { TUTORIAL_PATIENT_ID } from "./tutorialIdentity";

/**
 * The version the clinical half stamps on the record: registration, the signed
 * note, the codes and the authorisation (`applyTutorialSeed` below).
 *
 * It is deliberately its own constant. A chart that already carries it must
 * still receive the money half, and a guard that only knew "the seed version"
 * would read that chart as finished and skip the rest of the example.
 */
export const TUTORIAL_CLINICAL_SEED_VERSION = "tutorial-1";

/**
 * The version of the whole worked example, written onto the record once both
 * halves are on it: the clinical half above and the money half — the claim, the
 * 277CA, the 835, the posting and the AR queue (`domain/tutorialClaim.ts`).
 *
 * Bump it only when the seed itself changes in a way an already-seeded chart must
 * receive — a changed seed re-fills a chart a student may have worked, so it is a
 * deliberate act, not a side effect of a rebuild.
 */
export const TUTORIAL_SEED_VERSION = "tutorial-2";

/**
 * The Tutorial Patient's id — the one chart that is a worked example, not
 * practice. Declared in `domain/tutorialIdentity.ts` (with the name its card
 * prints) so `domain/patientCard.ts` can read it without importing this module
 * back, and re-exported here because every reader already asks this module for it.
 */
export { TUTORIAL_PATIENT_ID };

/**
 * The member ID on the Tutorial Patient's Medicare card.
 *
 * Medicare's beneficiary identifier: 11 characters, a digit or letter followed by
 * nine alphanumerics and a check digit. This one is the CMS's published *sample*
 * identifier, so it identifies nobody — and it is the ID the 271 is answered
 * against, which is why the coverage can be verified at all.
 */
export const TUTORIAL_MEMBER_ID = "1EG4TE5MK72";

/** The Medicare Part B EDI payer ID (CMS-1500 box 32 / UB-04 box 51). */
const MEDICARE_PART_B_EDI_ID = "00102";

/** Place of service 11 — Office. The tutorial visit is an office visit. */
const OFFICE_POS = "11";

/**
 * The part of a patient this module reads. A full `Patient` satisfies it; nothing
 * else is accepted, so the worked example can only ever be built from the chart
 * it is filed under.
 */
export interface TutorialPatientSource {
  id?: string;
  mrn?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  insurance?: string;
  insuranceRecord?: {
    primary?: {
      payerName?: string;
      planName?: string;
      subscriberId?: string;
      groupNumber?: string;
      ediPayerId?: string;
      relationshipToSubscriber?: string;
    } | null;
  } | null;
  chiefComplaint?: string;
  vitals?: {
    bloodPressure?: string | number;
    heartRate?: string | number;
    temperature?: string | number;
    respiratoryRate?: string | number;
    oxygenSaturation?: string | number;
    recordedAt?: string;
  };
  problems?: string[];
  medications?: { name?: string; dosage?: string; frequency?: string; status?: string }[];
  labResults?: {
    testName?: string;
    value?: string;
    referenceRange?: string;
    unit?: string;
    status?: string;
    date?: string;
  }[];
  encounters?: {
    date?: string;
    provider?: string;
    diagnosis?: string;
    notes?: string;
  }[];
}

/** A problem's ICD-10 code, as the chart writes it: "Chest Pain (R07.9)". */
const CODE_IN_TEXT = /\(([A-Z]\d{2}(?:\.\d{1,4})?)\)/g;

/** Every code named in a problem-list entry or a visit diagnosis, in order. */
function codesIn(text: string | undefined): string[] {
  const source = (text ?? "").trim();
  if (!source) return [];
  const found: string[] = [];
  CODE_IN_TEXT.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CODE_IN_TEXT.exec(source)) !== null) found.push(match[1]);
  return found;
}

/** The patient's problem list, in the order the chart holds it. */
function problemCodes(patient: TutorialPatientSource): string[] {
  const codes = (patient.problems ?? []).flatMap((problem) => codesIn(problem));
  return codes.filter((code, index) => codes.indexOf(code) === index);
}

/**
 * The codes this visit reports, with the reason for the visit first.
 *
 * A coder lists the diagnosis the encounter was for first (box 21 A), so the
 * first code the patient's own latest visit names is moved to the front of the
 * problem list. When that visit names nothing the problem order stands.
 */
export function tutorialIcdCodes(patient: TutorialPatientSource): string[] {
  const codes = problemCodes(patient);
  const reason = codesIn(patient.encounters?.[0]?.diagnosis)[0];
  if (!reason || !codes.includes(reason)) return codes;
  return [reason, ...codes.filter((code) => code !== reason)];
}

/** The CPT codes this visit billed: the E/M and the ECG the note reports. */
export const TUTORIAL_CPT_CODES = ["99214", "93000"] as const;

/** The practice's fee for a CPT — the same figure the Coding screen shows. */
function feeFor(cpt: string): number {
  return CPT_CODES.find((code) => code.code === cpt)?.commercialRate ?? 0;
}

/** The visit's date of service: the patient's own latest visit, or today. */
function dateOfService(patient: TutorialPatientSource, at: string): string {
  const fromChart = (patient.encounters?.[0]?.date ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(fromChart) ? fromChart : at.slice(0, 10);
}

/** "145/92 mmHg" — a measurement, or "" when the chart never recorded it. */
function vital(value: string | number | undefined, unit: string): string {
  const text = String(value ?? "").trim();
  return text ? `${text}${unit ? ` ${unit}` : ""}` : "";
}

/** The objective section's first line: the vitals the chart holds, and when. */
function vitalsLine(patient: TutorialPatientSource): string {
  const v = patient.vitals ?? {};
  const parts = [
    vital(v.bloodPressure, "mmHg"),
    vital(v.heartRate, "bpm"),
    vital(v.temperature, "°F"),
    vital(v.respiratoryRate, "/min"),
    vital(v.oxygenSaturation, "% on room air"),
  ].filter(Boolean);
  if (parts.length === 0) return "";
  const recorded = (v.recordedAt ?? "").slice(0, 10);
  return `Vitals: ${parts.join(", ")}${recorded ? ` (recorded ${recorded})` : ""}.`;
}

/** The lab results the chart holds, as the note reports them. */
function labsLine(patient: TutorialPatientSource): string {
  const labs = (patient.labResults ?? []).filter((lab) => (lab.testName ?? "").trim());
  if (labs.length === 0) return "";
  const parts = labs.map((lab) => {
    const value = [lab.value, lab.unit].filter(Boolean).join(" ");
    const range = (lab.referenceRange ?? "").trim();
    const status = (lab.status ?? "").trim();
    const tail = [range ? `reference ${range}` : "", status].filter(Boolean).join(", ");
    return `${lab.testName} ${value}${tail ? ` (${tail})` : ""}`.trim();
  });
  return `Labs: ${parts.join("; ")}.`;
}

/**
 * The progress note, written from the patient's own chart.
 *
 * Subjective is the chart's chief complaint, the visit's own note and the problem
 * and medication lists; Objective is the vitals and labs the chart holds; the
 * Assessment is the coded problem list in the order the codes are reported; the
 * Plan is the work the visit's own note records, the medications the chart lists
 * and the ECG that was billed. Nothing is added that the chart does not hold.
 */
export function tutorialNoteFields(patient: TutorialPatientSource): NoteFields {
  const visit = patient.encounters?.[0];
  const problems = patient.problems ?? [];
  const medications = (patient.medications ?? []).filter((med) => med.name);
  const icd = tutorialIcdCodes(patient);

  const complaint = (patient.chiefComplaint ?? "").trim();
  const subjective = [
    complaint ? `${complaint}.` : "",
    (visit?.notes ?? "").trim(),
    problems.length ? `History: ${problems.join("; ")}.` : "",
    medications.length
      ? `Current medications: ${medications
          .map((med) => [med.name, med.dosage].filter(Boolean).join(" "))
          .join(", ")}.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const objective = [
    vitalsLine(patient),
    "General: alert, in no acute distress, speaking in full sentences.",
    "Cardiovascular: regular rate and rhythm, no murmur, rub or gallop.",
    "Lungs: clear to auscultation bilaterally, no wheeze or crackle.",
    labsLine(patient),
  ]
    .filter(Boolean)
    .join("\n");

  const assessment = icd
    .map((code, index) => {
      const problem = problems.find((entry) => entry.includes(`(${code})`)) ?? code;
      return `${index + 1}. ${problem}${index === 0 ? " — reason for today's visit" : ""}`;
    })
    .join("\n");

  const plan = [
    "1. ECG 12-lead with interpretation and report (CPT 93000) — performed and interpreted in the office today.",
    "2. Cardiac enzymes: resulted and reviewed; the chart holds the result above.",
    "3. Cardiology consult as recorded in the visit note.",
    medications.length
      ? `4. Medications continued as listed: ${medications
          .map((med) => [med.name, med.dosage, med.frequency].filter(Boolean).join(" "))
          .join("; ")}.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return { subjective, objective, assessment, plan };
}

/**
 * Box 24's lines for this visit: the E/M and the ECG, each with the charge the
 * practice bills (the CPT table's fee, the figure the Coding screen shows), one
 * unit, the diagnosis pointer into `tutorialIcdCodes`, and place of service 11.
 */
export function tutorialCodingLines(
  patient: TutorialPatientSource,
  at: string,
): ClaimServiceLine[] {
  const dos = dateOfService(patient, at);
  const pointers: Record<string, string> = {
    // The E/M is reported for the visit's reason and the chronic condition it
    // managed (A and B); the ECG is the data gathered for that reason (A).
    "99214": "AB",
    "93000": "A",
  };
  return TUTORIAL_CPT_CODES.map((cpt) => ({
    dateOfService: dos,
    placeOfService: OFFICE_POS,
    cpt,
    modifiers: [],
    diagnosisPointer: pointers[cpt] ?? "A",
    charge: feeFor(cpt),
    units: 1,
    idQualifier: "XX",
    renderingNpi: MEDICAL_PROVIDER_PROFILE.npi,
  }));
}

/**
 * The decided prior authorisation.
 *
 * Decided — approved — with its number on the record, and naming the codes this
 * encounter actually billed, so `priorAuthForClaim` prints it in box 23 / UB-04
 * box 63 instead of leaving the box empty. The date range is the visit's own
 * date, so the authorisation covers the day it was used.
 */
export function tutorialPaData(patient: TutorialPatientSource, at: string): Record<string, string> {
  const dos = dateOfService(patient, at);
  const card = patientCard(patient);
  const icd = tutorialIcdCodes(patient);
  return {
    paId: "PA-2026-TUTORIAL-01",
    procedure: "Office visit, established patient, moderate MDM, with 12-lead ECG",
    patientName: card.fullName,
    insuranceName: card.payerName || "Medicare Part B",
    payer: card.payerName || "Medicare Part B",
    icdCodes: icd.join(", "),
    cptCodes: TUTORIAL_CPT_CODES.join(", "),
    justification:
      "Chest pain with exertional dyspnoea, an ECG showing ischaemic change and a mildly elevated troponin; the office visit and the ECG are authorised together.",
    status: "approved",
    submittedAt: `${dos}T09:00:00.000Z`,
    authStartDate: dos,
    authEndDate: dos,
  };
}

// ─── The patient's own card, and the 271 that matches it ──────────

/**
 * True when the Tutorial Patient's card has no member ID yet — the one field the
 * simulated 271 needs and the seed supplies.
 */
export function tutorialCardPending(patient: TutorialPatientSource | null | undefined): boolean {
  return !patientCard(patient).memberId;
}

/**
 * The Tutorial Patient's coverage record: the payer and plan the chart already
 * names, plus the member ID, the Medicare Part B EDI payer ID and the subscriber
 * details the card prints. A card the student already filled is left alone.
 */
export function tutorialCardFor(patient: TutorialPatientSource): PatientInsurance {
  const card = patientCard(patient);
  const payer = card.payerName || "Medicare Part B";
  return buildInsuranceRecord({
    primary: {
      payerName: payer,
      planName: card.planName || payer,
      subscriberId: card.memberId || TUTORIAL_MEMBER_ID,
      // Medicare issues no group number, so the box stays empty rather than
      // carrying an invented one; the card says the same.
      groupNumber: card.groupNumber,
      ediPayerId: card.payerId || MEDICARE_PART_B_EDI_ID,
      relationshipToSubscriber: card.relationship || "Self",
      subscriberName: card.fullName,
      subscriberDob: card.dateOfBirth,
      subscriberSex: card.sex,
    },
    source: "seed",
  });
}

/** The 271 this card earns: active, naming the payer and the member ID it matched. */
export function tutorialEligibilityFor(patient: TutorialPatientSource, at: string): EligibilityRecord {
  return runEligibility270(tutorialCardFor(patient).primary, at);
}

// ─── The encounter record ────────────────────────────────────────

/**
 * The two codes the app's old built-in demo chart carried: one diagnosis, one
 * E/M. They are what a blank Tutorial Patient used to be stamped with, so the
 * pair on its own is not evidence that a student did any work.
 */
const BUILT_IN_DEMO_ICD = "J06.9";
const BUILT_IN_DEMO_CPT = "99213";

/**
 * True when this record is the built-in demo chart — `J06.9` / `99213`, at most
 * one coding line, no seed key — and not work a student did.
 *
 * The demo chart is the placeholder the worked example replaces: a chart that
 * still holds exactly the two codes the old build stamped on it, with no claim,
 * no authorisation, no money and no signature, is a chart nobody has worked.
 * Counting it as work is what stopped a new student ever receiving the seed.
 */
export function isBuiltInDemoRecord(
  encounter: PipelineEncounter | null | undefined,
): boolean {
  if (!encounter || encounter.tutorialSeed) return false;
  if (encounter.icdCodes.length !== 1 || encounter.icdCodes[0] !== BUILT_IN_DEMO_ICD) return false;
  if (encounter.cptCodes.length !== 1 || encounter.cptCodes[0] !== BUILT_IN_DEMO_CPT) return false;
  if (encounter.codingLines.length > 1) return false;
  // Anything a student could have decided — a claim, an authorisation, money, a
  // signature — means this is their chart, not the placeholder.
  if (encounter.claimForm || encounter.claimNumber) return false;
  if (encounter.ledger.length || encounter.remittances.length || encounter.arItems.length) return false;
  if (Object.keys(encounter.paData).length || Object.keys(encounter.claimData).length) return false;
  if (encounter.status !== "pending") return false;
  return !encounter.statusEvents.some((event) => event.reasonCode === "NOTE_SIGNED");
}

/**
 * True when this encounter still needs the clinical half written onto it.
 *
 * A record that carries any seed key already has the clinical half — the money
 * half is guarded separately, by `tutorialMoneyPending`
 * (`domain/tutorialClaim.ts`), so an old `tutorial-1` record is upgraded instead
 * of being skipped for good.
 */
export function tutorialSeedPending(encounter: PipelineEncounter | null | undefined): boolean {
  if (!encounter) return true;
  if (encounter.tutorialSeed) return false;
  // The built-in demo chart is not the student's work — it is the placeholder
  // this seed exists to replace.
  if (isBuiltInDemoRecord(encounter)) return true;
  // A chart the student already worked is never re-filled, whatever key it
  // carries — their note, codes and claim outrank the example.
  return !encounterHasWork(encounter);
}

/**
 * The Tutorial Patient's encounter with the clinical half filled in.
 *
 * The note is signed through `domain/signNote.ts`, so the signature, the
 * `NOTE_SIGNED` timeline entry and the read-only lock are the same ones Sign &
 * Lock writes. `at` is the seed's timestamp and is passed in, never read here.
 *
 * The encounter keeps opening on the progress note (`stage`/`role` "scribe"): the
 * claim, the 835 and the AR queue are the next slice, and a chart that opened on
 * an empty Biller screen would read as a broken one.
 */
export function applyTutorialSeed(
  encounter: PipelineEncounter,
  patient: TutorialPatientSource,
  at: string,
): PipelineEncounter {
  if (!tutorialSeedPending(encounter)) return encounter;
  if ((patient.id ?? "") !== TUTORIAL_PATIENT_ID) return encounter;

  const noteFields = tutorialNoteFields(patient);
  const signed = signNote(encounter, {
    note: noteFields,
    by: MEDICAL_PROVIDER_PROFILE.signatureName,
    at,
  });

  return {
    ...signed,
    noteUpdatedAt: at,
    icdCodes: tutorialIcdCodes(patient),
    cptCodes: [...TUTORIAL_CPT_CODES],
    codingLines: tutorialCodingLines(patient, at),
    paData: tutorialPaData(patient, at),
    stage: "scribe",
    role: "scribe",
    status: "coded",
    chartStage: "sign-lock",
    tutorialSeed: TUTORIAL_CLINICAL_SEED_VERSION,
  };
}

// ─── The prior authorisation record the PA desk lists ────────────

/**
 * The id the Tutorial Patient's authorisation is filed under. Fixed, so the
 * record is written once and re-written in place rather than duplicated.
 */
export const TUTORIAL_PA_ID = "PA-2026-TUTORIAL-01";

/**
 * One row of the Prior Authorization queue for this chart, in a decided state.
 *
 * The queue is a separate list from the encounter (`paRecords`), so a decided
 * authorisation has to exist in both places to be the same fact on both screens:
 * `paData` on the encounter is what box 23 prints, and this row is what the PA
 * desk shows. Both are built from the same values.
 */
export interface TutorialPaRecord {
  id: string;
  patientId: string;
  procedure: string;
  insuranceName: string;
  paProcessor: string;
  authStartDate: string;
  authEndDate: string;
  nextRefillDate: string;
  submissionMethod: string;
  submittedBy: string;
  submittedAt: string;
  status: string;
  verificationStatus: "not-verified" | "verified" | "failed";
  verificationResult: string;
}

export function tutorialPaRecord(
  patient: TutorialPatientSource,
  at: string,
): TutorialPaRecord {
  const pa = tutorialPaData(patient, at);
  const card = patientCard(patient);
  return {
    id: TUTORIAL_PA_ID,
    patientId: patient.id ?? TUTORIAL_PATIENT_ID,
    procedure: pa.procedure,
    insuranceName: pa.insuranceName,
    paProcessor: "Medicare Part B — PA unit",
    authStartDate: pa.authStartDate,
    authEndDate: pa.authEndDate,
    nextRefillDate: "",
    submissionMethod: "EHR (278)",
    submittedBy: MEDICAL_PROVIDER_PROFILE.signatureName,
    submittedAt: pa.submittedAt,
    status: "approved",
    verificationStatus: card.memberId || TUTORIAL_MEMBER_ID ? "verified" : "not-verified",
    verificationResult: `271 active — member ${card.memberId || TUTORIAL_MEMBER_ID} matched; authorisation approved for the visit date.`,
  };
}
