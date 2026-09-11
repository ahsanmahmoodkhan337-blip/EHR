/**
 * CDT Teaching Subset — Dental Coding Educational Content
 *
 * A curated subset of dental procedure codes covering the services a
 * general-practice dental RCM team touches on a normal day, grouped by the
 * CDT category of service.
 *
 * COPYRIGHT NOTE — READ BEFORE EDITING
 * The CDT Code set and its official nomenclature and descriptors are
 * copyright of the American Dental Association. Nothing in this file
 * reproduces ADA nomenclature or descriptors. Every `shortName` and
 * `teachingDescription` below is original teaching text written for this
 * simulator, describing in plain language what the procedure is and how it
 * behaves on a claim. The alphanumeric code identifiers themselves are used
 * only as references so that students learn to recognise them. If you add a
 * code, write your own description — do not paste from a CDT manual, a
 * fee-schedule export, or a payer bulletin.
 *
 * FEE NOTE
 * Every `illustrativeFeeUsd` is a teaching placeholder in a plausible US
 * range. It is NOT a fee schedule, NOT a payer allowable, and must never be
 * presented to a student as what a practice or payer actually pays. Real
 * fees vary by region, practice, and contract.
 */

/** CDT category of service. The leading digit of the code maps to these groups. */
export type CDTCategory =
  | "Diagnostic"
  | "Preventive"
  | "Restorative"
  | "Endodontics"
  | "Periodontics"
  | "Removable Prosthodontics"
  | "Implant Services"
  | "Fixed Prosthodontics"
  | "Oral Surgery"
  | "Orthodontics"
  | "Adjunctive Services";

/**
 * How a typical PPO groups the service for coinsurance. Class assignment is
 * a PLAN decision, not a property of the code — a plan can move any service
 * between classes, and some plans put endodontics in Basic while others put
 * it in Major. Students must confirm against the specific plan, never assume.
 */
export type BenefitClass = "Preventive" | "Basic" | "Major" | "Orthodontic" | "Adjunctive";

/** Data the claim line must carry for the code to adjudicate. */
export type CDTRequirement =
  | "tooth"
  | "surface"
  | "quadrant"
  | "arch"
  | "oral-cavity-area"
  | "date-of-prior-placement"
  | "none";

export interface CDTCode {
  code: string;
  /** Original short label for UI lists. */
  shortName: string;
  /** Original plain-language explanation of the service and its billing behaviour. */
  teachingDescription: string;
  category: CDTCategory;
  /** Typical PPO benefit class — always verify against the actual plan. */
  typicalBenefitClass: BenefitClass;
  /** Fields the claim line must populate. */
  requires: CDTRequirement[];
  /** ILLUSTRATIVE teaching figure only. Not a fee schedule. */
  illustrativeFeeUsd: number;
  /** Frequency rule key linking to DENTAL_PLANS frequency limits, when one commonly applies. */
  frequencyRuleKey?: string;
  /** Payers commonly want a predetermination or prior authorisation before this. */
  predeterminationCommonlyRequested: boolean;
  /** Commonly subject to an alternate-benefit downgrade under PPO plans. */
  alternateBenefitRisk?: boolean;
  /** Attachments payers commonly require to adjudicate. */
  commonAttachments?: string[];
  /** Denial ids from denialReasons.ts that this code commonly triggers. */
  commonDenials?: string[];
  /** Coding tips in original wording. */
  teachingNotes?: string;
}

