/**
 * /practice-ar — the dental AR practice bench as its own page
 *
 * Inspired by: the training bench a billing school runs beside its production
 * system. The bench itself is `DentalARBench` (#110) — this route only gives it
 * an address of its own, so the case list can offer it beside the graded dental
 * cases now that `/dental` redirects to `/cases`.
 *
 * Leaving the page clears the bench flag in the dental store so a graded case
 * opened afterwards is the case and not the bench. Practice progress is kept.
 */

import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "../components/AppShell";
import { PatientProvider } from "../store/patientStore";
import { DentalTrackProvider, useDentalTrack } from "../components/dental/DentalTrackStore";
import { DentalARBench } from "../components/dental/DentalARBench";

export const Route = createFileRoute("/practice-ar")({
  component: () => (
    <PatientProvider>
      <DentalTrackProvider>
        <PracticeArPage />
      </DentalTrackProvider>
    </PatientProvider>
  ),
});

function PracticeArPage() {
  const navigate = useNavigate();
  const { closePractice } = useDentalTrack();

  // The bench is not a case. Leaving the page must not leave the dental runner
  // thinking a bench is open.
  useEffect(() => () => closePractice(), [closePractice]);

  return (
    <AppShell
      track="dental"
      activeNav="practice-cases"
      footer={
        <footer className="border-t border-slate-200 bg-white px-4 py-2 text-center text-xs text-slate-400">
          Healthcare Hustlers EHR Simulation — built for healthcare education. All patients, payers and
          fees are fictional.
        </footer>
      }
    >
      <div className="min-h-0 flex-1 overflow-hidden">
        <DentalARBench onBack={() => void navigate({ to: "/cases" })} />
      </div>
    </AppShell>
  );
}
