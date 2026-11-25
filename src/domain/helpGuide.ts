/**
 * helpGuide — the built-in "Ask a question" guide behind the floating help head.
 *
 * Works offline and calls no AI service: a question is matched against three
 * sources that already live in the app, so an answer is never invented.
 *   1. FAQ — how to use this EHR, with the on-screen button names word for word.
 *   2. Glossary — the revenue-cycle terms students meet on every screen.
 *   3. CARC table (`data/claims/carc.ts`) — every adjustment code's meaning and fix.
 * Plus the step-by-step how-to guides (`howToTutorials.ts`).
 *
 * Wording is our own plain-language teaching text. Payer behaviour described
 * here follows public US patterns and is labelled simulated in the app.
 */

import { CARC_BY_CODE, CARC_CODES, CARC_GROUP_MEANINGS, type CarcGroup } from "../data/claims/carc";
import { HOW_TO_TUTORIALS } from "./howToTutorials";

export interface HelpAnswer {
  id: string;
  /** The question or term, as a heading. */
  title: string;
  /** The answer, two or three plain sentences. */
  answer: string;
  kind: "how-to" | "term" | "code" | "guide";
  /** Where to go to do it, when there is one place. */
  goTo?: { label: string; to: string };
  /** For kind "guide": the how-to guide to open. */
  guideId?: string;
}

interface Entry extends HelpAnswer {
  keywords: string[];
}

