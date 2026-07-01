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

import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, ArrowRight } from "lucide-react";

import { PatientProvider, usePatientStore } from "../store/patientStore";
import { PipelineProvider, usePipeline } from "../store/pipelineStore";
import { isLoggedIn } from "../store/accessStore";
import { WorkflowTracker } from "../components/WorkflowTracker";
import { TabsEpic, TabPanel, useTabsEpic } from "../components/TabsEpic/TabsEpic";
import { Header } from "../components/TabsEpic/Header";
import { RightPaneleCW } from "../components/RightPaneleCW/RightPaneleCW";
import { WorkflowAthena } from "../components/WorkflowAthena/WorkflowAthena";
import { IntakeVitalsStage } from "../components/WorkflowAthena/IntakeVitalsStage";
import { HPIStage } from "../components/WorkflowAthena/HPIStage";
import { ExamROSStage } from "../components/WorkflowAthena/ExamROSStage";
import { AssessmentPlanStage } from "../components/WorkflowAthena/AssessmentPlanStage";
import { SignLockStage } from "../components/WorkflowAthena/SignLockStage";
import { AppShell } from "../components/AppShell";
import {
  WorkspaceTabs,
  WorkspacePanel,
  useWorkspaceTabs,
} from "../components/TabsEpic/WorkspaceTabs";
import { DailySchedule } from "../components/TabsEpic/DailySchedule";
import { InBasket } from "../components/TabsEpic/InBasket";
import { ActiveProgressNote } from "../components/TabsEpic/ActiveProgressNote";
import { ChartSearch } from "../components/TabsEpic/ChartSearch";
import ARVoiceSimulator from "../components/ARVoiceSimulator/ARVoiceSimulator";
import { StagePinGate } from "../components/StagePinGate";
import { CodingQueue } from "../components/CodingQueue/CodingQueue";
import { BillingLedger } from "../components/BillingLedger/BillingLedger";
import PriorAuthPortal from "../components/PriorAuthPortal/PriorAuthPortal";

// ─── Route ──────────────────────────────────────────────────────────

export const Route = createFileRoute("/")({
  component: () => (
    <PatientProvider>
      <PipelineProvider>
        <Home />
      </PipelineProvider>
    </PatientProvider>
  ),
});

// ─── Tab Content Components ────────────────────────────────────────

