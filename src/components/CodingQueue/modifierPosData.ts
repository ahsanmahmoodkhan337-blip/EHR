/**
 * Modifier & Place-of-Service Reference — Medical Coding Educational Content
 *
 * Reference data for the Medical Coder stage. The modifier input is free text (a
 * student may type any valid value); the place-of-service input is a picker built
 * from `POS_REFERENCE` below, so every POS a student can bill at — including the
 * institutional 21/22/23 that select the UB-04 — is reachable at Coding.
 *
 * Sources merged here:
 *  - modifiers already taught in the simulator: 25, 59, 27, 50, 51, 52, 76
 *  - modifiers from the owner's code sheet (Sep 2026): 24, 78, 79, 93, 95, QW, TC, 26
 *  - POS codes already used by the billing ledger: 12, 24, 31, 41, 50, 71, 81, 99
 *  - POS codes from the owner's code sheet (Sep 2026): 10, 11, 20, 21, 22, 23
 *
 * Descriptions are written in plain teaching language, not official CPT/AMA
 * appendix wording.
 */

export interface ModifierReferenceEntry {
  code: string;
  description: string;
  teachingNote: string;
}

export interface PosReferenceEntry {
  code: string;
  description: string;
  teachingNote: string;
}

export const MODIFIER_REFERENCE: ModifierReferenceEntry[] = [
  // ─── E/M and procedure interactions ────────────────────────────────
  {
    code: "25",
    description: "Separately identifiable evaluation and management service by the same clinician on the same day as a procedure or other service",
    teachingNote: "The most-tested modifier in RCM. It tells the payer the E/M was real clinical work, not the pre-op and post-op time already inside the procedure. Needs its own documentation — a separate history, exam and decision.",
  },
  {
    code: "24",
    description: "Unrelated evaluation and management service by the same clinician during a postoperative global period",
    teachingNote: "Use when a patient comes back during the global period for a different problem. Without it the E/M is denied as part of the surgery package. The note must show the new problem is unrelated to the operation.",
  },
  {
    code: "27",
    description: "Two or more outpatient hospital encounters by the same clinician on the same date",
    teachingNote: "Only for hospital outpatient settings where the patient is seen in separate encounters (clinic then infusion, say). Do not use it for two visits in a private office.",
  },

  // ─── Procedure modifiers ───────────────────────────────────────────
  {
    code: "50",
    description: "Bilateral procedure — the same procedure performed on both sides in one session",
    teachingNote: "Reported once with one unit and modifier 50; the payer applies its bilateral rule (often 150% of the single fee). Do not bill two lines or add laterality codes instead.",
  },
  {
    code: "51",
    description: "Multiple procedures performed by the same clinician at the same session",
    teachingNote: "Additional lines take a multiple-procedure reduction — often 50% of the allowed amount on the second and later procedures. Many payers now apply this automatically, so 51 is often optional.",
  },
  {
    code: "52",
    description: "Reduced services — the procedure was partially performed or a component was not carried out",
    teachingNote: "Honest down-coding. Use it when the surgeon stopped short, or a piece of the service was not needed. It pays less than the full code, but billing the full code invites an audit take-back.",
  },
  {
    code: "59",
    description: "Distinct procedural service — a procedure not normally reported with another one on the same claim",
    teachingNote: "The bundling override. It must be justified by the note: different site, different session, separate incision or separate lesion. Payers are strict about 59 and prefer the more specific X{EPSU} modifiers where they exist.",
  },
  {
    code: "76",
    description: "Repeat procedure by the same clinician for the same patient",
    teachingNote: "Same procedure, same clinician, repeated later (a second X-ray after a tube moved, for example). If a different clinician repeats it, that is modifier 77 instead.",
  },
  {
    code: "78",
    description: "Return to the operating room for a related procedure during the postoperative global period",
    teachingNote: "The second trip is related to the first operation, so the payer pays only the intra-operative portion. Use modifier 79 instead when the second procedure is unrelated.",
  },
  {
    code: "79",
    description: "Unrelated procedure or service by the same clinician during the postoperative global period",
    teachingNote: "Unrelated surgery during a global period is paid in full with this modifier. Related-but-different is 78; unrelated is 79 — mixing them up is a common denial.",
  },

  // ─── Telehealth ────────────────────────────────────────────────────
  {
    code: "93",
    description: "Synchronous telehealth service delivered by audio only",
    teachingNote: "Telephone-style visit with no video. Pays less than video visits and not every payer covers it. The patient's consent and the audio-only nature must be documented.",
  },
  {
    code: "95",
    description: "Synchronous telemedicine service delivered by real-time audio and video, patient away from the clinician",
    teachingNote: "The standard video-visit modifier. The patient's location becomes the place of service (often POS 10 at home or 02 elsewhere) — a mismatch between modifier 95 and the POS is a classic telehealth denial.",
  },

  // ─── Component and laboratory modifiers ────────────────────────────
  {
    code: "26",
    description: "Professional component only — the clinician's interpretation and written report",
    teachingNote: "The read without the equipment. Pair it with TC for the other half of the same global service; billing both plus the global code is double billing. The report must exist to support it.",
  },
  {
    code: "TC",
    description: "Technical component only — equipment, supplies, technician and the overhead of performing the test",
    teachingNote: "The hospital or imaging centre side of the same study that modifier 26 pays the radiologist for. Global fee = 26 share + TC share.",
  },
  {
    code: "QW",
    description: "CLIA-waived laboratory test",
    teachingNote: "HCPCS Level II modifier for tests performed under a CLIA certificate of waiver (rapid strep, urine dipstick in a clinic). Without QW the lab claim is rejected as an unqualified laboratory.",
  },
];

