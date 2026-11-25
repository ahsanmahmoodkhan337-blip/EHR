/**
 * VitalsSaveBar — the one Save for vitals typed anywhere in the chart.
 *
 * Owner, 2026-11-26: "wheresoever vitals are put in whichsoever portion of the
 * chart, all portions … should be like that." Intake / Vitals, the Summary tab
 * and the Vitals tab all edit the same live values (the chart's
 * `editableVitals`), and every one of them saves through this bar into the same
 * encounter flowsheet (`recordVitals`), so the sidebar, the note, the sign-off
 * checklist and every tab show one set of vitals.
 */
import { useState } from "react";
import { usePipeline } from "../../store/pipelineStore";
import { getLoggedInPhone } from "../../store/accessStore";
import { checkVitals } from "../../utils/vitals";
import {
  EMPTY_VITALS_FORM,
  editableFromVitals,
  latestVitals,
  missingCoreVitals,
  vitalsFromForm,
  type VitalsForm,
} from "../../domain/vitalsRecord";

export interface EditableVitalsShape {
  bloodPressure: string;
  heartRate: string;
  temperature: string;
  respiratoryRate: string;
  oxygenSaturation: string;
}

/** The chart's live values as a vitals form ("142/91" → systolic and diastolic). */
export function formFromEditable(v: EditableVitalsShape): VitalsForm {
  const [sys, dia] = String(v.bloodPressure ?? "").split("/");
  return {
    ...EMPTY_VITALS_FORM,
    systolic: (sys ?? "").trim(),
    diastolic: (dia ?? "").trim(),
    heartRate: String(v.heartRate ?? "").trim(),
    temperatureF: String(v.temperature ?? "").trim(),
    respiratoryRate: String(v.respiratoryRate ?? "").trim(),
    oxygenSaturation: String(v.oxygenSaturation ?? "").trim(),
  };
}

export function VitalsSaveBar({
  patientId,
  vitals,
  onVitalsChange,
  disabled = false,
}: {
  patientId: string;
  vitals: EditableVitalsShape;
  onVitalsChange?: (v: EditableVitalsShape) => void;
  disabled?: boolean;
}) {
  const { getEncounter, recordVitals } = usePipeline();
  const latest = latestVitals(getEncounter(patientId)?.vitals);
  const [error, setError] = useState<string | null>(null);

  const saved = latest ? editableFromVitals(latest) : null;
  const same =
    saved !== null &&
    saved.bloodPressure === vitals.bloodPressure &&
    saved.heartRate === vitals.heartRate &&
    saved.temperature === vitals.temperature &&
    saved.respiratoryRate === vitals.respiratoryRate &&
    saved.oxygenSaturation === vitals.oxygenSaturation;

  const save = () => {
    const form = formFromEditable(vitals);
    const n = (t: string) => (t === "" ? 0 : Number(t));
    const check = checkVitals({
      systolic: n(form.systolic),
      diastolic: n(form.diastolic),
      heartRate: n(form.heartRate),
      temperatureF: n(form.temperatureF),
      respiratoryRate: n(form.respiratoryRate),
      oxygenSaturation: n(form.oxygenSaturation),
    });
    if (check.impossible.length > 0) {
      setError(check.impossible[0]);
      return;
    }
    const missing = missingCoreVitals(form);
    if (missing.length > 0) {
      setError(`Enter ${missing.join(", ")} before saving (blood pressure as 120/80).`);
      return;
    }
    const record = vitalsFromForm(form, new Date().toISOString(), getLoggedInPhone() ?? "system");
    if (!record) return;
    recordVitals(record);
    onVitalsChange?.(editableFromVitals(record));
    setError(null);
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={save}
        disabled={disabled || same}
        title={same ? "These vitals are already saved to the chart" : undefined}
        className="min-h-10 rounded-lg bg-brand-900 px-3 text-sm font-medium text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Save vitals
      </button>
      <span className={`text-xs ${same ? "text-green-700" : "text-slate-500"}`} aria-live="polite">
        {same && latest
          ? `Saved to the chart · ${new Date(latest.recordedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
          : latest
            ? "Changes not saved yet"
            : "Not saved yet"}
      </span>
      {error && (
        <p role="alert" className="basis-full text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
