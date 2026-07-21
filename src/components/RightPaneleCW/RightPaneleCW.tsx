/**
 * RightPaneleCW — Patient Summary Side Panel
 *
 * Inspiration: eClinicalWorks (eCW) right-side summary panel.
 * eCW is known for its compact, always-visible patient summary
 * panel that shows key clinical data (allergies, meds, problems,
 * vitals) without navigating away from the main chart. This
 * component replicates that "at-a-glance" sidebar experience
 * for quick clinical decision support.
 */

import { Activity, AlertTriangle, Pill, Stethoscope, Gauge, Thermometer, Heart, Wind, Droplets, FileText, Shield, CheckCircle2, Clock } from "lucide-react";
import type { Patient } from "../../store/patientStore";
import type { PARecordStore } from "../../store/pipelineStore";

interface RightPaneleCWProps {
  patient: Patient | null;
  /** Override display name when patient is a placeholder (e.g. new appointments) */
  displayName?: string;
  editableVitals?: {
    bloodPressure: string;
    heartRate: string;
    temperature: string;
    respiratoryRate: string;
    oxygenSaturation: string;
  };
  editablePatientData?: {
    chiefComplaint: string;
    problems: string[];
    medications: { id: string; name: string; dosage: string; frequency: string }[];
    allergies: string[];
    pcp: string;
    insurance: string;
  };
  sharedImmunizations?: string[];
  sharedLabs?: string[];
  sharedReferrals?: string[];
  sharedOrders?: string[];
  sharedImaging?: string[];
  soapNote?: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  /** PA records for lifecycle tracking */
  paRecords?: PARecordStore[];
}

