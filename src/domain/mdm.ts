/**
 * mdm — the E/M level from medical decision making (AMA 2021 office E/M rules).
 *
 * The MDM level is set by **two of the three** elements — problems, data and
 * risk — meeting or exceeding it. It is never a sum of points: three low
 * elements are a low MDM, and a pile of reviewed data with a minor problem and
 * minimal risk is still straightforward.
 *
 * Levels: 1 straightforward · 2 low · 3 moderate · 4 high.
 * Both the Assessment & Plan wizard and the Coding stage calculator read this
 * one rule, so the two screens can never disagree.
 */

export type MdmLevel = 1 | 2 | 3 | 4;

export const MDM_LEVEL_NAMES: Record<MdmLevel, string> = {
  1: "Straightforward",
  2: "Low",
  3: "Moderate",
  4: "High",
};

/** The highest level that at least two of the three elements reach. */
export function mdmLevelFromElements(problems: number, data: number, risk: number): MdmLevel {
  const elements = [problems, data, risk];
  for (let level = 4; level >= 1; level--) {
    if (elements.filter((v) => v >= level).length >= 2) return level as MdmLevel;
  }
  return 1;
}

/**
 * The data element from what was actually done, per the AMA table.
 *
 * - Category 1: each unique test ordered, each unique test result reviewed, each
 *   unique external source's notes reviewed (`uniqueItems`), plus an
 *   independent historian.
 * - Category 2: independent interpretation of a test another clinician bills.
 * - Category 3: discussion of management or a test with an external clinician.
 *
 * Low: 2 Category-1 items, or an independent historian.
 * Moderate: any one category met (Category 1 needs 3 items, historian counted).
 * High (extensive): any two categories met.
 */
export interface MdmDataInput {
  uniqueItems: number;
  independentHistorian: boolean;
  independentInterpretation: boolean;
  externalDiscussion: boolean;
}

export function mdmDataLevel(input: MdmDataInput): MdmLevel {
  const cat1Count = Math.max(0, input.uniqueItems) + (input.independentHistorian ? 1 : 0);
  const cat1Moderate = cat1Count >= 3;
  const categoriesMet = [cat1Moderate, input.independentInterpretation, input.externalDiscussion].filter(Boolean).length;
  if (categoriesMet >= 2) return 4;
  if (categoriesMet >= 1) return 3;
  if (input.uniqueItems >= 2 || input.independentHistorian) return 2;
  return 1;
}

/** The office E/M code for an MDM level and patient type. */
export function officeEmCode(level: MdmLevel, newPatient: boolean): string {
  const codes = newPatient
    ? { 1: "99202", 2: "99203", 3: "99204", 4: "99205" }
    : { 1: "99212", 2: "99213", 3: "99214", 4: "99215" };
  return codes[level];
}
