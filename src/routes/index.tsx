/**
 * Healthcare Hustlers — EHR Simulation Homepage
 *
 * Main landing page for the EHR simulation app. Provides a full
 * clinical workspace layout with:
 * - AppShell 3-zone layout (header + panels + footer)
 * - Dark navy Epic-inspired header with global patient search
 * - Epic-inspired tab navigation with chart search bar
 * - Athenahealth-inspired workflow sidebar (always visible on desktop)
 * - eCW-inspired right-side patient summary panel (collapsible)
 * - Mock patient database via React Context
 *
 * This page serves as the primary educational sandbox where
 * healthcare students practice navigating real-world EHR workflows.
 */

import { useState, useEffect, useRef } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  FileText,
  Hash,
  LayoutGrid,
  ListChecks,
  Mic,
  PanelRightClose,
  Receipt,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  Smile,
  Sparkles,
  Stethoscope,
} from "lucide-react";

import { PatientProvider, usePatientStore, type Allergy } from "../store/patientStore";
import { PipelineProvider, usePipeline, type Role } from "../store/pipelineStore";
import { ledgerBalance } from "../domain/ledger";
import { isLoggedIn, getLoggedInPhone } from "../store/accessStore";
import { useAllAppointments, useEhrStore, flushEhrStore } from "../store/ehrStore";
import { checkSessionExpired, clearSession, setSessionStart } from "../store/accessStore";
import { isSessionSuperseded } from "../store/accountSecurity";
import { PA_PROCEDURES } from "../components/PriorAuthPortal/paData";
import { TabsEpic, TabPanel, useTabsEpic } from "../components/TabsEpic/TabsEpic";
import { PatientBanner } from "../components/shell/PatientBanner";
import { useActiveTrack } from "../components/shell/activeTrack";
import { InBasket, useInboxItems } from "../components/TabsEpic/InBasket";
import { ActiveProgressNote } from "../components/TabsEpic/ActiveProgressNote";
import { inboxCount } from "../domain/inbasket";
import { completedStagesOf } from "../domain/stageProgress";
import { postedCopayForPatient } from "../domain/checkIn";
import { TUTORIAL_PATIENT_ID, tutorialNoteFields } from "../domain/tutorialEncounter";
import { TutorialReadOnlyNotice, TUTORIAL_NOTICE_ID } from "../components/TabsEpic/TutorialReadOnlyNotice";
import { consumeRequestedPatient } from "../components/shell/pendingPatient";
import type { ShellNavId } from "../components/shell/navItems";
import { StageNav } from "../components/shell/StageNav";
import { RightPaneleCW } from "../components/RightPaneleCW/RightPaneleCW";
import { StatusTimeline } from "../components/status/StatusTimeline";
import { statusEventsFor } from "../domain/statusEvent";
import {
  NOTE_STATUS_LABEL,
  noteFieldsOf,
  noteFieldsHaveText,
  noteReadOnly,
  noteStatus,
} from "../domain/noteStatus";
import {
  CHART_OPENING_STEP,
  CHART_STEPS,
  encounterEventId,
} from "../store/pipelineEncounter";
import { EncounterStepper } from "../components/shell/EncounterStepper";
import {
  completedEncounterSteps,
  lastEncounterStepId,
} from "../domain/encounterSteps";
import {
  ENCOUNTER_FLOW_STAGES,
  currentFlowStage,
  flowStageIndex,
  flowStageLabel,
  stageOpenTarget,
  lastFlowStageId,
  nextFlowStage,
  previousFlowStage,
  type BillingDeskTab,
} from "../domain/encounterFlow";
import {
  ENCOUNTER_ROUTE_PREFIX,
  encounterPath,
  openingStageId,
  writeEncounterAddress,
} from "../domain/encounterRoute";
import { inboxPatients } from "../domain/inbox";
import { IntakeVitalsStage } from "../components/WorkflowAthena/IntakeVitalsStage";
import { RegistrationStage } from "../components/WorkflowAthena/RegistrationStage";
import { EligibilityStage } from "../components/WorkflowAthena/EligibilityStage";
import { HPIStage } from "../components/WorkflowAthena/HPIStage";
import { ExamROSStage } from "../components/WorkflowAthena/ExamROSStage";
import { AssessmentPlanStage, type SoapNoteData } from "../components/WorkflowAthena/AssessmentPlanStage";
import { SignLockStage } from "../components/WorkflowAthena/SignLockStage";
import { AppShell } from "../components/AppShell";
import {
  WorkspaceTabs,
  WorkspacePanel,
  useWorkspaceTabs,
} from "../components/TabsEpic/WorkspaceTabs";
import { DailySchedule } from "../components/TabsEpic/DailySchedule";
import ARVoiceSimulator from "../components/ARVoiceSimulator/ARVoiceSimulator";
import { ArWorkQueuePanel } from "../components/status/ArWorkQueuePanel";
import { HomeWorkQueues } from "../components/status/HomeWorkQueues";
import { CodingQueue } from "../components/CodingQueue/CodingQueue";
import { BillingLedger } from "../components/BillingLedger/BillingLedger";
import PriorAuthPortal from "../components/PriorAuthPortal/PriorAuthPortal";
import { toast } from "sonner";
import { FadeTransition } from "../components/FadeTransition";
import { WorklistPanel } from "../components/WorklistPanel";
import { hasVital, formatVital } from "../utils/vitals";
import { FinancialLedger } from "../components/FinancialLedger";
import { CPT_CODES } from "../components/CodingQueue/cptData";
import { ToastProvider, useToast } from "../components/Toast";
import { Skeleton } from "../components/Skeleton";
import { CommandPalette } from "../components/CommandPalette";

/** Pipeline roles the working context may restore (section 4). */
const PIPELINE_ROLES: Role[] = ["scribe", "coder", "biller", "prior-auth", "ar-voice"];

/**
 * The scribe's own stages, in the order a visit is documented. The order is the
 * one pure list in `domain/encounterSteps.ts`; it drives the step bar at the top
 * of the chart, the Back / Next controls and the step the student lands on, so
 * the label they read and the step they move to can never disagree. Every
 * patient opens on step 1, Registration (spec `encounter-continuity.md`).
 */
const SCRIBE_STAGES = CHART_STEPS;

/**
 * The progress note's own sections — the chart steps that document the visit.
 * Sign & Lock is not one of them: it is stage 2 of the encounter's own flow
 * (`domain/encounterFlow.ts`), drawn by the stepper at the top of the workspace.
 */
const NOTE_SECTIONS = SCRIBE_STAGES.filter((stage) => stage.id !== "sign-lock");

/**
 * The stage before each role's screen, for the one Back control (spec item 3).
 * A role stage always has a previous stage; the scribe's first stage has none.
 */
const ROLE_BACK: Partial<Record<Role, { label: string; role: Role; stage?: string }>> = {
  coder: { label: "Sign & Lock Note", role: "scribe", stage: "sign-lock" },
  "prior-auth": { label: "Coding", role: "coder" },
  biller: { label: "Prior Auth", role: "prior-auth" },
  "ar-voice": { label: "Billing", role: "biller" },
};

/**
 * "Saved 12:04 PM" — Epic-style autosave indicator (Phase 0, section 5).
 * Shows when the open patient's note draft was last written to the store.
 */