export function RightPaneleCW({ patient, displayName, editableVitals, editablePatientData, sharedImmunizations, sharedLabs, sharedReferrals, sharedOrders, sharedImaging, soapNote, paRecords }: RightPaneleCWProps) {
  if (!patient) {
    return (
      <aside className="w-72 shrink-0 border-l border-slate-200 bg-slate-50 p-4">
        <p className="text-sm text-slate-400 italic">No patient selected</p>
      </aside>
    );
  }

  return (
    <aside className="w-72 shrink-0 border-l border-slate-200 bg-slate-50 overflow-y-auto">
      {/* Patient Demographics Header */}
      <div className="border-b border-slate-200 bg-white p-4">
        <h2 className="text-lg font-bold text-slate-800">
          {displayName || `${patient.firstName} ${patient.lastName}`}
        </h2>
        {displayName ? (
          <div className="mt-1">
            <span className="inline-block rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700">
              New Patient — Appointment Visit
            </span>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-500">
              {patient.gender} | {patient.age} yrs | DOB:{" "}
              {new Date(patient.dateOfBirth).toLocaleDateString()}
            </p>
            <p className="text-xs text-slate-400">MRN: {patient.mrn}</p>
            {patient.preferredName && (
              <p className="text-xs text-blue-600">
                Also known as: {patient.preferredName}
              </p>
            )}
          </>
        )}
      </div>

      {/* Chief Complaint */}
      <div className="border-b border-slate-200 bg-amber-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
          Chief Complaint
        </p>
        <p className="text-sm font-medium text-amber-900">
          {editablePatientData?.chiefComplaint || patient.chiefComplaint}
        </p>
      </div>

      {/* Vitals Snapshot */}
      <div className="border-b border-slate-200 p-3">
        <div className="mb-2 flex items-center gap-1.5">
          <Activity className="h-4 w-4 text-blue-600" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Latest Vitals
          </span>
          {editableVitals && <span className="text-[9px] text-blue-500 italic">(live)</span>}
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
          <span className="text-slate-500">BP:</span>
          <span className="font-medium text-slate-800">
            {editableVitals?.bloodPressure ?? patient.vitals.bloodPressure}
          </span>
          <span className="text-slate-500">HR:</span>
          <span className="font-medium text-slate-800">
            {editableVitals?.heartRate ?? patient.vitals.heartRate} bpm
          </span>
          <span className="text-slate-500">Temp:</span>
          <span className="font-medium text-slate-800">
            {editableVitals?.temperature ?? patient.vitals.temperature}°F
          </span>
          <span className="text-slate-500">RR:</span>
          <span className="font-medium text-slate-800">
            {editableVitals?.respiratoryRate ?? patient.vitals.respiratoryRate}
          </span>
          <span className="text-slate-500">SpO2:</span>
          <span className="font-medium text-slate-800">
            {editableVitals?.oxygenSaturation ?? patient.vitals.oxygenSaturation}%
          </span>
        </div>
      </div>

      {/* Active Problems */}
      <div className="border-b border-slate-200 p-3">
        <div className="mb-2 flex items-center gap-1.5">
          <Stethoscope className="h-4 w-4 text-blue-600" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Active Problems
          </span>
        </div>
        <ul className="space-y-1">
          {(editablePatientData?.problems || patient.problems).map((problem, i) => (
            <li
              key={i}
              className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-800"
            >
              {problem}
            </li>
          ))}
        </ul>
      </div>

      {/* Medication Alerts */}
      <div className="border-b border-slate-200 p-3">
        <div className="mb-2 flex items-center gap-1.5">
          <Pill className="h-4 w-4 text-blue-600" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Active Medications ({((editablePatientData?.medications)?.length ?? patient.medications?.filter(m => m.status === "active")?.length ?? 0)})
          </span>
        </div>
        <ul className="space-y-1">
          {(editablePatientData?.medications || patient.medications.filter((m) => m.status === "active")).slice(0, 5).map((med) => (
              <li
                key={med.id}
                className="flex items-start gap-1 text-xs text-slate-700"
              >
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                <span>
                  {med.name} {med.dosage}, {med.frequency}
                </span>
              </li>
            ))}
        </ul>
      </div>

      {/* Allergies */}
      <div className="border-b border-slate-200 p-3">
        <div className="mb-2 flex items-center gap-1.5">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Allergies
          </span>
        </div>
        {editablePatientData?.allergies?.length ? (
          <div className="flex flex-wrap gap-1">
            {editablePatientData.allergies.map((a, i) => (
              <span key={i} className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-700">
                {typeof a === "string" ? a : a.allergen || JSON.stringify(a)}
              </span>
            ))}
          </div>
        ) : patient.allergies.length > 0 ? (
          <ul className="space-y-1">
            {patient.allergies.map((alg) => (
              <li key={alg.id}>
                <span className="inline-block rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                  {alg.allergen} ({alg.severity})
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-green-600">No known allergies</p>
        )}
      </div>

      {/* PA Status / Lifecycle Tracking */}
      {paRecords && paRecords.length > 0 && (
        <div className="border-b border-slate-200 p-3">
          <div className="mb-2 flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-purple-600" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-600">
              Prior Authorization
            </span>
          </div>
          <div className="space-y-2">
            {paRecords
              .filter((r) => r.patientId === patient.id)
              .slice(0, 3)
              .map((record) => {
                const today = new Date();
                const endDate = record.authEndDate ? new Date(record.authEndDate) : null;
                const daysUntilExpiry = endDate ? Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;

                return (
                  <div key={record.id} className="rounded-lg border border-purple-100 bg-purple-50 p-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-medium text-purple-800 truncate">{record.procedure}</p>
                      <span className={`inline-block rounded-full px-1.5 py-0.5 text-[8px] font-medium ${
                        record.status === "approved" ? "bg-green-100 text-green-700" :
                        record.status === "denied" ? "bg-red-100 text-red-700" :
                        record.status === "submitted" ? "bg-amber-100 text-amber-700" :
                        "bg-purple-100 text-purple-700"
                      }`}>
                        {record.status}
                      </span>
                    </div>
                    <div className="mt-1 space-y-0.5 text-[9px] text-purple-600">
                      <p>Insurance: {record.insuranceName || "—"}</p>
                      {record.authStartDate && <p>Auth: {new Date(record.authStartDate).toLocaleDateString()} → {endDate?.toLocaleDateString() || "—"}</p>}
                      {daysUntilExpiry !== null && daysUntilExpiry <= 14 && daysUntilExpiry >= 0 && (
                        <p className="flex items-center gap-1 text-amber-700 font-medium">
                          <Clock className="h-2.5 w-2.5" />
                          PA Expiring Soon — {daysUntilExpiry} day{daysUntilExpiry !== 1 ? "s" : ""}
                        </p>
                      )}
                      {record.nextRefillDate && (record.status === "completed" || record.status === "closed") && (() => {
                        const refillDate = new Date(record.nextRefillDate);
                        const daysUntilRefill = Math.ceil((refillDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        return daysUntilRefill <= 7 && daysUntilRefill >= 0 ? (
                          <p className="flex items-center gap-1 text-orange-600 font-medium">
                            <Clock className="h-2.5 w-2.5" />
                            Refill Due — {daysUntilRefill} day{daysUntilRefill !== 1 ? "s" : ""}
                          </p>
                        ) : null;
                      })()}
                      {record.verificationStatus === "verified" && (
                        <p className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Insurance verified
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* SOAP Note (from scribe workflow) */}
      {soapNote && (soapNote.subjective || soapNote.objective || soapNote.assessment || soapNote.plan) && (
        <div className="border-b border-slate-200 p-3">
          <div className="mb-1 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">SOAP Note</span>
          </div>
          <div className="space-y-1 text-[10px]">
            {soapNote.subjective && <p><span className="font-semibold text-blue-600">S:</span> {soapNote.subjective.slice(0, 100)}{soapNote.subjective.length > 100 ? "..." : ""}</p>}
            {soapNote.objective && <p><span className="font-semibold text-green-600">O:</span> {soapNote.objective.slice(0, 100)}{soapNote.objective.length > 100 ? "..." : ""}</p>}
            {soapNote.assessment && <p><span className="font-semibold text-amber-600">A:</span> {soapNote.assessment.slice(0, 100)}{soapNote.assessment.length > 100 ? "..." : ""}</p>}
            {soapNote.plan && <p><span className="font-semibold text-purple-600">P:</span> {soapNote.plan.slice(0, 100)}{soapNote.plan.length > 100 ? "..." : ""}</p>}
          </div>
        </div>
      )}

      {/* Shared Data: Immunizations, Labs, Referrals, Orders, Imaging */}
      {sharedImmunizations && sharedImmunizations.length > 0 && (
        <div className="border-b border-slate-200 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-green-600 mb-1">Immunizations</p>
          <div className="flex flex-wrap gap-1">{sharedImmunizations.map((item, i) => <span key={i} className="rounded bg-green-50 px-1.5 py-0.5 text-[10px] text-green-700">{item}</span>)}</div>
        </div>
      )}
      {sharedLabs && sharedLabs.length > 0 && (
        <div className="border-b border-slate-200 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 mb-1">Labs</p>
          <div className="space-y-0.5">{sharedLabs.map((item, i) => <p key={i} className="text-[10px] text-slate-600">{item}</p>)}</div>
        </div>
      )}
      {sharedReferrals && sharedReferrals.length > 0 && (
        <div className="border-b border-slate-200 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-purple-600 mb-1">Referrals</p>
          <div className="flex flex-wrap gap-1">{sharedReferrals.map((item, i) => <span key={i} className="rounded bg-purple-50 px-1.5 py-0.5 text-[10px] text-purple-700">{item}</span>)}</div>
        </div>
      )}
      {sharedOrders && sharedOrders.length > 0 && (
        <div className="border-b border-slate-200 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 mb-1">Orders</p>
          <div className="space-y-0.5">{sharedOrders.map((item, i) => <p key={i} className="text-[10px] text-slate-600">{item}</p>)}</div>
        </div>
      )}
      {sharedImaging && sharedImaging.length > 0 && (
        <div className="border-b border-slate-200 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-600 mb-1">Imaging</p>
          <div className="flex flex-wrap gap-1">{sharedImaging.map((item, i) => <span key={i} className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] text-sky-700">{item}</span>)}</div>
        </div>
      )}

      {/* Insurance & PCP Footer */}
      <div className="border-t border-slate-200 bg-white p-3 text-xs text-slate-500">
        <p>
          <span className="font-medium text-slate-600">PCP:</span>{" "}
          {editablePatientData?.pcp || patient.primaryCareProvider}
        </p>
        <p>
          <span className="font-medium text-slate-600">Insurance:</span>{" "}
          {editablePatientData?.insurance || patient.insurance}
        </p>
      </div>
    </aside>
  );
}