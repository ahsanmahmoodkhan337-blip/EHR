/**
 * /charts — the selected patient's chart, at its own address
 *
 * Inspired by: Epic's Chart Review activity and athenaOne's patient chart, where
 * the clinical record of the patient you have open is one screen: the review
 * tabs (summary, vitals, medications, problems, labs, notes) and the note being
 * written for this visit.
 *
 * Spec `phase-1-navigation-addendum.md` item 1. The owner's six rail items are
 * Home, Schedule, Patients, Charts, Practice Cases, Settings — PR #120 put
 * Reference in this slot, and this is the page that belongs there.
 *
 * Two rules this page keeps:
 *   - It reads the patient record and writes only the note draft. Nothing here
 *     invents a figure, and nothing here edits the chart: the chart is captured
 *     in the encounter stages, and this page shows it.
 *   - With no patient open it is not blank: it says to choose a patient on
 *     Patients and links there, which is a stated reason rather than a dead page.
 *
 * The Active Progress Note is the same per-patient draft the medical workspace
 * autosaves (`useEhrStore().saveNoteDraft`), so a note typed here is the note the
 * student finds on `/` — one draft per patient, not a second copy.
 */

import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, ArrowRight, Beaker, ClipboardList, FileText, Pill, Stethoscope, UserRound } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { TabsEpic, TabPanel, useTabsEpic } from "../components/TabsEpic/TabsEpic";
import { PatientBanner, type BannerPatient } from "../components/shell/PatientBanner";
import { PatientHubSections } from "../components/patients/PatientHubSections";
import { postedCopayForPatient } from "../domain/checkIn";
import { useAllAppointments } from "../store/ehrStore";
import { PatientProvider, usePatientStore, type Patient } from "../store/patientStore";
import { PipelineProvider, usePipeline } from "../store/pipelineStore";
import { NOTE_STATUS_LABEL, noteFieldsOf, noteReadOnly, noteStatus } from "../domain/noteStatus";
import { skipNoteAutosave } from "../domain/tutorialReadOnly";

export const Route = createFileRoute("/charts")({
  component: () => (
    <PatientProvider>
      <PipelineProvider>
        <ChartsPage />
      </PipelineProvider>
    </PatientProvider>
  ),
});

/** The chart-review tabs this page can fill from the record. */
const CHART_TABS = [
  { id: "summary", label: "Summary", icon: <ClipboardList className="h-4 w-4" /> },
  { id: "vitals", label: "Vitals", icon: <Activity className="h-4 w-4" /> },
  { id: "medications", label: "Medications", icon: <Pill className="h-4 w-4" /> },
  { id: "problems", label: "Problems", icon: <Stethoscope className="h-4 w-4" /> },
  { id: "labs", label: "Labs & Results", icon: <Beaker className="h-4 w-4" /> },
  { id: "notes", label: "Notes", icon: <FileText className="h-4 w-4" /> },
];

const footer = (
  <footer className="border-t border-slate-200 bg-white px-4 py-2 text-center text-xs text-slate-400">
    Healthcare Hustlers EHR Simulation — built for healthcare education. All patients, payers and fees are
    fictional.
  </footer>
);

function ChartsPage() {
  const { activePatientId } = usePipeline();
  const appointments = useAllAppointments();
  const { getPatientById } = usePatientStore();
  const patient = activePatientId ? getPatientById(activePatientId) : undefined;

  // The copay the desk collected at check-in is read back off the appointment
  // that posted it, so the banner shows the money the ledger actually holds.
  const copayUsd = postedCopayForPatient(appointments, patient?.id)?.copayUsd;

  const banner: BannerPatient | null = patient
    ? {
        firstName: patient.firstName,
        lastName: patient.lastName,
        mrn: patient.mrn,
        dateOfBirth: patient.dateOfBirth,
        gender: patient.gender,
        allergies: (patient.allergies ?? []).map((a) => ({ allergen: a.allergen, severity: a.severity })),
        insurance: patient.insurance,
        insuranceRecord: patient.insuranceRecord,
        primaryCareProvider: patient.primaryCareProvider,
      }
    : null;

  return (
    <AppShell
      track={patient?.track === "dental" ? "dental" : "medical"}
      activeNav="charts"
      banner={<PatientBanner patient={banner} copayUsd={copayUsd} />}
      footer={footer}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Stethoscope className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
          <h1 className="text-sm font-bold text-slate-800">Charts</h1>
          {patient && (
            <p className="text-[11px] text-slate-500">
              {patient.firstName} {patient.lastName} · MRN {patient.mrn || "—"}
            </p>
          )}
        </div>

        {!patient ? (
          <NoPatientOpen />
        ) : (
          <>
            <PatientChart patient={patient} />
            <PatientHubSections patient={patient} />
          </>
        )}
      </div>
    </AppShell>
  );
}