export const CDT_CODES: CDTCode[] = [
  // ─── Diagnostic (D0xxx) ─────────────────────────────────────────────
  {
    code: "D0120",
    shortName: "Recall exam, established patient",
    teachingDescription:
      "The routine check-up examination for a patient of record, normally done at the same visit as a cleaning.",
    category: "Diagnostic",
    typicalBenefitClass: "Preventive",
    requires: ["none"],
    illustrativeFeeUsd: 62,
    frequencyRuleKey: "exam-routine",
    predeterminationCommonlyRequested: false,
    commonDenials: ["DEN-FREQ-EXAM"],
    teachingNotes:
      "Most plans allow two routine exams per benefit period. Billing this on the same day as a comprehensive exam will get one of the two denied.",
  },
  {
    code: "D0140",
    shortName: "Problem-focused exam",
    teachingDescription:
      "A limited examination aimed at one specific complaint, such as a patient arriving in pain or after trauma.",
    category: "Diagnostic",
    typicalBenefitClass: "Preventive",
    requires: ["none"],
    illustrativeFeeUsd: 92,
    predeterminationCommonlyRequested: false,
    commonDenials: ["DEN-BUNDLE-EXAM"],
    teachingNotes:
      "Used for emergency visits. If it is reported on the same day as a routine exam or a cleaning, expect the payer to pay only one evaluation.",
  },
  {
    code: "D0150",
    shortName: "Comprehensive exam",
    teachingDescription:
      "A full evaluation of the whole mouth, hard and soft tissue, done for a new patient or when a patient of record returns after a long gap.",
    category: "Diagnostic",
    typicalBenefitClass: "Preventive",
    requires: ["none"],
    illustrativeFeeUsd: 108,
    frequencyRuleKey: "exam-comprehensive",
    predeterminationCommonlyRequested: false,
    commonDenials: ["DEN-FREQ-EXAM"],
    teachingNotes:
      "Frequently limited to once every three to five years per provider. A practice that bills it at every new hygienist will collect denials.",
  },
  {
    code: "D0180",
    shortName: "Comprehensive periodontal exam",
    teachingDescription:
      "A full evaluation focused on gum and bone health, including a complete pocket-depth chart, for patients showing signs of periodontal disease or carrying risk factors.",
    category: "Diagnostic",
    typicalBenefitClass: "Preventive",
    requires: ["none"],
    illustrativeFeeUsd: 128,
    frequencyRuleKey: "exam-comprehensive",
    predeterminationCommonlyRequested: false,
    teachingNotes:
      "Supports later periodontal therapy. Some plans treat it as an evaluation and count it against the same two-per-year allowance as a routine exam.",
  },
  {
    code: "D0210",
    shortName: "Full-mouth radiographic series",
    teachingDescription:
      "A complete radiographic survey of every tooth-bearing area plus bitewings, taken as one series.",
    category: "Diagnostic",
    typicalBenefitClass: "Preventive",
    requires: ["none"],
    illustrativeFeeUsd: 148,
    frequencyRuleKey: "radiograph-fmx",
    predeterminationCommonlyRequested: false,
    commonDenials: ["DEN-FREQ-XRAY"],
    teachingNotes:
      "Commonly limited to once every three to five years, and most plans count a panoramic image taken in the same window against the same limit.",
  },
  {
    code: "D0220",
    shortName: "Periapical, first image",
    teachingDescription:
      "The first single intraoral image showing an entire tooth including the root tip and surrounding bone.",
    category: "Diagnostic",
    typicalBenefitClass: "Preventive",
    requires: ["none"],
    illustrativeFeeUsd: 35,
    predeterminationCommonlyRequested: false,
    teachingNotes: "Report once per visit. Every further periapical on the same date goes on the additional-image code.",
  },
  {
    code: "D0230",
    shortName: "Periapical, each additional image",
    teachingDescription:
      "Each further single-tooth image after the first on the same date of service.",
    category: "Diagnostic",
    typicalBenefitClass: "Preventive",
    requires: ["none"],
    illustrativeFeeUsd: 29,
    predeterminationCommonlyRequested: false,
    teachingNotes:
      "Enter the number of images in the quantity field. Billing multiple first-image lines instead of using quantity is a duplicate denial.",
  },
  {
    code: "D0272",
    shortName: "Bitewings, two images",
    teachingDescription:
      "Two cavity-detection images showing the crowns of upper and lower back teeth in contact.",
    category: "Diagnostic",
    typicalBenefitClass: "Preventive",
    requires: ["none"],
    illustrativeFeeUsd: 46,
    frequencyRuleKey: "radiograph-bitewing",
    predeterminationCommonlyRequested: false,
    commonDenials: ["DEN-FREQ-XRAY"],
  },
  {
    code: "D0274",
    shortName: "Bitewings, four images",
    teachingDescription:
      "The standard four-image cavity-detection set covering both sides, upper and lower.",
    category: "Diagnostic",
    typicalBenefitClass: "Preventive",
    requires: ["none"],
    illustrativeFeeUsd: 74,
    frequencyRuleKey: "radiograph-bitewing",
    predeterminationCommonlyRequested: false,
    commonDenials: ["DEN-FREQ-XRAY"],
    teachingNotes:
      "The most common frequency denial in a general practice: plans typically allow one set per twelve months, and a six-month recall schedule will outrun it.",
  },
  {
    code: "D0277",
    shortName: "Vertical bitewings, seven to eight images",
    teachingDescription:
      "A vertically oriented bitewing set that captures more bone height, used when periodontal bone loss is being monitored.",
    category: "Diagnostic",
    typicalBenefitClass: "Preventive",
    requires: ["none"],
    illustrativeFeeUsd: 92,
    frequencyRuleKey: "radiograph-bitewing",
    predeterminationCommonlyRequested: false,
    teachingNotes: "Counts against the same bitewing allowance as the horizontal set on most plans.",
  },
  {
    code: "D0330",
    shortName: "Panoramic image",
    teachingDescription:
      "A single wraparound image of both jaws, the joints and the sinus floor, used for surgical planning and third-molar assessment.",
    category: "Diagnostic",
    typicalBenefitClass: "Preventive",
    requires: ["none"],
    illustrativeFeeUsd: 132,
    frequencyRuleKey: "radiograph-fmx",
    predeterminationCommonlyRequested: false,
    commonDenials: ["DEN-FREQ-XRAY"],
    teachingNotes:
      "Usually shares a frequency limit with the full-mouth series. Taking both within the limit window means one of them will not be paid.",
  },
  {
    code: "D0367",
    shortName: "Cone beam scan, both jaws",
    teachingDescription:
      "A three-dimensional scan of both arches used for implant planning, impacted teeth and complex surgical work.",
    category: "Diagnostic",
    typicalBenefitClass: "Basic",
    requires: ["none"],
    illustrativeFeeUsd: 355,
    predeterminationCommonlyRequested: true,
    commonDenials: ["DEN-NOT-COVERED", "DEN-MED-NEC"],
    teachingNotes:
      "Many dental plans exclude 3D imaging outright. Check coverage before the scan, and document why 2D imaging was insufficient.",
  },
  {
    code: "D0460",
    shortName: "Pulp vitality testing",
    teachingDescription:
      "Tests applied to determine whether the nerve inside a tooth is alive, healthy or dying, reported once per visit regardless of how many teeth are tested.",
    category: "Diagnostic",
    typicalBenefitClass: "Basic",
    requires: ["none"],
    illustrativeFeeUsd: 42,
    predeterminationCommonlyRequested: false,
    commonDenials: ["DEN-BUNDLE-DIAG"],
    teachingNotes: "Frequently bundled into the examination by the payer rather than paid separately.",
  },
  {
    code: "D0470",
    shortName: "Diagnostic models",
    teachingDescription:
      "Study models or digital scans of the arches used to plan treatment, most often before orthodontics or a full reconstruction.",
    category: "Diagnostic",
    typicalBenefitClass: "Basic",
    requires: ["none"],
    illustrativeFeeUsd: 118,
    predeterminationCommonlyRequested: false,
    teachingNotes: "Under an orthodontic benefit these are usually paid inside the case fee rather than separately.",
  },

  // ─── Preventive (D1xxx) ─────────────────────────────────────────────
  {
    code: "D1110",
    shortName: "Cleaning, adult",
    teachingDescription:
      "The routine hygiene cleaning that removes plaque, tartar and stain above the gumline, for patients with permanent teeth.",
    category: "Preventive",
    typicalBenefitClass: "Preventive",
    requires: ["none"],
    illustrativeFeeUsd: 108,
    frequencyRuleKey: "prophy",
    predeterminationCommonlyRequested: false,
    commonDenials: ["DEN-FREQ-PROPHY", "DEN-PERIO-MAINT-CONFLICT"],
    teachingNotes:
      "Once a patient is in periodontal maintenance, alternating this code with maintenance visits is a frequent source of denials and of payer audits.",
  },
  {
    code: "D1120",
    shortName: "Cleaning, child",
    teachingDescription:
      "The routine hygiene cleaning for a patient with primary or mixed dentition.",
    category: "Preventive",
    typicalBenefitClass: "Preventive",
    requires: ["none"],
    illustrativeFeeUsd: 82,
    frequencyRuleKey: "prophy",
    predeterminationCommonlyRequested: false,
    teachingNotes:
      "Plans define the child-to-adult switch by age, commonly somewhere between 12 and 14. Using the wrong one for the patient's age triggers an automatic code change or a denial.",
  },
  {
    code: "D1206",
    shortName: "Fluoride varnish",
    teachingDescription:
      "A painted-on fluoride coating used to strengthen enamel and reduce decay risk.",
    category: "Preventive",
    typicalBenefitClass: "Preventive",
    requires: ["none"],
    illustrativeFeeUsd: 44,
    frequencyRuleKey: "fluoride",
    predeterminationCommonlyRequested: false,
    commonDenials: ["DEN-AGE-LIMIT", "DEN-FREQ-FLUORIDE"],
    teachingNotes:
      "The classic age-limit trap. Many plans stop paying fluoride at age 14 or 16, so the adult patient who receives it owes the fee — and must be told before it is applied.",
  },
  {
    code: "D1208",
    shortName: "Topical fluoride, non-varnish",
    teachingDescription:
      "Fluoride delivered in a tray or rinse form rather than painted on.",
    category: "Preventive",
    typicalBenefitClass: "Preventive",
    requires: ["none"],
    illustrativeFeeUsd: 40,
    frequencyRuleKey: "fluoride",
    predeterminationCommonlyRequested: false,
    commonDenials: ["DEN-AGE-LIMIT"],
  },
  {
    code: "D1351",
    shortName: "Sealant, per tooth",
    teachingDescription:
      "A protective resin coating flowed into the grooves of a decay-free back tooth to keep decay from starting.",
    category: "Preventive",
    typicalBenefitClass: "Preventive",
    requires: ["tooth"],
    illustrativeFeeUsd: 58,
    frequencyRuleKey: "sealant",
    predeterminationCommonlyRequested: false,
    commonDenials: ["DEN-AGE-LIMIT", "DEN-TOOTH-ELIGIBILITY"],
    teachingNotes:
      "Plans usually restrict sealants to permanent molars, to patients under a stated age, and to once per tooth in a multi-year window. A sealant on a tooth that already has a filling is normally not payable.",
  },
  {
    code: "D1354",
    shortName: "Caries-arresting medicament application",
    teachingDescription:
      "Application of a topical agent that stops an active cavity from progressing without drilling, per tooth.",
    category: "Preventive",
    typicalBenefitClass: "Preventive",
    requires: ["tooth"],
    illustrativeFeeUsd: 38,
    predeterminationCommonlyRequested: false,
    commonDenials: ["DEN-NOT-COVERED"],
    teachingNotes:
      "Coverage is uneven. Verify before the visit rather than assuming it follows the fluoride benefit.",
  },
  {
    code: "D1510",
    shortName: "Space maintainer, fixed unilateral",
    teachingDescription:
      "A cemented appliance that holds the gap open after a primary tooth is lost early, so the permanent tooth has room to come in.",
    category: "Preventive",
    typicalBenefitClass: "Basic",
    requires: ["quadrant"],
    illustrativeFeeUsd: 365,
    predeterminationCommonlyRequested: false,
    teachingNotes:
      "Report the quadrant, not a tooth number. Plans commonly cover it only for patients under a stated age and only for primary tooth loss.",
  },

  // ─── Restorative (D2xxx) ────────────────────────────────────────────
  {
    code: "D2140",
    shortName: "Amalgam, one surface",
    teachingDescription:
      "A silver-coloured metal filling restoring a single surface of a back tooth.",
    category: "Restorative",
    typicalBenefitClass: "Basic",
    requires: ["tooth", "surface"],
    illustrativeFeeUsd: 165,
    predeterminationCommonlyRequested: false,
    commonDenials: ["DEN-SURFACE-MISMATCH"],
  },
  {
    code: "D2150",
    shortName: "Amalgam, two surfaces",
    teachingDescription: "A metal filling restoring two connected surfaces of one tooth.",
    category: "Restorative",
    typicalBenefitClass: "Basic",
    requires: ["tooth", "surface"],
    illustrativeFeeUsd: 205,
    predeterminationCommonlyRequested: false,
  },
  {
    code: "D2160",
    shortName: "Amalgam, three surfaces",
    teachingDescription: "A metal filling restoring three connected surfaces of one tooth.",
    category: "Restorative",
    typicalBenefitClass: "Basic",
    requires: ["tooth", "surface"],
    illustrativeFeeUsd: 245,
    predeterminationCommonlyRequested: false,
  },
  {
    code: "D2161",
    shortName: "Amalgam, four or more surfaces",
    teachingDescription: "A metal filling restoring four or more surfaces of one tooth.",
    category: "Restorative",
    typicalBenefitClass: "Basic",
    requires: ["tooth", "surface"],
    illustrativeFeeUsd: 285,
    predeterminationCommonlyRequested: false,
    teachingNotes:
      "Surface count drives payment, so the surfaces listed must match the clinical note exactly. Overstating them is what auditors look for first.",
  },
  {
    code: "D2330",
    shortName: "Composite, one surface, anterior",
    teachingDescription:
      "A tooth-coloured filling restoring one surface of a front tooth.",
    category: "Restorative",
    typicalBenefitClass: "Basic",
    requires: ["tooth", "surface"],
    illustrativeFeeUsd: 178,
    predeterminationCommonlyRequested: false,
    commonDenials: ["DEN-SURFACE-MISMATCH"],
  },
  {
    code: "D2331",
    shortName: "Composite, two surfaces, anterior",
    teachingDescription: "A tooth-coloured filling restoring two surfaces of a front tooth.",
    category: "Restorative",
    typicalBenefitClass: "Basic",
    requires: ["tooth", "surface"],
    illustrativeFeeUsd: 218,
    predeterminationCommonlyRequested: false,
  },
  {
    code: "D2332",
    shortName: "Composite, three surfaces, anterior",
    teachingDescription: "A tooth-coloured filling restoring three surfaces of a front tooth.",
    category: "Restorative",
    typicalBenefitClass: "Basic",
    requires: ["tooth", "surface"],
    illustrativeFeeUsd: 262,
    predeterminationCommonlyRequested: false,
  },
  {
    code: "D2335",
    shortName: "Composite, four or more surfaces or incisal angle, anterior",
    teachingDescription:
      "A tooth-coloured filling on a front tooth covering four or more surfaces, or rebuilding a broken corner of the biting edge.",
    category: "Restorative",
    typicalBenefitClass: "Basic",
    requires: ["tooth", "surface"],
    illustrativeFeeUsd: 308,
    predeterminationCommonlyRequested: false,
  },
  {
    code: "D2391",
    shortName: "Composite, one surface, posterior",
    teachingDescription:
      "A tooth-coloured filling restoring one surface of a back tooth.",
    category: "Restorative",
    typicalBenefitClass: "Basic",
    requires: ["tooth", "surface"],
    illustrativeFeeUsd: 195,
    predeterminationCommonlyRequested: false,
    alternateBenefitRisk: true,
    commonDenials: ["DEN-ALT-BENEFIT"],
    teachingNotes:
      "Some plans still pay posterior composites at the matching amalgam rate and bill the difference to the patient. That is an alternate benefit, not a denial — the service was covered, just at a lower allowance.",
  },
  {
    code: "D2392",
    shortName: "Composite, two surfaces, posterior",
    teachingDescription: "A tooth-coloured filling restoring two surfaces of a back tooth.",
    category: "Restorative",
    typicalBenefitClass: "Basic",
    requires: ["tooth", "surface"],
    illustrativeFeeUsd: 248,
    predeterminationCommonlyRequested: false,
    alternateBenefitRisk: true,
    commonDenials: ["DEN-ALT-BENEFIT"],
  },
  {
    code: "D2393",
    shortName: "Composite, three surfaces, posterior",
    teachingDescription: "A tooth-coloured filling restoring three surfaces of a back tooth.",
    category: "Restorative",
    typicalBenefitClass: "Basic",
    requires: ["tooth", "surface"],
    illustrativeFeeUsd: 298,
    predeterminationCommonlyRequested: false,
    alternateBenefitRisk: true,
  },
  {
    code: "D2394",
    shortName: "Composite, four or more surfaces, posterior",
    teachingDescription: "A tooth-coloured filling restoring four or more surfaces of a back tooth.",
    category: "Restorative",
    typicalBenefitClass: "Basic",
    requires: ["tooth", "surface"],
    illustrativeFeeUsd: 345,
    predeterminationCommonlyRequested: false,
    alternateBenefitRisk: true,
  },
  {
    code: "D2740",
    shortName: "Crown, all-ceramic",
    teachingDescription:
      "A laboratory-made cap covering the whole tooth, made entirely of tooth-coloured ceramic with no metal underneath.",
    category: "Restorative",
    typicalBenefitClass: "Major",
    requires: ["tooth"],
    illustrativeFeeUsd: 1320,
    frequencyRuleKey: "crown-replacement",
    predeterminationCommonlyRequested: true,
    alternateBenefitRisk: true,
    commonAttachments: ["Pre-operative radiograph", "Narrative describing tooth breakdown or cracks", "Periodontal charting if bone support is in question"],
    commonDenials: ["DEN-ALT-BENEFIT", "DEN-FREQ-CROWN", "DEN-MED-NEC", "DEN-WAITING"],
    teachingNotes:
      "On back teeth, many PPOs pay this at a metal crown allowance. On front teeth the downgrade rarely applies. Know which teeth your plan treats as posterior before quoting the patient.",
  },
  {
    code: "D2750",
    shortName: "Crown, porcelain fused to high noble metal",
    teachingDescription:
      "A cap with a precious-metal core and a tooth-coloured porcelain outer layer.",
    category: "Restorative",
    typicalBenefitClass: "Major",
    requires: ["tooth"],
    illustrativeFeeUsd: 1265,
    frequencyRuleKey: "crown-replacement",
    predeterminationCommonlyRequested: true,
    commonDenials: ["DEN-FREQ-CROWN", "DEN-WAITING"],
    teachingNotes:
      "Some plans exclude the extra cost of high noble metal and pay at the base-metal level, leaving a metal-upgrade balance for the patient.",
  },
  {
    code: "D2751",
    shortName: "Crown, porcelain fused to base metal",
    teachingDescription:
      "A cap with a non-precious metal core and a porcelain outer layer — often the level a plan will actually pay to.",
    category: "Restorative",
    typicalBenefitClass: "Major",
    requires: ["tooth"],
    illustrativeFeeUsd: 1165,
    frequencyRuleKey: "crown-replacement",
    predeterminationCommonlyRequested: true,
  },
  {
    code: "D2790",
    shortName: "Crown, full cast high noble metal",
    teachingDescription:
      "A full gold-coloured cast metal cap with no porcelain, durable and usually the benchmark a posterior downgrade pays to.",
    category: "Restorative",
    typicalBenefitClass: "Major",
    requires: ["tooth"],
    illustrativeFeeUsd: 1245,
    frequencyRuleKey: "crown-replacement",
    predeterminationCommonlyRequested: true,
  },
  {
    code: "D2920",
    shortName: "Recement crown",
    teachingDescription:
      "Cleaning and re-cementing a crown that came off but is still sound.",
    category: "Restorative",
    typicalBenefitClass: "Basic",
    requires: ["tooth"],
    illustrativeFeeUsd: 95,
    predeterminationCommonlyRequested: false,
    teachingNotes:
      "Usually not payable when the original crown was placed by the same office within the plan's stated warranty window.",
  },
  {
    code: "D2930",
    shortName: "Stainless steel crown, primary tooth",
    teachingDescription:
      "A prefabricated metal cap fitted over a badly decayed baby tooth in a single visit.",
    category: "Restorative",
    typicalBenefitClass: "Basic",
    requires: ["tooth"],
    illustrativeFeeUsd: 312,
    predeterminationCommonlyRequested: false,
    commonDenials: ["DEN-TOOTH-ELIGIBILITY"],
    teachingNotes:
      "Must be reported on a primary tooth letter. Sending a permanent tooth number with this code contradicts itself and will be questioned.",
  },
  {
    code: "D2931",
    shortName: "Stainless steel crown, permanent tooth",
    teachingDescription:
      "A prefabricated metal cap on a permanent tooth, often an interim solution for a young patient.",
    category: "Restorative",
    typicalBenefitClass: "Basic",
    requires: ["tooth"],
    illustrativeFeeUsd: 355,
    predeterminationCommonlyRequested: false,
  },
  {
    code: "D2940",
    shortName: "Protective restoration",
    teachingDescription:
      "A temporary filling placed to seal and settle a tooth until definitive treatment can be done.",
    category: "Restorative",
    typicalBenefitClass: "Basic",
    requires: ["tooth"],
    illustrativeFeeUsd: 95,
    predeterminationCommonlyRequested: false,
    commonDenials: ["DEN-BUNDLE-RESTORATIVE"],
    teachingNotes:
      "Not payable as a step inside a treatment already planned for that visit. It is for stabilising a tooth, not for the temporary phase of a crown.",
  },
  {
    code: "D2950",
    shortName: "Core buildup with pins if used",
    teachingDescription:
      "Rebuilding enough missing tooth structure that a crown has something to hold onto.",
    category: "Restorative",
    typicalBenefitClass: "Major",
    requires: ["tooth"],
    illustrativeFeeUsd: 288,
    predeterminationCommonlyRequested: true,
    commonAttachments: ["Pre-operative radiograph showing extent of lost structure", "Narrative stating how much tooth remained"],
    commonDenials: ["DEN-BUNDLE-BUILDUP", "DEN-MED-NEC"],
    teachingNotes:
      "The most-audited restorative code in dentistry. If the note does not show the tooth was too broken down to retain a crown on its own, payers treat it as part of the crown preparation and pay nothing extra.",
  },
  {
    code: "D2954",
    shortName: "Prefabricated post and core",
    teachingDescription:
      "A ready-made post cemented into a root-canal-treated root, plus the buildup around it, to support a crown.",
    category: "Restorative",
    typicalBenefitClass: "Major",
    requires: ["tooth"],
    illustrativeFeeUsd: 315,
    predeterminationCommonlyRequested: true,
    commonDenials: ["DEN-BUNDLE-BUILDUP"],
    teachingNotes:
      "Only valid on a tooth that has had root canal treatment. Reporting it alongside a core buildup on the same tooth is normally paid as one or the other, not both.",
  },

  // ─── Endodontics (D3xxx) ────────────────────────────────────────────
  {
    code: "D3110",
    shortName: "Direct pulp cap",
    teachingDescription:
      "Placing a medicated dressing directly on an exposed nerve to try to keep the tooth alive.",
    category: "Endodontics",
    typicalBenefitClass: "Basic",
    requires: ["tooth"],
    illustrativeFeeUsd: 85,
    predeterminationCommonlyRequested: false,
    commonDenials: ["DEN-BUNDLE-RESTORATIVE"],
  },
  {
    code: "D3220",
    shortName: "Therapeutic pulpotomy",
    teachingDescription:
      "Removing the nerve tissue from the crown portion of a tooth and medicating it, leaving the root canal tissue in place — most often done on a baby tooth.",
    category: "Endodontics",
    typicalBenefitClass: "Basic",
    requires: ["tooth"],
    illustrativeFeeUsd: 225,
    predeterminationCommonlyRequested: false,
    teachingNotes:
      "Not payable as the first stage of a root canal on the same tooth. When a full root canal follows, the payer expects the root canal code alone.",
  },
  {
    code: "D3310",
    shortName: "Root canal, anterior tooth",
    teachingDescription:
      "Cleaning, shaping and filling the nerve canal of a front tooth, excluding the final restoration.",
    category: "Endodontics",
    typicalBenefitClass: "Major",
    requires: ["tooth"],
    illustrativeFeeUsd: 885,
    predeterminationCommonlyRequested: true,
    commonAttachments: ["Pre-operative radiograph", "Post-operative radiograph showing the final fill"],
    commonDenials: ["DEN-WAITING", "DEN-DUPLICATE"],
    teachingNotes:
      "Code selection follows the tooth, not the difficulty: anterior, premolar and molar each have their own code. Check the tooth number against the chart before billing.",
  },
  {
    code: "D3320",
    shortName: "Root canal, premolar",
    teachingDescription:
      "Cleaning, shaping and filling the nerve canals of a premolar, excluding the final restoration.",
    category: "Endodontics",
    typicalBenefitClass: "Major",
    requires: ["tooth"],
    illustrativeFeeUsd: 1040,
    predeterminationCommonlyRequested: true,
    commonAttachments: ["Pre-operative radiograph", "Post-operative radiograph"],
  },
  {
    code: "D3330",
    shortName: "Root canal, molar",
    teachingDescription:
      "Cleaning, shaping and filling the nerve canals of a molar, excluding the final restoration.",
    category: "Endodontics",
    typicalBenefitClass: "Major",
    requires: ["tooth"],
    illustrativeFeeUsd: 1285,
    predeterminationCommonlyRequested: true,
    commonAttachments: ["Pre-operative radiograph", "Post-operative radiograph"],
    commonDenials: ["DEN-WAITING", "DEN-ANNUAL-MAX"],
  },
  {
    code: "D3346",
    shortName: "Root canal retreatment, anterior",
    teachingDescription:
      "Reopening a front tooth that had a previous root canal, removing the old filling material and re-treating the canal.",
    category: "Endodontics",
    typicalBenefitClass: "Major",
    requires: ["tooth", "date-of-prior-placement"],
    illustrativeFeeUsd: 1075,
    predeterminationCommonlyRequested: true,
    commonAttachments: ["Radiograph showing the failing previous treatment", "Narrative and date of the original root canal"],
    commonDenials: ["DEN-DUPLICATE", "DEN-MED-NEC"],
    teachingNotes:
      "Without the original treatment date the payer's system reads this as a duplicate root canal on the same tooth and denies it.",
  },
  {
    code: "D3348",
    shortName: "Root canal retreatment, molar",
    teachingDescription:
      "Reopening and re-treating a molar that had a previous root canal.",
    category: "Endodontics",
    typicalBenefitClass: "Major",
    requires: ["tooth", "date-of-prior-placement"],
    illustrativeFeeUsd: 1465,
    predeterminationCommonlyRequested: true,
    commonAttachments: ["Radiograph showing the failing previous treatment", "Narrative and date of the original root canal"],
    commonDenials: ["DEN-DUPLICATE"],
  },
  {
    code: "D3410",
    shortName: "Apicoectomy, anterior",
    teachingDescription:
      "Surgically removing the infected tip of a front tooth's root through the gum when a conventional root canal has not resolved the problem.",
    category: "Endodontics",
    typicalBenefitClass: "Major",
    requires: ["tooth"],
    illustrativeFeeUsd: 1125,
    predeterminationCommonlyRequested: true,
    commonAttachments: ["Radiograph showing the lesion at the root tip", "Narrative on the failed prior treatment"],
  },
  {
    code: "D3430",
    shortName: "Retrograde filling",
    teachingDescription:
      "Sealing the cut root tip from below during root-end surgery, reported per root.",
    category: "Endodontics",
    typicalBenefitClass: "Major",
    requires: ["tooth"],
    illustrativeFeeUsd: 365,
    predeterminationCommonlyRequested: true,
    teachingNotes: "Reported per root treated, so the quantity must match the surgical note.",
  },

  // ─── Periodontics (D4xxx) ───────────────────────────────────────────
  {
    code: "D4210",
    shortName: "Gingivectomy, four or more teeth per quadrant",
    teachingDescription:
      "Surgically trimming away overgrown or diseased gum tissue across four or more teeth in one quadrant.",
    category: "Periodontics",
    typicalBenefitClass: "Major",
    requires: ["quadrant"],
    illustrativeFeeUsd: 520,
    predeterminationCommonlyRequested: true,
    commonAttachments: ["Full periodontal chart", "Radiographs"],
  },
  {
    code: "D4249",
    shortName: "Crown lengthening, hard tissue",
    teachingDescription:
      "Reshaping gum and bone around a tooth so that enough sound structure is exposed for a crown to seat properly.",
    category: "Periodontics",
    typicalBenefitClass: "Major",
    requires: ["tooth"],
    illustrativeFeeUsd: 935,
    predeterminationCommonlyRequested: true,
    commonAttachments: ["Pre-operative radiograph", "Narrative describing the amount of sound structure remaining"],
    commonDenials: ["DEN-MED-NEC", "DEN-BUNDLE-PERIO"],
    teachingNotes:
      "Payers scrutinise this when it is billed on the same date as the crown preparation; the documentation must show bone was actually removed and reshaped.",
  },
  {
    code: "D4260",
    shortName: "Osseous surgery, four or more teeth per quadrant",
    teachingDescription:
      "Opening a gum flap to clean and reshape diseased bone around four or more teeth in a quadrant, then closing it.",
    category: "Periodontics",
    typicalBenefitClass: "Major",
    requires: ["quadrant"],
    illustrativeFeeUsd: 1285,
    predeterminationCommonlyRequested: true,
    commonAttachments: ["Full-mouth periodontal chart with pocket depths", "Radiographs showing bone loss", "Record of prior non-surgical therapy"],
    commonDenials: ["DEN-MED-NEC", "DEN-PREAUTH", "DEN-ANNUAL-MAX"],
    teachingNotes:
      "Almost always requires a predetermination, and payers typically want evidence that scaling and root planing was done first and did not resolve the pockets.",
  },
  {
    code: "D4263",
    shortName: "Bone graft, first site in quadrant",
    teachingDescription:
      "Placing graft material into a bone defect around a natural tooth to rebuild lost support, first site in the quadrant.",
    category: "Periodontics",
    typicalBenefitClass: "Major",
    requires: ["tooth"],
    illustrativeFeeUsd: 725,
    predeterminationCommonlyRequested: true,
    commonAttachments: ["Radiograph showing the defect", "Periodontal charting"],
  },
  {
    code: "D4341",
    shortName: "Scaling and root planing, four or more teeth per quadrant",
    teachingDescription:
      "Deep cleaning below the gumline, removing tartar from root surfaces in a quadrant with four or more affected teeth, done with anaesthesia.",
    category: "Periodontics",
    typicalBenefitClass: "Basic",
    requires: ["quadrant"],
    illustrativeFeeUsd: 312,
    frequencyRuleKey: "srp",
    predeterminationCommonlyRequested: true,
    commonAttachments: ["Periodontal chart with pocket depths per tooth", "Radiographs showing bone loss"],
    commonDenials: ["DEN-SRP-TOOTH-COUNT", "DEN-FREQ-SRP", "DEN-MED-NEC"],
    teachingNotes:
      "The tooth count is the whole test. Four or more teeth in that quadrant must actually show disease in the chart. Three or fewer belongs on the limited code — billing the higher one anyway is the single most common dental audit finding.",
  },
  {
    code: "D4342",
    shortName: "Scaling and root planing, one to three teeth per quadrant",
    teachingDescription:
      "The same deep cleaning below the gumline, but in a quadrant where only one to three teeth are affected.",
    category: "Periodontics",
    typicalBenefitClass: "Basic",
    requires: ["quadrant"],
    illustrativeFeeUsd: 198,
    frequencyRuleKey: "srp",
    predeterminationCommonlyRequested: true,
    commonAttachments: ["Periodontal chart identifying the specific teeth treated"],
    commonDenials: ["DEN-SRP-TOOTH-COUNT", "DEN-FREQ-SRP"],
  },
  {
    code: "D4346",
    shortName: "Scaling for generalised gum inflammation",
    teachingDescription:
      "A full-mouth cleaning for a patient with widespread gum inflammation but without the bone loss that would justify deep root planing.",
    category: "Periodontics",
    typicalBenefitClass: "Basic",
    requires: ["none"],
    illustrativeFeeUsd: 168,
    predeterminationCommonlyRequested: false,
    commonDenials: ["DEN-BUNDLE-PERIO"],
    teachingNotes:
      "Sits between a routine cleaning and root planing. Reporting it on the same day as a routine cleaning is contradictory and will be reduced to one service.",
  },
  {
    code: "D4355",
    shortName: "Full-mouth debridement",
    teachingDescription:
      "Removing heavy deposits so that the dentist can actually see and evaluate the mouth, performed when a proper examination is impossible at the first visit.",
    category: "Periodontics",
    typicalBenefitClass: "Basic",
    requires: ["none"],
    illustrativeFeeUsd: 182,
    predeterminationCommonlyRequested: false,
    commonDenials: ["DEN-BUNDLE-PERIO"],
    teachingNotes:
      "Because it exists to make an evaluation possible, most payers will not pay a comprehensive exam on the same date. The evaluation is expected at a later visit.",
  },
  {
    code: "D4910",
    shortName: "Periodontal maintenance",
    teachingDescription:
      "The ongoing recall cleaning for a patient who has already completed periodontal therapy, including monitoring the pockets.",
    category: "Periodontics",
    typicalBenefitClass: "Basic",
    requires: ["none"],
    illustrativeFeeUsd: 168,
    frequencyRuleKey: "perio-maintenance",
    predeterminationCommonlyRequested: false,
    commonDenials: ["DEN-PERIO-MAINT-CONFLICT", "DEN-FREQ-PERIO-MAINT"],
    teachingNotes:
      "Begins only after active periodontal treatment. Plans count maintenance and routine cleanings against a combined per-year total on most contracts, so alternating the two codes does not create extra benefit.",
  },

  // ─── Removable Prosthodontics (D5xxx) ───────────────────────────────
  {
    code: "D5110",
    shortName: "Complete denture, upper",
    teachingDescription:
      "A full removable replacement for all upper teeth.",
    category: "Removable Prosthodontics",
    typicalBenefitClass: "Major",
    requires: ["arch"],
    illustrativeFeeUsd: 1985,
    frequencyRuleKey: "prosthetic-replacement",
    predeterminationCommonlyRequested: true,
    commonDenials: ["DEN-FREQ-PROSTHETIC", "DEN-ANNUAL-MAX", "DEN-WAITING"],
    teachingNotes:
      "Replacement is typically limited to once every five to ten years per arch. Always ask the date the current denture was placed before treatment is planned.",
  },
  {
    code: "D5120",
    shortName: "Complete denture, lower",
    teachingDescription: "A full removable replacement for all lower teeth.",
    category: "Removable Prosthodontics",
    typicalBenefitClass: "Major",
    requires: ["arch"],
    illustrativeFeeUsd: 1985,
    frequencyRuleKey: "prosthetic-replacement",
    predeterminationCommonlyRequested: true,
    commonDenials: ["DEN-FREQ-PROSTHETIC"],
  },
  {
    code: "D5211",
    shortName: "Partial denture, upper, resin base",
    teachingDescription:
      "A removable appliance with an acrylic base replacing some upper teeth, with clasps onto the remaining teeth.",
    category: "Removable Prosthodontics",
    typicalBenefitClass: "Major",
    requires: ["arch"],
    illustrativeFeeUsd: 1645,
    frequencyRuleKey: "prosthetic-replacement",
    predeterminationCommonlyRequested: true,
    commonDenials: ["DEN-MISSING-TOOTH", "DEN-FREQ-PROSTHETIC"],
  },
  {
    code: "D5213",
    shortName: "Partial denture, upper, cast metal frame",
    teachingDescription:
      "A removable upper partial built on a cast metal framework with acrylic and teeth attached.",
    category: "Removable Prosthodontics",
    typicalBenefitClass: "Major",
    requires: ["arch"],
    illustrativeFeeUsd: 1925,
    frequencyRuleKey: "prosthetic-replacement",
    predeterminationCommonlyRequested: true,
    commonDenials: ["DEN-MISSING-TOOTH", "DEN-FREQ-PROSTHETIC"],
    teachingNotes:
      "List every tooth being replaced on the claim. Missing tooth clauses are applied tooth by tooth, so part of the appliance may be covered while part is not.",
  },
  {
    code: "D5214",
    shortName: "Partial denture, lower, cast metal frame",
    teachingDescription:
      "A removable lower partial built on a cast metal framework.",
    category: "Removable Prosthodontics",
    typicalBenefitClass: "Major",
    requires: ["arch"],
    illustrativeFeeUsd: 1925,
    frequencyRuleKey: "prosthetic-replacement",
    predeterminationCommonlyRequested: true,
    commonDenials: ["DEN-MISSING-TOOTH"],
  },
  {
    code: "D5410",
    shortName: "Adjust complete denture, upper",
    teachingDescription:
      "Chairside adjustment of an upper full denture to relieve a sore spot or improve the fit.",
    category: "Removable Prosthodontics",
    typicalBenefitClass: "Basic",
    requires: ["arch"],
    illustrativeFeeUsd: 88,
    predeterminationCommonlyRequested: false,
    teachingNotes:
      "Normally not payable within the first six months after delivery, since early adjustments are considered part of the denture fee.",
  },
  {
    code: "D5511",
    shortName: "Repair broken complete denture base, lower",
    teachingDescription: "Laboratory repair of a fractured lower full denture base.",
    category: "Removable Prosthodontics",
    typicalBenefitClass: "Basic",
    requires: ["arch"],
    illustrativeFeeUsd: 345,
    predeterminationCommonlyRequested: false,
  },
  {
    code: "D5750",
    shortName: "Reline complete upper denture, laboratory",
    teachingDescription:
      "Resurfacing the tissue side of an upper denture in the laboratory so it fits a ridge that has changed shape.",
    category: "Removable Prosthodontics",
    typicalBenefitClass: "Basic",
    requires: ["arch"],
    illustrativeFeeUsd: 495,
    frequencyRuleKey: "reline",
    predeterminationCommonlyRequested: false,
    commonDenials: ["DEN-FREQ-PROSTHETIC"],
    teachingNotes: "Commonly limited to once every two to three years and excluded within six months of a new denture.",
  },

  // ─── Implant and Fixed Prosthodontics (D6xxx) ───────────────────────
  {
    code: "D6010",
    shortName: "Surgical placement of implant body",
    teachingDescription:
      "Surgically placing the titanium fixture into the jawbone that will later support a crown or bridge.",
    category: "Implant Services",
    typicalBenefitClass: "Major",
    requires: ["tooth"],
    illustrativeFeeUsd: 2250,
    predeterminationCommonlyRequested: true,
    commonAttachments: ["Pre-operative radiograph or 3D scan", "Narrative on why the tooth is unrestorable or already missing", "Date the tooth was lost"],
    commonDenials: ["DEN-MISSING-TOOTH", "DEN-NOT-COVERED", "DEN-PREAUTH", "DEN-ANNUAL-MAX"],
    teachingNotes:
      "Many plans exclude implants entirely, and those that cover them often pay only up to what a conventional bridge or partial would have cost. Verify in writing before surgery.",
  },
  {
    code: "D6057",
    shortName: "Custom abutment",
    teachingDescription:
      "The custom-milled connector that joins the implant fixture to the crown.",
    category: "Implant Services",
    typicalBenefitClass: "Major",
    requires: ["tooth"],
    illustrativeFeeUsd: 565,
    predeterminationCommonlyRequested: true,
    commonDenials: ["DEN-NOT-COVERED"],
  },
  {
    code: "D6058",
    shortName: "Abutment-supported ceramic crown",
    teachingDescription:
      "An all-ceramic crown that seats on an implant abutment rather than on a natural tooth.",
    category: "Implant Services",
    typicalBenefitClass: "Major",
    requires: ["tooth"],
    illustrativeFeeUsd: 1845,
    predeterminationCommonlyRequested: true,
    commonDenials: ["DEN-MISSING-TOOTH", "DEN-ANNUAL-MAX", "DEN-ALT-BENEFIT"],
    teachingNotes:
      "This is an implant crown, not a natural-tooth crown. Billing a natural-tooth crown code over an implant misrepresents the service.",
  },
  {
    code: "D6240",
    shortName: "Bridge pontic, porcelain fused to high noble metal",
    teachingDescription:
      "The replacement tooth suspended in a bridge between two anchor teeth.",
    category: "Fixed Prosthodontics",
    typicalBenefitClass: "Major",
    requires: ["tooth"],
    illustrativeFeeUsd: 1225,
    frequencyRuleKey: "prosthetic-replacement",
    predeterminationCommonlyRequested: true,
    commonDenials: ["DEN-MISSING-TOOTH", "DEN-FREQ-PROSTHETIC", "DEN-ANNUAL-MAX"],
    teachingNotes:
      "A bridge is billed as separate units: one code per pontic and one per retainer crown. The missing tooth clause is tested against the pontic space.",
  },
  {
    code: "D6245",
    shortName: "Bridge pontic, all-ceramic",
    teachingDescription:
      "An all-ceramic replacement tooth within a bridge.",
    category: "Fixed Prosthodontics",
    typicalBenefitClass: "Major",
    requires: ["tooth"],
    illustrativeFeeUsd: 1275,
    frequencyRuleKey: "prosthetic-replacement",
    predeterminationCommonlyRequested: true,
    alternateBenefitRisk: true,
    commonDenials: ["DEN-MISSING-TOOTH", "DEN-ALT-BENEFIT"],
  },
  {
    code: "D6750",
    shortName: "Bridge retainer crown, porcelain fused to high noble metal",
    teachingDescription:
      "The crown on an anchor tooth that holds one end of a bridge in place.",
    category: "Fixed Prosthodontics",
    typicalBenefitClass: "Major",
    requires: ["tooth"],
    illustrativeFeeUsd: 1265,
    frequencyRuleKey: "prosthetic-replacement",
    predeterminationCommonlyRequested: true,
    commonDenials: ["DEN-FREQ-CROWN", "DEN-ANNUAL-MAX"],
  },
  {
    code: "D6930",
    shortName: "Recement bridge",
    teachingDescription: "Re-cementing a bridge that has loosened but is otherwise intact.",
    category: "Fixed Prosthodontics",
    typicalBenefitClass: "Basic",
    requires: ["arch"],
    illustrativeFeeUsd: 155,
    predeterminationCommonlyRequested: false,
  },

  // ─── Oral Surgery (D7xxx) ───────────────────────────────────────────
  {
    code: "D7111",
    shortName: "Extraction of primary tooth remnants",
    teachingDescription:
      "Removing the remaining crown fragments of a baby tooth that has largely resorbed.",
    category: "Oral Surgery",
    typicalBenefitClass: "Basic",
    requires: ["tooth"],
    illustrativeFeeUsd: 155,
    predeterminationCommonlyRequested: false,
  },
  {
    code: "D7140",
    shortName: "Simple extraction, erupted tooth",
    teachingDescription:
      "Removing a visible tooth with forceps and elevators, without cutting gum or bone.",
    category: "Oral Surgery",
    typicalBenefitClass: "Basic",
    requires: ["tooth"],
    illustrativeFeeUsd: 228,
    predeterminationCommonlyRequested: false,
    commonDenials: ["DEN-MED-NEC"],
    teachingNotes:
      "If the note describes raising a flap or removing bone, the surgical extraction code applies instead — and the note has to say so, not the coder.",
  },
  {
    code: "D7210",
    shortName: "Surgical extraction, erupted tooth",
    teachingDescription:
      "Removing a visible tooth that required cutting the gum, removing bone, or sectioning the tooth.",
    category: "Oral Surgery",
    typicalBenefitClass: "Basic",
    requires: ["tooth"],
    illustrativeFeeUsd: 385,
    predeterminationCommonlyRequested: false,
    commonAttachments: ["Operative note describing flap elevation, bone removal or sectioning"],
    commonDenials: ["DEN-MED-NEC", "DEN-DOWNCODE-SURGICAL"],
    teachingNotes:
      "Payers routinely downcode this to a simple extraction when the narrative does not describe the surgical steps. The documentation, not the code, wins the appeal.",
  },
  {
    code: "D7220",
    shortName: "Removal of impacted tooth, soft tissue",
    teachingDescription:
      "Removing a tooth still covered by gum tissue but not by bone.",
    category: "Oral Surgery",
    typicalBenefitClass: "Basic",
    requires: ["tooth"],
    illustrativeFeeUsd: 405,
    predeterminationCommonlyRequested: true,
    commonAttachments: ["Radiograph showing the impaction depth"],
    commonDenials: ["DEN-DOWNCODE-SURGICAL"],
  },
  {
    code: "D7230",
    shortName: "Removal of impacted tooth, partially bony",
    teachingDescription:
      "Removing a tooth partly covered by bone, requiring bone removal to extract.",
    category: "Oral Surgery",
    typicalBenefitClass: "Basic",
    requires: ["tooth"],
    illustrativeFeeUsd: 485,
    predeterminationCommonlyRequested: true,
    commonAttachments: ["Radiograph showing bone coverage"],
    commonDenials: ["DEN-DOWNCODE-SURGICAL"],
    teachingNotes:
      "The impaction level is judged from the radiograph. If the image does not show the bone covering the payer expects, the claim is paid at the lower level.",
  },
  {
    code: "D7240",
    shortName: "Removal of impacted tooth, completely bony",
    teachingDescription:
      "Removing a tooth fully encased in bone.",
    category: "Oral Surgery",
    typicalBenefitClass: "Basic",
    requires: ["tooth"],
    illustrativeFeeUsd: 575,
    predeterminationCommonlyRequested: true,
    commonAttachments: ["Radiograph showing full bone coverage", "Operative narrative"],
    commonDenials: ["DEN-DOWNCODE-SURGICAL", "DEN-ANNUAL-MAX"],
  },
  {
    code: "D7250",
    shortName: "Removal of residual roots",
    teachingDescription:
      "Surgically removing root fragments left in the jaw from a previous extraction.",
    category: "Oral Surgery",
    typicalBenefitClass: "Basic",
    requires: ["tooth"],
    illustrativeFeeUsd: 355,
    predeterminationCommonlyRequested: false,
  },
  {
    code: "D7310",
    shortName: "Alveoloplasty with extractions, per quadrant",
    teachingDescription:
      "Smoothing and reshaping the bony ridge at the same visit as extractions, so a denture can seat comfortably.",
    category: "Oral Surgery",
    typicalBenefitClass: "Basic",
    requires: ["quadrant"],
    illustrativeFeeUsd: 495,
    predeterminationCommonlyRequested: true,
    commonDenials: ["DEN-BUNDLE-SURGICAL"],
    teachingNotes:
      "Payers will not pay this simply because extractions were done. The note must show deliberate ridge recontouring beyond routine socket management.",
  },
  {
    code: "D7510",
    shortName: "Incision and drainage of intraoral abscess",
    teachingDescription:
      "Cutting into and draining a soft-tissue abscess inside the mouth to relieve infection.",
    category: "Oral Surgery",
    typicalBenefitClass: "Basic",
    requires: ["quadrant"],
    illustrativeFeeUsd: 345,
    predeterminationCommonlyRequested: false,
    commonDenials: ["DEN-BUNDLE-SURGICAL"],
    teachingNotes: "Not separately payable when the drainage happened through the tooth during an extraction or root canal at the same visit.",
  },
  {
    code: "D7953",
    shortName: "Ridge preservation graft in an extraction socket",
    teachingDescription:
      "Placing graft material into a socket right after extraction to preserve bone width for a future implant.",
    category: "Oral Surgery",
    typicalBenefitClass: "Major",
    requires: ["tooth"],
    illustrativeFeeUsd: 685,
    predeterminationCommonlyRequested: true,
    commonAttachments: ["Radiograph", "Narrative describing the planned future restoration"],
    commonDenials: ["DEN-NOT-COVERED", "DEN-MED-NEC"],
    teachingNotes:
      "Plans that exclude implants often exclude the graft that prepares for one. Confirm coverage before the extraction appointment, not after.",
  },
  {
    code: "D7960",
    shortName: "Frenectomy",
    teachingDescription:
      "Releasing or removing a tight band of tissue between lip or tongue and gum that is restricting movement or pulling on the gums.",
    category: "Oral Surgery",
    typicalBenefitClass: "Basic",
    requires: ["none"],
    illustrativeFeeUsd: 425,
    predeterminationCommonlyRequested: true,
    commonDenials: ["DEN-MED-NEC", "DEN-NOT-COVERED"],
  },

  // ─── Orthodontics (D8xxx) ───────────────────────────────────────────
  {
    code: "D8080",
    shortName: "Comprehensive orthodontic treatment, adolescent",
    teachingDescription:
      "The full course of braces or aligners for a patient in the permanent dentition, billed as one case fee.",
    category: "Orthodontics",
    typicalBenefitClass: "Orthodontic",
    requires: ["none"],
    illustrativeFeeUsd: 6200,
    predeterminationCommonlyRequested: true,
    commonAttachments: ["Diagnostic records", "Treatment plan with expected length in months", "Banding date"],
    commonDenials: ["DEN-ORTHO-AGE", "DEN-ORTHO-LIFETIME-MAX", "DEN-PREAUTH", "DEN-WAITING"],
    teachingNotes:
      "Orthodontics does not use the annual maximum. It has its own lifetime maximum and usually pays as an initial amount at banding followed by monthly instalments while treatment continues.",
  },
  {
    code: "D8090",
    shortName: "Comprehensive orthodontic treatment, adult",
    teachingDescription:
      "The full course of orthodontic treatment for an adult patient, billed as one case fee.",
    category: "Orthodontics",
    typicalBenefitClass: "Orthodontic",
    requires: ["none"],
    illustrativeFeeUsd: 6800,
    predeterminationCommonlyRequested: true,
    commonDenials: ["DEN-ORTHO-AGE", "DEN-ORTHO-LIFETIME-MAX"],
    teachingNotes:
      "Plenty of plans cover orthodontics only to age 19. Adult cases are then fully patient responsibility, which must be quoted before banding.",
  },
  {
    code: "D8670",
    shortName: "Periodic orthodontic adjustment visit",
    teachingDescription:
      "A routine visit during active treatment to adjust the appliance, billed per visit when the plan pays in instalments.",
    category: "Orthodontics",
    typicalBenefitClass: "Orthodontic",
    requires: ["none"],
    illustrativeFeeUsd: 365,
    predeterminationCommonlyRequested: false,
    commonDenials: ["DEN-ORTHO-LIFETIME-MAX"],
  },
  {
    code: "D8680",
    shortName: "Orthodontic retention",
    teachingDescription:
      "Removing the appliances and providing retainers at the end of treatment.",
    category: "Orthodontics",
    typicalBenefitClass: "Orthodontic",
    requires: ["none"],
    illustrativeFeeUsd: 525,
    predeterminationCommonlyRequested: false,
    teachingNotes: "Often included inside the case fee rather than paid separately — check how the plan defines the case.",
  },

  // ─── Adjunctive Services (D9xxx) ────────────────────────────────────
  {
    code: "D9110",
    shortName: "Palliative treatment for dental pain",
    teachingDescription:
      "Emergency care aimed only at relieving pain, not at definitively fixing the problem, billed per visit.",
    category: "Adjunctive Services",
    typicalBenefitClass: "Basic",
    requires: ["none"],
    illustrativeFeeUsd: 135,
    predeterminationCommonlyRequested: false,
    commonDenials: ["DEN-BUNDLE-PALLIATIVE"],
    teachingNotes:
      "Not payable alongside definitive treatment on the same tooth the same day. If the tooth was extracted or the root canal started, the definitive service is what gets billed.",
  },
  {
    code: "D9222",
    shortName: "Deep sedation or general anaesthesia, first 15 minutes",
    teachingDescription:
      "The opening increment of anaesthesia that puts a patient fully under for a dental procedure.",
    category: "Adjunctive Services",
    typicalBenefitClass: "Adjunctive",
    requires: ["none"],
    illustrativeFeeUsd: 265,
    predeterminationCommonlyRequested: true,
    commonAttachments: ["Anaesthesia record with documented start and stop times", "Medical narrative supporting the need"],
    commonDenials: ["DEN-MED-NEC", "DEN-TIME-UNITS"],
    teachingNotes:
      "Time is the billing unit, so the record must show start and stop times. Anxiety alone is rarely accepted; a documented medical or behavioural indication is what gets it paid.",
  },
  {
    code: "D9230",
    shortName: "Nitrous oxide",
    teachingDescription:
      "Inhaled sedation used to relax a patient during treatment.",
    category: "Adjunctive Services",
    typicalBenefitClass: "Adjunctive",
    requires: ["none"],
    illustrativeFeeUsd: 78,
    predeterminationCommonlyRequested: false,
    commonDenials: ["DEN-NOT-COVERED"],
    teachingNotes: "Commonly excluded for adults and covered only for children or patients with special needs.",
  },
  {
    code: "D9243",
    shortName: "Intravenous moderate sedation, each 15 minutes",
    teachingDescription:
      "Sedation given through a vein, billed in time increments after the initial period.",
    category: "Adjunctive Services",
    typicalBenefitClass: "Adjunctive",
    requires: ["none"],
    illustrativeFeeUsd: 215,
    predeterminationCommonlyRequested: true,
    commonDenials: ["DEN-TIME-UNITS", "DEN-MED-NEC"],
  },
  {
    code: "D9310",
    shortName: "Consultation by a dentist other than the treating dentist",
    teachingDescription:
      "An opinion visit with a second dentist or specialist who is not the one performing the treatment.",
    category: "Adjunctive Services",
    typicalBenefitClass: "Basic",
    requires: ["none"],
    illustrativeFeeUsd: 155,
    predeterminationCommonlyRequested: false,
    commonDenials: ["DEN-BUNDLE-EXAM"],
  },
  {
    code: "D9440",
    shortName: "Office visit after regular hours",
    teachingDescription:
      "The additional charge for seeing a patient outside normal office hours.",
    category: "Adjunctive Services",
    typicalBenefitClass: "Adjunctive",
    requires: ["none"],
    illustrativeFeeUsd: 165,
    predeterminationCommonlyRequested: false,
    commonDenials: ["DEN-NOT-COVERED"],
  },
  {
    code: "D9944",
    shortName: "Occlusal guard, hard, full arch",
    teachingDescription:
      "A rigid custom-made night guard covering a whole arch, used to protect teeth from grinding.",
    category: "Adjunctive Services",
    typicalBenefitClass: "Major",
    requires: ["arch"],
    illustrativeFeeUsd: 685,
    frequencyRuleKey: "occlusal-guard",
    predeterminationCommonlyRequested: true,
    commonDenials: ["DEN-NOT-COVERED", "DEN-FREQ-GUARD"],
    teachingNotes:
      "Coverage varies widely and is often excluded, or limited to once every three to five years. Guards made for jaw-joint therapy are frequently handled under a different benefit again.",
  },
  {
    code: "D9995",
    shortName: "Teledentistry, live video encounter",
    teachingDescription:
      "A real-time video visit between patient and dentist, reported in addition to the service actually delivered.",
    category: "Adjunctive Services",
    typicalBenefitClass: "Adjunctive",
    requires: ["none"],
    illustrativeFeeUsd: 62,
    predeterminationCommonlyRequested: false,
    commonDenials: ["DEN-NOT-COVERED"],
    teachingNotes: "This is a reporting code that accompanies the clinical service; it does not replace it.",
  },
];

