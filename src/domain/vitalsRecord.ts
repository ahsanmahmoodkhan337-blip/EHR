/**
 * vitalsRecord — vital signs as part of the chart.
 *
 * Owner, 2026-11-26: "when I save vitals they should appear on the summary side
 * bar and become part of the chart." Before this, Save Vitals only flashed
 * "Saved!": the values lived in the page's memory, so a reload lost them, and
 * the form opened on made-up defaults (120/80, 72 bpm, 98.6 °F) that a student
 * could "save" without measuring anything.
 *
 * Now each Save appends one dated set to the encounter's `vitals` list (the
 * flowsheet, like Epic's or athenaOne's vitals flowsheet). The latest set is what
 * the summary sidebar, the note's Objective and the sign-off checklist read.
 * Nothing is invented: a vital that was not entered is not saved.
 */

export interface RecordedVitals {
  /** ISO time the set was saved. */
  recordedAt: string;
  /** The student's login, or "system". */
  recordedBy: string;
  systolic: number;
  diastolic: number;
  heartRate: number;
  temperatureF: number;
  respiratoryRate: number;
  oxygenSaturation: number;
  /** Optional measurements — saved only when entered. */
  weightKg?: number;
  heightCm?: number;
  painScore?: number;
}

/** What the vitals form holds: text, because a box can be empty. */
export interface VitalsForm {
  systolic: string;
  diastolic: string;
  heartRate: string;
  temperatureF: string;
  respiratoryRate: string;
  oxygenSaturation: string;
  weightKg: string;
  heightCm: string;
  painScore: string;
}

export const EMPTY_VITALS_FORM: VitalsForm = {
  systolic: "",
  diastolic: "",
  heartRate: "",
  temperatureF: "",
  respiratoryRate: "",
  oxygenSaturation: "",
  weightKg: "",
  heightCm: "",
  painScore: "",
};

const CORE: { key: keyof VitalsForm; label: string }[] = [
  { key: "systolic", label: "systolic BP" },
  { key: "diastolic", label: "diastolic BP" },
  { key: "heartRate", label: "heart rate" },
  { key: "temperatureF", label: "temperature" },
  { key: "respiratoryRate", label: "respiratory rate" },
  { key: "oxygenSaturation", label: "SpO2" },
];

function num(text: string): number | null {
  const t = text.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** The core vitals still empty, by name — Save waits for all six. */
export function missingCoreVitals(form: VitalsForm): string[] {
  return CORE.filter(({ key }) => num(form[key]) === null).map(({ label }) => label);
}

/** One saved set from the form, or null while a core vital is missing. */
export function vitalsFromForm(form: VitalsForm, at: string, by: string): RecordedVitals | null {
  if (missingCoreVitals(form).length > 0) return null;
  const optional = (text: string) => {
    const n = num(text);
    return n === null ? undefined : n;
  };
  const record: RecordedVitals = {
    recordedAt: at,
    recordedBy: by,
    systolic: num(form.systolic)!,
    diastolic: num(form.diastolic)!,
    heartRate: num(form.heartRate)!,
    temperatureF: num(form.temperatureF)!,
    respiratoryRate: num(form.respiratoryRate)!,
    oxygenSaturation: num(form.oxygenSaturation)!,
  };
  const weightKg = optional(form.weightKg);
  const heightCm = optional(form.heightCm);
  const painScore = optional(form.painScore);
  if (weightKg !== undefined) record.weightKg = weightKg;
  if (heightCm !== undefined) record.heightCm = heightCm;
  if (painScore !== undefined) record.painScore = painScore;
  return record;
}

/** The form, filled from a saved set (to re-measure or correct it). */
export function formFromVitals(v: RecordedVitals | null | undefined): VitalsForm {
  if (!v) return { ...EMPTY_VITALS_FORM };
  const s = (n: number | undefined) => (n === undefined ? "" : String(n));
  return {
    systolic: s(v.systolic),
    diastolic: s(v.diastolic),
    heartRate: s(v.heartRate),
    temperatureF: s(v.temperatureF),
    respiratoryRate: s(v.respiratoryRate),
    oxygenSaturation: s(v.oxygenSaturation),
    weightKg: s(v.weightKg),
    heightCm: s(v.heightCm),
    painScore: s(v.painScore),
  };
}

/** The most recent saved set. */
export function latestVitals(list: RecordedVitals[] | null | undefined): RecordedVitals | null {
  const all = (list ?? []).filter((v) => v && typeof v.recordedAt === "string");
  if (all.length === 0) return null;
  return [...all].sort((a, b) => (a.recordedAt < b.recordedAt ? -1 : 1))[all.length - 1];
}

/** The shape the sidebar, the note and the sign checklist already read. */
export function editableFromVitals(v: RecordedVitals | null) {
  if (!v) return { bloodPressure: "", heartRate: "", temperature: "", respiratoryRate: "", oxygenSaturation: "" };
  return {
    bloodPressure: `${v.systolic}/${v.diastolic}`,
    heartRate: String(v.heartRate),
    temperature: String(v.temperatureF),
    respiratoryRate: String(v.respiratoryRate),
    oxygenSaturation: String(v.oxygenSaturation),
  };
}

/** A saved list from storage, keeping only well-formed sets. */
export function normalizeVitalsList(raw: unknown): RecordedVitals[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (v): v is RecordedVitals =>
      !!v &&
      typeof v === "object" &&
      typeof (v as RecordedVitals).recordedAt === "string" &&
      ["systolic", "diastolic", "heartRate", "temperatureF", "respiratoryRate", "oxygenSaturation"].every(
        (k) => typeof (v as unknown as Record<string, unknown>)[k] === "number",
      ),
  );
}
