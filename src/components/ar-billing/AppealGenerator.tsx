/**
 * AppealGenerator — Denial Appeal Letter Generator
 *
 * Modal generating formal appeal letters for denied claims.
 * CARC/RARC codes, auto-fills patient data, pre-built templates.
 */

import { useState } from "react";
import { FileText, Printer, Copy, CheckCircle2, X } from "lucide-react";
import { CARC_CODES } from "../../data/claims/carc";

// ─── Templates ──────────────────────────────────────────────────────

const TEMPLATES: Record<string, { subject: string; body: string }> = {
  "CO-16": {
    subject: "Appeal of Claim Denial — Missing Information",
    body: "We are writing to formally appeal the denial of the above-referenced claim. All required information was included with the original submission. We have attached the supporting documentation including the clinical note, lab results, and prior authorization approval. We respectfully request reprocessing of this claim.",
  },
  "CO-11": {
    subject: "Appeal of Claim Denial — Diagnosis/Procedure Mismatch",
    body: "We are appealing the denial based on alleged inconsistency between the diagnosis and procedure codes. The procedure was medically necessary based on the patient's clinical presentation and documented diagnosis. The ICD-10 code supports the medical necessity of the procedure performed. Please review the attached clinical documentation.",
  },
  "CO-50": {
    subject: "Appeal of Claim Denial — Medical Necessity",
    body: "This letter serves as a formal first-level appeal for the denied service. The procedure was medically necessary for the patient's condition as documented in the medical record. We have included supporting clinical documentation, evidence-based guidelines, and peer-reviewed literature supporting the medical necessity of the service.",
  },
  "CO-197": {
    subject: "Appeal of Claim Denial — Prior Authorization",
    body: "We are appealing the denial stating that no authorization was on record. The authorization was requested and obtained before the service date, and the service was performed within its validity period. We have attached the authorization confirmation and the supporting clinical records for your review.",
  },
};

// ─── Component ──────────────────────────────────────────────────────

interface AppealGeneratorProps {
  patientName?: string;
  patientMRN?: string;
  icdCodes?: string[];
  cptCodes?: string[];
}

export function AppealGenerator({ patientName = "Jane Doe", patientMRN = "MRN-1001", icdCodes = ["I10", "E11.9"], cptCodes = ["99214"] }: AppealGeneratorProps) {
  const [showPanel, setShowPanel] = useState(false);
  const [carcCode, setCarcCode] = useState("CO-16");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [copied, setCopied] = useState(false);
  const [showPrint, setShowPrint] = useState(false);

  const template = TEMPLATES[carcCode] || TEMPLATES["CO-16"];
  const carc = CARC_CODES.find(c => c.code === carcCode);

  const letter = `[Date] ${new Date().toLocaleDateString()}

Re: ${template.subject}
Claim ID: CLAIM-${Date.now().toString(36).toUpperCase()}
Patient: ${patientName}
MRN: ${patientMRN}
Denial Code: ${carcCode} — ${carc?.description || ""}
ICD-10 Codes: ${icdCodes.join(", ")}
CPT Codes: ${cptCodes.join(", ")}

Dear Appeals Department,

${template.body}

${additionalNotes ? additionalNotes + "\n\n" : ""}We respectfully request that you review the attached documentation and reprocess this claim accordingly. Please contact our office if additional information is required.

Sincerely,
Healthcare Hustlers RCM Department
Phone: (555) 555-0105`;

  const handleCopy = () => {
    navigator.clipboard.writeText(letter).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div className="relative">
      <button onClick={() => setShowPanel(!showPanel)} className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100">
        <FileText className="h-3.5 w-3.5" /> Appeal Letter
      </button>
      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/20" onClick={() => setShowPanel(false)}>
          <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl p-5 animate-slide-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div><h3 className="text-sm font-bold text-slate-800">Denial Appeal Generator</h3><p className="text-[11px] text-slate-400">Generate formal appeal letter</p></div>
              <button onClick={() => setShowPanel(false)} className="text-slate-400"><X className="h-4 w-4" /></button>
            </div>

            {!showPrint ? (
              <>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div><label className="text-xs font-medium text-slate-500">Patient</label><p className="text-xs text-slate-700">{patientName}</p></div>
                  <div><label className="text-xs font-medium text-slate-500">MRN</label><p className="text-xs text-slate-700">{patientMRN}</p></div>
                </div>
                <div className="mb-3">
                  <label className="text-xs font-medium text-slate-500">CARC Denial Code</label>
                  <select value={carcCode} onChange={e => setCarcCode(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none mt-1">
                    {CARC_CODES.map(c => <option key={c.code} value={c.code}>{c.code} — {c.description}</option>)}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="text-xs font-medium text-slate-500">Appeal Rationale (editable)</label>
                  <textarea value={template.body} readOnly className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 bg-slate-50 resize-none h-20 mt-1" />
                </div>
                <div className="mb-3">
                  <label className="text-xs font-medium text-slate-500">Additional Notes</label>
                  <textarea value={additionalNotes} onChange={e => setAdditionalNotes(e.target.value)} placeholder="Add any supplemental justification..." className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none resize-none h-16 mt-1" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowPrint(true)} className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-500"><Printer className="h-3.5 w-3.5" /> Generate & Print</button>
                  <button onClick={handleCopy} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-600">{copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copied!" : "Copy"}</button>
                </div>
              </>
            ) : (
              <div>
                <div className="rounded-lg border-2 border-slate-300 bg-white p-6 shadow-inner mb-3">
                  <pre className="whitespace-pre-wrap text-xs text-slate-700 leading-relaxed font-sans">{letter}</pre>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-500"><Printer className="h-3.5 w-3.5" /> Print Letter</button>
                  <button onClick={handleCopy} className="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-xs">{copied ? "Copied!" : "Copy"}</button>
                  <button onClick={() => setShowPrint(false)} className="rounded-lg border px-4 py-2 text-xs text-slate-500">Back to Edit</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
