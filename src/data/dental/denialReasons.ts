/**
 * Dental Denial Reasons — Educational Content for the Billing and AR Stages
 *
 * Each entry pairs the denial a student will see on a dental explanation of
 * benefits with why it happened and exactly what to do about it. The
 * corrective actions are ordered: do them in sequence.
 *
 * ABOUT THE CODES
 * The `carc` values are Claim Adjustment Reason Codes from the X12 standard
 * code set, which payers use across both medical and dental remittances. The
 * `plainLanguage` text is original wording written for this simulator, not
 * the official code text. The mapping from a dental situation to a specific
 * CARC reflects common industry practice — individual payers differ, and
 * many add their own proprietary remark codes alongside. Students should be
 * taught to read the remark text on the actual remittance, not to assume the
 * CARC alone tells the whole story.
 *
 * The `payerRemark` field is illustrative narrative in the style a dental
 * payer writes, authored here, not quoted from any real payer's documents.
 */

import { CDT_CODE_INDEX } from "./cdtCodes";

export type DenialCategory =
  | "Eligibility"
  | "Benefit limitation"
  | "Frequency"
  | "Documentation"
  | "Coding"
  | "Bundling"
  | "Authorisation"
  | "Timeliness"
  | "Patient responsibility"
  | "Contractual";

export type DenialOutcome =
  | "appeal-with-documentation"
  | "correct-and-resubmit"
  | "bill-patient"
  | "write-off-contractual"
  | "no-recourse-educate-patient";

export interface DentalDenial {
  id: string;
  /** X12 Claim Adjustment Reason Code commonly used for this situation. */
  carc: string;
  /** Group code: CO = contractual obligation (not billable to patient), PR = patient responsibility. */
  groupCode: "CO" | "PR" | "OA" | "PI";
  title: string;
  category: DenialCategory;
  /** Original plain-language reading of what the payer is saying. */
  plainLanguage: string;
  /** Illustrative remark text in a payer's voice — written for this simulator. */
  payerRemark: string;
  /** The clinical or front-office situation that produces it. */
  typicalTrigger: string;
  /** CDT codes from the teaching subset that most often carry this denial. */
  commonCodes: string[];
  /** Ordered steps the student should take. */
  correctiveActions: string[];
  /** Was this avoidable before the claim went out? */
  preventable: boolean;
  /** How to stop it happening again. */
  prevention: string;
  appealable: boolean;
  expectedOutcome: DenialOutcome;
  /** Can the balance legitimately be billed to the patient? */
  patientBillable: boolean;
  /** The one sentence a student should remember. */
  teachingPoint: string;
}

