import { describe, expect, test } from "bun:test";
import { dotPhraseQuery } from "../src/components/scribe/dotPhraseQuery";

describe("the dot-phrase list opens only for a dot phrase", () => {
  test("a dot phrase at the start of the box or after a space opens it", () => {
    expect(dotPhraseQuery(".oldcarts")).toBe(".oldcarts");
    expect(dotPhraseQuery("HPI: .ol")).toBe(".ol");
    expect(dotPhraseQuery("Denies fever.\n.ros")).toBe(".ros");
  });

  test("the full stop that ends a sentence does not", () => {
    expect(dotPhraseQuery("Denies vomiting, melena, weight loss.")).toBeNull();
    expect(dotPhraseQuery("Follow up in 8 weeks.")).toBeNull();
    expect(dotPhraseQuery("Symptoms consistent with GERD.\n")).toBeNull();
  });

  test("a bare dot, a decimal and an abbreviation do not", () => {
    expect(dotPhraseQuery("Plan: .")).toBeNull();
    expect(dotPhraseQuery("Temp 98.6")).toBeNull();
    expect(dotPhraseQuery("e.g")).toBeNull();
  });
});
