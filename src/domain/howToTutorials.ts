/**
 * howToTutorials — short "how to use this EHR" guides.
 *
 * Six guides, in the order a visit moves through the revenue cycle. The landing
 * page shows them to visitors, and the Help button inside the EHR shows the same
 * guides beside the work, so a student never reads two versions of a step.
 *
 * Every button name here is the label on screen, word for word, so a student
 * can find it by reading.
 */

export interface TutorialStep {
  /** What to do, in a few words — starts with the action. */
  title: string;
  /** How, and what to look for. One or two sentences. */
  detail: string;
}

export interface HowToTutorial {
  id: string;
  title: string;
  /** Where in the EHR this happens. */
  where: string;
  /** About how long the guide takes to follow, in minutes. */
  minutes: number;
  /** What the student can do after this guide. */
  outcome: string;
  steps: TutorialStep[];
}

export const TUTORIAL_PATIENT_TIP =
  "Start with the Tutorial Patient. Every stage of that chart is already filled in, so press Continue through it once to see what a finished stage looks like — then book your own patient and do it yourself.";

export const HOW_TO_TUTORIALS: HowToTutorial[] = [
  {
    id: "book",
    title: "Book and check in a patient",
    where: "Schedule",
    minutes: 2,
    outcome: "A new patient on today's schedule, checked in, with their insurance card on file.",
    steps: [
      {
        title: "Open the Schedule",
        detail: "From the Dashboard, open Schedule and press New Appointment.",
      },
      {
        title: "Register the patient",
        detail:
          "Press Register new patient and fill in name, date of birth, phone and address. The visit type changes to New Patient for you.",
      },
      {
        title: "Capture the insurance card",
        detail:
          "Pick the payer from the list, then type the member ID and group number. Pick Self-pay if there is no insurance.",
      },
      {
        title: "Create the appointment",
        detail: "Press Create Appointment. If something is missing, the message under the form says exactly what.",
      },
      {
        title: "Check the patient in",
        detail: "On the appointment card, press Check In. The visit is marked Arrived and the chart opens on Registration.",
      },
    ],
  },
  {
    id: "register",
    title: "Verify identity and insurance",
    where: "Chart › Registration",
    minutes: 3,
    outcome: "A verified coverage record and a 271 eligibility response with copay, deductible and coinsurance.",
    steps: [
      {
        title: "Read both documents",
        detail:
          "Compare the driver's licence with the insurance card, then press Read the card to unlock the boxes below.",
      },
      {
        title: "Transcribe the card",
        detail: "Type payer, subscriber ID, group number and payer ID exactly as printed. These fill the claim later.",
      },
      {
        title: "Check the names",
        detail:
          "Answer whether the name on the card matches the government ID. A misspelt card is a real denial waiting to happen.",
      },
      {
        title: "Verify, then run the 270",
        detail:
          "Press Verify Identity & Insurance, then Verify eligibility (270). Read the 271: status, copay, deductible and coinsurance.",
      },
    ],
  },
  {
    id: "chart",
    title: "Chart the visit as the scribe",
    where: "Chart › Progress Note (SOAP)",
    minutes: 5,
    outcome: "A complete SOAP note, signed and locked, ready for the coder.",
    steps: [
      {
        title: "Record vitals",
        detail: "In Intake / Vitals, enter BP, pulse, temperature, respiration and SpO2. A red box means a value cannot be right.",
      },
      {
        title: "Write the HPI",
        detail:
          "Type the history in your own words, or type .oldcarts and press Enter for a template to fill in.",
      },
      {
        title: "Review of systems",
        detail:
          "Press Mark All Normal, then click any system the patient reports a problem with. The ROS line is added to the Subjective.",
      },
      {
        title: "Assessment and plan",
        detail:
          "Write the assessment and plan, attach the ICD-10 codes, and use E/M MDM Wizard to check the visit level.",
      },
      {
        title: "Sign and lock",
        detail: "On Sign & Lock, clear every item marked Required, then press Sign & Lock Note. The note can no longer change.",
      },
    ],
  },
  {
    id: "code",
    title: "Code the encounter",
    where: "Coding",
    minutes: 4,
    outcome: "ICD-10 and CPT codes linked line by line and sent to billing.",
    steps: [
      {
        title: "Add the diagnoses",
        detail: "Search ICD-10 by code or words. Put the main reason for the visit first using the arrows.",
      },
      {
        title: "Add the procedures",
        detail: "Search CPT, then link each line to its diagnoses, check POS 11 for an office visit and type the charge.",
      },
      {
        title: "Check the E/M level",
        detail: "Use the E/M Level Calculator: the level is set by two of the three MDM elements, never by adding them up.",
      },
      {
        title: "Submit to billing",
        detail:
          "Press Submit Coded Encounter to Billing and answer the prior-authorization question. Continue unlocks after you submit.",
      },
    ],
  },
  {
    id: "claim",
    title: "Build and send the claim",
    where: "Billing / Claim",
    minutes: 3,
    outcome: "A clean CMS-1500 sent as an 837P and accepted on a 277CA.",
    steps: [
      {
        title: "Read the claim form",
        detail:
          "Boxes are filled from registration and coding. Each box shows the 837P segment it becomes on an electronic claim.",
      },
      {
        title: "Answer prior authorization",
        detail: "Say whether the payer's list needs an authorization. If it does, the number goes in Box 23.",
      },
      {
        title: "Validate",
        detail: "Press Validate and fix every edit check it names. Advisories are notes; errors block the claim.",
      },
      {
        title: "Submit",
        detail: "Press Submit. The 277CA tells you the clearinghouse accepted it — that is not payment yet.",
      },
    ],
  },
  {
    id: "post",
    title: "Post the 835 and work AR",
    where: "Payments (835) › Denials & AR",
    minutes: 5,
    outcome: "Payment posted to the ledger, denials worked and patient balances billed.",
    steps: [
      {
        title: "Get the payer's answer",
        detail: "On Payments (835), press Adjudicate this claim to receive the 835 remittance.",
      },
      {
        title: "Read every line",
        detail:
          "Billed, allowed, CO-45 contractual write-off, PR-1 deductible, PR-2 coinsurance, paid. Explain this remittance line by line helps.",
      },
      {
        title: "Post it",
        detail: "Press Post this 835 to the ledger. The patient ledger now shows the charge, payment and adjustments.",
      },
      {
        title: "Work the AR queue",
        detail:
          "In Denials & AR, fix denials with Correct and resubmit or Appeal. Bill patient balances with Send patient statement.",
      },
    ],
  },
];