export const DENTAL_DENIALS: DentalDenial[] = [
  {
    id: "DEN-ANNUAL-MAX",
    carc: "119",
    groupCode: "CO",
    title: "Annual maximum reached",
    category: "Benefit limitation",
    plainLanguage:
      "The plan has already paid out everything it will pay for this patient this benefit period. The service was covered; the money is gone.",
    payerRemark: "Benefit maximum for this period has been met. No further payment is available until the plan renews.",
    typicalTrigger:
      "A crown, root canal or prosthetic scheduled late in the benefit year after the patient has already had significant treatment.",
    commonCodes: ["D2740", "D3330", "D5110", "D6010", "D6240", "D4260", "D7240"],
    correctiveActions: [
      "Confirm the remaining maximum on the remittance against what you estimated before treatment.",
      "Do not appeal a true maximum denial — there is nothing to appeal. The plan paid what it owed.",
      "Bill the patient the balance, using the pre-treatment estimate they signed.",
      "For anything still unscheduled, offer to defer treatment into the new benefit period and note that in the account.",
    ],
    preventable: true,
    prevention:
      "Check the remaining maximum at every eligibility verification, not just the annual one, and sequence large treatment plans across two benefit periods where it is clinically safe to do so.",
    appealable: false,
    expectedOutcome: "bill-patient",
    patientBillable: true,
    teachingPoint:
      "The annual maximum is applied last, after every other rule passes. A perfectly coded, fully documented, pre-authorised claim can still pay nothing.",
  },
  {
    id: "DEN-FREQ-XRAY",
    carc: "119",
    groupCode: "CO",
    title: "Radiograph frequency limit exceeded",
    category: "Frequency",
    plainLanguage: "This image was taken again sooner than the plan allows.",
    payerRemark: "Services of this type are limited by frequency. Payer records show this service within the limitation period.",
    typicalTrigger:
      "Bitewings taken at every six-month recall against a once-per-twelve-months allowance, or a panoramic taken inside the full-mouth series window.",
    commonCodes: ["D0274", "D0272", "D0210", "D0330"],
    correctiveActions: [
      "Pull the payer's stated last date of service and compare it with the practice's own history.",
      "If the practice's date is right and the payer's is wrong, appeal with the dated images.",
      "If the payer is right, check whether the patient signed a financial agreement acknowledging the frequency limit before the images were taken.",
      "Where a diagnostic emergency genuinely required the images, appeal with the narrative and the referring symptom.",
    ],
    preventable: true,
    prevention:
      "Build the last-taken date into the eligibility check and put a frequency flag in the hygiene schedule. A rolling window from the last service, not the benefit year, is what catches practices out.",
    appealable: true,
    expectedOutcome: "bill-patient",
    patientBillable: true,
    teachingPoint:
      "Rolling frequency windows run from the last date of service. January does not reset them.",
  },
  {
    id: "DEN-FREQ-PROPHY",
    carc: "119",
    groupCode: "CO",
    title: "Cleaning frequency exceeded",
    category: "Frequency",
    plainLanguage: "The patient has already used the cleanings the plan pays for this period.",
    payerRemark: "The allowance for this service in the current benefit period has been exhausted.",
    typicalTrigger: "A third or fourth hygiene visit in a twelve-month period on a two-per-year plan.",
    commonCodes: ["D1110", "D1120", "D4910"],
    correctiveActions: [
      "Verify whether the plan counts cleanings and periodontal maintenance in one shared pool or separately — this changes the answer entirely.",
      "If they are shared and the pool is used, bill the patient.",
      "If the plan counts them separately and the payer pooled them anyway, appeal citing the plan's own benefit summary.",
    ],
    preventable: true,
    prevention: "Confirm at the perio-recall conversation how many total hygiene visits the plan pays, and quote the patient for the rest.",
    appealable: true,
    expectedOutcome: "bill-patient",
    patientBillable: true,
    teachingPoint:
      "A three-month perio recall is good care that most plans do not fully fund. Say so before the patient is booked, not after.",
  },
  {
    id: "DEN-FREQ-SRP",
    carc: "119",
    groupCode: "CO",
    title: "Scaling and root planing frequency limit",
    category: "Frequency",
    plainLanguage: "This quadrant was deep-cleaned too recently for the plan to pay again.",
    payerRemark: "Payer records show this quadrant treated within the limitation period for this service.",
    typicalTrigger: "Re-treating a quadrant inside a 24-month window, often after the patient failed to maintain.",
    commonCodes: ["D4341", "D4342"],
    correctiveActions: [
      "Confirm which quadrant the payer thinks was treated and on what date.",
      "If a different quadrant was treated this time, correct the area of the oral cavity and resubmit — this is frequently a data-entry error, not a real frequency problem.",
      "If the same quadrant genuinely needed re-treatment, appeal with current pocket charting showing disease progression.",
    ],
    preventable: true,
    prevention: "Record the quadrant treated on every perio claim and keep a per-quadrant history in the chart.",
    appealable: true,
    expectedOutcome: "correct-and-resubmit",
    patientBillable: true,
    teachingPoint: "Perio frequency is per quadrant. Half of these denials are really the wrong quadrant on the claim.",
  },
  {
    id: "DEN-FREQ-EXAM",
    carc: "119",
    groupCode: "CO",
    title: "Evaluation frequency exceeded",
    category: "Frequency",
    plainLanguage: "The patient has used the examinations the plan allows.",
    payerRemark: "Only a limited number of evaluations are payable per benefit period. This one exceeds the allowance.",
    typicalTrigger: "An emergency exam after two routine recalls, on a plan that pools all evaluation types.",
    commonCodes: ["D0120", "D0140", "D0150", "D0180"],
    correctiveActions: [
      "Check whether the plan pools all evaluations into one allowance.",
      "If the visit was a genuine emergency, appeal with the presenting complaint and findings.",
      "Otherwise bill the patient.",
    ],
    preventable: true,
    prevention: "Track evaluations as one combined count rather than per code.",
    appealable: true,
    expectedOutcome: "bill-patient",
    patientBillable: true,
    teachingPoint: "Most plans do not care which evaluation code you used — they count evaluations.",
  },
  {
    id: "DEN-FREQ-CROWN",
    carc: "119",
    groupCode: "CO",
    title: "Crown replacement too soon",
    category: "Frequency",
    plainLanguage: "The tooth already has a crown the plan paid for inside the replacement window.",
    payerRemark: "Replacement of this restoration is not payable within the plan's stated replacement interval.",
    typicalTrigger:
      "Replacing a five-year replacement-window crown at year four, often one placed by a previous dentist that the practice did not know about.",
    commonCodes: ["D2740", "D2750", "D2751", "D2790", "D6750"],
    correctiveActions: [
      "Ask the payer for the paid date and the servicing provider on the prior crown.",
      "If the crown failed because of new decay or fracture rather than normal wear, appeal with radiographs and a narrative describing the failure.",
      "If the window simply has not elapsed, bill the patient against the signed estimate.",
    ],
    preventable: true,
    prevention:
      "During eligibility, ask the payer for the crown history on the specific tooth. It is a routine question and it prevents a four-figure surprise.",
    appealable: true,
    expectedOutcome: "appeal-with-documentation",
    patientBillable: true,
    teachingPoint: "Replacement clocks follow the tooth, not the dentist. A crown from a previous office still counts.",
  },
  {
    id: "DEN-FREQ-PROSTHETIC",
    carc: "119",
    groupCode: "CO",
    title: "Prosthetic replacement too soon",
    category: "Frequency",
    plainLanguage: "The denture, partial or bridge being replaced is newer than the plan's replacement interval.",
    payerRemark: "Replacement of a prosthetic appliance is not payable within the stated interval from the prior placement.",
    typicalTrigger: "A patient wanting a new denture at three years on a five-year interval because the old one is loose.",
    commonCodes: ["D5110", "D5120", "D5213", "D5214", "D6240", "D6245"],
    correctiveActions: [
      "Consider whether a reline or repair is payable now instead of a replacement — often it is, and it solves the clinical problem.",
      "If the appliance was lost or damaged beyond repair, check whether the plan has any exception and appeal with the circumstances.",
      "Otherwise present the patient with the self-pay fee and the date they become eligible.",
    ],
    preventable: true,
    prevention: "Ask for the placement date of the current appliance at the consultation, before any impressions are taken.",
    appealable: true,
    expectedOutcome: "bill-patient",
    patientBillable: true,
    teachingPoint: "For prosthetics, the first question is never clinical — it is 'when was the current one placed?'",
  },
  {
    id: "DEN-FREQ-FLUORIDE",
    carc: "119",
    groupCode: "CO",
    title: "Fluoride frequency exceeded",
    category: "Frequency",
    plainLanguage: "Fluoride has already been applied as often as the plan pays for this period.",
    payerRemark: "This preventive service exceeds the number of applications allowed per benefit period.",
    typicalTrigger: "A high-caries-risk patient on a three-month recall receiving fluoride at every visit.",
    commonCodes: ["D1206", "D1208"],
    correctiveActions: [
      "Check the age limit as well — it is common for both rules to fail at once and only one to be reported.",
      "Bill the patient, having warned them in advance.",
    ],
    preventable: true,
    prevention: "Flag high-risk recall patients whose clinical protocol exceeds their benefit, and get the fee agreed once rather than arguing it four times a year.",
    appealable: false,
    expectedOutcome: "bill-patient",
    patientBillable: true,
    teachingPoint: "Good clinical protocol and plan frequency are different things. The patient needs to hear that from you first.",
  },
  {
    id: "DEN-FREQ-PERIO-MAINT",
    carc: "119",
    groupCode: "CO",
    title: "Periodontal maintenance frequency exceeded",
    category: "Frequency",
    plainLanguage: "The patient has used the maintenance visits this plan funds.",
    payerRemark: "The number of periodontal maintenance procedures allowed in this benefit period has been reached.",
    typicalTrigger: "Quarterly maintenance on a plan that funds two hygiene visits of any type per year.",
    commonCodes: ["D4910"],
    correctiveActions: [
      "Confirm whether maintenance shares a pool with routine cleanings under this plan.",
      "Bill the patient for visits beyond the allowance under a signed financial agreement.",
    ],
    preventable: true,
    prevention: "Set the patient's expectation at the time periodontal therapy is completed, when they are already discussing long-term maintenance.",
    appealable: false,
    expectedOutcome: "bill-patient",
    patientBillable: true,
    teachingPoint: "Periodontal patients are the most likely to have a clinical need the plan will not fund. Plan the conversation, not just the recall.",
  },
  {
    id: "DEN-FREQ-GUARD",
    carc: "119",
    groupCode: "CO",
    title: "Occlusal guard frequency limit",
    category: "Frequency",
    plainLanguage: "A guard was paid for within the plan's replacement interval.",
    payerRemark: "This appliance is not payable within the replacement interval from the previous one.",
    typicalTrigger: "A patient who chewed through their guard replacing it two years after the last one.",
    commonCodes: ["D9944"],
    correctiveActions: ["Confirm the paid date of the previous guard.", "Bill the patient or defer until the interval elapses."],
    preventable: true,
    prevention: "Check the guard history whenever grinding is discussed, before the impression appointment.",
    appealable: false,
    expectedOutcome: "bill-patient",
    patientBillable: true,
    teachingPoint: "Appliance benefits are among the most restricted in dentistry, where they exist at all.",
  },
  {
    id: "DEN-AGE-LIMIT",
    carc: "6",
    groupCode: "CO",
    title: "Service not payable at the patient's age",
    category: "Benefit limitation",
    plainLanguage: "The plan only funds this service up to a certain age, and the patient is past it.",
    payerRemark: "This benefit is limited by the member's age on the date of service.",
    typicalTrigger: "Fluoride varnish or a sealant on a patient who has aged out since their last visit.",
    commonCodes: ["D1206", "D1208", "D1351", "D1510"],
    correctiveActions: [
      "Confirm the patient's date of birth on file matches the payer's record — a wrong birth date produces false age denials and is fixable.",
      "If the date is right and the patient has aged out, bill the patient.",
      "Do not resubmit the same claim expecting a different result; nothing has changed.",
    ],
    preventable: true,
    prevention:
      "Have the hygiene schedule flag patients within a year of an age cap so the fee is quoted before the varnish is opened.",
    appealable: false,
    expectedOutcome: "bill-patient",
    patientBillable: true,
    teachingPoint: "Age is tested on the date of service. The birthday between two appointments changes the answer.",
  },
  {
    id: "DEN-MISSING-TOOTH",
    carc: "96",
    groupCode: "CO",
    title: "Missing tooth clause applied",
    category: "Benefit limitation",
    plainLanguage:
      "The tooth being replaced was already gone before this coverage started, so the plan will not pay to replace it.",
    payerRemark: "Benefits are not available for the replacement of teeth missing prior to the member's effective date of coverage.",
    typicalTrigger:
      "A new employee with a gap from a tooth lost years ago, now being treatment planned for an implant or a bridge.",
    commonCodes: ["D6010", "D6058", "D6240", "D6245", "D5211", "D5213", "D5214"],
    correctiveActions: [
      "Establish the actual extraction date from the patient, the previous dentist, or a radiograph showing the tooth present.",
      "If the tooth was extracted after the coverage effective date, appeal with proof of the date — this is the one version of this denial that is winnable.",
      "Check whether the plan waives the clause after a period of continuous coverage, and if so, when the patient reaches it.",
      "If the clause genuinely applies, quote the full fee and put the treatment decision back to the patient.",
    ],
    preventable: true,
    prevention:
      "Ask 'when did you lose this tooth, and were you on this insurance then?' during treatment planning. It takes ten seconds and it prevents the worst conversation in dental billing.",
    appealable: true,
    expectedOutcome: "appeal-with-documentation",
    patientBillable: true,
    teachingPoint:
      "The missing tooth clause is applied before any allowance is calculated. It is the first thing to test on any replacement case.",
  },
  {
    id: "DEN-ALT-BENEFIT",
    carc: "59",
    groupCode: "CO",
    title: "Alternate benefit applied",
    category: "Contractual",
    plainLanguage:
      "The plan decided a cheaper treatment would also have worked, and paid to that level. This is a reduction, not a refusal.",
    payerRemark: "Benefits have been determined based on an alternate procedure that meets accepted standards of care.",
    typicalTrigger: "An all-ceramic crown or a composite filling on a back tooth under a plan that benchmarks to metal.",
    commonCodes: ["D2740", "D2391", "D2392", "D2393", "D2394", "D6245"],
    correctiveActions: [
      "Read the remittance carefully: confirm the plan paid at the downgraded allowance rather than denying the service.",
      "Never rebill using the cheaper code — the claim must reflect what was actually done.",
      "Bill the patient the upgrade difference, which is legitimately theirs under most contracts.",
      "If the patient was not warned in advance, escalate to the office policy on unquoted balances rather than arguing with the payer.",
    ],
    preventable: true,
    prevention:
      "Predetermine ceramic crowns and large posterior composites on any plan with a downgrade provision, and show the patient the written estimate.",
    appealable: false,
    expectedOutcome: "bill-patient",
    patientBillable: true,
    teachingPoint:
      "An alternate benefit is not a denial and not a coding error. It is the plan buying the cheaper option and leaving the patient the difference.",
  },
  {
    id: "DEN-WAITING",
    carc: "26",
    groupCode: "CO",
    title: "Service within the waiting period",
    category: "Eligibility",
    plainLanguage: "The patient has not been covered long enough for this class of service to be payable.",
    payerRemark: "Expenses incurred prior to the completion of the applicable waiting period are not covered.",
    typicalTrigger: "A crown or denture in the first year of a new plan with a twelve-month major waiting period.",
    commonCodes: ["D2740", "D2750", "D3330", "D5110", "D5213", "D8080"],
    correctiveActions: [
      "Confirm the coverage effective date and the waiting period length from the eligibility record.",
      "If the patient had prior continuous coverage that should have credited toward the waiting period, appeal with proof of prior coverage.",
      "If the waiting period stands, calculate the date it ends and offer to schedule after that date where it is clinically safe.",
      "If treatment cannot wait, get the self-pay agreement signed before the appointment.",
    ],
    preventable: true,
    prevention: "Capture the coverage effective date and every waiting period at the first eligibility check and store it on the account.",
    appealable: true,
    expectedOutcome: "bill-patient",
    patientBillable: true,
    teachingPoint: "A waiting period is not about the treatment. It is about how long the patient has held the plan.",
  },
  {
    id: "DEN-PREAUTH",
    carc: "197",
    groupCode: "CO",
    title: "Predetermination or prior authorisation not obtained",
    category: "Authorisation",
    plainLanguage: "The plan required approval before this treatment and did not receive a request.",
    payerRemark: "Precertification, authorisation or predetermination was absent for this service.",
    typicalTrigger: "Periodontal surgery, implants or orthodontics started before the review came back.",
    commonCodes: ["D4260", "D6010", "D8080", "D9222", "D4210"],
    correctiveActions: [
      "Check whether a predetermination was actually sent and is sitting unprocessed — resubmitting a claim over an open review duplicates it.",
      "Submit a retrospective review request with the full clinical package if the payer accepts one.",
      "Where the payer does not allow retrospective review, appeal on urgency if the treatment could not wait, with documentation of the urgency.",
      "Record the outcome so the office learns which of its payers actually enforce this.",
    ],
    preventable: true,
    prevention:
      "Maintain a per-payer list of what needs review and the current turnaround time, and do not schedule those cases until the approval is in hand.",
    appealable: true,
    expectedOutcome: "appeal-with-documentation",
    patientBillable: false,
    teachingPoint:
      "A predetermination is an estimate, not a guarantee — but its absence is a denial the practice usually cannot pass to the patient.",
  },
  {
    id: "DEN-MED-NEC",
    carc: "50",
    groupCode: "CO",
    title: "Not considered necessary by the payer",
    category: "Documentation",
    plainLanguage:
      "The payer's consultant did not see enough in the submitted records to agree the treatment was needed.",
    payerRemark: "Based on the documentation submitted, this service does not meet the plan's criteria for coverage.",
    typicalTrigger:
      "A crown, buildup, periodontal surgery or sedation claim sent with no radiograph, no chart and no narrative.",
    commonCodes: ["D2950", "D2740", "D4260", "D4249", "D9222", "D3346"],
    correctiveActions: [
      "Identify precisely what evidence the payer's criteria require for this service.",
      "Gather the clinical package: pre-operative radiographs, periodontal charting where relevant, intraoral photographs, and a dated narrative in the dentist's own words.",
      "Appeal in writing within the payer's appeal window, addressing the stated criterion directly rather than restating that the dentist decided it was necessary.",
      "Track the appeal and escalate to a second-level review if the first is upheld.",
    ],
    preventable: true,
    prevention:
      "Attach the documentation on the original claim for services that routinely draw review. A first-pass payment is worth far more than a won appeal ninety days later.",
    appealable: true,
    expectedOutcome: "appeal-with-documentation",
    patientBillable: false,
    teachingPoint:
      "The payer is not disputing that treatment happened. It is saying the record you sent does not show why it was needed.",
  },
  {
    id: "DEN-DOC-MISSING",
    carc: "16",
    groupCode: "CO",
    title: "Claim missing required information",
    category: "Documentation",
    plainLanguage: "Something the claim needed was blank, so it cannot be processed at all.",
    payerRemark: "Claim or service lacks information required for adjudication. Please resubmit with the missing data.",
    typicalTrigger:
      "A restoration submitted without surfaces, a quadrant procedure without the area of the oral cavity, or a crown with no tooth number.",
    commonCodes: ["D2140", "D2391", "D4341", "D2740", "D7210"],
    correctiveActions: [
      "Read the accompanying remark code — it names the missing field.",
      "Correct the claim, not the clinical record: put the data that was always in the chart into the right field on the form.",
      "Resubmit as a corrected claim inside the timely filing window.",
    ],
    preventable: true,
    prevention:
      "Run a pre-submission scrub that enforces tooth numbers on tooth-scoped codes, surfaces on restorations, and quadrants on quadrant-scoped codes.",
    appealable: false,
    expectedOutcome: "correct-and-resubmit",
    patientBillable: false,
    teachingPoint: "This denial is free to fix and should never happen twice. It is a claim-scrubbing failure, not a payer decision.",
  },
  {
    id: "DEN-SURFACE-MISMATCH",
    carc: "4",
    groupCode: "CO",
    title: "Surfaces inconsistent with the procedure or tooth",
    category: "Coding",
    plainLanguage:
      "The surfaces listed do not match the code billed, or do not exist on the tooth that was charted.",
    payerRemark: "The surfaces reported are not consistent with the procedure code or the tooth submitted.",
    typicalTrigger:
      "A two-surface code with three surfaces listed, or an occlusal surface reported on a front tooth.",
    commonCodes: ["D2150", "D2160", "D2331", "D2392", "D2393"],
    correctiveActions: [
      "Compare the surfaces in the clinical note with the surfaces on the claim.",
      "If the note supports more surfaces than the code, change the code to match the note.",
      "If the claim lists surfaces the note does not support, reduce the claim — never the other way round.",
      "Resubmit as a corrected claim.",
    ],
    preventable: true,
    prevention:
      "Validate surfaces against the tooth before the claim leaves: incisal only on front teeth, occlusal only on back teeth, and the surface count must equal the code.",
    appealable: false,
    expectedOutcome: "correct-and-resubmit",
    patientBillable: false,
    teachingPoint:
      "The note drives the code. Changing the code to fit the fee you wanted is the line between a billing correction and fraud.",
  },
  {
    id: "DEN-SRP-TOOTH-COUNT",
    carc: "151",
    groupCode: "CO",
    title: "Documentation does not support the quadrant-level code",
    category: "Documentation",
    plainLanguage:
      "The periodontal chart does not show enough diseased teeth in that quadrant to justify the higher scaling code.",
    payerRemark: "The submitted information does not support the number of teeth reported for this quadrant procedure.",
    typicalTrigger:
      "The four-or-more-teeth scaling code billed for a quadrant where only two or three teeth show pocketing and bone loss.",
    commonCodes: ["D4341", "D4342"],
    correctiveActions: [
      "Count the qualifying teeth in that quadrant on the periodontal chart yourself.",
      "If three or fewer qualify, rebill on the limited code — the practice is still paid, just correctly.",
      "If four or more qualify and the chart shows it, appeal with the pocket chart and radiographs highlighting those teeth.",
      "If the chart is simply incomplete, ask the hygienist to complete the record before anything is resubmitted.",
    ],
    preventable: true,
    prevention:
      "Do not let a perio claim go out without a current full-mouth pocket chart. The chart, not the appointment length, determines the code.",
    appealable: true,
    expectedOutcome: "correct-and-resubmit",
    patientBillable: false,
    teachingPoint:
      "This is the most common dental audit finding in the industry. Upcoding scaling by quadrant is easy to do and easy for a payer to prove.",
  },
  {
    id: "DEN-BUNDLE-BUILDUP",
    carc: "97",
    groupCode: "CO",
    title: "Buildup included in the crown",
    category: "Bundling",
    plainLanguage: "The payer considers the rebuild part of preparing the tooth for the crown, so it pays nothing extra.",
    payerRemark: "This service is included in the payment for another service performed on the same date.",
    typicalTrigger: "A core buildup billed with every crown as a matter of routine.",
    commonCodes: ["D2950", "D2954"],
    correctiveActions: [
      "Read the note: does it describe how much tooth structure was actually missing?",
      "If the tooth was genuinely too broken down to retain a crown alone, appeal with the pre-operative radiograph and a narrative that says so specifically.",
      "If the buildup was really just preparation shaping, accept the bundling and stop billing it on routine crowns.",
    ],
    preventable: true,
    prevention:
      "Bill the buildup when the clinical record supports it, not by default. A practice with a buildup on every crown invites an audit.",
    appealable: true,
    expectedOutcome: "appeal-with-documentation",
    patientBillable: false,
    teachingPoint: "Bundling denials are contractual. If the appeal fails, the balance is a write-off, not a patient bill.",
  },
  {
    id: "DEN-BUNDLE-EXAM",
    carc: "97",
    groupCode: "CO",
    title: "Evaluation bundled with another service",
    category: "Bundling",
    plainLanguage: "Two evaluations on one day, or an evaluation the payer treats as part of the other service.",
    payerRemark: "Payment for this evaluation is included in another service reported for the same date.",
    typicalTrigger: "A problem-focused exam billed alongside a routine exam and cleaning at the same visit.",
    commonCodes: ["D0140", "D0120", "D0150", "D9310"],
    correctiveActions: [
      "Decide which single evaluation best describes the visit and keep it.",
      "Where a genuinely separate problem was evaluated in addition to the recall, appeal with a note that clearly separates the two.",
      "Otherwise write off the bundled line.",
    ],
    preventable: true,
    prevention: "Report one evaluation per visit unless the record clearly documents two distinct evaluations.",
    appealable: true,
    expectedOutcome: "write-off-contractual",
    patientBillable: false,
    teachingPoint: "Same-day duplication is caught by the payer's edits before a human ever reads the claim.",
  },
  {
    id: "DEN-BUNDLE-DIAG",
    carc: "97",
    groupCode: "CO",
    title: "Diagnostic test bundled into the evaluation",
    category: "Bundling",
    plainLanguage:
      "The payer treats this diagnostic test as part of the examination it was performed during, so it pays nothing extra for it.",
    payerRemark: "This diagnostic procedure is considered part of the evaluation reported for the same date of service.",
    typicalTrigger:
      "Nerve vitality testing or study models billed alongside the examination at which they were carried out.",
    commonCodes: ["D0460", "D0470"],
    correctiveActions: [
      "Check whether the test was performed at the same visit as an evaluation that was also billed — if so, the bundling is expected behaviour rather than an error.",
      "Where the test was performed at a separate visit from any evaluation, correct the date of service and resubmit.",
      "Where it genuinely addressed a problem distinct from the evaluation, appeal with notes that record the test result separately from the examination findings.",
      "Otherwise write the line off; it is a contractual adjustment, not a patient balance.",
    ],
    preventable: true,
    prevention:
      "Know which of your payers pay diagnostic adjuncts separately. Where they do not, the cost belongs in the examination fee rather than on its own claim line.",
    appealable: true,
    expectedOutcome: "write-off-contractual",
    patientBillable: false,
    teachingPoint:
      "A test that exists to inform the examination is usually considered part of it. Billing it separately by default produces a write-off, not extra revenue.",
  },
  {
    id: "DEN-BUNDLE-PERIO",
    carc: "97",
    groupCode: "CO",
    title: "Periodontal service bundled with same-day treatment",
    category: "Bundling",
    plainLanguage: "The payer treats this periodontal service as part of another service delivered the same day.",
    payerRemark: "This procedure is not separately payable when reported with the other services on this claim.",
    typicalTrigger:
      "Full-mouth debridement with a comprehensive exam on the same date, or gum-inflammation scaling billed together with a routine cleaning.",
    commonCodes: ["D4355", "D4346", "D1110", "D4249"],
    correctiveActions: [
      "Confirm from the schedule what was actually delivered that day.",
      "Where the services were genuinely distinct and separately documented, appeal with the timed clinical notes.",
      "Where they overlap clinically, re-sequence: some of these services are designed to happen at different visits.",
    ],
    preventable: true,
    prevention:
      "Learn the same-day combinations your payers reject and build the treatment sequence around them at the scheduling stage.",
    appealable: true,
    expectedOutcome: "write-off-contractual",
    patientBillable: false,
    teachingPoint: "Some services are bundled because they are clinically contradictory on the same day, not because the payer is being difficult.",
  },
  {
    id: "DEN-BUNDLE-SURGICAL",
    carc: "97",
    groupCode: "CO",
    title: "Surgical adjunct bundled into the extraction",
    category: "Bundling",
    plainLanguage: "The extra surgical step is treated as part of the extraction already paid.",
    payerRemark: "This service is considered part of the primary surgical procedure reported for the same site.",
    typicalTrigger: "Ridge smoothing or abscess drainage billed alongside the extraction at the same site.",
    commonCodes: ["D7310", "D7510"],
    correctiveActions: [
      "Check whether the operative note describes a deliberate separate procedure beyond routine socket management.",
      "Appeal with the operative note if it does.",
      "Write off the line if it does not.",
    ],
    preventable: true,
    prevention: "Bill surgical adjuncts only where the operative note independently supports them.",
    appealable: true,
    expectedOutcome: "write-off-contractual",
    patientBillable: false,
    teachingPoint: "If the only evidence for the adjunct is that the extraction was difficult, it is part of the extraction.",
  },
  {
    id: "DEN-BUNDLE-PALLIATIVE",
    carc: "97",
    groupCode: "CO",
    title: "Palliative treatment bundled with definitive treatment",
    category: "Bundling",
    plainLanguage: "Pain relief is not paid separately when the problem was definitively treated the same day.",
    payerRemark: "Palliative treatment is not payable in addition to definitive treatment of the same tooth on the same date.",
    typicalTrigger: "An emergency visit where the tooth was both medicated and extracted.",
    commonCodes: ["D9110"],
    correctiveActions: [
      "Keep the definitive service and remove the palliative line.",
      "Where palliative care addressed a different tooth than the one definitively treated, appeal with tooth-specific notes.",
    ],
    preventable: true,
    prevention: "Report palliative treatment only when the visit ended without definitive treatment of that tooth.",
    appealable: true,
    expectedOutcome: "write-off-contractual",
    patientBillable: false,
    teachingPoint: "Palliative means you relieved the pain and sent the patient away to come back. If you fixed it, bill the fix.",
  },
  {
    id: "DEN-BUNDLE-RESTORATIVE",
    carc: "97",
    groupCode: "CO",
    title: "Restorative step bundled into the definitive restoration",
    category: "Bundling",
    plainLanguage: "A protective or interim step is treated as part of the final restoration.",
    payerRemark: "This service is included in the allowance for the definitive restoration on the same tooth.",
    typicalTrigger: "A temporary filling or pulp cap billed alongside the definitive restoration on the same tooth and date.",
    commonCodes: ["D2940", "D3110"],
    correctiveActions: [
      "Confirm whether the definitive restoration was done at the same visit on the same tooth.",
      "If it was, remove the interim line.",
      "If the interim step was genuinely a separate visit, correct the date of service and resubmit.",
    ],
    preventable: true,
    prevention: "Check dates of service before submitting interim and definitive restorations together.",
    appealable: true,
    expectedOutcome: "correct-and-resubmit",
    patientBillable: false,
    teachingPoint: "Interim codes exist for visits that end without definitive treatment.",
  },
  {
    id: "DEN-DOWNCODE-SURGICAL",
    carc: "45",
    groupCode: "CO",
    title: "Surgical extraction paid at the simple extraction rate",
    category: "Documentation",
    plainLanguage:
      "The payer did not see evidence of surgical technique, so it paid the lower-level extraction.",
    payerRemark: "Charge adjusted to the allowance for the procedure the submitted documentation supports.",
    typicalTrigger:
      "A surgical extraction or impaction billed without a radiograph and without an operative note describing flap, bone removal or sectioning.",
    commonCodes: ["D7210", "D7220", "D7230", "D7240"],
    correctiveActions: [
      "Retrieve the pre-operative radiograph and the operative note.",
      "Check that the note explicitly describes the surgical steps — raising a flap, removing bone, sectioning the tooth.",
      "Appeal with both. If the note does not describe those steps, the lower code was correct and the difference is a write-off.",
    ],
    preventable: true,
    prevention:
      "Attach the radiograph to every surgical extraction claim and train the surgical note template to state the technique in one line.",
    appealable: true,
    expectedOutcome: "appeal-with-documentation",
    patientBillable: false,
    teachingPoint:
      "The difference between extraction levels is the technique described in the note. No description, no higher payment.",
  },
  {
    id: "DEN-DUPLICATE",
    carc: "18",
    groupCode: "CO",
    title: "Duplicate claim or service",
    category: "Coding",
    plainLanguage: "The payer already has this exact service for this patient, tooth and date.",
    payerRemark: "Exact duplicate of a claim or service already processed.",
    typicalTrigger:
      "A resubmission sent before the original finished processing, or root canal retreatment submitted without the original treatment date.",
    commonCodes: ["D3346", "D3348", "D0220", "D2740"],
    correctiveActions: [
      "Look up the original claim before doing anything — the money may already be posted.",
      "If this is genuinely a second, different service on the same tooth, resubmit with the distinguishing information: the prior treatment date, the surfaces, or a narrative.",
      "If it was a true duplicate, close the line and stop the automatic rebill.",
    ],
    preventable: true,
    prevention:
      "Wait out the payer's processing window before rebilling, and always include the original placement date on retreatment claims.",
    appealable: true,
    expectedOutcome: "correct-and-resubmit",
    patientBillable: false,
    teachingPoint:
      "Retreatment on a tooth the payer already paid to treat looks identical to a duplicate unless you tell it otherwise.",
  },
  {
    id: "DEN-TOOTH-ELIGIBILITY",
    carc: "6",
    groupCode: "CO",
    title: "Tooth not eligible for this service",
    category: "Coding",
    plainLanguage: "The tooth submitted does not qualify for the code billed.",
    payerRemark: "The procedure reported is not payable for the tooth submitted.",
    typicalTrigger:
      "A sealant on a tooth that already has a restoration, a primary-tooth crown code on a permanent tooth number, or a sealant on a tooth outside the covered range.",
    commonCodes: ["D1351", "D2930", "D2931"],
    correctiveActions: [
      "Compare the tooth designation on the claim with the chart — transposed Universal and FDI numbers are a frequent cause.",
      "Correct the tooth number or the code so that they agree with each other and with the record.",
      "Resubmit as a corrected claim.",
    ],
    preventable: true,
    prevention:
      "Validate tooth designation against dentition and code type before submission. Letters for primary teeth, numbers for permanent.",
    appealable: false,
    expectedOutcome: "correct-and-resubmit",
    patientBillable: false,
    teachingPoint: "A code and a tooth that contradict each other never reach a human reviewer — the edit rejects them first.",
  },
  {
    id: "DEN-NOT-COVERED",
    carc: "204",
    groupCode: "PR",
    title: "Not a covered benefit under this plan",
    category: "Benefit limitation",
    plainLanguage: "The plan simply does not include this service, at any level.",
    payerRemark: "This service is not covered under the member's current benefit plan.",
    typicalTrigger: "Implants, 3D imaging, adult nitrous oxide, occlusal guards or cosmetic treatment on a plan that excludes them.",
    commonCodes: ["D6010", "D6057", "D0367", "D9230", "D9944", "D1354", "D7960", "D9995"],
    correctiveActions: [
      "Confirm against the plan's exclusion list that this is a true exclusion, not a documentation problem wearing the same code.",
      "Do not appeal a plan exclusion on clinical grounds; the plan is not disputing that it was needed.",
      "Bill the patient — exclusions are patient responsibility, and the group code on the remittance will normally say so.",
      "Feed the exclusion back into the practice's verification checklist so the next patient is quoted correctly.",
    ],
    preventable: true,
    prevention: "Verify coverage for the specific planned code, not just 'does the patient have dental insurance'.",
    appealable: false,
    expectedOutcome: "no-recourse-educate-patient",
    patientBillable: true,
    teachingPoint:
      "Excluded is not the same as denied. There is no clinical argument that makes a plan cover something it does not sell.",
  },
  {
    id: "DEN-TIMELY-FILING",
    carc: "29",
    groupCode: "CO",
    title: "Timely filing limit exceeded",
    category: "Timeliness",
    plainLanguage: "The claim arrived after the payer's deadline for submitting it.",
    payerRemark: "The time limit for filing this claim has expired.",
    typicalTrigger:
      "A claim that sat in a rejection queue for months, or one sent to the wrong payer first and only corrected after the window closed.",
    commonCodes: [],
    correctiveActions: [
      "Find proof of the original timely submission: a clearinghouse acceptance report, a payer acknowledgement, or a mail log.",
      "Appeal with that proof attached — this is the only argument that reliably works.",
      "If the claim was genuinely never sent in time, it is a practice write-off. In most contracts it cannot be billed to the patient.",
      "Investigate why it aged and fix the queue that let it happen.",
    ],
    preventable: true,
    prevention:
      "Work rejections within days, not months, and run an aged-claims report weekly. Timely filing is the one denial that becomes permanently unwinnable.",
    appealable: true,
    expectedOutcome: "write-off-contractual",
    patientBillable: false,
    teachingPoint: "Every other denial can be fixed eventually. This one has a hard expiry date, and the practice absorbs it.",
  },
  {
    id: "DEN-COB-PRIMARY",
    carc: "22",
    groupCode: "CO",
    title: "Another plan is primary",
    category: "Eligibility",
    plainLanguage: "This payer believes it is the secondary plan and wants to see the primary's payment first.",
    payerRemark: "This care may be covered by another payer under coordination of benefits.",
    typicalTrigger:
      "A child covered by both parents, where the birthday rule decides which plan pays first and the practice guessed wrong.",
    commonCodes: [],
    correctiveActions: [
      "Establish which plan is truly primary. For dependent children, most plans use the birthday rule: the parent whose birthday falls earlier in the calendar year is primary, regardless of age.",
      "Bill the primary plan first and wait for its remittance.",
      "Submit to the secondary with the primary's remittance attached.",
      "Expect less than you think from a non-duplication secondary — it often pays nothing at all.",
    ],
    preventable: true,
    prevention: "Ask about other coverage at every registration and re-ask annually. Patients forget they have a second plan.",
    appealable: false,
    expectedOutcome: "correct-and-resubmit",
    patientBillable: false,
    teachingPoint:
      "Coordination is about order, not entitlement. Sending the claim in the wrong order delays payment and can blow the filing window.",
  },
  {
    id: "DEN-PERIO-MAINT-CONFLICT",
    carc: "97",
    groupCode: "CO",
    title: "Maintenance and routine cleaning conflict",
    category: "Bundling",
    plainLanguage:
      "The plan will not pay a routine cleaning and a periodontal maintenance visit in a way that contradicts the patient's periodontal status.",
    payerRemark: "This service is not payable in combination with the other hygiene service reported.",
    typicalTrigger:
      "Alternating routine cleanings and maintenance visits to stretch the benefit, on a plan that pools them.",
    commonCodes: ["D1110", "D4910"],
    correctiveActions: [
      "Determine the patient's actual periodontal status from the chart and bill the code that matches it.",
      "If the patient has completed periodontal therapy, maintenance is the correct code and alternating is not a strategy.",
      "Bill the patient for visits beyond the plan's combined allowance.",
    ],
    preventable: true,
    prevention: "Set the hygiene recall type from the periodontal diagnosis, then let the benefit fall where it falls.",
    appealable: false,
    expectedOutcome: "bill-patient",
    patientBillable: true,
    teachingPoint:
      "Choosing the hygiene code to maximise the benefit rather than to match the diagnosis is how practices end up in a payer audit.",
  },
  {
    id: "DEN-ORTHO-AGE",
    carc: "6",
    groupCode: "CO",
    title: "Orthodontic age limit exceeded",
    category: "Benefit limitation",
    plainLanguage: "The plan covers orthodontics only for dependents up to a stated age.",
    payerRemark: "Orthodontic benefits are limited to eligible dependents within the plan's stated age range.",
    typicalTrigger: "An adult case banded on a plan whose orthodontic benefit stops at nineteen.",
    commonCodes: ["D8080", "D8090"],
    correctiveActions: [
      "Confirm the age limit and the patient's age at the banding date, not at the consultation date.",
      "Convert the case to a self-pay contract and set up the payment plan.",
    ],
    preventable: true,
    prevention: "Verify orthodontic eligibility specifically, including the age cap and the banding-date rule, before records are taken.",
    appealable: false,
    expectedOutcome: "bill-patient",
    patientBillable: true,
    teachingPoint: "Orthodontic benefits sit outside the rest of the plan and follow their own rules. Verify them separately.",
  },
  {
    id: "DEN-ORTHO-LIFETIME-MAX",
    carc: "119",
    groupCode: "CO",
    title: "Orthodontic lifetime maximum reached",
    category: "Benefit limitation",
    plainLanguage: "The plan has paid all it will ever pay toward orthodontics for this patient.",
    payerRemark: "The lifetime orthodontic maximum for this member has been satisfied.",
    typicalTrigger:
      "A second phase of treatment, or a patient who had partial treatment under the same plan years earlier.",
    commonCodes: ["D8080", "D8090", "D8670"],
    correctiveActions: [
      "Ask the payer what has already been applied to the lifetime maximum and when.",
      "Stop the instalment billing so the account does not keep generating unpayable claims.",
      "Move the remaining balance to the patient contract.",
    ],
    preventable: true,
    prevention: "Ask about prior orthodontic treatment at the consultation, including treatment as a child under the same family plan.",
    appealable: false,
    expectedOutcome: "bill-patient",
    patientBillable: true,
    teachingPoint: "Lifetime means lifetime. It does not reset with a new benefit year or a new employer under the same plan.",
  },
  {
    id: "DEN-TIME-UNITS",
    carc: "151",
    groupCode: "CO",
    title: "Time units not supported",
    category: "Documentation",
    plainLanguage: "The sedation or anaesthesia time billed is not backed by the record.",
    payerRemark: "The information submitted does not support this number of time units.",
    typicalTrigger: "Sedation billed in increments with no start and stop times in the anaesthesia record.",
    commonCodes: ["D9222", "D9243"],
    correctiveActions: [
      "Retrieve the anaesthesia record with the documented start and stop times.",
      "Recalculate the units from the record and correct the claim if they differ.",
      "Appeal with the record attached if the units were right.",
    ],
    preventable: true,
    prevention: "Never submit a time-based code without the times written in the record first.",
    appealable: true,
    expectedOutcome: "appeal-with-documentation",
    patientBillable: false,
    teachingPoint: "For time-based codes the clock in the record is the claim. Nothing else counts.",
  },
  {
    id: "DEN-PATIENT-DEDUCTIBLE",
    carc: "1",
    groupCode: "PR",
    title: "Applied to the deductible",
    category: "Patient responsibility",
    plainLanguage: "Not a denial. This amount went toward the patient's deductible before benefits started.",
    payerRemark: "The amount shown has been applied to the member's deductible for this benefit period.",
    typicalTrigger: "The first basic or major claim of the benefit year.",
    commonCodes: ["D2391", "D2740", "D4341"],
    correctiveActions: [
      "Post the deductible as patient responsibility, not as a write-off.",
      "Check the deductible is not being taken twice across two claims processed on the same day.",
      "Update the patient's remaining deductible on the account so the next estimate is right.",
    ],
    preventable: false,
    prevention: "Include the deductible in every pre-treatment estimate so the patient is not surprised by the first bill of the year.",
    appealable: false,
    expectedOutcome: "bill-patient",
    patientBillable: true,
    teachingPoint:
      "Students must learn to read the group code. PR means the patient owes it; CO usually means they do not.",
  },
  {
    id: "DEN-CONTRACTUAL-WRITEOFF",
    carc: "45",
    groupCode: "CO",
    title: "Charge exceeds the contracted allowance",
    category: "Contractual",
    plainLanguage:
      "The practice's fee is higher than the fee it agreed to accept from this payer. The difference is not billable to the patient.",
    payerRemark: "Charge exceeds the maximum allowable amount under the provider agreement.",
    typicalTrigger: "Any in-network claim where the office fee is above the contracted rate.",
    commonCodes: [],
    correctiveActions: [
      "Post the write-off to the contractual adjustment account.",
      "Never bill this difference to the patient — doing so breaches the participating provider agreement.",
      "If the allowance looks wrong for the contract, request the current fee schedule and compare before disputing.",
    ],
    preventable: false,
    prevention: "Load each payer's current fee schedule into the practice system so estimates match reality.",
    appealable: true,
    expectedOutcome: "write-off-contractual",
    patientBillable: false,
    teachingPoint:
      "Balance-billing a contractual write-off is the fastest way for a practice to lose its network participation.",
  },
];

