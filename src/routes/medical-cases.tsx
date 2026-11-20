/**
 * Medical Cases — standalone case-runner route
 *
 * Inspired by: the dental track's /dental route. The medical case-runner is
 * independently accessible at /medical-cases and never imports from the
 * free-form medical pipeline store — it runs its own graded case spine on the
 * MEDICAL_CASE_SCENARIOS data. It wraps the medical case store and runner.
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Stethoscope } from "lucide-react";
import { isLoggedIn } from "../store/accessStore";
import { PatientProvider } from "../store/patientStore";
import { MedicalCaseProvider } from "../components/medical/MedicalCaseStore";
import { MedicalCaseRunner } from "../components/medical/MedicalCaseRunner";
import { AppShell } from "../components/AppShell";
import { requestPatientOpen } from "../components/shell/pendingPatient";

export const Route = createFileRoute("/medical-cases")({
  component: MedicalCasesPage,
});

function MedicalCasesPage() {
  return (
    <PatientProvider>
      <MedicalCaseProvider>
        <MedicalCasesShell />
      </MedicalCaseProvider>
    </PatientProvider>
  );
}

function MedicalCasesShell() {
  const navigate = useNavigate();
  const loggedIn = isLoggedIn();

  if (!loggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <Stethoscope className="mx-auto mb-3 h-8 w-8 text-blue-500" />
          <h1 className="text-sm font-bold text-slate-800">Medical RCM Cases</h1>
          <p className="mt-1 text-xs text-slate-500">Log in to practice the graded medical revenue cycle.</p>
          <Link
            to="/login"
            className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
          >
            Log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      track="medical"
      activeNav="practice-cases"
      onPatientSelect={(patientId) => {
        // Graded cases run inside this runner; a patient picked from the
        // shell's search opens in the free-form medical workspace instead.
        requestPatientOpen(patientId);
        void navigate({ to: "/" });
      }}
    >
      <div className="min-h-0 flex-1 overflow-hidden">
        <MedicalCaseRunner />
      </div>
    </AppShell>
  );
}
