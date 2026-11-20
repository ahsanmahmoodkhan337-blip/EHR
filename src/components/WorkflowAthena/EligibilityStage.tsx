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
 */

import { useState } from "react";
import { CheckCircle2, Search, Shield, ArrowRight } from "lucide-react";
import { usePatientStore } from "../../store/patientStore";
import { useEhrStore } from "../../store/ehrStore";
import { usePipeline } from "../../store/pipelineStore";
import {
  ELIGIBILITY_LABELS,
  eligibilityDate,
  eligibilityOf,
  runEligibility270,
} from "../../domain/eligibility";
import { memberIdOnFile, patientCard } from "../../domain/patientCard";

export function EligibilityStage({ patientId }: { patientId?: string | null }) {
  const { getPatientById } = usePatientStore();
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

  const runInquiry = () => {
    if (!patient || !coverage) return;
    setRunning(true);
    // The 271 is written from the record, not from a timer: the short wait is
    // only the round trip, and the answer is the same one the banner will show.
    const record = runEligibility270(coverage, new Date().toISOString());
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
            disabled={running || !coverage}
            aria-label="Run the 270/271 eligibility inquiry for this patient's primary coverage"
            title={coverage ? undefined : "This patient has no primary coverage on file — register the card first."}
            className="flex min-h-10 items-center gap-2 rounded-lg bg-purple-600 px-4 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            {running ? "Inquiring…" : checked ? "Re-run 270 inquiry" : "Verify eligibility (270)"}
          </button>

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
                <p>{stored.payerResponse}</p>
              </div>
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
