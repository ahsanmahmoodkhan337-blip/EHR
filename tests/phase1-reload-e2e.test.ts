/**
 * Phase 1 — data integrity, end to end, through a reload.
 *
 * `specs/phase1-data-integrity.md` (owner's work order, 2026-11-22). The promise
 * this test keeps:
 *
 *   book appointment → register the new patient → write the note → sign it →
 *   code it → build the claim → submit → adjudicate → post the 835 →
 *   RELOAD → the claim is still paid, the stepper is unchanged, box 11 still
 *   carries the group number registration captured, and boxes 31 / 24J carry the
 *   provider the appointment was booked with.
 *
 * Real modules only — no mocks of the store:
 *   - `store/persistence.ts` is the real per-student blob: `saveUserData` writes
 *     it and `loadUserData` reads it back through `migrateBlob`, which is exactly
 *     what a browser reload does;
 *   - `store/pipelineEncounter.ts` is the real record shape, so the reload goes
 *     through `normalizePipelineStore` — the same path `persistence.ts` uses;
 *   - every step is the domain function the store itself calls (`signNote`,
 *     `buildSubmissionEvents`, `adjudicateClaim`, `postRemittanceToLedger`,
 *     `claimStatusForRemittance`, `buildClaimForm`, `providerProfileFor`);
 *   - the stepper is read by `completedStagesOf` — the one function the workspace
 *     draws its ticks from;
 *   - the claim header, the InBasket and the work queues are read by their own
 *     modules.
 *
 * The reload is simulated the only honest way: the in-memory state is thrown
 * away, and everything after it is read back out of the saved payload.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { loadUserData, saveUserData } from "../src/store/persistence";
import {
  createEncounter,
  encounterKey,
  normalizePipelineStore,
  type PipelineEncounter,
  type PipelineState,
  type PipelineStoreState,
} from "../src/store/pipelineEncounter";
import { signNote } from "../src/domain/signNote";
import { buildClaimForm } from "../src/utils/claimAutoFill";
import { validateCMS1500 } from "../src/utils/claimValidation";
import { providerProfileFor, npiForName, isLuhnValidNpi } from "../src/data/claims/renderingProviders";
import { buildSubmissionEvents } from "../src/domain/clearinghouse";
import { adjudicateClaim, planForPayerName } from "../src/domain/adjudication";
import {
  appendLedgerEntries,
  ledgerAgreesWithRemittance,
  postRemittanceToLedger,
} from "../src/domain/ledger";
import { CLAIM_STATUS_LABELS, claimStatusForRemittance, mintClaimNumber } from "../src/domain/claimStatus";
import { completedStagesOf } from "../src/domain/stageProgress";
import { ENCOUNTER_FLOW_STAGES } from "../src/domain/encounterFlow";
import { buildInboxItems } from "../src/domain/inbasket";
import { buildMedicalQueueRows, isAwaitingPayer } from "../src/domain/homeWorkQueues";

const ROOT = join(import.meta.dir, "..");
const read = (relative: string) => readFileSync(join(ROOT, relative), "utf8");

const PHONE = "03001234567";
const AT = "2026-11-22T09:15:00.000Z";
/** What registration typed into the group-number field. */
const GROUP_NUMBER = "GRP-40512";
/** The provider the appointment was booked with. */
const BOOKED_PROVIDER = "Dr. Sarah Lee";
const PAYER = "Cascadia Health Plan";

/** A localStorage good enough for the real persistence module. */
class MemoryStorage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
}

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage() as unknown as Storage;
});

/**
 * The patient registration leaves behind: demographics on the chart, and the
 * coverage record with the payer, member ID, group number and payer ID the
 * student transcribed (`RegistrationStage` → `updatePatientInsurance`).
 */
