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

import { useEffect, useMemo, useState } from "react";
import { Activity, Heart, Thermometer, Wind, Droplets, Weight, Ruler, AlertCircle } from "lucide-react";
import { usePatientStore } from "../../store/patientStore";
import { usePipeline } from "../../store/pipelineStore";
import { getLoggedInPhone } from "../../store/accessStore";
import { checkVitals, hasVital } from "../../utils/vitals";
import { actorLabel } from "../../utils/actorLabel";
import {
  EMPTY_VITALS_FORM,
  editableFromVitals,
  formFromVitals,
  latestVitals,
  missingCoreVitals,
  vitalsFromForm,
  type VitalsForm,
} from "../../domain/vitalsRecord";

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

const time = (iso: string) =>
  new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export function IntakeVitalsStage({ patientId, onVitalsChange }: IntakeVitalsStageProps) {
  const { getPatientById } = usePatientStore();
  const { getEncounter, recordVitals } = usePipeline();
  const patient = getPatientById(patientId);
  const history = getEncounter(patientId)?.vitals ?? [];
  const latest = latestVitals(history);

  // The form opens on the last set saved on this visit; a seeded chart with
  // measured vitals opens on those; anything else opens empty. No made-up
  // defaults: a box the student did not fill is a vital nobody took.
  const opening = useMemo<VitalsForm>(() => {
    if (latest) return formFromVitals(latest);
    const v = patient?.vitals;
    if (v && hasVital(v.bloodPressure) && hasVital(v.heartRate)) {
      const [sys, dia] = String(v.bloodPressure).split("/");
      return {
        ...EMPTY_VITALS_FORM,
        systolic: (sys ?? "").trim(),
        diastolic: (dia ?? "").trim(),
        heartRate: String(v.heartRate),
        temperatureF: hasVital(v.temperature) ? String(v.temperature) : "",
        respiratoryRate: hasVital(v.respiratoryRate) ? String(v.respiratoryRate) : "",
        oxygenSaturation: hasVital(v.oxygenSaturation) ? String(v.oxygenSaturation) : "",
      };
    }
    return { ...EMPTY_VITALS_FORM };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, latest?.recordedAt]);

  const [form, setForm] = useState<VitalsForm>(opening);
  const [savedAt, setSavedAt] = useState<string | null>(latest?.recordedAt ?? null);
  const [saveRefused, setSaveRefused] = useState<string | null>(null);

  // A new patient, or vitals saved from another part of the chart (the Summary
  // or Vitals tab): the form shows the chart's latest set.
  useEffect(() => {
    setForm(opening);
    setSavedAt(latest?.recordedAt ?? null);
    setSaveRefused(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, latest?.recordedAt]);

  const set = (key: keyof VitalsForm, value: string) => {
    setSaveRefused(null);
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // The summary sidebar shows what is being typed, marked "(live)".
      onVitalsChange?.({
        bloodPressure: next.systolic && next.diastolic ? `${next.systolic}/${next.diastolic}` : "",
        heartRate: next.heartRate,
        temperature: next.temperatureF,
        respiratoryRate: next.respiratoryRate,
        oxygenSaturation: next.oxygenSaturation,
      });
      return next;
    });
  };

  const n = (t: string) => (t.trim() === "" ? 0 : Number(t));
  const check = checkVitals({
    systolic: n(form.systolic),
    diastolic: n(form.diastolic),
    heartRate: n(form.heartRate),
    temperatureF: n(form.temperatureF),
    respiratoryRate: n(form.respiratoryRate),
    oxygenSaturation: n(form.oxygenSaturation),
  });
  const missing = missingCoreVitals(form);
  const dirty = !latest || JSON.stringify(formFromVitals(latest)) !== JSON.stringify(form);

  const handleSave = () => {
    // A value that cannot be real is a typo or a swapped box: say which, and
    // do not save until it is fixed.
    if (check.impossible.length > 0) {
      setSaveRefused("Fix the values marked above before saving.");
      return;
    }
    if (missing.length > 0) {
      setSaveRefused(`Enter ${missing.join(", ")} before saving — every core vital is measured and recorded.`);
      return;
    }
    const at = new Date().toISOString();
    const record = vitalsFromForm(form, at, getLoggedInPhone() ?? "system");
    if (!record) return;
    recordVitals(record);
    onVitalsChange?.(editableFromVitals(record));
    setSaveRefused(null);
    setSavedAt(at);
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
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={handleSave}
            className="min-h-10 rounded-lg bg-brand-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-800"
          >
            Save Vitals
          </button>
          <span className={`text-xs ${savedAt && !dirty ? "text-green-700" : "text-slate-500"}`} aria-live="polite">
            {savedAt && !dirty
              ? `Saved to the chart · ${time(savedAt)}`
              : savedAt
                ? "Changes not saved yet"
                : "Not saved yet"}
          </span>
        </div>
      </div>

      {saveRefused && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800">
          {saveRefused}
        </p>
      )}

      {(check.impossible.length > 0 || check.abnormal.length > 0) && (
        <div
          role="status"
          className={`rounded-lg border p-3 text-xs ${
            check.impossible.length > 0 ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          <p className="font-semibold">
            {check.impossible.length > 0
              ? "Check these values — they cannot be right (a typo, or a value in the wrong box):"
              : "Abnormal values — confirm them and make sure the provider knows:"}
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {(check.impossible.length > 0 ? check.impossible : check.abnormal).map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Vitals grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Blood Pressure */}
        <div className="clinical-card">
          <div className="mb-2 flex items-center gap-2">
            <Activity className="h-4 w-4 text-brand-600" />
            <span className="clinical-label">Blood Pressure</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={form.systolic}
              onChange={(e) => set("systolic", e.target.value)}
              aria-label="Systolic blood pressure"
              className="w-20 rounded border border-slate-200 px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-brand-400"
              placeholder="SYS"
            />
            <span className="text-slate-400">/</span>
            <input
              type="number"
              value={form.diastolic}
              onChange={(e) => set("diastolic", e.target.value)}
              aria-label="Diastolic blood pressure"
              className="w-20 rounded border border-slate-200 px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-brand-400"
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
              value={form.heartRate}
              onChange={(e) => set("heartRate", e.target.value)}
              aria-label="Heart rate"
              placeholder="bpm"
              className="w-24 rounded border border-slate-200 px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-brand-400"
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
              value={form.temperatureF}
              onChange={(e) => set("temperatureF", e.target.value)}
              aria-label="Temperature"
              placeholder="°F"
              className="w-24 rounded border border-slate-200 px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-brand-400"
            />
            <span className="text-xs text-slate-400">°F</span>
          </div>
        </div>

        {/* Respiratory Rate */}
        <div className="clinical-card">
          <div className="mb-2 flex items-center gap-2">
            <Wind className="h-4 w-4 text-brand-500" />
            <span className="clinical-label">Respiratory Rate</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={form.respiratoryRate}
              onChange={(e) => set("respiratoryRate", e.target.value)}
              aria-label="Respiratory rate"
              placeholder="/min"
              className="w-24 rounded border border-slate-200 px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-brand-400"
            />
            <span className="text-xs text-slate-400">/min</span>
          </div>
        </div>

        {/* Oxygen Saturation */}
        <div className="clinical-card">
          <div className="mb-2 flex items-center gap-2">
            <Droplets className="h-4 w-4 text-brand-500" />
            <span className="clinical-label">O2 Saturation</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={form.oxygenSaturation}
              onChange={(e) => set("oxygenSaturation", e.target.value)}
              aria-label="Oxygen saturation"
              placeholder="%"
              className="w-24 rounded border border-slate-200 px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-brand-400"
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
              value={form.painScore || "0"}
              onChange={(e) => set("painScore", e.target.value)}
              aria-label="Pain score, 0 to 10"
              className="w-28 accent-brand-600"
            />
            <span className="min-w-[2rem] text-sm font-bold text-slate-700">
              {form.painScore === "" ? "not rated" : `${form.painScore}/10`}
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
              value={form.weightKg}
              onChange={(e) => set("weightKg", e.target.value)}
              aria-label="Weight in kilograms"
              placeholder="optional"
              className="w-24 rounded border border-slate-200 px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-brand-400"
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
              value={form.heightCm}
              onChange={(e) => set("heightCm", e.target.value)}
              aria-label="Height in centimetres"
              placeholder="optional"
              className="w-24 rounded border border-slate-200 px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-brand-400"
            />
            <span className="text-xs text-slate-400">cm</span>
          </div>
        </div>
      </div>

      {/* Vitals flowsheet — every set saved on this visit, newest first */}
      <div className="clinical-card">
        <p className="text-sm font-semibold text-slate-800">Vitals history</p>
        {history.length === 0 ? (
          <p className="mt-1 text-xs text-slate-500">
            No vitals saved on this visit yet. Measure them, enter them above and press Save Vitals — they then show
            on the summary sidebar, in the note and in the chart.
          </p>
        ) : (
          <div className="relative mt-2 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-1 pr-3 font-medium">Recorded</th>
                  <th className="py-1 pr-3 font-medium">BP</th>
                  <th className="py-1 pr-3 font-medium">HR</th>
                  <th className="py-1 pr-3 font-medium">Temp</th>
                  <th className="py-1 pr-3 font-medium">RR</th>
                  <th className="py-1 pr-3 font-medium">SpO2</th>
                  <th className="py-1 pr-3 font-medium">Wt / Ht</th>
                  <th className="py-1 pr-3 font-medium">Pain</th>
                  <th className="py-1 font-medium">By</th>
                </tr>
              </thead>
              <tbody className="tabular-nums text-slate-800">
                {[...history].reverse().map((v) => (
                  <tr key={v.recordedAt} className="border-t border-slate-100">
                    <td className="py-1 pr-3 whitespace-nowrap">{time(v.recordedAt)}</td>
                    <td className="py-1 pr-3">{v.systolic}/{v.diastolic}</td>
                    <td className="py-1 pr-3">{v.heartRate}</td>
                    <td className="py-1 pr-3">{v.temperatureF}°F</td>
                    <td className="py-1 pr-3">{v.respiratoryRate}</td>
                    <td className="py-1 pr-3">{v.oxygenSaturation}%</td>
                    <td className="py-1 pr-3">
                      {v.weightKg !== undefined ? `${v.weightKg} kg` : "—"} / {v.heightCm !== undefined ? `${v.heightCm} cm` : "—"}
                    </td>
                    <td className="py-1 pr-3">{v.painScore !== undefined ? `${v.painScore}/10` : "—"}</td>
                    <td className="py-1">{actorLabel(v.recordedBy)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}