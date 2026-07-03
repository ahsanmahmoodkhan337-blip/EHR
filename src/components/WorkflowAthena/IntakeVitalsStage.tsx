/**
 * IntakeVitalsStage — Vitals Intake Form
 *
 * Inspiration: Athenahealth's Intake/Vitals workflow stage and
 * DrChrono's vitals entry interface. Athena presents vitals as
 * a structured data entry form during patient intake, while
 * DrChrono provides compact input fields optimized for quick
 * clinical data capture.
 *
 * This component provides input fields for standard vital signs:
 * BP, HR, Temp, RR, O2 Sat, Weight, Height, Pain score.
 * Values are synced to the parent via editableVitals/onVitalsChange
 * so the RightPaneleCW always reflects the latest values.
 */

import { useState, useEffect } from "react";
import { Activity, Heart, Thermometer, Wind, Droplets, Weight, Ruler, AlertCircle } from "lucide-react";
import { usePatientStore, type Patient } from "../../store/patientStore";

interface EditableVitals {
  bloodPressure: string;
  heartRate: string;
  temperature: string;
  respiratoryRate: string;
  oxygenSaturation: string;
}

interface IntakeVitalsStageProps {
  patientId: string;
  editableVitals?: EditableVitals;
  onVitalsChange?: (v: EditableVitals) => void;
}