/**
 * No patient open. The page states why it is empty and where to go, rather than
 * showing a blank tab strip.
 */
function NoPatientOpen() {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6">
      <UserRound className="h-8 w-8 text-slate-300" aria-hidden="true" />
      <h2 className="mt-2 text-sm font-bold text-slate-800">No patient is open</h2>
      <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-slate-500">
        A chart belongs to one patient, so this page opens the chart of the patient you have open. Choose a
        patient on Patients, then come back — the chart you were working stays exactly as you left it.
      </p>
      <Link
        to="/patients"
        className="mt-3 inline-flex min-h-10 items-center gap-1 rounded-lg bg-brand-900 px-3 text-xs font-semibold text-white hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        Choose a patient <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}

function PatientChart({ patient }: { patient: Patient }) {
  const { activeTab, setActiveTab } = useTabsEpic("summary");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ── Chart Review ─────────────────────────────────────────────── */}
      <section aria-labelledby="charts-review" className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
        <h2 id="charts-review" className="border-b border-slate-100 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-600">
          Chart Review
        </h2>
        <TabsEpic tabs={CHART_TABS} activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="p-3">
          <TabPanel id="summary" activeTab={activeTab}>
            <SummaryPanel patient={patient} />
          </TabPanel>
          <TabPanel id="vitals" activeTab={activeTab}>
            <VitalsPanel patient={patient} />
          </TabPanel>
          <TabPanel id="medications" activeTab={activeTab}>
            <MedicationsPanel patient={patient} />
          </TabPanel>
          <TabPanel id="problems" activeTab={activeTab}>
            <ProblemsPanel patient={patient} />
          </TabPanel>
          <TabPanel id="labs" activeTab={activeTab}>
            <LabsPanel patient={patient} />
          </TabPanel>
          <TabPanel id="notes" activeTab={activeTab}>
            <NotesPanel patient={patient} />
          </TabPanel>
        </div>
      </section>

      {/* ── Active Progress Note ─────────────────────────────────────── */}
      <section aria-labelledby="charts-note" className="mt-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <ActiveProgressNoteDraft patient={patient} />
      </section>
    </div>
  );
}

// ─── chart review panels ────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap gap-x-2 border-b border-slate-100 py-1 last:border-0">
      <span className="w-40 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <span className="text-[11px] text-slate-800">{value || "—"}</span>
    </div>
  );
}

function Empty({ children }: { children: string }) {
  return <p className="rounded-lg border border-dashed border-slate-200 p-3 text-[11px] text-slate-500">{children}</p>;
}

