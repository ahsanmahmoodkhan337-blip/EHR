import { describe, expect, test } from "bun:test";
import { askHelpGuide, carcCodesIn, SUGGESTED_QUESTIONS } from "../src/domain/helpGuide";

describe("the built-in help guide answers from the app's own content", () => {
  test("a CARC written any way is found: co45, CO 45 and CO-45", () => {
    expect(carcCodesIn("what is co45")).toEqual(["CO-45"]);
    expect(carcCodesIn("CO 45 meaning")).toEqual(["CO-45"]);
    expect(askHelpGuide("What does CO-45 mean?")[0].title).toStartWith("CO-45");
  });

  test("a code answer gives the meaning and the fix", () => {
    const a = askHelpGuide("PR-1")[0];
    expect(a.kind).toBe("code");
    expect(a.answer).toContain("Fix:");
  });

  test("how-to questions get the on-screen steps and a place to go", () => {
    const a = askHelpGuide("how do I book a new patient")[0];
    expect(a.title).toBe("How do I book a new patient?");
    expect(a.goTo?.to).toBe("/schedule");
  });

  test("RCM terms are explained", () => {
    expect(askHelpGuide("what is coinsurance")[0].title).toContain("Coinsurance");
    expect(askHelpGuide("277CA rejected")[0].title).toContain("277CA");
  });

  test("the read-only tutorial question is answered", () => {
    expect(askHelpGuide("why can't I type in the tutorial")[0].id).toBe("faq-tutorial-readonly");
  });

  test("an empty question returns nothing and nonsense returns nothing made up", () => {
    expect(askHelpGuide("   ")).toEqual([]);
    expect(askHelpGuide("zzqx blorf")).toEqual([]);
  });

  test("every suggested question has an answer", () => {
    for (const q of SUGGESTED_QUESTIONS) expect(askHelpGuide(q).length).toBeGreaterThan(0);
  });
});
