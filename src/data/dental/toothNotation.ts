/**
 * Tooth Notation Reference — Dental RCM Educational Content
 *
 * Cross-reference between the three notation systems a dental biller will
 * meet on claims and clinical notes:
 *   - Universal / National System (ADA)  ... 1-32 permanent, A-T primary
 *   - FDI Two-Digit (ISO 3950)           ... quadrant digit + tooth digit
 *   - Palmer Notation                    ... quadrant bracket + 1-8 / A-E
 *
 * Why this matters for billing: an ADA claim form expects Universal
 * designations in the "Tooth Number(s) or Letter(s)" field. Clinical
 * software imported from outside North America (and most orthodontic and
 * oral-surgery literature) uses FDI. Transposing #14 (Universal: upper left
 * first molar) with FDI 14 (upper right first premolar) is one of the most
 * common — and most expensive — data-entry errors in dental claims.
 *
 * All wording in this file is original teaching text.
 */

export type Arch = "maxillary" | "mandibular";
export type Side = "right" | "left";
export type ToothType = "incisor" | "canine" | "premolar" | "molar";
export type Dentition = "permanent" | "primary";

/** Single-letter surface abbreviations used in the ADA claim "Tooth Surface" field. */
export type SurfaceCode = "M" | "O" | "D" | "B" | "L" | "F" | "I";

export interface ToothSurface {
  code: SurfaceCode;
  name: string;
  /** Plain-language orientation cue for students. */
  teachingNote: string;
  /** Which teeth legitimately carry this surface. */
  appliesTo: "all" | "posterior" | "anterior";
}

/**
 * Surface abbreviations. A restoration claim that lists a surface the tooth
 * does not have (for example an occlusal surface on an incisor) is a
 * guaranteed rejection at the payer's front-end edit.
 */
export const TOOTH_SURFACES: ToothSurface[] = [
  {
    code: "M",
    name: "Mesial",
    teachingNote: "The side facing toward the midline of the arch.",
    appliesTo: "all",
  },
  {
    code: "D",
    name: "Distal",
    teachingNote: "The side facing away from the midline, toward the back of the mouth.",
    appliesTo: "all",
  },
  {
    code: "O",
    name: "Occlusal",
    teachingNote: "The chewing table of a premolar or molar. Posterior teeth only.",
    appliesTo: "posterior",
  },
  {
    code: "I",
    name: "Incisal",
    teachingNote: "The biting edge of an incisor or canine. Anterior teeth only.",
    appliesTo: "anterior",
  },
  {
    code: "B",
    name: "Buccal",
    teachingNote: "The cheek-facing surface of a back tooth.",
    appliesTo: "posterior",
  },
  {
    code: "F",
    name: "Facial (labial)",
    teachingNote: "The lip-facing surface of a front tooth. Some payers accept B and F interchangeably.",
    appliesTo: "anterior",
  },
  {
    code: "L",
    name: "Lingual",
    teachingNote: "The tongue-facing surface. On upper teeth it is sometimes charted as palatal.",
    appliesTo: "all",
  },
];

export interface QuadrantRef {
  /** Value submitted in the ADA claim "Area of Oral Cavity" field. */
  areaOfOralCavity: "01" | "02" | "03" | "04";
  name: string;
  arch: Arch;
  side: Side;
  fdiQuadrantDigitPermanent: 1 | 2 | 3 | 4;
  fdiQuadrantDigitPrimary: 5 | 6 | 7 | 8;
  universalPermanentRange: string;
  universalPrimaryRange: string;
}

/**
 * Quadrants. Quadrant-scoped codes (scaling and root planing, osseous
 * surgery, alveoloplasty) must carry the area of the oral cavity or they
 * will be denied for missing information.
 */
