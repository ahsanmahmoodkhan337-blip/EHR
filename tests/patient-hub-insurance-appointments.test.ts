/**
 * Insurance eligibility, check-in and the copay (`specs/patient-hub.md`
 * § Insurance and § Appointments).
 *
 * The promises tested here:
 *   1. A coverage nobody checked reads `not-checked` — never a made-up active —
 *      and a stored 271 is carried forward exactly as it was saved.
 *   2. The simulated 270/271 answers from the record: a payer with a member ID
 *      is active, a payer with no member ID is not, and no payer at all is not.
 *   3. The banner's summary is the result and the date the payer answered.
 *   4. A copay becomes a patient-payment ledger entry on the visit, posting it
 *      twice adds no money, and the banner's figure is read off the appointment
 *      that actually posted it.
 *   5. A v4 record migrates to v5 with no eligibility invented and no check-in
 *      invented, and a v5 appointment keeps the check-in it recorded.
 */
import { describe, expect, test } from "bun:test";
import {
  NOT_CHECKED,
  eligibilityOf,
  eligibilitySummary,
  runEligibility270,
} from "../src/domain/eligibility";
import { copayLedgerEntry, postedCopayForPatient } from "../src/domain/checkIn";
import { appendLedgerEntries, ledgerBalance } from "../src/domain/ledger";
import { SCHEMA_VERSION, migrateEnvelope } from "../src/store/ehrStore";

const AT = "2026-11-20T14:05:00.000Z";

const COVERAGE = {
  payerName: "Northwind Health Plan",
  ediPayerId: "NWIND01",
  subscriberId: "NW-884210",
  groupNumber: "GRP-4471",
  relationshipToSubscriber: "Self",
  planName: "Northwind PPO",
};

describe("the stored 271", () => {
  test("a coverage with no record reads not-checked, with no date and no words", () => {
    expect(eligibilityOf(COVERAGE)).toEqual(NOT_CHECKED);
    expect(eligibilityOf(null)).toEqual(NOT_CHECKED);
    expect(eligibilitySummary(NOT_CHECKED)).toBe("Eligibility not checked");
  });

  test("a stored 271 is carried forward exactly as it was saved", () => {
    const stored = {
      status: "active" as const,
      checkedAt: AT,
      payerResponse: "271: active",
      payerNameOnFile: "Amir Khan",
      cardName: "Amir Khan",
      nameCheck: "match" as const,
    };
    expect(eligibilityOf({ ...COVERAGE, eligibility: stored })).toEqual(stored);
  });

  test("a 271 saved before the name check reads not-compared, never a match", () => {
    // The fields did not exist when this record was written (standing rule 3).
    const older = { status: "active" as const, checkedAt: AT, payerResponse: "271: active" };
    expect(eligibilityOf({ ...COVERAGE, eligibility: older })).toEqual({
      ...older,
      payerNameOnFile: "",
      cardName: "",
      nameCheck: "not-compared",
    });
  });
});

describe("the 270/271 answers from the record", () => {
  test("a payer and a member ID is active, and the reply names both", () => {
    const record = runEligibility270(COVERAGE, AT);
    expect(record.status).toBe("active");
    expect(record.checkedAt).toBe(AT);
    expect(record.payerResponse).toContain("Northwind Health Plan");
    expect(record.payerResponse).toContain("NW-884210");
  });

  test("a payer with no member ID cannot be matched — not eligible", () => {
    const record = runEligibility270({ ...COVERAGE, subscriberId: "" }, AT);
    expect(record.status).toBe("inactive");
    expect(record.payerResponse).toContain("member ID");
  });

  test("no payer on file is not eligible, and says so", () => {
    const record = runEligibility270({ ...COVERAGE, payerName: "" }, AT);
    expect(record.status).toBe("inactive");
    expect(record.payerResponse).toContain("no payer on file");
  });

  test("the banner prints the result and the date checked", () => {
    expect(eligibilitySummary(runEligibility270(COVERAGE, AT))).toBe("Eligible · 11/20/2026");
  });
});

