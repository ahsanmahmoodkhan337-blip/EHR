/**
 * /patients — the patient directory, at its own address
 *
 * Inspired by: Epic's Patient Station / athenaOne's patient search list. Until
 * Phase 1 this was a workspace tab on `/` that only appeared once a chart was
 * already open, so the one screen a front desk uses to find a patient was
 * buried behind the chart it was meant to open. It is a page of its own now
 * (spec `phase-1-navigation.md` item 1).
 *
 * Every row opens that patient's chart in the medical workspace — the only
 * place a chart lives. Nothing is written here: opening a patient loads their
 * own saved encounter, it does not reset it.
 *
 * WHO IS LISTED (spec `tutorial-patient-prefill.md` §A)
 * The Tutorial Patient is pinned first, labelled as the tutorial chart, and the
 * student's own charts follow it. The 18 built-in demo charts stay teaching
 * material in Practice Cases. The Tutorial Patient's row opens its **encounter**
 * (`/encounter/DEMO/progress-note`) rather than a hub tab, because its chart is
 * the pre-made visit a student reads end to end — and it carries the "Start
 * over" control that returns that chart to an empty visit.
 */

import { useMemo, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Search, UserRound, CalendarPlus } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { useActiveTrack } from "../components/shell/activeTrack";
import { PatientProvider, usePatientStore } from "../store/patientStore";
import { rememberActivePatient, startOverTutorialEncounter } from "../store/pipelineStore";
import { isTutorialPatient, studentPatientList, TUTORIAL_PATIENT_ID } from "../domain/inbox";
import { ENCOUNTER_FLOW_OPENING_STAGE } from "../domain/encounterFlow";
import { DEFAULT_HUB_TAB } from "../components/patients/PatientHubTabs";

export const Route = createFileRoute("/patients")({
  component: () => (
    <PatientProvider>
      <PatientsPage />
    </PatientProvider>
  ),
});

