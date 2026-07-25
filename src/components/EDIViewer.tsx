/**
 * EDIViewer — X12 EDI Transaction Viewer
 *
 * Tabs: 837P (Claims), 835 (Remittance), 276/277 (Status), 278 (PA).
 * Toggle raw/parsed views with segment descriptions.
 */

import { useState } from "react";
import { FileCode, Copy, Eye, X } from "lucide-react";

// ─── Mock EDI Data ──────────────────────────────────────────────────

const EDI_TRANSACTIONS: Record<string, { raw: string; parsed: { seg: string; desc: string; value: string }[] }> = {
  "837P": {
    raw: "ISA*00*          *00*          *ZZ*1234567890     *ZZ*9876543210     *240725*1200*^*00501*000000001*0*P*:~GS*HC*1234567890*9876543210*20240725*1200*1*X*005010X222A1~ST*837*0001*005010X222A1~BHT*0019*00*CLAIM001*20240725*1200*CH~NM1*41*1*DOE*JANE****46*1001~NM1*40*2*BCBS*****46*ANTHEM01~HL*1**20*1~NM1*85*1*SMITH*JOHN****XX*1234567890~CLM*CLAIM001*185.00***11:B:1*Y*A*Y*Y~",
    parsed: [
      { seg: "ISA", desc: "Interchange Control Header", value: "Sender: 1234567890, Receiver: 9876543210" },
      { seg: "GS", desc: "Functional Group Header", value: "HC=Health Care Claim, Group# 1" },
      { seg: "ST", desc: "Transaction Set Header", value: "837 Claim Transaction" },
      { seg: "BHT", desc: "Beginning of Hierarchical Transaction", value: "Batch: CLAIM001" },
      { seg: "NM1-41", desc: "Submitter Name", value: "JANE DOE" },
      { seg: "NM1-40", desc: "Receiver Name", value: "BCBS (ANTHEM01)" },
      { seg: "HL", desc: "Hierarchical Level", value: "Level 1 — Billing Provider" },
      { seg: "NM1-85", desc: "Billing Provider", value: "JOHN SMITH, NPI: 1234567890" },
      { seg: "CLM", desc: "Claim Information", value: "Claim# CLAIM001, $185.00" },
      { seg: "HI", desc: "Health Care Diagnosis Code", value: "BK: I10" },
      { seg: "SV1", desc: "Professional Service", value: "CPT 99213, $185.00" },
      { seg: "DTP", desc: "Date — Service", value: "2024-07-25" },
      { seg: "SE", desc: "Transaction Set Trailer", value: "Segments: 15, Control#: 0001" },
      { seg: "GE", desc: "Functional Group Trailer", value: "1 Transaction Set" },
      { seg: "IEA", desc: "Interchange Control Trailer", value: "1 Functional Group" },
    ],
  },
  "835": {
    raw: "ISA*00*          *00*          *ZZ*9876543210     *ZZ*1234567890     *240725*1215*^*00501*000000002*0*P*:~GS*HP*9876543210*1234567890*20240725*1215*1*X*005010X221A1~ST*835*0002~BPR*I*133.20*C*CHK*CHECK001***20240725~TRN*1*TRACE001*1998765432~CLP*CLAIM001*1*185.00*148.00*14.80**1234567890~CAS*CO*45*14.80~PLB*1234567890*20240725*133.20~SE*9*0002~GE*1*1~IEA*1*000000002~",
    parsed: [
      { seg: "ISA", desc: "Interchange Control Header", value: "Sender: 9876543210, Receiver: 1234567890" },
      { seg: "GS", desc: "Functional Group Header", value: "HP=ERA 835 Remittance, Group# 1" },
      { seg: "ST", desc: "Transaction Set Header", value: "835 ERA Transaction" },
      { seg: "BPR", desc: "Financial Information", value: "Payment: $133.20, Check# CHECK001" },
      { seg: "TRN", desc: "Reassociation Trace Number", value: "TRACE001" },
      { seg: "CLP", desc: "Claim Payment Info", value: "CLAIM001: Billed $185, Paid $148, Adjustment $14.80" },
      { seg: "CAS", desc: "Claim Adjustment", value: "CO-45: Contractual Obligation $14.80" },
      { seg: "PLB", desc: "Provider Level Balance", value: "Total Paid: $133.20" },
      { seg: "SE", desc: "Transaction Set Trailer", value: "Segments: 9" },
    ],
  },
  "276/277": {
    raw: "ISA*00*          *00*          *ZZ*1234567890     *ZZ*9876543210     *240725*1230*^*00501*000000003*0*P*:~GS*HN*1234567890*9876543210*20240725*1230*1*X*005010X212~ST*276*0003~BHT*0010*13*STATUS001*20240725*1230~HL*1**20*1~NM1*PR*2*BCBS*****PI*ANTHEM01~TRN*1*TRACE003*1998765432~STC*A1:20:PR*20240725*WQ*15*2024-08-08~",
    parsed: [
      { seg: "ISA", desc: "Interchange Control Header", value: "Status Inquiry 276" },
      { seg: "ST", desc: "Transaction Set Header", value: "276 Claim Status Request" },
      { seg: "BHT", desc: "Beginning of Hierarchical Transaction", value: "Status Request: STATUS001" },
      { seg: "NM1-PR", desc: "Payer Name", value: "BCBS (ANTHEM01)" },
      { seg: "TRN", desc: "Trace Number", value: "TRACE003" },
      { seg: "STC", desc: "Status Information", value: "Status: In Process, Est. Completion: 08/08/2024" },
    ],
  },
  "278": {
    raw: "ISA*00*          *00*          *ZZ*1234567890     *ZZ*9876543210     *240725*1245*^*00501*000000004*0*P*:~GS*HI*1234567890*9876543210*20240725*1245*1*X*005010X217~ST*278*0004~BHT*0007*11*PA001*20240725*1245~HL*1**20*1~NM1*EX*2*BCBS*****PI*ANTHEM01~UM*I*1**PA*:27447*2024-07-25~DTP*435*D8*20240725~HCR*PA*:27447~",
    parsed: [
      { seg: "ISA", desc: "Interchange Control Header", value: "PA Request 278" },
      { seg: "ST", desc: "Transaction Set Header", value: "278 Prior Auth Request" },
      { seg: "BHT", desc: "Beginning of Hierarchical Transaction", value: "PA Request: PA001" },
      { seg: "NM1-EX", desc: "Utilization Review Org", value: "BCBS (ANTHEM01)" },
      { seg: "UM", desc: "Utilization Management", value: "PA for CPT 27447 — Knee Replacement" },
      { seg: "DTP", desc: "Date — Service", value: "2024-07-25" },
      { seg: "HCR", desc: "Health Care Review", value: "PA required for 27447" },
    ],
  },
};

