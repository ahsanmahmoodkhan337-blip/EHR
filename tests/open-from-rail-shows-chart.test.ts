import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const INDEX = readFileSync(join(import.meta.dir, "../src/routes/index.tsx"), "utf8");

describe("a row opened from Claims, Payments or Denials lands on the chart", () => {
  test("the picked patient opens on the chart workspace, not the Daily Schedule", () => {
    const start = INDEX.indexOf("const requested = consumeRequestedPatient();");
    const branch = INDEX.slice(start, INDEX.indexOf("if (requested.name) {", start));
    expect(branch).toContain("if (requested.role) setRole(requested.role);");
    expect(branch).toContain('setActiveWorkspace("chart");');
  });

  test("an encounter address starts on the chart", () => {
    expect(INDEX).toContain('useWorkspaceTabs(encounterIdFromRoute ? "chart" : "schedule")');
  });
});