function PatientsPage() {
  const track = useActiveTrack();
  const navigate = useNavigate();
  const { patients: allPatients } = usePatientStore();
  const [query, setQuery] = useState("");
  // Which row's "Start over" confirmation is open, and what happened to it.
  const [confirming, setConfirming] = useState<string | null>(null);
  const [startedOver, setStartedOver] = useState(false);

  // The student's own charts, plus the pinned Tutorial Patient first.
  const patients = useMemo(() => studentPatientList(allPatients), [allPatients]);
  const tutorialFirst = useMemo(() => {
    const tutorial = patients.filter(isTutorialPatient);
    const rest = patients.filter((patient) => !isTutorialPatient(patient));
    return [...tutorial, ...rest];
  }, [patients]);

  const trimmed = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (trimmed.length === 0) return tutorialFirst;
    return tutorialFirst.filter((p) =>
      [
        p.firstName,
        p.lastName,
        p.mrn,
        p.dateOfBirth,
        p.primaryCareProvider,
        p.insurance,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(trimmed)),
    );
  }, [tutorialFirst, trimmed]);

  // The hub is what Patients opens for the student's own charts
  // (`specs/patient-hub.md`): one patient, six tabs, at their own address.
  //
  // The pick is also made the one active patient every page reads, and written
  // through before the route changes, so Coding, Claims, Payments and Denials &
  // AR open on this patient instead of the Tutorial Patient (audit item 4).
  //
  // The Tutorial Patient opens its **encounter** instead: the pre-made visit,
  // first stage, so the student walks the stepper from the note to the
  // remittance on one patient.
  const openPatient = (patientId: string) => {
    rememberActivePatient(patientId);
    if (patientId === TUTORIAL_PATIENT_ID) {
      void navigate({
        to: "/encounter/$encounterId/$stage",
        params: { encounterId: patientId, stage: ENCOUNTER_FLOW_OPENING_STAGE },
      });
      return;
    }
    void navigate({ to: "/patients/$id/$tab", params: { id: patientId, tab: DEFAULT_HUB_TAB } });
  };

  const startOver = () => {
    startOverTutorialEncounter(TUTORIAL_PATIENT_ID);
    setConfirming(null);
    setStartedOver(true);
  };

  return (
    <AppShell
      track={track}
      activeNav="patients"
      footer={
        <footer className="border-t border-slate-200 bg-white px-4 py-2 text-center text-xs text-slate-400">
          Healthcare Hustlers EHR Simulation — built for healthcare education. All patients, payers and
          fees are fictional.
        </footer>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <UserRound className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
          <h1 className="text-sm font-bold text-slate-800">Patients</h1>
          <p className="text-[11px] text-slate-500">
            {patients.length} {patients.length === 1 ? "chart" : "charts"} on file
          </p>
        </div>

        <label htmlFor="patient-directory-search" className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Find a patient
        </label>
        <div className="relative mb-3 max-w-md">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            id="patient-directory-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, MRN, date of birth, provider or payer"
            aria-label="Search patients by name, MRN, date of birth, provider or payer"
            className="min-h-10 w-full rounded-lg border border-slate-200 bg-white pl-7 pr-2 text-[12px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        {matches.length === 0 ? (
          patients.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-700">No patients yet.</p>
              <p className="mt-1 text-[11px] leading-snug text-slate-500">
                Book an appointment on the Schedule to start your first visit.
              </p>
              <Link
                to="/schedule"
                aria-label="Open the Schedule to book your first appointment"
                className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-[11px] font-semibold text-white hover:bg-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
                Open the Schedule
              </Link>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-200 p-4 text-xs text-slate-500">
              No patient on file matches “{query.trim()}”. Clear the search to see every chart.
            </p>
          )
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="data-table min-w-[640px]">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>MRN</th>
                  <th>Date of birth</th>
                  <th>Provider</th>
                  <th>Coverage</th>
                  <th>
                    <span className="sr-only">Open patient</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {matches.map((patient) => {
                  const tutorial = isTutorialPatient(patient);
                  return (
                    <tr key={patient.id}>
                      <td className="font-medium text-slate-800">
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          {patient.firstName} {patient.lastName}
                          {tutorial ? (
                            <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700">
                              Tutorial chart
                            </span>
                          ) : null}
                        </span>
                        {tutorial ? (
                          <span className="mt-1 block text-[11px] font-normal leading-snug text-slate-500">
                            A completed visit, filled from the note to the remittance. Open it to read every
                            stage, or start over to practise it yourself.
                          </span>
                        ) : null}
                      </td>
                      <td className="font-mono text-xs text-slate-500">{patient.mrn || "—"}</td>
                      <td className="text-xs tabular-nums text-slate-500">{patient.dateOfBirth || "—"}</td>
                      <td className="text-slate-600">{patient.primaryCareProvider || "—"}</td>
                      <td className="text-slate-600">{patient.insurance || "—"}</td>
                      <td className="text-right">
                        <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openPatient(patient.id)}
                            aria-label={
                              tutorial
                                ? "Open the Tutorial Patient's encounter, filled from the progress note to the remittance"
                                : `Open the patient hub for ${patient.firstName} ${patient.lastName}`
                            }
                            className="min-h-10 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                          >
                            {tutorial ? "Open encounter" : "Open patient"}
                          </button>
                          {tutorial ? (
                            <button
                              type="button"
                              onClick={() => {
                                setStartedOver(false);
                                setConfirming(confirming === patient.id ? null : patient.id);
                              }}
                              aria-label="Start the Tutorial Patient's encounter over from a blank visit"
                              aria-expanded={confirming === patient.id}
                              className="min-h-10 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                            >
                              Start over
                            </button>
                          ) : null}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {confirming === TUTORIAL_PATIENT_ID ? (
          <div className="mt-3 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-slate-800">
              Start the Tutorial Patient over? This removes, from this chart only:
            </p>
            <ul className="mt-1 list-disc pl-5 text-[11px] leading-snug text-slate-600">
              <li>the signed progress note, its vitals and its signature;</li>
              <li>the coded ICD-10 and CPT lines with their charges;</li>
              <li>the prior authorisation record and its number;</li>
              <li>the claim, its 837P submission and its 277CA;</li>
              <li>the 835 remittance, the posted ledger entries and the denied line in Denials &amp; AR.</li>
            </ul>
            <p className="mt-1 text-[11px] leading-snug text-slate-500">
              No other patient is touched. The visit then opens at Registration with a blank note.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={startOver}
                aria-label="Start the Tutorial Patient's chart over — remove its note, codes, prior authorisation, claim, 835 and AR items"
                className="min-h-10 rounded-lg bg-amber-600 px-3 text-xs font-semibold text-white hover:bg-amber-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                Start over from a blank visit
              </button>
              <button
                type="button"
                onClick={() => setConfirming(null)}
                aria-label="Keep the Tutorial Patient's encounter as it is"
                className="min-h-10 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                Keep the encounter
              </button>
            </div>
          </div>
        ) : null}

        {startedOver ? (
          <p role="status" className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-[11px] leading-snug text-slate-600">
            The Tutorial Patient now opens on a blank visit — Registration first, then an empty note. Open
            the encounter to practise it yourself.
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
