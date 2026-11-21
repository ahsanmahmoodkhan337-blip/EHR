/**
 * /schedule — the front desk's day, at its own address
 *
 * Inspired by: athenaOne's Schedule activity and Epic's Cadence day view. Until
 * Phase 1 this lived as a workspace tab inside `/`; it is a page of its own now
 * (spec `phase-1-navigation.md` item 1) so the rail item opens it directly, a
 * bookmark works, and the browser's Back button behaves.
 *
 * The calendar, the New Appointment dialog and the day list are the existing
 * `DailySchedule` component (#116, #119) — nothing here re-implements them.
 * Starting a visit hands the patient to the medical workspace, which is still
 * the only place a chart opens.
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { useActiveTrack } from "../components/shell/activeTrack";
import { PatientProvider } from "../store/patientStore";
import { DailySchedule } from "../components/TabsEpic/DailySchedule";
import { requestPatientOpen } from "../components/shell/pendingPatient";
import { openingStageId } from "../domain/encounterRoute";

export const Route = createFileRoute("/schedule")({
  component: () => (
    <PatientProvider>
      <SchedulePage />
    </PatientProvider>
  ),
});

function SchedulePage() {
  const track = useActiveTrack();
  const navigate = useNavigate();

  return (
    <AppShell
      track={track}
      activeNav="schedule"
      footer={
        <footer className="border-t border-slate-200 bg-white px-4 py-2 text-center text-xs text-slate-400">
          Healthcare Hustlers EHR Simulation — built for healthcare education. All patients, payers and
          fees are fictional.
        </footer>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        <div className="mb-3 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
          <h1 className="text-sm font-bold text-slate-800">Schedule</h1>
          <p className="hidden text-[11px] text-slate-500 sm:block">
            Book an appointment, then start the visit to open that patient&rsquo;s chart.
          </p>
        </div>
        <DailySchedule
          onSelectPatient={(patientId, name) => {
            // Start Visit is an explicit pick: the appointment's own patient, at
            // the Progress Note stage of their encounter (audit item 3). Naming
            // the patient in the address is what keeps a saved session from
            // putting yesterday's patient back in front of it — the workspace
            // treats `/encounter/:encounterId/:stage` as the pick that wins.
            requestPatientOpen(patientId, name);
            if (patientId) {
              void navigate({
                to: "/encounter/$encounterId/$stage",
                params: { encounterId: patientId, stage: openingStageId() },
              });
              return;
            }
            // An appointment with no patient record behind it (a legacy row):
            // the workspace opens a blank encounter under the booked name.
            void navigate({ to: "/" });
          }}
        />
      </div>
    </AppShell>
  );
}
