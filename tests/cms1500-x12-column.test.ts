/**
 * CMS-1500 → 837P: the third column.
 *
 * The owner's standing rule is real box numbers AND X12 names, so every box on
 * the CMS-1500 field table carries the 837P segment and element it becomes.
 * This test holds the table to `specs/x12-column-map.md`:
 *   - every printed box has a name, and no name belongs to another transaction
 *     set (the UB-04 is an 837I, the ADA form an 837D — only this paper is an
 *     837P);
 *   - the boxes the 837P genuinely has no element for say `paper-only`, and the
 *     one element whose qualifier is unsettled says so, rather than inventing
 *     a name;
 *   - the traps the spec calls out stay right: box 1a is the subscriber's
 *     member ID and not `SBR03`/`SBR04`, box 21 is `HI` (SV1 carries no
 *     diagnosis), and box 27 (`CLM07`) is not box 31 (`CLM06`).
 */
import { describe, expect, test } from "bun:test";
import { CMS1500_LAYOUT, CMS1500_LINE_COLUMNS, type ClaimBox } from "../src/data/claims/cms1500Layout";

const boxes: ClaimBox[] = CMS1500_LAYOUT.rows.flatMap((row) => row.cells);
const byId = (id: string): ClaimBox => {
  const box = boxes.find((b) => b.id === id);
  if (!box) throw new Error(`no box ${id} on the CMS-1500 layout`);
  return box;
};
const x12Of = (id: string): string => byId(id).x12 ?? "";

describe("every CMS-1500 box carries its 837P name", () => {
  test("the paper declares the 837P, not another transaction set", () => {
    expect(CMS1500_LAYOUT.x12Set).toBe("837P");
  });

  test("every box has a name", () => {
    const unnamed = boxes.filter((b) => !b.x12 || b.x12.trim() === "").map((b) => b.id);
    expect(unnamed).toEqual([]);
  });

  test("no box borrows an 837I or 837D name", () => {
    for (const box of boxes) {
      expect(box.x12 ?? "").not.toMatch(/837[ID]/);
      expect(box.x12 ?? "").not.toMatch(/SV[23]0/); // SV2xx is 837I, SV3xx is 837D
      expect(box.x12 ?? "").not.toMatch(/UB-04|ADA/);
    }
  });

  test("each box id is printed once", () => {
    const ids = boxes.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("the boxes with no 837P element say so", () => {
  test("box 8, 9c, 11d and the reserved box 30 are paper-only", () => {
    for (const id of ["8", "9c", "11d", "30"]) {
      expect(x12Of(id)).toBe("paper-only");
    }
  });

  test("paper-only is claimed nowhere else", () => {
    const paperOnly = boxes.filter((b) => b.x12 === "paper-only").map((b) => b.id).sort();
    expect(paperOnly).toEqual(["11d", "30", "8", "9c"]);
  });

  test("box 11b names the segment but not a guessed qualifier", () => {
    expect(x12Of("11b")).toContain("REF");
    expect(x12Of("11b")).toContain("undetermined");
    // F8 is box 22a's qualifier — printing it on 11b is the error the spec names.
    expect(x12Of("11b")).not.toContain("F8");
    expect(x12Of("22")).toBe("CLM05-3");
  });
});

describe("the mapping follows the spec", () => {
  // box → a fragment the 837P element must contain
  const EXPECTED: Record<string, string> = {
    "1": "SBR05",
    "1a": "NM1*IL",
    "2": "NM1*QC",
    "3": "DMG02",
    "4": "NM1*IL",
    "5": "N3",
    "6": "PAT01",
    "7": "N3",
    "9": "NM1*IL",
    "9a": "SBR03",
    "9b": "DMG02",
    "9d": "SBR04",
    "10": "CLM11",
    "11": "SBR03",
    "11a": "DMG02",
    "11c": "SBR04",
    "12": "CLM09",
    "13": "CLM08",
    "14": "DTP*431",
    "15": "DTP01",
    "16": "DTP*314",
    "17": "NM1*DN",
    "17a": "REF*G2",
    "17b": "NM108=XX",
    "18": "DTP*435",
    "19": "NTE",
    "20": "PS1",
    "21": "HI",
    "22": "CLM05-3",
    "23": "REF*G1",
    "24": "SV1",
    "25": "REF*EI",
    "26": "CLM01",
    "27": "CLM07",
    "28": "CLM02",
    "29": "AMT*F5",
    "31": "CLM06",
    "32": "NM1*77",
    "33": "NM1*85",
  };

  for (const [id, fragment] of Object.entries(EXPECTED)) {
    test(`box ${id} is ${fragment}`, () => {
      expect(x12Of(id)).toContain(fragment);
    });
  }

  test("box 18 names both hospitalization segments", () => {
    expect(x12Of("18")).toContain("435");
    expect(x12Of("18")).toContain("096");
  });

  test("box 1a is the member ID, never the group number or plan name", () => {
    expect(x12Of("1a")).toContain("NM108=MI");
    expect(x12Of("1a")).not.toContain("SBR03");
    expect(x12Of("1a")).not.toContain("SBR04");
  });

  test("box 21 is HI — SV1 never carries a diagnosis", () => {
    expect(x12Of("21").startsWith("HI")).toBe(true);
    expect(x12Of("21")).not.toContain("SV1");
  });

  test("box 27 and box 31 are not swapped", () => {
    expect(x12Of("27")).toBe("CLM07");
    expect(x12Of("31")).toBe("CLM06");
  });

  test("the refusals the spec requires are stated, not hidden", () => {
    expect(x12Of("20")).toContain("PS102");
    expect(byId("20").x12Note ?? "").toContain("YES/NO");
    expect(byId("25").x12Note ?? "").toContain("SSN/EIN");
    expect(byId("11b").x12Note ?? "").toContain("F8");
    expect(byId("33").x12Note ?? "").toContain("duplicates box 25");
  });
});

describe("box 24's eleven columns carry their own element", () => {
  test("there are eleven columns and their widths fill the table", () => {
    expect(CMS1500_LINE_COLUMNS).toHaveLength(11);
    const total = CMS1500_LINE_COLUMNS.reduce((sum, col) => sum + col.width, 0);
    expect(Math.round(total * 100) / 100).toBe(1);
  });

  test("every column has a name", () => {
    expect(CMS1500_LINE_COLUMNS.filter((col) => !col.x12).map((col) => col.key)).toEqual([]);
  });

  test("the service-line elements are the spec's", () => {
    const x12 = (box: string) =>
      CMS1500_LINE_COLUMNS.filter((col) => col.box === box)
        .map((col) => col.x12)
        .join(" ");
    expect(x12("24A")).toContain("DTP*472");
    expect(x12("24B")).toContain("SV105");
    expect(x12("24C")).toBe("SV109");
    expect(x12("24D")).toContain("SV101");
    expect(x12("24E")).toBe("SV107");
    expect(x12("24F")).toBe("SV102");
    expect(x12("24G")).toContain("SV104");
    expect(x12("24H")).toContain("SV111");
    expect(x12("24I")).toContain("NM108");
    expect(x12("24J")).toContain("NM1*82");
  });

  test("no column borrows an 837I or 837D name", () => {
    for (const col of CMS1500_LINE_COLUMNS) {
      expect(col.x12).not.toMatch(/SV[23]0/);
    }
  });
});
