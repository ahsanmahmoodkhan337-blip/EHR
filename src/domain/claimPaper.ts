/**
 * claimPaper.ts — which paper a claim prints on, and where its principal
 * diagnosis goes. Two rules, both pure, both used by the claim screen and the
 * scrubber so they cannot disagree.
 *
 * 1. **The claim type follows the place of service.** POS 21 / 22 / 23 bills on
 *    the UB-04 as an 837I; a dental-track encounter bills on the ADA form as an
 *    837D; everything else is a professional claim on the CMS-1500 as an 837P.
 *    Nothing overrides it — not a stored value on the claim, not a biller's
 *    choice — because the place of service is what the payer prices against.
 *
 * 2. **The principal diagnosis is first-listed.** The first code of the Coder's
 *    final list is the principal diagnosis, and it is code A of box 21 on the
 *    CMS-1500 (loop 2300 HI01-1=ABK) and box 67 on the UB-04. `principalDiagnosisOf`
 *    names it; `claimValidation` flags a claim that lists another code first.
 *
 * A place of service that does not match the encounter is **flagged with the
 * denial it would earn and never corrected** (STANDING-RULES 6, owner decision
 * 2026-11-20): the wrong POS is the student's to fix, and the message says what
 * the payer answers — CARC 16 with group code CO and RARC MA130.
 *
 * Inspiration: Epic Resolute derives the claim format from the encounter's
 * place of service and refuses to price a claim at a setting the service was
 * not performed in; the edit surfaces as a claim edit, not a silent rewrite.
 */

import { CARC_BY_CODE } from "../data/claims/carc";
import {
  CLAIM_TYPE_PAPER,
  CLAIM_X12,
  suggestClaimType,
  type ClaimType,
} from "../data/claims/claimType";

/** One claim type, the paper it prints on and the X12 set it becomes. */
export interface ClaimPaper {
  claimType: ClaimType;
  /** The printed form, e.g. "CMS-1500 (02/12)". */
  paper: string;
  /** The X12 transaction set, e.g. "837P". */
  x12: "837P" | "837I" | "837D";
  /** One line the student reads: why this paper, from which place of service. */
  reason: string;
}

export interface ClaimPaperArgs {
  /** The place of service the claim bills at, e.g. "23". */
  placeOfService?: string | null;
  /** The teaching description of that POS, e.g. "Emergency Room — Hospital". */
  posDescription?: string;
  /** The patient's revenue cycle. A dental encounter bills on the ADA form. */
  track?: string | null;
}

/**
 * The paper a claim at this place of service prints on. The POS decides — the
 * stored `claimType` on the claim is written *from* this, never read to choose
 * a paper, so a claim cannot print on a form its POS does not bill on.
 */
export function paperForPos({ placeOfService, posDescription, track }: ClaimPaperArgs): ClaimPaper {
  const suggestion = suggestClaimType({ placeOfService, posDescription, track });
  return {
    claimType: suggestion.claimType,
    paper: CLAIM_TYPE_PAPER[suggestion.claimType],
    x12: CLAIM_X12[suggestion.claimType],
    reason: suggestion.reason,
  };
}

/** The claim type alone — POS 21/22/23 institutional, dental track dental, else professional. */
export function claimTypeFromPos(args: ClaimPaperArgs): ClaimType {
  return paperForPos(args).claimType;
}

/** The denial a wrong place of service earns, with its group code and RARC. */
export interface PosDenial {
  group: "CO";
  carc: "CO-16";
  rarc: "MA130";
  /** The CARC's own description from the single table in `data/claims/carc.ts`. */
  description: string;
  /** The one line the student reads: the rule, the denial, and what to do. */
  message: string;
}

export interface PosCheck {
  /** The place of service this claim bills at — as submitted, never corrected. */
  claimPos: string;
  /** The place of service the encounter was registered at, or "" when unknown. */
  encounterPos: string;
  /** Every distinct POS found on the claim's service lines (box 24B). */
  linePositions: string[];
  /** The paper this POS selects. */
  paper: ClaimPaper;
  /** The denial this claim earns on its POS — null when the POS is consistent. */
  denial: PosDenial | null;
}

export interface PosCheckArgs extends ClaimPaperArgs {
  /** The POS the claim bills at: box 24B of its first line, else the encounter's. */
  claimPos?: string | null;
  /** The POS the encounter was registered at. */
  encounterPos?: string | null;
  /** Every POS on the claim's service lines, in line order. */
  linePositions?: (string | null | undefined)[];
}

const pos = (value: unknown): string => String(value ?? "").trim();

/**
 * Check the claim's place of service against the encounter and against its own
 * lines. A claim bills at one place of service: the one the encounter was
 * registered at. Two POS on one claim, or a claim POS that is not the
 * encounter's, is flagged with the denial it would earn — CARC 16 (CO) with
 * RARC MA130 — and the POS is returned exactly as the student left it.
 */
export function checkPlaceOfService({
  claimPos,
  encounterPos,
  linePositions = [],
  posDescription,
  track,
}: PosCheckArgs): PosCheck {
  const claim = pos(claimPos) || pos(encounterPos);
  const encounter = pos(encounterPos);
  const positions = Array.from(new Set(linePositions.map(pos).filter(Boolean)));
  const paper = paperForPos({ placeOfService: claim, posDescription, track });

  const carc = CARC_BY_CODE["CO-16"];
  const denialFor = (message: string): PosDenial => ({
    group: "CO",
    carc: "CO-16",
    rarc: "MA130",
    description: carc?.description ?? "Missing information the payer needs",
    message,
  });

  // The payer prices at the claim-level place of service (CLM05-1), so a line
  // that names another setting is priced at the wrong one.
  if (positions.length > 1) {
    return {
      claimPos: claim,
      encounterPos: encounter,
      linePositions: positions,
      paper,
      denial: denialFor(
        `This claim bills at two places of service — POS ${positions.join(" and POS ")}. A claim bills at one setting: the payer prices every line at the claim's place of service and answers CO-16 with MA130 (${carc?.description ?? "missing information the payer needs"}) to the line that was performed elsewhere. Correct box 24B; the POS you typed is left as you typed it.`,
      ),
    };
  }

  if (encounter && claim && claim !== encounter) {
    const label = (code: string) => (code === claim && posDescription ? `POS ${code} — ${posDescription}` : `POS ${code}`);
    return {
      claimPos: claim,
      encounterPos: encounter,
      linePositions: positions,
      paper,
      denial: denialFor(
        `The encounter was registered at POS ${encounter}, and this claim bills ${label(claim)}. The payer prices the claim at the place of service on it and answers CO-16 with MA130 (${carc?.description ?? "missing information the payer needs"}) because the service was not performed there. Correct box 24B, or bill the claim for the setting the service happened in — the POS you typed is left as you typed it.`,
      ),
    };
  }

  return { claimPos: claim, encounterPos: encounter, linePositions: positions, paper, denial: null };
}

/**
 * The principal diagnosis: the first code of the Coder's final list, or the
 * claim's own recorded principal when the Coder's list is empty. Upper-cased and
 * trimmed so a lower-case edit does not read as a different diagnosis.
 */
export function principalDiagnosisOf(
  coderCodes: (string | null | undefined)[] = [],
  claimPrincipal?: string | null,
): string {
  const first = coderCodes.map(pos).find(Boolean);
  return (first ?? pos(claimPrincipal)).toUpperCase();
}
