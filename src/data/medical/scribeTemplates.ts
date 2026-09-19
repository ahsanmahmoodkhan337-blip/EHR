/**
 * Scribe Smart-Phrase & Note-Template Library — Medical Data Layer
 *
 * The structured, UI-consumable half of "make scribing more efficient /
 * practical": a dot-phrase (smart-phrase) library and a set of chief-complaint
 * SOAP skeletons, both authored as typed TypeScript data so the frontend can
 * build the scribe-assist UI against a fixed contract instead of guessing.
 *
 * Two parts:
 *   1. `DOT_PHRASES` — shortcode → expansion text, categorised by note section
 *      (HPI, ROS, PE, A&P, Plan). Includes the canonical teaching mnemonics
 *      (OLD CARTS / SOCRATES for HPI), a normal full ROS block, normal adult
 *      exam templates, and common plan sentences.
 *   2. `CHIEF_COMPLAINT_TEMPLATES` — one SOAP skeleton per medical case's chief
 *      complaint, with HPI prompt fields, default ROS / exam, and A&P diagnosis
 *      fields whose ICD-10 codes reuse the existing `icd10Data.ts` teaching
 *      subset (so every reference resolves).
 *
 * COPYRIGHT NOTE — READ BEFORE EDITING
 * Nothing here reproduces any EHR vendor's smart-phrase library, template
 * catalog, or note text. Every expansion and template is original teaching
 * text authored for this simulator. ICD-10 and CPT code *identifiers* are used
 * as references only; the descriptive labels are original paraphrases, not the
 * official nomenclature (which is WHO / AMA copyright respectively).
 *
 * ACCURACY NOTE
 * Clinical content is written at a teaching level: it illustrates note
 * structure, not a specific practice's clinical standard of care. Where a
 * phrase implies a dosage, interval, or threshold, treat it as an example to
 * be adapted, not as a clinical recommendation.
 */

export type NoteSection = "HPI" | "ROS" | "PE" | "A&P" | "Plan";

export interface DotPhrase {
  /** The trigger the scribe types, including the leading dot (e.g. ".oldcarts"). */
  shortcode: string;
  section: NoteSection;
  /** Short human-readable name for the phrase picker UI. */
  label: string;
  /** The text the shortcode expands to. */
  expansion: string;
  /** Optional one-line note on when to use it. */
  teachingNote?: string;
}

export interface TemplateDiagnosisField {
  /** ICD-10 code that resolves to `ICD10_CODES` in `icd10Data.ts`. */
  code: string;
  /** Original plain-language label for the diagnosis. */
  label: string;
  /** What the scribe fills in to support the diagnosis. */
  prompt: string;
}

export interface ChiefComplaintTemplate {
  id: string;
  /** The medical case this template maps to (`MCASE-00X`). */
  caseId: string;
  title: string;
  chiefComplaint: string;
  /** The dot-phrase shortcodes this template leans on, if any. */
  usesShortcodes: string[];
  subjective: {
    /** Tailored questions the scribe answers to build the HPI. */
    hpiPrompt: string[];
    /** Default review-of-systems block for this complaint. */
    ros: string;
  };
  objective: {
    /** The vitals/measurements the scribe should capture. */
    vitalsPrompt: string[];
    /** Default physical-exam block for this complaint. */
    exam: string;
  };
  assessment: TemplateDiagnosisField[];
  plan: string[];
  teachingNote: string;
}

/* ======================================================================= */
/* Part 1 — dot-phrase / smart-phrase library                              */
/* ======================================================================= */

