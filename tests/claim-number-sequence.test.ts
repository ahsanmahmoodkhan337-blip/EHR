/**
 * One claim sequence for the whole student — spec
 * `slice-j-claim-follows-record.md` item 4a, claim numbers.
 *
 * Two sequences existed: the medical track counted its own encounters, and the
 * dental track counted a one-element array on a record it had just cleared, so
 * every dental case was `CLM-000001` and a dental claim could carry the same
 * number as a medical one. A claim number is quoted on the paper, in the 835 /
 * EFT control ids, in the AR item ids and in the status timeline.
 *
 * These tests cover: the shared mark, the dental case that used to reset it, the
 * migration from a real old record holding both `CLM-000001`s, and the Prior
 * Auth panel reading the payer from the patient's coverage record.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  claimNumberHighWater,
  claimNumbersIn,
  dentalTrackStorageKey,
  medicalClaimNumbers,
  mintNextClaimNumber,
} from "../src/store/claimSequence";
import { userDataKey } from "../src/store/persistence";
import { migrateDentalTrackState } from "../src/components/dental/DentalTrackStore";

const ROOT = join(import.meta.dir, "..");
const read = (relative: string) => readFileSync(join(ROOT, relative), "utf8");
const PORTAL = read("src/components/PriorAuthPortal/PriorAuthPortal.tsx");

/** A localStorage good enough for the sequence module. */
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

const PHONE = "03001234567";

/** The medical blob as this build saves it: one encounter holding a claim. */
function saveMedicalClaim(claimNumber: string) {
  const blob = {
    v: 8,
    updatedAt: "2026-11-21T10:00:00.000Z",
    pipeline: {
      activePatientId: "MPT-2001",
      currentRole: "biller",
      encounters: {
        "MPT-2001": { patientId: "MPT-2001", claimNumber, statusEvents: [] },
      },
    },
  };
  localStorage.setItem(userDataKey(PHONE), JSON.stringify(blob));
}

/** The dental record as the old build saved it: a submitted claim, a ledger row. */
function oldDentalRecord(claimNumber: string) {
  return {
    version: 7,
    caseId: null,
    stage: "claim",
    furthestStage: "claim",
    startedAt: "2026-11-20T09:00:00.000Z",
    lines: [],
    claimSubmitted: true,
    claimNumber,
    claimStatus: "submitted",
    statusEvents: [
      {
        id: `${claimNumber}-SUBMITTED`,
        entityType: "claim",
        entityId: claimNumber,
        patientId: null,
        claimNumber,
        seq: 1,
        at: "2026-11-20T09:10:00.000Z",
        from: "draft",
        to: "submitted",
        by: PHONE,
        jobRole: "biller",
        reasonCode: "SUBMITTED_837D",
        reason: "Submitted to the payer.",
      },
    ],
    predeterminationScenarioId: null,
    predeterminationRequestedAt: null,
    trapsTriggered: [],
    rubricByCriterion: {},
    arCallLog: [],
    lineResolutions: {},
    appealOutcomes: {},
    perio: {},
    txPlan: [],
    ledger: [
      {
        id: `LEDG-${claimNumber}-dental-writeoff-1`,
        patientId: "DPT-1",
        claimNumber,
        date: "2026-11-20",
        type: "adjustment",
        code: "CO-45",
        description: "Contractual write-off.",
        amountCents: -1500,
        userId: PHONE,
      },
    ],
    adaForm: null,
    practice: {},
    activePracticeId: null,
    practiceBenchOpen: false,
  };
}

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage() as unknown as Storage;
});

describe("one shared sequence", () => {
  test("each mint is a new number, never the same one twice", () => {
    expect(mintNextClaimNumber([], PHONE)).toBe("CLM-000001");
    expect(mintNextClaimNumber([], PHONE)).toBe("CLM-000002");
    expect(mintNextClaimNumber([], PHONE)).toBe("CLM-000003");
  });

  test("a medical claim already on the record pushes the dental claim past it", () => {
    saveMedicalClaim("CLM-000001");
    // The dental track asks for its own first number and gets the next one.
    expect(mintNextClaimNumber([], PHONE)).toBe("CLM-000002");
    // …and the mark is saved, so a cleared dental case cannot reuse it.
    expect(claimNumberHighWater(PHONE)).toBe(2);
    expect(mintNextClaimNumber([], PHONE)).toBe("CLM-000003");
  });

  test("a dental case that is cleared and restarted never mints its number again", () => {
    const first = mintNextClaimNumber([], PHONE);
    expect(first).toBe("CLM-000001");
    // `beginCase` writes `claimNumber: null`; the mark is what stops a re-mint.
    expect(mintNextClaimNumber([null], PHONE)).toBe("CLM-000002");
    // A number still saved in the dental track counts even without the mark.
    localStorage.setItem(dentalTrackStorageKey(PHONE), JSON.stringify(oldDentalRecord("CLM-000009")));
    expect(claimNumberHighWater(PHONE)).toBe(9);
    expect(mintNextClaimNumber([], PHONE)).toBe("CLM-000010");
  });

  test("both tracks read the same mark", () => {
    expect(mintNextClaimNumber([], PHONE)).toBe("CLM-000001"); // dental mints
    saveMedicalClaim("CLM-000001"); // the same number is on a medical claim
    // Nothing on the medical side is renumbered, but the next mint is above both.
    expect(mintNextClaimNumber([], PHONE)).toBe("CLM-000002");
  });
});

