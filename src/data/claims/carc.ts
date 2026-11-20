/**
 * CARC — Claim Adjustment Reason Codes: the single teaching table.
 *
 * THERE IS ONE COPY OF THIS TABLE. Every screen and every scenario data file
 * imports from here; nothing else may hold its own list of CO-/PR-/OA- codes
 * or its own wording for one.
 *
 * WHY THIS FILE EXISTS
 * A student who learns a code wrong will mis-appeal every claim that carries it.
 * Before this table the app held six copies and three of them taught the wrong
 * meaning: CO-97 was described as "benefit exhausted" (that is CO-119), CO-119
 * as "prior authorization required" (that is CO-197 or CO-15), and OA-23 as
 * "procedure code inconsistent with the diagnosis" (that is CO-11). OA-100,
 * which does not exist, was offered to students in a dropdown. All of that is
 * gone; this table is the only place a code is defined.
 *
 * WORDING
 * Code numbers are identifiers and are used as-is. Every description, meaning
 * and action below is our own plain-language teaching wording, written for a
 * student who has never seen a real remittance — not X12/AMA text.
 *
 * GROUP SEMANTICS (taught on every row)
 *   CO — provider write-off; never bill the patient.
 *   PR — patient owes it.
 *   OA — other adjustment; another payer's share of the same service.
 *   PI — payer-initiated; the payer must state why it acted.
 *
 * NOT SHIPPED, ON PURPOSE
 *   OA-100 — no such code. Missing prior auth is CO-197 (or CO-15 when a number
 *            was given but is invalid).
 *   CO-180 as "invalid procedure code" — that meaning is CO-181.
 *   CO-177 as "credentialing" — unverified; the credentialing-class code here
 *            is B7 and it is not AR work.
 *   Any RARC number. RARC stays free text in this build; no RARC list ships.
 */

/** The four adjustment groups. */
export type CarcGroup = "CO" | "PR" | "OA" | "PI";

/** Which role works this code. */
export type CarcRole = "Biller" | "Poster" | "AR";

export interface CarcCode {
  /** Group and number together, e.g. "CO-97" — the key the app stores. */
  code: string;
  /** Adjustment group, first half of `code`. */
  group: CarcGroup;
  /** Mirrors `group`. Kept because the Billing Ledger denial reference renders this field name. */
  category: CarcGroup;
  /** Short label for a dropdown row or a badge. */
  description: string;
  /** What the payer did and why — the teaching meaning, in plain language. */
  meaning: string;
  /** The mapped action: the one right next move for this code. */
  howToFix: string;
  /** The roles whose queue this code lands in. */
  neededBy: readonly CarcRole[];
}

/**
 * The table. Order follows the reference order used in the teaching material:
 * grouping and bundling first, then information, coverage, money, then PR.
 */
