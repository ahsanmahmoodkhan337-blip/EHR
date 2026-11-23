/**
 * EligibilityStage — the 270/271 at the Front Desk, read from the record
 * (`specs/patient-hub.md` § Insurance)
 *
 * Inspired by: eClinicalWorks' eligibility check at check-in, where the payer's
 * 271 is filed against the patient's coverage and every screen after it — the
 * banner, the Insurance tab, the claim — reads the same stored answer.
 *
 * This used to be component state with a hardcoded 271 ($25 copay, "$500
 * deductible (met)", 20% coinsurance) that the banner knew nothing about, so the
 * stage and the banner could disagree. It now runs `domain/eligibility.ts`
 * against the coverage the chart holds and writes the result with
 * `recordEligibility`, which is the record the banner prints. Nothing is
 * invented: a patient with no card on file is told so, and a coverage nobody
 * checked reads "Not checked" rather than a made-up active.
 *
 * The benefit half of the 271 — copay, deductible remaining, coinsurance — is
 * `eligibility271()` in the same module: it reads this patient's own plan from
 * the table that prices their 835, prints the plan it came from, and returns no
 * figures at all for a payer the table has no rule for.
 */

import { useState } from "react";
import { CheckCircle2, Search, Shield, ArrowRight } from "lucide-react";
import { usePatientStore } from "../../store/patientStore";
import { useEhrStore } from "../../store/ehrStore";
import { usePipeline } from "../../store/pipelineStore";
import {
  ELIGIBILITY_LABELS,
  eligibility271,
  eligibilityDate,
  eligibilityNameCheckLabel,
  eligibilityOf,
  runEligibility270,
} from "../../domain/eligibility";
import { memberIdOnFile, patientCard } from "../../domain/patientCard";
import { READ_ONLY_REASON, useReadOnlyChart } from "../../domain/tutorialReadOnly";
import { ReadOnlyNote, readOnlyNoteId } from "../shell/ReadOnlyStage";

/** The reason drawn under the 270 button, at the point of the click. */
const ELIGIBILITY_REASON = readOnlyNoteId("eligibility-270");