function SummaryPanel({ patient }: { patient: Patient }) {
  const primary = patient.insuranceRecord?.primary;
  const secondary = patient.insuranceRecord?.secondary ?? null;
  return (
    <div>
      <Row label="Patient" value={`${patient.firstName} ${patient.lastName}`} />
      <Row label="MRN" value={patient.mrn} />
      <Row label="Date of birth" value={`${patient.dateOfBirth || "—"}${patient.age ? ` · age ${patient.age}` : ""}`} />
      <Row label="Sex" value={patient.gender} />
      <Row label="Phone" value={patient.phone} />
      <Row label="Primary care provider" value={patient.primaryCareProvider} />
      <Row label="Chief complaint" value={patient.chiefComplaint} />
      <Row label="Payer" value={primary ? `${primary.payerName}${primary.planName ? ` · ${primary.planName}` : ""}` : patient.insurance} />
      <Row label="Member ID (box 1a)" value={primary?.subscriberId ?? ""} />
      <Row label="Group (box 11)" value={primary?.groupNumber ?? ""} />
      <Row label="Other coverage" value={secondary ? `${secondary.payerName} · ${secondary.subscriberId}` : "None on file"} />
      <div className="mt-2">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Allergies</p>
        {(patient.allergies ?? []).length === 0 ? (
          <Empty>No allergy recorded on this chart.</Empty>
        ) : (
          <ul className="flex flex-wrap gap-1">
            {patient.allergies.map((a) => (
              <li
                key={a.id}
                className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700"
              >
                {a.allergen} · {a.severity}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function VitalsPanel({ patient }: { patient: Patient }) {
  const v = patient.vitals;
  const recorded = (value: string | number | undefined, unit = "") =>
    value === undefined || value === null || value === "" || value === 0 ? "—" : `${value}${unit}`;
  return (
    <div>
      <Row label="Blood pressure" value={recorded(v?.bloodPressure)} />
      <Row label="Heart rate" value={recorded(v?.heartRate, " bpm")} />
      <Row label="Temperature" value={recorded(v?.temperature, " °F")} />
      <Row label="Respiratory rate" value={recorded(v?.respiratoryRate, " /min")} />
      <Row label="Oxygen saturation" value={recorded(v?.oxygenSaturation, " %")} />
      <Row label="Recorded" value={v?.recordedAt ? new Date(v.recordedAt).toLocaleString() : ""} />
      <p className="mt-2 text-[10px] text-slate-400">
        A measurement that was never taken shows “—” rather than a made-up number.
      </p>
    </div>
  );
}

function MedicationsPanel({ patient }: { patient: Patient }) {
  const meds = patient.medications ?? [];
  if (meds.length === 0) return <Empty>No medication recorded on this chart.</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="data-table min-w-[520px]">
        <thead>
          <tr>
            <th>Medication</th>
            <th>Dose</th>
            <th>Frequency</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {meds.map((m) => (
            <tr key={m.id}>
              <td className="font-medium text-slate-800">{m.name}</td>
              <td>{m.dosage || "—"}</td>
              <td>{m.frequency || "—"}</td>
              <td className="text-slate-600">{m.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProblemsPanel({ patient }: { patient: Patient }) {
  const problems = patient.problems ?? [];
  if (problems.length === 0) return <Empty>No problem on this chart.</Empty>;
  return (
    <ul className="space-y-1">
      {problems.map((p) => (
        <li key={p} className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-1 text-[11px] text-slate-700">
          {p}
        </li>
      ))}
    </ul>
  );
}

function LabsPanel({ patient }: { patient: Patient }) {
  const labs = patient.labResults ?? [];
  if (labs.length === 0) return <Empty>No lab result on this chart.</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="data-table min-w-[560px]">
        <thead>
          <tr>
            <th>Test</th>
            <th>Result</th>
            <th>Reference</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {labs.map((lab) => (
            <tr key={lab.id}>
              <td className="font-medium text-slate-800">{lab.testName}</td>
              <td className="tabular-nums">
                {lab.value}
                {lab.unit ? ` ${lab.unit}` : ""}
              </td>
              <td className="text-slate-500">{lab.referenceRange || "—"}</td>
              <td className="text-slate-600">{lab.status}</td>
              <td className="text-xs tabular-nums text-slate-500">
                {lab.date ? new Date(lab.date).toLocaleDateString() : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NotesPanel({ patient }: { patient: Patient }) {
  const notes = patient.encounters ?? [];
  if (notes.length === 0) return <Empty>No encounter note on this chart yet.</Empty>;
  return (
    <ul className="space-y-2">
      {notes.map((e) => (
        <li key={e.id} className="rounded-lg border border-slate-100 bg-white p-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-800">{e.type || "Encounter"}</span>
            <span className="text-[10px] text-slate-500">{e.date}</span>
            <span className="text-[10px] text-slate-500">{e.provider}</span>
            <span className="ml-auto text-[10px] text-slate-400">{e.department}</span>
          </div>
          <p className="mt-1 text-[10px] text-slate-600">{e.diagnosis || "—"}</p>
          <p className="mt-1 whitespace-pre-wrap text-[11px] text-slate-700">{e.notes || "—"}</p>
        </li>
      ))}
    </ul>
  );
}

// ─── the note being written for this visit ──────────────────────────────────

/**
 * The Active Progress Note — the encounter's one note record.
 *
 * It reads and writes `writeNoteFor`, the same record the Progress Note stages
 * and Sign & Lock write, so Charts and the encounter can never hold different
 * notes for the same patient. The status is `noteStatus`'s answer, and once the
 * note is signed it is read-only here exactly as it is everywhere else
 * (`domain/noteStatus.ts`).
 */
function ActiveProgressNoteDraft({ patient }: { patient: Patient }) {
  const { getEncounter, writeNoteFor } = usePipeline();
  const encounter = getEncounter(patient.id);
  const status = noteStatus(encounter);
  const readOnly = noteReadOnly(encounter);
  const savedAt = encounter?.noteUpdatedAt ?? null;

  const [fields, setFields] = useState(() => noteFieldsOf(encounter));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  // Load the patient's own note when the chart changes.
  const patientId = patient.id;
  useEffect(() => {
    setFields(noteFieldsOf(getEncounter(patientId)));
    setSaveState("idle");
    // Only when the patient changes — a keystroke must not overwrite the note.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  // Debounced autosave into the one record.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(fields);
  latest.current = fields;

  // The standard reference chart refuses student writes: its note is the worked
  // example, filled by the seed. Autosaving it would only report a refusal.
  const saveNote = (fields: typeof latest.current) => {
    if (skipNoteAutosave(patient.id)) return;
    if (writeNoteFor(patient.id, fields)) setSaveState("saved");
  };

  const flush = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    saveNote(latest.current);
  };

  const edit = (key: keyof typeof fields, value: string) => {
    if (readOnly) return;
    const next = { ...fields, [key]: value };
    setFields(next);
    latest.current = next;
    setSaveState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      saveNote(next);
    }, 1200);
  };

  // Never leave an unsaved keystroke behind when the page is left.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        saveNote(latest.current);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [patient.id],
  );

  const field = (key: keyof typeof fields, label: string, placeholder: string, tone: string) => (
    <div className="rounded-lg border border-slate-200 p-2">
      <label htmlFor={`note-${key}`} className={`mb-1 block text-[10px] font-semibold uppercase tracking-wider ${tone}`}>
        {label}
      </label>
      <textarea
        id={`note-${key}`}
        value={fields[key]}
        onChange={(e) => edit(key, e.target.value)}
        onBlur={flush}
        readOnly={readOnly}
        aria-readonly={readOnly}
        placeholder={readOnly ? "" : placeholder}
        className="min-h-[90px] w-full resize-y rounded border-0 bg-transparent text-[12px] text-slate-800 placeholder:text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 read-only:text-slate-700"
      />
    </div>
  );

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 id="charts-note" className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
          Active Progress Note
        </h2>
        <span
          className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
            status === "signed"
              ? "bg-green-100 text-green-700"
              : status === "draft"
                ? "bg-amber-50 text-amber-700"
                : "bg-slate-100 text-slate-500"
          }`}
        >
          {NOTE_STATUS_LABEL[status]}
        </span>
        <span className="text-[10px] text-slate-500">
          {patient.firstName} {patient.lastName}
        </span>
        <span role="status" aria-live="polite" className="ml-auto text-[10px] text-slate-500">
          {readOnly && savedAt && `Signed ${new Date(savedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`}
          {!readOnly && saveState === "saving" && "Saving…"}
          {!readOnly && saveState !== "saving" && savedAt && `Saved ${new Date(savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
          {!readOnly && saveState !== "saving" && !savedAt && "Not saved yet"}
        </span>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {field("subjective", "Subjective (S)", "Chief complaint, history of present illness, review of systems…", "text-brand-600")}
        {field("objective", "Objective (O)", "Vital signs, exam findings, lab and imaging results…", "text-emerald-600")}
        {field("assessment", "Assessment (A)", "Diagnoses, differentials, clinical impression…", "text-amber-600")}
        {field("plan", "Plan (P)", "Medication changes, orders, referrals, follow-up…", "text-brand-600")}
      </div>
      <p className="mt-2 text-[10px] text-slate-400">
        {readOnly
          ? "This note is signed and locked. It is the record the coder, the biller and the payer read, so it is read-only here."
          : "This is the patient's progress note — the same record the encounter autosaves. It saves as you type; signing it stays in the encounter's Sign & Lock step."}
      </p>
    </div>
  );
}