export const DOT_PHRASES: DotPhrase[] = [
  {
    shortcode: ".oldcarts",
    section: "HPI",
    label: "OLD CARTS history",
    expansion:
      "Onset — when did it start, and was it sudden or gradual?\nLocation — where exactly is it?\nDuration — how long has it gone on, and is it constant or intermittent?\nCharacter — sharp, dull, aching, burning, pressure?\nAggravating / alleviating — what makes it better or worse?\nRadiation — does it travel anywhere?\nTiming — any time-of-day pattern?\nSeverity — rate it 0–10 and describe the impact on daily life.",
    teachingNote: "A complete HPI for a pain or symptom complaint. Fills every letter of the mnemonic.",
  },
  {
    shortcode: ".socrates",
    section: "HPI",
    label: "SOCRATES history",
    expansion:
      "Site — where is it?\nOnset — when did it begin, sudden or gradual?\nCharacter — sharp, dull, throbbing, burning?\nRadiation — does it move anywhere?\nAssociated symptoms — anything else with it?\nTiming — constant or intermittent, and any pattern?\nExacerbating / relieving — what helps or worsens it?\nSeverity — 0–10 and impact on function.",
    teachingNote: "The same HPI skeleton as OLD CARTS with different wording; pick whichever the student prefers.",
  },
  {
    shortcode: ".hpi",
    section: "HPI",
    label: "Quick HPI fill-in",
    expansion:
      "Patient presents for [chief complaint]. Onset [__]; location [__]; duration [__]; character [__]; aggravating / alleviating [__]; radiation [__]; severity [__]/10.",
    teachingNote: "A compact one-liner for low-complexity visits where a full mnemonic is overkill.",
  },
  {
    shortcode: ".rosfull",
    section: "ROS",
    label: "Normal full review of systems",
    expansion:
      "Constitutional: denies fevers, chills, or unintended weight change.\nEyes: no vision change or discharge.\nENT: no sore throat, congestion, or hearing loss.\nCardiovascular: no chest pain, palpitations, or leg swelling.\nRespiratory: no cough, shortness of breath, or wheeze.\nGastrointestinal: no nausea, vomiting, or change in bowels.\nGenitourinary: no painful or frequent urination.\nMusculoskeletal: no joint pain or stiffness.\nIntegumentary: no rash or lesions.\nNeurological: no weakness, numbness, or dizziness.\nPsychiatric: no mood or sleep disturbance.\nEndocrine: no heat or cold intolerance.\nHematologic: no easy bruising or bleeding.\nAllergic: no known drug allergies.",
    teachingNote: "A 14-system negative ROS. The scribe trims it to the systems relevant to the visit.",
  },
  {
    shortcode: ".ros10",
    section: "ROS",
    label: "10-point negative ROS",
    expansion:
      "Constitutional, eyes, ENT, cardiovascular, respiratory, gastrointestinal, genitourinary, musculoskeletal, neurological, and psychiatric systems reviewed and otherwise negative.",
    teachingNote: "A shorthand ROS that documents coverage without listing every system.",
  },
  {
    shortcode: ".peadult",
    section: "PE",
    label: "Normal adult exam",
    expansion:
      "General: alert, no acute distress.\nHead / ENT: normocephalic; tympanic membranes clear; oropharynx clear.\nNeck: supple, no lymphadenopathy.\nCardiovascular: regular rhythm, no murmur.\nRespiratory: clear to auscultation bilaterally.\nAbdomen: soft, non-tender, non-distended.\nMusculoskeletal: normal range of motion, no edema.\nNeurological: alert and oriented, cranial nerves grossly intact.\nSkin: warm, dry, no rash.",
    teachingNote: "A normal adult exam block. The scribe edits the system of interest to reflect the actual findings.",
  },
  {
    shortcode: ".penormal",
    section: "PE",
    label: "Concise normal exam",
    expansion:
      "General exam normal: no acute distress, regular heart rhythm, clear lungs, soft non-tender abdomen, no edema, no focal neurological deficit.",
    teachingNote: "A shorter normal-exam sentence for straightforward follow-ups.",
  },
  {
    shortcode: ".aap",
    section: "A&P",
    label: "Assessment & plan skeleton",
    expansion:
      "Assessment:\n1. [Diagnosis] — [brief statement tying it to today's visit]\n\nPlan:\n1. [Action]\n2. [Action]\n3. [Return / follow-up]",
    teachingNote: "The problem-list backbone of a note. Each assessment line should carry a supporting diagnosis.",
  },
  {
    shortcode: ".planhtn",
    section: "Plan",
    label: "Hypertension plan",
    expansion:
      "Continue current antihypertensive. Recheck blood pressure in [__] weeks. Counsel on low-sodium diet and regular activity.",
    teachingNote: "A common chronic-disease plan sentence for a stable blood-pressure follow-up.",
  },
  {
    shortcode: ".plandm",
    section: "Plan",
    label: "Diabetes plan",
    expansion:
      "Continue current regimen. Order HbA1c and basic metabolic panel. Review home glucose log at next visit.",
    teachingNote: "Routine diabetes monitoring plan; the student adjusts medication based on the assessment.",
  },
  {
    shortcode: ".planlabs",
    section: "Plan",
    label: "Order labs sentence",
    expansion:
      "Order [labs] and review results at follow-up.",
    teachingNote: "A reusable sentence for hanging a lab order onto any plan.",
  },
  {
    shortcode: ".planfup",
    section: "Plan",
    label: "Return-to-clinic sentence",
    expansion:
      "Return to clinic in [__] weeks, or sooner if symptoms worsen.",
    teachingNote: "Closes the plan and documents the follow-up interval.",
  },
  {
    shortcode: ".refill",
    section: "Plan",
    label: "Medication refill sentence",
    expansion:
      "Refill [medication] [dose] [frequency] for [__] days, [__] refills.",
    teachingNote: "A structured refill line so dose, frequency, and quantity are never left blank.",
  },
];