export const DENTAL_DENIAL_INDEX: Record<string, DentalDenial> = Object.fromEntries(
  DENTAL_DENIALS.map((d) => [d.id, d]),
);

export function findDenial(id: string): DentalDenial | undefined {
  return DENTAL_DENIAL_INDEX[id];
}

/**
 * Every denial commonly associated with a code, in both directions: denials
 * that list the code in `commonCodes`, plus denials the code itself points to
 * via `CDTCode.commonDenials`.
 *
 * Checking both matters — neither list is exhaustive on its own, and a
 * one-directional lookup silently drops real risks from the student's
 * pre-submission warnings.
 */
export function denialsForCode(code: string): DentalDenial[] {
  const key = code.trim().toUpperCase();
  const fromDenials = DENTAL_DENIALS.filter((d) => d.commonCodes.includes(key));
  const fromCode = (CDT_CODE_INDEX[key]?.commonDenials ?? [])
    .map((id) => DENTAL_DENIAL_INDEX[id])
    .filter((d): d is DentalDenial => Boolean(d));
  const seen = new Set(fromDenials.map((d) => d.id));
  return [...fromDenials, ...fromCode.filter((d) => !seen.has(d.id))];
}

export function denialsByCategory(category: DenialCategory): DentalDenial[] {
  return DENTAL_DENIALS.filter((d) => d.category === category);
}

/**
 * Reference for the AR stage: what a student should actually be able to say
 * on a call with an insurance representative for each outcome type.
 */
export const AR_CALL_GUIDANCE: Record<DenialOutcome, string> = {
  "appeal-with-documentation":
    "Ask what specific documentation the reviewer needs, confirm the appeal address and deadline, and get a reference number for the call.",
  "correct-and-resubmit":
    "Confirm exactly which field or value failed, ask whether a corrected claim or a new claim is required, and confirm the filing deadline still allows it.",
  "bill-patient":
    "Confirm in the call that the balance is the member's responsibility and note the representative's name and the call reference before moving the balance.",
  "write-off-contractual":
    "Confirm the adjustment is contractual and cannot be billed to the member, then close the balance rather than leaving it ageing.",
  "no-recourse-educate-patient":
    "Confirm the exclusion in writing if you can, then move the conversation to the patient and their options rather than back to the payer.",
};
