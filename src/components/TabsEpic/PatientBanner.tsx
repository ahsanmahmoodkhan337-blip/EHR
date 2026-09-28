/**
 * PatientBanner — persistent patient context banner (Epic Hyperspace style)
 *
 * Inspiration: Epic's persistent patient context banner — a dense, always-visible
 * strip just below the app header that keeps the active patient's identity,
 * demographics, allergies, code status and encounter context in view while the
 * clinician charts. This component mirrors that single-strip layout with a dark
 * navy chrome to match the existing `header-nav`.
 *
 * It reads from the shared patientStore `Patient` record (name, MRN, dateOfBirth,
 * gender, allergies[] with allergen/severity/reaction) and derives the remaining
 * context: age (computed from dateOfBirth), visit type (New Patient vs
 * Established, from encounter history), code status (default Full Code) and
 * today's service date.
 */

import { AlertTriangle, CalendarDays, ShieldCheck, User } from "lucide-react";
import type { Patient } from "../../store/patientStore";

/** Compute an age from a "YYYY-MM-DD" date string, safely. */
function computeAge(dateOfBirth: string): number {
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

function formatServiceDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface PatientBannerProps {
  /** The selected patient, or null when none is selected. */
  patient: Patient | null;
  /** Name override for custom (non-database) appointment patients. */
  fallbackName?: string;
}

export function PatientBanner({ patient, fallbackName }: PatientBannerProps) {
  // Hidden entirely when there is no patient context at all.
  if (!patient && !fallbackName) return null;

  const name = patient ? `${patient.firstName} ${patient.lastName}` : fallbackName!;
  const hasRecord = Boolean(patient);
  const age = patient ? computeAge(patient.dateOfBirth) : null;
  const visitType =
    hasRecord && (patient!.encounters || []).length > 0 ? "Established" : "New Patient";
  const serviceDate = formatServiceDate(new Date());

  const allergyText =
    patient && patient.allergies.length > 0
      ? patient.allergies.map((a) => `${a.allergen} — ${a.severity}`).join(", ")
      : null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-700 bg-slate-800 px-4 py-1.5 text-white">
      {/* Name */}
      <span className="text-sm font-bold leading-none">{name}</span>

      {/* MRN · DOB (age) · sex */}
      {patient && (
        <span className="flex items-center gap-3 text-[11px] text-slate-300">
          <span>MRN {patient.mrn}</span>
          <span className="h-3 w-px bg-slate-600" aria-hidden="true" />
          <span>
            DOB {new Date(patient.dateOfBirth).toLocaleDateString()} ({age}y)
          </span>
          <span className="h-3 w-px bg-slate-600" aria-hidden="true" />
          <span>{patient.gender}</span>
        </span>
      )}

      {/* Allergies — always red to draw the eye, like a real chart banner */}
      {patient && (
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-red-300">
          <AlertTriangle className="h-3 w-3 shrink-0 text-red-400" aria-hidden="true" />
          {allergyText ? (
            <span>{allergyText}</span>
          ) : (
            <span className="font-medium text-emerald-300">No Known Allergies</span>
          )}
        </span>
      )}

      {/* Code status */}
      {patient && (
        <span className="flex items-center gap-1 text-[11px] text-slate-300">
          <ShieldCheck className="h-3 w-3 text-slate-400" aria-hidden="true" />
          Code: Full Code
        </span>
      )}

      {/* Attending provider */}
      {patient?.primaryCareProvider && (
        <span className="flex items-center gap-1 text-[11px] text-slate-300">
          <User className="h-3 w-3 text-slate-400" aria-hidden="true" />
          {patient.primaryCareProvider}
        </span>
      )}

      {/* Visit type tag */}
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
          visitType === "New Patient"
            ? "bg-sky-500/20 text-sky-300"
            : "bg-slate-600/50 text-slate-200"
        }`}
      >
        {visitType}
      </span>

      {/* Service date (right-aligned) */}
      <span className="ml-auto flex items-center gap-1 text-[11px] text-slate-400">
        <CalendarDays className="h-3 w-3" aria-hidden="true" />
        Service {serviceDate}
      </span>
    </div>
  );
}
