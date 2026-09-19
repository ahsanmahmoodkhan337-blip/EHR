/**
 * Dental Attachment Requirements & Predetermination Candidates
 *
 * The structured, UI-consumable half of the predetermination / attachment
 * workflow. It answers two questions the front desk and the biller both need:
 *
 *   1. What does the payer want attached before it will adjudicate this code?
 *   2. Is this code worth sending for a predetermination before we touch a
 *      bur to it?
 *
 * This file is the canonical structured source. `CDTCode.commonAttachments`
 * (in cdtCodes.ts) remains a lightweight, denormalised hint for quick lists —
 * it is not the source of truth the predetermination UI should drive from.
 *
 * COPYRIGHT NOTE — READ BEFORE EDITING
 * The CDT Code set and its official nomenclature and descriptors are copyright
 * of the American Dental Association. Nothing in this file reproduces ADA
 * nomenclature or descriptors. Every `label`, `whyRequired` and `guidance`
 * string is original teaching text in plain language. Code identifiers
 * (D2740, D6010, …) are used only as references so students learn to recognise
 * them. Do not paste attachment lists from a CDT manual, a payer bulletin, or
 * a practice-management system.
 *
 * ACCURACY NOTE
 * Attachment expectations vary by payer, by plan and by the patient's claim
 * history. The lists below are teaching patterns in the common case, labelled
 * as such — not the rule of any real payer. In real work every requirement is
 * read off the specific payer's predetermination or claim guidelines.
 */

/** The kinds of supporting material a payer commonly asks to see. */
export type AttachmentType =
  | "radiograph"
  | "periodontal-chart"
  | "intraoral-photo"
  | "study-model"
  | "narrative"
  | "proof-of-prior-treatment"
  | "date-of-tooth-loss";

/** Human-readable labels for the UI. Original wording. */
export const ATTACHMENT_TYPE_LABELS: Record<AttachmentType, string> = {
  radiograph: "Radiograph (periapical / bitewing / panoramic)",
  "periodontal-chart": "Periodontal chart with probing depths",
  "intraoral-photo": "Intraoral photograph",
  "study-model": "Study model",
  narrative: "Provider narrative",
  "proof-of-prior-treatment": "Proof of prior treatment (e.g. completed scaling and root planing)",
  "date-of-tooth-loss": "Date the tooth was lost / extracted",
};

/** Whether an attachment is always required, or only when a condition is met. */
export type AttachmentWhen = "always" | "conditional";

export interface AttachmentRequirement {
  /** CDT code the requirement attaches to. */
  code: string;
  type: AttachmentType;
  when: AttachmentWhen;
  /** Original short label for the specific attachment. */
  label: string;
  /** For conditional requirements: the clinical or financial trigger. */
  condition?: string;
  /** Original wording: why the payer needs this to adjudicate. */
  whyRequired: string;
  /** Denial id (denialReasons.ts) returned when this attachment is missing. */
  missingDenialId?: string;
}

/** Why a code is a common predetermination candidate. */
export type PredeterminationDriver =
  | "high-fee"
  | "cosmetic"
  | "removable-appliance"
  | "surgical"
  | "frequency-sensitive";

export interface PredeterminationCandidate {
  code: string;
  driver: PredeterminationDriver;
  /** Original plain-language guidance: predetermine vs submit directly. */
  guidance: string;
}

/* ======================================================================= */
/* Attachment requirements by CDT code.                                     */
/* ======================================================================= */

