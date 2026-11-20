/**
 * Eligibility — the 270/271 answer a coverage keeps
 * (`specs/patient-hub.md` § Insurance).
 *
 * Inspired by: eClinicalWorks' eligibility check at check-in, where the payer's
 * 271 reply is filed against the coverage and the patient banner reads it back
 * on every screen. The reply is a record, not a screen state: it is written once
 * by the check-in (or the Insurance tab), stored on the coverage, and shown with
 * the date it was received.
 *
 * What the simulated 271 says is decided only by what the coverage record holds:
 * a payer and a member ID mean the plan can match the member; a missing member
 * ID means it cannot. Nothing here is random and nothing is invented — a patient
 * whose coverage was never checked reads `not-checked`, never `active`.
 */

/** The three states a coverage's eligibility can be in. */
export type EligibilityStatus = "active" | "inactive" | "not-checked";

export interface EligibilityRecord {
  status: EligibilityStatus;
  /** ISO timestamp the 270/271 ran. Empty while `not-checked`. */
  checkedAt: string;
  /** The 271's own words, short — what the payer answered. */
  payerResponse: string;
}

/** What a coverage with no stored 271 reads as. */
export const NOT_CHECKED: EligibilityRecord = {
  status: "not-checked",
  checkedAt: "",
  payerResponse: "",
};

/** Short labels for the banner, the Insurance tab and the check-in row. */
export const ELIGIBILITY_LABELS: Record<EligibilityStatus, string> = {
  active: "Eligible",
  inactive: "Not eligible",
  "not-checked": "Not checked",
};

/** The coverage fields the simulated 271 can actually read. */
export interface EligibilityCoverage {
  payerName?: string;
  ediPayerId?: string;
  subscriberId?: string;
  groupNumber?: string;
  relationshipToSubscriber?: string;
  planName?: string;
  eligibility?: EligibilityRecord;
}

/**
 * The stored record for a coverage, or `not-checked` when the record predates
 * eligibility or has no coverage at all. Never upgrades an unchecked coverage to
 * `active` on its own.
 */
export function eligibilityOf(
  coverage: EligibilityCoverage | null | undefined,
): EligibilityRecord {
  const stored = coverage?.eligibility;
  if (!stored) return NOT_CHECKED;
  const status: EligibilityStatus =
    stored.status === "active" || stored.status === "inactive" ? stored.status : "not-checked";
  if (status === "not-checked") return NOT_CHECKED;
  return {
    status,
    checkedAt: typeof stored.checkedAt === "string" ? stored.checkedAt : "",
    payerResponse: typeof stored.payerResponse === "string" ? stored.payerResponse : "",
  };
}

/**
 * Run the 270/271 for one coverage and return the record to store.
 *
 * The answer follows the record: no payer on file cannot be verified (no
 * coverage), a payer with no member ID cannot be matched (inactive — the member
 * ID is what a payer matches on), and a payer with a member ID is active. The
 * reply names the payer and the member ID it matched so a student can see what
 * the answer was based on.
 */
export function runEligibility270(
  coverage: EligibilityCoverage | null | undefined,
  at: string,
): EligibilityRecord {
  const payer = (coverage?.payerName ?? "").trim();
  const member = (coverage?.subscriberId ?? "").trim();
  const plan = (coverage?.planName ?? "").trim();

  if (!payer) {
    return {
      status: "inactive",
      checkedAt: at,
      payerResponse: "271: no payer on file for this patient — coverage could not be verified.",
    };
  }

  if (!member) {
    return {
      status: "inactive",
      checkedAt: at,
      payerResponse: `271: ${payer} — no member ID on the coverage, so the member could not be matched.`,
    };
  }

  return {
    status: "active",
    checkedAt: at,
    payerResponse: `271: ${payer} — active${plan ? `, ${plan}` : ""}; member ${member} matched.`,
  };
}

/** `11/20/2026` — the date the 271 was received, or "" when never checked. */
export function eligibilityDate(record: EligibilityRecord): string {
  if (!record.checkedAt) return "";
  const parsed = new Date(record.checkedAt);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

/** What the banner prints: the result and the date, e.g. `Eligible · 11/20/2026`. */
export function eligibilitySummary(record: EligibilityRecord): string {
  if (record.status === "not-checked") return "Eligibility not checked";
  const date = eligibilityDate(record);
  return date ? `${ELIGIBILITY_LABELS[record.status]} · ${date}` : ELIGIBILITY_LABELS[record.status];
}
