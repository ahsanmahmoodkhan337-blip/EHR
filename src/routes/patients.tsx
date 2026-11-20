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
 */

import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, UserRound } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { PatientProvider, usePatientStore } from "../store/patientStore";
import { DEFAULT_HUB_TAB } from "../components/patients/PatientHubTabs";

export const Route = createFileRoute("/patients")({
  component: () => (
    <PatientProvider>
      <PatientsPage />
    </PatientProvider>
  ),
});

function PatientsPage() {
  const navigate = useNavigate();
  const { patients } = usePatientStore();
  const [query, setQuery] = useState("");

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
  const openPatient = (patientId: string) => {
    void navigate({ to: "/patients/$id/$tab", params: { id: patientId, tab: DEFAULT_HUB_TAB } });
  };

  return (
    <AppShell
      track="medical"
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
          <p className="rounded-lg border border-dashed border-slate-200 p-4 text-xs text-slate-500">
            No patient on file matches “{query.trim()}”. Clear the search to see every chart.
          </p>
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
                {matches.map((patient) => (
                  <tr key={patient.id}>
                    <td className="font-medium text-slate-800">
                      {patient.firstName} {patient.lastName}
                    </td>
                    <td className="font-mono text-xs text-slate-500">{patient.mrn || "—"}</td>
                    <td className="text-xs tabular-nums text-slate-500">{patient.dateOfBirth || "—"}</td>
                    <td className="text-slate-600">{patient.primaryCareProvider || "—"}</td>
                    <td className="text-slate-600">{patient.insurance || "—"}</td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => openPatient(patient.id)}
                        aria-label={`Open the patient hub for ${patient.firstName} ${patient.lastName}`}
                        className="min-h-10 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                      >
                        Open patient
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