export const CARC_CODES = [
  {
    code: "CO-4",
    group: "CO",
    category: "CO",
    description: "Modifier missing or not valid for the procedure",
    meaning:
      "The line needs a modifier that was left off, or the modifier on it does not fit what the procedure allows.",
    howToFix:
      "Correct the line and resubmit with the right modifier (frequency code 7 on a corrected claim).",
    neededBy: ["Biller", "AR"],
  },
  {
    code: "CO-11",
    group: "CO",
    category: "CO",
    description: "Diagnosis does not support the procedure",
    meaning:
      "The diagnosis codes on the claim do not justify the service that was billed.",
    howToFix:
      "Correct the diagnosis-to-procedure pairing, or appeal with the note that shows why the service was needed.",
    neededBy: ["Biller", "AR"],
  },
  {
    code: "CO-15",
    group: "CO",
    category: "CO",
    description: "Authorization missing, invalid, or not for this service",
    meaning:
      "The authorization number is absent, is not valid, or does not cover this service, provider, or date of service.",
    howToFix:
      "Obtain the authorization, or appeal with the approval on file showing it matches this code and date.",
    neededBy: ["Biller", "AR"],
  },
  {
    code: "CO-16",
    group: "CO",
    category: "CO",
    description: "Missing information the payer needs",
    meaning:
      "The claim arrived without something the payer needs before it can decide — a field, an NPI, a modifier, an attachment.",
    howToFix: "Find the missing element, correct it, and resubmit the claim.",
    neededBy: ["Biller", "AR"],
  },
  {
    code: "CO-18",
    group: "CO",
    category: "CO",
    description: "Duplicate claim or service",
    meaning:
      "The payer already has an identical claim for this patient and this date of service.",
    howToFix:
      "Find the original before rebilling. If this is truly a second service, resubmit with the detail that distinguishes it; if it is a duplicate, stop the rebill.",
    neededBy: ["Biller", "AR"],
  },
  {
    code: "CO-22",
    group: "CO",
    category: "CO",
    description: "May be another payer's responsibility",
    meaning:
      "This plan believes another payer is primary for this service, so it is not paying as billed.",
    howToFix:
      "Update the coordination-of-benefits order and attach the other payer's EOB before resubmitting.",
    neededBy: ["Biller", "Poster", "AR"],
  },
  {
    code: "OA-23",
    group: "OA",
    category: "OA",
    description: "Adjusted for another payer's earlier decision",
    meaning:
      "Another payer adjudicated this service first, and its payment or adjustment carries through to this claim. It is not this payer's own denial.",
    howToFix:
      "Update coordination of benefits and attach the other payer's EOB; this amount is the other payer's share, not a write-off.",
    neededBy: ["Poster", "AR"],
  },
  {
    code: "CO-29",
    group: "CO",
    category: "CO",
    description: "Filing deadline passed",
    meaning: "The claim reached the payer after its filing deadline.",
    howToFix:
      "Appeal with proof it was submitted on time (clearinghouse report or payer acknowledgement). If it was never sent in time, take the approved write-off.",
    neededBy: ["Biller", "Poster", "AR"],
  },
  {
    code: "CO-45",
    group: "CO",
    category: "CO",
    description: "Charge above the contracted allowance",
    meaning:
      "The billed charge is higher than the fee schedule or contract allows, so the difference is not payable.",
    howToFix:
      "Write the difference off as contractual. Never bill the patient for it.",
    neededBy: ["Poster", "AR"],
  },
  {
    code: "CO-50",
    group: "CO",
    category: "CO",
    description: "Payer says the service was not medically necessary",
    meaning:
      "The payer does not accept that the record supports the need for this service.",
    howToFix:
      "Appeal with the clinical documentation that shows the need — the note, the failed conservative care, the results that led to the decision.",
    neededBy: ["Poster", "AR"],
  },
  {
    code: "CO-96",
    group: "CO",
    category: "CO",
    description: "Not covered by this plan",
    meaning: "The plan excludes this service from its benefits entirely.",
    howToFix:
      "Move the balance to the patient with a signed waiver. A plan exclusion is not appealable on clinical grounds.",
    neededBy: ["Poster", "AR"],
  },
  {
    code: "CO-97",
    group: "CO",
    category: "CO",
    description: "Already paid as part of another service",
    meaning:
      "The payer treats this service as a component of another service it already paid, so it is not paid a second time.",
    howToFix:
      "Re-read the note. Report the service separately with modifier 59 only if it was truly distinct; otherwise write it off as bundled.",
    neededBy: ["Poster", "AR"],
  },
  {
    code: "CO-109",
    group: "CO",
    category: "CO",
    description: "This payer is not the right payer",
    meaning:
      "The claim was sent to a payer that is not responsible for it as submitted.",
    howToFix: "Identify the correct payer and send the claim there.",
    neededBy: ["Biller"],
  },
  {
    code: "CO-119",
    group: "CO",
    category: "CO",
    description: "Benefit maximum reached",
    meaning:
      "The patient has used up the benefit this plan allows for this service, this period, or this occurrence.",
    howToFix:
      "Move the balance to the patient, or pursue a coverage decision for more visits. A used-up benefit is not an appeal on necessity.",
    neededBy: ["Poster", "AR"],
  },
  {
    code: "CO-151",
    group: "CO",
    category: "CO",
    description: "Units or frequency exceed what was submitted",
    meaning:
      "What the claim supports does not justify this many services, or this many in this period.",
    howToFix:
      "Correct the units or frequency to what the documentation supports, or appeal with the documentation.",
    neededBy: ["Poster", "AR"],
  },
  {
    code: "CO-181",
    group: "CO",
    category: "CO",
    description: "Procedure code not valid on the service date",
    meaning:
      "The code billed was not a valid code on the date the service was performed.",
    howToFix: "Correct the code to one valid on that date and resubmit.",
    neededBy: ["Biller"],
  },
  {
    code: "CO-197",
    group: "CO",
    category: "CO",
    description: "No record of the required authorization",
    meaning:
      "The payer has no record of the precertification or authorization this service required.",
    howToFix:
      "Obtain the authorization, or file a retro-authorization appeal with the record showing why the service could not wait.",
    neededBy: ["Biller", "AR"],
  },
  {
    code: "CO-236",
    group: "CO",
    category: "CO",
    description: "Not payable with another code billed the same day",
    meaning:
      "The payer's procedure-pair edit says this code cannot be paid alongside another code on the same claim.",
    howToFix:
      "Correct the coding. Use modifier 59 only if the two services were genuinely separate; otherwise bill the one service that describes what was done.",
    neededBy: ["Biller", "AR"],
  },
  {
    code: "CO-B7",
    group: "CO",
    category: "CO",
    description: "Provider not eligible to be paid on that date",
    meaning:
      "The rendering provider was not credentialed or otherwise eligible for payment on the date of service.",
    howToFix:
      "Route it to credentialing. This is not AR follow-up work, and no appeal fixes it until the provider is enrolled.",
    neededBy: ["AR"],
  },
  {
    code: "PR-1",
    group: "PR",
    category: "PR",
    description: "Deductible not met",
    meaning:
      "The patient's deductible is not met, so the plan applies this amount to it.",
    howToFix: "Bill the patient.",
    neededBy: ["Poster", "AR"],
  },
  {
    code: "PR-2",
    group: "PR",
    category: "PR",
    description: "Coinsurance",
    meaning:
      "The patient's share of the allowed amount after the plan pays its percentage.",
    howToFix: "Bill the patient.",
    neededBy: ["Poster", "AR"],
  },
  {
    code: "PR-3",
    group: "PR",
    category: "PR",
    description: "Copay",
    meaning: "The fixed amount the patient owes for this visit or service.",
    howToFix: "Bill the patient.",
    neededBy: ["Poster", "AR"],
  },
] as const satisfies readonly CarcCode[];

