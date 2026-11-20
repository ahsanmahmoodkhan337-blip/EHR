/**
 * ADA Dental Claim Form to 837D: the third column.
 *
 * The owner's standing rule is real box numbers AND X12 names, so every box on
 * the ADA field table carries the 837D segment and element it becomes. This
 * test holds the table to `specs/x12-column-map.md`:
 *   - the paper declares the 837D, and no box borrows an 837P or 837I name
 *     (SV1 is the professional line, SV2 the institutional line; a dental
 *     claim uses SV3);
 *   - the boxes the 837D genuinely has no element for say `paper-only`, and the
 *     ones whose element is unsettled say `undetermined`, rather than inventing
 *     a name;
 *   - the traps the spec calls out stay right: box 9 is the subscriber ID
 *     (`NM108=MI`) and box 10 the group number (`SBR03`), box 17 is the
 *     practice's own account number (`CLM01`), and box 38 is a Y/N code
 *     (`CLM06`) — a typed dentist name is carried by no segment.
 */
import { describe, expect, test } from "bun:test";
import { ADA_LAYOUT, ADA_LINE_COLUMNS, type ClaimBox } from "../src/data/claims/adaLayout";

const cells: ClaimBox[] = ADA_LAYOUT.rows.flatMap((row) => row.cells);
const boxes = cells.filter((c) => c.structural !== "band");
const bands = cells.filter((c) => c.structural === "band");
const byId = (id: string): ClaimBox => {
  const box = boxes.find((b) => b.id === id);
  if (!box) throw new Error(`no box ${id} on the ADA layout`);
  return box;
};
const x12Of = (id: string): string => byId(id).x12 ?? "";

describe("every ADA box carries its 837D name", () => {
  test("the paper declares the 837D, not another transaction set", () => {
    expect(ADA_LAYOUT.x12Set).toBe("837D");
  });

  test("every box has a name", () => {
    const unnamed = boxes.filter((b) => !b.x12 || b.x12.trim() === "").map((b) => b.id);
    expect(unnamed).toEqual([]);
  });

  test("no box borrows an 837P or 837I name", () => {
    for (const box of boxes) {
      const name = box.x12 ?? "";
      expect(name).not.toMatch(/837[PI]/);
      expect(name).not.toMatch(/SV1\d/); // SV1xx is 837P
      expect(name).not.toMatch(/SV2\d/); // SV2xx is 837I
      expect(name).not.toMatch(/CLM11/); // 837P related-cause composite
      expect(name).not.toMatch(/CL1/); // 837I admission segment
      expect(name).not.toMatch(/UB-04|CMS-1500/);
    }
  });

  test("each box id is printed once", () => {
    const ids = boxes.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("the section bands are headings, so they carry no segment", () => {
    expect(bands.length).toBeGreaterThan(0);
    expect(bands.filter((b) => b.x12).map((b) => b.id)).toEqual([]);
  });
});

describe("the boxes with no 837D element say so", () => {
  test("the phone, address and status boxes are paper-only", () => {
    for (const id of ["6", "14", "22", "23", "25", "32", "35", "36"]) {
      expect(x12Of(id)).toBe("paper-only");
    }
  });

  test("paper-only is claimed nowhere else", () => {
    const paperOnly = boxes
      .filter((b) => b.x12 === "paper-only")
      .map((b) => b.id)
      .sort();
    expect(paperOnly).toEqual(["14", "22", "23", "25", "32", "35", "36", "6"]);
  });

  test("an unsettled element says undetermined instead of a guess", () => {
    expect(x12Of("1")).toContain("undetermined");
    expect(x12Of("2")).toContain("undetermined");
    expect(x12Of("27")).toBe("undetermined");
    expect(x12Of("28")).toBe("undetermined");
  });

  test("box 25 says why it has no element", () => {
    expect(byId("25").x12Note ?? "").toContain("marital");
  });
});

describe("the traps the spec calls out stay right", () => {
  const EXPECTED: Record<string, string> = {
    "3": "SBR01",
    "4": "NM1*IL",
    "5": "N3",
    "7": "DMG02",
    "8": "DMG03",
    "9": "NM108=MI",
    "10": "SBR03",
    "11": "SBR04",
    "12": "NM1*QC",
    "15": "DMG02",
    "16": "DMG03",
    "17": "CLM01",
    "18": "PAT01",
    "20": "NM1*82",
    "21": "NM108=XX",
    "24": "CLM05-1",
    "26": "DTP*439",
    "29": "NTE",
    "30": "HI",
    "31": "SV3",
    "33": "CLM02",
    "34": "AMT*F5",
    "37": "CLM09",
    "38": "CLM06",
  };

  for (const [id, fragment] of Object.entries(EXPECTED)) {
    test(`box ${id} is ${fragment}`, () => {
      expect(x12Of(id)).toContain(fragment);
    });
  }

  test("box 9 is the member ID and box 10 the group number", () => {
    expect(x12Of("9")).toContain("NM108=MI");
    expect(x12Of("9")).not.toContain("SBR03");
    expect(x12Of("10")).toBe("SBR03");
  });

  test("box 17 is the practice's account number, not a payer ID", () => {
    expect(x12Of("17")).toBe("CLM01");
    expect(byId("17").x12Note ?? "").toContain("account number");
  });

  test("box 38 is a Y/N code, and the note says the typed name is not carried", () => {
    expect(x12Of("38")).toBe("CLM06");
    expect(byId("38").x12Note ?? "").toContain("typed name");
  });
});

describe("box 31's eight columns carry their own element", () => {
  test("eight columns that fit the table", () => {
    expect(ADA_LINE_COLUMNS).toHaveLength(8);
    const total = ADA_LINE_COLUMNS.reduce((sum, col) => sum + col.width, 0);
    // A slice is kept for the add / remove buttons, so the columns fill the
    // table without overrunning it.
    expect(total).toBeGreaterThan(0.9);
    expect(total).toBeLessThanOrEqual(1);
  });

  test("every column has a name", () => {
    expect(ADA_LINE_COLUMNS.filter((col) => !col.x12).map((col) => col.key)).toEqual([]);
  });

  test("the elements are the spec's", () => {
    const x12 = (key: string) => ADA_LINE_COLUMNS.find((c) => c.key === key)?.x12 ?? "";
    expect(x12("dateOfService")).toBe("DTP*472");
    expect(x12("cdt")).toContain("SV301");
    expect(x12("description")).toBe("paper-only");
    expect(x12("tooth")).toContain("TOO01");
    expect(x12("surface")).toBe("TOO02");
    expect(x12("quadrant")).toBe("TOO03");
    expect(x12("fee")).toBe("SV302");
    expect(x12("units")).toBe("SV306");
  });

  test("no column borrows an 837P or 837I name", () => {
    for (const col of ADA_LINE_COLUMNS) {
      expect(col.x12).not.toMatch(/SV1\d/);
      expect(col.x12).not.toMatch(/SV2\d/);
    }
  });
});
