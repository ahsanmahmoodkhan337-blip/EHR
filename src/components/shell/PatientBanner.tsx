/**
 * PatientBanner — the sticky patient context strip under the top bar.
 *
 * Inspiration: Epic Hyperspace's persistent patient banner (dense identity
 * strip that never scrolls away) with the coverage and balance band from
 * eClinicalWorks' patient header.
 *
 * Two bands, both wrapping freely (spec `task-1-app-shell.md` item 2):
 *   1. identity — name, MRN, DOB and age, sex, allergies in red;
 *   2. coverage — primary insurance and plan, eligibility chip, copay,
 *      patient balance, PCP.
 *
 * The shell keeps this strip stuck directly under the top bar. Nothing here is
 * invented: a value the record does not hold prints as "—" with the reason in
 * its title, so a student can tell "zero" from "not captured".
 */

import { AlertTriangle, CalendarDays, ShieldCheck, User } from "lucide-react";

/**
 * What the banner needs in order to draw a patient.
 *
 * The chart's `Patient` satisfies it in full. A graded case carries only the
 * identity and coverage it actually recorded, so every field past the name is
 * optional and prints as "—" with the reason when the record does not hold it.
 */
export interface BannerPatient {
  firstName: string;
  lastName: string;
  mrn?: string;
  dateOfBirth?: string;
  gender?: string;
  /** Absent when the record carries no allergy list at all (a graded case). */
  allergies?: { allergen: string; severity: string }[];
  insurance?: string;
  insuranceRecord?: {
    primary?: {
      payerName?: string;
      planName?: string;
      subscriberId?: string;
    } | null;
  };
  primaryCareProvider?: string;
}

interface PatientBannerProps {
  /** The patient being worked, or null when none is open. */
  patient: BannerPatient | null;
  /** Name override for a custom (non-database) appointment patient. */
  fallbackName?: string;
  /**
   * This encounter's patient balance, summed from its ledger
   * (`domain/ledger.ts` — charges, insurance payments, adjustments and patient
   * payments). Left undefined while nothing has been posted, so the banner says
   * "—" instead of printing a zero nobody computed.
   *
   * It is not read from the claim: box 30 on the CMS-1500 is reserved
   * `R.S. AMOUNT` and carries no money.
   */
  patientBalance?: number;
}

function parseDate(raw?: string): Date | null {
  const value = (raw || "").trim();
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDob(raw?: string): string | null {
  const parsed = parseDate(raw);
  if (!parsed) return null;
  return parsed.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

/** Whole years between the DOB and today, or null when there is no usable DOB. */
function computeAge(raw?: string): number | null {
  const dob = parseDate(raw);
  if (!dob) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

function formatMoney(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** A small labelled chip used for the eligibility state. */
function Chip({ tone, children, title }: { tone: "ok" | "warn" | "danger" | "neutral"; children: string; title: string }) {
  const tones: Record<string, string> = {
    ok: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/40",
    warn: "bg-amber-500/15 text-amber-200 ring-amber-400/40",
    danger: "bg-red-500/20 text-red-200 ring-red-400/50",
    neutral: "bg-slate-600/40 text-slate-200 ring-slate-500/50",
  };
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function PatientBanner({ patient, fallbackName, patientBalance }: PatientBannerProps) {
  // No patient and no name to show — the strip stays out of the way.
  if (!patient && !fallbackName) return null;

  const name = patient ? `${patient.firstName} ${patient.lastName}` : fallbackName!;
  const age = patient ? computeAge(patient.dateOfBirth) : null;
  const dobText = patient ? formatDob(patient.dateOfBirth) : null;

  const coverage = patient?.insuranceRecord?.primary ?? null;
  const payerName = coverage?.payerName || patient?.insurance || "";
  const planName = coverage?.planName || "";
  const memberId = coverage?.subscriberId || "";

  const allergies = patient?.allergies;
  const allergyText =
    allergies && allergies.length > 0
      ? allergies.map((allergy) => `${allergy.allergen} (${allergy.severity})`).join(", ")
      : null;

  // Eligibility: nothing in the record holds a 271 response yet, so the chip
  // says what is actually known — coverage on file, or none.
  const eligibility =
    patient && payerName
      ? {
          tone: "warn" as const,
          label: "Eligibility not checked",
          title: "No 270/271 eligibility response is recorded for this patient yet — run the eligibility check in Registration.",
        }
      : {
          tone: "danger" as const,
          label: "No coverage on file",
          title: "No insurance record on this patient — registration has not captured a card.",
        };

  return (
    <section
      aria-label="Patient context"
      className="border-b border-slate-700 bg-slate-800 px-3 py-1.5 text-white"
    >
      {/* Band 1 — identity */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm font-bold leading-tight">{name}</span>

        {patient && (
          <>
            {patient.mrn && <span className="text-[11px] text-slate-300">MRN {patient.mrn}</span>}
            <span className="text-[11px] text-slate-300">
              DOB {dobText ?? "—"}
              {age !== null ? ` (${age}y)` : ""}
            </span>
            {patient.gender && <span className="text-[11px] text-slate-300">{patient.gender}</span>}
          </>
        )}

        {patient && (
          <span className="flex min-w-0 items-center gap-1 text-[11px] font-semibold text-red-300">
            <AlertTriangle className="h-3 w-3 shrink-0 text-red-400" aria-hidden="true" />
            <span className="min-w-0 break-words">
              {allergyText ? (
                `Allergies: ${allergyText}`
              ) : allergies ? (
                <span className="text-emerald-300">No Known Allergies</span>
              ) : (
                <span
                  className="text-slate-300"
                  title="This record carries no allergy list — nothing has been charted either way."
                >
                  Allergies: —
                </span>
              )}
            </span>
          </span>
        )}
      </div>

      {/* Band 2 — coverage and money */}
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-300">
        <span className="flex min-w-0 items-center gap-1">
          <ShieldCheck className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
          <span className="min-w-0 break-words">
            {payerName ? (
              <>
                {payerName}
                {planName ? ` · ${planName}` : ""}
                {memberId ? ` · ID ${memberId}` : ""}
              </>
            ) : (
              "Insurance: —"
            )}
          </span>
        </span>

        <Chip tone={eligibility.tone} title={eligibility.title}>
          {eligibility.label}
        </Chip>

        <span title="No copay is recorded for this visit — the front desk collects it (TASK 2).">
          Copay: <span className="text-slate-300">—</span>
        </span>

        <span
          title={
            patientBalance === undefined
              ? "Nothing has been posted to this encounter's ledger yet — a patient balance appears once the 835 is posted."
              : "Patient balance summed from this encounter's ledger (posted charges, insurance payments, adjustments and patient payments)."
          }
        >
          Balance:{" "}
          <span className={patientBalance && patientBalance > 0 ? "font-semibold text-amber-200" : "text-slate-300"}>
            {patientBalance === undefined ? "—" : formatMoney(patientBalance)}
          </span>
        </span>

        <span className="flex min-w-0 items-center gap-1">
          <User className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
          <span className="min-w-0 break-words">PCP: {patient?.primaryCareProvider || "—"}</span>
        </span>

        <span className="ml-auto flex items-center gap-1 text-slate-300">
          <CalendarDays className="h-3 w-3 shrink-0" aria-hidden="true" />
          Service {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
      </div>
    </section>
  );
}
