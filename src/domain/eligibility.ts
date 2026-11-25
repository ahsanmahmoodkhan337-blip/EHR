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
 *
 * The 271 also runs the **name check** its copy promises: the subscriber name
 * the payer's file holds (the spelling printed on the insurance card) against the
 * name on the registration card. The answer is a result on the record — the
 * student reads it and decides what to do; nothing is corrected for them
 * (standing rule 6).
 */

import { planForPayerNameStrict } from "./adjudication";
import { caseMismatch, patientCard, type CardHolder } from "./patientCard";

/** The three states a coverage's eligibility can be in. */
export type EligibilityStatus = "active" | "inactive" | "not-checked";

/**
 * What the 271's name check found.
 *
 * `not-compared` is not a failure: it is a reply that carried no name to compare
 * — an older stored record, a coverage with no name on file, or a subscriber who
 * is not the patient. It never reads as a match.
 */
export type EligibilityNameCheck = "match" | "mismatch" | "not-compared";

export interface EligibilityRecord {
  status: EligibilityStatus;
  /** ISO timestamp the 270/271 ran. Empty while `not-checked`. */
  checkedAt: string;
  /** The 271's own words, short — what the payer answered, name check included. */
  payerResponse: string;
  /**
   * The subscriber name the payer's file holds, as the 271 returned it — the
   * spelling printed on the insurance card. "" when no name was compared.
   */
  payerNameOnFile: string;
  /** The name on the registration card the 270 carried. "" when no name was compared. */
  cardName: string;
  /** What the name check found (`EligibilityNameCheck`). */
  nameCheck: EligibilityNameCheck;
}

/** What a coverage with no stored 271 reads as. */
export const NOT_CHECKED: EligibilityRecord = {
  status: "not-checked",
  checkedAt: "",
  payerResponse: "",
  payerNameOnFile: "",
  cardName: "",
  nameCheck: "not-compared",
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
  /** The subscriber name on the coverage record — the name the 270 carries. */
  subscriberName?: string;
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
    // A record saved before the 271 ran a name check carries none of these. It
    // reads `not-compared` — never a match it never made (standing rule 3).
    payerNameOnFile:
      typeof stored.payerNameOnFile === "string" ? stored.payerNameOnFile : "",
    cardName: typeof stored.cardName === "string" ? stored.cardName : "",
    nameCheck:
      stored.nameCheck === "match" || stored.nameCheck === "mismatch"
        ? stored.nameCheck
        : "not-compared",
  };
}

/** Name tokens, case-, punctuation- and order-insensitive: "Khan, Amir" and "Amir Khan" agree. */
function nameTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort();
}

/** True when the two spellings name the same person. A transposition is a mismatch. */
function sameName(left: string, right: string): boolean {
  const a = nameTokens(left);
  const b = nameTokens(right);
  return a.length > 0 && a.join(" ") === b.join(" ");
}

/** The name half of the 271: the two names, the result, and the sentence it prints. */
interface NameCheckAnswer {
  payerNameOnFile: string;
  cardName: string;
  nameCheck: EligibilityNameCheck;
  /** The result in the 271's own words, including what it means for eligibility. */
  sentence: string;
}

/**
 * The name check the 271 runs: the subscriber name the payer's file holds
 * against the name on the registration card.
 *
 * The payer's spelling comes from the member name on the insurance card — the
 * payer prints the card from its own file, so the card's spelling *is* the
 * payer's, including the one hand-transcription error a case carries
 * (`caseMismatch`). The registration card's name is the patient's own
 * (`patientCard().fullName`). The comparison ignores case, punctuation and word
 * order, so "Khan, Amir" and "Amir Khan" are one person; a transposed pair of
 * letters is not.
 *
 * The result is reported, never corrected: the 271 says what the payer holds and
 * what the chart holds and leaves the decision to the student (standing rule 6).
 */
