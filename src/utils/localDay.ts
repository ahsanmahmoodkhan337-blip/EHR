/**
 * localDay — the calendar date the student sees on their own clock.
 *
 * `new Date().toISOString().slice(0, 10)` is the date in UTC, not the student's
 * date. For a student in Pakistan (UTC+5) it is still "yesterday" from midnight
 * to 5 AM, so a remittance posted at 12:30 AM was dated before the visit it
 * paid, and day counts (AR aging, appeal deadlines) slipped by one.
 *
 * - No argument: today's local date.
 * - A plain `YYYY-MM-DD` string is already a calendar date and is returned as is
 *   (parsing it would read it as UTC midnight and could shift it a day).
 * - A timestamp string, a Date or epoch milliseconds: the local date of that
 *   moment.
 */
export function localDay(value?: string | Date | number | null): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = value === undefined || value === null ? new Date() : new Date(value);
  if (Number.isNaN(d.getTime())) return typeof value === "string" ? value.slice(0, 10) : "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
