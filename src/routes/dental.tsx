/**
 * Dental RCM Track — standalone route
 *
 * Inspired by: the owner-required separation between the medical and dental RCM
 * tracks. The dental track is independently accessible at /dental and never
 * imports from the medical stage components. It wraps the dental track store
 * and case runner inside the one application shell (spec
 * `task-1-app-shell.md` item 1) — the same sidebar, top bar and patient search
 * every other page uses, instead of a header of its own.
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Smile } from "lucide-react";
import { isLoggedIn } from "../store/accessStore";
import { PatientProvider } from "../store/patientStore";
import { DentalTrackProvider } from "../components/dental/DentalTrackStore";
import { DentalCaseRunner } from "../components/dental/DentalCaseRunner";
import { AppShell } from "../components/AppShell";
import { requestPatientOpen } from "../components/shell/pendingPatient";

export const Route = createFileRoute("/dental")({
  component: DentalTrackPage,
});

function DentalTrackPage() {
  return (
    <PatientProvider>
      <DentalTrackProvider>
        <DentalTrackShell />
      </DentalTrackProvider>
    </PatientProvider>
  );
}

function DentalTrackShell() {
  const navigate = useNavigate();
  const loggedIn = isLoggedIn();

  if (!loggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <Smile className="mx-auto mb-3 h-8 w-8 text-teal-500" />
          <h1 className="text-sm font-bold text-slate-800">Dental RCM Track</h1>
          <p className="mt-1 text-xs text-slate-500">Log in to practice the dental revenue cycle.</p>
          <Link
            to="/login"
            className="mt-4 inline-block rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-500"
          >
            Log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      track="dental"
      activeNav="practice-cases"
      onPatientSelect={(patientId) => {
        // The dental track has no patient workspace of its own: open the chart
        // in the medical workspace, where the patient record lives.
        requestPatientOpen(patientId);
        void navigate({ to: "/" });
      }}
    >
      <div className="min-h-0 flex-1 overflow-hidden">
        <DentalCaseRunner />
      </div>
    </AppShell>
  );
}
