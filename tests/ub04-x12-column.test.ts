/**
 * UB-04 to 837I: the third column.
 *
 * The owner's standing rule is real box numbers AND X12 names, so every locator
 * on the UB-04 field table carries the 837I segment and element it becomes.
 * This test holds the table to `specs/x12-column-map.md`:
 *   - the paper declares the 837I, and no locator borrows an 837P or 837D name
 *     (SV1 is the professional line, SV3 the dental line; an institutional
 *     bill uses SV2);
 *   - the locators the 837I genuinely has no element for say `paper-only`, and
 *     the ones whose qualifier is unsettled say `undetermined`, rather than
 *     inventing a name;
 *   - the traps the spec calls out stay right: box 60 is the member ID
 *     (`NM108=MI`) and box 62 the group number (`SBR03`), box 66 is not an
 *     element at all (the HI qualifier encodes the ICD-10 version), and the
 *     service-line table's columns are SV2 / DTP, never SV1.
 */
import { describe, expect, test } from "bun:test";
import { UB04_LAYOUT, UB04_LINE_COLUMNS, type ClaimBox } from "../src/data/claims/ub04Layout";

const boxes: ClaimBox[] = UB04_LAYOUT.rows.flatMap((row) => row.cells);
const byId = (id: string): ClaimBox => {
  const box = boxes.find((b) => b.id === id);
  if (!box) throw new Error(`no locator ${id} on the UB-04 layout`);
  return box;
};
const x12Of = (id: string): string => byId(id).x12 ?? "";

describe("every UB-04 locator carries its 837I name", () => {
  test("the paper declares the 837I, not another transaction set", () => {
    expect(UB04_LAYOUT.x12Set).toBe("837I");
  });

  test("every locator has a name", () => {
    const unnamed = boxes.filter((b) => !b.x12 || b.x12.trim() === "").map((b) => b.id);
    expect(unnamed).toEqual([]);
  });

  test("no locator borrows an 837P or 837D name", () => {
    for (const box of boxes) {
      const name = box.x12 ?? "";
      expect(name).not.toMatch(/837[PD]/);
      expect(name).not.toMatch(/SV1\d/); // SV1xx is 837P
      expect(name).not.toMatch(/SV3\d/); // SV3xx is 837D
      expect(name).not.toMatch(/TOO/); // dental tooth segment
      expect(name).not.toMatch(/PS1/); // 837P outside lab
    }
  });

  test("each locator id is printed once", () => {
    const ids = boxes.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("the locators with no 837I element say so", () => {
  test("the reserved boxes and the responsible party are paper-only", () => {
    for (const id of ["30", "37", "38", "65", "68", "75"]) {
      expect(x12Of(id)).toBe("paper-only");
    }
  });

  test("paper-only is claimed nowhere else", () => {
    const paperOnly = boxes
      .filter((b) => b.x12 === "paper-only")
      .map((b) => b.id)
      .sort();
    expect(paperOnly).toEqual(["30", "37", "38", "65", "66", "68", "75"]);
  });

  test("box 66 is paper-only and says why", () => {
    expect(x12Of("66")).toBe("paper-only");
    expect(byId("66").x12Note ?? "").toContain("ABK");
  });

  test("an unsettled qualifier says undetermined instead of a guess", () => {
    expect(x12Of("7")).toContain("undetermined");
    expect(x12Of("54")).toContain("undetermined");
    expect(x12Of("73")).toContain("undetermined");
    expect(x12Of("79")).toBe("undetermined");
  });

  test("the reserved boxes print nothing and name nothing", () => {
    for (const id of ["30", "37", "65", "68", "75"]) {
      expect(byId(id).reserved).toBe(true);
    }
  });
});

describe("the traps the spec calls out stay right", () => {
  const EXPECTED: Record<string, string> = {
    "1": "NM1*85",
    "3a": "CLM01",
    "4": "CLM05-1",
    "6": "DTP*434",
    "12": "DTP*435",
    "14": "CL1-01",
    "17": "CL1-03",
    "18": "HI*BG",
    "31": "HI*BH",
    "39": "HI*BE",
    "42": "SV201",
    "50": "NM1*PR",
    "52": "CLM09",
    "53": "CLM07",
    "56": "NM1*85",
    "63": "REF*G1",
    "64": "REF*F8",
    "67": "HI*ABK",
    "67A": "HI*ABF",
    "69": "HI*ABJ",
    "76": "NM1*71",
    "80": "NTE",
  };

  for (const [id, fragment] of Object.entries(EXPECTED)) {
    test(`locator ${id} is ${fragment}`, () => {
      expect(x12Of(id)).toContain(fragment);
    });
  }

  test("box 60 is the member ID, box 62 the group number, box 61 the plan name", () => {
    expect(x12Of("60")).toContain("NM108=MI");
    expect(x12Of("62")).toBe("SBR03");
    expect(x12Of("61")).toBe("SBR04");
  });

  test("box 4 splits the three printed digits across CLM05", () => {
    expect(x12Of("4")).toContain("CLM05-2=A");
    expect(x12Of("4")).toContain("CLM05-3");
  });
});

describe("the service-line table's columns carry their own element", () => {
  test("seven columns that leave room for the row controls", () => {
    expect(UB04_LINE_COLUMNS).toHaveLength(7);
    const total = UB04_LINE_COLUMNS.reduce((sum, col) => sum + col.width, 0);
    // The printed table keeps a slice for the add / remove buttons, so the
    // columns sum to less than the whole width — never more.
    expect(total).toBeGreaterThan(0.9);
    expect(total).toBeLessThanOrEqual(1);
  });

  test("every column has a name", () => {
    expect(UB04_LINE_COLUMNS.filter((col) => !col.x12).map((col) => col.key)).toEqual([]);
  });

  test("the elements are the spec's", () => {
    const x12 = (key: string) => UB04_LINE_COLUMNS.find((c) => c.key === key)?.x12 ?? "";
    expect(x12("revenueCode")).toBe("SV201");
    expect(x12("revenueDescription")).toBe("paper-only");
    expect(x12("cpt")).toContain("SV202");
    expect(x12("dateOfService")).toBe("DTP*472");
    expect(x12("units")).toContain("SV205");
    expect(x12("charge")).toBe("SV203");
    expect(x12("nonCovered")).toContain("undetermined");
  });

  test("no column borrows an 837P or 837D name", () => {
    for (const col of UB04_LINE_COLUMNS) {
      expect(col.x12 ?? "").not.toMatch(/SV1\d/);
      expect(col.x12 ?? "").not.toMatch(/SV3\d/);
    }
  });
});