export const QUADRANTS: QuadrantRef[] = [
  {
    areaOfOralCavity: "01",
    name: "Upper right",
    arch: "maxillary",
    side: "right",
    fdiQuadrantDigitPermanent: 1,
    fdiQuadrantDigitPrimary: 5,
    universalPermanentRange: "1-8",
    universalPrimaryRange: "A-E",
  },
  {
    areaOfOralCavity: "02",
    name: "Upper left",
    arch: "maxillary",
    side: "left",
    fdiQuadrantDigitPermanent: 2,
    fdiQuadrantDigitPrimary: 6,
    universalPermanentRange: "9-16",
    universalPrimaryRange: "F-J",
  },
  {
    areaOfOralCavity: "03",
    name: "Lower left",
    arch: "mandibular",
    side: "left",
    fdiQuadrantDigitPermanent: 3,
    fdiQuadrantDigitPrimary: 7,
    universalPermanentRange: "17-24",
    universalPrimaryRange: "K-O",
  },
  {
    areaOfOralCavity: "04",
    name: "Lower right",
    arch: "mandibular",
    side: "right",
    fdiQuadrantDigitPermanent: 4,
    fdiQuadrantDigitPrimary: 8,
    universalPermanentRange: "25-32",
    universalPrimaryRange: "P-T",
  },
];

/** Full-arch and full-mouth designations used on the ADA claim form. */
export const ORAL_CAVITY_AREAS = [
  { code: "00", label: "Entire oral cavity", note: "Used for full-mouth debridement and similar whole-mouth services." },
  { code: "01", label: "Maxillary right quadrant", note: "Permanent teeth 1-8." },
  { code: "02", label: "Maxillary left quadrant", note: "Permanent teeth 9-16." },
  { code: "03", label: "Mandibular left quadrant", note: "Permanent teeth 17-24." },
  { code: "04", label: "Mandibular right quadrant", note: "Permanent teeth 25-32." },
  { code: "10", label: "Upper arch", note: "Used for maxillary dentures and full-arch appliances." },
  { code: "20", label: "Lower arch", note: "Used for mandibular dentures and full-arch appliances." },
] as const;

export interface ToothRef {
  /** Universal designation: "1"-"32" for permanent, "A"-"T" for primary. */
  universal: string;
  /** FDI / ISO 3950 two-digit designation. */
  fdi: string;
  /** Palmer notation, written here as quadrant abbreviation + symbol value. */
  palmer: string;
  dentition: Dentition;
  arch: Arch;
  side: Side;
  quadrantArea: QuadrantRef["areaOfOralCavity"];
  type: ToothType;
  /** Plain-language anatomical name. */
  name: string;
  /** Surfaces that legitimately exist on this tooth. */
  validSurfaces: SurfaceCode[];
  /** Typical root count — drives endodontic code selection (anterior / premolar / molar). */
  typicalRoots: number;
  /** True for premolars and molars. */
  posterior: boolean;
}

const ANTERIOR_SURFACES: SurfaceCode[] = ["M", "D", "F", "L", "I"];
const POSTERIOR_SURFACES: SurfaceCode[] = ["M", "O", "D", "B", "L"];

type PermanentSeed = [universal: number, fdi: number, palmerIndex: number, type: ToothType, name: string, roots: number];

/**
 * Permanent dentition seed, in Universal order 1 -> 32 (the standard
 * clockwise path: upper right third molar around to lower right third molar).
 */