// ─── Component ──────────────────────────────────────────────────────

export function EDIViewer() {
  const [showPanel, setShowPanel] = useState(false);
  const [activeTab, setActiveTab] = useState("837P");
  const [viewMode, setViewMode] = useState<"raw" | "parsed">("parsed");
  const [copied, setCopied] = useState(false);

  const copyEDI = () => {
    navigator.clipboard.writeText(EDI_TRANSACTIONS[activeTab].raw).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const tabs = Object.keys(EDI_TRANSACTIONS);
  const data = EDI_TRANSACTIONS[activeTab];

  return (
    <div className="relative">
      <button onClick={() => setShowPanel(!showPanel)} className="flex items-center gap-1.5 rounded-lg border border-gray-400 bg-gray-50 px-2.5 py-1.5 text-[10px] font-medium text-gray-600 hover:bg-gray-100">
        <FileCode className="h-3.5 w-3.5" /> EDI Viewer
      </button>
      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/20" onClick={() => setShowPanel(false)}>
          <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl p-5 animate-slide-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div><h3 className="text-sm font-bold text-slate-800">X12 EDI Viewer</h3></div>
              <button onClick={() => setShowPanel(false)} className="text-slate-400"><X className="h-4 w-4" /></button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-3 overflow-x-auto">
              {tabs.map(t => <button key={t} onClick={() => setActiveTab(t)} className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[10px] font-medium ${activeTab === t ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-500"}`}>{t}</button>)}
            </div>

            {/* View toggle */}
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] text-slate-400">{activeTab} Transaction</p>
              <div className="flex gap-1">
                <button onClick={() => setViewMode("parsed")} className={`rounded px-2 py-1 text-[9px] ${viewMode === "parsed" ? "bg-blue-600 text-white" : "bg-slate-100"}`}>Parsed</button>
                <button onClick={() => setViewMode("raw")} className={`rounded px-2 py-1 text-[9px] ${viewMode === "raw" ? "bg-blue-600 text-white" : "bg-slate-100"}`}>Raw</button>
                <button onClick={copyEDI} className="rounded bg-slate-100 px-2 py-1 text-[9px] flex items-center gap-1"><Copy className="h-3 w-3" />{copied ? "Copied!" : ""}</button>
              </div>
            </div>

            {viewMode === "parsed" ? (
              <div className="space-y-1">
                {data.parsed.map((p, i) => (
                  <div key={i} className="rounded-lg border border-slate-200 p-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-mono font-bold text-blue-700">{p.seg}</span>
                      <span className="text-[9px] text-slate-500">{p.desc}</span>
                    </div>
                    <p className="mt-0.5 text-[9px] text-slate-700">{p.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <pre className="rounded-lg bg-gray-900 p-3 text-[9px] text-green-400 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed max-h-64">{data.raw}</pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