export const DOT_PHRASE_INDEX: Record<string, DotPhrase> = Object.fromEntries(
  DOT_PHRASES.map((p) => [p.shortcode, p]),
);

export function findDotPhrase(shortcode: string): DotPhrase | undefined {
  return DOT_PHRASE_INDEX[shortcode];
}

export function dotPhrasesBySection(section: NoteSection): DotPhrase[] {
  return DOT_PHRASES.filter((p) => p.section === section);
}

/* ======================================================================= */
/* Part 2 — chief-complaint note templates (SOAP skeletons)                */
/* ======================================================================= */

const TPL_HTN_FOLLOWUP: ChiefComplaintTemplate = {
  id: "TPL-HTN",
  caseId: "MCASE-001",
  title: "Hypertension follow-up",
  chiefComplaint: "Three-month follow-up for high blood pressure. No new complaints.",
  usesShortcodes: [".socrates", ".ros10", ".penormal", ".planhtn", ".planfup"],
  subjective: {
    hpiPrompt: [
      "Any symptoms since the last visit (headache, chest pain, dizziness)?",
      "Home blood-pressure readings and their trend over the past month.",
      "Medication adherence — any missed doses or side effects?",
      "Dietary salt intake and current activity level.",
    ],
    ros: "Constitutional, cardiovascular, neurological, and psychiatric systems reviewed and otherwise negative. No chest pain, palpitations, headache, or dizziness.",
  },
  objective: {
    vitalsPrompt: ["Blood pressure (sitting, both arms if a difference is suspected)", "Heart rate", "Weight"],
    exam: "General: alert, no acute distress. Cardiovascular: regular rhythm, no murmur. Respiratory: clear. Neurological: grossly intact.",
  },
  assessment: [
    {
      code: "I10",
      label: "Primary high blood pressure",
      prompt: "Document the diagnosis and whether it is controlled on the current regimen.",
    },
  ],
  plan: [
    "Continue current antihypertensive at the same dose.",
    "Recheck blood pressure in 12 weeks.",
    "Counsel on low-sodium diet and regular activity.",
  ],
  teachingNote: "A stable chronic-disease follow-up. The E/M level hangs on the re-evaluation and plan, not on new complaints.",
};

const TPL_ANNUAL_PHYSICAL: ChiefComplaintTemplate = {
  id: "TPL-PHYSICAL",
  caseId: "MCASE-002",
  title: "Annual physical (preventive)",
  chiefComplaint: "Annual physical. No acute concerns.",
  usesShortcodes: [".rosfull", ".peadult", ".aap", ".planlabs"],
  subjective: {
    hpiPrompt: [
      "Any new symptoms or changes since the last preventive visit?",
      "Update of chronic conditions and current medications.",
      "Age-appropriate screening history (cancer, cardiovascular).",
    ],
    ros: "Full 14-system review performed and negative except as noted. No acute symptoms.",
  },
  objective: {
    vitalsPrompt: ["Blood pressure", "Heart rate", "Height and weight / BMI"],
    exam: "General: well-appearing. HEENT: clear. Neck: supple. Cardiovascular: regular. Respiratory: clear. Abdomen: soft, non-tender. Skin: no suspicious lesions. Neurological: grossly intact.",
  },
  assessment: [
    {
      code: "Z00.00",
      label: "General adult exam without abnormal findings",
      prompt: "Document the preventive visit and note whether any findings need separate problem evaluation.",
    },
    {
      code: "Z12.31",
      label: "Screening mammogram (breast cancer)",
      prompt: "Record that age-appropriate screening was ordered and discussed.",
    },
  ],
  plan: [
    "Order routine screening laboratory studies.",
    "Order screening mammogram.",
    "Counsel on preventive health and schedule return in one year.",
  ],
  teachingNote: "Preventive services bill separately from any problem-based E/M. If an acute problem is also addressed, it may need its own code and modifier.",
};

