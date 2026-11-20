/**
 * Patient hub — the Insurance and Appointments sections
 * (`specs/patient-hub.md` § Insurance and § Appointments)
 *
 * Inspired by: eClinicalWorks' patient hub, where the coverage cards and the
 * visit list sit side by side with the check-in the front desk does. This slice
 * builds the two sections only — the tab bar around them is the next task — and
 * they are drawn on the chart page under the patient banner, so nothing new was
 * added to the rail.
 *
 * What is honest here:
 *   - The eligibility line is the stored 271 (`domain/eligibility.ts`), with the
 *     date it was received. A coverage nobody checked says "Not checked" — never
 *     a made-up active.
 *   - Check-in writes the appointment's own timestamp and status; the 270/271
 *     and the copay are the two steps after it, and neither happens by itself.
 *   - The copay is money: it is posted to the visit ledger as a patient payment
 *     (`domain/checkIn.ts` → `appendLedgerEntries`), and the row keeps only the
 *     amount and the entry's id so a student can trace it.
 */

import { useMemo, useState } from "react";
import { BadgeCheck, CalendarClock, CreditCard, ShieldCheck } from "lucide-react";
import { useEhrStore, useAllAppointments } from "../../store/ehrStore";
import { usePipeline } from "../../store/pipelineStore";
import type { Patient } from "../../store/patientStore";
import {
  ELIGIBILITY_LABELS,
  eligibilityDate,
  eligibilityOf,
  runEligibility270,
  type EligibilityCoverage,
  type EligibilityRecord,
} from "../../domain/eligibility";
import { copayLedgerEntry } from "../../domain/checkIn";