export function EligibilityStage({
  patientId,
  readOnly = false,
}: {
  patientId?: string | null;
  /**
   * The standard reference chart: the 270 writes the stored coverage answer, so
   * the button is refused and says why. The chart's own signal is read too, so a
   * screen that forgets the prop still cannot write (`useReadOnlyChart`).
   */
  readOnly?: boolean;
}) {
  const { getPatientById } = usePatientStore();
  const chartLocked = useReadOnlyChart(patientId) || readOnly;
  const recordEligibility = useEhrStore((s) => s.recordEligibility);
  const { setRole } = usePipeline();
  const [running, setRunning] = useState(false);

  const patient = patientId ? getPatientById(patientId) : undefined;
  const coverage = patient?.insuranceRecord?.primary ?? null;
  // The member ID is the selected patient's own (`domain/patientCard.ts`); a
  // patient with no card reads "Not on file" rather than a blank or a neighbour's.
  const card = patientCard(patient);
  const stored = eligibilityOf(coverage);
  const checked = stored.status !== "not-checked";
  // The 271's benefit half — copay, deductible and coinsurance — read from this
  // patient's own plan (`domain/eligibility.ts` → `eligibility271`), which is
  // the same plan table that prices their 835.
  const benefits = eligibility271(coverage);

  const runInquiry = () => {
    if (!patient || !coverage) return;
    setRunning(true);
    // The 271 is written from the record, not from a timer: the short wait is
    // only the round trip, and the answer is the same one the banner will show.
    // The patient is passed too, so the reply runs its name check against the
    // registration card instead of only promising one.
    const record = runEligibility270(coverage, new Date().toISOString(), patient);
    setTimeout(() => {
      recordEligibility(patient.id, "primary", record);
      setRunning(false);
    }, 600);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-800">Step 2: Insurance Eligibility (270/271)</h3>
          <p className="text-sm text-slate-500">Verify the coverage the chart holds with the payer</p>
        </div>
        {checked && (
          <span className="flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> {ELIGIBILITY_LABELS[stored.status]}
          </span>
        )}
      </div>

      <div className="clinical-card">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <Shield className="h-5 w-5 text-slate-600" />
          <span className="text-sm font-bold text-slate-700">Payer portal</span>
          <span className="ml-auto rounded bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
            {coverage?.payerName || "No payer on file"}
          </span>
        </div>
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
            <span>
              <span className="font-medium">Patient:</span>{" "}
              {patient ? `${patient.firstName} ${patient.lastName}` : "—"}
            </span>
            <span>
              <span className="font-medium">DOB:</span> {patient?.dateOfBirth || "—"}
            </span>
            <span>
              <span className="font-medium">Member ID:</span> {memberIdOnFile(card)}
            </span>
          </div>

          <button
            type="button"
            onClick={runInquiry}
            disabled={running || !coverage || chartLocked}
            aria-label="Run the 270/271 eligibility inquiry for this patient's primary coverage"
            title={
              chartLocked
                ? READ_ONLY_REASON
                : coverage
                  ? undefined
                  : "This patient has no primary coverage on file — register the card first."
            }
            {...(chartLocked ? { "aria-describedby": ELIGIBILITY_REASON } : {})}
            className="flex min-h-10 items-center gap-2 rounded-lg bg-purple-600 px-4 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            {running ? "Inquiring…" : checked ? "Re-run 270 inquiry" : "Verify eligibility (270)"}
          </button>
          <ReadOnlyNote readOnly={chartLocked} id={ELIGIBILITY_REASON} />

          {running && (
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
              <Search className="h-4 w-4" aria-hidden="true" /> Sending the 270 eligibility inquiry…
            </div>
          )}

          {checked && !running && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-xs font-semibold text-green-800">EDI 271 eligibility response received</p>
              <div className="mt-2 space-y-1 text-[11px] text-slate-700">
                <p>
                  <span className="font-medium">Status:</span> {ELIGIBILITY_LABELS[stored.status]}
                </p>
                <p>
                  <span className="font-medium">Received:</span> {eligibilityDate(stored) || "—"}
                </p>
                {/* The name check the 271 runs: the payer's file against the
                    registration card. A mismatch is a result the student reads —
                    nothing is corrected here (standing rule 6). */}
                <p>
                  <span className="font-medium">Name check:</span>{" "}
                  <span
                    className={
                      stored.nameCheck === "mismatch"
                        ? "font-semibold text-red-700"
                        : stored.nameCheck === "match"
                          ? "font-semibold text-green-700"
                          : "text-slate-500"
                    }
                  >
                    {eligibilityNameCheckLabel(stored)}
                  </span>
                </p>
                <p>{stored.payerResponse}</p>
              </div>

              {/* The 271's benefit answer. Every figure names the plan it came
                  from, so the student can trace it to a rule rather than a screen. */}
              <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 border-t border-green-200 pt-2 text-[11px] text-slate-700 sm:grid-cols-3">
                <div>
                  <dt className="text-slate-500">Copay</dt>
                  <dd className="font-medium">
                    {benefits.copayUsd === null
                      ? benefits.planName
                        ? "No fixed copay — this plan pays coinsurance"
                        : "—"
                      : usd(benefits.copayUsd)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Deductible remaining</dt>
                  <dd className="font-medium">
                    {benefits.deductibleRemainingUsd === null
                      ? "—"
                      : `${usd(benefits.deductibleRemainingUsd)} (unmet — nothing posted against it yet)`}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Coinsurance</dt>
                  <dd className="font-medium">
                    {benefits.coinsurancePercent === null
                      ? "—"
                      : `${benefits.coinsurancePercent}% patient / ${100 - benefits.coinsurancePercent}% plan`}
                  </dd>
                </div>
              </dl>
              <p className="mt-1 text-[10px] text-slate-500">
                {benefits.planName ? `Plan: ${benefits.planName}. ` : ""}
                {benefits.source}
              </p>
            </div>
          )}

          {!coverage && (
            <p className="rounded-lg border border-dashed border-slate-200 p-3 text-[11px] text-slate-500">
              No primary coverage on file, so there is nothing the payer could answer. Register the card in
              Step 1 first.
            </p>
          )}
        </div>
      </div>

      {checked && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">Prior authorization may be required</p>
              <p className="mt-1 text-xs text-amber-700">
                Some procedures need prior authorization before they are billed. The Prior Auth workstation
                submits and tracks the request.
              </p>
              <button
                type="button"
                onClick={() => setRole("prior-auth")}
                className="mt-3 flex min-h-10 items-center gap-1.5 rounded-lg bg-amber-600 px-4 text-xs font-bold text-white transition-colors hover:bg-amber-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
              >
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                Go to Prior Auth workstation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** `$1,500.00` — the plan's own money, printed as money. */
function usd(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
