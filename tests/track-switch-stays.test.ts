import { describe, expect, test } from "bun:test";
import { trackBoundPath } from "../src/components/shell/AppHeader";
import { headerNavForPath } from "../src/domain/breadcrumb";

describe("the Medical/Dental switch only changes sides", () => {
  test("pages that follow the track stay where they are", () => {
    for (const path of ["/dashboard", "/schedule", "/patients", "/coding", "/claims", "/payments", "/denials-ar", "/reports", "/settings", "/reference", "/cases"]) {
      expect({ path, bound: trackBoundPath(path) }).toEqual({ path, bound: false });
    }
  });

  test("a page that belongs to one track sends the student to the dashboard", () => {
    for (const path of ["/", "/encounter/DEMO/coding", "/charts", "/cases/medical/MCASE-001/front-desk", "/practice-ar"]) {
      expect({ path, bound: trackBoundPath(path) }).toEqual({ path, bound: true });
    }
  });

  test("Practice cases is a header link of its own and lights up on case pages", () => {
    expect(headerNavForPath("/cases")).toBe("cases");
    expect(headerNavForPath("/cases/dental/DCASE-001/claim")).toBe("cases");
    expect(headerNavForPath("/practice-ar")).toBe("cases");
  });
});