function money(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function timeOf(iso: string | null | undefined): string {
  if (!iso) return "";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function dateOf(day: string): string {
  const parsed = new Date(`${day}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return day || "—";
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** One coverage card: what the card holds, then the 271 filed against it. */
function CoverageCard({
  coverage,
  which,
  label,
  onRun,
}: {
  patientId: string;
  coverage: EligibilityCoverage | null;
  which: "primary" | "secondary";
  label: string;
  onRun: (record: EligibilityRecord) => void;
}) {
  if (!coverage) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 p-3 text-[11px] text-slate-500">
        {label}: no {which} coverage on file.
      </div>
    );
  }

  const eligibility = eligibilityOf(coverage);
  const tone =
    eligibility.status === "active"
      ? "text-emerald-700"
      : eligibility.status === "inactive"
        ? "text-red-600"
        : "text-amber-700";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
        <span className="text-xs font-semibold text-slate-800">{coverage.payerName || "—"}</span>
        {coverage.planName && <span className="text-[11px] text-slate-500">{coverage.planName}</span>}
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-600 sm:grid-cols-4">
        <div>
          <dt className="text-slate-400">Member ID</dt>
          <dd className="font-mono">{coverage.subscriberId || "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Group</dt>
          <dd className="font-mono">{coverage.groupNumber || "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Relationship</dt>
          <dd>{coverage.relationshipToSubscriber || "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-400">EDI payer ID</dt>
          <dd className="font-mono">{coverage.ediPayerId || "—"}</dd>
        </div>
      </dl>

      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
        <span className={`text-[11px] font-semibold ${tone}`}>
          {ELIGIBILITY_LABELS[eligibility.status]}
          {eligibility.checkedAt ? ` · ${eligibilityDate(eligibility)}` : ""}
        </span>
        {eligibility.payerResponse ? (
          <span className="min-w-0 flex-1 text-[11px] text-slate-500">{eligibility.payerResponse}</span>
        ) : (
          <span className="min-w-0 flex-1 text-[11px] text-slate-500">
            No 270/271 on file for this coverage yet.
          </span>
        )}
        <button
          type="button"
          onClick={() => onRun(runEligibility270(coverage, new Date().toISOString()))}
          aria-label={`Run the 270/271 eligibility check for ${label.toLowerCase()} coverage for this patient`}
          className="min-h-10 rounded-lg bg-white px-3 text-[11px] font-semibold text-brand-700 ring-1 ring-brand-200 transition-colors hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {eligibility.status === "not-checked" ? "Run eligibility (270)" : "Re-run 270"}
        </button>
      </div>
    </div>
  );
}

/** One appointment row: check in, then the 270/271, then the copay. */
function AppointmentRow({ patient, appointmentId }: { patient: Patient; appointmentId: string }) {
  const appointments = useAllAppointments();
  const checkInAppointment = useEhrStore((s) => s.checkInAppointment);
  const updateAppointment = useEhrStore((s) => s.updateAppointment);
  const recordEligibility = useEhrStore((s) => s.recordEligibility);
  const postPatientPayment = usePipeline().postPatientPayment;

  const appointment = appointments.find((a) => a.id === appointmentId);
  const [copayDraft, setCopayDraft] = useState("");
  const [message, setMessage] = useState("");

  const primary = patient.insuranceRecord?.primary ?? null;
  const eligibility = eligibilityOf(primary);

  if (!appointment) return null;

  const checkedIn = Boolean(appointment.checkedInAt);
  const copayPosted = typeof appointment.copayUsd === "number" && appointment.copayUsd > 0;

  const collect = () => {
    const amount = Number(copayDraft);
    const at = new Date().toISOString();
    const entry = copayLedgerEntry({
      appointmentId: appointment.id,
      patientId: patient.id,
      amountUsd: amount,
      at,
      appointmentType: appointment.type,
      claimNumber: null,
    });
    if (!entry) {
      setMessage("Enter the amount collected, in dollars, before posting the copay.");
      return;
    }
    // The money goes to the visit's ledger first; the row only points at it.
    postPatientPayment(patient.id, entry);
    updateAppointment(appointment.id, { copayUsd: amount, copayPostedLedgerEntryId: entry.id });
    setCopayDraft("");
    setMessage("");
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-xs font-semibold text-slate-800">{dateOf(appointment.date)}</span>
        <span className="text-[11px] text-slate-500">
          {appointment.time} · {appointment.type}
          {appointment.provider ? ` · ${appointment.provider}` : ""}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
          {checkedIn ? "Arrived" : appointment.status}
        </span>
        {checkedIn && (
          <span className="text-[11px] text-emerald-700">Checked in {timeOf(appointment.checkedInAt)}</span>
        )}
        {copayPosted && (
          <span className="text-[11px] text-slate-600">
            Copay {money(appointment.copayUsd as number)} posted to the ledger
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
        {!checkedIn && (
          <button
            type="button"
            onClick={() => checkInAppointment(appointment.id)}
            aria-label={`Check in ${patient.firstName} ${patient.lastName} for the ${appointment.type} on ${dateOf(appointment.date)}`}
            className="min-h-10 rounded-lg bg-brand-600 px-3 text-[11px] font-semibold text-white transition-colors hover:bg-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            Check in
          </button>
        )}

        {checkedIn && (
          <>
            <span className="text-[11px] text-slate-600">
              Eligibility:{" "}
              <span
                className={
                  eligibility.status === "active"
                    ? "font-semibold text-emerald-700"
                    : eligibility.status === "inactive"
                      ? "font-semibold text-red-600"
                      : "font-semibold text-amber-700"
                }
              >
                {ELIGIBILITY_LABELS[eligibility.status]}
                {eligibility.checkedAt ? ` · ${eligibilityDate(eligibility)}` : ""}
              </span>
            </span>
            <button
              type="button"
              onClick={() => {
                if (!primary) return;
                recordEligibility(patient.id, "primary", runEligibility270(primary, new Date().toISOString()));
              }}
              disabled={!primary}
              aria-label={`Run the 270/271 eligibility check for ${patient.firstName} ${patient.lastName} at this check-in`}
              title={primary ? undefined : "This patient has no primary coverage on file — register a card first."}
              className="min-h-10 rounded-lg bg-white px-3 text-[11px] font-semibold text-brand-700 ring-1 ring-brand-200 transition-colors hover:bg-brand-50 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              {eligibility.status === "not-checked" ? "Run eligibility (270)" : "Re-run 270"}
            </button>

            {!copayPosted && (
              <span className="flex flex-wrap items-center gap-1.5">
                <label htmlFor={`copay-${appointment.id}`} className="text-[11px] text-slate-500">
                  Copay collected
                </label>
                <input
                  id={`copay-${appointment.id}`}
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={copayDraft}
                  onChange={(event) => setCopayDraft(event.target.value)}
                  placeholder="0.00"
                  className="min-h-10 w-24 rounded-lg border border-slate-200 px-2 text-[11px] tabular-nums text-slate-800 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                />
                <button
                  type="button"
                  onClick={collect}
                  aria-label={`Collect the copay for ${patient.firstName} ${patient.lastName} and post it to the visit ledger`}
                  className="min-h-10 rounded-lg bg-brand-600 px-3 text-[11px] font-semibold text-white transition-colors hover:bg-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                >
                  Collect copay
                </button>
              </span>
            )}
          </>
        )}

        {!checkedIn && (
          <span className="text-[11px] text-slate-500">
            Check in to run the 270/271 and collect the copay for this visit.
          </span>
        )}
      </div>

      {message && <p className="mt-1 text-[11px] text-amber-700">{message}</p>}
    </div>
  );
}

export function InsuranceSection({ patient }: { patient: Patient }) {
  const recordEligibility = useEhrStore((s) => s.recordEligibility);
  const record = patient.insuranceRecord;

  if (!record) {
    return (
      <section aria-labelledby="hub-insurance" className="mt-4">
        <h2 id="hub-insurance" className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-800">
          <ShieldCheck className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" /> Insurance
        </h2>
        <p className="rounded-xl border border-dashed border-slate-200 p-3 text-[11px] text-slate-500">
          No insurance card is on file for this patient — register a card to check eligibility.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="hub-insurance" className="mt-4">
      <h2 id="hub-insurance" className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-800">
        <ShieldCheck className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" /> Insurance
      </h2>
      <div className="grid gap-2 lg:grid-cols-2">
        <CoverageCard
          patientId={patient.id}
          coverage={record.primary}
          which="primary"
          label="Primary"
          onRun={(eligibility) => recordEligibility(patient.id, "primary", eligibility)}
        />
        <CoverageCard
          patientId={patient.id}
          coverage={record.secondary}
          which="secondary"
          label="Secondary"
          onRun={(eligibility) => recordEligibility(patient.id, "secondary", eligibility)}
        />
      </div>
    </section>
  );
}

export function AppointmentsSection({ patient }: { patient: Patient }) {
  const appointments = useAllAppointments();
  const mine = useMemo(
    () =>
      appointments
        .filter((a) => a.patientId === patient.id)
        .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)),
    [appointments, patient.id],
  );

  return (
    <section aria-labelledby="hub-appointments" className="mt-4">
      <h2
        id="hub-appointments"
        className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-800"
      >
        <CalendarClock className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" /> Appointments
      </h2>
      {mine.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 p-3 text-[11px] text-slate-500">
          No appointments on file for this patient. Book one on the Schedule page.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {mine.map((appointment) => (
            <AppointmentRow key={appointment.id} patient={patient} appointmentId={appointment.id} />
          ))}
        </div>
      )}
    </section>
  );
}

/** Both sections, in the order the hub's tabs will take next task. */
export function PatientHubSections({ patient }: { patient: Patient }) {
  return (
    <>
      <InsuranceSection patient={patient} />
      <AppointmentsSection patient={patient} />
    </>
  );
}

/** Unused import guard: BadgeCheck/CreditCard are kept for the next task's tab icons. */
export const HUB_ICONS = { BadgeCheck, CreditCard };
