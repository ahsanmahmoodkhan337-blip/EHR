/**
 * Medical Cases — standalone case-runner route
 *
 * Inspired by: the dental track's /dental route. The medical case-runner is
 * independently accessible at /medical-cases and never imports from the
 * free-form medical pipeline store — it runs its own graded case spine on the
 * MEDICAL_CASE_SCENARIOS data. It wraps the medical case store and runner.
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Home, LogOut, Stethoscope } from "lucide-react";
import { isLoggedIn, logout } from "../store/accessStore";
import { MedicalCaseProvider } from "../components/medical/MedicalCaseStore";
import { MedicalCaseRunner } from "../components/medical/MedicalCaseRunner";

export const Route = createFileRoute("/medical-cases")({
  component: MedicalCasesPage,
});

function MedicalCasesPage() {
  return (
    <MedicalCaseProvider>
      <MedicalCasesShell />
    </MedicalCaseProvider>
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
    <div className="flex h-screen flex-col bg-slate-100">
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2 shadow-sm">
        <div className="flex shrink-0 items-center gap-3">
          <Link
            to="/"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            title="Medical home"
          >
            <Home className="h-4 w-4" />
          </Link>
          <img src="/healthcarehustlers-logo.png" alt="Healthcare Hustlers" className="h-7 w-auto" style={{ maxWidth: "120px" }} />
          <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
            Medical Cases
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/dental"
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            Dental track
          </Link>
          <button
            onClick={() => {
              logout();
              navigate({ to: "/login" });
            }}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
            title="Logout"
          >
            <LogOut className="h-3.5 w-3.5" />
            Log out
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden">
        <MedicalCaseRunner />
      </main>
    </div>
  );
}