describe("the copay collected at check-in", () => {
  test("it posts as a patient payment that reduces what the patient owes", () => {
    const entry = copayLedgerEntry({
      appointmentId: "apt-3",
      patientId: "P-1001",
      amountUsd: 25,
      at: AT,
      appointmentType: "Follow-up",
    })!;
    expect(entry.type).toBe("patient_payment");
    expect(entry.amountCents).toBe(-2500);
    expect(entry.patientId).toBe("P-1001");
    expect(entry.id).toBe("COPAY-apt-3");
    expect(ledgerBalance([entry]).patientBalanceCents).toBe(-2500);
  });

  test("nothing is posted for a zero or missing amount", () => {
    expect(
      copayLedgerEntry({ appointmentId: "a", patientId: "p", amountUsd: 0, at: AT }),
    ).toBeNull();
    expect(
      copayLedgerEntry({ appointmentId: "a", patientId: "p", amountUsd: Number.NaN, at: AT }),
    ).toBeNull();
  });

  test("collecting the same copay twice adds no money", () => {
    const entry = copayLedgerEntry({
      appointmentId: "apt-3",
      patientId: "P-1001",
      amountUsd: 25,
      at: AT,
    })!;
    const once = appendLedgerEntries([], [entry]);
    const twice = appendLedgerEntries(once, [entry]);
    expect(twice).toHaveLength(1);
    expect(ledgerBalance(twice).patientBalanceCents).toBe(-2500);
  });

  test("the banner reads the copay off the appointment that posted it", () => {
    const appointments = [
      { id: "apt-1", patientId: "P-1001", checkedInAt: AT, copayUsd: 20, copayPostedLedgerEntryId: "COPAY-apt-1" },
      { id: "apt-2", patientId: "P-1001", checkedInAt: "2026-11-21T09:00:00.000Z", copayUsd: 35, copayPostedLedgerEntryId: "COPAY-apt-2" },
      // An amount with no ledger entry behind it is not money the ledger holds.
      { id: "apt-3", patientId: "P-1001", checkedInAt: "2026-11-22T09:00:00.000Z", copayUsd: 50, copayPostedLedgerEntryId: null },
      { id: "apt-4", patientId: "P-2002", checkedInAt: AT, copayUsd: 99, copayPostedLedgerEntryId: "COPAY-apt-4" },
    ];
    const posted = postedCopayForPatient(appointments, "P-1001")!;
    expect(posted.appointmentId).toBe("apt-2");
    expect(posted.copayUsd).toBe(35);
    expect(postedCopayForPatient(appointments, "P-9999")).toBeNull();
  });
});

describe("a saved v4 record migrates without inventing anything", () => {
  test("every coverage gains not-checked, and the appointments gain no check-in", () => {
    const v4 = {
      app: "healthcare-hustlers-ehr",
      schemaVersion: 4,
      updatedAt: "2026-11-19T10:00:00.000Z",
      user: {
        patients: [
          {
            id: "P-1001",
            firstName: "Ada",
            lastName: "Lovelace",
            insuranceRecord: {
              primary: { ...COVERAGE },
              secondary: null,
              source: "registration",
              updatedAt: "2026-11-01T00:00:00.000Z",
            },
          },
        ],
        appointments: [
          { id: "apt-9", patientId: "P-1001", patientName: "Ada Lovelace", date: "2026-11-20", time: "09:00", type: "Follow-up", duration: 30, notes: "", status: "scheduled" },
        ],
      },
    };
    const migrated = migrateEnvelope(v4)!;
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);

    const coverage = migrated.user.patients[0].insuranceRecord!.primary;
    expect(coverage.eligibility).toEqual(NOT_CHECKED);
    expect(coverage.payerName).toBe("Northwind Health Plan");
    expect(coverage.subscriberId).toBe("NW-884210");

    const appointment = migrated.user.appointments[0];
    expect(appointment.checkedInAt).toBeNull();
    expect(appointment.copayUsd).toBeNull();
    expect(appointment.copayPostedLedgerEntryId).toBeNull();
    expect(appointment.status).toBe("scheduled");
  });

  test("a check-in a v5 record already holds survives the load", () => {
    const v5 = {
      app: "healthcare-hustlers-ehr",
      schemaVersion: SCHEMA_VERSION,
      updatedAt: "2026-11-20T10:00:00.000Z",
      user: {
        appointments: [
          {
            id: "apt-9",
            patientId: "P-1001",
            patientName: "Ada Lovelace",
            date: "2026-11-20",
            time: "09:00",
            type: "Follow-up",
            duration: 30,
            notes: "",
            status: "arrived",
            checkedInAt: AT,
            copayUsd: 25,
            copayPostedLedgerEntryId: "COPAY-apt-9",
          },
        ],
      },
    };
    const migrated = migrateEnvelope(v5)!;
    const appointment = migrated.user.appointments[0];
    expect(appointment.status).toBe("arrived");
    expect(appointment.checkedInAt).toBe(AT);
    expect(appointment.copayUsd).toBe(25);
    expect(appointment.copayPostedLedgerEntryId).toBe("COPAY-apt-9");
  });
});