/** Any code string that is in the table — a wrong code will not type-check. */
export type CarcCodeString = (typeof CARC_CODES)[number]["code"];

/** Lookup by the stored form ("CO-97"). */
export const CARC_BY_CODE: Record<string, CarcCode> = Object.fromEntries(
  CARC_CODES.map((c) => [c.code, c as CarcCode]),
);

/** What the group letter means for the money. Taught on every code row. */
export const CARC_GROUP_MEANINGS: Record<CarcGroup, string> = {
  CO: "Contractual obligation — the provider writes it off; never bill the patient.",
  PR: "Patient responsibility — the patient owes it.",
  OA: "Other adjustment — another payer's share of the same service.",
  PI: "Payer initiated — the payer must state why it took the action.",
};

/** The group a stored code belongs to, or null when the code is not in the table. */
export function groupOf(code: string): CarcGroup | null {
  const entry = CARC_BY_CODE[code];
  if (entry) return entry.group;
  const prefix = code.split("-")[0]?.toUpperCase();
  return prefix === "CO" || prefix === "PR" || prefix === "OA" || prefix === "PI"
    ? prefix
    : null;
}

/** The mapped action for a code, or null when the code is not in the table. */
export function carcAction(code: string): string | null {
  return CARC_BY_CODE[code]?.howToFix ?? null;
}
