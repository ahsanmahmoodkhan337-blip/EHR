// ──────────────────────────────────────────────────────────────────────
// PriorAuthPortal.tsx — Prior Authorization Hub (Stage 4)
// CoverMyMeds-inspired design: clean PA queue dashboard, e-PA submission form
// with real patient data, payer-specific templates, document attachments,
// real-time status tracking, and step therapy tracker.
// Inspired by: CoverMyMeds + Epic PA Hub
// ──────────────────────────────────────────────────────────────────────

import { useState, useMemo } from "react";
import {
  Shield,
  ClipboardList,
  FileCheck,
  FileX,
  Clock,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar,
  User,
  Building2,
  FileText,
  Search,
  ArrowRight,
  ListChecks,
  Stethoscope,
  BookOpen,
  FlaskConical,
  Upload,
  Paperclip,
  Loader2,
  PhoneCall,
  MessageSquare,
  Plus,
  FileDown,
} from "lucide-react";
import { usePipeline } from "../../store/pipelineStore";
import { usePatientStore } from "../../store/patientStore";
import {
  PA_PROCEDURES,
  PA_COMMON_ERRORS,
  PA_STATUS_FLOW,
  PA_STATUS_LABELS,
  PA_TIMELINE_STEPS,
  SAMPLE_PA_QUEUE,
  SUBMISSION_METHODS,
  PA_RECORDS,
  type ProcedureKey,
  type PAQueueItem,
  type PARecord,
} from "./paData";
import { exportPAFormPDF } from "../../utils/pdfExport";

type TabView = "queue" | "insurance" | "form" | "criteria" | "docs" | "step-therapy" | "letter" | "followup" | "errors";

// CoverMyMeds brand colors
const CMM_PRIMARY = "bg-[#4A1D96]";
const CMM_PRIMARY_HOVER = "hover:bg-[#3B1580]";
const CMM_LIGHT = "bg-purple-50";
const CMM_BORDER = "border-[#4A1D96]";

// Payer-specific requirements
const PAYER_REQUIREMENTS: Record<string, { label: string; requirements: string[]; turnaroundTime: string }> = {
  Medicare: { label: "Medicare", requirements: ["CMS NCD/LCD criteria", "Medicare Advantage policy", "Signature requirements"], turnaroundTime: "72 hours" },
  Medicaid: { label: "Medicaid", requirements: ["State-specific criteria", "Income verification", "Referral from PCP"], turnaroundTime: "5-7 business days" },
  "Blue Cross Blue Shield": { label: "BCBS", requirements: ["BCBS medical policy", "Step therapy (if applicable)", "Network provider confirmation"], turnaroundTime: "48-72 hours" },
  "United Healthcare": { label: "UHC", requirements: ["UHC Care Provider guidelines", "Lab values within 30 days", "Specialist referral"], turnaroundTime: "48 hours" },
  Aetna: { label: "Aetna", requirements: ["Aetna Clinical Policy Bulletins", "ICD-10 code matching", "Prior treatment history"], turnaroundTime: "48-72 hours" },
  Cigna: { label: "Cigna", requirements: ["Cigna Medical Coverage Policy", "Peer-to-peer review available", "Documentation of failed conservative therapy"], turnaroundTime: "3-5 business days" },
};

// Document attachment simulation
interface DocAttachment {
  name: string;
  status: "attached" | "missing" | "pending";
  icon: string;
}

