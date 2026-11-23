/**
 * The parties one claim paper names, and the rules that keep their boxes
 * agreeing with each other (`specs/claim-boxes-agree.md`).
 *
 * Inspiration: the NUCC CMS-1500 (02/12) instructions for boxes 2, 4, 6, 11, 12
 * and 13. A paper a student reads must not contain a fact that contradicts
 * another box on the same paper, and a read-only chart must not carry an error
 * no student could clear.
 */

/**
 * What a biller types in box 11 when the payer issues no group number.
 *
 * Medicare Part B (original Medicare fee-for-service) issues none: there is no
 * policy or group number on the card, so the box prints N/A rather than a blank
 * the edit check calls an error — and never an invented number.
 */
export const NO_GROUP_NUMBER = "N/A";

/**
 * Does this payer issue a policy / group number (CMS-1500 box 11)?
 *
 * Original Medicare (Part A / Part B) issues none, so box 11 is not required on
 * its claims. A Medicare **Advantage** plan is a commercial product and does
 * issue one, so it is not exempt. A claim with no payer captured yet is treated
 * as one that does: the box stays required until the payer is known, which is
 * the wording the check has always used.
 */
export function payerIssuesGroupNumber(payerName: string | null | undefined): boolean {
  const name = String(payerName ?? "").trim().toLowerCase();
  if (!name) return true;
  const isMedicare = /^medicare\b/.test(name);
  const isAdvantage = /advantage|part c/.test(name);
  return !(isMedicare && !isAdvantage);
}

/**
 * Box 11's value: the group number on the patient's own card, or `N/A` for a
 * payer that issues none. A payer that does issue one and a card that has not
 * captured it stays blank, with the stage that should have filled it.
 */
export function box11Value(
  groupNumber: string | null | undefined,
  payerName: string | null | undefined,
): string {
  const group = String(groupNumber ?? "").trim();
  if (group) return group;
  return payerIssuesGroupNumber(payerName) ? "" : NO_GROUP_NUMBER;
}

/**
 * "Last, First" — the one format the paper prints a person's name in, so box 2
 * and box 4 can never show the same person spelled two ways. A name already
 * written last-first is returned untouched.
 */
export function lastFirstName(name: string | null | undefined): string {
  const raw = String(name ?? "").trim().replace(/\s+/g, " ");
  if (!raw) return "";
  if (raw.includes(",")) return raw;
  const parts = raw.split(" ");
  if (parts.length === 1) return parts[0];
  return `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(" ")}`;
}