export function IntakeVitalsStage({ patientId, editableVitals, onVitalsChange }: IntakeVitalsStageProps) {
  const { getPatientById } = usePatientStore();
  const patient = getPatientById(patientId);

  // Local vitals state — initialised from editableVitals (lifted) or patient store
  const [vitals, setVitals] = useState({
    bloodPressureSystolic: 120,
    bloodPressureDiastolic: 80,
    heartRate: 72,
    temperature: 98.6,
    respiratoryRate: 16,
    oxygenSaturation: 98,
    weight: 70,
    height: 170,
    painScore: 0,
  });

  const [saved, setSaved] = useState(false);

  // Sync local vitals when editableVitals or patient changes from outside
  useEffect(() => {
    if (editableVitals) {
      const bp = editableVitals.bloodPressure.split("/");
      setVitals({
        bloodPressureSystolic: parseInt(bp[0]) || 120,
        bloodPressureDiastolic: parseInt(bp[1]) || 80,
        heartRate: parseInt(editableVitals.heartRate) || 72,
        temperature: parseFloat(editableVitals.temperature) || 98.6,
        respiratoryRate: parseInt(editableVitals.respiratoryRate) || 16,
        oxygenSaturation: parseInt(editableVitals.oxygenSaturation) || 98,
        weight: 70,
        height: 170,
        painScore: 0,
      });
    } else if (patient) {
      const bp = patient.vitals.bloodPressure.split("/");
      setVitals({
        bloodPressureSystolic: parseInt(bp[0]) || 120,
        bloodPressureDiastolic: parseInt(bp[1]) || 80,
        heartRate: patient.vitals.heartRate,
        temperature: patient.vitals.temperature,
        respiratoryRate: patient.vitals.respiratoryRate,
        oxygenSaturation: patient.vitals.oxygenSaturation,
        weight: 70,
        height: 170,
        painScore: 0,
      });
    }
  }, [editableVitals, patient]);

  // Propagate local vitals changes up to parent whenever they change
  useEffect(() => {
    if (onVitalsChange) {
      onVitalsChange({
        bloodPressure: `${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic}`,
        heartRate: vitals.heartRate.toString(),
        temperature: vitals.temperature.toString(),
        respiratoryRate: vitals.respiratoryRate.toString(),
        oxygenSaturation: vitals.oxygenSaturation.toString(),
      });
    }
  }, [vitals, onVitalsChange]);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-800">Intake & Vital Signs</h3>
          <p className="text-sm text-slate-500">
            Record patient's current vital signs and anthropometric measurements
          </p>
        </div>
        <button
          onClick={handleSave}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            saved
              ? "bg-green-500 text-white"
              : "bg-blue-600 text-white hover:bg-blue-500"
          }`}
        >
          {saved ? "Saved!" : "Save Vitals"}
        </button>
      </div>

      {/* Vitals grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Blood Pressure */}
        <div className="clinical-card">
          <div className="mb-2 flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-600" />
            <span className="clinical-label">Blood Pressure</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={vitals.bloodPressureSystolic}
              onChange={(e) => setVitals({ ...vitals, bloodPressureSystolic: parseInt(e.target.value) || 0 })}
              className="w-20 rounded border border-slate-200 px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-400"
              placeholder="SYS"
            />
            <span className="text-slate-400">/</span>
            <input
              type="number"
              value={vitals.bloodPressureDiastolic}
              onChange={(e) => setVitals({ ...vitals, bloodPressureDiastolic: parseInt(e.target.value) || 0 })}
              className="w-20 rounded border border-slate-200 px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-400"
              placeholder="DIA"
            />
            <span className="text-xs text-slate-400">mmHg</span>
          </div>
        </div>

        {/* Heart Rate */}
        <div className="clinical-card">
          <div className="mb-2 flex items-center gap-2">
            <Heart className="h-4 w-4 text-red-500" />
            <span className="clinical-label">Heart Rate</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={vitals.heartRate}
              onChange={(e) => setVitals({ ...vitals, heartRate: parseInt(e.target.value) || 0 })}
              className="w-24 rounded border border-slate-200 px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-400"
            />
            <span className="text-xs text-slate-400">bpm</span>
          </div>
        </div>

        {/* Temperature */}
        <div className="clinical-card">
          <div className="mb-2 flex items-center gap-2">
            <Thermometer className="h-4 w-4 text-amber-500" />
            <span className="clinical-label">Temperature</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.1"
              value={vitals.temperature}
              onChange={(e) => setVitals({ ...vitals, temperature: parseFloat(e.target.value) || 0 })}
              className="w-24 rounded border border-slate-200 px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-400"
            />
            <span className="text-xs text-slate-400">°F</span>
          </div>
        </div>

        {/* Respiratory Rate */}
        <div className="clinical-card">
          <div className="mb-2 flex items-center gap-2">
            <Wind className="h-4 w-4 text-cyan-500" />
            <span className="clinical-label">Respiratory Rate</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={vitals.respiratoryRate}
              onChange={(e) => setVitals({ ...vitals, respiratoryRate: parseInt(e.target.value) || 0 })}
              className="w-24 rounded border border-slate-200 px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-400"
            />
            <span className="text-xs text-slate-400">/min</span>
          </div>
        </div>

        {/* Oxygen Saturation */}
        <div className="clinical-card">
          <div className="mb-2 flex items-center gap-2">
            <Droplets className="h-4 w-4 text-blue-500" />
            <span className="clinical-label">O2 Saturation</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={vitals.oxygenSaturation}
              onChange={(e) => setVitals({ ...vitals, oxygenSaturation: parseInt(e.target.value) || 0 })}
              className="w-24 rounded border border-slate-200 px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-400"
            />
            <span className="text-xs text-slate-400">%</span>
          </div>
        </div>

        {/* Pain Score */}
        <div className="clinical-card">
          <div className="mb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="clinical-label">Pain Score</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="10"
              value={vitals.painScore}
              onChange={(e) => setVitals({ ...vitals, painScore: parseInt(e.target.value) })}
              className="w-28 accent-blue-600"
            />
            <span className="min-w-[2rem] text-sm font-bold text-slate-700">
              {vitals.painScore}/10
            </span>
          </div>
        </div>
      </div>

      {/* Anthropometrics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Weight */}
        <div className="clinical-card">
          <div className="mb-2 flex items-center gap-2">
            <Weight className="h-4 w-4 text-slate-500" />
            <span className="clinical-label">Weight</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.1"
              value={vitals.weight}
              onChange={(e) => setVitals({ ...vitals, weight: parseFloat(e.target.value) || 0 })}
              className="w-24 rounded border border-slate-200 px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-400"
            />
            <span className="text-xs text-slate-400">kg</span>
          </div>
        </div>

        {/* Height */}
        <div className="clinical-card">
          <div className="mb-2 flex items-center gap-2">
            <Ruler className="h-4 w-4 text-slate-500" />
            <span className="clinical-label">Height</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.1"
              value={vitals.height}
              onChange={(e) => setVitals({ ...vitals, height: parseFloat(e.target.value) || 0 })}
              className="w-24 rounded border border-slate-200 px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-400"
            />
            <span className="text-xs text-slate-400">cm</span>
          </div>
        </div>
      </div>

      {/* Existing vitals reference */}
      {patient && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-500">
            Previously recorded: {patient.vitals.bloodPressure} | {patient.vitals.heartRate} bpm |{" "}
            {patient.vitals.temperature}°F | SpO2 {patient.vitals.oxygenSaturation}%
            <span className="ml-2 text-[10px] text-slate-400">
              ({new Date(patient.vitals.recordedAt).toLocaleDateString()})
            </span>
          </p>
        </div>
      )}
    </div>
  );
}