const TPL_DIABETES_CKD: ChiefComplaintTemplate = {
  id: "TPL-DM-CKD",
  caseId: "MCASE-003",
  title: "Diabetes with chronic kidney disease",
  chiefComplaint: "Increasing fatigue; follow-up of diabetes and kidney disease.",
  usesShortcodes: [".socrates", ".ros10", ".plandm", ".planlabs", ".planfup"],
  subjective: {
    hpiPrompt: [
      "Duration and progression of the fatigue.",
      "Blood-glucose control and recent HbA1c trend.",
      "Any swelling, shortness of breath, or change in urine output.",
      "Current medications and adherence.",
    ],
    ros: "Constitutional, endocrine, cardiovascular, and renal systems reviewed. No chest pain or shortness of breath; no leg swelling.",
  },
  objective: {
    vitalsPrompt: ["Blood pressure", "Weight", "Point-of-care glucose"],
    exam: "General: fatigued but in no distress. Cardiovascular: regular. Abdomen: soft, non-tender. Extremities: no edema. Skin: no rash.",
  },
  assessment: [
    {
      code: "E11.22",
      label: "Type 2 diabetes with diabetic kidney disease",
      prompt: "Use the combined code that captures both the diabetes and its kidney complication.",
    },
    {
      code: "N18.3",
      label: "Chronic kidney disease, stage 3",
      prompt: "Add the stage that documents the severity and supports the higher-level visit.",
    },
  ],
  plan: [
    "Order HbA1c and basic metabolic panel.",
    "Review glucose log and adjust regimen as indicated.",
    "Refer to nephrology for the kidney disease.",
  ],
  teachingNote: "Diabetes with a manifestation is coded with the combined code first, then the manifestation's stage. Sequencing matters for medical-necessity review.",
};

const TPL_KNEE_INJECTION: ChiefComplaintTemplate = {
  id: "TPL-KNEE",
  caseId: "MCASE-004",
  title: "Knee pain injection + new ankle swelling",
  chiefComplaint: "Knee pain for a scheduled injection; new foot swelling noticed this week.",
  usesShortcodes: [".oldcarts", ".aap"],
  subjective: {
    hpiPrompt: [
      "Knee pain — laterality, duration, and response to prior treatment.",
      "The new ankle swelling — onset, duration, and any injury.",
      "Any redness, warmth, or fever.",
    ],
    ros: "Musculoskeletal and constitutional systems reviewed. No fevers or chills.",
  },
  objective: {
    vitalsPrompt: ["Blood pressure", "Heart rate", "Temperature"],
    exam: "Knee: tenderness over the medial joint line, limited range of motion. Ankle: mild swelling without redness. Remainder of exam normal.",
  },
  assessment: [
    {
      code: "M17.0",
      label: "Knee osteoarthritis affecting both knees",
      prompt: "Document the arthritis that justifies today's joint injection.",
    },
    {
      code: "M25.572",
      label: "Pain and swelling of the left ankle",
      prompt: "Record the separately evaluated problem that supports a distinct E/M service.",
    },
  ],
  plan: [
    "Perform the scheduled knee injection.",
    "Separately evaluate the new ankle swelling (this is the Modifier 25 service).",
    "Advise ice, elevation, and return if swelling worsens.",
  ],
  teachingNote: "A planned procedure plus a separately identifiable E/M for a different problem is the canonical Modifier 25 scenario. The two diagnoses must each be linked to the right line.",
};

const TPL_LBP_RADICULOPATHY: ChiefComplaintTemplate = {
  id: "TPL-LBP-RADIC",
  caseId: "MCASE-005",
  title: "Low back pain with radiculopathy (MRI)",
  chiefComplaint: "Low back pain radiating into the right leg for six weeks.",
  usesShortcodes: [".oldcarts", ".ros10", ".aap"],
  subjective: {
    hpiPrompt: [
      "Onset and duration of the back pain.",
      "Radiation pattern — does it follow a nerve root into the leg?",
      "Any numbness, weakness, or bowel/bladder change (red flags).",
      "What conservative measures have already been tried.",
    ],
    ros: "Musculoskeletal and neurological systems reviewed. No bowel or bladder dysfunction.",
  },
  objective: {
    vitalsPrompt: ["Blood pressure", "Heart rate"],
    exam: "Back: tenderness over the lumbar spine. Neurological: diminished sensation along the right leg in a nerve-root distribution. Strength intact.",
  },
  assessment: [
    {
      code: "M51.16",
      label: "Lumbar disc problem with nerve-root irritation",
      prompt: "Document the disc disorder with radiculopathy that indicates advanced imaging.",
    },
  ],
  plan: [
    "Order MRI of the lumbar spine (prior authorization required).",
    "Continue conservative care pending imaging.",
    "Return to review imaging results.",
  ],
  teachingNote: "Advanced imaging for radiculopathy commonly requires prior authorization; the diagnosis must support medical necessity. This is the conditional prior-auth path.",
};

