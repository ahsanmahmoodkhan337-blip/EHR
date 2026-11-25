import { describe, expect, test } from "bun:test";
import { routePickDecision } from "../src/domain/encounterRoute";

describe("the address picks its patient once per navigation", () => {
  test("a fresh address switches the chart to its patient", () => {
    expect(routePickDecision({ routeId: "PAT-1", appliedFor: null, selectedId: "DEMO", routePatientLoaded: true })).toBe("apply");
  });

  test("a stale address does not drag the student back after they pick the Tutorial Patient", () => {
    expect(routePickDecision({ routeId: "PAT-1", appliedFor: "PAT-1", selectedId: "DEMO", routePatientLoaded: true })).toBe("skip");
  });

  test("an address whose patient has not loaded yet waits", () => {
    expect(routePickDecision({ routeId: "PAT-1", appliedFor: null, selectedId: "DEMO", routePatientLoaded: false })).toBe("skip");
  });

  test("an address already showing its patient is settled, not re-applied", () => {
    expect(routePickDecision({ routeId: "PAT-1", appliedFor: null, selectedId: "PAT-1", routePatientLoaded: true })).toBe("settled");
  });

  test("a new address after a real navigation applies again", () => {
    expect(routePickDecision({ routeId: "PAT-2", appliedFor: "PAT-1", selectedId: "DEMO", routePatientLoaded: true })).toBe("apply");
  });
});
