/**
 * CMS-1500 field-table corrections — the box data, the edit checks, and the
 * v6 → v7 blob migration that carries a saved claim across them.
 *
 * Spec: `specs/claim-field-table-audit.md` ("Build-ready corrections").
 */
import { describe, expect, test } from "bun:test";
import { CMS1500_LAYOUT, OTHER_DATE_QUALIFIERS, ID_QUALIFIER_OPTIONS } from "../src/data/claims/cms1500Layout";
import { blankClaimForm, blankServiceLine, patientIdentityBoxes } from "../src/utils/claimAutoFill";
import { validateCMS1500 } from "../src/utils/claimValidation";
import { migrateClaimFormToV7 } from "../src/store/persistence";
import type { ClaimFormData } from "../src/store/pipelineEncounter";
import type { Patient } from "../src/store/patientStore";

const boxes = CMS1500_LAYOUT.rows.flatMap((r) => r.cells);
const box = (id: string) => boxes.find((b) => b.id === id);
const boxOrder = boxes.map((b) => b.id);

function form(overrides: Partial<ClaimFormData> = {}): ClaimFormData {
  return { ...blankClaimForm(), ...overrides };
}

describe("the printed boxes", () => {
  test("9a / 9b / 9d are their own boxes on a second row", () => {
    expect(box("9a")?.label).toBe("9a. OTHER INSURED'S POLICY OR GROUP NUMBER");
    expect(box("9b")?.label).toBe("9b. OTHER INSURED'S DATE OF BIRTH  SEX");
    expect(box("9d")?.label).toBe("9d. INSURANCE PLAN NAME OR PROGRAM NAME");
    expect(box("9")?.label).toBe(
      "9. OTHER INSURED'S NAME (Last Name, First Name, Middle Initial)",
    );
    expect(box("9a")?.fields?.[0].field).toBe("otherInsuredPolicyGroup");
    expect(box("9d")?.fields?.[0].field).toBe("otherInsurancePlan");
  });

  test("10d is a field in box 10, with no demo value of its own", () => {
    const ten = box("10");
    expect(ten?.checks?.length).toBe(3);
    expect(ten?.fields?.[0].field).toBe("claimCodes");
    expect(ten?.fields?.[0].label).toBe("10d. CLAIM CODES (Designated by NUCC)");
  });

  test("11a carries the insured's sex beside the date of birth", () => {
    expect(box("11a")?.label).toBe("11a. INSURED'S DATE OF BIRTH  SEX");
    expect(box("11a")?.fields?.map((f) => f.field)).toEqual(["insuredDob", "insuredSex"]);
  });

  test("15 carries its QUAL. qualifier", () => {
    expect(box("15")?.label).toBe("15. OTHER DATE  QUAL.");
    expect(box("15")?.fields?.[0].field).toBe("similarIllnessQualifier");
    expect(OTHER_DATE_QUALIFIERS.map((o) => o.value)).toContain("431");
  });

  test("box 22 is one stacked cell with no 22a, printed below box 21", () => {
    expect(box("22a")).toBeUndefined();
    expect(box("22")?.stack).toBe(true);
    expect(box("22")?.fields?.map((f) => f.field)).toEqual([
      "resubmissionCode",
      "originalClaimNumber",
    ]);
    expect(boxOrder.indexOf("22")).toBeGreaterThan(boxOrder.indexOf("21"));
  });

  test("box 25 asks which kind of tax I.D. it is", () => {
    expect(box("25")?.label).toBe("25. FEDERAL TAX I.D. NUMBER  SSN / EIN");
    expect(box("25")?.fields?.map((f) => f.field)).toEqual(["federalTaxIdType", "federalTaxId"]);
  });

  test("box 24 prints 24C / 24H / 24I", () => {
    const caption = box("24")?.label ?? "";
    for (const part of ["C. EMG", "H. EPSDT FAMILY PLAN", "I. ID. QUAL.", "J. RENDERING PROVIDER ID. #"]) {
      expect(caption).toContain(part);
    }
    expect(ID_QUALIFIER_OPTIONS[0]).toEqual({ value: "XX", label: "XX — NPI" });
  });
});

describe("the fill", () => {
  test("24I is XX on every line, and 24C / 24H stay blank", () => {
    const line = blankServiceLine();
    expect(line.idQualifier).toBe("XX");
    expect(line.emg).toBeUndefined();
    expect(line.epsdt).toBeUndefined();
  });

  test("box 25's type comes from the provider profile", () => {
    expect(form().federalTaxIdType).toBe("EIN");
  });

  test("the other-coverage block reads 9a / 9b / 9d from the secondary plan", () => {
    const patient = {
      id: "p1",
      mrn: "MRN1",
      firstName: "Ada",
      lastName: "Lovelace",
      dateOfBirth: "1980-01-02",
      gender: "Female",
      address: "1 Main St",
      insurance: "",
      encounters: [],
      insuranceRecord: {
        primary: {
          payerName: "Northwind Health Plan",
          ediPayerId: "NWIND01",
          subscriberId: "SUB-1",
          groupNumber: "G-9",
          relationshipToSubscriber: "Self",
          subscriberName: "Ada Lovelace",
          subscriberDob: "1980-01-02",
          subscriberSex: "F",
          planName: "Gold",
        },
        secondary: {
          payerName: "Cedar Mutual",
          ediPayerId: "CEDAR01",
          subscriberId: "SUB-2",
          groupNumber: "G-2",
          relationshipToSubscriber: "Spouse",
          subscriberName: "Charles Babbage",
          subscriberDob: "1979-12-26",
          subscriberSex: "M",
          planName: "Silver",
        },
        source: "registration",
        updatedAt: "",
      },
    } as unknown as Patient;

    const boxes = patientIdentityBoxes(patient, "Lovelace, Ada");
    expect(boxes.otherInsuranceName).toBe("Cedar Mutual");
    expect(boxes.otherInsurancePlan).toBe("Silver");
    expect(boxes.otherInsuredPolicyGroup).toBe("G-2");
    expect(boxes.otherInsuredDob).toBe("1979-12-26");
    expect(boxes.otherInsuredSex).toBe("M");
    // Box 11a SEX for a dependant is the subscriber's, not the patient's.
    expect(boxes.insuredSex).toBe("F");
  });
});

