/**
 * EligibilityStage — Eligibility & Prior Authorization
 *
 * Inspiration: Payer Portal interface concept.
 * Student triggers a simulated 270/271 eligibility inquiry,
 * then submits a Prior Auth request with clinical indication.
 * Correct answer triggers mock PA approval; wrong answer
 * shows denial.
 */

import { useState } from "react";
import { Search, FileCheck, FileX, AlertTriangle, CheckCircle2, Building, Stethoscope } from "lucide-react";

const CLINICAL_INDICATIONS = [
  { value: "", label: "— Select Clinical Indication —" },
  { value: "atypical-chest-pain", label: "Atypical Chest Pain with history of hypertension" },
  { value: "routine-screening", label: "Routine screening, asymptomatic" },
  { value: "chest-trauma", label: "Chest trauma" },
];

const CORRECT_INDICATION = "atypical-chest-pain";

export function EligibilityStage() {
  const [inquiryDone, setInquiryDone] = useState(false);
  const [inquiryLoading, setInquiryLoading] = useState(false);
  const [selectedIndication, setSelectedIndication] = useState("");
  const [paSubmitted, setPaSubmitted] = useState(false);
  const [paResult, setPaResult] = useState<"approved" | "denied" | null>(null);

  const handleInquiry = () => {
    setInquiryLoading(true);
    setInquiryDone(false);
    setTimeout(() => {
      setInquiryLoading(false);
      setInquiryDone(true);
    }, 1200);
  };

  const handlePaSubmit = () => {
    setPaSubmitted(true);
    if (selectedIndication === CORRECT_INDICATION) {
      setPaResult("approved");
    } else {
      setPaResult("denied");
    }
  };

  const isStageComplete = paResult === "approved";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-800">Step 2: Eligibility & Prior Authorization</h3>
          <p className="text-sm text-slate-500">Verify insurance eligibility and submit prior authorization</p>
        </div>
        {isStageComplete && (
          <span className="flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> PA Approved
          </span>
        )}
      </div>

      {/* ─── Payer Portal ─── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <Building className="h-5 w-5 text-slate-600" />
          <span className="text-sm font-bold text-slate-700">Payer Portal</span>
          <span className="ml-auto rounded bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">Anthem Blue Cross</span>
        </div>
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="font-medium">Patient:</span> Jonathan Doe
            <span className="ml-4 font-medium">DOB:</span> 04/15/1988
            <span className="ml-4 font-medium">Subscriber ID:</span> XYZ987654321
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleInquiry} disabled={inquiryLoading || isStageComplete}
              className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 transition-colors">
              <Search className="h-4 w-4" />
              {inquiryLoading ? "Inquiring..." : "Inquire 270 Eligibility"}
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
                <p><span className="font-medium">Plan:</span> PPO Active</p>
                <p><span className="font-medium">Benefit:</span> Myocardial Perfusion Imaging (CPT 78452) requires Prior Authorization</p>
                <p><span className="font-medium">Copay:</span> $25</p>
                <p><span className="font-medium">Deductible:</span> $500 (met)</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Prior Auth Request Form ─── */}
      {inquiryDone && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <Stethoscope className="h-5 w-5 text-slate-600" />
            <span className="text-sm font-bold text-slate-700">Prior Authorization Request</span>
            <span className="ml-auto text-[10px] text-slate-400">CPT 78452</span>
          </div>

          <div className="mt-3 space-y-3">
            <div>
              <label className="text-[11px] font-medium text-slate-500">Procedure</label>
              <p className="text-sm font-medium text-slate-700">Myocardial Perfusion Imaging (CPT 78452)</p>
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-500">Select Clinical Indication</label>
              <select value={selectedIndication} onChange={e => setSelectedIndication(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                disabled={isStageComplete}>
                {CLINICAL_INDICATIONS.map(ci => (
                  <option key={ci.value} value={ci.value}>{ci.label}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end">
              <button onClick={handlePaSubmit} disabled={!selectedIndication || isStageComplete}
                className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                Submit Prior Auth Request
              </button>
            </div>
          </div>

          {/* ─── PA Result ─── */}
          {paSubmitted && paResult === "approved" && (
            <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                <div>
                  <p className="text-xs font-semibold text-green-800">✓ Prior Authorization Approved</p>
                  <p className="mt-0.5 text-[11px] text-green-700">
                    PA Number: <span className="font-bold">PA-99812A</span><br />
                    Procedure: Myocardial Perfusion Imaging (CPT 78452)<br />
                    Effective: 30 days from approval
                  </p>
                </div>
              </div>
            </div>
          )}
          {paSubmitted && paResult === "denied" && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
              <div className="flex items-start gap-2">
                <FileX className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                <div>
                  <p className="text-xs font-semibold text-red-800">✗ PA Denied — Clinical Criteria Not Met</p>
                  <p className="mt-0.5 text-[11px] text-red-700">
                    The selected clinical indication does not meet medical necessity criteria for
                    Myocardial Perfusion Imaging. Please review guidelines and select the appropriate
                    indication.
                  </p>
                  <button onClick={() => { setPaSubmitted(false); setPaResult(null); }}
                    className="mt-2 rounded bg-red-100 px-3 py-1 text-[10px] font-medium text-red-700 hover:bg-red-200 transition-colors">
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}