export const ATTACHMENT_REQUIREMENTS: AttachmentRequirement[] = [
  // ── Crowns ───────────────────────────────────────────────────────────
  {
    code: "D2740",
    type: "radiograph",
    when: "always",
    label: "Pre-operative radiograph of the tooth to be crowned",
    whyRequired:
      "Shows the tooth actually exists, is restorable, and is broken down or decayed enough to justify a full crown.",
    missingDenialId: "DEN-DOC-MISSING",
  },
  {
    code: "D2740",
    type: "narrative",
    when: "always",
    label: "Narrative describing the breakdown, fracture or decay",
    whyRequired:
      "The radiograph shows anatomy; the narrative states why a crown — rather than a filling — is the right treatment.",
    missingDenialId: "DEN-MED-NEC",
  },
  {
    code: "D2740",
    type: "periodontal-chart",
    when: "conditional",
    label: "Periodontal charting for the tooth",
    condition: "When bone support around the tooth is in question.",
    whyRequired: "A crown on a tooth with failing bone support is a different risk the payer wants to see.",
  },
  {
    code: "D2750",
    type: "radiograph",
    when: "always",
    label: "Pre-operative radiograph",
    whyRequired: "Confirms the tooth is present and the crown is the definitive restoration.",
    missingDenialId: "DEN-DOC-MISSING",
  },
  {
    code: "D2750",
    type: "narrative",
    when: "always",
    label: "Narrative describing the reason for a full-coverage crown",
    whyRequired: "Justifies the full-coverage restoration rather than a direct filling.",
    missingDenialId: "DEN-MED-NEC",
  },
  {
    code: "D2751",
    type: "radiograph",
    when: "always",
    label: "Pre-operative radiograph",
    whyRequired: "Confirms the tooth is present and restorable.",
    missingDenialId: "DEN-DOC-MISSING",
  },
  {
    code: "D2751",
    type: "narrative",
    when: "always",
    label: "Narrative describing the reason for the crown",
    whyRequired: "Justifies the full-coverage restoration.",
    missingDenialId: "DEN-MED-NEC",
  },
  {
    code: "D2790",
    type: "radiograph",
    when: "always",
    label: "Pre-operative radiograph",
    whyRequired: "Confirms the tooth and the need for a crown.",
  },
  {
    code: "D2790",
    type: "narrative",
    when: "always",
    label: "Narrative describing the reason for the crown",
    whyRequired: "Justifies the restoration; also flags the precious-metal content for the claim.",
  },
  {
    code: "D2791",
    type: "radiograph",
    when: "always",
    label: "Pre-operative radiograph",
    whyRequired: "Confirms the tooth and the need for a crown.",
  },
  {
    code: "D2792",
    type: "radiograph",
    when: "always",
    label: "Pre-operative radiograph",
    whyRequired: "Confirms the tooth and the need for a crown.",
  },

  // ── Build-ups ────────────────────────────────────────────────────────
  {
    code: "D2950",
    type: "radiograph",
    when: "always",
    label: "Pre-operative radiograph showing the extent of lost structure",
    whyRequired:
      "The whole test for a core build-up is how much tooth was actually missing. The radiograph is the evidence.",
    missingDenialId: "DEN-DOC-MISSING",
  },
  {
    code: "D2950",
    type: "narrative",
    when: "always",
    label: "Narrative stating how much tooth remained",
    whyRequired:
      "If the note does not show the tooth was too broken down to retain a crown on its own, the payer treats the build-up as part of the crown prep and pays nothing extra.",
    missingDenialId: "DEN-BUNDLE-BUILDUP",
  },
  {
    code: "D2954",
    type: "radiograph",
    when: "always",
    label: "Radiograph showing the root-canal-treated root and the post",
    whyRequired: "Confirms the post is in a root-canal-treated root and the build-up is warranted.",
    missingDenialId: "DEN-DOC-MISSING",
  },

  // ── Periodontal surgery ──────────────────────────────────────────────
  {
    code: "D4249",
    type: "radiograph",
    when: "always",
    label: "Pre-operative radiograph",
    whyRequired: "Shows the bone and crown-to-bone relationship the surgery will correct.",
    missingDenialId: "DEN-DOC-MISSING",
  },
  {
    code: "D4249",
    type: "narrative",
    when: "always",
    label: "Narrative describing the amount of sound structure remaining",
    whyRequired: "Justifies that bone actually needed reshaping to expose sound tooth.",
    missingDenialId: "DEN-MED-NEC",
  },
  {
    code: "D4260",
    type: "periodontal-chart",
    when: "always",
    label: "Full-mouth periodontal chart with pocket depths",
    whyRequired: "Documents the disease severity that justifies opening a flap to reshape bone.",
    missingDenialId: "DEN-MED-NEC",
  },
  {
    code: "D4260",
    type: "radiograph",
    when: "always",
    label: "Radiographs showing the bone loss",
    whyRequired: "Corroborates the probing depths with hard-tissue evidence.",
    missingDenialId: "DEN-DOC-MISSING",
  },
  {
    code: "D4260",
    type: "proof-of-prior-treatment",
    when: "always",
    label: "Record of completed non-surgical therapy (scaling and root planing)",
    whyRequired:
      "Payers want proof the conservative treatment was done first and did not resolve the pockets before they will pay for surgery.",
    missingDenialId: "DEN-PREAUTH",
  },
  {
    code: "D4263",
    type: "radiograph",
    when: "always",
    label: "Radiograph showing the bone defect",
    whyRequired: "Shows the defect the graft will fill.",
    missingDenialId: "DEN-DOC-MISSING",
  },
  {
    code: "D4263",
    type: "periodontal-chart",
    when: "always",
    label: "Periodontal charting of the site",
    whyRequired: "Corroborates the bone defect with soft-tissue measurements.",
  },

  // ── Scaling and root planing ─────────────────────────────────────────
  {
    code: "D4341",
    type: "periodontal-chart",
    when: "always",
    label: "Periodontal chart with pocket depths per tooth",
    whyRequired:
      "The tooth count is the whole test. The chart must show four or more teeth in that quadrant actually have disease.",
    missingDenialId: "DEN-SRP-TOOTH-COUNT",
  },
  {
    code: "D4341",
    type: "radiograph",
    when: "always",
    label: "Radiographs showing bone loss",
    whyRequired: "Confirms the bone loss that distinguishes root planing from a routine cleaning.",
    missingDenialId: "DEN-MED-NEC",
  },
  {
    code: "D4342",
    type: "periodontal-chart",
    when: "always",
    label: "Periodontal chart identifying the specific teeth treated",
    whyRequired: "Shows only one to three teeth were affected, matching the limited code billed.",
    missingDenialId: "DEN-SRP-TOOTH-COUNT",
  },

  // ── Implants ─────────────────────────────────────────────────────────
  {
    code: "D6010",
    type: "radiograph",
    when: "always",
    label: "Pre-operative radiograph or 3D scan",
    whyRequired: "Shows the site, the bone volume, and why the space needs replacement.",
    missingDenialId: "DEN-DOC-MISSING",
  },
  {
    code: "D6010",
    type: "narrative",
    when: "always",
    label: "Narrative on why the tooth is unrestorable or already missing",
    whyRequired: "Establishes that the implant is a necessary replacement, not an elective upgrade.",
    missingDenialId: "DEN-MED-NEC",
  },
  {
    code: "D6010",
    type: "date-of-tooth-loss",
    when: "always",
    label: "Date the tooth was lost or extracted",
    whyRequired:
      "The missing-tooth clause is tested against this date. A tooth lost before coverage began removes the benefit entirely.",
    missingDenialId: "DEN-MISSING-TOOTH",
  },
  {
    code: "D6058",
    type: "radiograph",
    when: "always",
    label: "Radiograph of the restored implant",
    whyRequired: "Confirms the crown is seated on an implant abutment, not a natural tooth.",
    missingDenialId: "DEN-DOC-MISSING",
  },
  {
    code: "D6058",
    type: "date-of-tooth-loss",
    when: "conditional",
    label: "Date the tooth was lost or extracted",
    condition: "When the missing-tooth clause is part of the plan.",
    whyRequired: "The implant crown is the replacement; the clause applies to it too, not just the fixture.",
    missingDenialId: "DEN-MISSING-TOOTH",
  },

  // ── Bridges ──────────────────────────────────────────────────────────
  {
    code: "D6240",
    type: "radiograph",
    when: "always",
    label: "Radiograph of the abutment teeth",
    whyRequired: "Shows the anchor teeth can carry the bridge.",
    missingDenialId: "DEN-DOC-MISSING",
  },
  {
    code: "D6240",
    type: "date-of-tooth-loss",
    when: "always",
    label: "Date the replaced tooth was lost",
    whyRequired: "The missing-tooth clause is tested against the pontic space.",
    missingDenialId: "DEN-MISSING-TOOTH",
  },
  {
    code: "D6245",
    type: "radiograph",
    when: "always",
    label: "Radiograph of the abutment teeth",
    whyRequired: "Shows the anchor teeth can carry the bridge.",
  },
  {
    code: "D6245",
    type: "date-of-tooth-loss",
    when: "always",
    label: "Date the replaced tooth was lost",
    whyRequired: "The missing-tooth clause is tested against the pontic space.",
    missingDenialId: "DEN-MISSING-TOOTH",
  },
  {
    code: "D6750",
    type: "radiograph",
    when: "always",
    label: "Pre-operative radiograph of the retainer tooth",
    whyRequired: "Confirms the anchor tooth is present and restorable.",
    missingDenialId: "DEN-DOC-MISSING",
  },

  // ── Removable prosthodontics ─────────────────────────────────────────
  {
    code: "D5211",
    type: "narrative",
    when: "always",
    label: "Narrative listing every tooth being replaced",
    whyRequired:
      "Missing-tooth clauses are applied tooth by tooth, so the payer needs the list to decide what is covered.",
  },
  {
    code: "D5211",
    type: "date-of-tooth-loss",
    when: "always",
    label: "Date each replaced tooth was lost",
    whyRequired: "Determines which teeth, if any, are subject to the missing-tooth clause.",
    missingDenialId: "DEN-MISSING-TOOTH",
  },
  {
    code: "D5213",
    type: "narrative",
    when: "always",
    label: "Narrative listing every tooth being replaced",
    whyRequired: "Missing-tooth clauses apply tooth by tooth, so the list drives the estimate.",
  },
  {
    code: "D5213",
    type: "date-of-tooth-loss",
    when: "always",
    label: "Date each replaced tooth was lost",
    whyRequired: "Determines which teeth are subject to the missing-tooth clause.",
    missingDenialId: "DEN-MISSING-TOOTH",
  },
  {
    code: "D5214",
    type: "narrative",
    when: "always",
    label: "Narrative listing every tooth being replaced",
    whyRequired: "Missing-tooth clauses apply tooth by tooth.",
  },
  {
    code: "D5214",
    type: "date-of-tooth-loss",
    when: "always",
    label: "Date each replaced tooth was lost",
    whyRequired: "Determines which teeth are subject to the missing-tooth clause.",
    missingDenialId: "DEN-MISSING-TOOTH",
  },
  {
    code: "D5110",
    type: "date-of-tooth-loss",
    when: "conditional",
    label: "Date the remaining teeth were extracted",
    condition: "When the patient became edentulous — relevant to the missing-tooth clause.",
    whyRequired: "If the teeth were already missing before coverage began, the denture may not be a covered benefit.",
    missingDenialId: "DEN-MISSING-TOOTH",
  },
  {
    code: "D5120",
    type: "date-of-tooth-loss",
    when: "conditional",
    label: "Date the remaining teeth were extracted",
    condition: "When the patient became edentulous — relevant to the missing-tooth clause.",
    whyRequired: "If the teeth were already missing before coverage began, the denture may not be a covered benefit.",
    missingDenialId: "DEN-MISSING-TOOTH",
  },
];