const PATIENT = {
  id: "PAT-PHASE1",
  mrn: "MRN-1001",
  firstName: "Ayesha",
  lastName: "Khan",
  dateOfBirth: "1989-04-12",
  gender: "Female",
  phone: "03001234567",
  address: "12 Mall Road, Lahore",
  insurance: PAYER,
  insuranceRecord: {
    primary: {
      payerName: PAYER,
      planName: "Cascadia PPO",
      subscriberId: "CAS-778899",
      groupNumber: GROUP_NUMBER,
      ediPayerId: "34160",
      relationshipToSubscriber: "Self",
    },
    secondary: null,
  },
  vitals: {},
  problems: [],
  medications: [],
  allergies: [],
  encounters: [],
};

/** The appointment the front desk booked — with the provider on it. */
const APPOINTMENT = {
  id: "apt-phase1",
  patientId: PATIENT.id,
  patientName: "Ayesha Khan",
  date: "2026-11-22",
  time: "09:00",
  type: "New Patient",
  duration: 30,
  notes: "",
  status: "scheduled" as const,
  provider: BOOKED_PROVIDER,
};

/** The visit as the student walks it, one domain write at a time. */
function walkTheVisit() {
  // ── 3. The note, then Sign & Lock ────────────────────────────────
  let enc: PipelineEncounter = createEncounter(PATIENT.id);
  const note = {
    subjective: "Two days of sore throat and fever, worse on swallowing.",
    objective: "Temp 38.2 C, pharynx erythematous, tonsils enlarged, no exudate.",
    assessment: "Acute pharyngitis, unspecified (J06.9).",
    plan: "Symptomatic care, fluids, return if fever persists past 48 hours.",
  };
  enc = signNote(enc, { note, by: PHONE, at: AT });

  // ── 4. Coding ───────────────────────────────────────────────────
  enc = {
    ...enc,
    icdCodes: ["J06.9"],
    cptCodes: ["99213"],
    codingLines: [
      {
        dateOfService: APPOINTMENT.date,
        placeOfService: "11",
        cpt: "99213",
        modifiers: [],
        diagnosisPointer: "A",
        charge: 150,
        units: 1,
        idQualifier: "XX",
        renderingNpi: "",
      },
    ],
  };

  // ── 5. The claim, seeded from the record and the booking provider ─
  const claimForm = buildClaimForm({
    patient: PATIENT as never,
    pipeline: { ...enc, demoFillMissingBoxes: true } as PipelineState,
    provider: providerProfileFor(APPOINTMENT.provider),
    claimType: "professional",
    encounterDate: APPOINTMENT.date,
    placeOfService: "11",
  });
  const claimNumber = mintClaimNumber(1);
  enc = { ...enc, claimForm, claimNumber, claimStatus: "draft" };

  // ── 6. Submit: the 837P and the payer's 277CA ────────────────────
  const { events, ack } = buildSubmissionEvents({
    facts: {
      track: "medical",
      claimNumber,
      subscriberId: claimForm.insuredId,
      subscriberIdOnFile: PATIENT.insuranceRecord.primary.subscriberId,
      patientDob: claimForm.patientDob,
      patientDobOnFile: PATIENT.dateOfBirth,
    },
    from: "draft",
    patientId: PATIENT.id,
    by: PHONE,
    jobRole: "biller",
    lineCount: 1,
    payerName: PAYER,
    existing: enc.statusEvents,
  });
  enc = { ...enc, statusEvents: events, claimStatus: ack.category === "A1" ? "accepted" : "rejected" };

  // ── 7. Adjudication: the payer's 835, priced line by line ────────
  const plan = planForPayerName(PAYER);
  const remittance = adjudicateClaim({
    claimNumber,
    payerName: PAYER,
    plan,
    lines: [{ cpt: "99213", modifiers: [], units: 1, chargeCents: 15000 }],
    deductibleRemainingCents: Math.round((plan?.deductibleUsd ?? 0) * 100),
    priorAuthNumber: claimForm.priorAuthNumber ?? "",
    at: AT,
  });
  enc = { ...enc, remittances: [remittance], claimStatus: "adjudicated" };

  // ── 8. Post the 835 to the ledger ───────────────────────────────
  const entries = postRemittanceToLedger(remittance, { patientId: PATIENT.id, userId: PHONE, at: AT });
  const ledger = appendLedgerEntries(enc.ledger, entries);
  const posted = { ...remittance, postedAt: AT };
  enc = {
    ...enc,
    ledger,
    remittances: [posted],
    claimStatus: claimStatusForRemittance(remittance),
  };

  return { enc, ack, claimNumber, claimForm };
}

