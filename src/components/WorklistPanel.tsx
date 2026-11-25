/**
 * WorklistPanel — Left Panel "Digital Mailbox"
 *
 * Inspired by: eClinicalWorks' Inbox and Epic's Patient Lists activity.
 *
 * Scrollable list of pending patient files showing mini
 * avatar, patient name, idle status, priority pulse indicator.
 * The Tutorial patient is always pinned at the top.
 *
 * The badge counts the student's own charts only — the pinned Tutorial Patient
 * is practice, not waiting work — so it is labelled as the count of their own
 * patients (`specs/slice-inbox-patients.md`). With nothing booked or registered
 * yet, the panel says so and points at the Schedule instead of a bare list.
 */

import { Link } from "@tanstack/react-router";
import { Clock, Circle, Pin, AlertTriangle, CalendarPlus } from "lucide-react";
import type { Patient } from "../store/patientStore";
import { lastSeenLabel, patientInitials } from "../domain/patientDisplay";

interface WorklistPanelProps {
  patients: Patient[];
  selectedPatientId: string;
  onPatientSelect: (id: string) => void;
}

function getInitials(p: Patient): string {
  return patientInitials(p.firstName, p.lastName);
}

/**
 * A record saved before DOB was required has no usable date of birth. The row
 * says so out loud, and the marker disappears as soon as Registration writes a
 * real one — a blank is not a silent answer.
 */
function hasDob(p: Patient): boolean {
  const raw = (p.dateOfBirth || "").trim();
  if (!raw) return false;
  return !Number.isNaN(new Date(raw).getTime());
}

export function WorklistPanel({ patients, selectedPatientId, onPatientSelect }: WorklistPanelProps) {
  const demoPatient = patients.find(p => p.id === "DEMO");
  const regularPatients = patients.filter(p => p.id !== "DEMO");

  return (
    <div className="flex flex-col gap-1">
      <div className="mb-2 flex items-center gap-2 border-b border-slate-100 pb-2">
        <Clock className="h-4 w-4 text-slate-500" />
        <span className="text-xs font-semibold text-slate-500">Inbox</span>
        <span
          className="ml-auto rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600"
          aria-label={`${regularPatients.length} of your own patients in the Inbox`}
        >
          {regularPatients.length}
        </span>
      </div>
      <div className="max-h-[calc(100vh-12rem)] space-y-1 overflow-y-auto">
        {/* Demo/Tutorial patient pinned at top */}
        {demoPatient && (
          <div
            key="DEMO"
            onClick={() => onPatientSelect(demoPatient.id)}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-2.5 transition-all duration-200 ${
              selectedPatientId === "DEMO"
                ? "border-amber-400 bg-amber-50 shadow-md"
                : "border-amber-300/60 bg-amber-50/40 hover:border-amber-400 hover:shadow-sm"
            }`}
          >
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              selectedPatientId === "DEMO" ? "bg-amber-500 text-white" : "bg-amber-200 text-amber-700"
            }`}>
              📋
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <p className={`truncate text-sm font-medium ${
                  selectedPatientId === "DEMO" ? "text-amber-800" : "text-slate-800"
                }`}>
                  {demoPatient.firstName} {demoPatient.lastName}
                </p>
              </div>
              <p className="truncate text-xs text-slate-400">{demoPatient.chiefComplaint}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5">
              <Pin className="h-3 w-3 text-amber-500" />
              <span className="whitespace-nowrap text-[11px] font-medium text-amber-600">Pinned</span>
            </div>
          </div>
        )}

        {/* Separator */}
        {demoPatient && regularPatients.length > 0 && (
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-[11px] font-medium text-slate-400">Patients</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>
        )}

        {/* Nothing of the student's own yet — say so, and where a first patient comes from. */}
        {regularPatients.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
            <p className="text-[11px] font-semibold text-slate-700">No patients yet.</p>
            <p className="mt-0.5 text-xs leading-snug text-slate-500">
              Book an appointment on the Schedule to start your first visit.
            </p>
            <Link
              to="/schedule"
              aria-label="Open the Schedule to book your first appointment"
              className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-brand-900 px-2.5 text-[11px] font-semibold text-white hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
              Open the Schedule
            </Link>
          </div>
        )}

        {/* Regular patients */}
        {regularPatients.map((p) => {
          // A real last-seen only: the record carries `lastSeenAt` when the patient
          // was booked or their chart was opened, and a record without one shows
          // no figure rather than a made-up "2d idle".
          const seen = lastSeenLabel(p.lastSeenAt);
          const isSelected = p.id === selectedPatientId;
          return (
            <div
              key={p.id}
              onClick={() => onPatientSelect(p.id)}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 transition-all duration-200 ${
                isSelected
                  ? "border-brand-200 bg-brand-50 shadow-sm"
                  : "border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-sm"
              }`}
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                isSelected ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-600"
              }`}>
                {getInitials(p)}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-medium ${
                  isSelected ? "text-brand-800" : "text-slate-800"
                }`}>
                  {p.firstName} {p.lastName}
                </p>
                <p className="truncate text-xs text-slate-400">{p.chiefComplaint}</p>
                {!hasDob(p) && (
                  <span className="mt-0.5 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                    <AlertTriangle className="h-2.5 w-2.5" /> DOB missing — complete at Registration
                  </span>
                )}
              </div>
              {seen && (
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <Circle className={`h-2 w-2 fill-current ${seen.tone}`} />
                  <span className="whitespace-nowrap text-[11px] text-slate-400">{seen.label}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