const FAQ: Entry[] = [
  {
    id: "faq-start",
    kind: "how-to",
    title: "Where do I start?",
    answer:
      "Open the Tutorial Patient first: every stage is already filled in, so press Continue through it to see a finished visit. Then book your own patient on the Schedule and do each stage yourself.",
    keywords: ["start", "begin", "first", "new", "where", "tutorial", "how", "use"],
    goTo: { label: "Open Dashboard", to: "/dashboard" },
  },
  {
    id: "faq-book",
    kind: "how-to",
    title: "How do I book a new patient?",
    answer:
      "Go to Schedule, press New Appointment, choose Register new patient, fill in name, date of birth, phone, address and insurance (or self-pay), then Create Appointment.",
    keywords: ["book", "appointment", "new patient", "register", "schedule", "add patient", "create"],
    goTo: { label: "Open Schedule", to: "/schedule" },
  },
  {
    id: "faq-checkin",
    kind: "how-to",
    title: "How do I check a patient in?",
    answer:
      "On the Schedule, press Check In on the patient's row. The chart opens on Registration, where you read the insurance card and verify identity before eligibility.",
    keywords: ["check in", "checkin", "arrive", "arrived", "front desk"],
    goTo: { label: "Open Schedule", to: "/schedule" },
  },
  {
    id: "faq-tutorial-readonly",
    kind: "how-to",
    title: "Why can't I type in the Tutorial Patient?",
    answer:
      "The Tutorial Patient is a read-only reference chart, so it always shows a correct finished visit. To practise typing, book your own patient or open a Practice Case.",
    keywords: ["tutorial", "read only", "readonly", "cannot type", "can't type", "locked", "disabled", "edit"],
  },
  {
    id: "faq-switch",
    kind: "how-to",
    title: "How do I switch patients?",
    answer:
      "Click a patient in the Inbox list on the left of the chart, or use the patient search at the top (Ctrl/⌘ + K). Every stage then shows that patient's own data.",
    keywords: ["switch", "change patient", "other patient", "open patient", "select patient", "search patient"],
  },
  {
    id: "faq-save",
    kind: "how-to",
    title: "Is my work saved?",
    answer:
      "Yes. The chart autosaves as you type (look for “Saved” at the top) and syncs to your account, so it is there after a reload or on another device.",
    keywords: ["save", "saved", "lost", "autosave", "reload", "refresh", "device"],
  },
  {
    id: "faq-continue",
    kind: "how-to",
    title: "What do I do next on this screen?",
    answer:
      "Each stage has one main button at the bottom, “Continue to …”, that takes you to the next desk. The live tracker under the stepper also shows a “Next:” hint for this visit.",
    keywords: ["next", "continue", "stuck", "what now", "next step", "lost"],
  },
  {
    id: "faq-greyed",
    kind: "how-to",
    title: "Why is the Continue button greyed out?",
    answer:
      "A stage waits until its required work is done — for example Coding waits for “Submit Coded Encounter to Billing”. The message beside the button says what is missing.",
    keywords: ["grey", "gray", "greyed", "disabled", "continue", "can't continue", "blocked"],
  },
  {
    id: "faq-sign",
    kind: "how-to",
    title: "How do I sign the note?",
    answer:
      "Finish Assessment & Plan, then Continue to Sign & Lock Note. The checklist shows what is still required; when it is complete, press Sign & Lock Note. After signing, changes go in an addendum.",
    keywords: ["sign", "lock", "note", "signature", "addendum"],
  },
  {
    id: "faq-code",
    kind: "how-to",
    title: "How do I code the visit?",
    answer:
      "On Coding, search and add the ICD-10-CM diagnosis and the CPT/E/M code, enter the charge, then press Submit Coded Encounter to Billing. The E/M calculator suggests the level from MDM (two of three elements).",
    keywords: ["code", "coding", "icd", "cpt", "diagnosis", "e/m", "em", "mdm", "level"],
  },
  {
    id: "faq-claim",
    kind: "how-to",
    title: "How do I send the claim?",
    answer:
      "On Billing / Claim, check the CMS-1500, press Validate to run the scrubber, fix anything it lists, then Submit. You will see the 837P go out and the 277CA come back.",
    keywords: ["claim", "submit", "send", "cms", "1500", "bill", "scrubber", "validate"],
  },
  {
    id: "faq-post",
    kind: "how-to",
    title: "How do I post the payment?",
    answer:
      "On Payments (835), press Adjudicate this claim to receive the remittance, read each line's CARC, then Post this 835 to the ledger. The money ticker updates with paid, adjusted and patient owes.",
    keywords: ["post", "payment", "835", "era", "remittance", "eob", "adjudicate", "paid"],
  },
  {
    id: "faq-ar",
    kind: "how-to",
    title: "How do I work a denial or a balance?",
    answer:
      "On Denials & AR, open the item: the CARC tells you the action (correct and resubmit, appeal, write off, or bill the patient). Patient balances offer a statement and a patient payment to close the visit.",
    keywords: ["denial", "denied", "ar", "appeal", "balance", "follow up", "write off", "statement", "close"],
  },
  {
    id: "faq-cases",
    kind: "how-to",
    title: "Where are the practice cases?",
    answer:
      "Press Practice cases in the top bar. Graded medical and dental cases have traps to catch and give a score with a debrief at the end. The Medical / Dental switch only changes side.",
    keywords: ["case", "cases", "practice", "graded", "score", "dental", "exam"],
    goTo: { label: "Open Practice cases", to: "/cases" },
  },
  {
    id: "faq-support",
    kind: "how-to",
    title: "How do I contact support?",
    answer:
      "Open this help panel and press Message support on WhatsApp. Tell us the patient and the stage you were on.",
    keywords: ["support", "contact", "whatsapp", "help", "teacher", "instructor", "problem", "bug"],
  },
];

