/**
 * /patients — the patient directory, at its own address
 *
 * Inspired by: Epic's Patient Station / athenaOne's patient search list. Until
 * Phase 1 this was a workspace tab on `/` that only appeared once a chart was
 * already open, so the one screen a front desk uses to find a patient was
 * buried behind the chart it was meant to open. It is a page of its own now
 * (spec `phase-1-navigation.md` item 1).
 *
 * Every row opens that patient's chart — the only place a chart lives. Nothing
 * is written here: opening a patient loads their own saved encounter, it does
 * not reset it.
 *
 * The Tutorial Patient is the standard worked-example chart (owner, 2026-11-22),
 * so it is pinned first in the list and its row opens its *encounter* — the
 * workspace at the stage its record is saved on — rather than a hub tab, which
 * has nothing of its own to show. Every other row opens that patient's hub.
 *
 * The 18 built-in demo charts are teaching material and live in Practice Cases,
 * so they are not rows here. With only the Tutorial Patient on file the page
 * still lists it; the empty state is kept for a record with no charts at all.
 * The full lookup by id is untouched, so a claim on a demo chart still names it.
 */

import { useMemo, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Search, UserRound, CalendarPlus } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { useActiveTrack } from "../components/shell/activeTrack";
import { PatientProvider, usePatientStore } from "../store/patientStore";
import { rememberActivePatient, savedEncounterStage } from "../store/pipelineStore";
import { isTutorialPatient, ownPatientList } from "../domain/inbox";
import { flowStage, type EncounterFlowStageId } from "../domain/encounterFlow";
import { openingStageId } from "../domain/encounterRoute";
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

  // The student's own charts only — never the built-in demo charts.
  const patients = useMemo(() => ownPatientList(allPatients), [allPatients]);

  const trimmed = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (trimmed.length === 0) return patients;
    return patients.filter((p) =>
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
  }, [patients, trimmed]);

  // The hub is what Patients opens (`specs/patient-hub.md`): one patient, six
  // tabs, at their own address. No new rail item was added for it.
  //
  // The pick is also made the one active patient every page reads, and written
  // through before the route changes, so Coding, Claims, Payments and Denials &
  // AR open on this patient instead of the Tutorial Patient (audit item 4).
  //
  // The Tutorial Patient is the exception: its chart is the encounter itself, so
  // its row opens `/encounter/:id/:stage` at the stage its record is saved on.
  // Naming the patient and stage in the address is what makes the workspace
  // open this encounter rather than whatever the session last showed.
  const openPatient = (patientId: string) => {
    rememberActivePatient(patientId);
    if (isTutorialPatient({ id: patientId })) {
      const saved = savedEncounterStage(patientId);
      const stage: EncounterFlowStageId = flowStage(saved)?.id ?? openingStageId();
      void navigate({
        to: "/encounter/$encounterId/$stage",
        params: { encounterId: patientId, stage },
      });
      return;
    }
    void navigate({ to: "/patients/$id/$tab", params: { id: patientId, tab: DEFAULT_HUB_TAB } });
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
                className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-brand-900 px-3 text-[11px] font-semibold text-white hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
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
                  const name = `${patient.firstName} ${patient.lastName}`.trim();
                  return (
                    <tr key={patient.id}>
                      <td className="font-medium text-slate-800">
                        {patient.firstName} {patient.lastName}
                        {tutorial && (
                          <span
                            className="ml-2 inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800"
                            title="The standard worked-example chart"
                          >
                            Tutorial
                          </span>
                        )}
                      </td>
                      <td className="font-mono text-xs text-slate-500">{patient.mrn || "—"}</td>
                      <td className="text-xs tabular-nums text-slate-500">{patient.dateOfBirth || "—"}</td>
                      <td className="text-slate-600">{patient.primaryCareProvider || "—"}</td>
                      <td className="text-slate-600">{patient.insurance || "—"}</td>
                      <td className="text-right">
                        <button
                          type="button"
                          onClick={() => openPatient(patient.id)}
                          aria-label={
                            tutorial
                              ? `Open the Tutorial Patient encounter for ${name}`
                              : `Open the patient hub for ${name}`
                          }
                          className="min-h-10 rounded-lg bg-brand-900 px-3 text-xs font-semibold text-white hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                        >
                          {tutorial ? "Open encounter" : "Open patient"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
