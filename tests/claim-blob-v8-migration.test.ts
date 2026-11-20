/**
 * UB-04 (CMS-1450) field table — the v7 → v8 blob migration.
 *
 * A claim saved before the institutional paper existed must open on it with
 * every value the student typed still there, locator 4 (type of bill) read back
 * from the line's own place of service, locator 66 set to ICD-10-CM, and no
 * value invented anywhere else. A blob already at v8 is not touched at all.
 *
 * Spec: `specs/claim-forms-auto-generated.md`, `specs/claim-field-table-audit.md`.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { loadUserData, userDataKey } from "../src/store/persistence";
import { blankClaimForm, blankServiceLine } from "../src/utils/claimAutoFill";
import type { ClaimFormData, PipelineEncounter } from "../src/store/pipelineEncounter";

const PHONE = "03001234567";
const PATIENT = "patient-1";

type FakeStorage = { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };

function memoryStorage(): FakeStorage & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

/** The locators the v8 build adds, so a test can hand back a real pre-v8 shape. */
const V8_LOCATOR_KEYS = [
  "medicalRecordNumber",
  "typeOfBill",
  "statementFrom",
  "statementThrough",
  "coveredDays",
  "admissionDate",
  "admissionHour",
  "admissionType",
  "admissionSource",
  "dischargeHour",
  "patientStatus",
  "conditionCodes",
  "accidentState",
  "occurrenceCodes",
  "occurrenceSpan",
  "responsibleParty",
  "valueCodes",
  "releaseOfInformation",
  "assignmentOfBenefits",
  "priorPayments",
  "estimatedAmountDue",
  "otherProviderIdQualifier",
  "otherProviderId",
  "insuredGroupName",
  "insuranceGroupNumber",
  "treatmentAuthorizationCode",
  "documentControlNumber",
  "diagnosisVersion",
  "principalDiagnosis",
  "otherDiagnoses",
  "admittingDiagnosis",
  "patientReasonVisit",
  "ppsCode",
  "eciCode",
  "principalProcedureCode",
  "principalProcedureDate",
  "principalProcedureQualifier",
  "otherProcedureCode",
  "otherProcedureDate",
  "attendingQualifier",
  "attendingLastName",
  "attendingFirstName",
  "operatingProviderNpi",
  "otherProviderNpi",
  "otherProviderNpi2",
  "remarks",
  "codeCodeA",
  "codeCodeB",
  "codeCodeC",
  "codeCodeD",
];

/** A claim as the student left it, on institutional paper. */
function institutionalForm(overrides: Partial<ClaimFormData> = {}): ClaimFormData {
  return {
    ...blankClaimForm(),
    patientName: "Lovelace, Ada",
    payerName: "Cedar Mutual",
    diagnosisCodes: ["J45.909", "E11.9"],
    serviceLines: [
      {
        ...blankServiceLine(undefined, "2026-11-02"),
        cpt: "99213",
        charge: 250,
        placeOfService: "23",
      },
    ],
    ...overrides,
  };
}

/** Strip every UB-04 locator back off a claim, leaving a v7 record. */
function asV7(form: ClaimFormData): ClaimFormData {
  const raw = { ...form } as Record<string, unknown>;
  for (const key of V8_LOCATOR_KEYS) delete raw[key];
  raw.serviceLines = (form.serviceLines ?? []).map((line) => {
    const copy = { ...line } as Record<string, unknown>;
    delete copy.revenueCode;
    delete copy.nonCovered;
    return copy;
  });
  return raw as ClaimFormData;
}

function blob(version: number, form: ClaimFormData | null) {
  return {
    v: version,
    updatedAt: "2026-11-20T10:00:00.000Z",
    pipeline: {
      activePatientId: PATIENT,
      currentRole: "biller",
      demoFillMissingBoxes: true,
      encounters: {
        [PATIENT]: { patientId: PATIENT, claimForm: form } as Partial<PipelineEncounter>,
      },
    },
  };
}

const originalLocalStorage = (globalThis as { localStorage?: unknown }).localStorage;

function install(storage: FakeStorage): void {
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true, writable: true });
}

function loadBlob(version: number, form: ClaimFormData | null) {
  const storage = memoryStorage();
  storage.setItem(userDataKey(PHONE), JSON.stringify(blob(version, form)));
  install(storage);
  return loadUserData(PHONE);
}

function claimOf(data: ReturnType<typeof loadUserData>): ClaimFormData {
  const claim = data?.pipeline?.encounters[PATIENT]?.claimForm;
  if (!claim) throw new Error("expected a claim on the loaded encounter");
  return claim;
}

beforeEach(() => install(memoryStorage()));

afterEach(() => {
  if (originalLocalStorage === undefined) {
    // @ts-expect-error — removing the stub the test installed
    delete globalThis.localStorage;
  } else {
    Object.defineProperty(globalThis, "localStorage", { value: originalLocalStorage, configurable: true, writable: true });
  }
});

