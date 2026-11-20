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
import { PatientProvider } from "../store/patientStore";
import { DailySchedule } from "../components/TabsEpic/DailySchedule";
import { requestPatientOpen } from "../components/shell/pendingPatient";

export const Route = createFileRoute("/schedule")({
  component: () => (
    <PatientProvider>
      <SchedulePage />
    </PatientProvider>
  ),
});

function SchedulePage() {
  const navigate = useNavigate();

  return (
    <AppShell
      track="medical"
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
            // A booked patient opens in the medical workspace, which is where a
            // chart lives. The workspace reads this request once on mount.
            requestPatientOpen(patientId, name);
            void navigate({ to: "/" });
          }}
        />
      </div>
    </AppShell>
  );
}
