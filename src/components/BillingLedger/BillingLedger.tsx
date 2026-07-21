/**
 * BillingLedger — Enhanced Medical Biller Workspace
 *
 * Full educational content for medical billing students:
 * - Interactive CMS-1500 form with all 33 blocks explained
 * - Claim scrubber with NCCI edits check
 * - Denial code reference (CO, PR, OA codes)
 * - ERA/EOB explanation on paid claims
 * - Revenue codes and POS codes reference
 * - Reimbursement calculator
 *
 * Inspiration: Epic Resolute Hospital Billing / AAPC CPB curriculum
 */

import { useState, useEffect } from "react";
import { Receipt, Send, AlertTriangle, ArrowRight, CheckCircle2, XCircle, Search, FileText, DollarSign, BookOpen, Info, Route, FileDown, Star, Shield } from "lucide-react";
import { usePipeline } from "../../store/pipelineStore";
import { usePatientStore, type RoutingNote } from "../../store/patientStore";
import { CMS1500_BLOCKS, DENIAL_CODES, REVENUE_CODES, POS_CODES } from "./claimData";
import { exportCMS1500PDF } from "../../utils/pdfExport";
import { scoreBiller, updateStageScore, getStudentName } from "../../utils/scoring";

type BillingTab = "form" | "scrubber" | "denials" | "references";

