/**
 * tutorialEncounter.ts — the Tutorial Patient's pre-made encounter, filled start to end
 *
 * Inspired by: the demo patient every EHR trainer ships (Epic's "Playground"
 * patient, athenahealth's sandbox chart) — one chart a student can open and read
 * from the front desk to the remittance before working a visit of their own.
 *
 * Owner report, 2026-11-22: *"when i click on tutorial patient it doesn't open
 * pre made encounter — in that encounter from start till end all information
 * should be pre filled."* Spec `specs/tutorial-patient-prefill.md`.
 *
 * WHY ONE PURE BUILDER
 * The encounter it produces has to be the same record the working screens write:
 * a note signed by `domain/signNote.ts`, a claim built by `utils/claimAutoFill.ts`,
 * a 277CA from `domain/clearinghouse.ts`, an 835 from `domain/adjudication.ts`
 * and ledger entries from `domain/ledger.ts`. Seeding it by calling each screen's
 * writer in turn would need a driver across renders and could half-seed; calling
 * the same pure modules here produces one record in one write, and every figure
 * on it is traceable to the module that computed it.
 *
 * WHAT IT INVENTS — AND WHAT IT DOES NOT
 * The patient, the payer, the note, the codes and the charges are the tutorial's
 * own fictional teaching data (`src/data/medical`, `store/patientStore.tsx`), and
 * the note text is the same note the workspace has always opened the tutorial
 * with — it is not rewritten here. Nothing is written at render time and nothing
 * is re-seeded over work the student did afterwards: the record carries
 * `tutorialSeed`, and the store refuses to seed a chart that already holds work.
 */

import {
  createEncounter,
  type ClaimServiceLine,
  type PipelineEncounter,
} from "../store/pipelineEncounter";
import type { Patient } from "../store/patientStore";
import { compileNoteText, type NoteFields } from "./noteStatus";
import { signNote } from "./signNote";
import { appendStatusEvent, makeStatusEvent } from "./statusEvent";
import { buildSubmissionEvents } from "./clearinghouse";
import { claimStatusForRemittance, type ClaimStatus } from "./claimStatus";
import {
  adjudicateClaim,
  planForPayerName,
  type Remittance835,
} from "./adjudication";
import { postRemittanceToLedger } from "./ledger";
import { buildClaimForm } from "../utils/claimAutoFill";
import { providerProfileFor } from "../data/claims/renderingProviders";

/** The patient the tutorial runs on (`domain/inbox.ts`). */
export const TUTORIAL_PATIENT_ID = "DEMO";

/**
 * The marker a seeded tutorial chart carries. Its presence — whatever the value
 * — means "this chart has been offered the tutorial encounter already", so a
 * second open never re-seeds it and a "Start over" is never undone.
 */
export const TUTORIAL_SEED_KEY = "tutorial-v1";

/** The value written by "Start over": the chart stays blank for practice. */
export const TUTORIAL_SEED_CLEARED = "cleared";

/** The provider the tutorial visit is documented and signed by. */
export const TUTORIAL_PROVIDER_NAME = "Dr. Demo Instructor, MD";

/** The visit's date of service. The demo chart's own encounter date. */
export const TUTORIAL_SERVICE_DATE = "2026-07-09";

/**
 * The visit's prior authorisation: the plan requires one for advanced imaging,
 * and it was approved for the CT of the thorax (71250) only.
 */
export const TUTORIAL_PA_NUMBER = "PA-2026-004821";

/** The procedure the authorisation on file covers. */
export const TUTORIAL_AUTHORIZED_CPT = "71250";

/**
 * The tutorial's progress note — the same four SOAP sections the workspace has
 * always opened the tutorial chart with (moved here unchanged so the record and
 * the screen can never print two different notes).
 */
export const TUTORIAL_NOTE: NoteFields = {
  subjective:
    "Patient reports intermittent chest pain over the past 2 weeks, described as pressure-like, radiating to left arm. Worse with exertion, relieved by rest. Associated shortness of breath when climbing stairs. Denies nausea or diaphoresis. Has history of hypertension, currently on Lisinopril.",
  objective:
    "Vitals: BP 145/92, HR 92, Temp 99.1°F, RR 20, O2 Sat 94% on room air. General: Alert, mild distress. CV: Regular rate, no murmurs. Lungs: Clear bilaterally. ECG shows ST-segment depression in leads V4-V6. Labs: Troponin mildly elevated at 0.12 ng/mL.",
  assessment:
    "1. Suspected Coronary Artery Disease (I25.10)\n2. Hypertension, uncontrolled (I10)\n3. Chest Pain, unspecified (R07.9)\n\nPlan: Admit for cardiac workup. Order serial troponins, echocardiogram, cardiology consult. Continue Lisinopril, start Atorvastatin 40mg, Aspirin 81mg daily.",
  plan:
    "1. Admit to telemetry unit\n2. Serial troponins q6h x3\n3. Echocardiogram in AM\n4. Cardiology consult (Dr. Williams)\n5. Continue home medications\n6. NPO after midnight for possible cardiac catheterization\n7. Stress test if enzymes negative\n8. Discharge planning: cardiac rehab referral",
};