/** Save the store the way the app does, then read it back the way a reload does. */
function saveAndReload(enc: PipelineEncounter) {
  const store: PipelineStoreState = {
    activePatientId: PATIENT.id,
    encounters: { [encounterKey(PATIENT.id)]: enc },
    demoFillMissingBoxes: true,
    currentRole: "ar-voice",
  };
  saveUserData(PHONE, { pipeline: store, currentRole: store.currentRole });

  // ── RELOAD ──────────────────────────────────────────────────────
  // Everything above is now out of reach: only the saved payload remains, read
  // through the real loader and the real normaliser.
  const saved = loadUserData(PHONE);
  const rehydrated = normalizePipelineStore(saved?.pipeline, saved?.currentRole ?? "scribe");
  return rehydrated.encounters[encounterKey(PATIENT.id)];
}

describe("phase 1 — the claim survives the reload", () => {
  test("submit, adjudicate, post — then reload — and the claim is still Paid in full", () => {
    const { enc, ack, claimNumber } = walkTheVisit();
    expect(ack.category).toBe("A1");
    expect(enc.claimStatus).toBe("paid");

    const after = saveAndReload(enc);

    expect(after.claimNumber).toBe(claimNumber);
    expect(after.claimStatus).toBe("paid");
    expect(CLAIM_STATUS_LABELS[after.claimStatus!]).toBe("Paid in full");
    // The 835 and the money behind it are on the record, not on a screen.
    expect(after.remittances.length).toBe(1);
    expect(after.remittances[0].postedAt).toBe(AT);
    expect(after.ledger.length).toBeGreaterThan(0);
    expect(ledgerAgreesWithRemittance(after.ledger, after.remittances[0])).toBe(true);
  });

  test("the 277CA the claim received is still on its timeline", () => {
    const { enc } = walkTheVisit();
    const after = saveAndReload(enc);
    const ackEvent = after.statusEvents.find((event) => event.reasonCode === "277CA_ACCEPTED");
    expect(ackEvent).toBeDefined();
    expect(ackEvent!.claimNumber).toBe(after.claimNumber!);
  });

  test("the InBasket and the work queues read the saved status, not an in-memory one", () => {
    const { enc } = walkTheVisit();
    const after = saveAndReload(enc);

    // A posted claim is not "awaiting a payer response" any more.
    expect(isAwaitingPayer(after.claimStatus)).toBe(false);
    const inbox = buildInboxItems({
      encounters: [after],
      arWorkItems: [],
      paRecords: [],
      appointments: [],
      patients: [{ id: PATIENT.id, firstName: PATIENT.firstName, lastName: PATIENT.lastName }],
    });
    expect(inbox.some((item) => item.title === "Claim awaiting a payer response")).toBe(false);

    // A paid claim is nobody's waiting work: it is not in the awaiting-payer
    // queue either, so the queues agree with the InBasket about the same record.
    const rows = buildMedicalQueueRows({
      encounters: [after],
      arWorkItems: [],
      nameForPatient: () => "Ayesha Khan",
      roleLabel: (role) => role,
    });
    expect(rows.some((row) => row.id.startsWith("awaiting-"))).toBe(false);
  });
});