describe("the edit checks", () => {
  const issuesFor = (overrides: Partial<ClaimFormData>) => validateCMS1500(form(overrides));

  test("box 25 names the tax I.D. type it wants", () => {
    expect(issuesFor({ federalTaxIdType: "" }).some((i) => i.box === "25" && i.severity === "error")).toBe(true);
    const ssn = issuesFor({ federalTaxIdType: "SSN", federalTaxId: "12-3456789" });
    expect(ssn.some((i) => i.box === "25" && /SSN must be in XXX-XX-XXXX/.test(i.message))).toBe(true);
    const ein = issuesFor({ federalTaxIdType: "EIN", federalTaxId: "12-3456789" });
    expect(ein.some((i) => i.box === "25")).toBe(false);
  });

  test("box 15 warns when a date has no qualifier", () => {
    const issues = issuesFor({ similarIllnessDate: "2026-07-08", similarIllnessQualifier: "" });
    expect(issues.some((i) => i.box === "15" && i.severity === "warn")).toBe(true);
    const ok = issuesFor({ similarIllnessDate: "2026-07-08", similarIllnessQualifier: "431" });
    expect(ok.some((i) => i.box === "15")).toBe(false);
  });

  test("box 11a warns when the insured's sex is blank", () => {
    expect(issuesFor({ insuredSex: "" }).some((i) => i.box === "11a" && i.severity === "warn")).toBe(true);
  });

  test("24I and 24J check each other", () => {
    const line = { ...blankServiceLine("2026-07-09"), cpt: "99214", charge: 100 };
    const mismatched = issuesFor({
      serviceLines: [{ ...line, idQualifier: "1D", renderingNpi: "1629034814" }],
    });
    expect(mismatched.some((i) => i.box === "24I" && i.severity === "warn")).toBe(true);

    const missingId = issuesFor({
      serviceLines: [{ ...line, idQualifier: "XX", renderingNpi: "" }],
    });
    expect(missingId.some((i) => i.box === "24J" && i.severity === "error")).toBe(true);
  });

  test("a corrected claim quotes box 22, not 22a", () => {
    const issues = issuesFor({ resubmissionCode: "7", originalClaimNumber: "" });
    const issue = issues.find((i) => i.box === "22");
    expect(issue?.message).toContain("ORIGINAL REF. NO.");
    expect(issues.some((i) => i.box === "22a")).toBe(false);
  });
});

describe("v6 → v7 blob migration", () => {
  test("splits planName · groupNumber into 9d and 9a, dropping nothing", () => {
    const old = form({ otherInsurancePlan: "Silver · G-2" });
    delete (old as unknown as Record<string, unknown>).otherInsuredPolicyGroup;
    const next = migrateClaimFormToV7(old);
    expect(next.otherInsurancePlan).toBe("Silver");
    expect(next.otherInsuredPolicyGroup).toBe("G-2");
  });

  test("keeps a plan name that never carried a group number", () => {
    const next = migrateClaimFormToV7(form({ otherInsurancePlan: "Silver" }));
    expect(next.otherInsurancePlan).toBe("Silver");
    expect(next.otherInsuredPolicyGroup).toBe("");
  });

  test("fills box 25's type and 24I, and leaves the new boxes blank", () => {
    const old = form();
    const raw = old as unknown as Record<string, unknown>;
    delete raw.federalTaxIdType;
    delete raw.otherInsuredDob;
    delete raw.insuredSex;
    delete raw.similarIllnessQualifier;
    delete raw.claimCodes;
    old.serviceLines = [{ ...blankServiceLine("2026-07-09"), cpt: "99214", charge: 100 }];
    delete (old.serviceLines[0] as unknown as Record<string, unknown>).idQualifier;

    const next = migrateClaimFormToV7(old);
    expect(next.federalTaxIdType).toBe("EIN");
    expect(next.serviceLines[0].idQualifier).toBe("XX");
    expect(next.otherInsuredDob).toBe("");
    expect(next.insuredSex).toBe("");
    expect(next.similarIllnessQualifier).toBe("");
    expect(next.claimCodes).toBe("");
    // Nothing that was already there is lost.
    expect(next.federalTaxId).toBe(old.federalTaxId);
    expect(next.serviceLines[0].cpt).toBe("99214");
  });

  test("is idempotent — a second pass changes nothing", () => {
    const once = migrateClaimFormToV7(form({ otherInsurancePlan: "Silver · G-2" }));
    const twice = migrateClaimFormToV7(once);
    expect(twice).toEqual(once);
  });
});
