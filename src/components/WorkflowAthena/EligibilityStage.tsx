/**
 * EligibilityStage — Insurance Eligibility Verification
 *
 * Student triggers a simulated 270/271 eligibility inquiry.
 * After verification, a button directs to the Prior Auth workstation
 * for full PA management — no mini-PA here.
 */

import { useState } from "react";
import { Search, CheckCircle2, Building, Shield, ArrowRight } from "lucide-react";
import { usePipeline } from "../../store/pipelineStore";

const CLINICAL_INDICATIONS = [
  { value: "", label: "— Select Clinical Indication —" },
  { value: "atypical-chest-pain", label: "Atypical Chest Pain with history of hypertension" },
  { value: "routine-screening", label: "Routine screening, asymptomatic" },
  { value: "chest-trauma", label: "Chest trauma" },
];

const CORRECT_INDICATION = "atypical-chest-pain";

export function EligibilityStage({ patientName, dob, insurance }: { patientName?: string; dob?: string; insurance?: string }) {
  const [inquiryDone, setInquiryDone] = useState(false);
  const [inquiryLoading, setInquiryLoading] = useState(false);
  const { setRole } = usePipeline();

  const handleInquiry = () => {
    setInquiryLoading(true);
    setInquiryDone(false);
    setTimeout(() => {
      setInquiryLoading(false);
      setInquiryDone(true);
    }, 1200);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-800">Step 2: Insurance Eligibility Verification</h3>
          <p className="text-sm text-slate-500">Verify patient insurance coverage via simulated 270/271 inquiry</p>
        </div>
        {inquiryDone && (
          <span className="flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Coverage Verified
          </span>
        )}
      </div>

      {/* ─── Payer Portal ─── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <Building className="h-5 w-5 text-slate-600" />
          <span className="text-sm font-bold text-slate-700">Payer Portal</span>
          <span className="ml-auto rounded bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">{insurance || "Anthem Blue Cross"}</span>
        </div>
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="font-medium">Patient:</span> {patientName || "—"}
            <span className="ml-4 font-medium">DOB:</span> {dob || "—"}
            <span className="ml-4 font-medium">Insurance:</span> {insurance || "—"}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleInquiry} disabled={inquiryLoading}
              className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 transition-colors">
              <Search className="h-4 w-4" />
              {inquiryLoading ? "Inquiring..." : inquiryDone ? "Re-run 270 Inquiry" : "Verify Eligibility (270)"}
            </button>
          </div>

          {/* ─── 271 Response ─── */}
          {inquiryLoading && (
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-500 animate-pulse">
              <Search className="h-4 w-4" /> Sending 270 eligibility inquiry...
            </div>
          )}
          {inquiryDone && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-xs font-semibold text-green-800">✓ EDI 271 Eligibility Response Received</p>
              <div className="mt-2 space-y-1 text-[11px] text-slate-700">
                <p><span className="font-medium">Plan:</span> {insurance || "PPO"} — Active</p>
                <p><span className="font-medium">Copay:</span> $25</p>
                <p><span className="font-medium">Deductible:</span> $500 (met)</p>
                <p><span className="font-medium">Coinsurance:</span> 20%</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Route to Prior Auth ─── */}
      {inquiryDone && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">Prior Authorization May Be Required</p>
              <p className="mt-1 text-xs text-amber-700">
                Some procedures require prior authorization before billing. Use the dedicated Prior Auth workstation to submit and track PA requests with SLA monitoring.
              </p>
              <button
                onClick={() => setRole("prior-auth")}
                className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-500 transition-colors"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                Go to Prior Auth Workstation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}