describe("phase 1 — the stepper is the record's, not the screen's", () => {
  test("the stepper is identical before and after a reload", () => {
    const { enc } = walkTheVisit();
    const before = completedStagesOf(enc);
    const after = completedStagesOf(saveAndReload(enc));
    expect(after).toEqual(before);
    // Six of the seven stages are finished by the end of the walk, in the
    // owner's order — note, signature, codes, prior auth, billing and the
    // posted 835. "Denials & AR" stays open because a paid-in-full claim never
    // entered AR, and the tick rule says AR is cleared only when AR had work.
    expect(before).toEqual(
      ENCOUNTER_FLOW_STAGES.map((stage) => stage.id).filter((id) => id !== "denials-ar"),
    );
  });

  test("the workspace draws its ticks from that one reader", () => {
    const INDEX = read("src/routes/index.tsx");
    expect(INDEX).toContain("const completedFlow = completedStagesOf(pipelineState);");
    expect(INDEX).not.toContain("const noteWritten = hpiDone && examDone && planGaps.length === 0;");
    expect(INDEX).toContain('completedIds={completedFlow}');
  });

  test("the billing screen's submitted panel is the record's status, not a local flag", () => {
    const BILLING = read("src/components/BillingLedger/BillingLedger.tsx");
    expect(BILLING).toContain(
      'const transmitted = state.claimStatus !== null && state.claimStatus !== "draft";',
    );
    // The claim header is drawn on the claim stage only: the posting stage
    // (openTab === "remittance", from the stepper's route) puts the 835 in front
    // of the student instead. Both flags come from the route, never local memory.
    expect(BILLING).toContain("{transmitted && !paperOpen && !postingStage ? (");
    expect(BILLING).not.toContain("setSubmitted");
  });
});

describe("phase 1 — registration's group number reaches box 11", () => {
  test("box 11 carries the group number the student transcribed, with no edit error", () => {
    const { claimForm } = walkTheVisit();
    expect(claimForm.insuredPolicyGroup).toBe(GROUP_NUMBER);
    const issues = validateCMS1500(claimForm, { principalDiagnosis: "J06.9" });
    expect(issues.filter((issue) => JSON.stringify(issue).includes("Box 11"))).toEqual([]);
  });

  test("the claim seeds box 11 from the patient's card, never from a second copy", () => {
    const { claimForm } = walkTheVisit();
    const card = PATIENT.insuranceRecord.primary.groupNumber;
    expect(claimForm.insuredPolicyGroup).toBe(card);
    // The seeding rule lives in one place, read off the patient's own card. A
    // payer that issues no group number prints N/A instead of a blank the edit
    // check would call an error (`specs/claim-boxes-agree.md` §1).
    const AUTOFILL = read("src/utils/claimAutoFill.ts");
    expect(AUTOFILL).toContain("insuredPolicyGroup: box11Value(card.groupNumber, payerName),");
  });
});

describe("phase 1 — the appointment's provider signs the claim", () => {
  test("booking Dr. Sarah Lee produces a claim signed by Dr. Sarah Lee", () => {
    const { claimForm } = walkTheVisit();
    expect(claimForm.providerSignature).toBe(BOOKED_PROVIDER);
    // Box 24J is that provider's NPI on every line, and it is a Luhn-valid NPI.
    expect(claimForm.serviceLines.length).toBeGreaterThan(0);
    for (const line of claimForm.serviceLines) {
      expect(line.renderingNpi).toBe(npiForName(BOOKED_PROVIDER));
      expect(isLuhnValidNpi(line.renderingNpi)).toBe(true);
    }
    expect(claimForm.providerSignature).not.toBe("A. R. Siddiqui, MD");
  });

  test("two providers never share an NPI, and a typed name still gets one", () => {
    expect(npiForName("Dr. Sarah Lee")).not.toBe(npiForName("Dr. Priya Nair"));
    expect(isLuhnValidNpi(npiForName("Dr. Someone Typed"))).toBe(true);
    // Stable across calls — a reload cannot change a claim's rendering NPI.
    expect(npiForName("Dr. Sarah Lee")).toBe(npiForName("Dr. Sarah Lee"));
  });

  test("the provider survives the reload with the claim", () => {
    const { enc } = walkTheVisit();
    const after = saveAndReload(enc);
    expect(after.claimForm?.providerSignature).toBe(BOOKED_PROVIDER);
    expect(after.claimForm?.serviceLines[0].renderingNpi).toBe(npiForName(BOOKED_PROVIDER));
  });

  test("the billing screen reads the provider off the encounter's appointment", () => {
    const BILLING = read("src/components/BillingLedger/BillingLedger.tsx");
    expect(BILLING).toContain("useEncounterProvider(patientId || null)");
    expect(BILLING).toContain("provider: claimProvider,");
  });
});