describe("v7 → v8 blob migration", () => {
  test("a typed institutional claim survives verbatim", () => {
    const typed = institutionalForm({
      typeOfBill: "111",
      medicalRecordNumber: "MRN-4471",
      patientStatus: "01",
      conditionCodes: "11, 40",
      coveredDays: 3,
      statementFrom: "2026-11-02",
      statementThrough: "2026-11-04",
      treatmentAuthorizationCode: "AUTH-778201",
      diagnosisVersion: "0",
      principalDiagnosis: "J45.909",
      otherDiagnoses: "E11.9",
      priorPayments: 120,
      estimatedAmountDue: 80,
    });
    typed.serviceLines = [{ ...typed.serviceLines[0], revenueCode: "0450", nonCovered: 25 }];

    const data = loadBlob(7, typed);
    expect(data?.v).toBe(8);

    const claim = claimOf(data);
    for (const key of [
      "typeOfBill",
      "medicalRecordNumber",
      "patientStatus",
      "conditionCodes",
      "statementFrom",
      "statementThrough",
      "treatmentAuthorizationCode",
      "diagnosisVersion",
      "principalDiagnosis",
      "otherDiagnoses",
      "patientName",
      "payerName",
    ] as const) {
      expect(claim[key]).toBe(typed[key]);
    }
    expect(claim.coveredDays).toBe(3);
    expect(claim.priorPayments).toBe(120);
    expect(claim.estimatedAmountDue).toBe(80);
    expect(claim.serviceLines[0].revenueCode).toBe("0450");
    expect(claim.serviceLines[0].nonCovered).toBe(25);
    // The values the professional paper already held are untouched too.
    expect(claim.serviceLines[0].cpt).toBe("99213");
    expect(claim.serviceLines[0].charge).toBe(250);
  });

  test("box 4 is derived from the line's place of service, box 66 becomes 0", () => {
    const data = loadBlob(7, asV7(institutionalForm()));
    const claim = claimOf(data);

    // POS 23 (emergency room, hospital) → 1 hospital · 3 outpatient · 1 first bill.
    expect(claim.typeOfBill).toBe("131");
    // Locator 66 — this simulator only ever codes ICD-10-CM.
    expect(claim.diagnosisVersion).toBe("0");
    // Nothing that was already captured is lost or guessed.
    expect(claim.patientName).toBe("Lovelace, Ada");
    expect(claim.serviceLines[0].cpt).toBe("99213");
    // Every other locator starts blank or zero, never invented.
    expect(claim.patientStatus).toBe("");
    expect(claim.treatmentAuthorizationCode).toBe("");
    expect(claim.coveredDays).toBe(0);
    expect(claim.priorPayments).toBe(0);
    expect(claim.estimatedAmountDue).toBe(0);
    expect(claim.serviceLines[0].revenueCode).toBe("");
    expect(claim.serviceLines[0].nonCovered).toBe(0);
  });

  test("the frequency digit comes from the claim's own resubmission code", () => {
    const replacement = asV7(institutionalForm({ resubmissionCode: "7" }));
    expect(claimOf(loadBlob(7, replacement)).typeOfBill).toBe("137");

    const voided = asV7(institutionalForm({ resubmissionCode: "8" }));
    expect(claimOf(loadBlob(7, voided)).typeOfBill).toBe("138");
  });

  test("a v8 blob is untouched", () => {
    const current = institutionalForm({
      typeOfBill: "111",
      diagnosisVersion: "0",
      patientStatus: "01",
      principalDiagnosis: "J45.909",
    });
    current.serviceLines = [{ ...current.serviceLines[0], revenueCode: "0450", nonCovered: 25 }];

    const data = loadBlob(8, current);
    expect(data?.v).toBe(8);
    // Nothing is re-derived: even a type of bill that disagrees with the POS stays.
    expect(claimOf(data)).toEqual(current);
  });

  test("a corrupt, absent or unattached blob does not throw", () => {
    const storage = memoryStorage();
    storage.setItem(userDataKey(PHONE), "{ not json");
    install(storage);
    expect(() => loadUserData(PHONE)).not.toThrow();
    expect(loadUserData(PHONE)).toBeNull();

    install(memoryStorage());
    expect(() => loadUserData(PHONE)).not.toThrow();
    expect(loadUserData(PHONE)).toBeNull();

    expect(() => loadUserData(null)).not.toThrow();
    expect(loadUserData(null)).toBeNull();
  });

  test("an encounter with no claim open survives the migration", () => {
    const data = loadBlob(7, null);
    expect(data?.v).toBe(8);
    expect(data?.pipeline?.encounters[PATIENT]?.claimForm ?? null).toBeNull();
  });
});
