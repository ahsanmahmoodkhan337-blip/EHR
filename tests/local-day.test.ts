import { describe, expect, test } from "bun:test";
import { localDay } from "../src/utils/localDay";
import { appealDeadlineFor, daysBetween } from "../src/domain/arWorkQueue";

describe("dates follow the student's own calendar", () => {
  test("a plain calendar date passes through unchanged", () => {
    expect(localDay("2026-11-26")).toBe("2026-11-26");
  });

  test("a timestamp becomes the local date of that moment", () => {
    const d = new Date(2026, 10, 26, 0, 30); // 26 Nov, 12:30 AM local time
    expect(localDay(d)).toBe("2026-11-26");
    expect(localDay(d.toISOString())).toBe("2026-11-26");
  });

  test("AR age counts calendar days and is never negative", () => {
    const justAfterMidnight = new Date(2026, 10, 26, 0, 30).toISOString();
    expect(daysBetween("2026-11-26", justAfterMidnight)).toBe(0);
    expect(daysBetween("2026-11-01", justAfterMidnight)).toBe(25);
  });

  test("the appeal deadline is the remittance date plus the window", () => {
    const deadline = appealDeadlineFor("2026-11-26");
    expect(deadline).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(daysBetween("2026-11-26", deadline)).toBeGreaterThan(0);
  });
});