function NoteSavedIndicator({ savedAt }: { savedAt?: string }) {
  if (!savedAt) return null;
  const time = new Date(savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return (
    <span
      className="flex items-center gap-1 text-[10px] font-medium text-slate-500"
      title="Note drafts save automatically — you do not need to press Save"
    >
      <CheckCircle2 className="h-3 w-3 text-green-600" /> Saved {time}
    </span>
  );
}

// ─── Route ──────────────────────────────────────────────────────────

export const Route = createFileRoute("/")({
  component: () => (
    <ToastProvider>
      <PatientProvider>
        <PipelineProvider>
          <Home />
        </PipelineProvider>
      </PatientProvider>
    </ToastProvider>
  ),
});

/**
 * The medical encounter workspace, exported because it is one screen with two
 * addresses: Home (`/`) and the encounter's own stage address
 * (`/encounter/:encounterId/:stage`, `encounter.$encounterId.$stage.tsx`). The
 * encounter route hands it the patient and the stage the address names; Home
 * passes neither and the workspace opens whatever the student had open.
 *
 * One component in both places on purpose: the stepper, the patient banner and
 * the Medical track cannot differ between a screen the student walked to and a
 * link they pasted.
 */
export interface HomeProps {
  /** The encounter the address names — in this build, the patient's id. */
  encounterIdFromRoute?: string;
  /** The stage the address names, from `domain/encounterFlow.ts`. */
  stageFromRoute?: string;
}

// ─── Per-Patient Session Data Store ──────────────────────────────
// Preserves each patient's scribe/vitals/shared data when switching

interface PatientSessionData {
  _patientId: string;
  soapNote: SoapNoteData;
  editableVitals: {
    bloodPressure: string;
    heartRate: string;
    temperature: string;
    respiratoryRate: string;
    oxygenSaturation: string;
  };
  editablePatientData: {
    chiefComplaint: string;
    problems: string[];
    medications: { id: string; name: string; dosage: string; frequency: string }[];
    allergies: (string | Allergy)[];
    pcp: string;
    insurance: string;
  };
  sharedImmunizations: ImmunizationEntry[];
  sharedLabs: string[];
  sharedReferrals: ReferralEntry[];
  sharedOrders: OrderEntry[];
  sharedImaging: ImagingEntry[];
  displayName: string | undefined;
  activeStage: string;
}

// ─── Tab Content Components ────────────────────────────────────────

interface EditablePatientData {
  chiefComplaint: string;
  problems: string[];
  medications: { id: string; name: string; dosage: string; frequency: string }[];
  allergies: (string | Allergy)[];
  patientInstructions?: string;
  followUpPlan?: string;
  pcp: string;
  insurance: string;
}

interface EditableVitals {
  bloodPressure: string;
  heartRate: string;
  temperature: string;
  respiratoryRate: string;
  oxygenSaturation: string;
}

// ─── Structured clinical-view helpers ───────────────────────────────

/** Split a problem string like "Hypertension (I10)" into name + ICD-10 code. */
function parseProblem(p: string): { name: string; code: string } {
  const match = p.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  if (match) return { name: match[1].trim(), code: match[2].trim() };
  return { name: p, code: "" };
}

/** Tailwind class for an allergy severity badge (see app.css .allergy-*). */
function allergySeverityClass(severity: string): string {
  if (severity === "severe") return "allergy-severe";
  if (severity === "moderate") return "allergy-moderate";
  return "allergy-mild";
}

/** Flag presentation for a lab result status. */
function labFlag(status: string): { className: string; label: string } {
  switch (status) {
    case "critical":
      return { className: "status-badge is-danger", label: "Critical" };
    case "abnormal":
      return { className: "status-badge is-warning", label: "Abnormal" };
    case "pending":
      return { className: "status-badge is-neutral", label: "Pending" };
    default:
      return { className: "status-badge is-success", label: "Normal" };
  }
}


// ─── Structured entries for chart-review domains without a Patient field ──
interface OrderEntry { id: string; item: string; status: "Ordered" | "Pending" | "Completed"; provider: string; date: string; }
interface ImagingEntry { id: string; study: string; status: "Ordered" | "Scheduled" | "Completed" | "Resulted"; date: string; }
interface ImmunizationEntry { id: string; vaccine: string; dose: string; date: string; status: "Given" | "Scheduled"; }
interface ReferralEntry { id: string; specialty: string; reason: string; status: "Sent" | "Scheduled" | "Completed"; date: string; }

/** Badge class for a generic chart-review entry status. */
function entryStatusClass(status: string): string {
  const st = status.toLowerCase();
  if (st === "completed" || st === "given" || st === "resulted") return "status-badge is-success";
  if (st === "ordered" || st === "pending") return "status-badge is-warning";
  if (st === "scheduled" || st === "sent") return "status-badge is-info";
  return "status-badge is-neutral";
}

/** Colored marker for a lab result flag (▲ abnormal/critical, — normal, … pending). */
function labFlagMark(status: string): { mark: string; className: string } {
  switch (status) {
    case "critical": return { mark: "▲", className: "font-bold text-red-600" };
    case "abnormal": return { mark: "▲", className: "font-bold text-amber-600" };
    case "pending": return { mark: "…", className: "text-slate-400" };
    default: return { mark: "—", className: "text-slate-300" };
  }
}

const SEED_ORDERS: OrderEntry[] = [
  { id: "ord-seed-1", item: "CBC (Complete Blood Count)", status: "Completed", provider: "Dr. Demo Instructor", date: "2026-07-09" },
  { id: "ord-seed-2", item: "CMP (Comprehensive Metabolic Panel)", status: "Completed", provider: "Dr. Demo Instructor", date: "2026-07-09" },
  { id: "ord-seed-3", item: "Chest X-ray (PA & Lateral)", status: "Pending", provider: "Dr. Demo Instructor", date: "2026-07-09" },
];
const SEED_IMAGING: ImagingEntry[] = [
  { id: "img-seed-1", study: "Chest X-ray (PA & Lateral)", status: "Resulted", date: "2026-07-09" },
];
const SEED_IMMUNIZATIONS: ImmunizationEntry[] = [
  { id: "imm-seed-1", vaccine: "Influenza (2026-2027)", dose: "0.5 mL", date: "2026-10-15", status: "Given" },
  { id: "imm-seed-2", vaccine: "COVID-19 Booster", dose: "0.3 mL", date: "2024-11-02", status: "Given" },
];
const SEED_REFERRALS: ReferralEntry[] = [
  { id: "ref-seed-1", specialty: "Cardiology", reason: "Chest pain evaluation", status: "Sent", date: "2026-07-09" },
];

function SummaryTab({
  patientId,
  editableVitals: extVitals,
  onVitalsChange,
  editablePatientData: extData,
  onPatientDataChange,
  newProblem,
  onNewProblemChange,
  immunizations: extImmunizations,
  onImmunizationsChange,
  labsResults: extLabsResults,
  onLabsResultsChange,
  referrals: extReferrals,
  onReferralsChange,
  orders: extOrders,
  onOrdersChange,
  imaging: extImaging,
  onImagingChange,
}: {
  patientId: string;
  editableVitals?: EditableVitals;
  onVitalsChange?: (v: EditableVitals) => void;
  editablePatientData?: EditablePatientData;
  onPatientDataChange?: (d: EditablePatientData) => void;
  newProblem?: string;
  onNewProblemChange?: (v: string) => void;
  immunizations?: ImmunizationEntry[];
  onImmunizationsChange?: (v: ImmunizationEntry[]) => void;
  labsResults?: string[];
  onLabsResultsChange?: (v: string[]) => void;
  referrals?: ReferralEntry[];
  onReferralsChange?: (v: ReferralEntry[]) => void;
  orders?: OrderEntry[];
  onOrdersChange?: (v: OrderEntry[]) => void;
  imaging?: ImagingEntry[];
  onImagingChange?: (v: ImagingEntry[]) => void;
}) {
  const { getPatientById } = usePatientStore();
  const pipeline = usePipeline();
  const patient = getPatientById(patientId);
  const isScribe = pipeline.currentRole === "scribe";

  // Local fallback state when not controlled
  const [localVitals, setLocalVitals] = useState<EditableVitals>({
    bloodPressure: patient?.vitals.bloodPressure ?? "",
    heartRate: patient?.vitals.heartRate?.toString() ?? "",
    temperature: patient?.vitals.temperature?.toString() ?? "",
    respiratoryRate: patient?.vitals.respiratoryRate?.toString() ?? "",
    oxygenSaturation: patient?.vitals.oxygenSaturation?.toString() ?? "",
  });
  const [localData, setLocalData] = useState<EditablePatientData>({
    chiefComplaint: patient?.chiefComplaint ?? "",
    problems: [...(patient?.problems ?? [])],
    medications: patient?.medications?.filter(m => m.status === "active").map(m => ({ id: m.id, name: m.name, dosage: m.dosage, frequency: m.frequency })) ?? [],
    allergies: [...(patient?.allergies ?? [])],
    pcp: patient?.primaryCareProvider ?? "",
    insurance: patient?.insurance ?? "",
  });
  const [localNewProblem, setLocalNewProblem] = useState("");
  const [medName, setMedName] = useState("");
  const [medDosage, setMedDosage] = useState("");
  const [medFreq, setMedFreq] = useState("");
  const [allergyInput, setAllergyInput] = useState("");
  const [saved, setSaved] = useState(false);
  const [immunInput, setImmunInput] = useState("");
  const [labInput, setLabInput] = useState("");
  const [referralInput, setReferralInput] = useState("");
  const [orderInput, setOrderInput] = useState("");
  const [imagingInput, setImagingInput] = useState("");

  const vitals = extVitals ?? localVitals;
  const setVitals = onVitalsChange ?? setLocalVitals;
  const data = extData ?? localData;
  const setData = onPatientDataChange ?? setLocalData;
  const addProblemText = newProblem !== undefined ? newProblem : localNewProblem;
  const setAddProblemText = onNewProblemChange ?? setLocalNewProblem;
  const immunizations = extImmunizations ?? [];
  const setImmunizations = onImmunizationsChange ?? ((_v: ImmunizationEntry[]) => {});
  const labsResults = extLabsResults ?? [];
  const setLabsResults = onLabsResultsChange ?? ((_v: string[]) => {});
  const referrals = extReferrals ?? [];
  const setReferrals = onReferralsChange ?? ((_v: ReferralEntry[]) => {});
  const orders = extOrders ?? [];
  const setOrders = onOrdersChange ?? ((_v: OrderEntry[]) => {});
  const imaging = extImaging ?? [];
  const setImaging = onImagingChange ?? ((_v: ImagingEntry[]) => {});

  const updateVital = (key: keyof EditableVitals, value: string) => {
    setVitals({ ...vitals, [key]: value });
  };

  const updateData = (key: keyof EditablePatientData, value: any) => {
    setData({ ...data, [key]: value });
  };

  const addProblem = () => {
    const trimmed = addProblemText.trim();
    if (trimmed) {
      updateData("problems", [...data.problems, trimmed]);
      setAddProblemText("");
    }
  };

  const removeProblem = (idx: number) => {
    updateData("problems", data.problems.filter((_, i) => i !== idx));
  };

  const addAllergy = (val: string) => {
    const trimmed = val.trim();
    if (trimmed && !data.allergies.includes(trimmed)) {
      updateData("allergies", [...data.allergies, trimmed]);
    }
  };

  const removeAllergy = (idx: number) => {
    updateData("allergies", data.allergies.filter((_, i) => i !== idx));
  };

  const removeMed = (id: string) => {
    updateData("medications", data.medications.filter(m => m.id !== id));
  };

  const addMedication = () => {
    const name = medName.trim();
    if (!name) return;
    const newMed = { id: `med-${Date.now()}`, name, dosage: medDosage || "—", frequency: medFreq || "—" };
    updateData("medications", [...data.medications, newMed]);
    setMedName(""); setMedDosage(""); setMedFreq("");
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!patient) return <p className="text-slate-400">Patient not found</p>;

  return (
    <div className="space-y-3">
      <div className="clinical-card">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {patient.firstName} {patient.lastName}
            </h2>
            <p className="text-sm text-slate-500">
              {patient.gender} | {patient.age} years | DOB:{" "}
              {new Date(patient.dateOfBirth).toLocaleDateString()} | MRN:{" "}
              {patient.mrn}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {isScribe ? (
                <>
                  PCP: <input type="text" value={data.pcp} onChange={e => updateData("pcp", e.target.value)} className="inline w-28 rounded border border-slate-200 px-1 text-xs outline-none focus:border-brand-400" /> |
                  Insurance: <input type="text" value={data.insurance} onChange={e => updateData("insurance", e.target.value)} className="inline w-28 rounded border border-slate-200 px-1 text-xs outline-none focus:border-brand-400" />
                </>
              ) : (
                <>PCP: {patient.primaryCareProvider} | {patient.insurance}</>
              )}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {isScribe ? (
              <input
                type="text"
                value={data.chiefComplaint}
                onChange={e => updateData("chiefComplaint", e.target.value)}
                className="rounded border border-slate-200 px-2 py-1 text-xs font-medium outline-none focus:border-brand-400 w-48 text-right"
              />
            ) : (
              <span className="rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                {patient.chiefComplaint}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="clinical-card">
          <p className="clinical-label">BP</p>
          {isScribe ? (
            <input
              type="text"
              value={vitals.bloodPressure}
              onChange={(e) => updateVital("bloodPressure", e.target.value)}
              className="clinical-value w-full rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-brand-400"
            />
          ) : (
            <p className="clinical-value">{formatVital(patient.vitals.bloodPressure)}</p>
          )}
          {(() => {
            const parts = vitals.bloodPressure.split("/").map(s => parseFloat(s.trim()));
            if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
            const sys = parts[0], dia = parts[1];
            const isHigh = sys > 130 || dia > 80;
            const isLow = sys < 90 || dia < 60;
            const label = isHigh ? "⚠ High" : isLow ? "⚠ Low" : "✓ Normal";
            const color = isHigh ? "text-red-500" : isLow ? "text-amber-600" : "text-green-600";
            return <p className={`mt-1 text-[10px] font-medium ${color}`}>{label}</p>;
          })()}
        </div>
        <div className="clinical-card">
          <p className="clinical-label">HR</p>
          {isScribe ? (
            <input type="text" value={vitals.heartRate} onChange={e => updateVital("heartRate", e.target.value)} className="clinical-value w-full rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-brand-400" />
          ) : <p className="clinical-value">{formatVital(patient.vitals.heartRate, " bpm")}</p>}
          {(() => {
            const val = parseFloat(vitals.heartRate);
            if (isNaN(val)) return null;
            if (val > 100) return <p className="mt-1 text-[10px] font-medium text-red-500">⚠ Tachycardia</p>;
            if (val < 60) return <p className="mt-1 text-[10px] font-medium text-amber-600">⚠ Bradycardia</p>;
            return <p className="mt-1 text-[10px] font-medium text-green-600">✓ Normal</p>;
          })()}
        </div>
        <div className="clinical-card">
          <p className="clinical-label">Temp</p>
          {isScribe ? (
            <input type="text" value={vitals.temperature} onChange={e => updateVital("temperature", e.target.value)} className="clinical-value w-full rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-brand-400" />
          ) : <p className="clinical-value">{formatVital(patient.vitals.temperature, "°F")}</p>}
          {(() => {
            const val = parseFloat(vitals.temperature);
            if (isNaN(val)) return null;
            if (val > 99.5) return <p className="mt-1 text-[10px] font-medium text-red-500">⚠ Fever</p>;
            if (val < 97) return <p className="mt-1 text-[10px] font-medium text-amber-600">⚠ Hypothermia</p>;
            return <p className="mt-1 text-[10px] font-medium text-green-600">✓ Normal</p>;
          })()}
        </div>
        <div className="clinical-card">
          <p className="clinical-label">SpO2</p>
          {isScribe ? (
            <input type="text" value={vitals.oxygenSaturation} onChange={e => updateVital("oxygenSaturation", e.target.value)} className="clinical-value w-full rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-brand-400" />
          ) : <p className="clinical-value">{formatVital(patient.vitals.oxygenSaturation, "%")}</p>}
          {(() => {
            const val = parseFloat(vitals.oxygenSaturation);
            if (isNaN(val)) return null;
            if (val < 90) return <p className="mt-1 text-[10px] font-medium text-red-500">⚠ Critical</p>;
            if (val < 95) return <p className="mt-1 text-[10px] font-medium text-amber-600">⚠ Low</p>;
            return <p className="mt-1 text-[10px] font-medium text-green-600">✓ Normal</p>;
          })()}
        </div>
      </div>

      {/* Active Problems */}
      <div className="clinical-card">
        <p className="clinical-label mb-2">Active Problems</p>
        {data.problems.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No active problems</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th>Problem</th><th>ICD-10</th><th>Status</th>{isScribe && <th></th>}</tr>
              </thead>
              <tbody>
                {data.problems.map((p, i) => {
                  const { name, code } = parseProblem(p);
                  return (
                    <tr key={i}>
                      <td className="font-medium">{name}</td>
                      <td className="font-mono text-xs text-slate-500">{code || "—"}</td>
                      <td><span className="status-badge is-info">Active</span></td>
                      {isScribe && (
                        <td className="text-right">
                          <button onClick={() => removeProblem(i)} className="text-red-400 hover:text-red-600 text-[10px]" aria-label="Remove problem">✕</button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {isScribe && (
          <div className="mt-2 flex gap-1">
            <input
              type="text"
              value={addProblemText}
              onChange={e => setAddProblemText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addProblem()}
              placeholder="+ Add new problem (e.g. Diabetes (E11.9))..."
              className="flex-1 rounded border border-dashed border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand-400"
            />
            <button onClick={addProblem} className="rounded bg-brand-500 px-2 py-1 text-xs text-white hover:bg-brand-600">Add</button>
          </div>
        )}
      </div>
      {/* Medications */}
      <div className="clinical-card">
        <p className="clinical-label mb-2">Active Medications</p>
        {data.medications.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No active medications</p>
        ) : (
          <div className="space-y-1">
            {data.medications.map((med) => (
              <div key={med.id} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                  <span className="font-medium text-slate-800">{med.name}</span>
                  <span className="text-slate-500">{med.dosage} · {med.frequency}</span>
                </div>
                {isScribe && (
                  <button onClick={() => removeMed(med.id)} className="text-red-400 hover:text-red-600 text-[10px]">✕ Remove</button>
                )}
              </div>
            ))}
          </div>
        )}
        {isScribe && (
          <div className="mt-2 space-y-1.5 rounded border border-dashed border-slate-300 p-2">
            <div className="grid grid-cols-3 gap-1">
              <input type="text" value={medName} onChange={e => setMedName(e.target.value)} placeholder="Medication name" className="rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand-400" />
              <input type="text" value={medDosage} onChange={e => setMedDosage(e.target.value)} placeholder="Dosage (e.g. 10mg)" className="rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand-400" />
              <input type="text" value={medFreq} onChange={e => setMedFreq(e.target.value)} placeholder="Frequency (e.g. BID)" className="rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand-400" />
            </div>
            <button onClick={addMedication} className="mt-1 rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700">+ Add Medication</button>
          </div>
        )}
      </div>
      {/* Allergies */}
      <div className="clinical-card">
        <p className="clinical-label mb-2">Allergies</p>
        {data.allergies.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No known allergies</p>
        ) : (
          <div className="space-y-1">
            {data.allergies.map((a, i) => {
              const allergen = typeof a === "string" ? a : a.allergen;
              const severity = typeof a === "string" ? "mild" : a.severity;
              const reaction = typeof a === "string" ? "" : a.reaction;
              const recorded = typeof a === "string" ? "" : a.recordedDate;
              return (
                <div key={i} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1.5 text-xs">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${severity === "severe" ? "bg-red-500" : severity === "moderate" ? "bg-amber-500" : "bg-yellow-400"}`} />
                    <span className="font-medium text-slate-800">{allergen}</span>
                    {reaction && <span className="truncate text-slate-500">— {reaction}</span>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={allergySeverityClass(severity)}>{severity}</span>
                    {recorded && <span className="text-[10px] text-slate-400">{recorded}</span>}
                    {isScribe && (
                      <button onClick={() => removeAllergy(i)} className="text-red-400 hover:text-red-600 text-[10px]" aria-label="Remove allergy">✕</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {isScribe && (
          <div className="mt-2 flex gap-1">
            <input
              type="text"
              value={allergyInput}
              onChange={e => setAllergyInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { addAllergy(allergyInput); setAllergyInput(""); }}}
              placeholder="+ Add allergy..."
              className="flex-1 rounded border border-dashed border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand-400"
            />
            <button onClick={() => { addAllergy(allergyInput); setAllergyInput(""); }} className="rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600">Add</button>
          </div>
        )}
      </div>
      {/* Immunizations */}
      <div className="clinical-card">
        <p className="clinical-label mb-2">Immunizations</p>
        {immunizations.length > 0 ? (
          <div className="space-y-1">
            {immunizations.map((imm) => (
              <div key={imm.id} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                  <span className="font-medium text-slate-800">{imm.vaccine}</span>
                  <span className="text-slate-500">{imm.dose} · {imm.date}</span>
                </div>
                <span className={entryStatusClass(imm.status)}>{imm.status}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">No immunizations recorded</p>
        )}
        {isScribe && (
          <div className="mt-2 flex gap-1">
            <input type="text" value={immunInput} onChange={e => setImmunInput(e.target.value)} placeholder="+ Add vaccine..." className="flex-1 rounded border border-dashed border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand-400" />
            <button onClick={() => { if (immunInput.trim()) { setImmunizations([...immunizations, { id: `imm-${Date.now()}`, vaccine: immunInput.trim(), dose: "—", date: new Date().toISOString().split("T")[0], status: "Given" }]); setImmunInput(""); } }} className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700">Add</button>
          </div>
        )}
      </div>
      {/* Labs & Results */}
      <div className="clinical-card">
        <p className="clinical-label mb-2">Labs & Results</p>
        {(patient.labResults || []).length > 0 ? (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Test</th><th>Result</th><th>Reference</th><th>Flag</th><th>Date</th></tr></thead>
              <tbody>
                {patient.labResults.map((lab) => (
                  <tr key={lab.id}>
                    <td className="font-medium">{lab.testName}</td>
                    <td>{lab.value}{lab.unit ? ` ${lab.unit}` : ""}</td>
                    <td className="text-slate-500">{lab.referenceRange || "—"}</td>
                    <td><span className={labFlag(lab.status).className}>{labFlag(lab.status).label}</span></td>
                    <td className="text-xs text-slate-500">{new Date(lab.date).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">No labs recorded</p>
        )}
        {labsResults.length > 0 && (
          <div className="mt-2">
            <p className="section-header">Session results</p>
            <div className="space-y-1">
              {labsResults.map((lab, i) => (
                <div key={i} className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">{lab}</div>
              ))}
            </div>
          </div>
        )}
        {isScribe && (
          <div className="mt-2 flex gap-1">
            <input type="text" value={labInput} onChange={e => setLabInput(e.target.value)} placeholder="+ Add lab/result..." className="flex-1 rounded border border-dashed border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand-400" />
            <button onClick={() => { if (labInput.trim()) { setLabsResults([...labsResults, labInput.trim()]); setLabInput(""); } }} className="rounded bg-brand-600 px-2 py-1 text-xs text-white hover:bg-brand-700">Add</button>
          </div>
        )}
      </div>
      {/* Orders */}
      <div className="clinical-card">
        <p className="clinical-label mb-2">Orders</p>
        {orders.length > 0 ? (
          <div className="space-y-1">
            {orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  <span className="font-medium text-slate-800">{o.item}</span>
                </div>
                <span className={entryStatusClass(o.status)}>{o.status}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">No orders recorded</p>
        )}
        {isScribe && (
          <div className="mt-2 flex gap-1">
            <input type="text" value={orderInput} onChange={e => setOrderInput(e.target.value)} placeholder="+ Add order..." className="flex-1 rounded border border-dashed border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand-400" />
            <button onClick={() => { if (orderInput.trim()) { setOrders([...orders, { id: `ord-${Date.now()}`, item: orderInput.trim(), status: "Ordered", provider: patient.primaryCareProvider, date: new Date().toISOString().split("T")[0] }]); setOrderInput(""); } }} className="rounded bg-amber-600 px-2 py-1 text-xs text-white hover:bg-amber-700">Add</button>
          </div>
        )}
      </div>
      {/* Imaging */}
      <div className="clinical-card">
        <p className="clinical-label mb-2">Imaging</p>
        {imaging.length > 0 ? (
          <div className="space-y-1">
            {imaging.map((img) => (
              <div key={img.id} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500" />
                  <span className="font-medium text-slate-800">{img.study}</span>
                </div>
                <span className={entryStatusClass(img.status)}>{img.status}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">No imaging recorded</p>
        )}
        {isScribe && (
          <div className="mt-2 flex gap-1">
            <input type="text" value={imagingInput} onChange={e => setImagingInput(e.target.value)} placeholder="+ Add imaging..." className="flex-1 rounded border border-dashed border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand-400" />
            <button onClick={() => { if (imagingInput.trim()) { setImaging([...imaging, { id: `img-${Date.now()}`, study: imagingInput.trim(), status: "Ordered", date: new Date().toISOString().split("T")[0] }]); setImagingInput(""); } }} className="rounded bg-accent-600 px-2 py-1 text-xs text-white hover:bg-accent-700">Add</button>
          </div>
        )}
      </div>
      {/* Referrals */}
      <div className="clinical-card">
        <p className="clinical-label mb-2">Referrals</p>
        {referrals.length > 0 ? (
          <div className="space-y-1">
            {referrals.map((ref) => (
              <div key={ref.id} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1.5 text-xs">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />
                  <span className="font-medium text-slate-800">{ref.specialty}</span>
                  {ref.reason && <span className="truncate text-slate-500">— {ref.reason}</span>}
                </div>
                <span className={entryStatusClass(ref.status)}>{ref.status}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">No referrals</p>
        )}
        {isScribe && (
          <div className="mt-2 flex gap-1">
            <input type="text" value={referralInput} onChange={e => setReferralInput(e.target.value)} placeholder="+ Add referral..." className="flex-1 rounded border border-dashed border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand-400" />
            <button onClick={() => { if (referralInput.trim()) { setReferrals([...referrals, { id: `ref-${Date.now()}`, specialty: referralInput.trim(), reason: "—", status: "Sent", date: new Date().toISOString().split("T")[0] }]); setReferralInput(""); } }} className="rounded bg-brand-600 px-2 py-1 text-xs text-white hover:bg-brand-700">Add</button>
          </div>
        )}
      </div>
      {/* Save Button */}
      {isScribe && (
        <div className="clinical-card">
          <button
            onClick={handleSave}
            className={`w-full rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              saved
                ? "bg-green-500 text-white"
                : "bg-brand-600 text-white hover:bg-brand-700"
            }`}
          >
            {saved ? "✓ Changes Saved" : "Save Changes"}
          </button>
        </div>
      )}

      {/* Recent Encounters */}
      <div className="clinical-card">
        <p className="clinical-label mb-2">Recent Encounters</p>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Type</th><th>Provider</th><th>Diagnosis</th></tr></thead>
            <tbody>
              {(patient.encounters || []).slice(0, 3).map((enc) => (
                <tr key={enc.id}>
                  <td>{new Date(enc.date).toLocaleDateString()}</td>
                  <td>{enc.type}</td>
                  <td>{enc.provider}</td>
                  <td className="max-w-xs truncate">{enc.diagnosis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MedicationsTab({ patientId }: { patientId: string }) {
  const { getPatientById } = usePatientStore();
  const pipeline = usePipeline();
  const patient = getPatientById(patientId);
  const isScribe = pipeline.currentRole === "scribe";

  const [medications, setMedications] = useState(patient?.medications ?? []);
  const [medName, setMedName] = useState("");
  const [medDosage, setMedDosage] = useState("");
  const [medFreq, setMedFreq] = useState("");

  if (!patient) return null;

  const addMedication = () => {
    if (!medName.trim()) return;
    setMedications([...medications, {
      id: `med-${Date.now()}`,
      name: medName.trim(),
      dosage: medDosage || "—",
      frequency: medFreq || "—",
      route: "Oral",
      status: "active" as const,
      prescribedDate: new Date().toISOString().split("T")[0],
      prescribedBy: patient.primaryCareProvider,
    }]);
    setMedName(""); setMedDosage(""); setMedFreq("");
  };

  const removeMedication = (id: string) => {
    setMedications(medications.filter(m => m.id !== id));
  };

  return (
    <div className="clinical-card">
      <p className="clinical-label mb-3">Medication List</p>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Medication</th>
              <th>Dosage</th>
              <th>Frequency</th>
              <th>Route</th>
              <th>Prescriber</th>
              <th>Prescribed</th>
              <th>Status</th>
              {isScribe && <th></th>}
            </tr>
          </thead>
          <tbody>
            {medications.map((med) => (
              <tr key={med.id}>
                <td className="font-medium">{med.name}</td>
                <td>{med.dosage}</td>
                <td>{med.frequency}</td>
                <td>{med.route}</td>
                <td className="text-slate-600">{med.prescribedBy}</td>
                <td>
                  <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                    med.status === "active"
                      ? "bg-green-100 text-green-700"
                      : med.status === "discontinued"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                  }`}>
                    {med.status}
                  </span>
                </td>
                <td className="text-xs text-slate-500">
                  {new Date(med.prescribedDate).toLocaleDateString()}
                </td>
                {isScribe && (
                  <td>
                    <button onClick={() => removeMedication(med.id)} className="text-red-400 hover:text-red-600 text-[10px]">✕</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isScribe && (
        <div className="mt-3 space-y-1.5 rounded border border-dashed border-slate-300 p-2">
          <div className="grid grid-cols-3 gap-1">
            <input type="text" value={medName} onChange={e => setMedName(e.target.value)} placeholder="Medication name" className="rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand-400" />
            <input type="text" value={medDosage} onChange={e => setMedDosage(e.target.value)} placeholder="Dosage (e.g. 10mg)" className="rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand-400" />
            <input type="text" value={medFreq} onChange={e => setMedFreq(e.target.value)} placeholder="Frequency (e.g. BID)" className="rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand-400" />
          </div>
          <button onClick={addMedication} className="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700">+ Add Medication</button>
        </div>
      )}
    </div>
  );
}

function VitalsTab({ patientId, editableVitals: extVitals, onVitalsChange }: { 
  patientId: string; 
  editableVitals?: EditableVitals;
  onVitalsChange?: (v: EditableVitals) => void;
}) {
  const { getPatientById } = usePatientStore();
  const pipeline = usePipeline();
  const patient = getPatientById(patientId);
  const isScribe = pipeline.currentRole === "scribe";

  if (!patient) return null;

  // Use lifted editable vitals state when available (for right panel sync)
  const [localBP, setLocalBP] = useState(patient.vitals.bloodPressure);
  const [localHR, setLocalHR] = useState(patient.vitals.heartRate.toString());
  const [localTemp, setLocalTemp] = useState(patient.vitals.temperature.toString());
  const [localRR, setLocalRR] = useState(patient.vitals.respiratoryRate.toString());
  const [localO2, setLocalO2] = useState(patient.vitals.oxygenSaturation.toString());

  const vitals = extVitals ?? {
    bloodPressure: localBP,
    heartRate: localHR,
    temperature: localTemp,
    respiratoryRate: localRR,
    oxygenSaturation: localO2,
  };
  const setVitals = onVitalsChange ?? ((v: EditableVitals) => {
    setLocalBP(v.bloodPressure);
    setLocalHR(v.heartRate);
    setLocalTemp(v.temperature);
    setLocalRR(v.respiratoryRate);
    setLocalO2(v.oxygenSaturation);
  });

  const updateVital = (key: keyof EditableVitals, value: string) => {
    setVitals({ ...vitals, [key]: value });
  };

  // Dynamic normal/abnormal badge logic
  const getBadge = (type: string, valueStr: string): { className: string; label: string } => {
    const rawValue = (valueStr ?? "").trim();
    if (!hasVital(rawValue)) return { className: "status-badge is-neutral", label: "—" };
    switch (type) {
      case "bp": {
        const parts = valueStr.split("/").map((s) => parseFloat(s.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          if (parts[0] > 130 || parts[1] > 80) return { className: "status-badge is-warning", label: "Elevated" };
          return { className: "status-badge is-success", label: "Normal" };
        }
        return { className: "status-badge is-success", label: "Normal" };
      }
      case "hr": {
        const val = parseFloat(valueStr);
        if (!isNaN(val)) {
          if (val > 100 || val < 60) return { className: "status-badge is-warning", label: val > 100 ? "Tachycardia" : "Bradycardia" };
          return { className: "status-badge is-success", label: "Normal" };
        }
        return { className: "status-badge is-success", label: "Normal" };
      }
      case "temp": {
        const val = parseFloat(valueStr);
        if (!isNaN(val)) {
          if (val > 99.5 || val < 97) return { className: "status-badge is-warning", label: val > 99.5 ? "Fever" : "Hypothermia" };
          return { className: "status-badge is-success", label: "Normal" };
        }
        return { className: "status-badge is-success", label: "Normal" };
      }
      case "rr": {
        const val = parseFloat(valueStr);
        if (!isNaN(val)) {
          if (val > 20 || val < 12) return { className: "status-badge is-warning", label: "Abnormal" };
          return { className: "status-badge is-success", label: "Normal" };
        }
        return { className: "status-badge is-success", label: "Normal" };
      }
      case "o2": {
        const val = parseFloat(valueStr);
        if (!isNaN(val)) {
          if (val < 95) return { className: "status-badge is-warning", label: "Low" };
          return { className: "status-badge is-success", label: "Normal" };
        }
        return { className: "status-badge is-success", label: "Normal" };
      }
      default:
        return { className: "status-badge is-success", label: "Normal" };
    }
  };

  const bpBadge = getBadge("bp", isScribe ? vitals.bloodPressure : patient.vitals.bloodPressure);
  const hrBadge = getBadge("hr", isScribe ? vitals.heartRate : patient.vitals.heartRate.toString());
  const tempBadge = getBadge("temp", isScribe ? vitals.temperature : patient.vitals.temperature.toString());
  const rrBadge = getBadge("rr", isScribe ? vitals.respiratoryRate : patient.vitals.respiratoryRate.toString());
  const o2Badge = getBadge("o2", isScribe ? vitals.oxygenSaturation : patient.vitals.oxygenSaturation.toString());

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <div className="clinical-card col-span-2">
        <p className="clinical-label mb-3">Vital Signs</p>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Measurement</th>
                <th>Value</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Blood Pressure</td>
                <td className="font-medium">
                  {isScribe ? (
                    <input
                      type="text"
                      value={vitals.bloodPressure}
                      onChange={(e) => updateVital("bloodPressure", e.target.value)}
                      className="w-28 rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-brand-400"
                    />
                  ) : (
                    <>{formatVital(patient.vitals.bloodPressure, " mmHg")}</>
                  )}
                </td>
                <td><span className={bpBadge.className}>{bpBadge.label}</span></td>
              </tr>
              <tr>
                <td>Heart Rate</td>
                <td className="font-medium">
                  {isScribe ? (
                    <input
                      type="text"
                      value={vitals.heartRate}
                      onChange={(e) => updateVital("heartRate", e.target.value)}
                      className="w-28 rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-brand-400"
                    />
                  ) : (
                    <>{formatVital(patient.vitals.heartRate, " bpm")}</>
                  )}
                </td>
                <td><span className={hrBadge.className}>{hrBadge.label}</span></td>
              </tr>
              <tr>
                <td>Temperature</td>
                <td className="font-medium">
                  {isScribe ? (
                    <input
                      type="text"
                      value={vitals.temperature}
                      onChange={(e) => updateVital("temperature", e.target.value)}
                      className="w-28 rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-brand-400"
                    />
                  ) : (
                    <>{formatVital(patient.vitals.temperature, " °F")}</>
                  )}
                </td>
                <td><span className={tempBadge.className}>{tempBadge.label}</span></td>
              </tr>
              <tr>
                <td>Respiratory Rate</td>
                <td className="font-medium">
                  {isScribe ? (
                    <input
                      type="text"
                      value={vitals.respiratoryRate}
                      onChange={(e) => updateVital("respiratoryRate", e.target.value)}
                      className="w-28 rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-brand-400"
                    />
                  ) : (
                    <>{formatVital(patient.vitals.respiratoryRate)} /min</>
                  )}
                </td>
                <td><span className={rrBadge.className}>{rrBadge.label}</span></td>
              </tr>
              <tr>
                <td>Oxygen Saturation</td>
                <td className="font-medium">
                  {isScribe ? (
                    <input
                      type="text"
                      value={vitals.oxygenSaturation}
                      onChange={(e) => updateVital("oxygenSaturation", e.target.value)}
                      className="w-28 rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-brand-400"
                    />
                  ) : (
                    <>{formatVital(patient.vitals.oxygenSaturation, "%")}</>
                  )}
                </td>
                <td><span className={o2Badge.className}>{o2Badge.label}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="clinical-card">
        <p className="clinical-label mb-2">Recorded</p>
        <p className="text-sm text-slate-600">
          {new Date(patient.vitals.recordedAt).toLocaleString()}
        </p>
        {isScribe && (
          <p className="mt-2 text-[10px] italic text-brand-500">Click to edit values above</p>
        )}
      </div>
    </div>
  );
}

// ─── Public Landing Page (when not logged in) ──────────────────────

function PublicLandingPage() {
  const reduceMotion = useReducedMotion();

  // Shared reveal preset — collapses to no-op under prefers-reduced-motion.
  const rise = (i = 0) => ({
    initial: { opacity: 0, y: reduceMotion ? 0 : 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.15 },
    transition: { duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : i * 0.06 },
  });

  const medicalStages = [
    { icon: FileText, title: "Scribe — Clinical Charting", desc: "Structured SOAP notes, vitals, HPI, exam findings and assessment plans — with one-click macros straight into the coding queue.", tag: "Epic + DrChrono" },
    { icon: Search, title: "Coder — ICD-10 & CPT", desc: "Extract diagnoses and procedures, search a built-in code repository, and assign the correct ICD-10-CM and CPT codes.", tag: "ICD-10 / CPT" },
    { icon: ShieldCheck, title: "Prior Auth — Authorization Hub", desc: "Map clinical documentation to payer criteria and submit digital prior-authorization forms for high-cost procedures.", tag: "PA Portal" },
    { icon: BadgeDollarSign, title: "Biller — Claim Scrubbing", desc: "Audit CMS-1500 claims, submit to the clearinghouse, and resolve real-world paid / denied outcomes.", tag: "CMS-1500" },
    { icon: Mic, title: "AR Voice — Phone Follow-up", desc: "Dispute denied claims with an AI insurance rep that responds like a real US-based agent — accent practice included.", tag: "AI Voice" },
    { icon: RefreshCw, title: "Denial Simulation Matrix", desc: "Resolve CO-16, CO-50 and CO-119 denials through correction, documentation, or voice negotiation.", tag: "Path A / Path B" },
  ];

  const dentalFeatures = [
    { icon: Hash, title: "CDT Coding", desc: "Procedure selection with tooth, surface and quadrant notation.", tag: "CDT" },
    { icon: LayoutGrid, title: "Odontogram + Perio Chart", desc: "Visual tooth charting with periodontal pocket and mobility tracking.", tag: "Visual" },
    { icon: FileText, title: "ADA J430D Claim Form", desc: "Line-level paid / downgraded / denied explanations on an ADA-style claim.", tag: "ADA" },
    { icon: Scale, title: "12-Step Adjudication", desc: "Annual maximums, frequency limits, waiting periods, missing-tooth clause and alternate-benefit downgrades.", tag: "Benefits" },
    { icon: ClipboardList, title: "Treatment Planning", desc: "Planned treatments with per-item insurance estimates and an accept → completed flow.", tag: "Plans" },
    { icon: ListChecks, title: "Claim Status Queue", desc: "Created → sent → pending → paid / denied / appealed, tracked end to end.", tag: "Queue" },
    { icon: BarChart3, title: "Patient Ledger", desc: "Charges, payments, adjustments, running balance and 30/60/90+ aging.", tag: "AR" },
    { icon: Receipt, title: "EOB / ERA + Appeal", desc: "Detailed EOB breakdown with a guided denial → appeal wizard.", tag: "Appeals" },
  ];

  return (
    <div className="min-h-dvh overflow-x-hidden bg-slate-50 text-slate-800">
      {/* Nav */}
      <nav className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200/70 bg-white/85 px-4 py-3 backdrop-blur-md">
        <img
          src="/healthcarehustlers-logo.png"
          alt="Healthcare Hustlers"
          className="h-7 w-auto"
          style={{ maxWidth: "160px" }}
        />
        <div className="flex items-center gap-2 text-xs">
          <Link to="/login" className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-50">
            Student Login
          </Link>
          <Link to="/admin" className="rounded-lg bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-700">
            Admin Panel
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        {/* Subtle animated background */}
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
          <motion.div
            className="absolute -top-24 left-1/2 h-[420px] w-[420px] -translate-x-[130%] rounded-full bg-brand-300/30 blur-3xl"
            animate={reduceMotion ? undefined : { x: [0, 48, 0], y: [0, 24, 0] }}
            transition={{ duration: 15, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -top-16 left-1/2 h-[380px] w-[380px] translate-x-[20%] rounded-full bg-accent-300/30 blur-3xl"
            animate={reduceMotion ? undefined : { x: [0, -48, 0], y: [0, 32, 0] }}
            transition={{ duration: 17, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
          />
          <div className="absolute bottom-0 left-1/3 h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-brand-200/20 blur-3xl" />
        </div>

        <div className="mx-auto max-w-5xl px-4 pb-14 pt-14 text-center md:pt-20">
          <motion.p {...rise(0)} className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-medium text-slate-500">
            <Sparkles className="h-3.5 w-3.5 text-brand-500" />
            Medical + Dental revenue-cycle training in one login
          </motion.p>

          <motion.h1 {...rise(1)} className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 md:text-6xl">
            Master the full patient encounter —{" "}
            <span className="bg-gradient-to-r from-brand-600 to-accent-600 bg-clip-text text-transparent">
              chart to payment.
            </span>
          </motion.h1>

          <motion.p {...rise(2)} className="mx-auto mt-5 max-w-2xl text-base text-slate-500 md:text-lg">
            Practice as a Scribe, Coder, Biller, Prior Auth Specialist and AR Voice Agent — then switch to the
            dental track for CDT coding, perio charting and claim appeals.
          </motion.p>

          <motion.div {...rise(3)} className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/access"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-xl"
            >
              Enroll Now — 20$ / 5500 pkr
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-7 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Student Login
            </Link>
          </motion.div>
          <motion.p {...rise(4)} className="mt-4 text-center text-xs text-slate-400">
            One fee unlocks both the medical and dental RCM tracks
          </motion.p>

          {/* Two-track hero */}
          <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2">
            <motion.div {...rise(5)} className="relative overflow-hidden rounded-2xl border border-brand-200 bg-white p-6 text-left shadow-sm">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-600 to-brand-400" />
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Stethoscope className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-brand-500">Medical track</p>
                  <h3 className="text-lg font-bold text-slate-900">Medical RCM Pipeline</h3>
                </div>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                {["Scribe → Coder → Prior Auth → Biller → AR Voice", "ICD-10 / CPT coding & CMS-1500 claims", "AI voice simulation for denial follow-up"].map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                    {line}
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div {...rise(6)} className="relative overflow-hidden rounded-2xl border border-accent-200 bg-white p-6 text-left shadow-sm">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-accent-600 to-green-400" />
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
                  <Smile className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-accent-500">Dental track</p>
                  <h3 className="text-lg font-bold text-slate-900">Dental Billing & RCM</h3>
                </div>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                {["CDT coding with tooth / surface / quadrant", "Odontogram + perio chart & ADA claim form", "12-step adjudication, ledger & appeals"].map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
                    {line}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Dental showcase */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <motion.div {...rise(0)} className="mb-10 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-accent-600">Dental billing, front and center</p>
          <h2 className="mt-2 text-3xl font-bold text-slate-900">The Dental RCM Track</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-500">
            A full second revenue cycle built on Dentrix, Eaglesoft and Open Dental workflows — everything a dental
            biller or coder gets hired for.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {dentalFeatures.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                {...rise(i)}
                className="group rounded-2xl border border-accent-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-accent-300 hover:shadow-lg"
              >
                <div className="flex items-start justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-600 transition group-hover:scale-110">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="rounded-full bg-accent-50 px-2 py-0.5 text-[10px] font-semibold text-accent-700">{f.tag}</span>
                </div>
                <h3 className="mt-3 font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{f.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Medical pipeline */}
      <section className="border-t border-slate-100 bg-white/60 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <motion.div {...rise(0)} className="mb-10 text-center">
            <p className="text-[11px] font-bold uppercase tracking-widest text-brand-600">Medical track</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">The Medical RCM Pipeline</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-500">Follow a patient encounter from exam room to final payment.</p>
          </motion.div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {medicalStages.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.title}
                  {...rise(i)}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">{f.tag}</span>
                  </div>
                  <h3 className="mt-3 font-semibold text-slate-900">{f.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{f.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <motion.h2 {...rise(0)} className="text-3xl font-bold text-slate-900">Get Started in 4 Steps</motion.h2>
          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-4">
            {[
              { n: "1", title: "Pay 20$ / 5500 pkr", desc: "via UBL, EasyPaisa, or PayPal" },
              { n: "2", title: "Submit Request", desc: "Fill the form with your transaction ID" },
              { n: "3", title: "Get Approved", desc: "Admin activates your account" },
              { n: "4", title: "Practice!", desc: "Log in with your phone number and start" },
            ].map((step, i) => (
              <motion.div key={step.n} {...rise(i)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-accent-500 text-base font-bold text-white">
                  {step.n}
                </div>
                <h3 className="font-semibold text-slate-800">{step.title}</h3>
                <p className="mt-1 text-xs text-slate-400">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white/70 px-4 py-6 text-center text-xs text-slate-400">
        www.healthcarehustlers.org — Healthcare Hustlers EHR Simulation Portal
      </footer>
    </div>
  );
}


// ─── Main Layout ───────────────────────────────────────────────────

export function Home({ encounterIdFromRoute, stageFromRoute }: HomeProps = {}) {
  const router = useRouter();
  const { patients } = usePatientStore();
  const { activeTab, setActiveTab } = useTabsEpic("summary");
  /**
   * The workspace strip is back, as it was on 19 November (`f8fd8681`): owner,
   * 2026-11-21 — "i can not see scheduling appointment and calender i window
   * inside keep it there as well". The window opens on Daily Schedule; the chart
   * is the next tab of the same window, so the stepper, the patient banner and
   * Back / "Continue to…" stay inside the chart panel where they were.
   */
  const { activeWorkspace, setActiveWorkspace } = useWorkspaceTabs("schedule");
  const { currentRole, submitToCoding, writeNoteFor, setRole, rememberChartStage, paRecords, deniedClaims, resetEncounter, setPatientDisplayName, seedTutorialOnOpen, selectPatient, getEncounter, activePatientId, getRoleLabel, completePipeline, state: pipelineState } = usePipeline();
  /**
   * The patient the chart opens on (owner's audit, 2026-11-20, item 4 — "patient
   * and track context persist across navigation and reload").
   *
   *   1. an address that names its patient — a pasted link, Start Visit, a refresh
   *      on `/encounter/:encounterId/:stage` — always wins;
   *   2. then the patient this tab last showed;
   *   3. then **the patient the encounter store still has open**: `activePatientId`
   *      is written to the student's own record (`hh_userdata_<phone>`) every time a
   *      patient is picked, so a reload, a Back from a money-cycle page or a fresh
   *      tab reopens the same patient instead of the first one in the list.
   *
   * The list is only the last resort, for a student who has never opened anyone.
   * Picking it first is what used to drop a working student back to the Tutorial
   * Patient, and the effect below then wrote that pick onto the encounter store.
   */
  const [selectedPatientId, setSelectedPatientId] = useState(() => {
    const remembered =
      (encounterIdFromRoute && patients.some((p) => p.id === encounterIdFromRoute)
        ? encounterIdFromRoute
        : "") ||
      sessionStorage.getItem("hh_selected_patient") ||
      (activePatientId && patients.some((p) => p.id === activePatientId) ? activePatientId : "");
    return remembered || patients[0]?.id || "";
  });
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // An address that names an encounter opens the chart, not the schedule: a
  // refresh on `/encounter/:encounterId/:stage` keeps the student on the chart.
  useEffect(() => {
    if (!encounterIdFromRoute) return;
    setActiveWorkspace("chart");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounterIdFromRoute]);

  // ── Right-panel financial KPIs — derived from REAL pipeline data ──
  // (was hardcoded 12500/8700/2400/32 demo figures)
  const billedTotal = (pipelineState.cptCodes || []).reduce((sum, code) => {
    const cpt = CPT_CODES.find((c) => c.code === code);
    return sum + (cpt?.medicareRate ?? 0);
  }, 0);
  const deniedTotal = deniedClaims.reduce((sum, c) => sum + (c.amount || 0), 0);
  const hasFinancialActivity = billedTotal > 0 || deniedTotal > 0 || pipelineState.status !== "pending";
  const { addToast } = useToast();
  /**
   * The chart step on screen. Every patient opens on step 1, Registration, and
   * the chart walks forward one step at a time from there
   * (spec `encounter-continuity.md`). The step bar ticks the steps the record
   * says are finished, so reopening a worked patient shows the work already done
   * while still starting the visit at the beginning.
   */
  const [activeStage, setActiveStage] = useState(CHART_OPENING_STEP);
  /**
   * Which of the biller's two screens is in front of the student. The encounter's
   * flow has two stages on that desk — Billing / Claim (the claim paper) and
   * Payments (835) (the remittance and ledger) — so the stepper's stage decides
   * the tab (`domain/encounterFlow.ts`).
   */
  const [billingTab, setBillingTab] = useState<BillingDeskTab>("form");

  /**
   * Move to a chart step and remember it on the encounter, so reopening the
   * chart returns to the furthest step reached (spec item 5). Navigation only:
   * the step id is the single value written, and it never moves backwards.
   */
  const goToChartStage = (stage: string) => {
    setActiveStage(stage);
    rememberChartStage(stage);
  };

  // ── The encounter's seven stages, in the owner's order ──────────────────
  // (owner's audit, 2026-11-20, item 1 — `domain/encounterFlow.ts`). The stage
  // on screen comes from the role and the screen in front of the student, so the
  // stepper's highlight and the workspace cannot disagree.
  const flowStageId = currentFlowStage({
    role: currentRole,
    chartStage: activeStage,
    billingTab,
  });

  /**
   * Open one stage of the encounter. Navigation only — nothing is written.
   * The stepper, Back / Continue, the work-queue rows and a pasted address all
   * come through here, so a stage opens on the same screen however it was
   * reached (`stageOpenTarget`).
   */
  const openFlowStage = (id: string) => {
    const target = stageOpenTarget(id);
    if (!target) return;
    if (target.role === "scribe") {
      setRole("scribe");
      if (target.chartStage) goToChartStage(target.chartStage);
      return;
    }
    if (target.role === "biller") {
      setRole("biller");
      setBillingTab(target.billingTab);
      setActiveStage("");
      return;
    }
    setRole(target.role);
    setActiveStage("");
  };

  /**
   * Set when a patient was picked on purpose — a handoff from the search, the
   * schedule's Start Visit or a money-cycle row. The saved session restores only
   * when nobody chose (audit item 3: "session restore never overrides an explicit
   * pick").
   */
  const explicitPick = useRef(false);

  // A patient picked from the shell's search while another page was open lands
  // here: open that chart once, then drop the request. Declared with the other
  // hooks, above every early return, so the hook order never changes.
  useEffect(() => {
    const requested = consumeRequestedPatient();
    if (!requested) return;
    // Somebody picked a patient on purpose — the search, the schedule's Start
    // Visit, a money-cycle row. The saved session must not undo that choice
    // (audit item 3), so the restore below stands down for this mount.
    explicitPick.current = true;
    const match = requested.patientId
      ? patients.find((p) => p.id === requested.patientId)
      : undefined;
    if (match) {
      setSelectedPatientId(match.id);
      selectPatient(match.id);
      // A money-cycle rail page hands over the stage its row was about, so the
      // chart opens on that screen instead of wherever the student left it.
      if (requested.role) setRole(requested.role);
      return;
    }
    // An appointment booked for someone who is not in the patient database
    // opens a blank encounter under that name — never the previous patient's
    // note, codes or claim.
    if (requested.name) {
      resetEncounter(null);
      setPatientDisplayName(requested.name);
      setDisplayName(requested.name);
      setSoapNote({ subjective: "", objective: "", assessment: "", plan: "" });
      setEditableVitals({ bloodPressure: "", heartRate: "", temperature: "", respiratoryRate: "", oxygenSaturation: "" });
      setEditablePatientData({
        chiefComplaint: `Visit for: ${requested.name}`,
        problems: [],
        medications: [],
        allergies: [],
        pcp: "",
        insurance: "",
        patientInstructions: "",
        followUpPlan: "",
      });
      setSharedImmunizations([]);
      setSharedLabs([]);
      setSharedReferrals([]);
      setSharedOrders([]);
      setSharedImaging([]);
      // A visit that starts here starts at the Progress Note, not on whatever
      // screen the previous patient was left on.
      openFlowStage(openingStageId());
    }
    // Mount only — the handoff is consumed exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [examMode, setExamMode] = useState(false);
  const [isLoadingPatient] = useState(false);
  const [examTimeRemaining, setExamTimeRemaining] = useState(1800); // 30 min in seconds
  const examTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // SOAP note state lifted from AssessmentPlanStage for pipeline submission
  const [soapNote, setSoapNote] = useState<SoapNoteData>({
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
  });
  // The note's status is read from the encounter's own record, never kept in
  // component state — that second flag is how the same note read "signed" on one
  // screen and "draft" on another (`domain/noteStatus.ts`).
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Shared editable vitals state across SummaryTab, VitalsTab, and RightPaneleCW
  const [editableVitals, setEditableVitals] = useState({
    bloodPressure: patients[0]?.vitals.bloodPressure ?? "120/80",
    heartRate: patients[0]?.vitals.heartRate?.toString() ?? "72",
    temperature: patients[0]?.vitals.temperature?.toString() ?? "98.6",
    respiratoryRate: patients[0]?.vitals.respiratoryRate?.toString() ?? "16",
    oxygenSaturation: patients[0]?.vitals.oxygenSaturation?.toString() ?? "98",
  });

  // Map editable vitals into the shape SmartPhrases' `.vitals` dot-code expects.
  const noteVitals = {
    bp: editableVitals.bloodPressure,
    hr: editableVitals.heartRate,
    temp: editableVitals.temperature,
    rr: editableVitals.respiratoryRate,
    o2: editableVitals.oxygenSaturation,
  };

  // Shared editable patient data for scribe mode (persists across tab switches)
  const [editablePatientData, setEditablePatientData] = useState<EditablePatientData>({
    chiefComplaint: patients[0]?.chiefComplaint ?? "",
    problems: [...(patients[0]?.problems ?? [])],
    medications: patients[0]?.medications ? patients[0].medications.filter(m => m.status === "active").map(m => ({ id: m.id, name: m.name, dosage: m.dosage, frequency: m.frequency })) : [],
    allergies: patients[0]?.allergies ? [...patients[0].allergies] : [],
    pcp: patients[0]?.primaryCareProvider ?? "",
    insurance: patients[0]?.insurance ?? "",
  });
  const [newProblem, setNewProblem] = useState("");
  // Shared lists across Summary + tabs (real-time sync). They start empty: demo
  // clinical items belong to the seeded demo patients and load for those only.
  const [sharedImmunizations, setSharedImmunizations] = useState<ImmunizationEntry[]>([]);
  const [sharedLabs, setSharedLabs] = useState<string[]>([]);
  const [sharedReferrals, setSharedReferrals] = useState<ReferralEntry[]>([]);
  const [sharedOrders, setSharedOrders] = useState<OrderEntry[]>([]);
  const [sharedImaging, setSharedImaging] = useState<ImagingEntry[]>([]);

  // ── Phase 0: patients and appointments come from the central store ──
  // No component-state copy of either list, so a refresh, a role switch or a
  // log-out/log-in cannot lose a registered patient or their appointment.
  const appointments = useAllAppointments();

  // The date the Daily Schedule tab is showing. The Inbox list beside it reads
  // the same date, so the calendar and the visit list never disagree.
  const [selectedScheduleDate, setSelectedScheduleDate] = useState<string>(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (appointments.some((a) => a.date === today)) return today;
    const dates = [...new Set(appointments.map((a) => a.date))].sort();
    return dates[0] || today;
  });

  // Override display name for right panel header when showing placeholder patient (e.g. new appointment)
  const [displayName, setDisplayName] = useState<string | undefined>(undefined);

  // Per-patient session data store — preserves work when switching patients
  const patientDataStore = useRef<Record<string, PatientSessionData>>({});

  // ── Phase 0 section 4: remember the working context ───────────────
  // Patient, open encounter, role, chart tab and workspace tab are kept in the
  // central store, so a refresh, a role switch or a re-login reopens the same
  // place instead of dropping the student back on the schedule.
  const ehrHydrated = useEhrStore((s) => s.hydrated);
  const setWorkingContext = useEhrStore((s) => s.setWorkingContext);
  // When the one note record was last written (`writeNoteFor`), not a copy of it.
  const lastNoteSavedAt =
    (selectedPatientId ? getEncounter(selectedPatientId)?.noteUpdatedAt : null) ?? undefined;
  const openEncounterId = useEhrStore((s) =>
    selectedPatientId
      ? (s.user.encounters.find((e) => e.patientId === selectedPatientId && !e.locked)?.id ?? null)
      : null,
  );
  const contextRestored = useRef(false);
  /** Saved patient the restore is still waiting to land in state. */
  const restorePendingPatient = useRef<string | null>(null);

  // ── Phase 0 section 5: note autosave ──────────────────────────────
  // Every render refreshes this ref, so the 5-second timer and the blur handler
  // always see the latest text without being re-armed on each keystroke.
  const noteSnapshot = useRef({
    patientId: selectedPatientId,
    note: soapNote,
    saved: "",
  });
  noteSnapshot.current.patientId = selectedPatientId;
  noteSnapshot.current.note = soapNote;

  /**
   * Write the note if it changed since the last write. Safe to call often.
   *
   * It writes the encounter's one note record (`writeNoteFor`) — the same record
   * Charts and Sign & Lock read. A signed note is refused by the store, so a
   * stale tab cannot overwrite a signature.
   */
  const saveNoteDraftNow = () => {
    const snap = noteSnapshot.current;
    if (!snap.patientId) return;
    const fields = {
      subjective: snap.note.subjective ?? "",
      objective: snap.note.objective ?? "",
      assessment: snap.note.assessment ?? "",
      plan: snap.note.plan ?? "",
    };
    const serialized = JSON.stringify(fields);
    if (serialized === snap.saved) return;
    const blank = serialized.replace(/[^a-z0-9]/gi, "").length === 0;
    // Nothing typed and nothing stored: there is no note to save.
    if (blank && !noteFieldsHaveText(noteFieldsOf(getEncounter(snap.patientId)))) return;
    if (writeNoteFor(snap.patientId, fields)) snap.saved = serialized;
  };

  /**
   * Save the current patient's session data into the store.
   * Call this BEFORE switching to a different patient.
   */
  function saveCurrentSession() {
    console.log("saveCurrentSession: saving to key:", selectedPatientId);
    if (!selectedPatientId) return;
    patientDataStore.current[selectedPatientId] = {
      _patientId: selectedPatientId,
      soapNote: { ...soapNote },
      editableVitals: { ...editableVitals },
      editablePatientData: {
        ...editablePatientData,
        problems: [...editablePatientData.problems],
        medications: editablePatientData.medications.map(m => ({ ...m })),
        allergies: [...editablePatientData.allergies],
      },
      sharedImmunizations: [...sharedImmunizations],
      sharedLabs: [...sharedLabs],
      sharedReferrals: [...sharedReferrals],
      sharedOrders: [...sharedOrders],
      sharedImaging: [...sharedImaging],
      displayName,
      activeStage,
    };
  }

  /**
   * Load a patient's saved session data into the live state.
   * Called in useEffect when selectedPatientId changes.
   * Falls back to mock patient data or defaults if no saved session.
   */
  function loadPatientSession(patientId: string) {
    // The Tutorial Patient — the worked example, seeded once
    // (`specs/tutorial-patient-prefill.md`, owner 2026-11-22: "all data filled from
    // start to end so that can act as a standard which data should be where").
    //
    // The record itself — the patient's own coverage card with the member ID the
    // 271 needs, the 271 that matches it, the signed note, the codes with their
    // charge and place of service, the decided prior authorisation and the PA
    // desk's row for it — is written by the store's own open path,
    // `seedTutorialOnOpen`, which `selectPatient` calls. That is what makes the
    // chart filled however it is opened: the inbox, `/patients`, Start Visit or a
    // pasted link. This is the second entry to the same function, and it answers
    // whether this chart is showing the example, so the screen paints what the
    // record now holds instead of guessing.
    //
    // The guard is the record's own shape (`tutorialSeedPending`): a chart the
    // student actually worked — anything with a claim, an authorisation, money or
    // a signature — outranks the example and is left exactly as it is.
    // This is a second entry to that function, and its answer is all this screen
    // needs: the seed is the only writer for the Tutorial Patient. The old
    // hardcoded demo prefill that used to sit here — its own note, problem list,
    // medications, allergies, card, vitals and clinical history — is gone; the
    // chart below is painted from the record the seed wrote and from the
    // patient's own chart, the same way every other chart is.
    const showingTutorialExample = seedTutorialOnOpen(patientId);
    console.log("loadPatientSession called for:", patientId, "saved:", !!patientDataStore.current[patientId]);
    const saved = patientDataStore.current[patientId];
    const p = patients.find(pp => pp.id === patientId);
    console.log("  patient found:", p?.firstName, p?.lastName, "| saved data:", !!saved);

    if (saved && saved._patientId === patientId) {
      // The note always comes from the encounter's own record, so a signed note
      // reads signed here too (`domain/noteStatus.ts`).
      setSoapNote({ ...noteFieldsOf(getEncounter(patientId)) });
      // The visit always opens on step 1, Registration — never wherever the
      // student last was (spec `encounter-continuity.md`). What they already did
      // is shown by the step bar's ticks, read from the record, and Next walks
      // the steps from the beginning to Sign & Lock.
      setActiveStage(CHART_OPENING_STEP);
      setEditableVitals(saved.editableVitals);
      setEditablePatientData(saved.editablePatientData);
      setSharedImmunizations(saved.sharedImmunizations);
      setSharedLabs(saved.sharedLabs);
      setSharedReferrals(saved.sharedReferrals);
      setSharedOrders(saved.sharedOrders);
      setSharedImaging(saved.sharedImaging);
      setDisplayName(saved.displayName);
    } else {
      // Clear any mismatched saved data
      if (saved) delete patientDataStore.current[patientId];
      if (p) {
      // First time visiting this patient — initialize from mock data
      setEditablePatientData({
        chiefComplaint: p.chiefComplaint ?? "",
        problems: [...(p.problems ?? [])],
        medications: p.medications ? p.medications.filter(m => m.status === "active").map(m => ({ id: m.id, name: m.name, dosage: m.dosage, frequency: m.frequency })) : [],
        allergies: p.allergies ? [...p.allergies] : [],
        pcp: p.primaryCareProvider ?? "",
        insurance: p.insurance ?? "",
      });
      // A measurement that was never taken stays empty so every screen shows
      // "—": filling in 72 bpm / 98.6°F made an untaken vitals look recorded.
      const recorded = (v: string | number | undefined) => (hasVital(v) ? String(v) : "");
      setEditableVitals({
        bloodPressure: recorded(p.vitals.bloodPressure),
        heartRate: recorded(p.vitals.heartRate),
        temperature: recorded(p.vitals.temperature),
        respiratoryRate: recorded(p.vitals.respiratoryRate),
        oxygenSaturation: recorded(p.vitals.oxygenSaturation),
      });
      // Demo clinical items appear on seeded demo patients only (owner decision
      // 2026-11-20). A patient the student registered starts with empty lists.
      const seeded = p.isSeed === true || p.id === TUTORIAL_PATIENT_ID;
      setSharedImmunizations(seeded ? SEED_IMMUNIZATIONS : []);
      setSharedLabs([]);
      setSharedReferrals(seeded ? SEED_REFERRALS : []);
      setSharedOrders(seeded ? SEED_ORDERS : []);
      setSharedImaging(seeded ? SEED_IMAGING : []);
      // Phase 0 section 5 — the note comes back with the patient, from the
      // encounter's own record. A draft an earlier build kept in
      // `user.noteDrafts` is adopted into that record once and never read again:
      // one note, one status (`domain/noteStatus.ts`).
      // On a first open the encounter was seeded a moment ago in this same pass,
      // so the note comes from the seed rather than from a record read before it.
      const storedFields = showingTutorialExample
        ? tutorialNoteFields(p)
        : noteFieldsOf(getEncounter(patientId));
      const legacyDraft = useEhrStore.getState().user.noteDrafts[patientId];
      if (!noteFieldsHaveText(storedFields) && legacyDraft && noteFieldsHaveText(legacyDraft.fields)) {
        writeNoteFor(patientId, legacyDraft.fields);
        setSoapNote({ ...legacyDraft.fields });
      } else {
        setSoapNote({ ...storedFields });
      }
      setDisplayName(undefined);
      // A patient opens on step 1 whether or not they were worked before
      // (spec `encounter-continuity.md`); the step bar ticks what is finished.
      setActiveStage(CHART_OPENING_STEP);
    }
    }
  }

  // When selected patient changes, load that patient's session data
  //
  // The load can arrive before the patient list does: on a cleared store the
  // chart is opened and the patient record is registered a moment later. This
  // used to return early and never run again, which is what left the Tutorial
  // Patient's chart blank. `chartOpenedFor` marks the chart actually opened, and
  // the effect below retries the same load the moment the patient is resolvable.
  const chartOpenedFor = useRef<string | null>(null);
  function openPatientChart(patientId: string) {
    console.log("useEffect[selectedPatientId] FIRED for:", patientId);
    const p = patients.find(pp => pp.id === patientId);
    console.log("  patient found in useEffect:", p?.firstName, p?.lastName);
    if (!p) {
      // Handle case where patient not found (e.g. custom appointment mapped to placeholder)
      setSharedImmunizations([]);
      setSharedLabs([]);
      setSharedReferrals([]);
      setSharedOrders([]);
      setSharedImaging([]);
      setSoapNote({ subjective: "", objective: "", assessment: "", plan: "" });
      return;
    }
    // The patient exists: this chart is now open for this patient, and the
    // retry below must not open it a second time.
    chartOpenedFor.current = patientId;
    // The summary panel and the workflow must be the same patient: reattach the
    // pipeline to whoever the chart is showing (a refresh restores the pick).
    if (activePatientId !== patientId) selectPatient(patientId);
    // If we have saved data for this patient, restore it; otherwise initialize from mock
    loadPatientSession(patientId);
  }

  useEffect(() => {
    // Remember this tab's patient, so a reload reopens the same one.
    if (selectedPatientId) sessionStorage.setItem("hh_selected_patient", selectedPatientId);
    if (!selectedPatientId) return;
    if (chartOpenedFor.current === selectedPatientId) return;
    openPatientChart(selectedPatientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatientId]);

  // A patient list that arrives after the first render used to leave the chart
  // blank for good. This runs the same load once, the moment the patient record
  // exists — so opening the Tutorial Patient from `/patients` always lands on
  // the chart that was seeded for it.
  useEffect(() => {
    if (!selectedPatientId) return;
    if (chartOpenedFor.current === selectedPatientId) return;
    if (!patients.some((pp) => pp.id === selectedPatientId)) return;
    openPatientChart(selectedPatientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patients, selectedPatientId]);

  /**
   * An explicit address names its patient, and it keeps winning.
   *
   * Start Visit, a pasted link and a refresh all arrive at
   * `/encounter/:encounterId/:stage`. On a fresh load the student's own patients
   * are not in the list until the store has hydrated, so the first render can
   * fall back to the remembered patient. When the named patient does appear, the
   * address takes over — a saved session never overrides an explicit pick.
   */
  useEffect(() => {
    if (!encounterIdFromRoute) return;
    if (selectedPatientId === encounterIdFromRoute) return;
    if (!patients.some((p) => p.id === encounterIdFromRoute)) return;
    explicitPick.current = true;
    setSelectedPatientId(encounterIdFromRoute);
    selectPatient(encounterIdFromRoute);
    setPatientDisplayName(null);
    setDisplayName(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounterIdFromRoute, selectedPatientId, patients]);

  /**
   * A stage named in the address opens once, after the patient's own session has
   * loaded — an address beats whatever screen the session remembered (audit item
   * 2: "a real route per encounter and stage, so refresh and deep links work").
   * It is the same `openFlowStage` the stepper calls, so a pasted link lands on
   * the screen the stepper would have shown. Nothing is written to the record.
   */
  const routeStageApplied = useRef(false);
  useEffect(() => {
    if (!stageFromRoute || routeStageApplied.current) return;
    // Wait until the chart is showing the patient the address names.
    if (!selectedPatientId) return;
    if (encounterIdFromRoute && selectedPatientId !== encounterIdFromRoute) return;
    if (!stageOpenTarget(stageFromRoute)) return;
    routeStageApplied.current = true;
    openFlowStage(stageFromRoute);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageFromRoute, encounterIdFromRoute, selectedPatientId]);

  /**
   * Keep the address naming the encounter and the stage on screen. The write is
   * shallow: the router is not asked to re-render, so moving between stages
   * keeps the note, the vitals and the exam timer in memory, while a refresh or
   * a pasted link is a real load of `/encounter/:encounterId/:stage`.
   */
  useEffect(() => {
    if (!isLoggedIn()) return;
    // Let a pasted address open its own stage before the address is rewritten.
    if (stageFromRoute && !routeStageApplied.current) return;
    const href = selectedPatientId
      ? encounterPath(selectedPatientId, flowStageId)
      : window.location.pathname.startsWith(ENCOUNTER_ROUTE_PREFIX)
        ? "/"
        : null;
    if (!href) return;
    writeEncounterAddress(href, {
      history: router.history,
      browserHistory: window.history,
      pathname: window.location.pathname,
    });
  }, [selectedPatientId, flowStageId, stageFromRoute, router]);

  // Note autosave: every 5 s, on blur (focusout anywhere) and on page hide.
  // Nothing here depends on the student pressing Save (section 5).
  useEffect(() => {
    if (!ehrHydrated) return;
    const timer = setInterval(() => saveNoteDraftNow(), 5000);
    const onFocusOut = () => saveNoteDraftNow();
    const onPageHide = () => {
      saveNoteDraftNow();
      flushEhrStore();
    };
    document.addEventListener("focusout", onFocusOut);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      clearInterval(timer);
      document.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("pagehide", onPageHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ehrHydrated]);

  // Restore the saved working context once, when the store has hydrated (section 4).
  useEffect(() => {
    if (!ehrHydrated || contextRestored.current) return;
    contextRestored.current = true;
    // A pasted link is an explicit pick: it names its patient and its stage, so
    // the saved session does not put a different patient in front of it
    // (audit item 3: "session restore never overrides an explicit pick").
    if (encounterIdFromRoute) return;
    // So is a patient picked on purpose — from the search, from Start Visit, or
    // from a money-cycle row.
    if (explicitPick.current) return;
    const ctx = useEhrStore.getState().user.context;
    if (!ctx.patientId) return;
    const p = patients.find((pp) => pp.id === ctx.patientId);
    if (!p) {
      // The saved patient is gone (e.g. after a reset) — nothing to wait for.
      restorePendingPatient.current = null;
      return;
    }
    restorePendingPatient.current = p.id;
    // A patient with an encounter of their own already knows which stage they
    // were left at; the saved context role is only a fallback for a patient who
    // has never been worked.
    if (!getEncounter(p.id) && PIPELINE_ROLES.includes(ctx.role as Role)) setRole(ctx.role as Role);
    setActiveTab(ctx.tab);
    setActiveWorkspace(ctx.workspace || "chart");
    setSelectedPatientId(p.id);
    const draft = useEhrStore.getState().user.noteDrafts[p.id];
    const hasDraft = draft
      ? Object.values(draft.fields).some((value) => (value ?? "").trim().length > 0)
      : false;
    addToast({
      type: "info",
      title: `Restored your session — ${p.firstName} ${p.lastName}${
        hasDraft ? ", progress note draft" : ""
      }.`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ehrHydrated]);

  // Keep the stored context in step with what is on screen.
  useEffect(() => {
    if (!ehrHydrated || !contextRestored.current) return;
    if (restorePendingPatient.current !== null) {
      if (selectedPatientId === restorePendingPatient.current) restorePendingPatient.current = null;
      else return; // still restoring — do not overwrite the saved context
    }
    setWorkingContext({
      patientId: selectedPatientId || null,
      encounterId: openEncounterId,
      role: currentRole,
      tab: activeTab,
      workspace: activeWorkspace,
    });
  }, [
    ehrHydrated,
    selectedPatientId,
    openEncounterId,
    currentRole,
    activeTab,
    activeWorkspace,
    setWorkingContext,
  ]);

  // Check login on mount
  useEffect(() => {
    setCheckingAuth(false);
    // Record session start time for timeout tracking
    setSessionStart();
    // Deliberately no enrolment sync here: the dashboard must never download
    // the access_requests table. Login asks the server about one phone only.
  }, []);

  // Exam mode timer
  useEffect(() => {
    if (examMode) {
      examTimerRef.current = setInterval(() => {
        setExamTimeRemaining(prev => {
          if (prev <= 1) {
            if (examTimerRef.current) clearInterval(examTimerRef.current);
            addToast({ type: "warning", title: "Exam Time Expired!", description: "Your 30-minute exam has ended. Your score will be calculated." });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (examTimerRef.current) {
        clearInterval(examTimerRef.current);
        examTimerRef.current = null;
      }
      setExamTimeRemaining(1800);
    }
    return () => {
      if (examTimerRef.current) clearInterval(examTimerRef.current);
    };
  }, [examMode]);

  const toggleExamMode = () => {
    setExamMode(prev => !prev);
    if (!examMode) {
      addToast({ type: "info", title: "Exam Mode Started", description: "You have 30 minutes to complete the pipeline. Timer starts now!" });
    }
  };

  // Poll session expiry every 10 seconds
  useEffect(() => {
    if (isLoggedIn()) {
      const interval = setInterval(() => {
        if (checkSessionExpired()) {
          clearSession();
          window.location.reload();
        }
      }, 10000);
      return () => clearInterval(interval);
    }
  }, []);

  // Poll for single-active-session supersession every 15 seconds. If another
  // device logged in with this phone, sign this one out (client-side raise-bar).
  useEffect(() => {
    if (!isLoggedIn()) return;
    let cancelled = false;
    const check = async () => {
      try {
        const superseded = await isSessionSuperseded(getLoggedInPhone());
        if (superseded && !cancelled) {
          addToast({
            type: "warning",
            title: "Signed in on another device",
            description: "This device was signed out because you logged in elsewhere.",
          });
          clearSession();
          window.location.reload();
        }
      } catch {
        /* ignore transient sync errors */
      }
    };
    const interval = setInterval(check, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // The stored track, live (owner item 4), and the InBasket badge counted from
  // the same rows the Work Queues panel prints — never a literal.
  //
  // BOTH HOOKS SIT ABOVE THE AUTH EARLY RETURNS ON PURPOSE. `checkingAuth`
  // starts true and `!isLoggedIn()` can return the landing page, so a hook
  // called after those returns is skipped on the first render and called on
  // the second — React error #310 ("rendered more hooks than during the
  // previous render"), which took the whole encounter page down to
  // "Something went wrong!". Every hook in this component must be called
  // before the first `return`.
  const track = useActiveTrack();
  // The tab badge and the InBasket panel are the same derivation, so they can
  // never disagree (build 5, the two blank tabs).
  const inBasketCount = inboxCount(useInboxItems());

  // Show public landing page while checking or if not logged in
  if (checkingAuth) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50">
        <div className="text-center">
          <Activity className="mx-auto h-8 w-8 animate-pulse text-brand-500" />
          <p className="mt-3 text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn()) {
    return <PublicLandingPage />;
  }

  // Handle sign & lock — one write: the note and its signature on the encounter
  const handleSignAndLock = () => {
    setIsSubmittingNote(true);
    // Simulate brief submission delay for UX
    setTimeout(() => {
      // `submitToCoding` writes the note and its signature in one store write
      // (`domain/signNote.ts`). Every other screen reads that same record.
      submitToCoding(soapNote);
      setIsSubmittingNote(false);
      addToast({ type: "success", title: "Note Submitted to Coding!", description: "The clinical note has been signed, locked, and sent to the coding queue." });
    }, 800);
  };

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  // ─── Registration is done when its data is done ───────────────────
  // Name, a real (non-future) DOB, sex, phone and coverage — or self-pay. The
  // workflow step status is derived from these, not from a checkbox, so a
  // student cannot advance past Registration with a half-filled patient.
  const registrationGaps: string[] = [];
  if (selectedPatient) {
    const filled = (v?: string) => !!v && v.trim().length > 0;
    const dobRaw = (selectedPatient.dateOfBirth || "").trim();
    const dobDate = dobRaw ? new Date(dobRaw) : null;
    if (!filled(selectedPatient.firstName) || !filled(selectedPatient.lastName)) registrationGaps.push("name");
    if (!dobDate || Number.isNaN(dobDate.getTime())) registrationGaps.push("date of birth");
    else if (dobDate.getTime() > Date.now()) registrationGaps.push("a date of birth that is not in the future");
    if (!filled(selectedPatient.gender)) registrationGaps.push("sex");
    if (!filled(selectedPatient.phone)) registrationGaps.push("phone");
    const payer =
      (selectedPatient.insuranceRecord?.primary.payerName || "").trim() ||
      (selectedPatient.insurance || "").trim();
    if (!payer) registrationGaps.push("coverage or self-pay");
  }
  const registrationComplete = !!selectedPatient && registrationGaps.length === 0;

  // ─── Every step's state is read from the record ───────────────────
  // A step is green only when the data its role captures is actually there.
  // This is a projection recomputed on every render: no stored "done" flag, no
  // click, and nothing written back from here (status-engine.md §4–5).
  const vitalsGaps = (
    [
      ["blood pressure", editableVitals.bloodPressure],
      ["heart rate", editableVitals.heartRate],
      ["temperature", editableVitals.temperature],
      ["respiratory rate", editableVitals.respiratoryRate],
      ["oxygen saturation", editableVitals.oxygenSaturation],
    ] as [string, string][]
  )
    .filter(([, value]) => !String(value ?? "").trim())
    .map(([label]) => label);

  // The note's own record first, then the editor buffer — the buffer is only
  // what has not been written yet (the debounced writer lands it in the record).
  // Reading the record is what makes the step bar look the same after a reload
  // (owner's work order, `specs/phase1-data-integrity.md` item 2).
  const noteInRecord = noteFieldsOf(pipelineState);
  const noteSectionText = (section: keyof typeof noteInRecord): string =>
    (noteInRecord[section] || soapNote[section] || "").trim();
  const hpiDone = noteSectionText("subjective").length > 0;
  const examDone = noteSectionText("objective").length > 0;
  const planGaps: string[] = [];
  if (!noteSectionText("assessment")) planGaps.push("the assessment");
  if (!noteSectionText("plan")) planGaps.push("the plan");
  // The encounter's own record says whether its note was signed and locked —
  // one function, the same one Charts and the Coding queue call.
  const noteStatusNow = noteStatus(pipelineState);
  const noteSigned = noteStatusNow === "signed";
  const noteLocked = noteReadOnly(pipelineState);

  // The steps the record says are finished, mapped onto the one step order so
  // the step bar's ticks and the work on screen cannot disagree.
  const completedChartSteps = completedEncounterSteps({
    registration: registrationComplete,
    "intake-vitals": vitalsGaps.length === 0,
    hpi: hpiDone,
    "exam-ros": examDone,
    "assessment-plan": planGaps.length === 0,
    "sign-lock": noteSigned,
  });

  // What the record says is finished — one pure reader (`domain/stageProgress.ts`)
  // over the encounter's own saved state, so a tick and the work can never
  // disagree and a reload cannot change the answer.
  const completedFlow = completedStagesOf(pipelineState);

  // The Tutorial Patient's chart is the standard reference and is read-only
  // (spec `tutorial-patient-prefill.md` § C, owner 2026-11-22 and 2026-11-23).
  // The stores refuse the write; this flag is the second layer — the one line at
  // the top of every stage and the disabled controls underneath it.
  const tutorialChartOpen =
    activePatientId === TUTORIAL_PATIENT_ID || selectedPatientId === TUTORIAL_PATIENT_ID;

  const flowNext = nextFlowStage(flowStageId);
  const flowPrevious = previousFlowStage(flowStageId);
  const onLastFlowStage = flowStageId === lastFlowStageId();
  const flowIndex = flowStageIndex(flowStageId);

  // The one step back and the one step forward for the stage on screen
  // (spec `tutorial-start-and-back.md` item 3). The first stage has no Back.
  const scribeStageIndex = SCRIBE_STAGES.findIndex((stage) => stage.id === activeStage);
  const scribeBack = scribeStageIndex > 0 ? SCRIBE_STAGES[scribeStageIndex - 1] : undefined;
  const scribeNext =
    scribeStageIndex >= 0 && scribeStageIndex < SCRIBE_STAGES.length - 1
      ? SCRIBE_STAGES[scribeStageIndex + 1]
      : undefined;
  const roleBack = ROLE_BACK[currentRole];

  const stageHints: Record<string, string> = {};
  if (!registrationComplete) {
    stageHints.registration = registrationGaps.length
      ? `Missing: ${registrationGaps.join(", ")}`
      : "Select a patient to register.";
  }
  if (vitalsGaps.length > 0) stageHints["intake-vitals"] = `Missing: ${vitalsGaps.join(", ")}`;
  if (!hpiDone) stageHints.hpi = "Missing: the history of present illness";
  if (!examDone) stageHints["exam-ros"] = "Missing: the review of systems / exam";
  if (planGaps.length > 0) stageHints["assessment-plan"] = `Missing: ${planGaps.join(" and ")}`;
  if (!noteSigned) stageHints["sign-lock"] = "Missing: the signed and locked note";

  // This patient's encounter timeline — the append-only record of what has
  // actually happened to it, never a summary kept anywhere else.
  const encounterEvents = statusEventsFor(
    pipelineState.statusEvents,
    "encounter",
    encounterEventId(activePatientId),
  );

  console.log("render: selectedPatientId=", selectedPatientId, "selectedPatient=", selectedPatient?.firstName, selectedPatient?.lastName);

  // Safely load a patient — always clears loading state even on error
  const handlePatientSelect = (id: string) => {
    if (!id) return;
    saveNoteDraftNow();
    saveCurrentSession();
    const p = patients.find(p => p.id === id);
    if (!p) return;
    setSelectedPatientId(p.id);
    // Load this patient's own encounter — note, codes, claim and stage. Nothing
    // is reset: a patient already worked reopens at the furthest chart step they
    // reached, and a patient never visited starts blank at Intake / Vitals.
    selectPatient(p.id);
    setPatientDisplayName(null);
    setDisplayName(undefined);
    setActiveWorkspace("chart");
    toast(p.firstName + " " + p.lastName + " loaded");
  };

  /**
   * Picking an appointment is the same pick as the Patients list (owner,
   * 2026-11-21): the appointment's own patient goes through the shared pipeline
   * patient, so the banner, the stepper, every stage and a refresh all agree.
   * A legacy row with no patient record behind it says so rather than opening
   * somebody else's chart.
   */
  const handleSchedulePatientSelect = (patientId: string | null, name: string) => {
    const byId = patientId ? patients.find((p) => p.id === patientId) : undefined;
    const wanted = name.trim().toLowerCase();
    const byName = patients.find(
      (p) => `${p.firstName} ${p.lastName}`.trim().toLowerCase() === wanted,
    );
    const match = byId ?? byName;
    if (!match) {
      toast(`${name} has no patient record yet — register them with New Appointment first.`);
      return;
    }
    handlePatientSelect(match.id);
  };

  // ── Home work queues (TASK 1): open the stage that holds the work ──
  // Home's stages are workspace views rather than URLs, so a queue entry
  // navigates the way the patient list does: load that patient's own
  // encounter, switch to the role whose screen holds the work, show the chart.
  // Nothing is reset and nothing is written.
  const openMedicalStage = (patientId: string | null, role: Role) => {
    if (patientId && patients.some((p) => p.id === patientId)) {
      handlePatientSelect(patientId);
    } else {
      saveNoteDraftNow();
      saveCurrentSession();
      selectPatient(patientId);
    }
    setRole(role);
    setActiveWorkspace("chart");
    setActiveStage("");
  };

  /**
   * Home is a destination, not a no-op (spec `home-button-returns-home.md`).
   * Clicking it from the workspace closes the chart so the home screen — patient
   * list, work queues, InBasket — comes up with no patient open in front of it.
   * Navigation only: the note is flushed first, and the encounter keeps its
   * stage, codes, claim and postings, so reopening the patient returns to them.
   */
  const handleHomeClick = () => {
    // Home and the logo open the dashboard now (spec `slice-navigation.md` item
    // 2), so this no longer closes the chart: the encounter stays exactly where
    // the student left it — only Resume reopens it — and the note draft is
    // flushed on the way out so nothing typed is lost.
    saveNoteDraftNow();
    saveCurrentSession();
  };

  // Home is its own page now: the rail marks Home, and nothing on it pretends
  // to be Schedule or Patients any more.
  const shellActiveNav: ShellNavId = "home";
  return (
    <AppShell
      track={track}
      activeNav={shellActiveNav}
      onHomeClick={handleHomeClick}
      breadcrumb={[
        // On an encounter page the trail names the patient and the stage, not
        // the address (spec item 3).
        {
          label: selectedPatient
            ? `${selectedPatient.firstName} ${selectedPatient.lastName}`
            : displayName || "No patient open",
        },
        { label: flowStageLabel(flowStageId) },
      ]}
      selectedPatientId={selectedPatientId}
      onPatientSelect={handlePatientSelect}
      roleLabel={getRoleLabel(currentRole)}
      examMode={examMode}
      examTimeRemaining={examTimeRemaining}
      onToggleExamMode={toggleExamMode}
      topBarExtras={
        <button
          type="button"
          onClick={() => setShowRightPanel(!showRightPanel)}
          aria-label={showRightPanel ? "Hide patient summary panel" : "Show patient summary panel"}
          title={showRightPanel ? "Hide patient summary panel" : "Show patient summary panel"}
          aria-pressed={showRightPanel}
          className={`flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
            showRightPanel
              ? "bg-brand-600 text-white hover:bg-brand-500"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
          }`}
        >
          <PanelRightClose className="h-4 w-4" aria-hidden="true" />
          <span className="hidden xl:inline">Summary</span>
        </button>
      }
      banner={
        <PatientBanner
          patient={selectedPatient ?? null}
          fallbackName={displayName}
          copayUsd={postedCopayForPatient(appointments, selectedPatient?.id)?.copayUsd}
          patientBalance={
            pipelineState.ledger.length > 0
              ? ledgerBalance(pipelineState.ledger).patientBalanceCents / 100
              : undefined
          }
        />
      }
      leftPanel={
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-100 px-4 py-3">
            {/* The day's visits first, then every other patient — a patient
                registered through New Appointment is never missing from this
                list, whichever date the visit was booked for (audit item 3). */}
            <WorklistPanel
              patients={inboxPatients(patients, appointments, selectedScheduleDate)}
              selectedPatientId={selectedPatientId}
              onPatientSelect={handlePatientSelect}
            />
          </div>
          {selectedPatient && currentRole === "scribe" && (
            <div className="flex-1 overflow-y-auto p-4">
              {/* The inbox's "Workflow" stage list is gone (spec item 5): the
                  encounter stages live in the case runner's stepper, and Home
                  keeps the timeline that records what happened. */}
              <StatusTimeline
                className="mt-4"
                events={encounterEvents}
                title="Encounter timeline"
                subject={pipelineState.claimNumber}
                emptyHint="No status change yet — sign and lock the note to record the first one."
              />
            </div>
          )}
        </div>
      }
      rightPanel={
        <div className="flex h-full flex-col">
          <div className="flex-1 overflow-y-auto">
            <RightPaneleCW patient={selectedPatient ?? null} displayName={displayName} editableVitals={editableVitals} editablePatientData={editablePatientData} sharedImmunizations={sharedImmunizations} sharedLabs={sharedLabs} sharedReferrals={sharedReferrals} sharedOrders={sharedOrders} sharedImaging={sharedImaging} soapNote={soapNote} paRecords={paRecords} />
          </div>
          {currentRole !== "scribe" && (
            <div className="border-t border-slate-100 p-3">
              {hasFinancialActivity ? (
                <FinancialLedger totalBilled={billedTotal} totalCollected={pipelineState.status === "paid" ? billedTotal : 0} totalDenied={deniedTotal} daysInAR={0} />
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 p-3 text-center">
                  <p className="text-[10px] font-medium text-slate-400">No financial activity yet</p>
                  <p className="mt-0.5 text-[9px] text-slate-300">Complete Scribe → Coding → Billing to see claim KPIs here.</p>
                </div>
              )}
            </div>
          )}
        </div>
      }
      showRightPanel={showRightPanel}
      footer={
        <footer className="border-t border-slate-200 bg-white px-4 py-2 text-center text-xs text-slate-400">
          Healthcare Hustlers EHR Simulation — Built for healthcare education
        </footer>
      }
    >
      {/* ─── Home work queues — counted from the student's own records ─── */}
      {/* Work Queues live on Home and nowhere else (spec item 5). */}
      <HomeWorkQueues onOpenMedicalStage={openMedicalStage} />

      {/* ─── The workspace strip, as it was on 19 November (`f8fd8681`) ───
          Daily Schedule · Patient Chart Review · InBasket / Alert Center ·
          Active Progress Note. The window opens on Daily Schedule. */}
      <WorkspaceTabs
                    badges={{ inbasket: inBasketCount }} activeTab={activeWorkspace} onTabChange={setActiveWorkspace} />

      {/* ─── Daily Schedule ─── */}
      <WorkspacePanel id="schedule" activeWorkspace={activeWorkspace}>
        <DailySchedule
          onDateChange={setSelectedScheduleDate}
          onSelectPatient={handleSchedulePatientSelect}
        />
      </WorkspacePanel>

      {/* ─── Patient Chart Review ─── */}
      <WorkspacePanel id="chart" activeWorkspace={activeWorkspace}>
      {/* ─── The encounter's seven stages, in the owner's order ───
          Owner's audit, 2026-11-20, item 1: one persistent stepper at the top of
          the encounter — every stage, the current one highlighted, the finished
          ones ticked and clickable, numbered in the real order. */}
      {selectedPatient && (
        <EncounterStepper
          steps={ENCOUNTER_FLOW_STAGES.map((stage) => ({ id: stage.id, label: stage.label }))}
          currentId={flowStageId}
          furthestId={lastFlowStageId()}
          completedIds={completedFlow}
          numbered
          onSelect={openFlowStage}
          accent="blue"
          label="Encounter stages"
          meta={
            <div className="flex items-center gap-2">
              <span
                className={
                  noteSigned
                    ? "rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700"
                    : noteStatusNow === "draft"
                      ? "rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
                      : "rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500"
                }
              >
                {NOTE_STATUS_LABEL[noteStatusNow]}
              </span>
              <NoteSavedIndicator savedAt={lastNoteSavedAt} />
            </div>
          }
        />
      )}

      {/* One line at the top of every stage: the Tutorial Patient's chart is the
          standard reference and is read-only. Not a modal, not a banner over the
          stepper — it sits under it, in the 19 November type scale. */}
      {tutorialChartOpen && <TutorialReadOnlyNotice />}

      {/* ─── Role-Based Workspace ─── */}
      {selectedPatient && currentRole !== "scribe" ? (
        <FadeTransition key={`${selectedPatientId}-${currentRole}`} id={currentRole} className="flex flex-1 flex-col overflow-hidden">
          <fieldset
            disabled={tutorialChartOpen}
            aria-describedby={tutorialChartOpen ? TUTORIAL_NOTICE_ID : undefined}
            className="contents"
          >
          {currentRole === "coder" && (
            <CodingQueue medications={editablePatientData.medications} readOnly={tutorialChartOpen} />
          )}
          {currentRole === "biller" && (
            <BillingLedger openTab={billingTab} onOpenPayments={() => openFlowStage("payments")} />
          )}
          {currentRole === "prior-auth" && (
            <PriorAuthPortal readOnly={tutorialChartOpen} />
          )}
          {currentRole === "ar-voice" && (
            <div className="flex flex-1 flex-col overflow-y-auto">
              <div className="shrink-0 p-3">
                <ArWorkQueuePanel />
              </div>
              <div className="flex min-h-0 flex-1 flex-col">
                <ARVoiceSimulator />
              </div>
            </div>
          )}
          {pipelineState.stage === "complete" && (
            <div className="flex flex-1 flex-col items-center justify-center p-8">
              <div className="rounded-full bg-green-100 p-4">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              </div>
              <h3 className="mt-4 text-xl font-bold text-slate-800">Pipeline Complete!</h3>
              <p className="mt-2 text-sm text-slate-500">All stages have been completed. Great work!</p>
            </div>
          )}
          </fieldset>
          {/* Every stage carries Back and Continue to the next stage (owner's
              audit, item 1). Navigation only: no note, code, claim or posting is
              touched. The last stage's button ends the encounter. */}
          {pipelineState.stage !== "complete" && (
            <div className="shrink-0 border-t border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
              <StageNav
                back={
                  flowPrevious
                    ? { label: flowPrevious.label, onClick: () => openFlowStage(flowPrevious.id) }
                    : undefined
                }
                next={
                  flowNext
                    ? { label: flowNext.label, onClick: () => openFlowStage(flowNext.id) }
                    : onLastFlowStage
                      ? { label: "the encounter", onClick: completePipeline }
                      : undefined
                }
                forwardLabel={onLastFlowStage ? "End encounter" : undefined}
              />
            </div>
          )}
        </FadeTransition>
      ) : (
        <>{/* ─── Chart content (Scribe or no patient) ─── */}
      <FadeTransition id={selectedPatientId || "empty"} className="flex flex-1 flex-col overflow-hidden">
        {/* Skeleton loading on patient switch */}
        {isLoadingPatient ? (
          <div className="p-4 space-y-4">
            <Skeleton variant="card" />
            <Skeleton variant="card" />
            <Skeleton variant="card" />
          </div>
        ) : !selectedPatient ? (
          <div className="flex flex-1 items-center justify-center p-4">
            <div className="text-center">
              <Activity className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-3 text-lg font-medium text-slate-500">
                Select a patient to begin
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                Use the patient search bar in the header
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* ─── Patient Chart Review content ─── */}
            <div className="flex flex-1 flex-col overflow-hidden">
              {!selectedPatient ? (
                <div className="flex flex-1 items-center justify-center p-4">
                  <div className="text-center">
                    <Activity className="mx-auto h-12 w-12 text-slate-300" />
                    <h3 className="mt-3 text-lg font-medium text-slate-500">
                      Select a patient to begin chart review
                    </h3>
                    <p className="mt-1 text-sm text-slate-400">
                      Use the patient search bar in the header
                    </p>
                  </div>
                </div>
              ) : activeStage ? (
                <div className="flex flex-1 flex-col overflow-hidden">
                  {/* The whole visit, numbered, at the top of the workspace
                      (spec `encounter-continuity.md`). The step on screen is the
                      current one; the steps the record says are finished carry a
                      tick; Back / Next below walk one step at a time. */}
                  {/* The note's own sections, inside the Progress Note stage.
                      They are the five documentation steps — Sign & Lock is the
                      encounter's own stage 2 above, so it is not repeated here. */}
                  <EncounterStepper
                    steps={NOTE_SECTIONS.map((stage) => ({ id: stage.id, label: stage.label }))}
                    currentId={activeStage}
                    furthestId={lastEncounterStepId()}
                    completedIds={completedChartSteps}
                    onSelect={goToChartStage}
                    accent="blue"
                    label="Progress note sections"
                    meta={
                      <button
                        type="button"
                        onClick={() => setActiveStage("")}
                        aria-label="Show chart tabs"
                        className="min-h-10 rounded bg-brand-100 px-2.5 text-[10px] font-medium text-brand-700 hover:bg-brand-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                      >
                        Show Chart Tabs
                      </button>
                    }
                  />
                  <div className="flex-1 overflow-y-auto p-4 animate-slide-in" key={activeStage}>
                  <fieldset
                    disabled={tutorialChartOpen}
                    aria-describedby={tutorialChartOpen ? TUTORIAL_NOTICE_ID : undefined}
                    className="contents"
                  >
                    {activeStage === "registration" && (
                      <>
                        <RegistrationStage patientId={selectedPatientId} readOnly={tutorialChartOpen} />
                        {/* The 270/271 writes the stored record the banner reads,
                            so the Front Desk stage and the banner cannot disagree. */}
                        <div className="mt-4">
                          <EligibilityStage patientId={selectedPatientId} />
                        </div>
                      </>
                    )}
                    {activeStage === "intake-vitals" && (
                      <IntakeVitalsStage patientId={selectedPatientId} editableVitals={editableVitals} onVitalsChange={setEditableVitals} />
                    )}
                    {/* A signed note is read-only everywhere, so the three
                        sections that are the note lock with it. */}
                    <fieldset disabled={noteLocked} className="m-0 min-w-0 border-0 p-0">
                    {activeStage === "hpi" && (
                      <HPIStage
                        patientName={displayName || `${selectedPatient.firstName} ${selectedPatient.lastName}`}
                        chiefComplaint={editablePatientData.chiefComplaint || selectedPatient.chiefComplaint}
                        note={soapNote}
                        onNoteChange={setSoapNote}
                        vitals={noteVitals}
                      />
                    )}
                    {activeStage === "exam-ros" && (
                      <ExamROSStage
                        patientName={displayName || `${selectedPatient.firstName} ${selectedPatient.lastName}`}
                        note={soapNote}
                        onNoteChange={setSoapNote}
                        vitals={noteVitals}
                      />
                    )}
                    {activeStage === "assessment-plan" && (
                      <AssessmentPlanStage
                        patientName={displayName || `${selectedPatient.firstName} ${selectedPatient.lastName}`}
                        chiefComplaint={editablePatientData.chiefComplaint || selectedPatient.chiefComplaint}
                        note={soapNote}
                        onNoteChange={setSoapNote}
                        vitals={noteVitals}
                      />
                    )}
                    </fieldset>
                    {activeStage === "sign-lock" && !noteSigned && (
                      <SignLockStage
                        patientName={displayName || `${selectedPatient.firstName} ${selectedPatient.lastName}`}
                        note={soapNote}
                        onSignAndLock={handleSignAndLock}
                        isSubmitting={isSubmittingNote}
                        readOnly={tutorialChartOpen}
                      />
                    )}
                    </fieldset>
                    {activeStage === "sign-lock" && noteSigned && (
                      <div className="flex flex-col items-center justify-center py-12">
                        <div className="rounded-full bg-green-100 p-4">
                          <CheckCircle2 className="h-12 w-12 text-green-600" />
                        </div>
                        <h3 className="mt-4 text-xl font-bold text-slate-800">Note Submitted Successfully!</h3>
                        <p className="mt-2 max-w-md text-center text-sm text-slate-500">
                          The clinical note has been signed, locked, and submitted to the Coding queue.
                          The pipeline now advances to the Medical Coder stage for ICD-10 and CPT code extraction.
                        </p>
                        <div className="mt-6 flex flex-wrap justify-center gap-3">
                          <button
                            onClick={() => setActiveStage("")}
                            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                          >
                            Return to Chart Review
                          </button>
                          <button
                            onClick={() => setRole("coder")}
                            className="btn-primary"
                          >
                            Switch to Coder Role
                          </button>
                        </div>
                        {/* Pipeline complete shown above after all stages finish */}
                      </div>
                    )}
                    <StageNav
                      className="mt-6 border-t border-slate-200 pt-3"
                      back={
                        scribeBack
                          ? { label: scribeBack.label, onClick: () => goToChartStage(scribeBack.id) }
                          : undefined
                      }
                      next={
                        activeStage === "sign-lock"
                          ? { label: "Coding", onClick: () => openFlowStage("coding") }
                          : scribeNext
                            ? { label: scribeNext.label, onClick: () => goToChartStage(scribeNext.id) }
                            : undefined
                      }
                      nextDisabled={activeStage === "sign-lock" && !noteSigned}
                      nextDisabledReason="Sign and lock the note first — nothing can be coded off an unsigned note."
                    />
                  </div>
                </div>
              ) : (
                <>
                  <TabsEpic
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                  />
                  <div className="flex-1 overflow-y-auto p-4">
                    <fieldset
                      disabled={tutorialChartOpen}
                      aria-describedby={tutorialChartOpen ? TUTORIAL_NOTICE_ID : undefined}
                      className="contents"
                    >
                    <TabPanel id="summary" activeTab={activeTab}>
                      <SummaryTab
                        patientId={selectedPatientId}
                        editableVitals={editableVitals}
                        onVitalsChange={setEditableVitals}
                        editablePatientData={editablePatientData}
                        onPatientDataChange={setEditablePatientData}
                        newProblem={newProblem}
                        onNewProblemChange={setNewProblem}
                        immunizations={sharedImmunizations}
                        onImmunizationsChange={setSharedImmunizations}
                        labsResults={sharedLabs}
                        onLabsResultsChange={setSharedLabs}
                        referrals={sharedReferrals}
                        onReferralsChange={setSharedReferrals}
                        orders={sharedOrders}
                        onOrdersChange={setSharedOrders}
                        imaging={sharedImaging}
                        onImagingChange={setSharedImaging}
                      />
                    </TabPanel>
                    <TabPanel id="vitals" activeTab={activeTab}>
                      <VitalsTab patientId={selectedPatientId} editableVitals={editableVitals} onVitalsChange={setEditableVitals} />
                    </TabPanel>
                    <TabPanel id="medications" activeTab={activeTab}>
                      <MedicationsTab patientId={selectedPatientId} />
                    </TabPanel>
                    <TabPanel id="labs" activeTab={activeTab}>
                      <div className="clinical-card">
                        <p className="clinical-label mb-3">Labs & Results</p>
                        {(selectedPatient.labResults || []).length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="data-table">
                              <thead><tr><th>Test</th><th>Result</th><th>Reference</th><th>Flag</th><th>Status</th><th>Date</th></tr></thead>
                              <tbody>
                                {selectedPatient.labResults.map((lab) => (
                                  <tr key={lab.id}>
                                    <td className="font-medium">{lab.testName}</td>
                                    <td className="tabular-nums">{lab.value}{lab.unit ? ` ${lab.unit}` : ""}</td>
                                    <td className="text-slate-500">{lab.referenceRange || "—"}</td>
                                    <td><span className={labFlagMark(lab.status).className}>{labFlagMark(lab.status).mark}</span></td>
                                    <td><span className={labFlag(lab.status).className}>{labFlag(lab.status).label}</span></td>
                                    <td className="text-xs tabular-nums text-slate-500">{new Date(lab.date).toLocaleDateString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400 italic">No labs recorded.</p>
                        )}
                        {sharedLabs.length > 0 && (
                          <div className="mt-3">
                            <p className="section-header">Session results</p>
                            <div className="space-y-1">
                              {sharedLabs.map((o, i) => (
                                <div key={i} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">
                                  <span>{o}</span>
                                  {currentRole === "scribe" && (
                                    <button onClick={() => setSharedLabs(sharedLabs.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-[10px]" aria-label="Remove result">✕</button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {currentRole === "scribe" && (
                          <div className="mt-3 flex gap-1">
                            <input type="text" id="newLabInput" placeholder="e.g. CBC: WBC 6.5, Hgb 13.2" className="flex-1 rounded border border-dashed border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand-400" />
                            <button onClick={() => {
                              const inp = document.getElementById("newLabInput") as HTMLInputElement;
                              if (inp && inp.value.trim()) {
                                setSharedLabs([...sharedLabs, inp.value.trim()]);
                                inp.value = "";
                              }
                            }} className="rounded bg-brand-600 px-2 py-1 text-xs text-white hover:bg-brand-700">Add</button>
                          </div>
                        )}
                      </div>
                    </TabPanel>
                    <TabPanel id="problems" activeTab={activeTab}>
                      <div className="clinical-card">
                        <p className="clinical-label mb-3">Problem List</p>
                        {(selectedPatient.problems || []).length === 0 ? (
                          <p className="text-sm text-slate-400 italic">No problems on file.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="data-table">
                              <thead><tr><th>Problem</th><th>ICD-10</th><th>Status</th>{currentRole === "scribe" && <th></th>}</tr></thead>
                              <tbody>
                                {selectedPatient.problems.map((p, i) => {
                                  const { name, code } = parseProblem(p);
                                  return (
                                    <tr key={i}>
                                      <td className="font-medium">{name}</td>
                                      <td className="font-mono text-xs text-slate-500">{code || "—"}</td>
                                      <td><span className="status-badge is-info">Active</span></td>
                                      {currentRole === "scribe" && (
                                        <td className="text-right">
                                          <button onClick={() => {
                                            const updated = editablePatientData.problems.filter((_, j) => j !== i);
                                            setEditablePatientData({ ...editablePatientData, problems: updated });
                                          }} className="text-red-400 hover:text-red-600 text-[10px]" aria-label="Remove problem">✕</button>
                                        </td>
                                      )}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                        {currentRole === "scribe" && (
                          <div className="mt-2 flex gap-1">
                            <input
                              type="text"
                              value={newProblem}
                              onChange={e => setNewProblem(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter" && newProblem.trim()) { setEditablePatientData({ ...editablePatientData, problems: [...editablePatientData.problems, newProblem.trim()] }); setNewProblem(""); }}}
                              placeholder="+ Add new problem (e.g. Diabetes (E11.9))..."
                              className="flex-1 rounded border border-dashed border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand-400"
                            />
                            <button onClick={() => { if (newProblem.trim()) { setEditablePatientData({ ...editablePatientData, problems: [...editablePatientData.problems, newProblem.trim()] }); setNewProblem(""); }}} className="rounded bg-brand-500 px-2 py-1 text-xs text-white hover:bg-brand-600">Add</button>
                          </div>
                        )}
                      </div>
                    </TabPanel>
                    <TabPanel id="orders" activeTab={activeTab}>
                      <div className="clinical-card">
                        <p className="clinical-label mb-3">Active Orders</p>

                        {/* ── PA Required Alert ── */}
                        {(() => {
                          const paProcedures = Object.values(PA_PROCEDURES).map(p => p.label.toLowerCase());
                          const matchingOrders = sharedOrders.filter(o =>
                            paProcedures.some(p => o.item.toLowerCase().includes(p) || p.includes(o.item.toLowerCase()))
                          );
                          if (matchingOrders.length > 0) {
                            return (
                              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                                <div className="flex items-start gap-2">
                                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                  <div>
                                    <p className="text-[11px] font-semibold text-amber-800">⚠ Prior Authorization Required</p>
                                    <p className="mt-0.5 text-[10px] text-amber-700">
                                      {matchingOrders.map(o => `"${o.item}"`).join(", ")} requires prior authorization before the procedure can be performed. 
                                      Please complete the Prior Auth form in the Prior Auth stage.
                                    </p>
                                    <button
                                      onClick={() => setRole("prior-auth")}
                                      className="mt-2 rounded bg-brand-800 px-3 py-1 text-[10px] font-medium text-white hover:bg-brand-900 transition-colors"
                                    >
                                      Submit Prior Auth
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}

                        {sharedOrders.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="data-table">
                              <thead><tr><th>Order</th><th>Status</th><th>Provider</th><th>Date</th>{currentRole === "scribe" && <th></th>}</tr></thead>
                              <tbody>
                                {sharedOrders.map((o) => (
                                  <tr key={o.id}>
                                    <td className="font-medium">{o.item}</td>
                                    <td><span className={entryStatusClass(o.status)}>{o.status}</span></td>
                                    <td className="text-slate-600">{o.provider}</td>
                                    <td className="text-xs tabular-nums text-slate-500">{o.date}</td>
                                    {currentRole === "scribe" && (
                                      <td className="text-right"><button onClick={() => setSharedOrders(sharedOrders.filter(x => x.id !== o.id))} className="text-red-400 hover:text-red-600 text-[10px]" aria-label="Remove order">✕</button></td>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400 italic">No active orders.</p>
                        )}
                        {currentRole === "scribe" && (
                          <div className="mt-3 rounded border border-dashed border-slate-300 p-2">
                            <div className="grid grid-cols-3 gap-1">
                              <input type="text" id="newOrderItem" placeholder="Order (e.g. CBC)" className="rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand-400" />
                              <select id="newOrderStatus" className="rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand-400">
                                <option>Ordered</option><option>Pending</option><option>Completed</option>
                              </select>
                              <input type="date" id="newOrderDate" className="rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand-400" />
                            </div>
                            <button onClick={() => {
                              const itemEl = document.getElementById("newOrderItem") as HTMLInputElement;
                              const statusEl = document.getElementById("newOrderStatus") as HTMLSelectElement;
                              const dateEl = document.getElementById("newOrderDate") as HTMLInputElement;
                              if (itemEl && itemEl.value.trim()) {
                                setSharedOrders([...sharedOrders, {
                                  id: `ord-${Date.now()}`,
                                  item: itemEl.value.trim(),
                                  status: (statusEl?.value || "Ordered") as OrderEntry["status"],
                                  provider: selectedPatient.primaryCareProvider,
                                  date: dateEl?.value || new Date().toISOString().split("T")[0],
                                }]);
                                itemEl.value = "";
                              }
                            }} className="mt-2 rounded bg-brand-600 px-3 py-1 text-xs text-white hover:bg-brand-700">+ Add Order</button>
                          </div>
                        )}
                      </div>
                    </TabPanel>
                    <TabPanel id="notes" activeTab={activeTab}>
                      <div className="clinical-card">
                        <p className="clinical-label mb-3">Visit History</p>
                        {(selectedPatient.encounters || []).length === 0 ? (
                          <p className="text-sm text-slate-400 italic">No prior visits recorded.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="data-table">
                              <thead><tr><th>Date</th><th>Type</th><th>Provider</th><th>Department</th><th>Diagnosis</th></tr></thead>
                              <tbody>
                                {(selectedPatient.encounters || []).map((enc) => (
                                  <tr key={enc.id}>
                                    <td className="text-xs tabular-nums text-slate-500">{new Date(enc.date).toLocaleDateString()}</td>
                                    <td className="font-medium">{enc.type}</td>
                                    <td className="text-slate-600">{enc.provider}</td>
                                    <td className="text-slate-600">{enc.department}</td>
                                    <td className="max-w-xs truncate text-slate-700">{enc.diagnosis}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        <p className="section-header mt-3">Clinical Notes</p>
                        <div className="mt-1 space-y-2">
                          {(selectedPatient.encounters || []).map((enc) => (
                            <div key={enc.id} className="rounded border border-slate-200 p-3">
                              <p className="text-xs text-slate-500">{new Date(enc.date).toLocaleDateString()} — {enc.type}</p>
                              <p className="mt-1 text-sm text-slate-700">{enc.notes}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </TabPanel>
                    <TabPanel id="imaging" activeTab={activeTab}>
                      <div className="clinical-card">
                        <p className="clinical-label mb-3">Imaging Studies</p>
                        {sharedImaging.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="data-table">
                              <thead><tr><th>Study</th><th>Status</th><th>Date</th>{currentRole === "scribe" && <th></th>}</tr></thead>
                              <tbody>
                                {sharedImaging.map((o) => (
                                  <tr key={o.id}>
                                    <td className="font-medium">{o.study}</td>
                                    <td><span className={entryStatusClass(o.status)}>{o.status}</span></td>
                                    <td className="text-xs tabular-nums text-slate-500">{o.date}</td>
                                    {currentRole === "scribe" && (
                                      <td className="text-right"><button onClick={() => setSharedImaging(sharedImaging.filter(x => x.id !== o.id))} className="text-red-400 hover:text-red-600 text-[10px]" aria-label="Remove study">✕</button></td>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400 italic">No imaging studies ordered.</p>
                        )}
                        {currentRole === "scribe" && (
                          <div className="mt-3 rounded border border-dashed border-slate-300 p-2">
                            <div className="grid grid-cols-3 gap-1">
                              <input type="text" id="newImagingStudy" placeholder="Study (e.g. Chest X-ray)" className="rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand-400" />
                              <select id="newImagingStatus" className="rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand-400">
                                <option>Ordered</option><option>Scheduled</option><option>Completed</option><option>Resulted</option>
                              </select>
                              <input type="date" id="newImagingDate" className="rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand-400" />
                            </div>
                            <button onClick={() => {
                              const studyEl = document.getElementById("newImagingStudy") as HTMLInputElement;
                              const statusEl = document.getElementById("newImagingStatus") as HTMLSelectElement;
                              const dateEl = document.getElementById("newImagingDate") as HTMLInputElement;
                              if (studyEl && studyEl.value.trim()) {
                                setSharedImaging([...sharedImaging, {
                                  id: `img-${Date.now()}`,
                                  study: studyEl.value.trim(),
                                  status: (statusEl?.value || "Ordered") as ImagingEntry["status"],
                                  date: dateEl?.value || new Date().toISOString().split("T")[0],
                                }]);
                                studyEl.value = "";
                              }
                            }} className="mt-2 rounded bg-brand-600 px-3 py-1 text-xs text-white hover:bg-brand-700">+ Add Study</button>
                          </div>
                        )}
                      </div>
                    </TabPanel>
                    <TabPanel id="immunizations" activeTab={activeTab}>
                      <div className="clinical-card">
                        <p className="clinical-label mb-3">Immunizations</p>
                        {sharedImmunizations.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="data-table">
                              <thead><tr><th>Vaccine</th><th>Dose</th><th>Date</th><th>Status</th>{currentRole === "scribe" && <th></th>}</tr></thead>
                              <tbody>
                                {sharedImmunizations.map((o) => (
                                  <tr key={o.id}>
                                    <td className="font-medium">{o.vaccine}</td>
                                    <td className="text-slate-600">{o.dose}</td>
                                    <td className="text-xs tabular-nums text-slate-500">{o.date}</td>
                                    <td><span className={entryStatusClass(o.status)}>{o.status}</span></td>
                                    {currentRole === "scribe" && (
                                      <td className="text-right"><button onClick={() => setSharedImmunizations(sharedImmunizations.filter(x => x.id !== o.id))} className="text-red-400 hover:text-red-600 text-[10px]" aria-label="Remove immunization">✕</button></td>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400 italic">No immunizations recorded.</p>
                        )}
                        {currentRole === "scribe" && (
                          <div className="mt-3 rounded border border-dashed border-slate-300 p-2">
                            <div className="grid grid-cols-3 gap-1">
                              <input type="text" id="newImmunVaccine" placeholder="Vaccine (e.g. Influenza)" className="rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand-400" />
                              <input type="text" id="newImmunDose" placeholder="Dose (e.g. 0.5 mL)" className="rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand-400" />
                              <input type="date" id="newImmunDate" className="rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand-400" />
                            </div>
                            <button onClick={() => {
                              const vaccineEl = document.getElementById("newImmunVaccine") as HTMLInputElement;
                              const doseEl = document.getElementById("newImmunDose") as HTMLInputElement;
                              const dateEl = document.getElementById("newImmunDate") as HTMLInputElement;
                              if (vaccineEl && vaccineEl.value.trim()) {
                                setSharedImmunizations([...sharedImmunizations, {
                                  id: `imm-${Date.now()}`,
                                  vaccine: vaccineEl.value.trim(),
                                  dose: doseEl?.value.trim() || "—",
                                  date: dateEl?.value || new Date().toISOString().split("T")[0],
                                  status: "Given",
                                }]);
                                vaccineEl.value = "";
                              }
                            }} className="mt-2 rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700">+ Add Immunization</button>
                          </div>
                        )}
                      </div>
                    </TabPanel>
                    <TabPanel id="referrals" activeTab={activeTab}>
                      <div className="clinical-card">
                        <p className="clinical-label mb-3">Referrals</p>
                        {sharedReferrals.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="data-table">
                              <thead><tr><th>Specialty</th><th>Reason</th><th>Status</th><th>Date</th>{currentRole === "scribe" && <th></th>}</tr></thead>
                              <tbody>
                                {sharedReferrals.map((o) => (
                                  <tr key={o.id}>
                                    <td className="font-medium">{o.specialty}</td>
                                    <td className="text-slate-600">{o.reason}</td>
                                    <td><span className={entryStatusClass(o.status)}>{o.status}</span></td>
                                    <td className="text-xs tabular-nums text-slate-500">{o.date}</td>
                                    {currentRole === "scribe" && (
                                      <td className="text-right"><button onClick={() => setSharedReferrals(sharedReferrals.filter(x => x.id !== o.id))} className="text-red-400 hover:text-red-600 text-[10px]" aria-label="Remove referral">✕</button></td>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400 italic">No referrals recorded.</p>
                        )}
                        {currentRole === "scribe" && (
                          <div className="mt-3 rounded border border-dashed border-slate-300 p-2">
                            <div className="grid grid-cols-3 gap-1">
                              <input type="text" id="newRefSpecialty" placeholder="Specialty (e.g. Cardiology)" className="rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand-400" />
                              <input type="text" id="newRefReason" placeholder="Reason" className="rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand-400" />
                              <select id="newRefStatus" className="rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand-400">
                                <option>Sent</option><option>Scheduled</option><option>Completed</option>
                              </select>
                            </div>
                            <button onClick={() => {
                              const specEl = document.getElementById("newRefSpecialty") as HTMLInputElement;
                              const reasonEl = document.getElementById("newRefReason") as HTMLInputElement;
                              const statusEl = document.getElementById("newRefStatus") as HTMLSelectElement;
                              if (specEl && specEl.value.trim()) {
                                setSharedReferrals([...sharedReferrals, {
                                  id: `ref-${Date.now()}`,
                                  specialty: specEl.value.trim(),
                                  reason: reasonEl?.value.trim() || "—",
                                  status: (statusEl?.value || "Sent") as ReferralEntry["status"],
                                  date: new Date().toISOString().split("T")[0],
                                }]);
                                specEl.value = "";
                              }
                            }} className="mt-2 rounded bg-brand-600 px-3 py-1 text-xs text-white hover:bg-brand-700">+ Add Referral</button>
                          </div>
                        )}
                      </div>
                    </TabPanel>
                    </fieldset>
                  </div>
                </>
              )}
            </div>

          </>
        )}
      </FadeTransition>
      </>
    )}
      </WorkspacePanel>

      {/* ─── InBasket / Alert Center — the student's own outstanding work ─── */}
      <WorkspacePanel id="inbasket" activeWorkspace={activeWorkspace}>
        <InBasket onOpenMedicalStage={openMedicalStage} />
      </WorkspacePanel>

      {/* ─── Active Progress Note — the encounter's one note record ─── */}
      <WorkspacePanel id="note" activeWorkspace={activeWorkspace}>
        <ActiveProgressNote patient={selectedPatient ?? null} />
      </WorkspacePanel>

      {/* Command Palette — Cmd+K */}
      <CommandPalette
        onSelectRole={(role) => setRole(role)}
        onSelectPatient={(pid) => setSelectedPatientId(pid)}
      />
    </AppShell>
  );
}