describe("the migration from a record holding two CLM-000001s", () => {
  test("the dental claim is re-minted, and its timeline and ledger follow it", () => {
    const migrated = migrateDentalTrackState(oldDentalRecord("CLM-000001"), ["CLM-000001"]);
    expect(migrated.claimNumber).not.toBe("CLM-000001");
    expect(migrated.claimNumber).toBe("CLM-000002");
    // The claim's own references move with it — nothing is orphaned.
    const claimEvents = migrated.statusEvents.filter((e) => e.entityType === "claim");
    expect(claimEvents.every((e) => e.claimNumber === migrated.claimNumber)).toBe(true);
    expect(claimEvents.some((e) => e.entityId === migrated.claimNumber)).toBe(true);
    expect(migrated.ledger.every((entry) => entry.claimNumber === migrated.claimNumber)).toBe(true);
    expect(migrated.ledger[0].id).toContain(migrated.claimNumber);
    expect(migrated.ledger[0].id).not.toContain("CLM-000001");
    // The money and the status are carried forward untouched.
    expect(migrated.ledger[0].amountCents).toBe(-1500);
    expect(migrated.claimStatus).toBe("submitted");
    // …and the timeline says what happened.
    const migration = migrated.statusEvents.find((e) => e.reasonCode === "MIGRATED");
    expect(migration?.reason).toContain("CLM-000002");
  });

  test("no two claims share a number after the migration", () => {
    const migrated = migrateDentalTrackState(oldDentalRecord("CLM-000001"), ["CLM-000001"]);
    const medical = ["CLM-000001"];
    expect(medical).not.toContain(migrated.claimNumber!);
  });

  test("running the migration again changes nothing", () => {
    const once = migrateDentalTrackState(oldDentalRecord("CLM-000001"), ["CLM-000001"]);
    const twice = migrateDentalTrackState(once, ["CLM-000001"]);
    expect(twice.claimNumber).toBe(once.claimNumber);
    expect(twice.ledger).toEqual(once.ledger);
    expect(twice.statusEvents).toEqual(once.statusEvents);
  });

  test("a dental number no medical claim holds is carried forward verbatim", () => {
    const migrated = migrateDentalTrackState(oldDentalRecord("CLM-000004"), ["CLM-000001"]);
    expect(migrated.claimNumber).toBe("CLM-000004");
    expect(migrated.ledger[0].claimNumber).toBe("CLM-000004");
  });

  test("the record's claim numbers are read from both tracks", () => {
    saveMedicalClaim("CLM-000001");
    localStorage.setItem(dentalTrackStorageKey(PHONE), JSON.stringify(oldDentalRecord("CLM-000002")));
    expect(medicalClaimNumbers(PHONE)).toEqual(["CLM-000001"]);
    expect(claimNumbersIn(oldDentalRecord("CLM-000002"))).toContain("CLM-000002");
  });
});

describe("the Prior Auth panel's payer is the patient's coverage record", () => {
  test("no hardcoded default and no payer dropdown", () => {
    expect(PORTAL).not.toContain('useState("Medicare")');
    expect(PORTAL).not.toContain('PAYER_REQUIREMENTS["Medicare"]');
    expect(PORTAL).toContain("const payer = card.payerName;");
    // The lookup still starts from the payer the card names — exact key first,
    // then the longest key that payer's name starts with (so "Medicare Part B"
    // finds its own row). It never starts from a literal payer.
    expect(PORTAL).toContain("PAYER_REQUIREMENTS[payer] ??");
    expect(PORTAL).not.toContain('PAYER_REQUIREMENTS["Medicare Part B"]');
    // The payer is printed, not chosen: the only select left on the form is the
    // procedure.
    expect(PORTAL).not.toContain("setPayer(");
  });

  test("a patient with no coverage says so instead of naming a payer", () => {
    expect(PORTAL).toContain("const payerLabel = payer || NOT_ON_FILE;");
    expect(PORTAL).toContain("No requirements on file for this payer.");
  });

  test("the PA record stores the record's payer, not the free-text label", () => {
    expect(PORTAL).toContain("insuranceName: payer,");
    expect(PORTAL).not.toContain("insuranceName: patient?.insurance || payer");
  });
});