/** Convenience lookup by code. */
export const CDT_CODE_INDEX: Record<string, CDTCode> = Object.fromEntries(
  CDT_CODES.map((c) => [c.code, c]),
);

export function findCDT(code: string): CDTCode | undefined {
  return CDT_CODE_INDEX[code.trim().toUpperCase()];
}

export function cdtByCategory(category: CDTCategory): CDTCode[] {
  return CDT_CODES.filter((c) => c.category === category);
}

/** Category list in the order a dental coder learns them. */
export const CDT_CATEGORY_ORDER: CDTCategory[] = [
  "Diagnostic",
  "Preventive",
  "Restorative",
  "Endodontics",
  "Periodontics",
  "Removable Prosthodontics",
  "Implant Services",
  "Fixed Prosthodontics",
  "Oral Surgery",
  "Orthodontics",
  "Adjunctive Services",
];

/**
 * Search over code, label and description. Intended for the coder stage's
 * repository search box.
 */
export function searchCDT(query: string): CDTCode[] {
  const q = query.trim().toLowerCase();
  if (!q) return CDT_CODES;
  return CDT_CODES.filter(
    (c) =>
      c.code.toLowerCase().includes(q) ||
      c.shortName.toLowerCase().includes(q) ||
      c.teachingDescription.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q),
  );
}