export const POS_REFERENCE: PosReferenceEntry[] = [
  {
    code: "10",
    description: "Telehealth provided in the patient's home",
    teachingNote: "The modern home-telehealth place of service. Use it with modifier 95 (or 93 for audio-only) and make sure the payer accepts the code — some still want the old POS 11 plus 95.",
  },
  {
    code: "11",
    description: "Office — a clinician's private or group practice setting",
    teachingNote: "The default POS for outpatient E/M, and the one most claims in this simulator use. Non-facility payment applies, which is higher than the hospital rate.",
  },
  {
    code: "12",
    description: "Home — the patient's own residence",
    teachingNote: "For home visits and home-based care. Home health and hospice claims also use it. Payment is at the non-facility rate.",
  },
  {
    code: "20",
    description: "Urgent care facility",
    teachingNote: "Walk-in urgent care. Facility rates apply; an urgent care owned by a hospital is billed under POS 22 instead.",
  },
  {
    code: "21",
    description: "Inpatient hospital",
    teachingNote: "Admitted patients. The professional claim uses 21 while the hospital bills the stay on its own facility claim — one visit, two claims.",
  },
  {
    code: "22",
    description: "Outpatient hospital — hospital-based clinic or outpatient department",
    teachingNote: "Hospital outpatient department. The clinician bills the professional fee at the facility rate and the hospital bills a separate facility fee. Using 11 here under-pays and is a compliance risk.",
  },
  {
    code: "23",
    description: "Emergency room — hospital",
    teachingNote: "ED services. Level selection follows ED criteria, and the facility fee is billed by the hospital separately.",
  },
  {
    code: "24",
    description: "Ambulatory surgical centre",
    teachingNote: "Free-standing surgery centre. The surgeon's fee is billed with 24; the centre bills its own facility claim. Do not use it for a hospital outpatient procedure (that is 22).",
  },
  {
    code: "31",
    description: "Skilled nursing facility",
    teachingNote: "Nursing-home patients seen by an outside clinician. The SNF bundles most routine visits into its per-day rate, so check what the clinician may bill separately.",
  },
  {
    code: "41",
    description: "Ambulance — land transport",
    teachingNote: "Ground ambulance transport. Needs origin-and-destination and medical-necessity documentation; the mileage is a separate line.",
  },
  {
    code: "50",
    description: "Federally qualified health centre",
    teachingNote: "FQHCs are paid under a special prospective rate rather than standard fee-for-service, so the POS changes the payment method, not just the address.",
  },
  {
    code: "71",
    description: "Public health clinic — state or local government clinic",
    teachingNote: "Public health departments and similar government clinics. Distinct from a private office (11) and from an FQHC (50).",
  },
  {
    code: "81",
    description: "Independent laboratory",
    teachingNote: "A stand-alone lab, not a hospital lab. Where the specimen was actually run decides this — billing a send-out test at the clinic's POS is a common error.",
  },
  {
    code: "99",
    description: "Other place of service",
    teachingNote: "Only when nothing else fits, and the note should explain where the service happened. Payers flag 99 for review because it carries no payment logic of its own.",
  },
];
