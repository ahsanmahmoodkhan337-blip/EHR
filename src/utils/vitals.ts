/**
 * Vitals display helpers.
 *
 * A measurement that was never taken must read "—", never "0 bpm" or "0°F".
 * A real zero is not clinically plausible for pulse, temperature, respiration
 * or oxygen saturation, so 0 and "" are both treated as "not recorded" — the
 * same rule the right-hand summary, the chart tabs and the vitals stage use.
 */

export type VitalValue = string | number | null | undefined;

/** True when a vitals value was actually recorded (non-empty, not zero, numeric-safe). */
export function hasVital(value: VitalValue): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return Number.isFinite(value) && value !== 0;
  const text = value.trim();
  if (!text) return false;
  const num = Number(text);
  return Number.isNaN(num) ? true : num !== 0;
}

/** A vitals value with its unit, or "—" when it was never recorded. */
export function formatVital(value: VitalValue, unit = ""): string {
  if (!hasVital(value) || value === null || value === undefined) return "—";
  const text = typeof value === "number" ? String(value) : value.trim();
  return `${text}${unit}`;
}

export interface VitalsCheckInput {
  systolic: number;
  diastolic: number;
  heartRate: number;
  temperatureF: number;
  respiratoryRate: number;
  oxygenSaturation: number;
}

export interface VitalsCheck {
  /** Values that cannot be right (a typo, or two boxes swapped). */
  impossible: string[];
  /** Real but abnormal values worth a second look before the note is signed. */
  abnormal: string[];
}

/**
 * Plausibility of a set of vitals. Impossible values are almost always a typo
 * or a value typed into the wrong box (SpO2 165%, BP 78/98); the scribe should
 * fix them before the note carries them. Abnormal values are flagged, not
 * refused — a sick patient's vitals are allowed to be abnormal.
 */
export function checkVitals(v: VitalsCheckInput): VitalsCheck {
  const impossible: string[] = [];
  const abnormal: string[] = [];
  const recorded = (n: number) => Number.isFinite(n) && n !== 0;

  if (recorded(v.systolic) && recorded(v.diastolic) && v.diastolic >= v.systolic) {
    impossible.push(`BP ${v.systolic}/${v.diastolic}: the diastolic (bottom) number must be lower than the systolic (top).`);
  }
  if (recorded(v.systolic) && (v.systolic < 50 || v.systolic > 260)) impossible.push(`Systolic ${v.systolic} mmHg is outside 50–260.`);
  if (recorded(v.diastolic) && (v.diastolic < 20 || v.diastolic > 160)) impossible.push(`Diastolic ${v.diastolic} mmHg is outside 20–160.`);
  if (recorded(v.heartRate) && (v.heartRate < 20 || v.heartRate > 250)) impossible.push(`Heart rate ${v.heartRate} bpm is outside 20–250.`);
  if (recorded(v.temperatureF) && (v.temperatureF < 90 || v.temperatureF > 110)) impossible.push(`Temperature ${v.temperatureF}°F is outside 90–110°F.`);
  if (recorded(v.respiratoryRate) && (v.respiratoryRate < 4 || v.respiratoryRate > 60)) impossible.push(`Respiratory rate ${v.respiratoryRate}/min is outside 4–60.`);
  if (recorded(v.oxygenSaturation) && (v.oxygenSaturation < 50 || v.oxygenSaturation > 100)) impossible.push(`SpO2 ${v.oxygenSaturation}% must be between 50 and 100.`);

  if (impossible.length === 0) {
    if (v.systolic >= 180 || v.diastolic >= 120) abnormal.push("BP at or above 180/120 — hypertensive crisis range; tell the provider now.");
    else if (v.systolic >= 140 || v.diastolic >= 90) abnormal.push("BP at or above 140/90.");
    if (recorded(v.heartRate) && (v.heartRate > 100 || v.heartRate < 50)) abnormal.push(`Heart rate ${v.heartRate} bpm is outside 50–100.`);
    if (recorded(v.temperatureF) && v.temperatureF >= 100.4) abnormal.push(`Temperature ${v.temperatureF}°F is a fever (≥ 100.4°F).`);
    if (recorded(v.oxygenSaturation) && v.oxygenSaturation < 92) abnormal.push(`SpO2 ${v.oxygenSaturation}% is low (< 92%).`);
    if (recorded(v.respiratoryRate) && (v.respiratoryRate > 24 || v.respiratoryRate < 10)) abnormal.push(`Respiratory rate ${v.respiratoryRate}/min is outside 10–24.`);
  }
  return { impossible, abnormal };
}
