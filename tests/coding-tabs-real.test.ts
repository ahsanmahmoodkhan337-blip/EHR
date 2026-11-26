import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(join(import.meta.dir, "../src/components/CodingQueue/CodingQueue.tsx"), "utf8");

describe("every Coding tab shows something different", () => {
  test("ICD-10 and CPT are one tab, and there is no separate CPT tab that does nothing", () => {
    expect(SRC).toContain('label: "Codes (ICD-10 & CPT)"');
    expect(SRC).not.toContain('"CPT Codes"');
    expect(SRC).not.toContain('"E/M Level"');
  });

  test("the tabs are real tabs that switch the workspace", () => {
    expect(SRC).toContain('role="tablist"');
    expect(SRC).toContain('onClick={() => setShowConventions(tab.id === "conventions")}');
  });
});
