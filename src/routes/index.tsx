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
import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, ArrowRight, CheckCircle2 } from "lucide-react";

import { PatientProvider, usePatientStore } from "../store/patientStore";
import { PipelineProvider, usePipeline } from "../store/pipelineStore";
import { isLoggedIn, getLoggedInPhone, getAccessRequests } from "../store/accessStore";
import { checkSessionExpired, clearSession, setSessionStart } from "../store/accessStore";
import { PA_PROCEDURES, type ProcedureKey } from "../components/PriorAuthPortal/paData";
import { WorkflowTracker } from "../components/WorkflowTracker";
import { TabsEpic, TabPanel, useTabsEpic } from "../components/TabsEpic/TabsEpic";
import { Header } from "../components/TabsEpic/Header";
import { RightPaneleCW } from "../components/RightPaneleCW/RightPaneleCW";
import { WorkflowAthena } from "../components/WorkflowAthena/WorkflowAthena";
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
import { DailySchedule, type Appointment, PLACEHOLDER_APPOINTMENTS } from "../components/TabsEpic/DailySchedule";
import { InBasket } from "../components/TabsEpic/InBasket";
import { ActiveProgressNote } from "../components/TabsEpic/ActiveProgressNote";
import { ChartSearch } from "../components/TabsEpic/ChartSearch";
import ARVoiceSimulator from "../components/ARVoiceSimulator/ARVoiceSimulator";
import { StagePinGate } from "../components/StagePinGate";
import { CodingQueue } from "../components/CodingQueue/CodingQueue";
import { BillingLedger } from "../components/BillingLedger/BillingLedger";
import PriorAuthPortal from "../components/PriorAuthPortal/PriorAuthPortal";
import { GamificationHeader } from "../components/GamificationHeader";
import { WorklistPanel } from "../components/WorklistPanel";
import { FinancialLedger } from "../components/FinancialLedger";
import { ToastProvider, useToast } from "../components/Toast";
import { Skeleton } from "../components/Skeleton";
import { Certificate } from "../components/Certificate";

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

// ─── Per-Patient Session Data Store ──────────────────────────────
// Preserves each patient's scribe/vitals/shared data when switching

interface PatientSessionData {
  soapNote: SoapNoteData;
  submittedToCoding: boolean;
  completedStages: string[];
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
    allergies: string[];
    pcp: string;
    insurance: string;
  };
  sharedImmunizations: string[];
  sharedLabs: string[];
  sharedReferrals: string[];
  sharedOrders: string[];
  sharedImaging: string[];
  displayName: string | undefined;
  activeStage: string;
}

// ─── Tab Content Components ────────────────────────────────────────

