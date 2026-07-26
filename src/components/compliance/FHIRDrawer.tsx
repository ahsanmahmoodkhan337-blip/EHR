/**
 * FHIRDrawer — FHIR R4 JSON Resource Viewer
 *
 * Slide-out drawer showing real-time FHIR R4 JSON for the active patient.
 * Tabs: Patient, Encounter, Condition, Observation, Claim, ExplanationOfBenefit.
 */

import { useState } from "react";
import { FileJson, Copy, CheckCircle2, X, Database } from "lucide-react";

// ─── FHIR Resource Types ────────────────────────────────────────────

type FHIRTab = "patient" | "encounter" | "condition" | "observation" | "claim" | "eob";

interface PatientInfo {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  mrn: string;
}

// ─── FHIR Builder ───────────────────────────────────────────────────

function buildFHIRPatient(p: PatientInfo | null) {
  if (!p) return JSON.stringify({ resourceType: "Patient", id: "unknown" }, null, 2);
  return JSON.stringify({
    resourceType: "Patient",
    id: `pat-${p.id}`,
    identifier: [{ system: "http://hl7.org/fhir/sid/us-mrn", value: p.mrn }],
    name: [{ family: p.lastName, given: [p.firstName] }],
    gender: p.gender.toLowerCase(),
    birthDate: p.dob,
  }, null, 2);
}

function buildFHIREncounter(p: PatientInfo | null) {
  if (!p) return JSON.stringify({ resourceType: "Encounter", id: "unknown" }, null, 2);
  return JSON.stringify({
    resourceType: "Encounter",
    id: `enc-${p.id}-${Date.now()}`,
    status: "in-progress",
    class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "AMB" },
    subject: { reference: `Patient/pat-${p.id}`, display: `${p.firstName} ${p.lastName}` },
    period: { start: new Date().toISOString() },
  }, null, 2);
}

function buildFHIRCondition(p: PatientInfo | null, icdCodes?: string[], cptCodes?: string[]) {
  return JSON.stringify({
    resourceType: "Bundle",
    type: "searchset",
    entry: [
      ...(icdCodes?.map(c => ({
        resource: {
          resourceType: "Condition",
          id: `cond-${c}`,
          code: { coding: [{ system: "http://hl7.org/fhir/sid/icd-10-cm", code: c }] },
          subject: { reference: `Patient/pat-${p?.id || "unknown"}` },
        }
      })) || []),
      ...(cptCodes?.map(c => ({
        resource: {
          resourceType: "Procedure",
          id: `proc-${c}`,
          code: { coding: [{ system: "http://www.ama-assn.org/go/cpt", code: c }] },
          subject: { reference: `Patient/pat-${p?.id || "unknown"}` },
        }
      })) || []),
    ],
  }, null, 2);
}

function buildFHIRObservation(p: PatientInfo | null) {
  return JSON.stringify({
    resourceType: "Observation",
    id: `obs-${p?.id || "unknown"}-vitals`,
    status: "final",
    category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "vital-signs" }] }],
    subject: { reference: `Patient/pat-${p?.id || "unknown"}` },
    effectiveDateTime: new Date().toISOString(),
    component: [
      { code: { text: "Systolic BP" }, valueQuantity: { value: 120, unit: "mmHg" } },
      { code: { text: "Heart Rate" }, valueQuantity: { value: 72, unit: "/min" } },
    ],
  }, null, 2);
}

function buildFHIRClaim(p: PatientInfo | null) {
  return JSON.stringify({
    resourceType: "Claim",
    id: `claim-${p?.id || "unknown"}`,
    status: "active",
    type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/claim-type", code: "professional" }] },
    use: "claim",
    patient: { reference: `Patient/pat-${p?.id || "unknown"}` },
    created: new Date().toISOString(),
    provider: { reference: "Practitioner/prac-001" },
    insurance: [{ sequence: 1, focal: true, coverage: { reference: "Coverage/cov-001" } }],
    total: { value: 250.00, currency: "USD" },
  }, null, 2);
}

function buildFHIREOB(p: PatientInfo | null) {
  return JSON.stringify({
    resourceType: "ExplanationOfBenefit",
    id: `eob-${p?.id || "unknown"}`,
    status: "active",
    type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/claim-type", code: "professional" }] },
    use: "claim",
    patient: { reference: `Patient/pat-${p?.id || "unknown"}` },
    created: new Date().toISOString(),
    insurer: { display: "Blue Cross Blue Shield" },
    total: [{ category: { coding: [{ code: "submitted" }] }, amount: { value: 250.00, currency: "USD" } }],
    payment: { amount: { value: 200.00, currency: "USD" } },
  }, null, 2);
}

// ─── Component ──────────────────────────────────────────────────────

interface FHIRDrawerProps {
  patient?: PatientInfo | null;
  icdCodes?: string[];
  cptCodes?: string[];
}

export function FHIRDrawer({ patient, icdCodes, cptCodes }: FHIRDrawerProps) {
  const [showPanel, setShowPanel] = useState(false);
  const [activeTab, setActiveTab] = useState<FHIRTab>("patient");
  const [copied, setCopied] = useState(false);

  const getContent = () => {
    switch (activeTab) {
      case "patient": return buildFHIRPatient(patient);
      case "encounter": return buildFHIREncounter(patient);
      case "condition": return buildFHIRCondition(patient, icdCodes, cptCodes);
      case "observation": return buildFHIRObservation(patient);
      case "claim": return buildFHIRClaim(patient);
      case "eob": return buildFHIREOB(patient);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(getContent()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const tabs: { key: FHIRTab; label: string }[] = [
    { key: "patient", label: "Patient" },
    { key: "encounter", label: "Encounter" },
    { key: "condition", label: "Condition" },
    { key: "observation", label: "Observation" },
    { key: "claim", label: "Claim" },
    { key: "eob", label: "EOB" },
  ];

  return (
    <div className="relative">
      <button onClick={() => setShowPanel(!showPanel)} className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[10px] font-medium text-violet-600 hover:bg-violet-100">
        <Database className="h-3.5 w-3.5" /> FHIR R4
      </button>
      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-end pt-0 bg-black/20" onClick={() => setShowPanel(false)}>
          <div className="relative w-full max-w-md h-full max-h-full overflow-y-auto border-l border-slate-200 bg-white shadow-2xl p-5 animate-slide-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div><h3 className="text-sm font-bold text-slate-800">FHIR R4 Resources</h3><p className="text-[9px] text-slate-400">JSON View</p></div>
              <button onClick={() => setShowPanel(false)} className="text-slate-400"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex gap-1 mb-3 overflow-x-auto">
              {tabs.map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)} className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[10px] font-medium ${activeTab === t.key ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-500"}`}>{t.label}</button>
              ))}
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] text-slate-400 font-mono">Resource/{activeTab}</span>
              <button onClick={copyToClipboard} className="flex items-center gap-1 rounded bg-violet-100 px-2 py-1 text-[9px] text-violet-700">
                {copied ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}{copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <pre className="rounded-lg bg-slate-900 p-3 text-[10px] text-green-400 overflow-x-auto whitespace-pre font-mono leading-relaxed max-h-[60vh]">{getContent()}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