const GLOSSARY: Entry[] = [
  ["270/271", "Eligibility check", "The 270 asks the payer whether the patient is covered on the date of service; the 271 answers with active coverage, copay, deductible and coinsurance. Run it before the visit.", ["270", "271", "eligibility", "coverage", "verify", "benefits"]],
  ["837P", "Electronic professional claim", "The 837P is the electronic version of the CMS-1500 claim, sent to the payer through a clearinghouse.", ["837", "837p", "electronic claim", "edi"]],
  ["277CA", "Claim acknowledgement", "The 277CA tells you whether the payer accepted the claim into its system or rejected it for a front-end error you must fix and resubmit. Accepted is not paid.", ["277", "277ca", "acknowledgement", "accepted", "rejected", "rejection"]],
  ["835 / ERA", "Electronic remittance", "The 835 (ERA) is the payer's payment explanation: allowed amount, paid amount and a CARC for every adjustment. You post it to the ledger.", ["835", "era", "remittance", "eob"]],
  ["CMS-1500", "Professional claim form", "The claim form for physician and outpatient professional services. Box 21 holds diagnoses, Box 24 the service lines with diagnosis pointers in 24E.", ["cms-1500", "cms1500", "1500", "claim form", "box"]],
  ["Copay", "Copayment", "A fixed amount the patient pays for a visit, usually collected at check-in. It is patient responsibility (PR-3 on the 835).", ["copay", "copayment", "co-pay"]],
  ["Deductible", "Deductible", "The amount the patient pays each year before the plan starts sharing costs. Shows on the 835 as PR-1.", ["deductible", "pr-1", "pr1"]],
  ["Coinsurance", "Coinsurance", "The patient's percentage of the allowed amount after the deductible — for example 20%. Shows on the 835 as PR-2.", ["coinsurance", "co-insurance", "pr-2", "pr2", "percent"]],
  ["Allowed amount", "Allowed amount", "The most the payer recognises for a service under its fee schedule. Charge minus allowed is the contractual adjustment (CO-45), which is written off, never billed to the patient.", ["allowed", "fee schedule", "contractual", "write off", "writeoff"]],
  ["Prior authorization", "Prior authorization", "Payer approval needed before certain services. A missing or unapproved auth is denied (CO-197). Traditional Medicare does not require PA for a routine office visit.", ["prior auth", "prior authorization", "pa", "authorization", "precert"]],
  ["Modifier 25", "Modifier 25", "Added to an E/M code when a significant, separately identifiable visit happens on the same day as a procedure.", ["modifier", "25", "mod 25"]],
  ["Modifier 59 / XS", "Modifier 59 / XS", "Marks a distinct procedural service that would otherwise bundle under NCCI edits. Use only when documentation supports a separate site or session.", ["59", "xs", "modifier 59", "bundle", "ncci"]],
  ["POS", "Place of service", "A two-digit code in Box 24B for where the service happened, e.g. 11 office, 22 outpatient hospital, 02/10 telehealth.", ["pos", "place of service", "24b"]],
  ["NPI", "National Provider Identifier", "The 10-digit ID of a provider (individual) or practice (group). Rendering NPI goes in 24J, billing NPI in 33a. All NPIs here are fictional.", ["npi", "provider id", "24j", "33a"]],
  ["Timely filing", "Timely filing limit", "The deadline to submit a claim after the date of service — Medicare is 12 months; commercial plans are often 90–180 days. Late claims are denied CO-29.", ["timely filing", "deadline", "late", "co-29", "filing limit"]],
  ["E/M", "Evaluation and Management", "Office visit codes 99202–99215. The level is chosen by medical decision making (two of three: problems, data, risk) or by total time.", ["e/m", "em", "evaluation", "99213", "99214", "mdm", "level"]],
  ["ICD-10-CM", "Diagnosis codes", "Codes for why the patient was seen. Code to the highest specificity documented and list the main reason first.", ["icd", "icd-10", "diagnosis", "dx"]],
  ["CPT", "Procedure codes", "Codes for what was done. CPT descriptions are AMA-licensed, so this app shows its own short labels.", ["cpt", "procedure", "hcpcs"]],
  ["CARC groups", "CO, PR, OA, PI", `CO — ${CARC_GROUP_MEANINGS.CO} PR — ${CARC_GROUP_MEANINGS.PR}`, ["carc", "group", "co", "pr", "oa", "pi", "adjustment reason"]],
  ["Clean claim", "Clean claim", "A claim accepted and paid on first submission with no errors. Clean-claim rate is a key billing KPI.", ["clean claim", "first pass", "kpi"]],
  ["Days in AR", "Days in AR", "How long, on average, money waits to be collected. Lower is better; work the oldest and largest balances first.", ["days in ar", "aging", "ar", "accounts receivable", "bucket"]],
].map(([title, sub, answer, keywords]) => ({
  id: `term-${String(title).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  kind: "term" as const,
  title: title === sub ? String(title) : `${title} — ${sub}`,
  answer: String(answer),
  keywords: keywords as string[],
}));

const GUIDES: Entry[] = HOW_TO_TUTORIALS.map((t) => ({
  id: `guide-${t.id}`,
  kind: "guide" as const,
  title: t.title,
  answer: `${t.where} · about ${t.minutes} min. ${t.outcome}`,
  guideId: t.id,
  keywords: [t.title, t.where, ...t.steps.map((s) => s.title)].flatMap((s) => s.toLowerCase().split(/\W+/)).filter((w) => w.length > 3),
}));

function codeAnswer(code: string): HelpAnswer | null {
  const carc = CARC_BY_CODE[code];
  if (!carc) return null;
  return {
    id: `code-${carc.code}`,
    kind: "code",
    title: `${carc.code} — ${carc.description}`,
    answer: `${carc.meaning} Fix: ${carc.howToFix}`,
  };
}

function normalise(text: string): string {
  return text.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
}

/** "co45", "CO 45", "co-45" → "CO-45"; a bare "45" tries every group. */
export function carcCodesIn(query: string): string[] {
  const found = new Set<string>();
  for (const m of query.matchAll(/\b(co|pr|oa|pi)\s*-?\s*(\d{1,3})\b/gi)) {
    found.add(`${m[1].toUpperCase()}-${m[2]}`);
  }
  if (found.size === 0) {
    for (const m of query.matchAll(/\b(?:carc|code|reason)?\s*(\d{1,3})\b/gi)) {
      for (const g of ["CO", "PR", "OA", "PI"] as CarcGroup[]) {
        if (CARC_BY_CODE[`${g}-${m[1]}`]) found.add(`${g}-${m[1]}`);
      }
    }
  }
  return [...found].filter((c) => CARC_BY_CODE[c]);
}

function score(entry: Entry, q: string, words: string[]): number {
  let s = 0;
  const title = normalise(entry.title);
  if (title.includes(q)) s += 8;
  for (const k of entry.keywords) {
    const key = normalise(k);
    if (key.includes(" ") ? q.includes(key) : words.includes(key)) s += key.includes(" ") ? 5 : 3;
  }
  for (const w of words) {
    if (w.length > 2 && title.includes(w)) s += 1;
  }
  return s;
}

const STOP = new Set(["the", "a", "an", "to", "do", "i", "is", "my", "how", "what", "why", "where", "can", "of", "on", "in", "it", "this", "does", "mean", "for", "and"]);

/** Best answers for a question, most relevant first. Empty for an empty question. */
export function askHelpGuide(question: string, limit = 5): HelpAnswer[] {
  const q = normalise(question);
  if (!q) return [];
  const out: HelpAnswer[] = [];
  for (const code of carcCodesIn(q)) {
    const a = codeAnswer(code);
    if (a) out.push(a);
  }
  const words = q.split(/[^a-z0-9/-]+/).filter((w) => w && !STOP.has(w));
  const ranked = [...FAQ, ...GLOSSARY, ...GUIDES]
    .map((e) => ({ e, s: score(e, q, words) }))
    .filter((r) => r.s >= 3)
    .sort((a, b) => b.s - a.s);
  // A word search over CARC descriptions, for "timely filing denial" style questions.
  if (out.length === 0 && words.length > 0) {
    const hits = CARC_CODES.map((c) => ({
      c,
      s: words.filter((w) => w.length > 3 && normalise(`${c.description} ${c.meaning}`).includes(w)).length,
    }))
      .filter((h) => h.s >= Math.min(2, words.filter((w) => w.length > 3).length) && h.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 2);
    for (const { c } of hits) {
      const a = codeAnswer(c.code);
      if (a) ranked.push({ e: { ...a, keywords: [] }, s: 2 });
    }
  }
  for (const { e } of ranked) {
    if (out.length >= limit) break;
    if (out.some((o) => o.id === e.id)) continue;
    const { keywords: _k, ...answer } = e;
    out.push(answer);
  }
  return out.slice(0, limit);
}

/** Starter questions shown before the student types. */
export const SUGGESTED_QUESTIONS = [
  "Where do I start?",
  "How do I book a new patient?",
  "What does CO-45 mean?",
  "How do I post the payment?",
  "Why is the Continue button greyed out?",
];