function runNameCheck(
  coverage: EligibilityCoverage | null | undefined,
  holder: CardHolder | null | undefined,
): NameCheckAnswer {
  const cardName = (holder ? patientCard(holder).fullName : "").trim();
  const relationship = (coverage?.relationshipToSubscriber ?? "").trim();
  const payerNameOnFile =
    (caseMismatch(holder)?.onCard ?? "").trim() || (coverage?.subscriberName ?? "").trim();

  // A spouse or a child is a different person from the patient: the payer's
  // subscriber name is theirs, so comparing it with the patient's name would
  // report a mismatch that is not one.
  if (relationship && relationship.toLowerCase() !== "self") {
    return {
      payerNameOnFile,
      cardName,
      nameCheck: "not-compared",
      sentence:
        `The subscriber on this coverage is not the patient (relationship ${relationship}), ` +
        `so the 271 matched the member ID and did not compare the patient's name.`,
    };
  }

  if (!cardName || !payerNameOnFile) {
    return {
      payerNameOnFile: "",
      cardName,
      nameCheck: "not-compared",
      sentence: cardName
        ? "No subscriber name was compared — the coverage holds no subscriber name for the payer to match."
        : "No subscriber name was compared — the 270 carried no registration name to match.",
    };
  }

  if (sameName(payerNameOnFile, cardName)) {
    return {
      payerNameOnFile,
      cardName,
      nameCheck: "match",
      sentence: `Subscriber name “${cardName}” matches the payer's file.`,
    };
  }

  return {
    payerNameOnFile,
    cardName,
    nameCheck: "mismatch",
    sentence:
      `The subscriber name does not match the payer's file: the payer holds “${payerNameOnFile}” ` +
      `(the spelling on the insurance card) and the registration card holds “${cardName}”. ` +
      `The plan answered for the member ID, but a claim submitted with the chart's name denies ` +
      `as a name mismatch until the payer's file carries the chart's spelling.`,
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
 *
 * `holder` is the patient the registration card belongs to. When it is passed the
 * 271 also runs the name check and stores its result; without it the reply says
 * no name was compared rather than claiming a match it never made.
 */
export function runEligibility270(
  coverage: EligibilityCoverage | null | undefined,
  at: string,
  holder?: CardHolder | null,
): EligibilityRecord {
  const payer = (coverage?.payerName ?? "").trim();
  const member = (coverage?.subscriberId ?? "").trim();
  const plan = (coverage?.planName ?? "").trim();

  if (!payer) {
    return {
      status: "inactive",
      checkedAt: at,
      payerResponse: "271: no payer on file for this patient — coverage could not be verified.",
      payerNameOnFile: "",
      cardName: "",
      nameCheck: "not-compared",
    };
  }

  if (!member) {
    return {
      status: "inactive",
      checkedAt: at,
      payerResponse: `271: ${payer} — no member ID on the coverage, so the member could not be matched.`,
      payerNameOnFile: "",
      cardName: "",
      nameCheck: "not-compared",
    };
  }

  const name = runNameCheck(coverage, holder);
  return {
    status: "active",
    checkedAt: at,
    payerResponse: `271: ${payer} — active${plan ? `, ${plan}` : ""}; member ${member} matched. ${name.sentence}`,
    payerNameOnFile: name.payerNameOnFile,
    cardName: name.cardName,
    nameCheck: name.nameCheck,
  };
}

/**
 * The name check as one short line for the screen: what the 271 found, with the
 * payer's spelling when it matched and the plain result when it did not (the
 * full sentence, with both spellings and the consequence, is in `payerResponse`).
 */
export function eligibilityNameCheckLabel(record: EligibilityRecord): string {
  if (record.status === "not-checked") return "";
  if (record.nameCheck === "match") {
    return record.payerNameOnFile
      ? `Matched — the payer's file holds “${record.payerNameOnFile}”`
      : "Matched";
  }
  if (record.nameCheck === "mismatch") return "Does not match the payer's file";
  return "Not compared";
}

/**
 * The benefit figures a 271 answers with, and where each one came from.
 *
 * Every number is read from the **same plan table that prices this patient's
 * 835** (`data/medical/payerScenarios.ts`, resolved through
 * `planForPayerNameStrict`), so the copay the front desk is quoted and the money
 * the remittance moves cannot disagree. A payer the table has no rule for
 * returns no figures at all and says so — a 271 that printed the teaching
 * baseline's money for an unknown payer would be inventing it.
 */
export interface Eligibility271Benefits {
  /** Fixed office copay in dollars, or null when this plan design has none. */
  copayUsd: number | null;
  /**
   * Individual deductible still to be met, in dollars. The deductible always
   * starts unmet in this simulator (an existing honest limit): nothing is posted
   * against it until a claim runs through adjudication.
   */
  deductibleRemainingUsd: number | null;
  /** The patient's share of the allowed amount after the deductible, as a whole percent. */
  coinsurancePercent: number | null;
  /** The plan the figures came from, by its name in the plan table. */
  planName: string | null;
  /** The plan design, e.g. "Commercial PPO". */
  planType: string | null;
  /** Where the figures came from — printed on the 271 so every number is traceable. */
  source: string;
}

/** The 271's answer for a coverage that names no payer: no plan, no figures. */
function noPlanAnswer(source: string): Eligibility271Benefits {
  return {
    copayUsd: null,
    deductibleRemainingUsd: null,
    coinsurancePercent: null,
    planName: null,
    planType: null,
    source,
  };
}

/**
 * Run the benefit half of the 271 for one coverage: copay, deductible remaining
 * and coinsurance, taken from that patient's own plan.
 *
 * `source` names the plan and the table it came from, so a student can trace
 * every figure back to a rule rather than to a screen. No payer on file, or a
 * payer with no plan rule, returns null figures and a source that says which.
 */
export function eligibility271(
  coverage: EligibilityCoverage | null | undefined,
): Eligibility271Benefits {
  const payer = (coverage?.payerName ?? "").trim();
  if (!payer) {
    return noPlanAnswer("No payer on file — there is no plan to read a benefit from.");
  }

  const plan = planForPayerNameStrict(payer);
  if (!plan) {
    return noPlanAnswer(
      `${payer} has no plan rule in this simulator's plan table, so the 271 returns no copay, ` +
        `deductible or coinsurance rather than inventing them. A claim to this payer is priced on ` +
        `the simulator's standard commercial terms; pick a payer from the plan list at registration ` +
        `to practise with real benefit figures.`,
    );
  }

  // `planCoinsurancePercent` is the PLAN's share, so the patient's share is the
  // remainder. The plan table carries no fixed copay, so the 271 says there is
  // none instead of printing a number the 835 would never apply.
  return {
    copayUsd: null,
    deductibleRemainingUsd: plan.deductibleUsd,
    coinsurancePercent: 100 - plan.planCoinsurancePercent,
    planName: plan.name,
    planType: plan.planType,
    source:
      `Plan rule: ${plan.name} (${plan.planType}) in the payer plan table — illustrative ` +
      `teaching values, not a real payer's schedule.`,
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