interface EditablePatientData {
  chiefComplaint: string;
  problems: string[];
  medications: { id: string; name: string; dosage: string; frequency: string }[];
  allergies: string[];
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
}: {
  patientId: string;
  editableVitals?: EditableVitals;
  onVitalsChange?: (v: EditableVitals) => void;
  editablePatientData?: EditablePatientData;
  onPatientDataChange?: (d: EditablePatientData) => void;
  newProblem?: string;
  onNewProblemChange?: (v: string) => void;
  immunizations?: string[];
  onImmunizationsChange?: (v: string[]) => void;
  labsResults?: string[];
  onLabsResultsChange?: (v: string[]) => void;
  referrals?: string[];
  onReferralsChange?: (v: string[]) => void;
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

  const vitals = extVitals ?? localVitals;
  const setVitals = onVitalsChange ?? setLocalVitals;
  const data = extData ?? localData;
  const setData = onPatientDataChange ?? setLocalData;
  const addProblemText = newProblem !== undefined ? newProblem : localNewProblem;
  const setAddProblemText = onNewProblemChange ?? setLocalNewProblem;
  const immunizations = extImmunizations ?? [];
  const setImmunizations = onImmunizationsChange ?? ((v: string[]) => {});
  const labsResults = extLabsResults ?? [];
  const setLabsResults = onLabsResultsChange ?? ((v: string[]) => {});
  const referrals = extReferrals ?? [];
  const setReferrals = onReferralsChange ?? ((v: string[]) => {});

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
              {isScribe ? (
                <>
                  PCP: <input type="text" value={data.pcp} onChange={e => updateData("pcp", e.target.value)} className="inline w-28 rounded border border-slate-200 px-1 text-xs outline-none focus:border-blue-400" /> |
                  Insurance: <input type="text" value={data.insurance} onChange={e => updateData("insurance", e.target.value)} className="inline w-28 rounded border border-slate-200 px-1 text-xs outline-none focus:border-blue-400" />
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
                className="rounded border border-slate-200 px-2 py-1 text-xs font-medium outline-none focus:border-blue-400 w-48 text-right"
              />
            ) : (
              <span className="rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                {patient.chiefComplaint}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="clinical-card">
          <p className="clinical-label">BP</p>
          {isScribe ? (
            <input
              type="text"
              value={vitals.bloodPressure}
              onChange={(e) => updateVital("bloodPressure", e.target.value)}
              className="clinical-value w-full rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-blue-400"
            />
          ) : (
            <p className="clinical-value">{patient.vitals.bloodPressure}</p>
          )}
          {(() => {
            const parts = vitals.bloodPressure.split("/").map(s => parseFloat(s.trim()));
            const isBad = parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && (parts[0] > 130 || parts[1] > 80);
            return <p className={`mt-1 text-[10px] font-medium ${isBad ? "text-amber-600" : "text-green-600"}`}>{isBad ? "⚠ Elevated" : "✓ Normal"}</p>;
          })()}
        </div>
        <div className="clinical-card">
          <p className="clinical-label">HR</p>
          {isScribe ? (
            <input type="text" value={vitals.heartRate} onChange={e => updateVital("heartRate", e.target.value)} className="clinical-value w-full rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-blue-400" />
          ) : <p className="clinical-value">{patient.vitals.heartRate} bpm</p>}
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
            <input type="text" value={vitals.temperature} onChange={e => updateVital("temperature", e.target.value)} className="clinical-value w-full rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-blue-400" />
          ) : <p className="clinical-value">{patient.vitals.temperature}°F</p>}
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
            <input type="text" value={vitals.oxygenSaturation} onChange={e => updateVital("oxygenSaturation", e.target.value)} className="clinical-value w-full rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-blue-400" />
          ) : <p className="clinical-value">{patient.vitals.oxygenSaturation}%</p>}
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
        <div className="flex flex-wrap gap-2">
          {data.problems.map((p, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-xs text-blue-800">
              {p}
              {isScribe && (
                <button onClick={() => removeProblem(i)} className="text-blue-400 hover:text-red-500">&times;</button>
              )}
            </span>
          ))}
        </div>
        {isScribe && (
          <div className="mt-2 flex gap-1">
            <input
              type="text"
              value={addProblemText}
              onChange={e => setAddProblemText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addProblem()}
              placeholder="+ Add new problem..."
              className="flex-1 rounded border border-dashed border-slate-300 px-2 py-1 text-xs outline-none focus:border-blue-400"
            />
            <button onClick={addProblem} className="rounded bg-blue-500 px-2 py-1 text-xs text-white hover:bg-blue-600">Add</button>
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
              <div key={med.id} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">
                <span>{med.name} {med.dosage}, {med.frequency}</span>
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
              <input type="text" value={medName} onChange={e => setMedName(e.target.value)} placeholder="Medication name" className="rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-400" />
              <input type="text" value={medDosage} onChange={e => setMedDosage(e.target.value)} placeholder="Dosage (e.g. 10mg)" className="rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-400" />
              <input type="text" value={medFreq} onChange={e => setMedFreq(e.target.value)} placeholder="Frequency (e.g. BID)" className="rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-400" />
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
          <div className="flex flex-wrap gap-1.5">
            {data.allergies.map((a, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded bg-red-50 px-2 py-0.5 text-xs text-red-700">
                {typeof a === "string" ? a : (a as any).allergen || JSON.stringify(a)}
                {isScribe && (
                  <button onClick={() => removeAllergy(i)} className="text-red-400 hover:text-red-600">&times;</button>
                )}
              </span>
            ))}
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
              className="flex-1 rounded border border-dashed border-slate-300 px-2 py-1 text-xs outline-none focus:border-blue-400"
            />
            <button onClick={() => { addAllergy(allergyInput); setAllergyInput(""); }} className="rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600">Add</button>
          </div>
        )}
      </div>

      {/* Immunizations */}
      <div className="clinical-card">
        <p className="clinical-label mb-2">Immunizations</p>
        {immunizations.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {immunizations.map((imm, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded bg-green-50 px-2 py-0.5 text-xs text-green-700">{imm}</span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">No immunizations recorded</p>
        )}
        {isScribe && (
          <div className="mt-2 flex gap-1">
            <input type="text" value={immunInput} onChange={e => setImmunInput(e.target.value)} placeholder="+ Add immunization..." className="flex-1 rounded border border-dashed border-slate-300 px-2 py-1 text-xs outline-none focus:border-blue-400" />
            <button onClick={() => { if (immunInput.trim()) { setImmunizations([...immunizations, immunInput.trim()]); setImmunInput(""); } }} className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700">Add</button>
          </div>
        )}
      </div>

      {/* Labs & Results */}
      <div className="clinical-card">
        <p className="clinical-label mb-2">Labs & Results</p>
        {labsResults.length > 0 ? (
          <div className="space-y-1">
            {labsResults.map((lab, i) => (
              <div key={i} className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">{lab}</div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">No labs recorded</p>
        )}
        {isScribe && (
          <div className="mt-2 flex gap-1">
            <input type="text" value={labInput} onChange={e => setLabInput(e.target.value)} placeholder="+ Add lab/result..." className="flex-1 rounded border border-dashed border-slate-300 px-2 py-1 text-xs outline-none focus:border-blue-400" />
            <button onClick={() => { if (labInput.trim()) { setLabsResults([...labsResults, labInput.trim()]); setLabInput(""); } }} className="rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-700">Add</button>
          </div>
        )}
      </div>

      {/* Referrals */}
      <div className="clinical-card">
        <p className="clinical-label mb-2">Referrals</p>
        {referrals.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {referrals.map((ref, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded bg-purple-50 px-2 py-0.5 text-xs text-purple-700">{ref}</span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">No referrals</p>
        )}
        {isScribe && (
          <div className="mt-2 flex gap-1">
            <input type="text" value={referralInput} onChange={e => setReferralInput(e.target.value)} placeholder="+ Add referral..." className="flex-1 rounded border border-dashed border-slate-300 px-2 py-1 text-xs outline-none focus:border-blue-400" />
            <button onClick={() => { if (referralInput.trim()) { setReferrals([...referrals, referralInput.trim()]); setReferralInput(""); } }} className="rounded bg-purple-600 px-2 py-1 text-xs text-white hover:bg-purple-700">Add</button>
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
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {saved ? "✓ Changes Saved" : "Save Changes"}
          </button>
        </div>
      )}

      {/* Recent Encounters */}
      <div className="clinical-card">
        <p className="clinical-label mb-2">Recent Encounters</p>
        <table className="clinical-table">
          <thead><tr><th>Date</th><th>Type</th><th>Provider</th><th>Diagnosis</th></tr></thead>
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
      <table className="clinical-table">
        <thead>
          <tr>
            <th>Medication</th>
            <th>Dosage</th>
            <th>Frequency</th>
            <th>Route</th>
            <th>Status</th>
            <th>Prescribed</th>
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
      {isScribe && (
        <div className="mt-3 space-y-1.5 rounded border border-dashed border-slate-300 p-2">
          <div className="grid grid-cols-3 gap-1">
            <input type="text" value={medName} onChange={e => setMedName(e.target.value)} placeholder="Medication name" className="rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-400" />
            <input type="text" value={medDosage} onChange={e => setMedDosage(e.target.value)} placeholder="Dosage (e.g. 10mg)" className="rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-400" />
            <input type="text" value={medFreq} onChange={e => setMedFreq(e.target.value)} placeholder="Frequency (e.g. BID)" className="rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-400" />
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
    switch (type) {
      case "bp": {
        const parts = valueStr.split("/").map((s) => parseFloat(s.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          if (parts[0] > 130 || parts[1] > 80) return { className: "badge-abnormal", label: "Elevated" };
          return { className: "badge-normal", label: "Normal" };
        }
        return { className: "badge-normal", label: "Normal" };
      }
      case "hr": {
        const val = parseFloat(valueStr);
        if (!isNaN(val)) {
          if (val > 100 || val < 60) return { className: "badge-abnormal", label: val > 100 ? "Tachycardia" : "Bradycardia" };
          return { className: "badge-normal", label: "Normal" };
        }
        return { className: "badge-normal", label: "Normal" };
      }
      case "temp": {
        const val = parseFloat(valueStr);
        if (!isNaN(val)) {
          if (val > 99.5 || val < 97) return { className: "badge-abnormal", label: val > 99.5 ? "Fever" : "Hypothermia" };
          return { className: "badge-normal", label: "Normal" };
        }
        return { className: "badge-normal", label: "Normal" };
      }
      case "rr": {
        const val = parseFloat(valueStr);
        if (!isNaN(val)) {
          if (val > 20 || val < 12) return { className: "badge-abnormal", label: "Abnormal" };
          return { className: "badge-normal", label: "Normal" };
        }
        return { className: "badge-normal", label: "Normal" };
      }
      case "o2": {
        const val = parseFloat(valueStr);
        if (!isNaN(val)) {
          if (val < 95) return { className: "badge-abnormal", label: "Low" };
          return { className: "badge-normal", label: "Normal" };
        }
        return { className: "badge-normal", label: "Normal" };
      }
      default:
        return { className: "badge-normal", label: "Normal" };
    }
  };

  const bpBadge = getBadge("bp", isScribe ? vitals.bloodPressure : patient.vitals.bloodPressure);
  const hrBadge = getBadge("hr", isScribe ? vitals.heartRate : patient.vitals.heartRate.toString());
  const tempBadge = getBadge("temp", isScribe ? vitals.temperature : patient.vitals.temperature.toString());
  const rrBadge = getBadge("rr", isScribe ? vitals.respiratoryRate : patient.vitals.respiratoryRate.toString());
  const o2Badge = getBadge("o2", isScribe ? vitals.oxygenSaturation : patient.vitals.oxygenSaturation.toString());

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
              <td className="font-medium">
                {isScribe ? (
                  <input
                    type="text"
                    value={vitals.bloodPressure}
                    onChange={(e) => updateVital("bloodPressure", e.target.value)}
                    className="w-28 rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-blue-400"
                  />
                ) : (
                  <>{patient.vitals.bloodPressure} mmHg</>
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
                    className="w-28 rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-blue-400"
                  />
                ) : (
                  <>{patient.vitals.heartRate} bpm</>
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
                    className="w-28 rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-blue-400"
                  />
                ) : (
                  <>{patient.vitals.temperature} °F</>
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
                    className="w-28 rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-blue-400"
                  />
                ) : (
                  <>{patient.vitals.respiratoryRate} /min</>
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
                    className="w-28 rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-blue-400"
                  />
                ) : (
                  <>{patient.vitals.oxygenSaturation}%</>
                )}
              </td>
              <td><span className={o2Badge.className}>{o2Badge.label}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="clinical-card">
        <p className="clinical-label mb-2">Recorded</p>
        <p className="text-sm text-slate-600">
          {new Date(patient.vitals.recordedAt).toLocaleString()}
        </p>
        {isScribe && (
          <p className="mt-2 text-[10px] italic text-blue-500">Click to edit values above</p>
        )}
      </div>
    </div>
  );
}

function LabsTab({ patientId }: { patientId: string }) {
  const { getPatientById } = usePatientStore();
  const pipeline = usePipeline();
  const patient = getPatientById(patientId);
  const isScribe = pipeline.currentRole === "scribe";

  if (!patient) return null;

  // Editable lab values
  const [editLabValues, setEditLabValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    patient.labResults.forEach((lab) => { init[lab.id] = lab.value; });
    return init;
  });

  const updateLabValue = (id: string, val: string) => {
    setEditLabValues((prev) => ({ ...prev, [id]: val }));
  };

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
              <td>
                {isScribe ? (
                  <input
                    type="text"
                    value={editLabValues[lab.id] ?? lab.value}
                    onChange={(e) => updateLabValue(lab.id, e.target.value)}
                    className="w-20 rounded border border-slate-200 px-2 py-0.5 text-sm outline-none focus:border-blue-400"
                  />
                ) : (
                  <>{lab.value}</>
                )}
              </td>
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
      {isScribe && (
        <p className="mt-2 text-[10px] italic text-blue-500">Edit lab values above for charting practice</p>
      )}
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
            Enroll Now — 20$/ 5500 pkr
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-white px-6 py-3 text-sm font-semibold text-sky-600 hover:bg-sky-50"
          >
            Student Login
          </Link>
        </div>
        <p className="mt-4 text-center text-xs text-sky-600">
          Note: 20$/ 5500 pkr provides access to whole RCM
        </p>
      </section>

      {/* Pipeline Features — 5 Stages */}
      <section className="mx-auto max-w-5xl px-4 pb-8">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold text-slate-700">The 5-Stage RCM Pipeline</h2>
          <p className="mt-2 text-sm text-slate-400">Follow a patient encounter from exam room to final payment</p>
        </div>

        {/* Pipeline Flow Visual */}
        <div className="mb-8 flex items-center justify-center gap-1 overflow-x-auto rounded-xl bg-white p-4 shadow-sm">
          {["📋 Scribe", "🔍 Coder", "📄 Prior Auth", "💰 Biller", "📞 AR Voice"].map((stage, i) => (
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
              title: "Prior Auth — Authorization Hub",
              desc: "Handle high-cost procedures requiring pre-approval. Map clinical documentation to insurance policy criteria and submit digital PA forms.",
              icon: "📄",
              color: "bg-purple-50 border-purple-200",
              tag: "PA Portal",
            },
            {
              stage: "STAGE 4",
              title: "Biller — Claim Scrubbing",
              desc: "Audit CMS-1500 claims for errors. Submit to clearinghouse and face real-world outcomes: get paid instantly or receive a denial code to resolve.",
              icon: "💰",
              color: "bg-violet-50 border-violet-200",
              tag: "CMS-1500",
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
              { n: "1", title: "Pay 20$/ 5500 pkr", desc: "via Bank Islami, EasyPaisa, or PayPal" },
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
  const { patients, caseStates } = usePatientStore();
  const { activeTab, setActiveTab } = useTabsEpic("summary");
  const { activeWorkspace, setActiveWorkspace } = useWorkspaceTabs("chart");
  const [selectedPatientId, setSelectedPatientId] = useState(patients[0]?.id ?? "");
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const { currentRole, submitToCoding, setRole, paRecords, state: pipelineState } = usePipeline();
  const { addToast } = useToast();
  const [activeStage, setActiveStage] = useState("registration");
  const [completedStages, setCompletedStages] = useState<Set<string>>(new Set(["registration"]));
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [level, setLevel] = useState(1);
  const [examMode, setExamMode] = useState(false);
  const [examTimeRemaining, setExamTimeRemaining] = useState(1800); // 30 min in seconds
  const examTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // SOAP note state lifted from AssessmentPlanStage for pipeline submission
  const [soapNote, setSoapNote] = useState<SoapNoteData>({
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
  });
  const [submittedToCoding, setSubmittedToCoding] = useState(false);
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Shared editable vitals state across SummaryTab, VitalsTab, and RightPaneleCW
  const [editableVitals, setEditableVitals] = useState({
    bloodPressure: patients[0]?.vitals.bloodPressure ?? "120/80",
    heartRate: patients[0]?.vitals.heartRate?.toString() ?? "72",
    temperature: patients[0]?.vitals.temperature?.toString() ?? "98.6",
    respiratoryRate: patients[0]?.vitals.respiratoryRate?.toString() ?? "16",
    oxygenSaturation: patients[0]?.vitals.oxygenSaturation?.toString() ?? "98",
  });

  // Shared editable patient data for scribe mode (persists across tab switches)
  const [editablePatientData, setEditablePatientData] = useState({
    chiefComplaint: patients[0]?.chiefComplaint ?? "",
    problems: [...(patients[0]?.problems ?? [])],
    medications: patients[0]?.medications ? patients[0].medications.filter(m => m.status === "active").map(m => ({ id: m.id, name: m.name, dosage: m.dosage, frequency: m.frequency })) : [],
    allergies: patients[0]?.allergies ? [...patients[0].allergies] : [],
    pcp: patients[0]?.primaryCareProvider ?? "",
    insurance: patients[0]?.insurance ?? "",
  });
  const [newProblem, setNewProblem] = useState("");
  // Shared lists across Summary + tabs (real-time sync)
  const [sharedImmunizations, setSharedImmunizations] = useState<string[]>([]);
  const [sharedLabs, setSharedLabs] = useState<string[]>([]);
  const [sharedReferrals, setSharedReferrals] = useState<string[]>([]);
  const [sharedOrders, setSharedOrders] = useState<string[]>([]);
  const [sharedImaging, setSharedImaging] = useState<string[]>([]);

  // Lifted appointments state for persistence across tab switches (Bug 2 fix)
  const [appointments, setAppointments] = useState<Appointment[]>(PLACEHOLDER_APPOINTMENTS);
  // Override display name for right panel header when showing placeholder patient (e.g. new appointment)
  const [displayName, setDisplayName] = useState<string | undefined>(undefined);

  // Per-patient session data store — preserves work when switching patients
  const patientDataStore = useRef<Record<string, PatientSessionData>>({});

  /**
   * Save the current patient's session data into the store.
   * Call this BEFORE switching to a different patient.
   */
  function saveCurrentSession() {
    if (!selectedPatientId) return;
    const stages: string[] = [];
    completedStages.forEach(s => stages.push(s));
    patientDataStore.current[selectedPatientId] = {
      soapNote: { ...soapNote },
      submittedToCoding,
      completedStages: stages,
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
    const saved = patientDataStore.current[patientId];
    const p = patients.find(pp => pp.id === patientId) || patients[0];

    if (saved) {
      setSoapNote(saved.soapNote);
      setSubmittedToCoding(saved.submittedToCoding);
      setCompletedStages(new Set(saved.completedStages));
      setActiveStage(saved.activeStage);
      setEditableVitals(saved.editableVitals);
      setEditablePatientData(saved.editablePatientData);
      setSharedImmunizations(saved.sharedImmunizations);
      setSharedLabs(saved.sharedLabs);
      setSharedReferrals(saved.sharedReferrals);
      setSharedOrders(saved.sharedOrders);
      setSharedImaging(saved.sharedImaging);
      setDisplayName(saved.displayName);
    } else if (p) {
      // First time visiting this patient — initialize from mock data
      setEditablePatientData({
        chiefComplaint: p.chiefComplaint ?? "",
        problems: [...(p.problems ?? [])],
        medications: p.medications ? p.medications.filter(m => m.status === "active").map(m => ({ id: m.id, name: m.name, dosage: m.dosage, frequency: m.frequency })) : [],
        allergies: p.allergies ? [...p.allergies] : [],
        pcp: p.primaryCareProvider ?? "",
        insurance: p.insurance ?? "",
      });
      setEditableVitals({
        bloodPressure: p.vitals.bloodPressure ?? "120/80",
        heartRate: p.vitals.heartRate?.toString() ?? "72",
        temperature: p.vitals.temperature?.toString() ?? "98.6",
        respiratoryRate: p.vitals.respiratoryRate?.toString() ?? "16",
        oxygenSaturation: p.vitals.oxygenSaturation?.toString() ?? "98",
      });
      setSharedImmunizations([]);
      setSharedLabs([]);
      setSharedReferrals([]);
      setSharedOrders([]);
      setSharedImaging([]);
      setSoapNote({ subjective: "", objective: "", assessment: "", plan: "" });
      setSubmittedToCoding(false);
      setDisplayName(undefined);
      setActiveStage("registration");
      setCompletedStages(new Set(["registration"]));
    }
  }

  // When selected patient changes, load that patient's session data
  useEffect(() => {
    const p = patients.find(pp => pp.id === selectedPatientId);
    if (!p) {
      // Handle case where patient not found (e.g. custom appointment mapped to placeholder)
      setSharedImmunizations([]);
      setSharedLabs([]);
      setSharedReferrals([]);
      setSharedOrders([]);
      setSharedImaging([]);
      setSoapNote({ subjective: "", objective: "", assessment: "", plan: "" });
      setSubmittedToCoding(false);
      return;
    }
    // If we have saved data for this patient, restore it; otherwise initialize from mock
    loadPatientSession(selectedPatientId);
  }, [selectedPatientId]);

  // Check login on mount
  useEffect(() => {
    setCheckingAuth(false);
    // Record session start time for timeout tracking
    setSessionStart();
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

  // Handle sign & lock — compiles the SOAP note and submits to coding pipeline
  const handleSignAndLock = () => {
    setIsSubmittingNote(true);
    // Compile full note string from all quadrants
    const fullNote = [
      soapNote.subjective ? `SUBJECTIVE:\n${soapNote.subjective}` : "",
      soapNote.objective ? `OBJECTIVE:\n${soapNote.objective}` : "",
      soapNote.assessment ? `ASSESSMENT:\n${soapNote.assessment}` : "",
      soapNote.plan ? `PLAN:\n${soapNote.plan}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    // Simulate brief submission delay for UX
    setTimeout(() => {
      submitToCoding(fullNote);
      setIsSubmittingNote(false);
      setSubmittedToCoding(true);
      addToast({ type: "success", title: "Note Submitted to Coding!", description: "The clinical note has been signed, locked, and sent to the coding queue." });
      // Mark sign-lock as completed
      const updated = new Set(completedStages);
      updated.add("sign-lock");
      setCompletedStages(updated);
    }, 800);
  };

  const toggleStageComplete = (stageId: string) => {
    const updated = new Set(completedStages);
    if (updated.has(stageId)) {
      updated.delete(stageId);
    } else {
      updated.add(stageId);
      // Auto-advance to next stage
      const stageOrder = ["registration", "eligibility", "intake-vitals", "hpi", "exam-ros", "assessment-plan", "sign-lock"];
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
        <>
          <GamificationHeader xp={xp} streak={streak} level={level} />
          <Header
            businessName={businessName}
            selectedPatientId={selectedPatientId}
            onPatientSelect={(id) => { saveCurrentSession(); setSelectedPatientId(id); setDisplayName(undefined); setRole("scribe"); setActiveWorkspace("chart"); setActiveStage("registration"); }}
            showRightPanel={showRightPanel}
            onToggleRightPanel={() => setShowRightPanel(!showRightPanel)}
            selectedPatientName={
              selectedPatient
                ? `${selectedPatient.lastName}, ${selectedPatient.firstName}`
                : undefined
            }
            examMode={examMode}
            examTimeRemaining={examTimeRemaining}
            onToggleExamMode={toggleExamMode}
          />
        </>
      }
      leftPanel={
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-100 px-4 py-3">
            <WorklistPanel patients={patients} selectedPatientId={selectedPatientId} onPatientSelect={(id) => { saveCurrentSession(); setSelectedPatientId(id); setDisplayName(undefined); setRole("scribe"); setActiveWorkspace("chart"); setActiveStage("registration"); }} />
          </div>
          {selectedPatient && currentRole === "scribe" && (
            <div className="flex-1 overflow-y-auto p-4">
              <WorkflowAthena
                activeStage={activeStage}
                onStageSelect={setActiveStage}
                completedStages={completedStages}
                onToggleStageComplete={toggleStageComplete}
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
              <FinancialLedger totalBilled={12500} totalCollected={8700} totalDenied={2400} daysInAR={32} />
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
      {/* ─── Workflow Tracker (always visible) ─── */}
      {selectedPatient && <WorkflowTracker encounterId={selectedPatientId} />}

      {/* ─── Role-Based Workspace ─── */}
      {selectedPatient && currentRole !== "scribe" ? (
        <div className="flex flex-1 flex-col overflow-hidden">
          {currentRole === "coder" && (
            <StagePinGate role="coder" roleLabel="Medical Coder">
              <CodingQueue soapNote={soapNote} medications={editablePatientData.medications} />
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
          {pipelineState.stage === "complete" && (
            <div className="flex flex-1 flex-col items-center justify-center p-8">
              <div className="rounded-full bg-green-100 p-4">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              </div>
              <h3 className="mt-4 text-xl font-bold text-slate-800">Pipeline Complete!</h3>
              <p className="mt-2 text-sm text-slate-500">All stages have been completed. Great work!</p>
              <div className="mt-6">
                <Certificate
                  studentName={localStorage.getItem("hh_student_name") || "Student"}
                  completedModules={["Scribe", "Coder", "Prior Auth", "Biller", "AR Voice"]}
                  score={92}
                />
              </div>
            </div>
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
              <DailySchedule
                appointments={appointments}
                setAppointments={setAppointments}
                onSelectPatient={(name) => {
                  saveCurrentSession();
                  const match = patients.find(p => `${p.firstName} ${p.lastName}`.toLowerCase() === name.toLowerCase());
                  if (match) {
                    setSelectedPatientId(match.id);
                    setRole("scribe");
                    setActiveWorkspace("chart");
                    setActiveStage("intake-vitals");
                    setDisplayName(undefined);
                    setEditablePatientData(prev => ({
                      ...prev,
                      chiefComplaint: match.chiefComplaint,
                    }));
                  } else {
                    // For custom / new patients not in the mock database,
                    // select the first patient and show the appointment name as chief complaint
                    if (patients.length > 0) {
                      setSelectedPatientId(patients[0].id);
                      setRole("scribe");
                      setActiveWorkspace("chart");
                      setActiveStage("intake-vitals");
                      setDisplayName(name);
                      setEditablePatientData(prev => ({
                        ...prev,
                        chiefComplaint: `Visit for: ${name} — ${(() => {
                          const apt = appointments.find(a => a.patientName.toLowerCase() === name.toLowerCase());
                          return apt?.notes || apt?.type || "New patient appointment";
                        })()}`,
                        problems: [...prev.problems],
                      }));
                      // Show a brief toast notification
                      const toast = document.createElement("div");
                      toast.className = "fixed top-4 right-4 z-50 rounded-lg bg-sky-600 px-4 py-2 text-sm text-white shadow-lg animate-bounce";
                      toast.textContent = `✓ Starting visit for ${name} — opened placeholder chart`;
                      document.body.appendChild(toast);
                      setTimeout(() => toast.remove(), 3000);
                    }
                  }
                }} />
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
                        Workflow: {activeStage === "registration" ? "Patient Registration" :
                              activeStage === "eligibility" ? "Eligibility & Prior Auth" :
                            activeStage === "intake-vitals" ? "Intake / Vitals" :
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
                  <div className="flex-1 overflow-y-auto p-4 animate-slide-in" key={activeStage}>
                    {activeStage === "registration" && (
                      <RegistrationStage />
                    )}
                    {activeStage === "eligibility" && (
                      <EligibilityStage />
                    )}
                    {activeStage === "intake-vitals" && (
                      <IntakeVitalsStage patientId={selectedPatientId} editableVitals={editableVitals} onVitalsChange={setEditableVitals} />
                    )}
                    {activeStage === "hpi" && (
                      <HPIStage
                        patientName={`${selectedPatient.firstName} ${selectedPatient.lastName}`}
                        chiefComplaint={editablePatientData.chiefComplaint || selectedPatient.chiefComplaint}
                        note={soapNote}
                        onNoteChange={setSoapNote}
                      />
                    )}
                    {activeStage === "exam-ros" && (
                      <ExamROSStage
                        patientName={`${selectedPatient.firstName} ${selectedPatient.lastName}`}
                        note={soapNote}
                        onNoteChange={setSoapNote}
                      />
                    )}
                    {activeStage === "assessment-plan" && (
                      <AssessmentPlanStage
                        patientName={`${selectedPatient.firstName} ${selectedPatient.lastName}`}
                        note={soapNote}
                        onNoteChange={setSoapNote}
                      />
                    )}
                    {activeStage === "sign-lock" && !submittedToCoding && (
                      <SignLockStage
                        patientName={`${selectedPatient.firstName} ${selectedPatient.lastName}`}
                        note={soapNote}
                        onSignAndLock={handleSignAndLock}
                        isSubmitting={isSubmittingNote}
                      />
                    )}
                    {activeStage === "sign-lock" && submittedToCoding && (
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
                            onClick={() => {
                              setSubmittedToCoding(false);
                              setActiveStage("");
                            }}
                            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                          >
                            Return to Chart Review
                          </button>
                          <button
                            onClick={() => setRole("coder")}
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                          >
                            Switch to Coder Role
                          </button>
                        </div>
                      </div>
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
                        {currentRole === "scribe" ? (
                          <div className="space-y-2">
                            <div className="flex gap-1">
                              <input type="text" id="newLabInput" placeholder="e.g. CBC: WBC 6.5, Hgb 13.2" className="flex-1 rounded border border-dashed border-slate-300 px-2 py-1 text-xs outline-none focus:border-blue-400" />
                              <button onClick={() => {
                                const inp = document.getElementById("newLabInput") as HTMLInputElement;
                                if (inp && inp.value.trim()) {
                                  setSharedLabs([...sharedLabs, inp.value.trim()]);
                                  inp.value = "";
                                }
                              }} className="rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-700">Add</button>
                            </div>
                            <div className="space-y-1">
                              {sharedLabs.length === 0 ? <p className="text-xs text-slate-400 italic">No labs added yet.</p> : sharedLabs.map((o, i) => (
                                <div key={i} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">
                                  <span>{o}</span>
                                  <button onClick={() => setSharedLabs(sharedLabs.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-[10px]">\u2715</button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : sharedLabs.length > 0 ? (
                          <div className="space-y-1">{sharedLabs.map((o, i) => <div key={i} className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">{o}</div>)}</div>
                        ) : (
                          <p className="text-sm text-slate-400 italic">No labs recorded.</p>
                        )}
                      </div>
                    </TabPanel>
                    <TabPanel id="problems" activeTab={activeTab}>
                      <div className="clinical-card">
                        <p className="clinical-label mb-3">Problem List</p>
                        <div className="space-y-2">
                          {selectedPatient.problems.map((p, i) => (
                            <div key={i} className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 p-3 text-sm">
                              <span>{p}</span>
                              {currentRole === "scribe" && (
                                <button onClick={() => {
                                  // Remove problem from editablePatientData
                                  const updated = editablePatientData.problems.filter((_, j) => j !== i);
                                  setEditablePatientData({ ...editablePatientData, problems: updated });
                                }} className="text-red-400 hover:text-red-600 text-[10px]">✕</button>
                              )}
                            </div>
                          ))}
                        </div>
                        {currentRole === "scribe" && (
                          <div className="mt-2 flex gap-1">
                            <input
                              type="text"
                              value={newProblem}
                              onChange={e => setNewProblem(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter" && newProblem.trim()) { setEditablePatientData({ ...editablePatientData, problems: [...editablePatientData.problems, newProblem.trim()] }); setNewProblem(""); }}}
                              placeholder="+ Add new problem..."
                              className="flex-1 rounded border border-dashed border-slate-300 px-2 py-1 text-xs outline-none focus:border-blue-400"
                            />
                            <button onClick={() => { if (newProblem.trim()) { setEditablePatientData({ ...editablePatientData, problems: [...editablePatientData.problems, newProblem.trim()] }); setNewProblem(""); }}} className="rounded bg-blue-500 px-2 py-1 text-xs text-white hover:bg-blue-600">Add</button>
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
                            paProcedures.some(p => o.toLowerCase().includes(p) || p.includes(o.toLowerCase()))
                          );
                          if (matchingOrders.length > 0) {
                            return (
                              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                                <div className="flex items-start gap-2">
                                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                  <div>
                                    <p className="text-[11px] font-semibold text-amber-800">⚠ Prior Authorization Required</p>
                                    <p className="mt-0.5 text-[10px] text-amber-700">
                                      {matchingOrders.map(o => `"${o}"`).join(", ")} requires prior authorization before the procedure can be performed. 
                                      Please complete the Prior Auth form in the Prior Auth stage.
                                    </p>
                                    <button
                                      onClick={() => setRole("prior-auth")}
                                      className="mt-2 rounded bg-[#4A1D96] px-3 py-1 text-[10px] font-medium text-white hover:bg-[#3B1580] transition-colors"
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

                        <p className="text-xs text-slate-400 mb-2">Manage orders for this encounter. Items appear in Summary.</p>
                        {currentRole === "scribe" ? (
                          <div className="space-y-2">
                            <div className="flex gap-1">
                              <input type="text" id="newOrderInput" placeholder="e.g. CBC, CMP, Chest X-ray..." className="flex-1 rounded border border-dashed border-slate-300 px-2 py-1 text-xs outline-none focus:border-blue-400" />
                              <button onClick={() => {
                                const inp = document.getElementById("newOrderInput") as HTMLInputElement;
                                if (inp && inp.value.trim()) {
                                  setSharedOrders([...sharedOrders, inp.value.trim()]);
                                  inp.value = "";
                                }
                              }} className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700">Add</button>
                            </div>
                            <div className="space-y-1">
                              {sharedOrders.length === 0 ? <p className="text-xs text-slate-400 italic">No orders added yet.</p> : sharedOrders.map((o, i) => (
                                <div key={i} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">
                                  <span>{o}</span>
                                  <button onClick={() => setSharedOrders(sharedOrders.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-[10px]">✕</button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : sharedOrders.length > 0 ? (
                          <div className="space-y-1">
                            {sharedOrders.map((o, i) => <div key={i} className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">{o}</div>)}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400 italic">No active orders.</p>
                        )}
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
                        {currentRole === "scribe" ? (
                          <div className="space-y-2">
                            <div className="flex gap-1">
                              <input type="text" id="newImagingInput" placeholder="e.g. Chest X-ray, MRI Brain..." className="flex-1 rounded border border-dashed border-slate-300 px-2 py-1 text-xs outline-none focus:border-blue-400" />
                              <button onClick={() => {
                                const inp = document.getElementById("newImagingInput") as HTMLInputElement;
                                if (inp && inp.value.trim()) {
                                  setSharedImaging([...sharedImaging, inp.value.trim()]);
                                  inp.value = "";
                                }
                              }} className="rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-700">Add</button>
                            </div>
                            <div className="space-y-1">
                              {sharedImaging.length === 0 ? <p className="text-xs text-slate-400 italic">No imaging added yet.</p> : sharedImaging.map((o, i) => (
                                <div key={i} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">
                                  <span>{o}</span>
                                  <button onClick={() => setSharedImaging(sharedImaging.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-[10px]">✕</button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : sharedImaging.length > 0 ? (
                          <div className="space-y-1">
                            {sharedImaging.map((o, i) => <div key={i} className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">{o}</div>)}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400 italic">No imaging studies ordered.</p>
                        )}
                      </div>
                    </TabPanel>
                    <TabPanel id="immunizations" activeTab={activeTab}>
                      <div className="clinical-card">
                        <p className="clinical-label mb-3">Immunizations</p>
                        {currentRole === "scribe" ? (
                          <div className="space-y-2">
                            <div className="flex gap-1">
                              <input type="text" id="newImmunInput2" placeholder="e.g. Influenza 2024, COVID-19 Booster..." className="flex-1 rounded border border-dashed border-slate-300 px-2 py-1 text-xs outline-none focus:border-blue-400" />
                              <button onClick={() => {
                                const inp = document.getElementById("newImmunInput2") as HTMLInputElement;
                                if (inp && inp.value.trim()) {
                                  setSharedImmunizations([...sharedImmunizations, inp.value.trim()]);
                                  inp.value = "";
                                }
                              }} className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700">Add</button>
                            </div>
                            <div className="space-y-1">
                              {sharedImmunizations.length === 0 ? <p className="text-xs text-slate-400 italic">No immunizations added yet.</p> : sharedImmunizations.map((o, i) => (
                                <div key={i} className="flex items-center justify-between rounded bg-green-50 px-2 py-1 text-xs text-green-700">
                                  <span>{o}</span>
                                  <button onClick={() => setSharedImmunizations(sharedImmunizations.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-[10px]">✕</button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : sharedImmunizations.length > 0 ? (
                          <div className="space-y-1">
                            {sharedImmunizations.map((o, i) => <div key={i} className="rounded bg-green-50 px-2 py-1 text-xs text-green-700">{o}</div>)}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400 italic">No immunizations recorded.</p>
                        )}
                      </div>
                    </TabPanel>
                    <TabPanel id="referrals" activeTab={activeTab}>
                      <div className="clinical-card">
                        <p className="clinical-label mb-3">Referrals</p>
                        {currentRole === "scribe" ? (
                          <div className="space-y-2">
                            <div className="flex gap-1">
                              <input type="text" id="newRefInput2" placeholder="e.g. Cardiology, Orthopedics..." className="flex-1 rounded border border-dashed border-slate-300 px-2 py-1 text-xs outline-none focus:border-blue-400" />
                              <button onClick={() => {
                                const inp = document.getElementById("newRefInput2") as HTMLInputElement;
                                if (inp && inp.value.trim()) {
                                  setSharedReferrals([...sharedReferrals, inp.value.trim()]);
                                  inp.value = "";
                                }
                              }} className="rounded bg-purple-600 px-2 py-1 text-xs text-white hover:bg-purple-700">Add</button>
                            </div>
                            <div className="space-y-1">
                              {sharedReferrals.length === 0 ? <p className="text-xs text-slate-400 italic">No referrals added yet.</p> : sharedReferrals.map((o, i) => (
                                <div key={i} className="flex items-center justify-between rounded bg-purple-50 px-2 py-1 text-xs text-purple-700">
                                  <span>{o}</span>
                                  <button onClick={() => setSharedReferrals(sharedReferrals.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-[10px]">✕</button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : sharedReferrals.length > 0 ? (
                          <div className="space-y-1">
                            {sharedReferrals.map((o, i) => <div key={i} className="rounded bg-purple-50 px-2 py-1 text-xs text-purple-700">{o}</div>)}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400 italic">No referrals recorded.</p>
                        )}
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
      {/* ─── Activity Log Stream ─── */}
      {selectedPatient && (
        <div className="border-t border-slate-200 bg-white/80 backdrop-blur-sm">
          <div className="px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Activity Log</span>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-500">{caseStates[selectedPatientId]?.auditLogs?.length ?? 0}</span>
            </div>
            <div className="mt-1 flex gap-2 overflow-x-auto pb-1">
              {(caseStates[selectedPatientId]?.auditLogs ?? []).length === 0 ? (
                <p className="text-[10px] text-slate-400 italic">No activity recorded yet.</p>
              ) : (
                (caseStates[selectedPatientId]?.auditLogs ?? []).slice(-10).map((log, i) => (
                  <div key={i} className={`shrink-0 rounded-lg border px-2 py-1 text-[9px] ${
                    log.status === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" :
                    log.status === "warning" ? "border-amber-200 bg-amber-50 text-amber-700" :
                    log.status === "error" ? "border-rose-200 bg-rose-50 text-rose-700" :
                    "border-slate-200 bg-slate-50 text-slate-600"
                  }`}>
                    <span className="font-medium">{log.role}</span>: {log.message}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}