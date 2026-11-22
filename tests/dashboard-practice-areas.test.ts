/**
 * dashboard-practice-areas.test.ts — the dashboard's four practice areas
 *
 * Owner's student-experience work order, 2026-11-21, item 6
 * (`specs/owner-student-experience-2026-11-21.md` §3). What is checked here:
 *
 *  - the four groups, in workflow order, hold exactly the ten destinations;
 *  - the five stage-backed tiles print **the pipeline's own stage names**, so
 *    the dashboard and the encounter stepper cannot drift apart;
 *  - every tile carries a one-line description and opens a real address;
 *  - a count is read from the student's saved records — nothing stored by hand;
 *  - the "Signed in on N devices (multi-device)" line left the dashboard footer
 *    and now lives on Settings.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createEncounter, type PipelineEncounter } from "../src/store/pipelineEncounter";
import { makeStatusEvent } from "../src/domain/statusEvent";
import { flowStageLabel } from "../src/domain/encounterFlow";
import { SHELL_NAV_ITEMS } from "../src/components/shell/navItems";
import {
  PRACTICE_AREA_GROUPS,
  PRACTICE_AREA_TILES,
  practiceAreaCounts,
  type PracticeAreaCountInput,
} from "../src/domain/practiceAreas";

const root = join(import.meta.dir, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const NOW = "2026-12-05T10:00:00.000Z";
const nameForPatient = (patientId: string | null | undefined, fallback?: string | null): string =>
  patientId ? `Patient ${patientId}` : fallback ?? "No patient attached";

/** An encounter whose note was signed and locked — the event Sign & Lock writes. */
function signedEncounter(patientId: string, patch: Partial<PipelineEncounter> = {}): PipelineEncounter {
  const base = createEncounter(patientId);
  const event = makeStatusEvent(
    {
      entityType: "encounter",
      entityId: patientId,
      patientId,
      from: "open",
      to: "signed",
      by: "+923000000000",
      jobRole: "scribe",
      reasonCode: "NOTE_SIGNED",
      reason: "The progress note was signed and locked, so the encounter is ready for coding.",
    },
    base.statusEvents,
  );
  return { ...base, stage: "coder", status: "charted", scribeNote: "note", statusEvents: [event], ...patch };
}

function counts(overrides: Partial<PracticeAreaCountInput> = {}) {
  return practiceAreaCounts({
    encounters: [],
    dental: null,
    track: "medical",
    ownPatientCount: 0,
    appointmentsToday: 0,
    paRecords: [],
    caseCount: 0,
    now: NOW,
    nameForPatient,
    ...overrides,
  });
}

describe("four practice areas, in workflow order", () => {
  test("the groups are Front desk · Clinical · Billing · Review", () => {
    expect(PRACTICE_AREA_GROUPS.map((group) => group.label)).toEqual([
      "Front desk",
      "Clinical",
      "Billing",
      "Review",
    ]);
    expect(PRACTICE_AREA_GROUPS.map((group) => group.tiles.map((tile) => tile.id))).toEqual([
      ["schedule", "patients"],
      ["charts", "coding"],
      ["prior-auth", "claims", "payments", "denials-ar"],
      ["reports", "practice-cases"],
    ]);
  });

  test("the stage-backed tiles print the pipeline's own stage names", () => {
    const stageTiles = PRACTICE_AREA_TILES.filter((tile) => tile.stage);
    expect(stageTiles.map((tile) => tile.stage)).toEqual([
      "coding",
      "prior-auth",
      "billing",
      "payments",
      "denials-ar",
    ]);
    for (const tile of stageTiles) {
      expect(tile.label).toBe(flowStageLabel(tile.stage));
    }
  });

  test("every tile has a one-line description and opens a real address", () => {
    const destinations = new Set(SHELL_NAV_ITEMS.map((item) => item.id));
    for (const tile of PRACTICE_AREA_TILES) {
      expect(tile.description.length).toBeGreaterThan(0);
      expect(tile.description).not.toContain("\n");
      // A tile either opens a page in the shell's one list, or a stage.
      expect(Boolean(tile.nav) || Boolean(tile.stage)).toBe(true);
      if (tile.nav) expect(destinations.has(tile.nav)).toBe(true);
      // Prior Auth is the one destination with no page of its own.
      if (tile.id === "prior-auth") expect(tile.nav).toBeUndefined();
    }
  });
});

describe("a count is read from the student's own records", () => {
  test("with no records every tile reads zero", () => {
    const empty = counts();
    for (const tile of PRACTICE_AREA_TILES) {
      if (tile.id === "reports") continue; // Reports carries no count
      expect(empty[tile.id]?.count).toBe(0);
    }
    expect(empty.reports).toBeUndefined();
  });

  test("a signed note and a claim move the coding and claims counts", () => {
    const result = counts({
      encounters: [signedEncounter("MPT-2001", { claimNumber: "CLM-000001" })],
      ownPatientCount: 2,
      appointmentsToday: 3,
      paRecords: [{ status: "submitted" }, { status: "approved" }],
      caseCount: 9,
    });
    expect(result.coding?.count).toBe(1);
    expect(result.claims?.count).toBe(1);
    expect(result.patients?.count).toBe(2);
    expect(result.schedule?.count).toBe(3);
    // One prior auth is still with the payer; the approved one is closed.
    expect(result["prior-auth"]?.count).toBe(1);
    expect(result["practice-cases"]?.count).toBe(9);
    expect(result.claims?.label).toBe("1 claim");
  });
});

describe("the device line moved to Settings", () => {
  const dashboard = read("src/routes/dashboard.tsx");
  const settings = read("src/routes/settings.tsx");

  test("the dashboard footer no longer carries it", () => {
    expect(dashboard).not.toContain("getSharingSignal");
    expect(dashboard).not.toContain("multi-device");
    expect(dashboard).not.toContain("Sign out other devices");
  });

  test("Settings carries the same line and the same control", () => {
    expect(settings).toContain("getSharingSignal");
    expect(settings).toContain("(multi-device)");
    expect(settings).toContain("Sign out other devices");
    expect(settings).toContain("Signed in on {signal.distinctDeviceCount} device");
  });

  test("the dashboard's new hooks sit above its sign-in early return", () => {
    const firstHook = dashboard.indexOf("usePatientStore()");
    const earlyReturn = dashboard.indexOf("if (!loggedIn || !phone)");
    expect(firstHook).toBeGreaterThan(-1);
    expect(earlyReturn).toBeGreaterThan(-1);
    expect(firstHook).toBeLessThan(earlyReturn);
    expect(dashboard.indexOf("useAllAppointments()")).toBeLessThan(earlyReturn);
  });
});
