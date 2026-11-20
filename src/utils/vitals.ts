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
