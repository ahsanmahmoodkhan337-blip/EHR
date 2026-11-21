/**
 * priorAuthForClaim — the only prior authorisation number a claim may print in
 * box 23 (CMS-1500) / box 63 (UB-04).
 *
 * Owner audit, 2026-11-21 (spec `slice-i-patient-record.md` item 3): box 23 used
 * to carry `PA-2026-004418`, another patient's authorisation, printed as a demo
 * value for every claim. An authorisation number is not a teaching placeholder —
 * it is a claim the payer will match against its own file, and one that names a
 * different patient or a different procedure denies the whole claim.
 *
 * The rule: box 23 carries **this encounter's own** authorisation, and nothing
 * else. The encounter's PA (written by the Prior Auth stage into `paData`) is the
 * only source; when it is missing the box stays empty and the claim's provenance
 * strip names the stage that supplies it.
 *
 * When both the authorisation and the encounter list CPT codes, the
 * authorisation must cover at least one coded procedure. A PA for a procedure
 * this encounter did not perform does not authorise this claim, so it is not
 * printed. When either list is empty there is nothing to compare against and the
 * encounter's own number stands — nothing is invented in either direction.
 *
 * Inspiration: the "auth required / auth on file" match a payer's claim editor
 * runs against the 278 before it prices an 837P line.
 */

/** The encounter-side facts box 23 is decided from. */
export interface PriorAuthSource {
  /** The encounter's own prior authorisation (written by the Prior Auth stage). */
  paData?: Record<string, string> | null;
  /** The CPT codes this encounter coded. */
  cptCodes?: (string | null | undefined)[] | null;
}

const clean = (value: unknown): string => String(value ?? "").trim();

/** "99213, 27447" / "99213 27447" / "99213;27447" → ["99213","27447"]. */
function codeList(raw: unknown): string[] {
  return clean(raw)
    .split(/[,\s;]+/)
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);
}

/**
 * The authorisation number this encounter's claim may print, or "" when the
 * encounter has none of its own or its authorisation covers none of its coded
 * procedures.
 */
export function priorAuthForClaim({ paData, cptCodes }: PriorAuthSource = {}): string {
  const paId = clean(paData?.paId);
  if (!paId) return "";

  const authorised = codeList(paData?.cptCodes);
  const coded = (cptCodes ?? []).map(clean).filter(Boolean).map((c) => c.toUpperCase());
  if (authorised.length === 0 || coded.length === 0) return paId;

  return coded.some((code) => authorised.includes(code)) ? paId : "";
}
