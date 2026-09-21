/**
 * Dental RCM Track — standalone route
 *
 * Inspired by: the owner-required separation between the medical and dental RCM
 * tracks. The dental track is independently accessible at /dental and never
 * imports from the medical stage components. It wraps the dental track store
 * and case runner, and exposes a Medical | Dental track switcher in its header.
 */

import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Home, LogOut, Smile } from "lucide-react";
import { isLoggedIn, logout } from "../store/accessStore";
import { DentalTrackProvider } from "../components/dental/DentalTrackStore";
import { DentalCaseRunner } from "../components/dental/DentalCaseRunner";
import { TrackSwitcher, type RcmTrack } from "../components/dental/TrackSwitcher";

export const Route = createFileRoute("/dental")({
  component: DentalTrackPage,
});

function DentalTrackPage() {
  return (
    <DentalTrackProvider>
      <DentalTrackShell />
    </DentalTrackProvider>
  );
}

function DentalTrackShell() {
  const navigate = useNavigate();
  const loggedIn = isLoggedIn();
  const [track, setTrack] = useState<RcmTrack>("dental");

  const handleTrackChange = (t: RcmTrack) => {
    setTrack(t);
    if (t === "medical") {
      navigate({ to: "/" });
    }
  };

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
          <span className="rounded bg-teal-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-700">
            Dental RCM
          </span>
        </div>

        <TrackSwitcher track={track} onTrackChange={handleTrackChange} compact />

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
      </header>

      <main className="min-h-0 flex-1 overflow-hidden">
        <DentalCaseRunner />
      </main>
    </div>
  );
}
