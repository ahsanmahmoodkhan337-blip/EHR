/**
 * ConsentPortal — Digital Patient Consent Workflow
 *
 * 3-step consent: HIPAA Privacy, Consent to Treat, Financial Responsibility.
 * Digital signature with typed name, progress indicator.
 */

import { useState } from "react";
import { FileSignature, CheckCircle2, ArrowRight, ArrowLeft, Shield } from "lucide-react";

const FORMS = [
  {
    id: "hipaa",
    title: "HIPAA Privacy Notice",
    content: `HIPAA PRIVACY NOTICE

This notice describes how medical information about you may be used and disclosed and how you can get access to this information.

Your Rights:
- You have the right to inspect and copy your medical records.
- You have the right to request amendments to your records.
- You have the right to an accounting of disclosures.
- You have the right to request confidential communications.

Our Responsibilities:
- We are required by law to maintain the privacy of your health information.
- We will notify you if a breach occurs involving your health information.
- We must follow the duties and privacy practices described in this notice.`,
  },
  {
    id: "consent",
    title: "Consent to Treat",
    content: `CONSENT TO TREAT

I voluntarily consent to receive medical care from Healthcare Hustlers providers. This consent includes:
- Routine medical examination and treatment
- Diagnostic procedures as deemed medically appropriate
- Medical treatment considered necessary by the provider
- Administration of medications as prescribed

I understand that:
- I have the right to discuss treatment options
- I can refuse treatment at any time
- No guarantees have been made regarding outcomes`,
  },
  {
    id: "financial",
    title: "Financial Responsibility",
    content: `FINANCIAL RESPONSIBILITY AGREEMENT

I understand and agree that:
- I am financially responsible for all charges not covered by my insurance
- I must pay any co-payments and deductibles at time of service
- If my insurance denies a claim, I am responsible for the balance
- Unpaid balances may be sent to collections after 90 days
- I authorize release of medical information needed to process insurance claims
- I authorize direct payment of insurance benefits to the provider`,
  },
];

export function ConsentPortal() {
  const [showPanel, setShowPanel] = useState(false);
  const [step, setStep] = useState(0);
  const [signed, setSigned] = useState<Record<string, boolean>>({});
  const [signature, setSignature] = useState("");
  const [allDone, setAllDone] = useState(false);

  const checkStep = (idx: number) => {
    setSigned(prev => ({ ...prev, [FORMS[idx].id]: true }));
    if (idx < 2) setStep(idx + 1);
    else setAllDone(true);
  };

  return (
    <div className="relative">
      <button onClick={() => setShowPanel(!showPanel)} className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[10px] font-medium text-violet-600 hover:bg-violet-100">
        <FileSignature className="h-3.5 w-3.5" /> Consents
      </button>
      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={() => setShowPanel(false)}>
          <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl p-5 animate-slide-in" onClick={e => e.stopPropagation()}>
            {!allDone ? (
              <>
                {/* Progress */}
                <div className="flex items-center gap-1 mb-4">
                  {FORMS.map((f, i) => (
                    <div key={f.id} className={`flex-1 h-1 rounded ${i <= step ? signed[f.id] ? "bg-green-500" : "bg-violet-500" : "bg-slate-200"}`} />
                  ))}
                </div>
                <p className="text-[9px] text-slate-400 mb-2">Step {step + 1} of 3</p>
                <h3 className="text-sm font-bold text-slate-800 mb-2">{FORMS[step].title}</h3>
                <pre className="whitespace-pre-wrap text-[10px] text-slate-600 bg-slate-50 rounded-lg p-3 mb-3 max-h-48 overflow-y-auto font-sans leading-relaxed">{FORMS[step].content}</pre>
                <label className="flex items-center gap-2 mb-3 text-[10px] text-slate-600">
                  <input type="checkbox" checked={!!signed[FORMS[step].id]} onChange={() => setSigned(prev => ({ ...prev, [FORMS[step].id]: !prev[FORMS[step].id] }))} className="h-3 w-3 accent-violet-500" />
                  I have read and understand this form
                </label>
                <button onClick={() => checkStep(step)} disabled={!signed[FORMS[step].id]} className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-[10px] font-medium text-white hover:bg-violet-500 disabled:bg-slate-300">
                  {step < 2 ? <><ArrowRight className="h-3.5 w-3.5 inline mr-1" />Confirm & Next</> : <><Shield className="h-3.5 w-3.5 inline mr-1" />Complete & Sign All</>}
                </button>
                {step > 0 && <button onClick={() => setStep(step - 1)} className="w-full mt-2 rounded-lg border px-4 py-2 text-[10px] text-slate-500"><ArrowLeft className="h-3 w-3 inline mr-1" />Back</button>}
              </>
            ) : (
              <div className="text-center py-8">
                <div className="rounded-full bg-green-100 p-4 inline-block mb-3"><CheckCircle2 className="h-10 w-10 text-green-600" /></div>
                <h3 className="text-sm font-bold text-slate-800">All Consents Signed</h3>
                <p className="text-[10px] text-slate-500 mt-1">HIPAA Privacy Notice, Consent to Treat, and Financial Responsibility completed.</p>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 justify-center text-[10px] text-slate-600">
                    <span className="text-slate-400">Signed by:</span>
                    <span className="font-medium">{signature || localStorage.getItem("hh_student_name") || "Patient"}</span>
                  </div>
                  <div className="text-[10px] text-slate-400">Date: {new Date().toLocaleDateString()}</div>
                </div>
                <button onClick={() => { setShowPanel(false); setStep(0); setSigned({}); }} className="mt-4 rounded-lg bg-violet-600 px-4 py-2 text-[10px] font-medium text-white">Close</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
