/**
 * SignLockStage — Sign & Lock Note (Placeholder)
 *
 * Inspiration: Epic's Sign and Lock workflow and Athenahealth's
 * encounter finalization. Both EHRs require clinicians to review,
 * sign, and lock the completed note, making it a permanent part
 * of the medical record. This placeholder will be expanded with
 * signature workflow, compliance checks, and locking in a later task.
 */

import { Lock, Shield, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import type { SoapNoteData } from "./AssessmentPlanStage";

interface SignLockStageProps {
  patientName?: string;
  note?: SoapNoteData;
  onSignAndLock?: () => void;
  isSubmitting?: boolean;
}

export function SignLockStage({ patientName, note, onSignAndLock, isSubmitting }: SignLockStageProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-800">Sign & Lock Note</h3>
          <p className="text-sm text-slate-500">
            {patientName ? `Finalize encounter for ${patientName}` : "Review and sign documentation"}
          </p>
        </div>
      </div>

      {/* Completion Checklist */}
      <div className="clinical-card">
        <div className="mb-3 flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-600" />
          <span className="text-sm font-semibold text-slate-700">Encounter Completion Checklist</span>
        </div>
        <div className="space-y-2">
          {[
            { label: "Vital signs recorded", done: true },
            { label: "HPI documented", done: !!note?.subjective },
            { label: "Review of Systems completed", done: !!note?.objective },
            { label: "Assessment & Plan documented", done: !!(note?.assessment || note?.plan) },
            { label: "Orders placed", done: false },
            { label: "Patient instructions provided", done: false },
            { label: "Follow-up scheduled", done: false },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              {item.done ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <div className="h-4 w-4 rounded-full border-2 border-slate-300" />
              )}
              <span className={`text-sm ${item.done ? "text-slate-500 line-through" : "text-slate-700"}`}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Compliance notice */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-amber-800">Compliance & Billing Requirements</p>
            <p className="mt-1 text-xs text-amber-700">
              All required fields must be completed before the note can be signed and locked.
              ICD-10 coding and CPT billing codes will be required for finalization.
            </p>
          </div>
        </div>
      </div>

      {/* Sign & Lock button */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
        <Lock className="mx-auto mb-3 h-10 w-10 text-slate-300" />
        <h4 className="text-base font-semibold text-slate-700">{isSubmitting ? "Submitting..." : "Ready to Sign?"}</h4>
        <p className="mt-1 text-sm text-slate-500">
          Review all documentation before signing and locking the encounter note.
        </p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            onClick={onSignAndLock}
            disabled={isSubmitting}
            className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all ${
              isSubmitting
                ? "bg-blue-400 text-white cursor-wait"
                : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md"
            }`}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            {isSubmitting ? "Signing & Locking..." : "Sign & Lock Note"}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          {isSubmitting
            ? "Processing your clinical note submission..."
            : "Complete all workflow stages, then sign and lock to submit the encounter."}
        </p>
      </div>
    </div>
  );
}