function SummaryTab({ patientId }: { patientId: string }) {
  const { getPatientById } = usePatientStore();
  const patient = getPatientById(patientId);

  if (!patient) return <p className="text-slate-400">Patient not found</p>;

  return (
    <div className="space-y-4">
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
              PCP: {patient.primaryCareProvider} | {patient.insurance}
            </p>
          </div>
          <span className="rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
            {patient.chiefComplaint}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="clinical-card">
          <p className="clinical-label">BP</p>
          <p className="clinical-value">{patient.vitals.bloodPressure}</p>
        </div>
        <div className="clinical-card">
          <p className="clinical-label">HR</p>
          <p className="clinical-value">{patient.vitals.heartRate} bpm</p>
        </div>
        <div className="clinical-card">
          <p className="clinical-label">Temp</p>
          <p className="clinical-value">{patient.vitals.temperature}°F</p>
        </div>
        <div className="clinical-card">
          <p className="clinical-label">SpO2</p>
          <p className="clinical-value">{patient.vitals.oxygenSaturation}%</p>
        </div>
      </div>

      <div className="clinical-card">
        <p className="clinical-label mb-2">Active Problems</p>
        <div className="flex flex-wrap gap-2">
          {patient.problems.map((p, i) => (
            <span key={i} className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-800">
              {p}
            </span>
          ))}
        </div>
      </div>

      <div className="clinical-card">
        <p className="clinical-label mb-2">Recent Encounters</p>
        <table className="clinical-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Provider</th>
              <th>Diagnosis</th>
            </tr>
          </thead>
          <tbody>
            {patient.encounters.slice(0, 3).map((enc) => (
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
  );
}

function MedicationsTab({ patientId }: { patientId: string }) {
  const { getPatientById } = usePatientStore();
  const patient = getPatientById(patientId);
  if (!patient) return null;

  return (
    <div className="clinical-card">
      <p className="clinical-label mb-3">Medication List</p>
      <table className="clinical-table">
        <thead>
          <tr>
            <th>Medication</th>
            <th>Dosage</th>
            <th>Frequency</th>
            <th>Route</th>
            <th>Status</th>
            <th>Prescribed</th>
          </tr>
        </thead>
        <tbody>
          {patient.medications.map((med) => (
            <tr key={med.id}>
              <td className="font-medium">{med.name}</td>
              <td>{med.dosage}</td>
              <td>{med.frequency}</td>
              <td>{med.route}</td>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VitalsTab({ patientId }: { patientId: string }) {
  const { getPatientById } = usePatientStore();
  const patient = getPatientById(patientId);
  if (!patient) return null;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="clinical-card col-span-2">
        <p className="clinical-label mb-3">Vital Signs</p>
        <table className="clinical-table">
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
              <td className="font-medium">{patient.vitals.bloodPressure} mmHg</td>
              <td><span className="badge-abnormal">Elevated</span></td>
            </tr>
            <tr>
              <td>Heart Rate</td>
              <td className="font-medium">{patient.vitals.heartRate} bpm</td>
              <td><span className="badge-normal">Normal</span></td>
            </tr>
            <tr>
              <td>Temperature</td>
              <td className="font-medium">{patient.vitals.temperature} °F</td>
              <td><span className="badge-normal">Normal</span></td>
            </tr>
            <tr>
              <td>Respiratory Rate</td>
              <td className="font-medium">{patient.vitals.respiratoryRate} /min</td>
              <td><span className="badge-normal">Normal</span></td>
            </tr>
            <tr>
              <td>Oxygen Saturation</td>
              <td className="font-medium">{patient.vitals.oxygenSaturation}%</td>
              <td>
                {patient.vitals.oxygenSaturation >= 95
                  ? <span className="badge-normal">Normal</span>
                  : <span className="badge-abnormal">Low</span>
                }
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="clinical-card">
        <p className="clinical-label mb-2">Recorded</p>
        <p className="text-sm text-slate-600">
          {new Date(patient.vitals.recordedAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

function LabsTab({ patientId }: { patientId: string }) {
  const { getPatientById } = usePatientStore();
  const patient = getPatientById(patientId);
  if (!patient) return null;

  return (
    <div className="clinical-card">
      <p className="clinical-label mb-3">Lab Results</p>
      <table className="clinical-table">
        <thead>
          <tr>
            <th>Test</th>
            <th>Value</th>
            <th>Unit</th>
            <th>Reference Range</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {patient.labResults.map((lab) => (
            <tr key={lab.id}>
              <td className="font-medium">{lab.testName}</td>
              <td>{lab.value}</td>
              <td className="text-xs text-slate-500">{lab.unit}</td>
              <td className="text-xs text-slate-500">{lab.referenceRange}</td>
              <td>
                <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                  lab.status === "normal"
                    ? "bg-green-100 text-green-700"
                    : lab.status === "abnormal"
                      ? "bg-amber-100 text-amber-700"
                      : lab.status === "critical"
                        ? "bg-red-100 text-red-700"
                        : "bg-slate-100 text-slate-500"
                }`}>
                  {lab.status}
                </span>
              </td>
              <td className="text-xs text-slate-500">
                {new Date(lab.date).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Public Landing Page (when not logged in) ──────────────────────

function PublicLandingPage() {
  return (
    <div className="min-h-dvh bg-gradient-to-br from-sky-50 to-blue-100">
      {/* Nav */}
      <nav className="flex items-center justify-between border-b border-sky-200 bg-white/80 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <img
            src="/healthcarehustlers-logo.png"
            alt="Healthcare Hustlers"
            className="h-7 w-auto"
            style={{ maxWidth: "160px" }}
          />
        </div>
        <nav className="flex items-center gap-2 text-xs">
          <Link to="/login" className="rounded-lg border border-sky-200 px-3 py-1.5 font-medium text-sky-600 hover:bg-sky-50">
            Student Login
          </Link>
          <Link to="/admin" className="rounded-lg bg-sky-500 px-3 py-1.5 font-medium text-white hover:bg-sky-600">
            Admin Panel
          </Link>
        </nav>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-4 py-16 text-center">
        <div className="mx-auto mb-6 flex items-center justify-center">
          <img
            src="/healthcarehustlers-logo.png"
            alt="Healthcare Hustlers"
            className="h-16 w-auto md:h-20"
          />
        </div>
        <h1 className="text-4xl font-bold text-slate-800 md:text-5xl">
          EHR & RCM Simulation Portal
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-500">
          Master the complete patient encounter lifecycle — from clinical charting to claim payment.
          Practice as a <strong>Scribe</strong>, <strong>Medical Coder</strong>, <strong>Biller</strong>,
          <strong> Prior Auth Specialist</strong>, and <strong>AR Voice Agent</strong> in one unified simulation.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/access"
            className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-sky-600"
          >
            Enroll Now — $1
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-white px-6 py-3 text-sm font-semibold text-sky-600 hover:bg-sky-50"
          >
            Student Login
          </Link>
        </div>
      </section>

      {/* Pipeline Features — 5 Stages */}
      <section className="mx-auto max-w-5xl px-4 pb-8">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold text-slate-700">The 5-Stage RCM Pipeline</h2>
          <p className="mt-2 text-sm text-slate-400">Follow a patient encounter from exam room to final payment</p>
        </div>

        {/* Pipeline Flow Visual */}
        <div className="mb-8 flex items-center justify-center gap-1 overflow-x-auto rounded-xl bg-white p-4 shadow-sm">
          {["📋 Scribe", "🔍 Coder", "💰 Biller", "📄 Prior Auth", "📞 AR Voice"].map((stage, i) => (
            <div key={stage} className="flex items-center gap-1">
              <div className="whitespace-nowrap rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700">
                {stage}
              </div>
              {i < 4 && <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" />}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              stage: "STAGE 1",
              title: "Scribe — Clinical Charting",
              desc: "Write structured SOAP notes with one-click macros. Capture vitals, HPI, exam findings, and assessment plans. Submit to the coding queue.",
              icon: "📋",
              color: "bg-blue-50 border-blue-200",
              tag: "Epic + DrChrono",
            },
            {
              stage: "STAGE 2",
              title: "Coder — ICD-10 & CPT Assignment",
              desc: "Review the clinical note and extract diagnoses and procedures. Search a built-in code repository and assign the correct ICD-10-CM and CPT codes.",
              icon: "🔍",
              color: "bg-indigo-50 border-indigo-200",
              tag: "ICD-10 / CPT",
            },
            {
              stage: "STAGE 3",
              title: "Biller — Claim Scrubbing",
              desc: "Audit CMS-1500 claims for errors. Submit to clearinghouse and face real-world outcomes: get paid instantly or receive a denial code to resolve.",
              icon: "💰",
              color: "bg-violet-50 border-violet-200",
              tag: "CMS-1500",
            },
            {
              stage: "STAGE 4",
              title: "Prior Auth — Authorization Hub",
              desc: "Handle high-cost procedures requiring pre-approval. Map clinical documentation to insurance policy criteria and submit digital PA forms.",
              icon: "📄",
              color: "bg-purple-50 border-purple-200",
              tag: "PA Portal",
            },
            {
              stage: "STAGE 5",
              title: "AR Voice — Phone Follow-up",
              desc: "Call insurance representatives to dispute denied claims. Practice accent clarity with an AI-powered voice simulator that responds like a real US-based agent.",
              icon: "📞",
              color: "bg-rose-50 border-rose-200",
              tag: "AI Voice",
            },
            {
              stage: "BONUS",
              title: "Denial Simulation Matrix",
              desc: "Experience randomized claim outcomes. Resolve CO-16, CO-50, CO-119 denials through correction, documentation, or voice negotiation.",
              icon: "🎲",
              color: "bg-amber-50 border-amber-200",
              tag: "Path A / Path B",
            },
          ].map((feat) => (
            <div key={feat.title} className={`rounded-xl border-2 p-5 ${feat.color} transition-shadow hover:shadow-md`}>
              <div className="flex items-start justify-between">
                <span className="text-2xl">{feat.icon}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500 shadow-sm">
                  {feat.tag}
                </span>
              </div>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{feat.stage}</p>
              <h3 className="mt-1 font-semibold text-slate-800">{feat.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-white py-12">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="text-2xl font-bold text-slate-700">Get Started in 4 Steps</h2>
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-4">
            {[
              { n: "1", title: "Pay $1", desc: "via Bank Islami, EasyPaisa, or PayPal" },
              { n: "2", title: "Submit Request", desc: "Fill form with your transaction ID" },
              { n: "3", title: "Get Approved", desc: "Admin activates your account" },
              { n: "4", title: "Practice!", desc: "Log in with your phone number and start the pipeline" },
            ].map((step) => (
              <div key={step.n} className="rounded-xl border border-slate-200 p-4">
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-lg font-bold text-sky-600">
                  {step.n}
                </div>
                <h3 className="font-semibold text-slate-700">{step.title}</h3>
                <p className="mt-1 text-xs text-slate-400">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-sky-200 bg-white/60 px-4 py-6 text-center text-xs text-slate-400">
        www.healthcarehustlers.org — Healthcare Hustlers EHR Simulation Portal
      </footer>
    </div>
  );
}

// ─── Main Layout ───────────────────────────────────────────────────

function Home() {
  const businessName = "Healthcare Hustlers";
  const { patients } = usePatientStore();
  const { activeTab, setActiveTab } = useTabsEpic("summary");
  const { activeWorkspace, setActiveWorkspace } = useWorkspaceTabs("chart");
  const [selectedPatientId, setSelectedPatientId] = useState(patients[0]?.id ?? "");
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const { currentRole } = usePipeline();
  const [activeStage, setActiveStage] = useState("intake-vitals");
  const [completedStages, setCompletedStages] = useState<Set<string>>(new Set(["intake-vitals"]));

  // Check login on mount
  useEffect(() => {
    setCheckingAuth(false);
  }, []);

  // Show public landing page while checking or if not logged in
  if (checkingAuth) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50">
        <div className="text-center">
          <Activity className="mx-auto h-8 w-8 animate-pulse text-sky-500" />
          <p className="mt-3 text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn()) {
    return <PublicLandingPage />;
  }

  const toggleStageComplete = (stageId: string) => {
    const updated = new Set(completedStages);
    if (updated.has(stageId)) {
      updated.delete(stageId);
    } else {
      updated.add(stageId);
      // Auto-advance to next stage
      const stageOrder = ["intake-vitals", "hpi", "exam-ros", "assessment-plan", "sign-lock"];
      const currentIdx = stageOrder.indexOf(stageId);
      if (currentIdx >= 0 && currentIdx < stageOrder.length - 1) {
        setActiveStage(stageOrder[currentIdx + 1]);
      }
    }
    setCompletedStages(updated);
  };

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  return (
    <AppShell
      header={
        <Header
          businessName={businessName}
          selectedPatientId={selectedPatientId}
          onPatientSelect={setSelectedPatientId}
          showRightPanel={showRightPanel}
          onToggleRightPanel={() => setShowRightPanel(!showRightPanel)}
          selectedPatientName={
            selectedPatient
              ? `${selectedPatient.lastName}, ${selectedPatient.firstName}`
              : undefined
          }
        />
      }
      leftPanel={
        selectedPatient && currentRole === "scribe" ? (
          <div className="p-4">
            <WorkflowAthena
              activeStage={activeStage}
              onStageSelect={setActiveStage}
              completedStages={completedStages}
              onToggleStageComplete={toggleStageComplete}
            />
          </div>
        ) : undefined
      }
      rightPanel={
        <RightPaneleCW patient={selectedPatient ?? null} />
      }
      showRightPanel={showRightPanel}
      footer={
        <footer className="border-t border-slate-200 bg-white px-4 py-2 text-center text-xs text-slate-400">
          Healthcare Hustlers EHR Simulation — Built for healthcare education
        </footer>
      }
    >
      {/* ─── Workflow Tracker (always visible) ─── */}
      {selectedPatient && <WorkflowTracker encounterId={selectedPatientId} />}

      {/* ─── Role-Based Workspace ─── */}
      {selectedPatient && currentRole !== "scribe" ? (
        <div className="flex flex-1 flex-col overflow-hidden">
          {currentRole === "coder" && (
            <StagePinGate role="coder" roleLabel="Medical Coder">
              <CodingQueue />
            </StagePinGate>
          )}
          {currentRole === "biller" && (
            <StagePinGate role="biller" roleLabel="Medical Biller">
              <BillingLedger />
            </StagePinGate>
          )}
          {currentRole === "prior-auth" && (
            <StagePinGate role="prior-auth" roleLabel="Prior Authorization">
              <PriorAuthPortal />
            </StagePinGate>
          )}
          {currentRole === "ar-voice" && (
            <StagePinGate role="ar-voice" roleLabel="AR Voice Specialist">
              <ARVoiceSimulator />
            </StagePinGate>
          )}
        </div>
      ) : (
        <>{/* ─── Workspace Tabs + Content (Scribe or no patient) ─── */}
          <WorkspaceTabs
            activeTab={activeWorkspace}
            onTabChange={setActiveWorkspace}
            chartSearch={
              <ChartSearch patientId={selectedPatientId} />
            }
          />

      {/* ─── Workspace Content ─── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Empty state — no patient selected */}
        {!selectedPatient && activeWorkspace !== "schedule" ? (
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
            {/* ─── Daily Schedule ─── */}
            <WorkspacePanel id="schedule" activeWorkspace={activeWorkspace}>
              <DailySchedule />
            </WorkspacePanel>

            {/* ─── Patient Chart Review ─── */}
            <WorkspacePanel id="chart" activeWorkspace={activeWorkspace}>
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
                  <div className="border-b border-blue-100 bg-blue-50/50 px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-blue-700">
                        Workflow: {activeStage === "intake-vitals" ? "Intake / Vitals" :
                                    activeStage === "hpi" ? "History of Present Illness" :
                                    activeStage === "exam-ros" ? "Review of Systems" :
                                    activeStage === "assessment-plan" ? "Assessment & Plan" :
                                    "Sign & Lock Note"}
                      </span>
                      <button
                        onClick={() => setActiveStage("")}
                        className="ml-auto rounded bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 hover:bg-blue-200"
                      >
                        Show Chart Tabs
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    {activeStage === "intake-vitals" && (
                      <IntakeVitalsStage patientId={selectedPatientId} />
                    )}
                    {activeStage === "hpi" && (
                      <HPIStage
                        patientName={`${selectedPatient.firstName} ${selectedPatient.lastName}`}
                        chiefComplaint={selectedPatient.chiefComplaint}
                      />
                    )}
                    {activeStage === "exam-ros" && (
                      <ExamROSStage
                        patientName={`${selectedPatient.firstName} ${selectedPatient.lastName}`}
                      />
                    )}
                    {activeStage === "assessment-plan" && (
                      <AssessmentPlanStage
                        patientName={`${selectedPatient.firstName} ${selectedPatient.lastName}`}
                      />
                    )}
                    {activeStage === "sign-lock" && (
                      <SignLockStage
                        patientName={`${selectedPatient.firstName} ${selectedPatient.lastName}`}
                      />
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <TabsEpic
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                  />
                  <div className="flex-1 overflow-y-auto p-4">
                    <TabPanel id="summary" activeTab={activeTab}>
                      <SummaryTab patientId={selectedPatientId} />
                    </TabPanel>
                    <TabPanel id="vitals" activeTab={activeTab}>
                      <VitalsTab patientId={selectedPatientId} />
                    </TabPanel>
                    <TabPanel id="medications" activeTab={activeTab}>
                      <MedicationsTab patientId={selectedPatientId} />
                    </TabPanel>
                    <TabPanel id="labs" activeTab={activeTab}>
                      <LabsTab patientId={selectedPatientId} />
                    </TabPanel>
                    <TabPanel id="problems" activeTab={activeTab}>
                      <div className="clinical-card">
                        <p className="clinical-label mb-3">Problem List</p>
                        <div className="space-y-2">
                          {selectedPatient.problems.map((p, i) => (
                            <div key={i} className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
                              {p}
                            </div>
                          ))}
                        </div>
                      </div>
                    </TabPanel>
                    <TabPanel id="orders" activeTab={activeTab}>
                      <div className="clinical-card">
                        <p className="clinical-label mb-3">Active Orders</p>
                        <p className="text-sm text-slate-400 italic">
                          Orders module coming soon — will integrate with plan &amp; workflow.
                        </p>
                      </div>
                    </TabPanel>
                    <TabPanel id="notes" activeTab={activeTab}>
                      <div className="clinical-card">
                        <p className="clinical-label mb-3">Clinical Notes</p>
                        {selectedPatient.encounters.map((enc) => (
                          <div key={enc.id} className="mb-3 rounded border border-slate-200 p-3">
                            <p className="text-xs text-slate-500">
                              {new Date(enc.date).toLocaleDateString()} — {enc.type}
                            </p>
                            <p className="mt-1 text-sm text-slate-700">{enc.notes}</p>
                          </div>
                        ))}
                      </div>
                    </TabPanel>
                    <TabPanel id="imaging" activeTab={activeTab}>
                      <div className="clinical-card">
                        <p className="clinical-label mb-3">Imaging Studies</p>
                        <p className="text-sm text-slate-400 italic">Imaging module coming soon.</p>
                      </div>
                    </TabPanel>
                    <TabPanel id="immunizations" activeTab={activeTab}>
                      <div className="clinical-card">
                        <p className="clinical-label mb-3">Immunizations</p>
                        <p className="text-sm text-slate-400 italic">Immunization records coming soon.</p>
                      </div>
                    </TabPanel>
                    <TabPanel id="referrals" activeTab={activeTab}>
                      <div className="clinical-card">
                        <p className="clinical-label mb-3">Referrals</p>
                        <p className="text-sm text-slate-400 italic">Referral tracking coming soon.</p>
                      </div>
                    </TabPanel>
                  </div>
                </>
              )}
            </WorkspacePanel>

            {/* ─── InBasket / Alert Center ─── */}
            <WorkspacePanel id="inbasket" activeWorkspace={activeWorkspace}>
              <InBasket />
            </WorkspacePanel>

            {/* ─── Active Progress Note ─── */}
            <WorkspacePanel id="note" activeWorkspace={activeWorkspace}>
              <ActiveProgressNote
                patientName={selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : undefined}
              />
            </WorkspacePanel>
          </>
        )}
      </div>
      </>
    )}
    </AppShell>
  );
}