export function BillingLedger() {
  const { state, submitClaim, handleDenial, setRole, paRecords } = usePipeline();
  const { caseStates, setBillingStatus, setPaStatus, addRoutingNote, addAuditLog, getPatientById } = usePatientStore();
  const patientId = state.encounterId || state.patientId || "P001";
  const patient = getPatientById(patientId);
  const cs = caseStates[patientId];

  const [payer, setPayer] = useState("Medicare");
  const [posCode, setPosCode] = useState("11");
  const [submitted, setSubmitted] = useState(false);
  const [billingScore, setBillingScore] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<BillingTab>("form");
  const [needsPriorAuth, setNeedsPriorAuth] = useState(false);

  // Auto-check the PA checkbox when PA records exist for this patient
  useEffect(() => {
    const patientPaRecords = paRecords.filter((r) => r.patientId === (state.patientId || "P001"));
    if (patientPaRecords.length > 0) {
      setNeedsPriorAuth(true);
    }
  }, [paRecords, state.patientId]);
  const [showRoutingModal, setShowRoutingModal] = useState(false);
  const [routingMemo, setRoutingMemo] = useState("");
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [transmitProgress, setTransmitProgress] = useState(0);
  const [transmitResult, setTransmitResult] = useState<"paid" | "denied" | null>(null);

  // Claim scrubber state
  const [scrubResults, setScrubResults] = useState<{ check: string; pass: boolean; note: string }[] | null>(null);

  // ── Editable CMS-1500 form field values ──
  const genPolicyNum = () => "POL-" + Math.random().toString(36).slice(2, 10).toUpperCase();
  const [cms1500, setCms1500] = useState<Record<string, string>>(() => ({
    "1": payer,
    "2": patient ? `${patient.firstName} ${patient.lastName}` : (state.patientId || ""),
    "3": patient?.dob || "",
    "4": "",
    "5": patient?.address || "",
    "6": "Self",
    "9": "",
    "11": genPolicyNum(),
    "11c": patient?.insurance || "",
    "14": new Date().toISOString().split("T")[0],
    "17": "",
    "17a": "",
    "21": state.icdCodes.join(", "),
    "23": "",
    "24": state.cptCodes.join(", "),
    "25": "XX-XXXXXXX",
    "28": "",
    "32": "Healthcare Hustlers Training Clinic",
    "33": "Healthcare Hustlers EHR — Educational",
  }));
  const updateCmsField = (box: string, value: string) => setCms1500(prev => ({ ...prev, [box]: value }));

  // Sync auto-fillable fields when patient/pipeline data changes
  useEffect(() => {
    setCms1500(prev => ({
      ...prev,
      "1": payer,
      "2": patient ? `${patient.firstName} ${patient.lastName}` : prev["2"],
      "3": patient?.dob || prev["3"],
      "5": patient?.address || prev["5"],
      "11c": patient?.insurance || prev["11c"],
      "21": state.icdCodes.join(", "),
      "24": state.cptCodes.join(", "),
      "23": paRecords.filter(r => r.patientId === patientId).slice(-1)[0]?.id || prev["23"],
    }));
  }, [payer, patient, state.icdCodes, state.cptCodes, paRecords, patientId]);

  const cmsEditableBlocks = CMS1500_BLOCKS.filter(b => 
    ["1","2","3","4","5","6","9","11","11c","14","17","17a","21","23","24","25","28","32","33"].includes(b.box)
  );

  const runScrubber = () => {
    const results = [
      { check: "ICD-10 code present", pass: state.icdCodes.length > 0, note: state.icdCodes.length > 0 ? `${state.icdCodes.length} code(s) found` : "No diagnosis codes entered" },
      { check: "CPT code present", pass: state.cptCodes.length > 0, note: state.cptCodes.length > 0 ? `${state.cptCodes.length} code(s) found` : "No procedure codes entered" },
      { check: "Diagnosis supports procedure", pass: state.icdCodes.length > 0 && state.cptCodes.length > 0, note: "Educational: Verify ICD-10 supports medical necessity for the CPT code" },
      { check: "Payer selected", pass: true, note: `Payer: ${payer}` },
      { check: "Place of service selected", pass: true, note: `POS: ${posCode}` },
      { check: "Modifier check", pass: state.cptCodes.length <= 1, note: state.cptCodes.length > 1 ? "Multiple procedures may need modifier -25 or -59" : "Single procedure — no modifier needed" },
    ];
    setScrubResults(results);
  };

  const handleSubmit = () => {
    const patientPaRecords = paRecords.filter((r) => r.patientId === (state.patientId || "P001"));
    // Only redirect to PA if checkbox is ticked AND no PA has been submitted yet
    if (needsPriorAuth && patientPaRecords.length === 0) {
      setRole("prior-auth");
      return;
    }
    submitClaim({ payer, posCode, submittedAt: new Date().toISOString() });
    setSubmitted(true);
    const score = scoreBiller(true, false, false);
    setBillingScore(score);
    updateStageScore(getStudentName(), "biller", score);
  };

  const simulateDenial = () => {
    handleDenial("CO-16 — Claim lacks information");
    setActiveTab("denials");
  };

  // Calculate estimated payment
  const calcPayment = () => {
    const rates: Record<string, number> = { Medicare: 0.80, Medicaid: 0.65, "Blue Cross": 0.85, "United Healthcare": 0.82, Aetna: 0.83 };
    const rate = rates[payer] ?? 0.80;
    const billed = 185.00;
    return { billed, allowed: billed * rate, paid: billed * rate * 0.90, patient: billed * rate * 0.10 };
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-violet-600" />
          <h2 className="text-sm font-bold text-slate-800">Medical Billing — Enhanced Billing Ledger</h2>
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700">Stage 3</span>
        </div>
      </div>

      {submitted ? (
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="max-w-md rounded-xl border border-purple-200 bg-purple-50 p-8 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-green-500" />
            <p className="text-sm font-medium text-purple-700">Claim Submitted Successfully!</p>
            <p className="mt-2 text-xs text-purple-600">
              The claim has been submitted to the payer.
              {state.icdCodes?.some(c => c.startsWith('Z') || c.startsWith('S') || c.startsWith('M'))
                ? ' This encounter may require Prior Authorization. Please proceed to the Prior Auth stage to verify.'
                : ' No prior authorization is needed for this encounter. The claim has been processed.'}
            </p>
            {billingScore !== null && (
              <div className="mt-3 flex items-center justify-center gap-1.5 text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5 text-xs">
                <Star className="h-3.5 w-3.5" />
                Biller Score: <strong>{billingScore}/15</strong>
              </div>
            )}
            <div className="mt-6 flex justify-center gap-3">
              <button onClick={() => setSubmitted(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Back to Billing
              </button>
              <button
                onClick={() => {
                  exportCMS1500PDF({
                    patientName: patient ? `${patient.firstName} ${patient.lastName}` : (state.patientId || "Unknown"),
                    dob: patient?.dob || "N/A",
                    insurance: patient?.insurance || payer,
                    diagnosisCodes: state?.icdCodes || [],
                    procedureCodes: state?.cptCodes || [],
                    charges: calcPayment().billed,
                    status: "Submitted — Paid",
                    payer,
                    posCode,
                  });
                }}
                className="flex items-center gap-2 rounded-lg border border-purple-300 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50 transition-colors"
              >
                <FileDown className="h-4 w-4" />
                Download CMS-1500 as PDF
              </button>
              <button onClick={() => setRole("prior-auth")} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500">
                Proceed to Prior Auth
              </button>
            </div>
          </div>
        </div>
      ) : state.status === "coded" || state.status === "billed" ? (
        <div className="flex flex-1 overflow-hidden">
          {/* ─── Left: CMS-1500 Form + Actions ─── */}
          <div className="flex flex-1 flex-col overflow-y-auto p-4">
            {/* Tab navigation */}
            <div className="flex gap-1 border-b border-slate-200 pb-2 mb-4">
              {[
                { key: "form" as BillingTab, label: "CMS-1500 Form" },
                { key: "scrubber" as BillingTab, label: "Claim Scrubber" },
                { key: "denials" as BillingTab, label: "Denial Codes" },
                { key: "references" as BillingTab, label: "References" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-1.5 text-[10px] font-medium rounded-t-lg transition-colors ${
                    activeTab === tab.key
                      ? "bg-violet-50 text-violet-700 border-b-2 border-violet-500"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* CMS-1500 Form */}
            {activeTab === "form" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-violet-500" />
                  <span className="text-xs font-semibold text-slate-600">CMS-1500 Claim Form — Interactive Mockup</span>
                  <span className="text-[10px] text-slate-400">(Fill each editable box below)</span>
                </div>

                {/* Editable CMS-1500 Form Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {cmsEditableBlocks.map((block) => {
                    const value = cms1500[block.box] || "";
                    const isAutoFilled = block.autoFilled;
                    return (
                      <div key={block.box} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-2.5 hover:border-violet-300 transition-colors">
                        <span className="font-mono text-[10px] text-violet-500 font-bold min-w-[42px] pt-1">Box {block.box}</span>
                        <div className="flex-1 min-w-0">
                          <label className="text-[9px] text-slate-400 block truncate">{block.label}</label>
                          {block.box === "1" ? (
                            <select
                              value={value}
                              onChange={e => updateCmsField("1", e.target.value)}
                              className="w-full rounded border border-slate-200 px-1.5 py-0.5 text-[10px] outline-none focus:border-violet-400 bg-white"
                            >
                              <option>Medicare</option><option>Medicaid</option><option>Blue Cross</option>
                              <option>United Healthcare</option><option>Aetna</option><option>Cigna</option>
                              <option>Other</option>
                            </select>
                          ) : (
                            <input
                              type={block.box === "3" || block.box === "14" ? "date" : "text"}
                              value={block.box === "3" && value ? value : block.box === "14" ? value : value}
                              onChange={e => updateCmsField(block.box, e.target.value)}
                              readOnly={isAutoFilled}
                              className={`w-full rounded border px-1.5 py-0.5 text-[10px] outline-none focus:border-violet-400 ${
                                isAutoFilled ? "bg-slate-50 text-slate-500 border-slate-100 cursor-default" : "border-slate-200 bg-white"
                              }`}
                              placeholder={block.label}
                            />
                          )}
                          {/* Tooltip */}
                          <div className="mt-0.5 text-[8px] text-slate-400 leading-tight opacity-0 group-hover:opacity-100 transition-opacity hidden md:block">
                            {block.description}
                            {block.commonError && <span className="text-red-400 ml-1">⚠ {block.commonError}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Claim entry form */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold text-slate-700 mb-3">Claim Submission</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-500">Payer</label>
                      <select value={payer} onChange={(e) => setPayer(e.target.value)} className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs">
                        <option>Medicare</option><option>Medicaid</option><option>Blue Cross</option>
                        <option>United Healthcare</option><option>Aetna</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500">Place of Service</label>
                      <select value={posCode} onChange={(e) => setPosCode(e.target.value)} className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs">
                        {POS_CODES.slice(0, 6).map((p) => (
                          <option key={p.code} value={p.code}>{p.code} — {p.description}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mt-3 text-[10px] text-slate-400">
                    ICD-10: {state.icdCodes.join(", ") || "—"} &nbsp;|&nbsp; CPT: {state.cptCodes.join(", ") || "—"}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <input type="checkbox" id="needsPA" checked={needsPriorAuth} onChange={e => setNeedsPriorAuth(e.target.checked)} className="accent-violet-500" />
                    <label htmlFor="needsPA" className="text-[10px] text-slate-600">This encounter requires <strong>Prior Authorization</strong></label>
                  </div>
                  {/* PA Status indicator */}
                  {(() => {
                    const patientPaRecords = paRecords.filter((r) => r.patientId === (state.patientId || "P001"));
                    const approvedPa = patientPaRecords.find((r) => r.status === "approved");
                    const pendingPa = patientPaRecords.find((r) => r.status === "submitted" || r.status === "in-progress" || r.status === "pending");
                    const hasPaRecords = patientPaRecords.length > 0;
                    if (hasPaRecords) {
                      return (
                        <div className={`mt-2 rounded-lg p-2 border ${approvedPa ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
                          <p className={`text-[10px] font-medium ${approvedPa ? "text-green-700" : "text-amber-700"}`}>
                            {approvedPa ? (
                              <><CheckCircle2 className="inline h-3 w-3 mr-1" /> Prior Authorization Approved — proceed with billing</>
                            ) : (
                              <><AlertTriangle className="inline h-3 w-3 mr-1" /> PA {pendingPa ? `"${pendingPa.status}" — awaiting approval` : "submitted — awaiting decision"}</>
                            )}
                          </p>
                          {approvedPa?.authEndDate && (() => {
                            const end = new Date(approvedPa.authEndDate);
                            const daysLeft = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                            return daysLeft <= 14 ? (
                              <p className="text-[9px] text-amber-600 mt-0.5 flex items-center gap-1">
                                <AlertTriangle className="h-2.5 w-2.5" /> Auth expires in {daysLeft} day{daysLeft !== 1 ? "s" : ""}
                              </p>
                            ) : (
                              <p className="text-[9px] text-green-600 mt-0.5">Auth valid until {end.toLocaleDateString()}</p>
                            );
                          })()}
                        </div>
                      );
                    }
                    if (needsPriorAuth) {
                      return (
                        <div className="mt-2 rounded-lg border-2 border-amber-300 bg-amber-50 p-3">
                          <p className="text-[11px] font-semibold text-amber-800 flex items-center gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Prior Authorization Required
                          </p>
                          <p className="mt-1 text-[10px] text-amber-700">You cannot submit this claim until Prior Authorization is completed. Go to Stage 4 to fill the PA form.</p>
                          <button
                            onClick={() => setRole("prior-auth")}
                            className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-500 transition-colors"
                          >
                            <Shield className="h-3.5 w-3.5" />
                            Go to Prior Auth Portal
                          </button>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => {
                    exportCMS1500PDF({
                      patientName: cms1500["2"] || patient ? `${patient.firstName} ${patient.lastName}` : "Unknown",
                      dob: cms1500["3"] || patient?.dob || "N/A",
                      insurance: cms1500["11c"] || patient?.insurance || payer,
                      diagnosisCodes: state?.icdCodes || [],
                      procedureCodes: state?.cptCodes || [],
                      charges: parseFloat(cms1500["28"]) || calcPayment().billed,
                      status: "Draft — Pending Submission",
                      payer: cms1500["1"] || payer,
                      posCode,
                      cmsFields: cms1500,
                    });
                  }}
                    className="flex items-center gap-2 rounded-lg border border-violet-300 bg-violet-50 px-4 py-2.5 text-xs font-medium text-violet-700 hover:bg-violet-100"
                  >
                    <FileDown className="h-3.5 w-3.5" /> Download CMS-1500 Draft
                  </button>
                  <button onClick={handleSubmit} className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-medium text-white hover:bg-violet-500">
                    <Send className="h-3.5 w-3.5" /> Submit Claim (Path A — Paid)
                  </button>
                  <button onClick={simulateDenial} className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-700 hover:bg-red-100">
                    <AlertTriangle className="h-3.5 w-3.5" /> Simulate Denial (Path B)
                  </button>
                  <button onClick={runScrubber} className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5 text-xs font-medium text-sky-700 hover:bg-sky-100">
                    <Search className="h-3.5 w-3.5" /> Run Clearinghouse Scrubber
                  </button>
                  {/* Phase 3: Transmit 837P */}
                  <button onClick={() => {
                    setIsTransmitting(true);
                    setTransmitProgress(0);
                    const interval = setInterval(() => {
                      setTransmitProgress(p => {
                        if (p >= 100) {
                          clearInterval(interval);
                          const missingMod25 = state.cptCodes.length > 1 && !cs?.modifier25Applied;
                          setTransmitResult(missingMod25 ? "denied" : "paid");
                          if (missingMod25) {
                            setBillingStatus(patientId, "DRAFT");
                            addAuditLog(patientId, { timestamp: new Date().toISOString(), role: "biller", message: "837P transmitted — Modifier 25 missing, claim denied", status: "error" });
                          } else {
                            setBillingStatus(patientId, "CLEARED_AND_SENT");
                            addAuditLog(patientId, { timestamp: new Date().toISOString(), role: "biller", message: "837P transmitted successfully — claim paid", status: "success" });
                          }
                          setIsTransmitting(false);
                          return 100;
                        }
                        return p + 5;
                      });
                    }, 100);
                  }} className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50" disabled={isTransmitting}>
                    <Send className="h-3.5 w-3.5" /> Transmit 837P
                  </button>
                  {/* Phase 3: Route to PA */}
                  {cs?.paStatus === "REQUIRED_MISSING" && (
                    <button onClick={() => setShowRoutingModal(true)} className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-700 hover:bg-amber-100">
                      <Route className="h-3.5 w-3.5" /> Route Claim to PA Specialist
                    </button>
                  )}
                </div>

                {/* Transmit Progress Bar */}
                {isTransmitting && (
                  <div className="mt-3">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-emerald-500 transition-all duration-200" style={{ width: `${transmitProgress}%` }} />
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">Transmitting 837P... {transmitProgress}%</p>
                  </div>
                )}

                {/* Transmit Result */}
                {transmitResult === "paid" && (
                  <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <p className="flex items-center gap-1 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> 837P Transmitted — Claim Paid
                    </p>
                  </div>
                )}
                {transmitResult === "denied" && (
                  <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3">
                    <p className="flex items-center gap-1 text-xs font-medium text-rose-700">
                      <XCircle className="h-3.5 w-3.5" /> Modifier 25 Missing — Claim Denied (CO-16)
                    </p>
                    <p className="mt-1 text-[10px] text-rose-600">Route to AR for remediation.</p>
                  </div>
                )}

                {/* Phase 3: Routing Modal */}
                {showRoutingModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
                      <h3 className="text-sm font-bold text-slate-800">Clearinghouse Exception</h3>
                      <p className="mt-1 text-xs text-slate-500">Prior Authorization is required for CPT 78452. Route to PA specialist before submitting.</p>
                      <div className="mt-4">
                        <label className="text-[11px] font-medium text-slate-500">Internal Routing Instructions / Memo to PA Team</label>
                        <textarea value={routingMemo} onChange={e => setRoutingMemo(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
                          rows={3} placeholder="e.g. Patient has chest pain history — rush PA review" />
                      </div>
                      <div className="mt-4 flex justify-end gap-2">
                        <button onClick={() => setShowRoutingModal(false)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                        <button onClick={() => {
                          addRoutingNote(patientId, { timestamp: new Date().toISOString(), fromRole: "biller", toRole: "prior-auth", noteText: routingMemo || "PA required — routing for approval" });
                          setBillingStatus(patientId, "PENDING_PA_ROUTE");
                          setPaStatus(patientId, "PENDING_REVIEW");
                          addAuditLog(patientId, { timestamp: new Date().toISOString(), role: "biller", message: "Routed to PA Specialist — prior authorization required", status: "warning" });
                          setShowRoutingModal(false);
                          setRoutingMemo("");
                        }} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500">
                          Route Claim to PA Specialist
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Scrubber results */}
                {scrubResults && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold text-slate-700 mb-3">Claim Scrubber Results</p>
                    <div className="space-y-2">
                      {scrubResults.map((r) => (
                        <div key={r.check} className="flex items-start gap-2 text-xs">
                          {r.pass ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />}
                          <div>
                            <span className={`font-medium ${r.pass ? "text-green-700" : "text-red-700"}`}>{r.pass ? "✓" : "✗"} {r.check}</span>
                            <p className="text-[10px] text-slate-500">{r.note}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Denial Code Reference */}
            {activeTab === "denials" && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" /> Denial Code Reference — Educational
                </p>
                {DENIAL_CODES.map((d) => (
                  <div key={d.code} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`font-mono font-bold text-sm ${
                        d.category === "CO" ? "text-red-600" : d.category === "PR" ? "text-amber-600" : "text-sky-600"
                      }`}>{d.code}</span>
                      <span className="text-slate-500 text-[10px]">({d.category === "CO" ? "Contractual" : d.category === "PR" ? "Patient Responsibility" : "Organizational"})</span>
                    </div>
                    <p className="mt-1 font-medium text-slate-700">{d.description}</p>
                    <p className="mt-0.5 text-slate-500">{d.meaning}</p>
                    <p className="mt-1 text-[10px] text-green-700">💡 Fix: {d.howToFix}</p>
                  </div>
                ))}
              </div>
            )}

            {/* References */}
            {activeTab === "references" && (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-2">Place of Service (POS) Codes</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {POS_CODES.map((p) => (
                      <div key={p.code} className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px]">
                        <span className="font-mono font-bold text-slate-600">{p.code}</span>
                        <span className="ml-1.5 text-slate-500">{p.description}</span>
                        <span className="ml-1 text-[8px] text-slate-400">({p.setting})</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-2">Revenue Codes (Institutional Claims)</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {REVENUE_CODES.map((r) => (
                      <div key={r.code} className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px]">
                        <span className="font-mono font-bold text-slate-600">{r.code}</span>
                        <span className="ml-1.5 text-slate-500">{r.description}</span>
                        <span className="ml-1 text-[8px] text-slate-400">({r.type})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ─── Right: Reimbursement Calculator ─── */}
          <div className="hidden w-64 border-l border-slate-200 bg-slate-50 p-4 lg:block overflow-y-auto">
            <div className="flex items-center gap-1.5 mb-3">
              <DollarSign className="h-3.5 w-3.5 text-green-500" />
              <span className="text-[10px] font-semibold text-slate-500">Reimbursement Calculator</span>
            </div>
            <div className="space-y-3">
              <div className="rounded-lg bg-white p-3 shadow-sm">
                <p className="text-[10px] text-slate-400">Fee Schedule</p>
                <p className="text-lg font-bold text-green-600">$185.00</p>
                <p className="text-[10px] text-slate-400">Billed Amount</p>
              </div>
              <div className="rounded-lg bg-white p-3 shadow-sm">
                <p className="text-[10px] text-slate-400">Payer Rate</p>
                <p className="text-sm font-bold text-slate-700">{payer}: {(calcPayment().allowed / calcPayment().billed * 100).toFixed(0)}% of billed</p>
              </div>
              <div className="rounded-lg bg-green-50 p-3 border border-green-200">
                <p className="text-[10px] text-green-600">Estimated Payment</p>
                <p className="text-lg font-bold text-green-700">${calcPayment().paid.toFixed(2)}</p>
                <p className="text-[10px] text-green-500">Patient responsibility: ${calcPayment().patient.toFixed(2)}</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-3 border border-amber-200">
                <p className="text-[10px] text-amber-600 flex items-center gap-1"><Info className="h-3 w-3" /> Educational</p>
                <p className="text-[10px] text-amber-700">The difference between billed and allowed amounts is a contractual adjustment. Most payers don't pay 100% of charges.</p>
              </div>
            </div>
          </div>
        </div>
      ) : state.status === "paid" ? (
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="max-w-md rounded-xl border border-green-200 bg-green-50 p-8 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-green-500" />
            <p className="text-sm font-medium text-green-700">Claim Submitted & Paid — ERA Summary</p>
            <div className="mt-4 space-y-2 text-left text-xs">
              <div className="flex justify-between border-b border-green-200 pb-1"><span className="text-green-600">Billed Amount:</span><span className="font-medium text-green-800">${calcPayment().billed.toFixed(2)}</span></div>
              <div className="flex justify-between border-b border-green-200 pb-1"><span className="text-green-600">Allowed Amount:</span><span className="font-medium text-green-800">${calcPayment().allowed.toFixed(2)}</span></div>
              <div className="flex justify-between border-b border-green-200 pb-1"><span className="text-green-600">Paid Amount:</span><span className="font-bold text-green-800">${calcPayment().paid.toFixed(2)}</span></div>
              <div className="flex justify-between border-b border-green-200 pb-1"><span className="text-green-600">Patient Responsibility:</span><span className="font-medium text-green-800">${calcPayment().patient.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-green-600">Contractual Adjustment:</span><span className="font-medium text-green-800">${(calcPayment().billed - calcPayment().allowed).toFixed(2)}</span></div>
            </div>
            <p className="mt-4 text-[10px] text-green-500">This is an Electronic Remittance Advice (ERA) — it shows what the insurance paid vs what was billed. The difference is the contractual adjustment per your payer agreement.</p>
          </div>
        </div>
      ) : state.status === "denied" ? (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-1 items-center justify-center p-4">
            <div className="max-w-lg rounded-xl border border-red-200 bg-red-50 p-6">
              <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-red-500" />
              <p className="text-sm font-medium text-red-700 text-center">Claim Denied — Routed to AR Queue</p>
              <p className="mt-2 text-xs text-red-600 text-center">{state.denialInfo?.code}</p>
              <div className="mt-4 space-y-2">
                {DENIAL_CODES.filter(d => d.code === "CO-16" || d.code === "CO-50").map((d) => (
                  <div key={d.code} className="rounded-lg bg-white p-3 text-xs">
                    <span className="font-mono font-bold text-red-600">{d.code}</span>
                    <p className="mt-0.5 text-slate-600">{d.description}</p>
                    <p className="mt-1 text-[10px] text-green-700">💡 Fix: {d.howToFix}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="hidden w-64 border-l border-slate-200 bg-slate-50 p-4 lg:block overflow-y-auto">
            <p className="text-xs font-semibold text-slate-700 mb-2">Denial Quick Reference</p>
            <div className="space-y-2">
              {DENIAL_CODES.slice(0, 5).map((d) => (
                <div key={d.code} className="rounded bg-white p-2 text-[10px] border border-slate-200">
                  <span className="font-mono font-bold text-red-500">{d.code}</span>
                  <p className="text-slate-500">{d.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <Receipt className="mb-2 h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-400">Waiting for coded encounter...</p>
          <p className="text-xs text-slate-300">Complete coding first</p>
        </div>
      )}
    </div>
  );
}