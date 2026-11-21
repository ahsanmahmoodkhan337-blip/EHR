/**
 * start-visit-slice-d.test.ts — Start Visit opens the appointment's own patient
 *
 * Owner's audit, 2026-11-20, item 3:
 *
 *   - "Start Visit opens the appointment's own patient at the Progress Note stage
 *     of a new encounter. Today it ignores the appointment and restores the last
 *     session (Emily Chen at Prior Auth) or falls back to the Tutorial Patient."
 *   - "Session restore never overrides an explicit patient selection."
 *   - "A patient created through New Appointment also appears in the Inbox and
 *     the Patients list."
 *
 * Three things are checked here, one per sentence:
 *
 *   1. Start Visit names the appointment's patient in the encounter address at
 *      the stage the encounter opens on (`progress-note`), so the visit opens on
 *      that patient and not on whoever the last session left open.
 *   2. The saved session stands down for an explicit pick — the address, or a
 *      handoff from the search / Start Visit — and the address keeps winning even
 *      when the named patient only reaches the list after the store hydrates.
 *   3. A patient registered through New Appointment is in the merged patient list
 *      the Patients page reads, and in the Inbox list the encounter panel reads,
 *      whichever date the appointment was booked for.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { openingStageId, encounterPath } from "../src/domain/encounterRoute";
import { ENCOUNTER_FLOW_OPENING_STAGE } from "../src/domain/encounterFlow";
import { inboxPatients, TUTORIAL_PATIENT_ID } from "../src/domain/inbox";
import { selectPatients, type EhrAppointment } from "../src/store/ehrStore";

const root = join(import.meta.dir, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const SCHEDULE = read("src/routes/schedule.tsx");
const SCHEDULE_DAY = read("src/components/TabsEpic/DailySchedule.tsx");
const INDEX = read("src/routes/index.tsx");
const PATIENTS_PAGE = read("src/routes/patients.tsx");

// ─── 1. Start Visit opens the appointment's own patient ──────────────

describe("Start Visit opens the appointment's own patient at the Progress Note", () => {
  test("the encounter opens on the Progress Note stage", () => {
    expect(openingStageId()).toBe("progress-note");
    expect(ENCOUNTER_FLOW_OPENING_STAGE).toBe("progress-note");
  });

  test("Start Visit hands the appointment's patient, not a typed name", () => {
    // The schedule row's own patient id and name are what Start Visit passes on.
    expect(SCHEDULE_DAY).toContain("onSelectPatient?.(apt.patientId, apt.patientName)");
  });

  test("the schedule sends that patient to their own encounter address", () => {
    // An address naming the patient is the explicit pick: `/` alone let the
    // saved session put the last patient back in front of it.
    expect(SCHEDULE).toContain('to: "/encounter/$encounterId/$stage"');
    expect(SCHEDULE).toContain("encounterId: patientId");
    expect(SCHEDULE).toContain("stage: openingStageId()");
    // The address it builds is the one the workspace reads.
    expect(encounterPath("PAT-123", openingStageId())).toBe("/encounter/PAT-123/progress-note");
    // A row with no patient record behind it still opens a blank visit rather
    // than being dropped.
    expect(SCHEDULE).toContain('void navigate({ to: "/" })');
  });
});

// ─── 2. Session restore never overrides an explicit pick ──────────────

describe("a saved session never overrides an explicit pick", () => {
  test("the restore stands down for an address and for a handoff", () => {
    expect(INDEX).toContain("if (encounterIdFromRoute) return;");
    expect(INDEX).toContain("if (explicitPick.current) return;");
  });

  test("an explicit pick is marked before the restore can run", () => {
    const refDeclared = INDEX.indexOf("const explicitPick = useRef(false);");
    const handoffMarks = INDEX.indexOf("explicitPick.current = true;");
    const restoreGuard = INDEX.indexOf("if (explicitPick.current) return;");
    expect(refDeclared).toBeGreaterThan(-1);
    expect(handoffMarks).toBeGreaterThan(refDeclared);
    // The handoff effect is declared above the restore effect, so it marks the
    // pick on the same mount, before the restore reads it.
    expect(restoreGuard).toBeGreaterThan(handoffMarks);
  });

  test("the address keeps winning when its patient arrives after hydration", () => {
    // A refresh on a student-registered patient's address renders before the
    // store has loaded their list; the address takes over once they appear.
    expect(INDEX).toContain("if (!patients.some((p) => p.id === encounterIdFromRoute)) return;");
    expect(INDEX).toContain("setSelectedPatientId(encounterIdFromRoute);");
    expect(INDEX).toContain("selectPatient(encounterIdFromRoute);");
  });

  test("a visit that starts from a handoff opens the Progress Note", () => {
    // The name-only branch (a legacy row with no patient record) resets to a
    // blank encounter and then opens the opening stage.
    const nameBranch = INDEX.slice(
      INDEX.indexOf("if (requested.name) {"),
      INDEX.indexOf("// Mount only — the handoff is consumed exactly once."),
    );
    expect(nameBranch).toContain("openFlowStage(openingStageId());");
    expect(nameBranch).toContain("setSoapNote({ subjective: \"\", objective: \"\", assessment: \"\", plan: \"\" });");
  });
});

// ─── 3. A New Appointment patient is in the Inbox and the Patients list ─

const REGISTERED = {
  id: "PAT-NEW-1",
  firstName: "Ayesha",
  lastName: "Malik",
};

const APPOINTMENTS: EhrAppointment[] = [
  {
    id: "apt-new-1",
    patientId: REGISTERED.id,
    patientName: "Ayesha Malik",
    date: "2026-11-24",
    time: "09:00",
    type: "New Patient",
    duration: 30,
    notes: "",
    status: "scheduled",
  },
];

const OTHER_PATIENTS = [
  { id: TUTORIAL_PATIENT_ID, firstName: "Tutorial", lastName: "Patient" },
  { id: "PAT-OTHER-1", firstName: "Robert", lastName: "Johnson" },
];

describe("a patient created through New Appointment appears in the Inbox", () => {
  test("the encounter panel lists the registered patient", () => {
    const listed = inboxPatients([...OTHER_PATIENTS, REGISTERED], APPOINTMENTS, "2026-11-20");
    expect(listed.map((p) => p.id)).toContain(REGISTERED.id);
  });

  test("the date on screen does not drop them — the panel never loses a patient", () => {
    // The workspace picks one date at mount; a New Appointment can be booked for
    // any date. Both cases keep the patient in the list.
    for (const date of ["2026-11-24", "2026-11-20", ""]) {
      const listed = inboxPatients([...OTHER_PATIENTS, REGISTERED], APPOINTMENTS, date);
      expect(listed.map((p) => p.id)).toContain(REGISTERED.id);
    }
    // A patient with no appointment at all is still there.
    const unbooked = { id: "PAT-NEW-2", firstName: "Bilal", lastName: "Ahmed" };
    const listed = inboxPatients([...OTHER_PATIENTS, REGISTERED, unbooked], APPOINTMENTS, "2026-11-20");
    expect(listed.map((p) => p.id)).toContain(unbooked.id);
  });

  test("the day's visits come first and the Tutorial patient stays pinned", () => {
    const listed = inboxPatients([...OTHER_PATIENTS, REGISTERED], APPOINTMENTS, "2026-11-24");
    expect(listed[0].id).toBe(TUTORIAL_PATIENT_ID);
    expect(listed[1].id).toBe(REGISTERED.id);
    expect(listed).toHaveLength(3);
  });

  test("the panel does not mutate the patient list it was handed", () => {
    const patients = [...OTHER_PATIENTS, REGISTERED];
    const before = patients.map((p) => p.id);
    inboxPatients(patients, APPOINTMENTS, "2026-11-24");
    expect(patients.map((p) => p.id)).toEqual(before);
  });

  test("the encounter panel reads that list", () => {
    expect(INDEX).toContain("inboxPatients(patients, appointments, selectedScheduleDate)");
    // The old one-line filter is gone: it dropped patients booked for another date.
    expect(INDEX).not.toContain("const result = filtered.length > 0 ? filtered : patients");
  });
});

describe("a patient created through New Appointment appears in the Patients list", () => {
  test("a registered patient is in the merged list the Patients page reads", () => {
    // `registerPatient` writes the new patient into the student's own record
    // set; the Patients page reads seed + user merged on read (one list, not a
    // second copy), so a patient registered through New Appointment is there.
    type EhrState = Parameters<typeof selectPatients>[0];
    const registered = { id: "PAT-NEW-1", firstName: "Ayesha", lastName: "Malik" };
    const listed = selectPatients({
      seedPatients: [{ id: TUTORIAL_PATIENT_ID }],
      user: { patients: [registered] },
    } as unknown as EhrState);
    expect(listed.map((p) => p.id)).toContain("PAT-NEW-1");
    expect(listed.map((p) => p.id)).toContain(TUTORIAL_PATIENT_ID);
    expect(PATIENTS_PAGE).toContain("const { patients } = usePatientStore();");
  });
});