const PERMANENT_SEED: PermanentSeed[] = [
  [1, 18, 8, "molar", "Upper right third molar (wisdom tooth)", 3],
  [2, 17, 7, "molar", "Upper right second molar", 3],
  [3, 16, 6, "molar", "Upper right first molar", 3],
  [4, 15, 5, "premolar", "Upper right second premolar", 1],
  [5, 14, 4, "premolar", "Upper right first premolar", 2],
  [6, 13, 3, "canine", "Upper right canine", 1],
  [7, 12, 2, "incisor", "Upper right lateral incisor", 1],
  [8, 11, 1, "incisor", "Upper right central incisor", 1],
  [9, 21, 1, "incisor", "Upper left central incisor", 1],
  [10, 22, 2, "incisor", "Upper left lateral incisor", 1],
  [11, 23, 3, "canine", "Upper left canine", 1],
  [12, 24, 4, "premolar", "Upper left first premolar", 2],
  [13, 25, 5, "premolar", "Upper left second premolar", 1],
  [14, 26, 6, "molar", "Upper left first molar", 3],
  [15, 27, 7, "molar", "Upper left second molar", 3],
  [16, 28, 8, "molar", "Upper left third molar (wisdom tooth)", 3],
  [17, 38, 8, "molar", "Lower left third molar (wisdom tooth)", 2],
  [18, 37, 7, "molar", "Lower left second molar", 2],
  [19, 36, 6, "molar", "Lower left first molar", 2],
  [20, 35, 5, "premolar", "Lower left second premolar", 1],
  [21, 34, 4, "premolar", "Lower left first premolar", 1],
  [22, 33, 3, "canine", "Lower left canine", 1],
  [23, 32, 2, "incisor", "Lower left lateral incisor", 1],
  [24, 31, 1, "incisor", "Lower left central incisor", 1],
  [25, 41, 1, "incisor", "Lower right central incisor", 1],
  [26, 42, 2, "incisor", "Lower right lateral incisor", 1],
  [27, 43, 3, "canine", "Lower right canine", 1],
  [28, 44, 4, "premolar", "Lower right first premolar", 1],
  [29, 45, 5, "premolar", "Lower right second premolar", 1],
  [30, 46, 6, "molar", "Lower right first molar", 2],
  [31, 47, 7, "molar", "Lower right second molar", 2],
  [32, 48, 8, "molar", "Lower right third molar (wisdom tooth)", 2],
];

type PrimarySeed = [universal: string, fdi: number, palmerLetter: string, type: ToothType, name: string];

/**
 * Primary (deciduous) dentition seed, Universal A -> T. Same clockwise path,
 * starting at the upper right second primary molar.
 */
const PRIMARY_SEED: PrimarySeed[] = [
  ["A", 55, "E", "molar", "Upper right second primary molar"],
  ["B", 54, "D", "molar", "Upper right first primary molar"],
  ["C", 53, "C", "canine", "Upper right primary canine"],
  ["D", 52, "B", "incisor", "Upper right primary lateral incisor"],
  ["E", 51, "A", "incisor", "Upper right primary central incisor"],
  ["F", 61, "A", "incisor", "Upper left primary central incisor"],
  ["G", 62, "B", "incisor", "Upper left primary lateral incisor"],
  ["H", 63, "C", "canine", "Upper left primary canine"],
  ["I", 64, "D", "molar", "Upper left first primary molar"],
  ["J", 65, "E", "molar", "Upper left second primary molar"],
  ["K", 75, "E", "molar", "Lower left second primary molar"],
  ["L", 74, "D", "molar", "Lower left first primary molar"],
  ["M", 73, "C", "canine", "Lower left primary canine"],
  ["N", 72, "B", "incisor", "Lower left primary lateral incisor"],
  ["O", 71, "A", "incisor", "Lower left primary central incisor"],
  ["P", 81, "A", "incisor", "Lower right primary central incisor"],
  ["Q", 82, "B", "incisor", "Lower right primary lateral incisor"],
  ["R", 83, "C", "canine", "Lower right primary canine"],
  ["S", 84, "D", "molar", "Lower right first primary molar"],
  ["T", 85, "E", "molar", "Lower right second primary molar"],
];

function quadrantFromFdi(fdi: number): QuadrantRef {
  const digit = Math.floor(fdi / 10);
  const area =
    digit === 1 || digit === 5
      ? "01"
      : digit === 2 || digit === 6
        ? "02"
        : digit === 3 || digit === 7
          ? "03"
          : "04";
  return QUADRANTS.find((q) => q.areaOfOralCavity === area) as QuadrantRef;
}

/** Palmer notation is drawn with a bracket; in plain text we prefix the quadrant. */
function palmerLabel(quadrant: QuadrantRef, value: string | number): string {
  const prefix =
    quadrant.arch === "maxillary"
      ? quadrant.side === "right"
        ? "UR"
        : "UL"
      : quadrant.side === "right"
        ? "LR"
        : "LL";
  return `${prefix}${value}`;
}