/** Requirements grouped by code, for direct lookup. */
export const ATTACHMENT_REQUIREMENTS_BY_CODE: Record<string, AttachmentRequirement[]> =
  ATTACHMENT_REQUIREMENTS.reduce<Record<string, AttachmentRequirement[]>>((acc, req) => {
    (acc[req.code] ||= []).push(req);
    return acc;
  }, {});

/* ======================================================================= */
/* Predetermination candidates.                                             */
/* ======================================================================= */

export const PREDETERMINATION_CANDIDATES: PredeterminationCandidate[] = [
  { code: "D2740", driver: "high-fee", guidance: "Predetermine — especially on posterior teeth where the ceramic-to-metal downgrade applies." },
  { code: "D2750", driver: "high-fee", guidance: "Predetermine when the metal-upgrade balance matters to the patient's out-of-pocket quote." },
  { code: "D2751", driver: "high-fee", guidance: "Lowest downgrade risk of the crowns; a clean estimate, but still high-fee." },
  { code: "D2790", driver: "high-fee", guidance: "Predetermine — precious-metal content makes this the costliest cast crown." },
  { code: "D2791", driver: "high-fee", guidance: "The downgrade benchmark; least likely to surprise, but confirm the frequency history." },
  { code: "D2792", driver: "high-fee", guidance: "Predetermine for the metal allowance and any frequency questions." },
  { code: "D2950", driver: "high-fee", guidance: "Predetermine — the most-audited restorative code; attach the radiograph and narrative up front." },
  { code: "D2954", driver: "high-fee", guidance: "Predetermine to establish the post is in a root-canal-treated root." },
  { code: "D4249", driver: "surgical", guidance: "Predetermine — documentation must show bone was actually reshaped." },
  { code: "D4260", driver: "surgical", guidance: "Always predetermine; expect to show perio charting and prior non-surgical therapy." },
  { code: "D4263", driver: "surgical", guidance: "Predetermine with the defect radiograph and charting." },
  { code: "D4341", driver: "frequency-sensitive", guidance: "Predetermine when SRP history is unclear — the frequency is one per 24 months." },
  { code: "D4342", driver: "frequency-sensitive", guidance: "Predetermine when the SRP frequency could have been used recently." },
  { code: "D6010", driver: "surgical", guidance: "Always predetermine — implants are often excluded or limited to a conventional alternative, and the missing-tooth clause applies." },
  { code: "D6058", driver: "high-fee", guidance: "Predetermine with the implant; the crown is part of the same replacement decision." },
  { code: "D6240", driver: "high-fee", guidance: "Predetermine — bridges are billed unit-by-unit and hit the missing-tooth and prosthetic-frequency rules." },
  { code: "D6245", driver: "high-fee", guidance: "Predetermine — the all-ceramic pontic carries an alternate-benefit risk on posterior teeth." },
  { code: "D6750", driver: "high-fee", guidance: "Predetermine as part of the bridge plan." },
  { code: "D5211", driver: "removable-appliance", guidance: "Predetermine with the full list of teeth being replaced." },
  { code: "D5213", driver: "removable-appliance", guidance: "Predetermine — list every tooth so the missing-tooth clause is applied correctly." },
  { code: "D5214", driver: "removable-appliance", guidance: "Predetermine with the full tooth list." },
  { code: "D5110", driver: "removable-appliance", guidance: "Predetermine when the patient was recently edentulous — check the missing-tooth clause." },
  { code: "D5120", driver: "removable-appliance", guidance: "Predetermine when the patient was recently edentulous — check the missing-tooth clause." },
];

export const PREDETERMINATION_CANDIDATE_INDEX: Record<string, PredeterminationCandidate> =
  Object.fromEntries(PREDETERMINATION_CANDIDATES.map((c) => [c.code, c]));

export function attachmentsForCode(code: string): AttachmentRequirement[] {
  return ATTACHMENT_REQUIREMENTS_BY_CODE[code] ?? [];
}

export function attachmentTypesFor(code: string): AttachmentType[] {
  return attachmentsForCode(code).map((r) => r.type);
}

export function isPredeterminationCandidate(code: string): boolean {
  return code in PREDETERMINATION_CANDIDATE_INDEX;
}

export function predeterminationDriverFor(code: string): PredeterminationDriver | undefined {
  return PREDETERMINATION_CANDIDATE_INDEX[code]?.driver;
}
