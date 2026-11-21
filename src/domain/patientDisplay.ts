/**
 * patientDisplay.ts — the small, shared readings of a patient record
 *
 * Inspired by: the row furniture of Epic's Patient Lists and eClinicalWorks'
 * Inbox — an avatar with the patient's own initials, and how long it has been
 * since anyone last touched their chart.
 *
 * Two defects the lead found by eye on the preview (2026-11-21) live here, so
 * both are fixed once and can be tested without a browser:
 *
 *  1. **Initials came from the wrong record.** The Schedule card printed the
 *     PROVIDER's initials (`DL` for Dr. Sarah Lee) while the Inbox printed the
 *     patient's (`AO`) for the same appointment. One function now derives them
 *     from the patient's name, and both screens call it.
 *  2. **"2d idle" was fabricated.** The Inbox printed a number from a
 *     `[2, 3, 1, 4, …]` array indexed by row position — there was no last-seen
 *     date on the patient at all, so a patient booked seconds ago read as two
 *     days idle and the number changed when the list reordered. `lastSeenLabel`
 *     prints a figure only when the record carries a real `lastSeenAt`, and
 *     prints nothing at all when it does not.
 *
 * Pure: no React, no store, no clock of its own (the caller may pass `now`).
 */

/** The initials of a patient's own name: "Amara Okafor" → "AO". */
export function patientInitials(firstName: string, lastName: string): string {
  const first = (firstName ?? "").trim();
  const last = (lastName ?? "").trim();
  if (!first && !last) return "?";
  if (!last) return first.slice(0, 2).toUpperCase();
  if (!first) return last.slice(0, 2).toUpperCase();
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

/** The initials of a free-text name, for a row that only carries a display name. */
export function initialsFromName(name: string): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return patientInitials(parts[0], parts[parts.length - 1]);
}

/** How long ago a chart was last touched, and the colour the dot carries. */
export interface LastSeenLabel {
  /** "Seen today", "Seen 1d ago" — never a figure the record does not hold. */
  label: string;
  /** The tone the priority dot uses: fresh, getting old, old. */
  tone: string;
}

/**
 * "Seen today" / "Seen Nd ago" from a real timestamp, or `null` when the patient
 * record has none. A missing date is not a made-up zero and not a made-up two.
 */
export function lastSeenLabel(lastSeenAt: string | null | undefined, now: Date = new Date()): LastSeenLabel | null {
  const raw = (lastSeenAt ?? "").trim();
  if (!raw) return null;
  const seen = new Date(raw);
  if (Number.isNaN(seen.getTime())) return null;
  const days = Math.floor((now.getTime() - seen.getTime()) / 86_400_000);
  const tone = days >= 3 ? "text-rose-500" : days >= 1 ? "text-amber-500" : "text-emerald-500";
  if (days <= 0) return { label: "Seen today", tone };
  return { label: `Seen ${days}d ago`, tone };
}
