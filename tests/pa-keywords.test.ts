import { describe, expect, test } from "bun:test";
import { paKeywordsIn } from "../src/components/CodingQueue/CodingQueue";

describe("the PA check reads whole words in the note", () => {
  test("'consistent' is not a stent", () => {
    expect(paKeywordsIn("Symptoms consistent with GERD; no alarm features.")).toEqual([]);
  });
  test("MRI and CT scan match whatever their case", () => {
    expect(paKeywordsIn("order mri of the lumbar spine")).toContain("MRI");
    expect(paKeywordsIn("Plan: CT  scan of the chest")).toContain("CT scan");
  });
  test("a real stent mention still flags", () => {
    expect(paKeywordsIn("Cardiology to consider stent placement.")).toContain("stent");
  });
  test("the everyday word 'procedure' no longer flags", () => {
    expect(paKeywordsIn("Procedure note not applicable today.")).toEqual([]);
  });
});