/** All 32 permanent teeth, Universal 1-32. */
export const PERMANENT_TEETH: ToothRef[] = PERMANENT_SEED.map(
  ([universal, fdi, palmerIndex, type, name, roots]) => {
    const quadrant = quadrantFromFdi(fdi);
    const posterior = type === "premolar" || type === "molar";
    return {
      universal: String(universal),
      fdi: String(fdi),
      palmer: palmerLabel(quadrant, palmerIndex),
      dentition: "permanent" as const,
      arch: quadrant.arch,
      side: quadrant.side,
      quadrantArea: quadrant.areaOfOralCavity,
      type,
      name,
      validSurfaces: posterior ? POSTERIOR_SURFACES : ANTERIOR_SURFACES,
      typicalRoots: roots,
      posterior,
    };
  },
);

/** All 20 primary teeth, Universal A-T. */
export const PRIMARY_TEETH: ToothRef[] = PRIMARY_SEED.map(
  ([universal, fdi, palmerLetter, type, name]) => {
    const quadrant = quadrantFromFdi(fdi);
    const posterior = type === "molar";
    return {
      universal,
      fdi: String(fdi),
      palmer: palmerLabel(quadrant, palmerLetter),
      dentition: "primary" as const,
      arch: quadrant.arch,
      side: quadrant.side,
      quadrantArea: quadrant.areaOfOralCavity,
      type,
      name,
      validSurfaces: posterior ? POSTERIOR_SURFACES : ANTERIOR_SURFACES,
      typicalRoots: posterior ? (quadrant.arch === "maxillary" ? 3 : 2) : 1,
      posterior,
    };
  },
);

export const ALL_TEETH: ToothRef[] = [...PERMANENT_TEETH, ...PRIMARY_TEETH];

/** Lookup by Universal designation, e.g. "30" or "K". Case-insensitive for letters. */
export function findTooth(universal: string): ToothRef | undefined {
  const key = universal.trim().toUpperCase();
  return ALL_TEETH.find((t) => t.universal === key);
}

/** Universal -> FDI. Returns undefined for an unknown designation. */
export function universalToFdi(universal: string): string | undefined {
  return findTooth(universal)?.fdi;
}

/** FDI -> Universal. Returns undefined for an unknown designation. */
export function fdiToUniversal(fdi: string | number): string | undefined {
  const key = String(fdi).trim();
  return ALL_TEETH.find((t) => t.fdi === key)?.universal;
}

/**
 * Validates a surface string such as "MOD" against the tooth it was charted
 * on. Use this to teach students why a claim rejects before it ever reaches
 * the payer.
 */
export function validateSurfaces(
  universal: string,
  surfaces: string,
): { valid: boolean; invalidSurfaces: string[]; reason?: string } {
  const tooth = findTooth(universal);
  if (!tooth) {
    return { valid: false, invalidSurfaces: [], reason: `No tooth is designated ${universal}.` };
  }
  const requested = surfaces.trim().toUpperCase().split("");
  const invalid = requested.filter((s) => !tooth.validSurfaces.includes(s as SurfaceCode));
  if (invalid.length > 0) {
    return {
      valid: false,
      invalidSurfaces: invalid,
      reason: `${tooth.name} has no ${invalid.join(", ")} surface. Valid surfaces are ${tooth.validSurfaces.join(", ")}.`,
    };
  }
  const duplicates = requested.length !== new Set(requested).size;
  if (duplicates) {
    return { valid: false, invalidSurfaces: [], reason: "The same surface was listed more than once." };
  }
  return { valid: true, invalidSurfaces: [] };
}

/**
 * Teaching callouts that instructors can surface next to the tooth chart.
 */
export const NOTATION_TEACHING_POINTS = [
  "Universal is what North American payers expect on the claim. Send FDI by mistake and the payer will either reject the line or, worse, pay for the wrong tooth.",
  "The collision to memorise: Universal #14 is an upper left first molar, but FDI 14 is an upper right first premolar. Both are valid two-character strings, so no software will catch the swap for you.",
  "Primary teeth use letters A-T in Universal and a 5-8 quadrant digit in FDI. A permanent-tooth designation on a four-year-old is a documentation contradiction the payer will question.",
  "Surface order does not change payment, but surface count does. A two-surface restoration billed as three surfaces is an overpayment, and on audit it is recouped.",
  "Quadrant-scoped codes need the area of the oral cavity, not a tooth number. Tooth-scoped codes need a tooth number, not a quadrant. Sending the wrong one is a missing-information denial.",
];