const TPL_SKIN_LESION: ChiefComplaintTemplate = {
  id: "TPL-SKIN",
  caseId: "MCASE-006",
  title: "Skin lesion (actinic keratosis)",
  chiefComplaint: "A rough spot on the forearm that will not heal.",
  usesShortcodes: [".oldcarts", ".ros10", ".planfup"],
  subjective: {
    hpiPrompt: [
      "Onset and change in the spot over time.",
      "Any bleeding, itching, or pain.",
      "Sun exposure history.",
    ],
    ros: "Constitutional and integumentary systems reviewed. No fevers or weight loss.",
  },
  objective: {
    vitalsPrompt: ["Blood pressure", "Heart rate"],
    exam: "Skin: a rough, scaly patch on the forearm, no surrounding erythema. No other concerning lesions.",
  },
  assessment: [
    {
      code: "L57.0",
      label: "Sun-damaged skin change (actinic keratosis)",
      prompt: "Document the sun-related skin change being treated.",
    },
  ],
  plan: [
    "Destroy the lesion today.",
    "Counsel on sun protection and skin surveillance.",
    "Return if the spot recurs or changes.",
  ],
  teachingNote: "Destruction of a lesion links its CPT line to the lesion diagnosis. The number and location of lesions set the units for the destruction code.",
};

const TPL_LBP_THERAPY: ChiefComplaintTemplate = {
  id: "TPL-LBP-THERAPY",
  caseId: "MCASE-007",
  title: "Low back pain — established therapy plan",
  chiefComplaint: "Ongoing low back pain; continuing the established therapy plan.",
  usesShortcodes: [".socrates", ".ros10", ".planfup"],
  subjective: {
    hpiPrompt: [
      "Current pain level and function since the last therapy visit.",
      "Progress toward the therapy goals.",
      "Any new symptoms or setbacks.",
    ],
    ros: "Musculoskeletal and neurological systems reviewed. No new weakness or numbness.",
  },
  objective: {
    vitalsPrompt: ["Blood pressure", "Heart rate"],
    exam: "Back: tenderness over the lumbar paraspinal muscles. Neurological: strength and sensation intact.",
  },
  assessment: [
    {
      code: "M54.5",
      label: "Low back pain",
      prompt: "Document the ongoing back pain that the therapy addresses.",
    },
  ],
  plan: [
    "Continue the established therapeutic-exercise plan.",
    "Reassess functional goals at the next visit.",
    "Return in one week.",
  ],
  teachingNote: "Rehabilitation services hit benefit caps. The plan must document medical necessity, and the office should track remaining visits so the patient is not surprised by a benefit-exhausted denial.",
};

export const CHIEF_COMPLAINT_TEMPLATES: ChiefComplaintTemplate[] = [
  TPL_HTN_FOLLOWUP,
  TPL_ANNUAL_PHYSICAL,
  TPL_DIABETES_CKD,
  TPL_KNEE_INJECTION,
  TPL_LBP_RADICULOPATHY,
  TPL_SKIN_LESION,
  TPL_LBP_THERAPY,
];

export const CHIEF_COMPLAINT_TEMPLATE_INDEX: Record<string, ChiefComplaintTemplate> =
  Object.fromEntries(CHIEF_COMPLAINT_TEMPLATES.map((t) => [t.id, t]));

export function findChiefComplaintTemplate(id: string): ChiefComplaintTemplate | undefined {
  return CHIEF_COMPLAINT_TEMPLATE_INDEX[id];
}

export function templateForCase(caseId: string): ChiefComplaintTemplate | undefined {
  return CHIEF_COMPLAINT_TEMPLATES.find((t) => t.caseId === caseId);
}