export default function PriorAuthPortal() {
  const { state, submitPA, addPARecord, setRole } = usePipeline();
  const { getPatientById } = usePatientStore();

  // Get the first patient from the pipeline state or the first mock patient
  const patientId = state.patientId || "P001";
  const patient = getPatientById(patientId);

  // Active tab
  const [activeTab, setActiveTab] = useState<TabView>("queue");

  // Form state
  const [procedure, setProcedure] = useState<ProcedureKey | "">("");
  const [payer, setPayer] = useState("Medicare");
  const [clinicalJustification, setClinicalJustification] = useState("");
  const [icdCodes, setIcdCodes] = useState(state.icdCodes?.join(", ") || "");
  const [cptCodes, setCptCodes] = useState(state.cptCodes?.join(", ") || "");
  const [submitted, setSubmitted] = useState(false);

  // Auth start/end date fields
  const [authStartDate, setAuthStartDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });
  const [authEndDate, setAuthEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 90);
    return d.toISOString().split("T")[0];
  });

      // Criteria checkboxes
  const [checkedCriteria, setCheckedCriteria] = useState<Record<string, boolean>>({});
  // Step therapy checkboxes
  const [stepTherapyComplete, setStepTherapyComplete] = useState<Record<string, boolean>>({});

  // Document attachments state
  const [docAttachments, setDocAttachments] = useState<Record<string, "attached" | "missing">>({});

  // Queue filter
  const [queueFilter, setQueueFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Letter state
  const [letterPatientName, setLetterPatientName] = useState(patient ? `${patient.firstName} ${patient.lastName}` : "");
  const [letterDiagnosis, setLetterDiagnosis] = useState("");

  // Current PA timeline simulation
  const [timelineStep, setTimelineStep] = useState(0);

  // Payer-specific requirements
  const payerInfo = PAYER_REQUIREMENTS[payer] || PAYER_REQUIREMENTS["Medicare"];

  const isLocked = state.status !== "coded" && state.status !== "billed" && !submitted;

  // Get procedure data
  const procedureData = procedure ? PA_PROCEDURES[procedure as ProcedureKey] : null;

  // ── NEW: Expandable queue card state ──
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  // ── NEW: Insurance verification state ──
  const [insuranceVerified, setInsuranceVerified] = useState<boolean | null>(null);
  const [verificationResult, setVerificationResult] = useState<string>("");
  const [verifyingInsurance, setVerifyingInsurance] = useState(false);

  // ── NEW: Follow-up tracking state ──
  const [followupDate, setFollowupDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [followupTracking, setFollowupTracking] = useState("");
  const [followupRep, setFollowupRep] = useState("");
  const [followupNotes, setFollowupNotes] = useState("");
  const [followupSubmitted, setFollowupSubmitted] = useState(false);
  const { addFollowUp, caseStates } = usePatientStore();
  const patientCase = patientId ? caseStates[patientId] : undefined;
  const patientFollowups = patientCase?.followups ?? [];

  // ── NEW: Auth date alerts computed ──
  const alerts = useMemo(() => {
    const today = new Date();
    const expiringSoon: PAQueueItem[] = [];
    const refillDue: PAQueueItem[] = [];
    const infoRequired: PAQueueItem[] = [];
    const overdueFollowup: PAQueueItem[] = [];

    SAMPLE_PA_QUEUE.forEach((r) => {
      // Check auth end date — alert 2 weeks before
      if (r.authEndDate) {
        const end = new Date(r.authEndDate);
        const daysUntilExpiry = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilExpiry <= 14 && daysUntilExpiry >= 0) expiringSoon.push(r);
      }
      // Check next refill date — alert 1 week before
      if (r.nextRefillDate) {
        const refill = new Date(r.nextRefillDate);
        const daysUntilRefill = Math.ceil((refill.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilRefill <= 7 && daysUntilRefill >= 0) refillDue.push(r);
      }
      // Info required
      if (r.status === "info-required") infoRequired.push(r);
      // Overdue follow-up (next-followup past due)
      if (r.status === "next-followup") overdueFollowup.push(r);
    });

    return { expiringSoon, refillDue, infoRequired, overdueFollowup };
  }, []);

  // Toggle criteria checkbox
  const toggleCriterion = (id: string) => {
    setCheckedCriteria((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Toggle step therapy checkbox
  const toggleStepTherapy = (index: number) => {
    setStepTherapyComplete((prev) => ({ ...prev, [String(index)]: !prev[String(index)] }));
  };

  // Toggle document attachment
  const toggleDocAttachment = (docName: string) => {
    setDocAttachments((prev) => ({
      ...prev,
      [docName]: prev[docName] === "attached" ? "missing" : "attached",
    }));
  };

  // Criteria met percentage
  const criteriaMet = useMemo(() => {
    if (!procedureData) return { met: 0, total: 0, pct: 0 };
    const total = procedureData.criteria.length;
    const met = procedureData.criteria.filter((c) => checkedCriteria[c.id]).length;
    return { met, total, pct: total > 0 ? Math.round((met / total) * 100) : 0 };
  }, [procedureData, checkedCriteria]);

  // Handle submit
  const handleSubmit = () => {
    const paRecord = {
      id: `PA-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      patientId: patient?.id || "P001",
      procedure: procedure ? PA_PROCEDURES[procedure as ProcedureKey]?.label || procedure : "General consultation",
      insuranceName: patient?.insurance || payer,
      paProcessor: "",
      authStartDate: authStartDate,
      authEndDate: authEndDate,
      nextRefillDate: "",
      submissionMethod: "EHR",
      submittedBy: "Current User",
      submittedAt: new Date().toISOString(),
      status: "submitted",
      verificationStatus: insuranceVerified ? "verified" : "not-verified",
      verificationResult: verificationResult || "",
    };
    addPARecord(paRecord);
    submitPA({
      procedure: paRecord.procedure,
      payer,
      submittedAt: paRecord.submittedAt,
      justification: clinicalJustification,
      icdCodes,
      cptCodes,
      patientName: patient ? `${patient.firstName} ${patient.lastName}` : "[Patient Name]",
      paId: paRecord.id,
      insuranceName: paRecord.insuranceName,
      authStartDate: paRecord.authStartDate,
      authEndDate: paRecord.authEndDate,
    });
    setSubmitted(true);
    // Don't auto-switch to Biller — let the user see the queue first
  };

  // Filtered queue
  const filteredQueue = useMemo(() => {
    return SAMPLE_PA_QUEUE.filter((item) => {
      const matchesFilter = queueFilter === "all" || item.status === queueFilter;
      const matchesSearch =
        !searchTerm ||
        item.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.procedure.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.id.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [queueFilter, searchTerm]);

  // ─── Tabs ─────────────────────────────────────────────────────────
  const tabs: { key: TabView; label: string; icon: React.ReactNode }[] = [
    { key: "queue", label: "Queue", icon: <ClipboardList className="h-3.5 w-3.5" /> },
    { key: "insurance", label: "Insurance Verif.", icon: <Shield className="h-3.5 w-3.5" /> },
    { key: "form", label: "e-PA Form", icon: <FileText className="h-3.5 w-3.5" /> },
    { key: "criteria", label: "Criteria", icon: <ListChecks className="h-3.5 w-3.5" /> },
    { key: "docs", label: "Documents", icon: <Paperclip className="h-3.5 w-3.5" /> },
    { key: "step-therapy", label: "Step Therapy", icon: <ArrowRight className="h-3.5 w-3.5" /> },
    { key: "letter", label: "Letter", icon: <BookOpen className="h-3.5 w-3.5" /> },
    { key: "followup", label: "Followup", icon: <PhoneCall className="h-3.5 w-3.5" /> },
    { key: "errors", label: "Errors", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  ];

  // ════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════
  if (isLocked) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center p-6">
        <Shield className="mb-2 h-10 w-10 text-slate-300" />
        <p className="text-sm font-medium text-slate-400">Prior Authorization Portal</p>
        <p className="mt-1 text-xs text-slate-300">Complete medical coding first to unlock this stage</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col h-full">
      {/* ── CoverMyMeds-style Header ── */}
      <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${CMM_BORDER} bg-white`}>
        <Shield className="h-4 w-4 text-[#4A1D96]" />
        <h2 className="text-sm font-bold text-[#4A1D96]">Prior Authorization Hub</h2>
        <span className="rounded-full bg-[#4A1D96] px-2 py-0.5 text-[10px] font-medium text-white ml-1">
          Stage 4
        </span>
        {submitted && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 ml-auto flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Submitted
          </span>
        )}
        {/* Patient badge */}
        {patient && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[10px] text-purple-700">
            <User className="h-3 w-3" />
            {patient.firstName} {patient.lastName}
          </span>
        )}
      </div>

      {/* ── CoverMyMeds-style Sub-Tabs ── */}
      <div className="flex overflow-x-auto border-b border-slate-200 bg-slate-50 px-2 gap-0.5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 whitespace-nowrap px-2.5 py-2 text-[10px] font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-[#4A1D96] text-[#4A1D96] bg-white"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <span className={activeTab === tab.key ? "text-[#4A1D96]" : "text-slate-400"}>{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Submitted Success Banner (visible on all tabs) ── */}
      {submitted && (
        <div className="mx-4 mt-3 rounded-xl border-2 border-green-300 bg-green-50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-bold text-green-800">Prior Authorization Submitted Successfully!</p>
                <p className="text-xs text-green-600">Your PA has been added to the queue. You can view it below or proceed to billing.</p>
              </div>
            </div>
            <button
              onClick={() => setRole("biller")}
              className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-xs font-bold text-white hover:bg-green-500 transition-colors shadow-sm"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              Proceed to Billing
            </button>
          </div>
        </div>
      )}

      {/* ── Active Tab Content ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ═══ TAB: QUEUE DASHBOARD with Alerts + Expandable Cards ═══ */}
        {activeTab === "queue" && (
          <div className="space-y-4">
            {/* ── Alerts Dashboard ── */}
            {(alerts.expiringSoon.length > 0 || alerts.refillDue.length > 0 || alerts.infoRequired.length > 0 || alerts.overdueFollowup.length > 0) && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 shadow-sm">
                <p className="text-[10px] font-bold text-amber-800 mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Alerts Dashboard
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {alerts.expiringSoon.length > 0 && (
                    <div className="rounded-lg border border-amber-300 bg-white p-2.5">
                      <p className="text-[10px] font-semibold text-amber-700 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Expiring within 2 weeks
                      </p>
                      <p className="text-lg font-bold text-amber-800">{alerts.expiringSoon.length}</p>
                      <div className="mt-1 space-y-0.5">
                        {alerts.expiringSoon.slice(0, 3).map((r) => (
                          <p key={r.id} className="text-[9px] text-amber-600">{r.patientName} — {r.authEndDate}</p>
                        ))}
                      </div>
                    </div>
                  )}
                  {alerts.refillDue.length > 0 && (
                    <div className="rounded-lg border border-orange-300 bg-white p-2.5">
                      <p className="text-[10px] font-semibold text-orange-700 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Refills due within 1 week
                      </p>
                      <p className="text-lg font-bold text-orange-800">{alerts.refillDue.length}</p>
                      <div className="mt-1 space-y-0.5">
                        {alerts.refillDue.slice(0, 3).map((r) => (
                          <p key={r.id} className="text-[9px] text-orange-600">{r.patientName} — {r.nextRefillDate}</p>
                        ))}
                      </div>
                    </div>
                  )}
                  {alerts.infoRequired.length > 0 && (
                    <div className="rounded-lg border border-red-300 bg-white p-2.5">
                      <p className="text-[10px] font-semibold text-red-700 flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        Awaiting documents
                      </p>
                      <p className="text-lg font-bold text-red-800">{alerts.infoRequired.length}</p>
                      <div className="mt-1 space-y-0.5">
                        {alerts.infoRequired.slice(0, 3).map((r) => (
                          <p key={r.id} className="text-[9px] text-red-600">{r.patientName} — {r.procedure}</p>
                        ))}
                      </div>
                    </div>
                  )}
                  {alerts.overdueFollowup.length > 0 && (
                    <div className="rounded-lg border border-purple-300 bg-white p-2.5">
                      <p className="text-[10px] font-semibold text-purple-700 flex items-center gap-1">
                        <ClipboardList className="h-3 w-3" />
                        Overdue follow-ups
                      </p>
                      <p className="text-lg font-bold text-purple-800">{alerts.overdueFollowup.length}</p>
                      <div className="mt-1 space-y-0.5">
                        {alerts.overdueFollowup.slice(0, 3).map((r) => (
                          <p key={r.id} className="text-[9px] text-purple-600">{r.patientName}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-[#4A1D96]">Prior Authorization Queue</p>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search..."
                    className="w-32 rounded-md border border-slate-200 pl-6 pr-2 py-1 text-[10px] outline-none focus:border-[#4A1D96]"
                  />
                </div>
                <select
                  value={queueFilter}
                  onChange={(e) => setQueueFilter(e.target.value)}
                  className="rounded-md border border-slate-200 px-2 py-1 text-[10px] outline-none focus:border-[#4A1D96]"
                >
                  <option value="all">All Status</option>
                  {PA_STATUS_FLOW.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* CoverMyMeds-style summary cards (using 11-status flow) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
              {PA_STATUS_FLOW.map((s) => {
                const count = SAMPLE_PA_QUEUE.filter((i) => i.status === s.key).length;
                return count > 0 ? (
                  <div
                    key={s.key}
                    className={`rounded-lg border p-2 text-center ${s.bgColor} ${s.color.replace("text-", "border-")} transition-all hover:shadow-sm cursor-pointer`}
                    onClick={() => setQueueFilter(s.key === queueFilter ? "all" : s.key)}
                  >
                    <span className="text-base">{s.icon}</span>
                    <p className="text-sm font-bold">{count}</p>
                    <p className="text-[8px] font-medium leading-tight">{s.label}</p>
                  </div>
                ) : null;
              })}
            </div>

            {/* Queue cards — expandable with all fields */}
            <div className="space-y-2">
              {filteredQueue.length === 0 ? (
                <div className="px-3 py-6 text-center text-[11px] text-slate-400">
                  No matching PA requests found
                </div>
              ) : (
                filteredQueue.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-slate-200 bg-white transition-all hover:border-purple-300 hover:shadow-sm"
                  >
                    {/* Card header — always visible */}
                    <div
                      className="flex items-center justify-between p-3 cursor-pointer"
                      onClick={() => setExpandedCard(expandedCard === item.id ? null : item.id)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[10px] text-purple-600 shrink-0">{item.id}</span>
                        <span className="text-xs font-medium text-slate-800 truncate">{item.patientName}</span>
                        <span className="hidden sm:inline text-[10px] text-slate-400 truncate">{item.procedure}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-medium ${
                            PA_STATUS_LABELS[item.status]?.bgColor || "bg-slate-100"
                          } ${PA_STATUS_LABELS[item.status]?.color || "text-slate-600"}`}
                        >
                          {PA_STATUS_LABELS[item.status]?.label || item.status}
                        </span>
                        <ChevronRight className={`h-3.5 w-3.5 text-slate-400 transition-transform ${expandedCard === item.id ? "rotate-90" : ""}`} />
                      </div>
                    </div>

                    {/* Expanded view — all fields */}
                    {expandedCard === item.id && (
                      <div className="border-t border-slate-100 px-3 pb-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                          <div className="rounded bg-slate-50 p-2">
                            <p className="text-[9px] font-medium text-slate-500">Insurance</p>
                            <p className="text-[10px] text-slate-700">{item.insuranceName || "—"}</p>
                          </div>
                          <div className="rounded bg-slate-50 p-2">
                            <p className="text-[9px] font-medium text-slate-500">PA Processor</p>
                            <p className="text-[10px] text-slate-700">{item.paProcessor || "—"}</p>
                          </div>
                          <div className="rounded bg-slate-50 p-2">
                            <p className="text-[9px] font-medium text-slate-500">Auth Start / End</p>
                            <p className="text-[10px] text-slate-700">
                              {item.authStartDate ? new Date(item.authStartDate).toLocaleDateString() : "—"}
                              {" → "}
                              {item.authEndDate ? (() => {
                                const end = new Date(item.authEndDate);
                                const daysLeft = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                                return <span className={daysLeft <= 14 ? "text-red-600 font-semibold" : ""}>
                                  {end.toLocaleDateString()}{daysLeft <= 14 ? ` (${daysLeft}d)` : ""}
                                </span>;
                              })() : "—"}
                            </p>
                          </div>
                          <div className="rounded bg-slate-50 p-2">
                            <p className="text-[9px] font-medium text-slate-500">Next Refill</p>
                            <p className="text-[10px] text-slate-700">
                              {item.nextRefillDate ? (() => {
                                const refill = new Date(item.nextRefillDate);
                                const daysUntil = Math.ceil((refill.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                                return <span className={daysUntil <= 7 ? "text-orange-600 font-semibold" : ""}>
                                  {refill.toLocaleDateString()}{daysUntil <= 7 ? ` (${daysUntil}d)` : ""}
                                </span>;
                              })() : "—"}
                            </p>
                          </div>
                          <div className="rounded bg-slate-50 p-2">
                            <p className="text-[9px] font-medium text-slate-500">Submission Method</p>
                            <p className="text-[10px] text-slate-700">{item.submissionMethod || "—"}</p>
                          </div>
                          <div className="rounded bg-slate-50 p-2">
                            <p className="text-[9px] font-medium text-slate-500">Submitted By / At</p>
                            <p className="text-[10px] text-slate-700">
                              {item.submittedBy || "—"}
                              {item.submittedAt ? ` @ ${new Date(item.submittedAt).toLocaleString()}` : ""}
                            </p>
                          </div>
                        </div>
                        {/* Auth expiry alert */}
                        {item.authEndDate && (() => {
                          const end = new Date(item.authEndDate);
                          const daysLeft = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                          if (daysLeft <= 14 && daysLeft >= 0) {
                            return (
                              <div className="mt-2 rounded bg-red-50 border border-red-200 px-2 py-1">
                                <p className="text-[9px] text-red-600 flex items-center gap-1">
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                  ⚠ Authorization expires in {daysLeft} day{daysLeft !== 1 ? "s" : ""} — renew now
                                </p>
                              </div>
                            );
                          }
                          return null;
                        })()}
                        {/* Quick action buttons */}
                        <div className="mt-2 flex gap-1.5">
                          <button className="rounded bg-purple-50 px-2 py-0.5 text-[9px] font-medium text-purple-700 hover:bg-purple-100 transition-colors">
                            Check Status
                          </button>
                          {item.status === "denied" && (
                            <button className="rounded bg-red-50 px-2 py-0.5 text-[9px] font-medium text-red-700 hover:bg-red-100 transition-colors">
                              Appeal
                            </button>
                          )}
                          {item.status === "info-required" && (
                            <button className="rounded bg-amber-50 px-2 py-0.5 text-[9px] font-medium text-amber-700 hover:bg-amber-100 transition-colors">
                              Upload Documents
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Educational note */}
            <div className="rounded-lg border border-purple-100 bg-purple-50 p-3">
              <p className="text-[10px] font-medium text-purple-700">
                <ClipboardList className="mr-1 inline h-3 w-3" />
                CoverMyMeds-Style Queue Management
              </p>
              <p className="mt-1 text-[10px] text-purple-600">
                This queue mirrors real PA platforms like CoverMyMeds. Each card shows the patient, procedure, status,
                and timeline. Click "View Details" to review — click "Check Status" to simulate a payer response.
                Denied requests can be appealed directly from the queue.
              </p>
            </div>
          </div>
        )}

{/* ═══ TAB: INSURANCE VERIFICATION ═══ */}
        {activeTab === "insurance" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-purple-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-4 w-4 text-[#4A1D96]" />
                <p className="text-xs font-semibold text-[#4A1D96]">Insurance Verification</p>
              </div>

              {/* Patient Insurance Info */}
              <div className="mb-4 rounded-lg border border-purple-100 bg-purple-50 p-3">
                <p className="text-[10px] font-semibold text-purple-700 mb-2">Patient Insurance Information</p>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div><span className="text-slate-400">Payer:</span><p className="font-medium text-slate-700">{payer}</p></div>
                  <div><span className="text-slate-400">Member ID:</span><p className="font-medium text-slate-700">{patient?.mrn || "MRN-1001"}</p></div>
                  <div><span className="text-slate-400">Group #:</span><p className="font-medium text-slate-700">GRP-{Math.floor(Math.random() * 90000) + 10000}</p></div>
                  <div><span className="text-slate-400">Patient:</span><p className="font-medium text-slate-700">{patient ? `${patient.firstName} ${patient.lastName}` : "—"}</p></div>
                </div>
              </div>

              {/* Verify Button */}
              <button
                onClick={() => {
                  setVerifyingInsurance(true);
                  setInsuranceVerified(null);
                  setVerificationResult("");
                  setTimeout(() => {
                    const results = [
                      { status: "Active", detail: "Coverage effective. Deductible: $500 remaining. OOP Max: $3,000. Co-pay: $30 specialist / $20 PCP." },
                      { status: "Active", detail: "Benefits eligible. Deductible: $1,200 remaining. OOP Max: $6,350. Co-pay: $40 specialist / $25 PCP." },
                      { status: "Active", detail: "Prior auth required. Deductible: $0 met. OOP Max: $2,000. Co-pay: $15 specialist." },
                    ];
                    const result = results[Math.floor(Math.random() * results.length)];
                    setVerificationResult(result.detail);
                    setInsuranceVerified(true);
                    setVerifyingInsurance(false);
                  }, 1500);
                }}
                disabled={verifyingInsurance}
                className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-medium transition-colors ${
                  verifyingInsurance ? "bg-slate-300 text-slate-500 cursor-wait" :
                  insuranceVerified ? "bg-green-600 text-white hover:bg-green-500" :
                  "bg-[#4A1D96] text-white hover:bg-[#3B1580]"
                }`}
              >
                {verifyingInsurance ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Verifying with {payer}...</>
                ) : insuranceVerified ? (
                  <><CheckCircle2 className="h-3.5 w-3.5" /> Re-verify Insurance</>
                ) : (
                  <><Shield className="h-3.5 w-3.5" /> Verify Insurance</>
                )}
              </button>

              {/* Verification Result */}
              {verificationResult && (
                <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">Coverage Active</span>
                  </div>
                  <div className="space-y-1 text-[10px] text-green-700">
                    <p>Verification Date: {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
                    <p>Coverage Effective: {new Date().toLocaleDateString()} — Ongoing</p>
                    <p>{verificationResult}</p>
                    {procedure && (
                      <div className="mt-2 rounded bg-amber-50 border border-amber-200 p-2">
                        <p className="text-[9px] text-amber-700">⚠ <strong>Prior Authorization Required</strong> for {PA_PROCEDURES[procedure as ProcedureKey]?.label || procedure}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Educational note */}
              <div className="mt-4 rounded-lg border border-purple-100 bg-purple-50 p-3">
                <p className="text-[10px] font-medium text-purple-700">
                  <BookOpen className="inline h-3 w-3 mr-1" />
                  Always verify benefits before submitting a PA
                </p>
                <p className="mt-1 text-[10px] text-purple-600">
                  Checking patient eligibility first helps avoid denials due to inactive coverage or plan limitations.
                  Verify deductible status and whether a referral is needed before proceeding with the PA submission.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB: e-PA FORM (CoverMyMeds-style with real patient data) ═══ */}
        {activeTab === "form" && (
          <div className="space-y-4">
            {!submitted ? (
              <>
                <div className="rounded-xl border border-purple-200 bg-white p-4 shadow-sm">
                  <p className="mb-3 text-xs font-semibold text-[#4A1D96] flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    New e-Prior Authorization Request
                    <span className="ml-auto text-[9px] font-normal text-slate-400">CoverMyMeds-style form</span>
                  </p>

                  {/* ── Patient Info Section (auto-filled from chart) ── */}
                  <div className="mb-4 rounded-lg border border-purple-100 bg-purple-50 p-3">
                    <p className="text-[10px] font-semibold text-purple-700 mb-2 flex items-center gap-1">
                      <User className="h-3 w-3" /> Patient Information (auto-filled from chart)
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                      <div>
                        <span className="text-slate-400">Name:</span>
                        <p className="font-medium text-slate-700">{patient ? `${patient.firstName} ${patient.lastName}` : "—"}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">DOB:</span>
                        <p className="font-medium text-slate-700">{patient ? new Date(patient.dateOfBirth).toLocaleDateString() : "—"}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Insurance:</span>
                        <p className="font-medium text-slate-700">{patient?.insurance || "—"}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">PCP:</span>
                        <p className="font-medium text-slate-700">{patient?.primaryCareProvider || "—"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {/* Procedure */}
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-slate-500">
                        Procedure / Service <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={procedure}
                        onChange={(e) => setProcedure(e.target.value as ProcedureKey | "")}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#4A1D96]"
                        required
                      >
                        <option value="">Select a procedure...</option>
                        {Object.entries(PA_PROCEDURES).map(([key, data]) => (
                          <option key={key} value={key}>
                            {data.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Payer */}
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-slate-500">
                        Payer <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={payer}
                        onChange={(e) => setPayer(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#4A1D96]"
                      >
                        {Object.keys(PAYER_REQUIREMENTS).map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Payer-specific requirements */}
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                      <p className="text-[9px] font-semibold text-amber-700 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {payer} Requirements
                      </p>
                      <p className="text-[9px] text-amber-600 mt-0.5">
                        Turnaround: {payerInfo.turnaroundTime} | Requirements:
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {payerInfo.requirements.map((req, i) => (
                          <li key={i} className="flex items-center gap-1 text-[9px] text-amber-600">
                            <CheckCircle2 className="h-2.5 w-2.5 text-amber-400" />
                            {req}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* ── Insurance Verification ── */}
                    <div className="rounded-lg border border-purple-200 bg-white p-3">
                      <p className="text-[10px] font-semibold text-purple-700 mb-2 flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        Insurance Verification
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setVerifyingInsurance(true);
                            setInsuranceVerified(null);
                            setVerificationResult("");
                            // Simulate verification delay
                            setTimeout(() => {
                              const results = [
                                "Active — Benefits eligible. Coverage effective.",
                                "Active — Benefits eligible, deductible remaining: $1,500",
                                "Active — Prior auth required. Benefits eligible.",
                                "Active — Verified. No coverage limitations found.",
                              ];
                              const result = results[Math.floor(Math.random() * results.length)];
                              setVerificationResult(result);
                              setInsuranceVerified(true);
                              setVerifyingInsurance(false);
                            }, 1500);
                          }}
                          disabled={verifyingInsurance}
                          className={`rounded-lg px-3 py-1.5 text-[10px] font-medium transition-colors ${
                            verifyingInsurance
                              ? "bg-slate-300 text-slate-500 cursor-wait"
                              : "bg-purple-600 text-white hover:bg-purple-500"
                          }`}
                        >
                          {verifyingInsurance ? (
                            <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Verifying...</span>
                          ) : insuranceVerified ? "Re-verify" : "Verify Insurance"}
                        </button>
                        {insuranceVerified && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[9px] font-medium text-green-700 flex items-center gap-1">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Verified
                          </span>
                        )}
                      </div>
                      {verifyingInsurance && (
                        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-purple-600">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Checking {payer} eligibility...
                        </div>
                      )}
                      {verificationResult && (
                        <div className="mt-2 rounded bg-green-50 border border-green-200 px-2 py-1.5">
                          <p className="text-[9px] text-green-700">{verificationResult}</p>
                        </div>
                      )}
                    </div>

                    {/* Auto-pulled ICD / CPT from pipeline */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-[10px] font-medium text-slate-500">
                          ICD-10 Codes <span className="text-green-500">(from chart)</span>
                        </label>
                        <input
                          type="text"
                          value={icdCodes || (procedureData?.icdRanges.join(", ") ?? "")}
                          onChange={(e) => setIcdCodes(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[10px] outline-none focus:border-[#4A1D96] text-slate-600"
                          placeholder="Auto-filled from chart..."
                        />
                        {state.icdCodes?.length > 0 && (
                          <p className="mt-0.5 text-[9px] text-green-600">✓ {state.icdCodes.length} code(s) from pipeline</p>
                        )}
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-medium text-slate-500">
                          CPT Codes <span className="text-green-500">(from chart)</span>
                        </label>
                        <input
                          type="text"
                          value={cptCodes || (procedureData?.cptCodes.join(", ") ?? "")}
                          onChange={(e) => setCptCodes(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[10px] outline-none focus:border-[#4A1D96] text-slate-600"
                          placeholder="Auto-filled from chart..."
                        />
                        {state.cptCodes?.length > 0 && (
                          <p className="mt-0.5 text-[9px] text-green-600">✓ {state.cptCodes.length} code(s) from pipeline</p>
                        )}
                      </div>
                    </div>

                    {/* Clinical justification */}
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-slate-500">
                        Clinical Justification
                      </label>
                      <textarea
                        value={clinicalJustification}
                        onChange={(e) => setClinicalJustification(e.target.value)}
                        placeholder={`Describe why ${procedure ? (PA_PROCEDURES[procedure as ProcedureKey]?.label || "this procedure") : "this service"} is medically necessary for ${patient ? `${patient.firstName} ${patient.lastName}` : "the patient"}...`}
                        rows={3}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[10px] outline-none focus:border-[#4A1D96] resize-none"
                      />
                    </div>

                    {/* PA Auth Date Fields */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-[10px] font-medium text-slate-500">Authorization Start Date</label>
                        <input
                          type="date"
                          value={authStartDate}
                          onChange={(e) => setAuthStartDate(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[10px] outline-none focus:border-[#4A1D96]"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-medium text-slate-500">Authorization End Date</label>
                        <input
                          type="date"
                          value={authEndDate}
                          onChange={(e) => setAuthEndDate(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[10px] outline-none focus:border-[#4A1D96]"
                        />
                        {authEndDate && (() => {
                          const end = new Date(authEndDate);
                          const daysLeft = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                          return daysLeft <= 14 ? (
                            <p className="mt-0.5 text-[9px] text-amber-600 flex items-center gap-1">
                              <AlertTriangle className="h-2.5 w-2.5" /> Expires in {daysLeft} day{daysLeft !== 1 ? "s" : ""}
                            </p>
                          ) : null;
                        })()}
                      </div>
                    </div>

                    {/* Ordering provider auto-filled */}
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-slate-500">Ordering Provider</label>
                      <input
                        type="text"
                        value={patient?.primaryCareProvider || "Not available"}
                        readOnly
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[10px] text-slate-600 bg-slate-50"
                      />
                      <p className="mt-0.5 text-[9px] text-slate-400 italic">Auto-filled from patient chart</p>
                    </div>

                    {/* Estimated auto-auth */}
                    {procedureData?.autoAuthThreshold && procedureData.autoAuthThreshold > 0 && (
                      <div className="rounded-lg bg-blue-50 p-2.5">
                        <p className="text-[10px] text-blue-700">
                          <CheckCircle2 className="mr-1 inline h-3 w-3" />
                          Estimated auto-auth threshold:{" "}
                          <span className="font-semibold">${procedureData.autoAuthThreshold.toLocaleString()}</span>{" "}
                          — procedures under this amount may be auto-approved by {payer}.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* CoverMyMeds-style submit button */}
                <div className="flex gap-2">
                <button
                  onClick={handleSubmit}
                  disabled={!procedure}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-medium text-white transition-colors ${
                    procedure
                      ? `${CMM_PRIMARY} ${CMM_PRIMARY_HOVER}`
                      : "bg-slate-300 cursor-not-allowed"
                  }`}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Submit e-PA Request to {payer}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    exportPAFormPDF({
                      patientName: patient ? `${patient.firstName} ${patient.lastName}` : "Unknown",
                      procedure: PA_PROCEDURES[procedure as ProcedureKey]?.label || procedure || "N/A",
                      diagnosis: state.icdCodes?.join(", ") || "N/A",
                      clinicalIndication: selectedIndication || "N/A",
                      status: "Pending — Ready for Submission",
                    });
                  }}
                  disabled={!procedure}
                  className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-medium transition-colors ${
                    procedure
                      ? "border-purple-300 text-purple-700 hover:bg-purple-50"
                      : "border-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  <FileDown className="h-3.5 w-3.5" />
                  PA Form PDF
                </button>
                </div>

                {/* Pre-submit checklist */}
                {procedure && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-[10px] font-medium text-amber-700">
                      <AlertTriangle className="mr-1 inline h-3 w-3" />
                      CoverMyMeds Pre-submit Checklist
                    </p>
                    <ul className="mt-1.5 space-y-1 text-[10px] text-amber-600">
                      <li className="flex items-center gap-1.5">
                        {checkedCriteria[procedureData?.criteria[0]?.id || ""] ? (
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        ) : (
                          <XCircle className="h-3 w-3 text-amber-400" />
                        )}
                        Verify insurance criteria are met (Criteria tab)
                      </li>
                      <li className="flex items-center gap-1.5">
                        {procedureData?.stepTherapy ? (
                          stepTherapyComplete["0"] || Object.keys(stepTherapyComplete).length > 0 ? (
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                          ) : (
                            <XCircle className="h-3 w-3 text-amber-400" />
                          )
                        ) : (
                          <CheckCircle2 className="h-3 w-3 text-slate-400" />
                        )}
                        Check step therapy requirements (Step Therapy tab)
                      </li>
                      <li className="flex items-center gap-1.5">
                        {Object.keys(docAttachments).filter(k => docAttachments[k] === "attached").length >= (procedureData?.requiredDocs?.length || 1) / 2 ? (
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        ) : (
                          <XCircle className="h-3 w-3 text-amber-400" />
                        )}
                        Attach required documentation (Documents tab)
                      </li>
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3 w-3 text-slate-400" />
                        Review {payer}-specific requirements above
                      </li>
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="rounded-full bg-green-100 p-3">
                  <FileCheck className="h-8 w-8 text-green-500" />
                </div>
                <p className="mt-3 text-sm font-medium text-green-700">e-PA Submitted Successfully!</p>
                <p className="mt-1 text-xs text-slate-500">
                  {procedure ? PA_PROCEDURES[procedure as ProcedureKey]?.label || procedure : "Procedure"} — {payer}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  Patient: {patient ? `${patient.firstName} ${patient.lastName}` : "—"} | Submitted at {new Date().toLocaleTimeString()}
                </p>

                {/* CoverMyMeds-style real-time status tracking with full 11-step flow */}
                <div className="mt-6 w-full max-w-md rounded-lg border border-purple-200 bg-white p-4 shadow-sm">
                  <p className="mb-3 text-[10px] font-semibold text-[#4A1D96] flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Real-Time Status Tracking (11-Step Flow)
                  </p>
                  <div className="space-y-2">
                    {PA_TIMELINE_STEPS.map((step, i) => (
                      <div
                        key={step.key}
                        className={`flex items-center gap-2 ${
                          i <= timelineStep ? "text-purple-600" : "text-slate-300"
                        }`}
                      >
                        <div
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold shrink-0 ${
                            i <= timelineStep ? "bg-purple-100 text-purple-600 ring-1 ring-purple-300" : "bg-slate-100 text-slate-300"
                          }`}
                        >
                          {i <= timelineStep ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className={`text-[10px] font-medium ${i <= timelineStep ? "" : "text-slate-400"}`}>
                              {step.label}
                            </p>
                            {i === timelineStep && (
                              <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[8px] font-medium text-purple-600 animate-pulse">
                                Current
                              </span>
                            )}
                            {i < timelineStep && (
                              <span className="rounded bg-green-100 px-1.5 py-0.5 text-[8px] font-medium text-green-600">
                                Complete
                              </span>
                            )}
                          </div>
                          <p className="text-[9px] text-slate-400">{step.description}</p>
                        </div>
                        {i < PA_TIMELINE_STEPS.length - 1 && (
                          <div className={`h-6 w-0.5 ${i < timelineStep ? "bg-purple-300" : "bg-slate-200"}`} />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Status step buttons — use PA_STATUS_FLOW */}
                  <div className="mt-3 flex flex-wrap justify-center gap-1">
                    {PA_STATUS_FLOW.map((s, i) => (
                      <button
                        key={s.key}
                        onClick={() => setTimelineStep(i)}
                        className={`rounded px-2 py-0.5 text-[9px] border transition-colors ${
                          timelineStep === i
                            ? "border-purple-300 bg-purple-50 text-purple-600"
                            : "border-slate-200 text-slate-400 hover:bg-slate-50"
                        }`}
                      >
                        {s.icon} {s.label.split(" ")[0]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* What's next */}
                <div className="mt-4 rounded-lg border border-purple-100 bg-purple-50 p-3">
                  <p className="text-[10px] font-medium text-purple-700">
                    <Clock className="mr-1 inline h-3 w-3" />
                    Estimated Payer Response
                  </p>
                  <p className="mt-1 text-[10px] text-purple-600">
                    {payer} typically responds within <strong>{payerInfo.turnaroundTime}</strong>.
                    Use the timeline above to simulate the review process. Check the queue dashboard for status updates.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB: CRITERIA CHECKLIST ─── */}
        {activeTab === "criteria" && (
          <div className="space-y-4">
            {procedure ? (
              <>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-slate-700">
                      Insurance Criteria Checklist — {PA_PROCEDURES[procedure]?.label}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        criteriaMet.pct >= 80
                          ? "bg-green-100 text-green-700"
                          : criteriaMet.pct >= 50
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
                      }`}
                    >
                      {criteriaMet.met}/{criteriaMet.total} criteria met
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-3 h-1.5 w-full rounded-full bg-slate-100">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        criteriaMet.pct >= 80
                          ? "bg-green-500"
                          : criteriaMet.pct >= 50
                            ? "bg-amber-500"
                            : "bg-red-500"
                      }`}
                      style={{ width: `${criteriaMet.pct}%` }}
                    />
                  </div>

                  {/* Criteria list */}
                  <div className="space-y-2">
                    {PA_PROCEDURES[procedure]?.criteria.map((criterion) => (
                      <label
                        key={criterion.id}
                        className={`flex items-start gap-2 rounded-lg border p-2.5 cursor-pointer transition-colors ${
                          checkedCriteria[criterion.id]
                            ? "border-green-200 bg-green-50"
                            : "border-slate-200 hover:border-purple-200"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={!!checkedCriteria[criterion.id]}
                          onChange={() => toggleCriterion(criterion.id)}
                          className="mt-0.5 h-3 w-3 accent-[#4A1D96]"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-medium text-slate-700">{criterion.text}</span>
                            {criterion.required && (
                              <span className="rounded bg-red-100 px-1 py-0.5 text-[8px] font-medium text-red-600">
                                Required
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-[9px] text-slate-400">
                            Typical evidence: <span className="text-slate-500">{criterion.typicalEvidence}</span>
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Education */}
                <div className="rounded-lg border border-purple-100 bg-purple-50 p-3">
                  <p className="text-[10px] font-medium text-purple-700">
                    <ClipboardList className="mr-1 inline h-3 w-3" />
                    Practice Tip
                  </p>
                  <p className="mt-1 text-[10px] text-purple-600">
                    Insurers use published criteria (CMS NCD/LCD, MCG, InterQual) to evaluate PA requests. Check
                    each criterion against the patient's chart BEFORE submitting. Missing even one required criterion
                    can result in a denial. Completing &gt;80% of criteria significantly improves approval odds.
                  </p>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <ListChecks className="mb-2 h-8 w-8 text-slate-300" />
                <p className="text-xs text-slate-400">Select a procedure in the e-PA Form tab first</p>
                <p className="text-[10px] text-slate-300">Each procedure has unique criteria requirements</p>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB: DOCUMENTS (CoverMyMeds-style attachment panel) ─── */}
        {activeTab === "docs" && (
          <div className="space-y-4">
            {procedure ? (
              <>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Paperclip className="h-4 w-4 text-[#4A1D96]" />
                    <p className="text-xs font-semibold text-slate-700">
                      Required Documentation — {PA_PROCEDURES[procedure]?.label}
                    </p>
                    <span className="ml-auto text-[10px] text-slate-400">
                      {Object.keys(docAttachments).filter(k => docAttachments[k] === "attached").length}/{PA_PROCEDURES[procedure]?.requiredDocs?.length || 0} attached
                    </span>
                  </div>

                  {/* Document list with attachment toggles */}
                  <div className="space-y-2">
                    {PA_PROCEDURES[procedure]?.requiredDocs.map((doc, i) => {
                      const docKey = doc.replace(/\s+/g, "-").toLowerCase();
                      const status = docAttachments[docKey] || "missing";
                      const icons = [
                        <FileText key="ft" className="h-3.5 w-3.5 text-blue-500" />,
                        <FileCheck key="fc" className="h-3.5 w-3.5 text-green-500" />,
                        <ClipboardList key="cl" className="h-3.5 w-3.5 text-amber-500" />,
                        <FlaskConical key="fr" className="h-3.5 w-3.5 text-purple-500" />,
                        <Search key="sr" className="h-3.5 w-3.5 text-cyan-500" />,
                        <User key="ur" className="h-3.5 w-3.5 text-slate-500" />,
                      ];
                      return (
                        <div
                          key={i}
                          className={`flex items-center gap-2 rounded-lg border p-2.5 transition-colors ${
                            status === "attached"
                              ? "border-green-200 bg-green-50"
                              : "border-slate-100 bg-slate-50 hover:border-purple-200"
                          }`}
                        >
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white">
                            {icons[i % icons.length]}
                          </div>
                          <div className="flex-1">
                            <p className="text-[10px] font-medium text-slate-700">{doc}</p>
                            <p className="text-[9px] text-slate-400">
                              {status === "attached" ? "✓ Attached" : "Missing — click to attach"}
                            </p>
                          </div>
                          <button
                            onClick={() => toggleDocAttachment(docKey)}
                            className={`rounded px-2 py-1 text-[9px] font-medium transition-colors ${
                              status === "attached"
                                ? "bg-green-600 text-white hover:bg-green-500"
                                : "bg-purple-100 text-purple-700 hover:bg-purple-200"
                            }`}
                          >
                            {status === "attached" ? "✓ Attached" : "Attach"}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Overall completion bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] text-slate-500">Documentation completeness</span>
                      <span className="text-[9px] font-medium text-purple-600">
                        {PA_PROCEDURES[procedure]?.requiredDocs
                          ? `${Math.round((Object.keys(docAttachments).filter(k => docAttachments[k] === "attached").length / PA_PROCEDURES[procedure].requiredDocs.length) * 100)}%`
                          : "0%"}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100">
                      <div
                        className="h-1.5 rounded-full bg-[#4A1D96] transition-all"
                        style={{
                          width: `${PA_PROCEDURES[procedure]?.requiredDocs
                            ? (Object.keys(docAttachments).filter(k => docAttachments[k] === "attached").length / PA_PROCEDURES[procedure].requiredDocs.length) * 100
                            : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Education */}
                <div className="rounded-lg border border-purple-100 bg-purple-50 p-3">
                  <p className="text-[10px] font-medium text-purple-700">
                    <Paperclip className="mr-1 inline h-3 w-3" />
                    CoverMyMeds Document Management
                  </p>
                  <p className="mt-1 text-[10px] text-purple-600">
                    In CoverMyMeds, documents are attached digitally and linked to the PA request. Missing documentation
                    is the #1 reason for PA delays. Attach ALL required docs before submitting. Each payer may require
                    different documentation — check the payer-specific requirements in the e-PA Form tab.
                  </p>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Paperclip className="mb-2 h-8 w-8 text-slate-300" />
                <p className="text-xs text-slate-400">Select a procedure in the e-PA Form tab first</p>
                <p className="text-[10px] text-slate-300">Each procedure has unique documentation requirements</p>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB: STEP THERAPY TRACKER (unchanged) ─── */}
        {activeTab === "step-therapy" && (
          <div className="space-y-4">
            {procedure && PA_PROCEDURES[procedure]?.stepTherapy ? (
              <>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <ArrowRight className="h-4 w-4 text-purple-600" />
                    <p className="text-xs font-semibold text-slate-700">
                      Step Therapy Requirements — {PA_PROCEDURES[procedure]?.label}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {PA_PROCEDURES[procedure]?.stepTherapy?.map((step, i) => (
                      <div
                        key={i}
                        className={`rounded-lg border p-3 ${
                          stepTherapyComplete[String(i)]
                            ? "border-green-200 bg-green-50"
                            : "border-amber-200 bg-amber-50"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div
                            className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                              stepTherapyComplete[String(i)]
                                ? "bg-green-200 text-green-700"
                                : "bg-amber-200 text-amber-700"
                            }`}
                          >
                            {i + 1}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-[10px] font-medium text-slate-700">{step.requirement}</p>
                              <span className="rounded bg-white px-1.5 py-0.5 text-[8px] font-medium text-slate-500">
                                {step.typicalDuration}
                              </span>
                            </div>
                            {step.alternatives.length > 0 && (
                              <p className="mt-0.5 text-[9px] text-slate-500">
                                Alternatives: {step.alternatives.join(", ")}
                              </p>
                            )}
                          </div>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!stepTherapyComplete[String(i)]}
                              onChange={() => toggleStepTherapy(i)}
                              className="h-3 w-3 accent-[#4A1D96]"
                            />
                            <span className="text-[9px] text-slate-500">
                              {stepTherapyComplete[String(i)] ? "Complete" : "Mark done"}
                            </span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Step therapy progress */}
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 p-2.5">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-medium text-slate-500">Step Therapy Progress</span>
                        <span className="text-[9px] font-medium text-purple-600">
                          {Object.keys(stepTherapyComplete).filter((k) => stepTherapyComplete[k]).length}/
                          {PA_PROCEDURES[procedure]?.stepTherapy?.length || 0}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-200">
                        <div
                          className="h-1.5 rounded-full bg-purple-500 transition-all"
                          style={{
                            width: `${((Object.keys(stepTherapyComplete).filter((k) => stepTherapyComplete[k]).length /
                              (PA_PROCEDURES[procedure]?.stepTherapy?.length || 1)) *
                              100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Education */}
                <div className="rounded-lg border border-purple-100 bg-purple-50 p-3">
                  <p className="text-[10px] font-medium text-purple-700">
                    <ArrowRight className="mr-1 inline h-3 w-3" />
                    What is Step Therapy?
                  </p>
                  <p className="mt-1 text-[10px] text-purple-600">
                    Step therapy requires patients to try lower-cost alternatives before the insurer will cover
                    a more expensive treatment. Failing step therapy is the #1 reason biologics and TKA are
                    denied. Document each step failure thoroughly — including dates, duration, and clinical response
                    — to support an override or appeal.
                  </p>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <ArrowRight className="mb-2 h-8 w-8 text-slate-300" />
                {!procedure ? (
                  <>
                    <p className="text-xs text-slate-400">Select a procedure in the e-PA Form tab first</p>
                    <p className="text-[10px] text-slate-300">Some procedures have step therapy requirements</p>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-slate-400">No step therapy requirements for this procedure</p>
                    <p className="text-[10px] text-slate-300">
                      {PA_PROCEDURES[procedure]?.label} does not require step therapy
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB: MEDICAL NECESSITY LETTER ─── */}
        {activeTab === "letter" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-purple-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="h-4 w-4 text-purple-600" />
                <p className="text-xs font-semibold text-slate-700">Medical Necessity Letter Generator</p>
              </div>

              {/* Patient info fields — auto-filled from chart */}
              <div className="mb-3 grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-slate-500">Patient Name</label>
                  <input
                    type="text"
                    value={letterPatientName}
                    onChange={(e) => setLetterPatientName(e.target.value)}
                    placeholder={patient ? `${patient.firstName} ${patient.lastName}` : "Enter patient name..."}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[10px] outline-none focus:border-purple-400"
                  />
                  {patient && <p className="mt-0.5 text-[9px] text-green-600">✓ Auto-filled from chart</p>}
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-slate-500">Diagnosis</label>
                  <input
                    type="text"
                    value={letterDiagnosis}
                    onChange={(e) => setLetterDiagnosis(e.target.value)}
                    placeholder={patient?.problems?.[0] || "Enter diagnosis..."}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[10px] outline-none focus:border-purple-400"
                  />
                </div>
              </div>

              {/* Letter template */}
              {procedure ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-semibold text-slate-600 mb-2">
                    Letter Template — {PA_PROCEDURES[procedure]?.label}
                  </p>
                  <div className="whitespace-pre-wrap text-[10px] text-slate-700 leading-relaxed">
                    <p className="mb-1">
                      <strong>Date:</strong> {new Date().toLocaleDateString()}
                    </p>
                    <p className="mb-1">
                      <strong>RE:</strong> Prior Authorization Request — {PA_PROCEDURES[procedure]?.label}
                    </p>
                    <p className="mb-1">
                      <strong>Patient:</strong> {letterPatientName || "[Patient Name]"}
                    </p>
                    <p className="mb-1">
                      <strong>Diagnosis:</strong> {letterDiagnosis || "[Diagnosis]"} — {PA_PROCEDURES[procedure]?.icdRanges[0] || ""}
                    </p>
                    <p className="mb-1">
                      <strong>Procedure:</strong> {PA_PROCEDURES[procedure]?.label} —{" "}
                      {PA_PROCEDURES[procedure]?.cptCodes.join(", ")}
                    </p>
                    <p className="mb-1">
                      <strong>Payer:</strong> {payer}
                    </p>
                    <hr className="my-2 border-slate-200" />
                    <p className="mb-1 font-semibold text-purple-700">Sections to Include:</p>
                    <ol className="list-decimal pl-4 space-y-1">
                      {PA_PROCEDURES[procedure]?.letterTemplateSections.map((section, i) => (
                        <li key={i} className="text-[10px] text-slate-600">
                          {section}
                        </li>
                      ))}
                    </ol>
                    <hr className="my-2 border-slate-200" />
                    <p className="text-[9px] text-slate-400 italic">
                      Copy this template into your PA letter. Expand each section with patient-specific details
                      from the clinical chart.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-[10px] text-amber-700">
                    <AlertTriangle className="mr-1 inline h-3 w-3" />
                    Select a procedure in the e-PA Form tab to generate a specific letter template
                  </p>
                </div>
              )}

              {/* Education */}
              <div className="mt-3 rounded-lg border border-purple-100 bg-purple-50 p-3">
                <p className="text-[10px] font-medium text-purple-700">
                  <BookOpen className="mr-1 inline h-3 w-3" />
                  Writing an Effective Medical Necessity Letter
                </p>
                <ul className="mt-1 space-y-0.5 text-[10px] text-purple-600">
                  <li>• Be specific — include dates, scores, measurements</li>
                  <li>• Reference payer-specific medical policy numbers</li>
                  <li>• Explain why alternatives were tried and failed</li>
                  <li>• Describe risk of NOT performing the procedure</li>
                  <li>• Keep it concise — one page is ideal</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB: FOLLOW-UP TRACKING ─── */}
        {activeTab === "followup" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-purple-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <PhoneCall className="h-4 w-4 text-purple-600" />
                <p className="text-xs font-semibold text-slate-700">PA Follow-up Tracker</p>
                <span className="ml-auto rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                  {patientFollowups.length} call{patientFollowups.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* New Follow-up Form */}
              {!followupSubmitted && (
                <div className="mb-4 rounded-lg border border-purple-100 bg-purple-50 p-3">
                  <p className="text-[10px] font-semibold text-purple-700 mb-3 flex items-center gap-1">
                    <Plus className="h-3 w-3" />
                    Log New Follow-up Call
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-slate-500">Follow-up Date</label>
                      <input
                        type="date"
                        value={followupDate}
                        onChange={(e) => setFollowupDate(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[10px] outline-none focus:border-purple-400"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-slate-500">Tracking Number</label>
                      <input
                        type="text"
                        value={followupTracking}
                        onChange={(e) => setFollowupTracking(e.target.value)}
                        placeholder="e.g. PA-2026-07-001"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[10px] outline-none focus:border-purple-400"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-slate-500">Call Representative Name</label>
                      <input
                        type="text"
                        value={followupRep}
                        onChange={(e) => setFollowupRep(e.target.value)}
                        placeholder="e.g. Sarah from Cigna"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[10px] outline-none focus:border-purple-400"
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="mb-1 block text-[10px] font-medium text-slate-500">Call Notes</label>
                    <textarea
                      value={followupNotes}
                      onChange={(e) => setFollowupNotes(e.target.value)}
                      placeholder="Document what was discussed, next steps, promised callbacks..."
                      rows={2}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[10px] outline-none focus:border-purple-400 resize-none"
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (!followupDate) return;
                      const entry = {
                        date: followupDate,
                        trackingNumber: followupTracking || "—",
                        repName: followupRep || "—",
                        notes: followupNotes || "—",
                      };
                      addFollowUp(patientId, entry);
                      setFollowupSubmitted(true);
                      setTimeout(() => {
                        setFollowupSubmitted(false);
                        setFollowupTracking("");
                        setFollowupRep("");
                        setFollowupNotes("");
                      }, 2000);
                    }}
                    className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-xs font-medium text-white hover:bg-purple-500 transition-colors"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Log Follow-up
                  </button>
                  {followupSubmitted && (
                    <p className="mt-2 text-[10px] text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Follow-up logged successfully!
                    </p>
                  )}
                </div>
              )}

              {/* Follow-up Timeline */}
              <div>
                <p className="text-[10px] font-semibold text-slate-600 mb-2 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Recent Follow-up Calls ({patientFollowups.length})
                </p>
                {patientFollowups.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center">
                    <PhoneCall className="mx-auto h-6 w-6 text-slate-300" />
                    <p className="mt-1 text-[11px] text-slate-400">No follow-up calls logged yet</p>
                    <p className="text-[10px] text-slate-300">Use the form above to log your first PA follow-up call</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {[...patientFollowups].reverse().map((entry, i) => (
                      <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-medium text-slate-700 flex items-center gap-1">
                            <PhoneCall className="h-3 w-3 text-purple-500" />
                            {new Date(entry.date).toLocaleDateString()}
                          </span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-500">
                            {entry.trackingNumber}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 mb-1">
                          <User className="h-3 w-3" />
                          <span>{entry.repName}</span>
                        </div>
                        {entry.notes && entry.notes !== "—" && (
                          <p className="text-[10px] text-slate-600 bg-white rounded px-2 py-1 border border-slate-100">
                            {entry.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Educational note */}
            <div className="rounded-lg border border-purple-100 bg-purple-50 p-3">
              <p className="text-[10px] font-medium text-purple-700">
                <PhoneCall className="mr-1 inline h-3 w-3" />
                Why Track PA Follow-ups?
              </p>
              <p className="mt-1 text-[10px] text-purple-600">
                Prior authorization follow-up calls are critical to ensuring timely processing. Industry benchmarks
                show that 30% of PAs require at least one follow-up call. Logging each interaction — including
                tracking number, representative name, and notes — creates an audit trail and helps identify
                payer-specific delays.
              </p>
            </div>
          </div>
        )}

        {/* ─── TAB: COMMON ERRORS ─── */}
        {activeTab === "errors" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <p className="text-xs font-semibold text-slate-700">Common Prior Auth Errors & Fixes</p>
              </div>
              <div className="space-y-2">
                {PA_COMMON_ERRORS.map((error, i) => (
                  <div key={i} className="rounded-lg border border-red-100 bg-red-50 p-2.5">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-red-200 px-1.5 py-0.5 text-[9px] font-medium text-red-700">
                        {error.field}
                      </span>
                      <span className="text-[10px] font-medium text-red-700">{error.error}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[9px] text-green-600">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      Fix: {error.fix}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Denial prevention */}
            <div className="rounded-lg border border-purple-100 bg-purple-50 p-3">
              <p className="text-[10px] font-medium text-purple-700">
                <ClipboardList className="mr-1 inline h-3 w-3" />
                CoverMyMeds Denial Prevention Checklist
              </p>
              <ul className="mt-1 space-y-0.5 text-[10px] text-purple-600">
                <li className="flex items-center gap-1">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Verify patient benefits include the requested procedure
                </li>
                <li className="flex items-center gap-1">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Check payer-specific medical policy before submitting
                </li>
                <li className="flex items-center gap-1">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Complete step therapy requirements or document exemptions
                </li>
                <li className="flex items-center gap-1">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Attach ALL required documentation from Documents tab
                </li>
                <li className="flex items-center gap-1">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Use the correct ICD-10 codes (payer-specific mappings)
                </li>
                <li className="flex items-center gap-1">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Submit within the correct timeframe (not retroactive)
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}