/** The diagnoses the note's assessment reaches, in the note's own order. */
export const TUTORIAL_ICD_CODES = ["I25.10", "I10", "R07.9"];

/**
 * The procedures the visit performed, with the charge each was coded at.
 *
 * 99214 and 93000 are the visit and its ECG. 71250 (CT of the thorax) is the
 * study the plan required an authorisation for, and the authorisation on file
 * covers it. 72141 (MRI of the cervical spine) also needs an authorisation on
 * this plan and the one on file does not cover it, so the payer denies that line
 * with CO-197 — the money cycle the tutorial is here to show.
 */
export const TUTORIAL_LINES: readonly {
  cpt: string;
  charge: number;
  units: number;
  modifiers: string[];
}[] = [
  { cpt: "99214", charge: 175, units: 1, modifiers: [] },
  { cpt: "93000", charge: 60, units: 1, modifiers: [] },
  { cpt: "71250", charge: 240, units: 1, modifiers: [] },
  { cpt: "72141", charge: 610, units: 1, modifiers: [] },
];

/** The prior-auth record the tutorial's PA stage shows. */
export interface TutorialPARecord {
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

export interface TutorialSeedResult {
  encounter: PipelineEncounter;
  paRecord: TutorialPARecord;
}

export interface TutorialSeedInput {
  /** The tutorial patient's own chart — the card, the name, the coverage. */
  patient?: Patient | null;
  /** The claim number the store minted for this encounter. */
  claimNumber: string;
  /** One clock read for the whole seed, so every entry is in order. */
  at?: string;
  /** Who the store records as the author of the seeded work. */
  by?: string;
}

/** The coverage card the tutorial's payer name comes from. */
function payerNameFor(patient?: Patient | null): string {
  return (patient?.insuranceRecord?.primary?.payerName || patient?.insurance || "").trim();
}

/** The coded lines the Coder stage holds, before the claim is built. */
function codingLinesFor(renderingNpi: string): ClaimServiceLine[] {
  return TUTORIAL_LINES.map((line) => ({
    dateOfService: TUTORIAL_SERVICE_DATE,
    placeOfService: "11",
    cpt: line.cpt,
    modifiers: [...line.modifiers],
    diagnosisPointer: "A",
    charge: line.charge,
    units: line.units,
    idQualifier: "XX",
    renderingNpi,
    revenueCode: "",
    nonCovered: 0,
  }));
}

/**
 * Build the Tutorial Patient's completed encounter from the patient's own chart.
 *
 * Pure: the same patient, claim number and timestamp produce the same record, so
 * a test can pin it and a reload reads back exactly what was written.
 */
export function buildTutorialEncounter({
  patient,
  claimNumber,
  at,
  by,
}: TutorialSeedInput): TutorialSeedResult {
  const stamp = at ?? new Date().toISOString();
  const author = (by ?? "").trim() || TUTORIAL_PROVIDER_NAME;
  const payerName = payerNameFor(patient);
  const provider = providerProfileFor(TUTORIAL_PROVIDER_NAME);

  // 1. The note, signed and locked — the record every later stage reads.
  let enc: PipelineEncounter = {
    ...createEncounter(TUTORIAL_PATIENT_ID),
    noteFields: { ...TUTORIAL_NOTE },
    scribeNote: compileNoteText(TUTORIAL_NOTE),
    noteUpdatedAt: stamp,
  };
  enc = signNote(enc, { note: TUTORIAL_NOTE, by: TUTORIAL_PROVIDER_NAME, at: stamp });

  // 2. The Coder's work: diagnoses, procedures and one charge per line.
  enc = {
    ...enc,
    icdCodes: [...TUTORIAL_ICD_CODES],
    cptCodes: TUTORIAL_LINES.map((line) => line.cpt),
    codingLines: codingLinesFor(provider.npi),
    stage: "prior-auth",
    status: "coded",
  };

  // 3. The prior authorisation, decided. `paData` is what box 23 reads
  //    (`domain/priorAuthNumber.ts`): the number and the procedure it covers.
  const paData: Record<string, string> = {
    paId: TUTORIAL_PA_NUMBER,
    cptCodes: TUTORIAL_AUTHORIZED_CPT,
    procedure: `${TUTORIAL_AUTHORIZED_CPT} — CT of the thorax`,
    payer: payerName,
    status: "approved",
  };
  enc = { ...enc, paData, stage: "biller", status: "coded", denialInfo: null };

  // 4. The claim: built by the same function the Biller's paper uses, from the
  //    patient's own card, the coded lines and the appointment's provider.
  const claimForm = buildClaimForm({
    patient: patient ?? null,
    pipeline: { ...enc, demoFillMissingBoxes: true },
    paNumber: TUTORIAL_PA_NUMBER,
    provider,
    claimType: "professional",
    encounterDate: TUTORIAL_SERVICE_DATE,
    placeOfService: "11",
  });
  const created = makeStatusEvent(
    {
      entityType: "claim",
      entityId: claimNumber,
      patientId: TUTORIAL_PATIENT_ID,
      claimNumber,
      from: null,
      to: "draft",
      by: author,
      jobRole: "biller",
      reasonCode: "CLAIM_CREATED",
      reason: `Claim ${claimNumber} created from this encounter.`,
      at: stamp,
    },
    enc.statusEvents,
  );
  enc = {
    ...enc,
    claimForm,
    claimNumber,
    claimStatus: "draft" as ClaimStatus,
    claimStatusMigrated: false,
    claimData: {},
    stage: "ar-voice",
    status: "billed",
    statusEvents: appendStatusEvent(enc.statusEvents, created),
  };

  // 5. Transmit the 837P and record the 277CA. The identity facts are the card's
  //    own, so the clearinghouse's checks pass and the acknowledgement is A1.
  const submission = buildSubmissionEvents({
    facts: {
      track: "medical",
      claimNumber,
      subscriberId: claimForm.subscriberId,
      subscriberIdOnFile: claimForm.subscriberId,
      patientDob: claimForm.patientDob,
      patientDobOnFile: claimForm.patientDob,
    },
    from: "draft",
    patientId: TUTORIAL_PATIENT_ID,
    by: author,
    jobRole: "biller",
    lineCount: claimForm.serviceLines.filter((line) => (line.cpt ?? "").trim() !== "").length,
    payerName,
    existing: enc.statusEvents,
    at: stamp,
  });
  enc = {
    ...enc,
    statusEvents: submission.events,
    claimStatus: (submission.ack.category === "A1" ? "accepted" : "rejected") as ClaimStatus,
    claimStatusMigrated: false,
  };
  // A claim the clearinghouse rejected has never been to the payer: there is no
  // 835 to price and no money to post, so the seed stops at the rejection.
  if (submission.ack.category !== "A1") {
    return { encounter: { ...enc, tutorialSeed: TUTORIAL_SEED_KEY }, paRecord: paRecordFor(payerName, stamp) };
  }

  // 6. Adjudication: the payer prices every line and denies the one whose
  //    authorisation is not on file. The plan is the one this payer's name maps
  //    to in the same table the 271 reads.
  const plan = planForPayerName(payerName);
  const remittance = adjudicateClaim({
    claimNumber,
    payerName: payerName || "the payer",
    plan,
    lines: TUTORIAL_LINES.map((line) => ({
      cpt: line.cpt,
      modifiers: [...line.modifiers],
      units: line.units,
      chargeCents: Math.round(line.charge * 100),
    })),
    deductibleRemainingCents: Math.round((plan?.deductibleUsd ?? 0) * 100),
    priorAuthNumber: TUTORIAL_PA_NUMBER,
    authorizedCptCodes: [TUTORIAL_AUTHORIZED_CPT],
    at: stamp,
  });
  const received = makeStatusEvent(
    {
      entityType: "claim",
      entityId: claimNumber,
      patientId: TUTORIAL_PATIENT_ID,
      claimNumber,
      from: enc.claimStatus,
      to: "adjudicated",
      by: "system",
      jobRole: "system",
      reasonCode: "ERA_RECEIVED",
      reason: `835 ${remittance.checkOrEftNumber} received from ${remittance.payerName}: billed ${usd(remittance.totals.billedCents)}, allowed ${usd(
        remittance.totals.allowedCents,
      )}, paid ${usd(remittance.totals.paidCents)}, patient ${usd(remittance.totals.patientRespCents)}.`,
      amountCents: remittance.totals.paidCents,
      refs: { eraId: remittance.id, checkNumber: remittance.checkOrEftNumber },
      at: stamp,
    },
    enc.statusEvents,
  );
  enc = {
    ...enc,
    remittances: [remittance],
    claimStatus: "adjudicated" as ClaimStatus,
    statusEvents: appendStatusEvent(enc.statusEvents, received),
  };

  // 7. Posting: the money reaches the ledger — charges, the insurance payment
  //    and the contractual adjustments, in one write, through the ledger module.
  const entries = postRemittanceToLedger(remittance, {
    patientId: TUTORIAL_PATIENT_ID,
    userId: author,
    at: stamp,
  });
  const postedRemittance: Remittance835 = { ...remittance, postedAt: stamp };
  const finalStatus = claimStatusForRemittance(remittance);
  const posted = makeStatusEvent(
    {
      entityType: "claim",
      entityId: claimNumber,
      patientId: TUTORIAL_PATIENT_ID,
      claimNumber,
      at: stamp,
      from: enc.claimStatus,
      to: "adjudicated",
      by: author,
      jobRole: "payment-poster",
      reasonCode: "ERA_POSTED",
      reason: `835 ${remittance.checkOrEftNumber} posted: ${entries.length} ledger entr${entries.length === 1 ? "y" : "ies"}.`,
      amountCents: remittance.totals.paidCents,
      refs: { eraId: remittance.id, checkNumber: remittance.checkOrEftNumber },
    },
    enc.statusEvents,
  );
  const outcome = makeStatusEvent(
    {
      entityType: "claim",
      entityId: claimNumber,
      patientId: TUTORIAL_PATIENT_ID,
      claimNumber,
      at: stamp,
      from: "adjudicated",
      to: finalStatus,
      by: author,
      jobRole: "payment-poster",
      reasonCode:
        remittance.outcome === "paid_in_full"
          ? "ERA_PAID_IN_FULL"
          : remittance.outcome === "partially_paid"
            ? "ERA_PARTIAL"
            : remittance.outcome === "patient_responsibility"
              ? "PATIENT_BALANCE_CREATED"
              : "ERA_DENIED",
      reason:
        remittance.outcome === "partially_paid"
          ? `Partially paid: ${usd(remittance.totals.paidCents)} paid, ${usd(remittance.totals.deniedCents)} denied, ${usd(
              remittance.totals.writeOffCents,
            )} written off. The denied line is for the AR queue.`
          : `The payer's 835 posted to the ledger.`,
      amountCents: remittance.totals.paidCents,
      refs: { eraId: remittance.id, checkNumber: remittance.checkOrEftNumber },
    },
    enc.statusEvents,
  );

  return {
    encounter: {
      ...enc,
      ledger: entries,
      remittances: [postedRemittance],
      claimStatus: finalStatus,
      claimStatusMigrated: false,
      statusEvents: appendStatusEvent(appendStatusEvent(enc.statusEvents, posted), outcome),
      stage: "complete",
      status: finalStatus === "denied" ? "denied" : "paid",
      role: "scribe",
      chartStage: "sign-lock",
      tutorialSeed: TUTORIAL_SEED_KEY,
    },
    paRecord: paRecordFor(payerName, stamp),
  };
}

/** `$1,234.56` — the money form the timeline sentences use. */
function usd(cents: number): string {
  return `$${(Math.round(cents) / 100).toFixed(2)}`;
}

/** The prior authorisation the tutorial's PA stage lists. */
function paRecordFor(payerName: string, at: string): TutorialPARecord {
  return {
    id: `pa-${TUTORIAL_PATIENT_ID}-${TUTORIAL_AUTHORIZED_CPT}`,
    patientId: TUTORIAL_PATIENT_ID,
    procedure: `${TUTORIAL_AUTHORIZED_CPT} — CT of the thorax`,
    insuranceName: payerName || "Medicare Part B",
    paProcessor: payerName || "Medicare Part B",
    authStartDate: TUTORIAL_SERVICE_DATE,
    authEndDate: TUTORIAL_SERVICE_DATE,
    nextRefillDate: "",
    submissionMethod: "278",
    submittedBy: TUTORIAL_PROVIDER_NAME,
    submittedAt: at,
    status: "approved",
    verificationStatus: "verified",
    verificationResult: `278 approved for ${TUTORIAL_AUTHORIZED_CPT}: authorisation ${TUTORIAL_PA_NUMBER} is on file for this member.`,
  };
}

/**
 * A blank tutorial chart that is *not* to be seeded again — what "Start over"
 * leaves behind. It carries the marker so opening it never re-fills the chart.
 */
export function clearedTutorialEncounter(): PipelineEncounter {
  return { ...createEncounter(TUTORIAL_PATIENT_ID), tutorialSeed: TUTORIAL_SEED_CLEARED };
}
