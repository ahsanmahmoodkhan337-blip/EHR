/**
 * Claim type — which paper a claim is submitted on.
 *
 * Source: specs/claim-forms-auto-generated.md §1. A claim is one of three
 * types, and the type decides the printed form:
 *
 *   professional  → CMS-1500 (02/12)      physician / office services
 *   institutional → UB-04 (CMS-1450)      hospital, ER, outpatient department, ASC
 *   dental        → ADA Dental Claim (J430D)
 *
 * The type is derived from the encounter's place of service, never picked by
 * hand (Phase 3, 2026-11-20): a dental-track encounter is dental, a medical
 * encounter at place of service 21, 22 or 23 is institutional, and everything
 * else is professional. A place of service that does not match the encounter is
 * flagged with the denial it would earn — see `domain/claimPaper.ts` — and is
 * never rewritten for the student.
 *
 * Inspiration: the claim-type / bill-type selector at the top of a
 * practice-management claim screen — Epic Resolute splits professional
 * (CMS-1500) from institutional (UB-04) billing this way, and Dentrix keeps
 * dental claims on the ADA form.
 */

export type ClaimType = "professional" | "institutional" | "dental";

export interface ClaimTypeOption {
  value: ClaimType;
  label: string;
  /** The printed form this claim type is submitted on. */
  paper: string;
  /** One line the biller reads before choosing. */
  hint: string;
}

export const CLAIM_TYPE_OPTIONS: ClaimTypeOption[] = [
  {
    value: "professional",
    label: "Professional",
    paper: "CMS-1500 (02/12)",
    hint: "Physician and office services, billed per rendering provider.",
  },
  {
    value: "institutional",
    label: "Institutional",
    paper: "UB-04 (CMS-1450)",
    hint: "Facility charges — hospital inpatient, outpatient department, emergency room, ASC.",
  },
  {
    value: "dental",
    label: "Dental",
    paper: "ADA Dental Claim (J430D)",
    hint: "Dental services coded in CDT with tooth, surface and quadrant.",
  },
];

/** The paper each claim type prints on. */
export const CLAIM_TYPE_PAPER: Record<ClaimType, string> = {
  professional: "CMS-1500 (02/12)",
  institutional: "UB-04 (CMS-1450)",
  dental: "ADA Dental Claim (J430D)",
};

/**
 * The X12 transaction set each claim type is submitted as. One table, so the
 * paper, the documents tab and the claim screen cannot disagree: a CMS-1500 is
 * an 837P, a UB-04 an 837I, an ADA form an 837D.
 */
export const CLAIM_X12: Record<ClaimType, "837P" | "837I" | "837D"> = {
  professional: "837P",
  institutional: "837I",
  dental: "837D",
};

/**
 * Place-of-service codes that bill on the institutional paper. POS 11 (office)
 * never gets a UB-04; §1 of the spec names exactly these three.
 */
const INSTITUTIONAL_POS = new Set(["21", "22", "23"]);

export interface ClaimTypeSuggestion {
  claimType: ClaimType;
  /** One line the biller reads: why this paper was suggested. */
  reason: string;
}

export interface ClaimTypeArgs {
  /** The encounter's place of service, e.g. "23". */
  placeOfService?: string | null;
  /** The teaching description of that POS, e.g. "Emergency Room — Hospital". */
  posDescription?: string;
  /** Revenue cycle the patient belongs to. */
  track?: string | null;
}

/**
 * Suggest the claim type from the encounter. Dental track wins; then place of
 * service 21/22/23 (inpatient, outpatient hospital, emergency room) is
 * institutional; everything else is professional.
 */
export function suggestClaimType({
  placeOfService,
  posDescription,
  track,
}: ClaimTypeArgs): ClaimTypeSuggestion {
  if (track === "dental") {
    return {
      claimType: "dental",
      reason: "Dental encounter — dental services bill on the ADA dental claim (J430D)",
    };
  }

  const pos = (placeOfService ?? "").trim() || "11";
  const label = posDescription ? `POS ${pos} — ${posDescription}` : `POS ${pos}`;

  if (INSTITUTIONAL_POS.has(pos)) {
    return {
      claimType: "institutional",
      reason: `${label} — facility services bill on the UB-04 (CMS-1450)`,
    };
  }

  return {
    claimType: "professional",
    reason: `${label} — professional services bill on the CMS-1500`,
  };
}
