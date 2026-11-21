/**
 * Build 5 — the behaviour defects the owner and the lead found by eye
 *
 * Sources: `specs/owner-student-experience-2026-11-21.md` item 4 (the four bugs),
 * `specs/lead-walk-findings-2026-11-21.md` (initials, "2d idle", the literal
 * Inbox badge) and `specs/slice-note-behaves.md` (the dropped keystrokes).
 *
 * Each rule is tested where it lives: the pure module that decides it, or a
 * source assertion on the one place that could break it.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { completedFlowStages, ENCOUNTER_FLOW_STAGES } from "../src/domain/encounterFlow";
import { buildClaimRows, claimRowsForTrack } from "../src/domain/railPages";
import { hasSubmittedCodes } from "../src/domain/codingQueue";
import { initialsFromName, lastSeenLabel, patientInitials } from "../src/domain/patientDisplay";
import { stripRosPrefix } from "../src/components/WorkflowAthena/ExamROSStage";
import type { PipelineEncounter } from "../src/store/pipelineEncounter";

const root = join(import.meta.dir, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

function walk(dir: string): string[] {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

describe("the Medical/Dental track changes only on a click", () => {
  const files = walk("src").filter((f) => /\.(ts|tsx)$/.test(f));
  const writers = files.filter((f) => read(f).includes("setActiveTrack(") && !f.endsWith("activeTrack.ts"));

  test("the only writers are the two switches, and both are click handlers", () => {
    expect(writers.sort()).toEqual([
      "src/components/shell/AppHeader.tsx",
      "src/routes/cases.index.tsx",
    ]);
    for (const file of writers) {
      const source = read(file);
      // Each write sits inside a click handler — the switch in the header, or the
      // "Show dental cases" button on the case list — never in an effect or a loader.
      expect(/onClick|onTrackChange/.test(source)).toBe(true);
      expect(source).not.toContain("beforeLoad");
    }
  });

  test("no route hardcodes a track while a student is on a shared page", () => {
    for (const path of [
      "src/routes/dashboard.tsx",
      "src/routes/index.tsx",
      "src/routes/patients.tsx",
      "src/routes/schedule.tsx",
      "src/routes/settings.tsx",
      "src/routes/reference.tsx",
      "src/routes/coding.tsx",
      "src/routes/claims.tsx",
      "src/routes/payments.tsx",
      "src/routes/denials-ar.tsx",
      "src/routes/reports.tsx",
      "src/routes/cases.index.tsx",
    ]) {
      const source = read(path);
      expect(source).toContain("useActiveTrack()");
      expect(source).not.toContain('track="medical"');
      expect(source).not.toContain('track="dental"');
      expect(source).not.toContain("readActiveTrack()");
    }
  });

  test("opening a case or a legacy address does not rewrite the student's choice", () => {
    expect(read("src/routes/cases.$track.$caseId.$stage.tsx")).not.toContain("setActiveTrack");
    expect(read("src/routes/dental.tsx")).not.toContain("setActiveTrack");
  });
});

describe("a later stage is never done while an earlier one is current", () => {
  test("only the leading run of finished stages is reported", () => {
    const done = completedFlowStages({
      "progress-note": true,
      "sign-lock": true,
      coding: false,
      "prior-auth": true,
      billing: true,
    });
    expect(done).toEqual(["progress-note", "sign-lock"]);
  });

  test("a fully finished encounter reports every stage, in order", () => {
    const all = Object.fromEntries(ENCOUNTER_FLOW_STAGES.map((s) => [s.id, true]));
    expect(completedFlowStages(all)).toEqual(ENCOUNTER_FLOW_STAGES.map((s) => s.id));
  });

  test("nothing finished reports nothing", () => {
    expect(completedFlowStages({})).toEqual([]);
  });

  test("the stage bar and the Coding queue use the same 'coded' rule", () => {
    expect(read("src/routes/index.tsx")).toContain("const coded = hasSubmittedCodes(pipelineState);");
    const enc = { icdCodes: ["J06.9"], cptCodes: [] } as unknown as PipelineEncounter;
    // One code submitted is "coded" for the queue, and now for the stepper too.
    expect(hasSubmittedCodes(enc)).toBe(true);
  });
});

describe("/claims lists one track's claims, and no claim without a patient", () => {
  const named = (patientId: string | null, fallback?: string | null) =>
    patientId === "PAT-1" ? "Amara Okafor" : (fallback ?? "No patient attached");

  const withPatient = {
    patientId: "PAT-1",
    claimNumber: "CLM-000001",
    claimStatus: "submitted",
    claimForm: null,
    remittances: [],
    statusEvents: [],
    codingLines: [],
  } as unknown as PipelineEncounter;

  const orphan = {
    patientId: null,
    claimNumber: "CLM-000004",
    claimStatus: "draft",
    claimForm: null,
    remittances: [],
    statusEvents: [],
    codingLines: [],
  } as unknown as PipelineEncounter;

  test("a claim with no patient attached is not listed", () => {
    const rows = buildClaimRows({ encounters: [withPatient, orphan], nameForPatient: named });
    expect(rows.map((r) => r.claimNumber)).toEqual(["CLM-000001"]);
  });

  test("no row title ever says 'No patient attached'", () => {
    const rows = buildClaimRows({ encounters: [withPatient, orphan], nameForPatient: named });
    for (const row of rows) expect(row.title).not.toContain("No patient attached");
  });

  test("the dental claim appears only under the dental track", () => {
    const medical = buildClaimRows({ encounters: [withPatient], nameForPatient: named });
    const dentalRow = { ...medical[0], claimNumber: "CLM-000002" };
    expect(claimRowsForTrack({ track: "medical", medical, dental: dentalRow })).toEqual(medical);
    expect(claimRowsForTrack({ track: "dental", medical, dental: dentalRow })).toEqual([dentalRow]);
    expect(claimRowsForTrack({ track: "dental", medical, dental: null })).toEqual([]);
  });
});

describe("initials come from the patient, and 'idle' is never invented", () => {
  test("initials are the patient's own", () => {
    expect(patientInitials("Amara", "Okafor")).toBe("AO");
    expect(initialsFromName("Amara Okafor")).toBe("AO");
    expect(initialsFromName("")).toBe("?");
  });

  test("the Schedule card uses the appointment's patient, not the provider", () => {
    const source = read("src/components/TabsEpic/DailySchedule.tsx");
    expect(source).toContain("getInitials(apt.patientName)");
    expect(source).not.toContain("apt.provider || apt.patientName");
  });

  test("both screens read the one helper", () => {
    expect(read("src/components/WorklistPanel.tsx")).toContain("patientInitials(p.firstName, p.lastName)");
    expect(read("src/components/TabsEpic/DailySchedule.tsx")).toContain("initialsFromName");
  });

  test("no last-seen date means no figure at all", () => {
    expect(lastSeenLabel(undefined)).toBeNull();
    expect(lastSeenLabel("")).toBeNull();
    expect(lastSeenLabel("not a date")).toBeNull();
  });

  test("a real date reads as a real interval", () => {
    const now = new Date("2026-11-21T12:00:00Z");
    expect(lastSeenLabel("2026-11-21T09:00:00Z", now)?.label).toBe("Seen today");
    expect(lastSeenLabel("2026-11-19T09:00:00Z", now)?.label).toBe("Seen 2d ago");
  });

  test("the fabricated idle array is gone, and a booking stamps a real last-seen", () => {
    expect(read("src/components/WorklistPanel.tsx")).not.toContain("IDLE_DAYS");
    expect(read("src/components/WorklistPanel.tsx")).not.toContain("idleDays");
    expect(read("src/store/ehrStore.ts")).toContain("lastSeenAt: now,");
    expect(read("src/store/ehrStore.ts")).toContain("touchPatient:");
  });
});

describe("the InBox badge is a real count", () => {
  test("the literal 3 is gone and the count is passed in", () => {
    const source = read("src/components/TabsEpic/WorkspaceTabs.tsx");
    expect(source).not.toContain("badge: 3");
    expect(source).toContain("badges?: Partial<Record<string, number>>");
    expect(source).toContain("badge > 0");
  });

  test("the encounter page feeds it from the Work Queues count", () => {
    const source = read("src/routes/index.tsx");
    expect(source).toContain("useHomeWorkQueueTotal()");
    expect(source).toContain("badges={{ inbasket: inBasketCount }}");
    // One derivation, shared with the panel that prints the same total.
    expect(read("src/components/status/HomeWorkQueues.tsx")).toContain("export function useHomeWorkQueueTotal()");
  });
});

describe("typing in Exam/ROS does not double the text or lose keystrokes", () => {
  test("the ROS prefix is stripped from what the textarea shows", () => {
    expect(stripRosPrefix("All systems reviewed and normal. Lungs clear.")).toBe("Lungs clear.");
    expect(stripRosPrefix("Abnormal ROS findings: cv-chest. Chest tight.")).toBe("Chest tight.");
    expect(stripRosPrefix("Chest tight.")).toBe("Chest tight.");
  });

  test("the stage keeps its own echo out of the textarea", () => {
    const source = read("src/components/WorkflowAthena/ExamROSStage.tsx");
    expect(source).toContain("lastEmitted");
    expect(source).toContain("if (incoming === lastEmitted.current) return;");
    expect(source).toContain("stripRosPrefix(note?.objective ?? \"\")");
  });
});
