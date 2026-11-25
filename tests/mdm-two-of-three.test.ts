import { describe, expect, test } from "bun:test";
import { mdmDataLevel, mdmLevelFromElements, officeEmCode } from "../src/domain/mdm";

describe("E/M level is set by two of the three MDM elements", () => {
  test("a new-patient GERD visit: low problem, minimal data, moderate risk → 99203", () => {
    const mdm = mdmLevelFromElements(2, 1, 3);
    expect(mdm).toBe(2);
    expect(officeEmCode(mdm, true)).toBe("99203");
  });

  test("lots of data with a minor problem and minimal risk stays straightforward", () => {
    const data = mdmDataLevel({ uniqueItems: 5, independentHistorian: true, independentInterpretation: true, externalDiscussion: true });
    expect(data).toBe(4);
    const mdm = mdmLevelFromElements(1, data, 1);
    expect(officeEmCode(mdm, false)).toBe("99212");
  });

  test("two elements at moderate give 99214 even when the third is minimal", () => {
    expect(officeEmCode(mdmLevelFromElements(3, 1, 3), false)).toBe("99214");
  });

  test("two high elements give 99215 / 99205", () => {
    expect(officeEmCode(mdmLevelFromElements(4, 1, 4), false)).toBe("99215");
    expect(officeEmCode(mdmLevelFromElements(4, 4, 2), true)).toBe("99205");
  });

  test("data categories follow the AMA table", () => {
    expect(mdmDataLevel({ uniqueItems: 1, independentHistorian: false, independentInterpretation: false, externalDiscussion: false })).toBe(1);
    expect(mdmDataLevel({ uniqueItems: 2, independentHistorian: false, independentInterpretation: false, externalDiscussion: false })).toBe(2);
    expect(mdmDataLevel({ uniqueItems: 0, independentHistorian: true, independentInterpretation: false, externalDiscussion: false })).toBe(2);
    expect(mdmDataLevel({ uniqueItems: 2, independentHistorian: true, independentInterpretation: false, externalDiscussion: false })).toBe(3);
    expect(mdmDataLevel({ uniqueItems: 0, independentHistorian: false, independentInterpretation: true, externalDiscussion: false })).toBe(3);
    expect(mdmDataLevel({ uniqueItems: 3, independentHistorian: false, independentInterpretation: false, externalDiscussion: true })).toBe(4);
  });
});
