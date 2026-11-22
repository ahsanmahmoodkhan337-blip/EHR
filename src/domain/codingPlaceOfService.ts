/**
 * codingPlaceOfService.ts — the Coder's box 24B, written where the claim reads it
 *
 * Inspired by: Epic's Coding worklist, where the place of service on the coded
 * line is the value the claim prints in box 24B — and the paper the biller gets
 * (CMS-1500 / UB-04 / ADA) is chosen from it.
 *
 * THE BUG THIS FIXES
 * The POS picker on Coding only fed the lines coded *after* it was set: the
 * store's `codingLines` and the claim's own `serviceLines` kept whatever place
 * of service they already carried, so a student who picked POS 22 on an
 * already-coded line still billed on the CMS-1500.
 *
 * WHAT IT WRITES
 * One field — `placeOfService` (24B) — on the matching CPT's line, in both the
 * Coder's line list and the claim the billing screen draws. No new field, no
 * schema change, and no other value on either line is touched. A claim that does
 * not exist yet needs nothing here: `buildServiceLines` copies the Coder's line
 * when the claim is first built.
 */

import type { ClaimServiceLine, PipelineEncounter } from "../store/pipelineEncounter";

/** The same lines with one CPT's place of service (24B) set. */
export function setLinePlaceOfService<T extends { cpt: string; placeOfService: string }>(
  lines: readonly T[] | null | undefined,
  cpt: string,
  placeOfService: string,
): T[] {
  return (lines ?? []).map((line) => (line.cpt === cpt ? { ...line, placeOfService } : line));
}

/**
 * The encounter after the Coder changed one line's place of service: the
 * Coder's own line and, when the claim already exists, the claim's box-24 row
 * for the same CPT. Everything else on the record is carried forward verbatim.
 */
export function applyCodingPlaceOfService(
  enc: PipelineEncounter,
  cpt: string,
  placeOfService: string,
): PipelineEncounter {
  const codingLines = setLinePlaceOfService<ClaimServiceLine>(enc.codingLines, cpt, placeOfService);
  const claimForm = enc.claimForm
    ? { ...enc.claimForm, serviceLines: setLinePlaceOfService(enc.claimForm.serviceLines, cpt, placeOfService) }
    : enc.claimForm;
  return { ...enc, codingLines, claimForm };
}

/** True when this CPT has a line on the encounter the Coder's picker can write to. */
export function hasLineForCpt(enc: PipelineEncounter, cpt: string): boolean {
  return (
    (enc.codingLines ?? []).some((line) => line.cpt === cpt) ||
    (enc.claimForm?.serviceLines ?? []).some((line) => line.cpt === cpt)
  );
}
