/**
 * CodingQueue — Enhanced Medical Coder Workspace
 *
 * Major upgrade with:
 * - ICD-10 priority ordering (1st, 2nd, 3rd diagnosis) with up/down reorder
 * - Per-CPT data: modifiers, ICD linking, units, charges
 * - ICD ↔ CPT linking dropdown per CPT row
 * - Full charge capture per claim
 *
 * Inspiration: Epic Cogito / 3M 360 Encompass / AAPC CPC curriculum
 */

import { useState, useMemo } from "react";
import { Search, Code, BookOpen, ArrowRight, CheckCircle2, AlertTriangle, FileText, Info, ArrowUp, ArrowDown, Link2, DollarSign, Hash, Activity, Star, ChevronDown, ChevronRight } from "lucide-react";
import { usePipeline, type ClaimServiceLine } from "../../store/pipelineStore";
import { MEDICAL_PROVIDER_PROFILE } from "../../data/claims/providerProfile";
import { ICD10_CODES, searchICD10, type ICD10Code } from "./icd10Data";
import { CPT_CODES, searchCPT, type CPTCode } from "./cptData";
import { MODIFIER_REFERENCE, POS_REFERENCE } from "./modifierPosData";
import { PA_PROCEDURES } from "../PriorAuthPortal/paData";
import { scoreCoder, updateStageScore, getStudentName } from "../../utils/scoring";
import { noteFieldsOf, noteStatus } from "../../domain/noteStatus";

// ─── PA Trigger Codes & Keywords ────────────────────────────────────

const PA_ICD_CODES = [
  "C50", "C61", "M17.11", "I21.0", "I50.9", "J44.1", "K35.80", "N63.01", "E11.40",
  "C25", "C34", "C56", "C61", "C64", "C67", "M16.11", "M17.11", "M25.561",
  "I25.10", "I48.91", "I50.22", "I50.32", "N18.30", "E11.40", "E11.41",
];

const PA_KEYWORDS = [
  "surgery", "procedure", "MRI", "CT scan", "biopsy", "replacement",
  "transplant", "cath lab", "stent", "implant", "arthroplasty",
  "endoscopy", "colonoscopy", "bypass", "laparoscopic", "arthroscopic",
  "catheter", "pacemaker", "defibrillator", "graft", "resection",
];

const PA_MEDICATIONS = [
  "humira", "enbrel", "stelara", "xeljanz", "orencia", "actemra",
  "rituxan", "insulin", "eliquis", "xarelto", "cosentyx", "taltz",
  "skyrizi", "rinvoq", "dupixent", "entyvio", "avastin", "herceptin",
  "keytruda", "opdivo", "ibrance", "imatinib", "lenalidomide",
];

// ─── Types ────────────────────────────────────────────────────────

interface CPTCodeData {
  cpt: CPTCode;
  linkedICDs: string[]; // ICD-10 code strings
  modifiers: string[]; // free-text modifiers, typed by the student
  pos: string; // free-text place of service
  units: number;
  charges: number;
}

const DEFAULT_POS = "11"; // Owner instruction: every new CPT line starts at POS 11 (Office)

// Split a free-text modifiers box ("25, 59") into the stored array
const parseModifiers = (text: string): string[] =>
  text
    .split(",")
    .map(m => m.trim().toUpperCase())
    .filter(Boolean);

// Fresh per-line data for a newly added CPT code.
// Modifiers start empty on every line, office E/M included: whether a modifier
// belongs on a line is the student's decision (STANDING-RULES 6). It used to
// prefill "25" on every office E/M, which answered the modifier-25 trap before
// the student read the note.
const initialCptData = (cpt: CPTCode): CPTCodeData => ({
  cpt,
  linkedICDs: [],
  modifiers: [],
  pos: DEFAULT_POS,
  units: 1,
  charges: 0,
});

/**
 * Office/outpatient E/M levels, one row per code, keyed on the medical decision
 * making (MDM) level the code pays at — 1 straightforward, 2 low, 3 moderate,
 * 4 high. 99202-99205 are new patient, 99212-99215 established.
 *
 * The AMA rule the calculator applies: a level is supported when at least TWO of
 * the three MDM elements (problems, data, risk) meet it. Every row used to sit
 * one level too high and 99205 / 99215 were missing, so the "Recommended Code"
 * panel named the wrong code for the complexity the student had entered.
 */
const E_M_LEVELS = [
  { code: "99202", name: "New Patient — Straightforward MDM", mdm: 1, newPatient: true },
  { code: "99203", name: "New Patient — Low MDM", mdm: 2, newPatient: true },
  { code: "99204", name: "New Patient — Moderate MDM", mdm: 3, newPatient: true },
  { code: "99205", name: "New Patient — High MDM", mdm: 4, newPatient: true },
  { code: "99212", name: "Established — Straightforward MDM", mdm: 1, newPatient: false },
  { code: "99213", name: "Established — Low MDM", mdm: 2, newPatient: false },
  { code: "99214", name: "Established — Moderate MDM", mdm: 3, newPatient: false },
  { code: "99215", name: "Established — High MDM", mdm: 4, newPatient: false },
];

/** The three risk dropdown values as MDM levels, so risk can be compared like the sliders. */
const MDM_RISK_LEVEL: Record<string, number> = { Minimal: 1, Low: 2, Moderate: 3, High: 4 };

const CONVENTIONS = [
  { title: "Excludes1", desc: "Codes that are mutually exclusive. Both conditions cannot occur together. DO NOT report both.", color: "bg-red-50 border-red-200 text-red-700" },
  { title: "Excludes2", desc: "Codes that represent separate conditions. Both CAN be reported together if both are present.", color: "bg-amber-50 border-amber-200 text-amber-700" },
  { title: "Code First", desc: "Underlying etiology must be coded first (e.g., code DM first for neuropathy).", color: "bg-brand-50 border-brand-200 text-brand-700" },
  { title: "Use Additional Code", desc: "The manifestation or complication should be coded with an additional code.", color: "bg-brand-50 border-brand-200 text-brand-700" },
  { title: "Laterality", desc: "Seventh character extension for side: 1=right, 2=left, 9=unspecified.", color: "bg-brand-50 border-brand-200 text-brand-700" },
  { title: "Unspecified vs Specified", desc: "Use unspecified codes only when the provider has not documented enough detail.", color: "bg-slate-50 border-slate-200 text-slate-700" },
];

// ─── Component ────────────────────────────────────────────────────

import { ReadOnlyReason, readOnlyAttrs } from "../shell/ReadOnlyStage";

interface CodingQueueProps {
  medications?: { id: string; name: string; dosage: string; frequency: string   /** The standard reference chart: codes cannot be added, removed or sent. */
  readOnly?: boolean;
}[];
}

/**
 * "1st", "2nd", "3rd", "4th" — the priority label beside a selected ICD-10 code.
 *
 * The old inline expression printed "3th" for the third code, and would have
 * printed "21th" for a twenty-first: a coder reads those labels as the order the
 * claim reports its diagnoses in (box 21 A, B, C), so the wording has to be right.
 */
function ordinal(n: number): string {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  if (n % 10 === 1) return `${n}st`;
  if (n % 10 === 2) return `${n}nd`;
  if (n % 10 === 3) return `${n}rd`;
  return `${n}th`;
}

export function CodingQueue({ medications, readOnly = false }: CodingQueueProps) {
  const { state, submitToBilling, setRole, setCodingLinePlaceOfService } = usePipeline();

  // Code search state
  const [icdQuery, setIcdQuery] = useState("");
  const [cptQuery, setCptQuery] = useState("");

  // Ordered ICD-10 list with priority (position = priority)
  const [selectedICDs, setSelectedICDs] = useState<ICD10Code[]>(
    state.icdCodes.length > 0
      ? ICD10_CODES.filter(c => state.icdCodes.includes(c.code))
      : []
  );

  // Per-CPT data: each CPT gets its own modifiers, linked ICDs, units, charges
  const [cptDataMap, setCptDataMap] = useState<Record<string, CPTCodeData>>({});
  // Base CPT list (the codes themselves)
  const [selectedCPTs, setSelectedCPTs] = useState<CPTCode[]>(
    state.cptCodes.length > 0
      ? CPT_CODES.filter(c => state.cptCodes.includes(c.code))
      : []
  );

  // E/M calculator
  const [emProblems, setEmProblems] = useState<number>(1);
  const [emData, setEmData] = useState<number>(1);
  const [emRisk, setEmRisk] = useState<string>("Low");
  const [emPatientType, setEmPatientType] = useState<"new" | "established">("established");

  // Conventions panel
  const [showConventions, setShowConventions] = useState(false);

  // Quiz
  const [quizAnswer, setQuizAnswer] = useState<string | null>(null);
  const [quizFeedback, setQuizFeedback] = useState<string | null>(null);

  // Submission state
  const [submitted, setSubmitted] = useState(false);
  const [codingScore, setCodingScore] = useState<number | null>(null);
  // PA auto-route interstitial
  const [showPAInterstitial, setShowPAInterstitial] = useState(false);
  // Rule 6 — the student answers the PA question before the interstitial shows
  // what triggered it. `null` = not answered yet.
  const [paAnswer, setPaAnswer] = useState<"yes" | "no" | null>(null);
  const [, setHasPACodes] = useState(false);
  const [paTriggerReasons, setPaTriggerReasons] = useState<string[]>([]);
  // Pending codes stored before PA interstitial decision
  const [pendingIcdCodes, setPendingIcdCodes] = useState<string[]>([]);
  const [pendingCptCodes, setPendingCptCodes] = useState<string[]>([]);
  const [pendingLines, setPendingLines] = useState<ClaimServiceLine[]>([]);

  // Code details panel (D3: Code Lookup)
  const [selectedCodeDetails, setSelectedCodeDetails] = useState<ICD10Code | CPTCode | null>(null);
  const [detailsType, setDetailsType] = useState<"icd10" | "cpt">("icd10");

  // Search results
  const icdResults = useMemo(() => searchICD10(icdQuery), [icdQuery]);
  const cptResults = useMemo(() => searchCPT(cptQuery), [cptQuery]);

  // Free-text modifier boxes, keyed by CPT code (so a trailing comma stays typeable)
  const [modifierText, setModifierText] = useState<Record<string, string>>({});
  // Collapsible modifier / POS reference panel
  const [showModifierRef, setShowModifierRef] = useState(false);

  // Get or create CPT data for a cpt code. A line the Coder already handed over
  // keeps what it was handed over with — its place of service (24B), its
  // modifiers (24D), its units (24G) and its charge (24F) — so a reload, or a
  // chart seeded with coded lines, shows the codes the claim is actually billed
  // with instead of blank boxes under a claim that already carries them.
  const getCptData = (code: string): CPTCodeData => {
    if (!cptDataMap[code]) {
      const cpt = selectedCPTs.find(c => c.code === code);
      const stored = state.codingLines?.find(l => l.cpt === code);
      const base = initialCptData(cpt!);
      cptDataMap[code] = stored
        ? {
            ...base,
            pos: stored.placeOfService || base.pos,
            modifiers: stored.modifiers?.length ? [...stored.modifiers] : base.modifiers,
            units: stored.units > 0 ? stored.units : base.units,
            charges: stored.charge > 0 ? stored.charge : base.charges,
          }
        : base;
    }
    return cptDataMap[code];
  };

  const updateCptData = (code: string, updater: (d: CPTCodeData) => CPTCodeData) => {
    setCptDataMap(prev => ({
      ...prev,
      [code]: updater(prev[code] || getCptData(code)),
    }));
  };

  // ICD reorder
  const moveICD = (idx: number, direction: "up" | "down") => {
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === selectedICDs.length - 1) return;
    const newList = [...selectedICDs];
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    [newList[idx], newList[targetIdx]] = [newList[targetIdx], newList[idx]];
    setSelectedICDs(newList);
  };

  const addICD = (code: ICD10Code) => {
    if (!selectedICDs.find((c) => c.code === code.code)) {
      setSelectedICDs([...selectedICDs, code]);
      setIcdQuery("");
    }
  };

  const removeICD = (code: string) => {
    setSelectedICDs(selectedICDs.filter((c) => c.code !== code));
    // Also remove this ICD from all CPT links
    setCptDataMap(prev => {
      const next: Record<string, CPTCodeData> = {};
      for (const [k, v] of Object.entries(prev)) {
        next[k] = { ...v, linkedICDs: v.linkedICDs.filter(c => c !== code) };
      }
      return next;
    });
  };

  const addCPT = (code: CPTCode) => {
    if (!selectedCPTs.find((c) => c.code === code.code)) {
      setSelectedCPTs([...selectedCPTs, code]);
      setCptQuery("");
      // Initialize CPT data
      setCptDataMap(prev => ({
        ...prev,
        [code.code]: initialCptData(code),
      }));
    }
  };

  const removeCPT = (code: string) => {
    setSelectedCPTs(selectedCPTs.filter((c) => c.code !== code));
    setCptDataMap(prev => {
      const next = { ...prev };
      delete next[code];
      return next;
    });
  };

  // A level is supported when at least two of the three MDM elements meet it;
  // the highest level that clears two elements is the one to report.
  const calcEMMLevel = () => {
    const elements = [emProblems, emData, MDM_RISK_LEVEL[emRisk] ?? 1];
    let mdm = 1;
    for (let level = 4; level >= 1; level--) {
      if (elements.filter((v) => v >= level).length >= 2) {
        mdm = level;
        break;
      }
    }
    const newPatient = emPatientType === "new";
    return E_M_LEVELS.find((l) => l.newPatient === newPatient && l.mdm === mdm) ?? E_M_LEVELS[0];
  };

  const handleSubmitToBilling = () => {
    if (selectedICDs.length > 0 && selectedCPTs.length > 0) {
      const icdCodes = selectedICDs.map((c) => c.code);
      const cptCodes = selectedCPTs.map((c) => c.code);

      // Box 24 of the CMS-1500 is filled from these per-line values: the date,
      // place of service, modifiers, diagnosis pointer, charge and units the
      // coder captured, so the biller never re-types what coding already did.
      const today = new Date().toISOString().slice(0, 10);
      const claimLines: ClaimServiceLine[] = selectedCPTs.map((c) => {
        const d = cptDataMap[c.code] ?? initialCptData(c);
        const pointer = d.linkedICDs
          .map((code) => {
            const idx = icdCodes.indexOf(code);
            return idx >= 0 ? String.fromCharCode(65 + idx) : "";
          })
          .filter(Boolean)
          .join("");
        return {
          dateOfService: today,
          placeOfService: d.pos || DEFAULT_POS,
          cpt: c.code,
          modifiers: d.modifiers,
          diagnosisPointer: pointer || "A",
          // Box 24F is the charge the coder decided, never the fee schedule
          // filled in for them (STANDING-RULES 6). Left empty when the student
          // typed nothing: the biller's edit checks then name box 24F/28 as
          // theirs to complete instead of paying a number nobody chose.
          charge: d.charges,
          units: d.units > 0 ? d.units : 1,
          renderingNpi: MEDICAL_PROVIDER_PROFILE.npi,
        };
      });

      // Calculate coding score
      const modifier25Applied = selectedCPTs.some(c => cptDataMap[c.code]?.modifiers.includes("25") ?? false);
      const score = scoreCoder(icdCodes, cptCodes, modifier25Applied);
      setCodingScore(score);
      updateStageScore(getStudentName(), "coder", score);

      // Enhanced PA detection — check multiple sources
      const paReasons: string[] = [];

      // 1. Check CPT codes — search inside each procedure's cptCodes array
      const allPaCptCodes = Object.values(PA_PROCEDURES).flatMap(p => p.cptCodes);
      const cptNeedsPA = selectedCPTs.some(c => allPaCptCodes.includes(c.code));
      if (cptNeedsPA) {
        const paCpts = selectedCPTs.filter(c => allPaCptCodes.includes(c.code));
        paReasons.push(`CPT codes: ${paCpts.map(c => c.code).join(", ")}`);
      }

      // 2. Check ICD codes for PA-triggering diagnoses
      const icdNeedsPA = selectedICDs.some(icd => PA_ICD_CODES.some(pc => icd.code.startsWith(pc)));
      if (icdNeedsPA) {
        const paIcds = selectedICDs.filter(icd => PA_ICD_CODES.some(pc => icd.code.startsWith(pc)));
        paReasons.push(`Diagnosis codes: ${paIcds.map(c => c.code).join(", ")}`);
      }

      // 3. Check Scribe note for procedure keywords
      const note = noteFieldsOf(state);
      const scribeText = [note.subjective, note.objective, note.assessment, note.plan]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchedKeywords = PA_KEYWORDS.filter(kw => scribeText.includes(kw));
      if (matchedKeywords.length > 0) {
        paReasons.push(`Note mentions: ${matchedKeywords.slice(0, 4).join(", ")}`);
      }

      // 4. Check medications
      const matchedMeds = (medications || []).filter(m =>
        PA_MEDICATIONS.some(pm => m.name.toLowerCase().includes(pm))
      );
      if (matchedMeds.length > 0) {
        paReasons.push(`Medications: ${matchedMeds.map(m => m.name).join(", ")}`);
      }

      const detectedPA = paReasons.length > 0;
      setHasPACodes(detectedPA);
      setPaTriggerReasons(paReasons);
      setPendingIcdCodes(icdCodes);
      setPendingCptCodes(cptCodes);
      setPendingLines(claimLines);

      if (detectedPA) {
        // Ask the student first — the trigger list is revealed after they answer
        setPaAnswer(null);
        setShowPAInterstitial(true);
      } else {
        // No PA needed — submit and go to Biller directly
        submitToBilling(icdCodes, cptCodes, claimLines);
        setSubmitted(true);
        setRole("biller");
      }
    }
  };

  const handleConfirmPA = () => {
    // Submit codes and route to Prior Auth
    submitToBilling(pendingIcdCodes, pendingCptCodes, pendingLines);
    setSubmitted(true);
    setShowPAInterstitial(false);
    setRole("prior-auth");
  };

  const handleSkipPA = () => {
    // Submit codes but skip PA — go directly to Biller
    submitToBilling(pendingIcdCodes, pendingCptCodes, pendingLines);
    setSubmitted(true);
    setShowPAInterstitial(false);
    setRole("biller");
  };

  const handleQuizSubmit = () => {
    if (quizAnswer === "yes") {
      setQuizFeedback("✓ Correct! E11.9 supports a moderate MDM visit like 99214.");
    } else {
      setQuizFeedback("Actually yes — a diabetic patient with medication management can support 99214.");
    }
  };

  const emLevel = calcEMMLevel();

  // Compute total charge
  const totalCharges = useMemo(() => {
    let total = 0;
    selectedCPTs.forEach(cpt => {
      const data = cptDataMap[cpt.code];
      if (data) total += data.charges * data.units;
    });
    return total;
  }, [selectedCPTs, cptDataMap]);

  // The standard chart: codes are shown, never changed.
  const readOnlyBanner = readOnly ? <ReadOnlyReason className="mb-3" /> : null;
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {readOnlyBanner}
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <Code className="h-5 w-5 text-brand-600" />
          <h2 className="text-sm font-bold text-slate-800">Medical Coding — Enhanced Coding Queue</h2>
          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-medium text-brand-700">Stage 3</span>
        </div>
      </div>

      {state.status === "charted" || selectedICDs.length > 0 ? (
        <div className="flex flex-1 overflow-hidden">
          {/* ─── Left: Locked SOAP Note ─── */}
          <div className="hidden w-1/3 border-r border-slate-200 bg-slate-50 p-4 lg:block overflow-y-auto">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500">Encounter Note (Read Only)</span>
              <Lock className="h-3 w-3 text-slate-300" />
            </div>
            <div className="space-y-3 text-xs">
              {/* Dynamic SOAP note — uses actual scribe data, not hardcoded placeholder */}
              {(() => {
                // The note read here is the encounter's own record — the one
                // Sign & Lock signed — never a copy handed down from a screen.
                const note = noteFieldsOf(state);
                const hasSoapData = !!(note.subjective || note.objective || note.assessment || note.plan);
                const hasScribeNote = !!state.scribeNote;

                if (hasSoapData) {
                  // Structured SOAP data from the scribe stage
                  return (
                    <>
                      {note.subjective && (
                        <div className="rounded-lg bg-white p-3 shadow-sm">
                          <p className="font-medium text-brand-600">Subjective</p>
                          <p className="mt-1 whitespace-pre-wrap text-slate-600">{note.subjective}</p>
                        </div>
                      )}
                      {note.objective && (
                        <div className="rounded-lg bg-white p-3 shadow-sm">
                          <p className="font-medium text-green-600">Objective</p>
                          <p className="mt-1 whitespace-pre-wrap text-slate-600">{note.objective}</p>
                        </div>
                      )}
                      {note.assessment && (
                        <div className="rounded-lg bg-white p-3 shadow-sm">
                          <p className="font-medium text-amber-600">Assessment</p>
                          <p className="mt-1 whitespace-pre-wrap text-slate-600">{note.assessment}</p>
                        </div>
                      )}
                      {note.plan && (
                        <div className="rounded-lg bg-white p-3 shadow-sm">
                          <p className="font-medium text-brand-600">Plan</p>
                          <p className="mt-1 whitespace-pre-wrap text-slate-600">{note.plan}</p>
                        </div>
                      )}
                    </>
                  );
                }

                if (hasScribeNote) {
                  // Fallback: raw scribe note text (pre-structured SOAP data)
                  return (
                    <div className="rounded-lg bg-white p-3 shadow-sm">
                      <p className="font-medium text-slate-700">Encounter Note</p>
                      <p className="mt-1 whitespace-pre-wrap text-slate-600">{state.scribeNote}</p>
                    </div>
                  );
                }

                // No note available
                return (
                  <div className="rounded-lg bg-white p-3 shadow-sm">
                    <p className="font-medium text-slate-400">No clinical note submitted</p>
                    <p className="mt-1 text-slate-400 italic">Complete charting in the Scribe role first.</p>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ─── Right: Coding Workspace ─── */}
          <div className="flex flex-1 flex-col overflow-y-auto p-4">
            {/* Tabs: ICD / CPT / Conventions / E/M */}
            <div className="flex gap-1 border-b border-slate-200 pb-2">
              {["icd", "cpt", "conventions", "em"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setShowConventions(tab === "conventions");
                    setIcdQuery(tab === "icd" ? icdQuery : "");
                    setCptQuery(tab === "cpt" ? cptQuery : "");
                  }}
                  className={`px-3 py-1.5 text-[10px] font-medium rounded-t-lg transition-colors ${
                    (tab === "icd" && !showConventions) || (tab === "conventions" && showConventions)
                      ? "bg-brand-50 text-brand-700 border-b-2 border-brand-600"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {tab === "icd" ? "ICD-10 Codes" : tab === "cpt" ? "CPT Codes" : tab === "conventions" ? "Conventions" : "E/M Level"}
                </button>
              ))}
            </div>

            {/* ICD-10 + CPT Workspace */}
            {!showConventions && (
              <>
                {/* ─── ICD-10 Section with Priority ─── */}
                <div className="mt-4">
                  <p className="text-xs font-semibold text-brand-700 mb-2 flex items-center gap-1">
                    ICD-10-CM Diagnosis Codes
                    <span className="text-[9px] font-normal text-brand-500 ml-1">(drag or use arrows to set priority — 1st, 2nd, 3rd)</span>
                  </p>
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={icdQuery}
                      onChange={(e) => setIcdQuery(e.target.value)}
                      placeholder="Search by code, description, or chapter..."
                      className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-xs outline-none focus:border-brand-500"
                    />
                  </div>
                  {icdQuery && (
                    <div className="mb-2 max-h-32 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                      {icdResults.map((code) => (
                        <button
                          key={code.code}
                          onClick={() => addICD(code)}
                          className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-brand-50 border-b border-slate-50 last:border-0"
                        >
                          <div>
                            <span className="font-mono font-medium text-brand-600">{code.code}</span>
                            <span className="ml-2 text-slate-600">{code.description}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-400">{code.chapter}</span>
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCodeDetails(code);
                                setDetailsType("icd10");
                              }}
                              className="text-brand-500 hover:text-brand-600 cursor-pointer"
                              title="View code details"
                            >
                              <Info className="h-3 w-3" />
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Selected ICD-10 codes with priority indicators + reorder arrows */}
                  <div className="space-y-1.5">
                    {selectedICDs.map((c, idx) => (
                      <div key={c.code} className="flex items-center gap-2 rounded-lg border border-brand-100 bg-brand-50/50 px-2 py-0 text-[10px]">
                        {/* The two reorder arrows sit side by side, each a 40 px
                            target, so neither target overlaps the other and the
                            dense row is no taller than before (spec
                            phase-2-layout.md §6, standing rule 5). The arrow
                            glyph itself stays 12 px. */}
                        <div className="flex shrink-0 items-center">
                          <button
                            onClick={() => moveICD(idx, "up")}
                            disabled={idx === 0}
                            aria-label={`Move ${c.code} up in the diagnosis order`}
                            title={idx === 0 ? "Already first — the principal diagnosis is listed first" : `Move ${c.code} up`}
                            className={`flex h-10 w-10 items-center justify-center rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed ${
                              idx === 0 ? "text-slate-300" : "text-brand-600 hover:bg-brand-100 hover:text-brand-700"
                            }`}
                          >
                            <ArrowUp className="h-3 w-3" aria-hidden="true" />
                          </button>
                          <button
                            onClick={() => moveICD(idx, "down")}
                            disabled={idx === selectedICDs.length - 1}
                            aria-label={`Move ${c.code} down in the diagnosis order`}
                            title={idx === selectedICDs.length - 1 ? "Already last — there is no code below it" : `Move ${c.code} down`}
                            className={`flex h-10 w-10 items-center justify-center rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed ${
                              idx === selectedICDs.length - 1 ? "text-slate-300" : "text-brand-600 hover:bg-brand-100 hover:text-brand-700"
                            }`}
                          >
                            <ArrowDown className="h-3 w-3" aria-hidden="true" />
                          </button>
                        </div>
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold text-white ${
                          idx === 0 ? "bg-red-400" : idx === 1 ? "bg-amber-400" : "bg-brand-500"
                        }`}>
                          {ordinal(idx + 1)}
                        </span>
                        <span className="font-mono font-semibold text-brand-700 shrink-0">{c.code}</span>
                        <span className="flex-1 text-slate-600 truncate">{c.description}</span>
                        <button onClick={() => removeICD(c.code)} className="text-red-400 hover:text-red-600 shrink-0">&times;</button>
                      </div>
                    ))}
                    {selectedICDs.length === 0 && (
                      <p className="text-[10px] text-slate-400 italic">No ICD-10 codes selected. Search and add above.</p>
                    )}
                  </div>
                </div>

                {/* ─── CPT Section with Per-Code Data ─── */}
                <div className="mt-5">
                  <p className="text-xs font-semibold text-brand-700 mb-2">CPT Procedure Codes</p>
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={cptQuery}
                      onChange={(e) => setCptQuery(e.target.value)}
                      placeholder="Search by code, description, or category..."
                      className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-xs outline-none focus:border-brand-500"
                    />
                  </div>
                  {cptQuery && (
                    <div className="mb-2 max-h-32 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                      {cptResults.map((code) => (
                        <button
                          key={code.code}
                          onClick={() => addCPT(code)}
                          className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-brand-50 border-b border-slate-50 last:border-0"
                        >
                          <div>
                            <span className="font-mono font-medium text-brand-600">{code.code}</span>
                            <span className="ml-2 text-slate-600">{code.description}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-400">RVU: {code.rvu}</span>
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCodeDetails(code);
                                setDetailsType("cpt");
                              }}
                              className="text-brand-500 hover:text-brand-600 cursor-pointer"
                              title="View code details"
                            >
                              <Info className="h-3 w-3" />
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Per-CPT detail rows */}
                  {selectedCPTs.length > 0 && (
                    <div className="space-y-2">
                      {selectedCPTs.map((cpt) => {
                        const data = cptDataMap[cpt.code] || getCptData(cpt.code);
                        return (
                          <div key={cpt.code} className="rounded-lg border border-brand-100 bg-white p-2.5 shadow-sm">
                            {/* CPT header row */}
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-mono font-semibold text-brand-700 text-xs">{cpt.code}</span>
                              <span className="flex-1 text-[10px] text-slate-600 truncate">{cpt.description}</span>
                              <button onClick={() => removeCPT(cpt.code)} className="text-red-400 hover:text-red-600 text-[10px]">✕</button>
                            </div>

                            {/* ICD-10 linking dropdown */}
                            <div className="mb-1.5">
                              <div className="flex items-center gap-1 mb-1">
                                <Link2 className="h-2.5 w-2.5 text-brand-600" />
                                <span className="text-[9px] font-medium text-slate-500">Link to ICD-10 Codes</span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {selectedICDs.map(icd => {
                                  const isLinked = data.linkedICDs.includes(icd.code);
                                  return (
                                    <button
                                      key={icd.code}
                                      onClick={() => updateCptData(cpt.code, d => ({
                                        ...d,
                                        linkedICDs: isLinked
                                          ? d.linkedICDs.filter(c => c !== icd.code)
                                          : [...d.linkedICDs, icd.code],
                                      }))}
                                      className={`rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors ${
                                        isLinked
                                          ? "bg-brand-100 text-brand-700 border border-brand-200"
                                          : "bg-slate-50 text-slate-500 border border-slate-200 hover:border-brand-200"
                                      }`}
                                    >
                                      {icd.code} {isLinked ? "✓" : ""}
                                    </button>
                                  );
                                })}
                                {selectedICDs.length === 0 && (
                                  <span className="text-[9px] text-slate-400 italic">Add ICD-10 codes first</span>
                                )}
                              </div>
                            </div>

                            {/* Free-text modifiers + place of service */}
                            <div className="mb-1.5 grid grid-cols-3 gap-2">
                              <div className="col-span-2">
                                <div className="flex items-center gap-1 mb-1">
                                  <label htmlFor={`mods-${cpt.code}`} className="text-[9px] font-medium text-slate-500">Modifiers</label>
                                  <span className="text-[8px] text-slate-400">(comma-separated)</span>
                                </div>
                                <input
                                  id={`mods-${cpt.code}`}
                                  type="text"
                                  value={modifierText[cpt.code] ?? data.modifiers.join(", ")}
                                  onChange={e => {
                                    const text = e.target.value;
                                    setModifierText(prev => ({ ...prev, [cpt.code]: text }));
                                    const parsed = parseModifiers(text);
                                    updateCptData(cpt.code, d => ({ ...d, modifiers: parsed }));
                                  }}
                                  placeholder="None"
                                  className="w-full rounded border border-slate-200 px-1.5 py-0.5 font-mono text-[10px] outline-none focus:border-brand-400"
                                />
                              </div>
                              <div>
                                <div className="flex items-center gap-1 mb-1">
                                  <label htmlFor={`pos-${cpt.code}`} className="text-[9px] font-medium text-slate-500">POS</label>
                                  <span className="text-[8px] text-slate-400">(place of service)</span>
                                </div>
                                {/* A picker, not a text box: the places of service the
                                    simulator teaches are the ones a student can bill
                                    at, and POS 21/22/23 are how an institutional
                                    claim (UB-04 / 837I) becomes reachable at Coding.
                                    A POS saved by an older build stays selectable so
                                    opening this screen never silently changes it. */}
                                <select
                                  id={`pos-${cpt.code}`}
                                  value={data.pos}
                                  onChange={e => {
                                    const chosen = e.target.value;
                                    updateCptData(cpt.code, d => ({ ...d, pos: chosen }));
                                    // Box 24B, written to the claim the biller reads
                                    // as well as to this line. Without this, a POS
                                    // picked on an already-coded line changed the
                                    // picker and nothing else: the claim kept POS 11
                                    // and still printed on the CMS-1500.
                                    setCodingLinePlaceOfService(cpt.code, chosen);
                                  }}
                                  aria-label={`Place of service for CPT ${cpt.code}`}
                                  title={POS_REFERENCE.find(p => p.code === data.pos)?.teachingNote}
                                  className="w-full rounded border border-slate-200 px-1 py-0.5 font-mono text-[10px] outline-none focus:border-brand-400"
                                >
                                  {POS_REFERENCE.map(p => (
                                    <option key={p.code} value={p.code}>
                                      {p.code} — {p.description}
                                    </option>
                                  ))}
                                  {!!data.pos && !POS_REFERENCE.some(p => p.code === data.pos) && (
                                    <option value={data.pos}>{data.pos} — as coded</option>
                                  )}
                                </select>
                              </div>
                            </div>
                            {/* The "Modifier 25 prefilled" note is gone: nothing is
                                prefilled now, so there is nothing to explain. The
                                post-submit denial (CO-4) teaches it instead. */}

                            {/* Units & Charges */}
                            <div className="flex items-center gap-3 mt-2">
                              <div className="flex items-center gap-1">
                                <Hash className="h-2.5 w-2.5 text-slate-400" />
                                <label className="text-[9px] text-slate-500">Units:</label>
                                <input
                                  type="number"
                                  min="1"
                                  max="99"
                                  value={data.units}
                                  aria-label={`Units for ${cpt.code}`}
                                  onChange={e => updateCptData(cpt.code, d => ({ ...d, units: Math.max(1, parseInt(e.target.value) || 1) }))}
                                  className="w-12 rounded border border-slate-200 px-1.5 py-0.5 text-[9px] outline-none focus:border-brand-500"
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                <DollarSign className="h-2.5 w-2.5 text-slate-400" />
                                <label className="text-[9px] text-slate-500">Charge:</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={data.charges || ""}
                                  aria-label={`Charge in dollars for ${cpt.code}`}
                                  onChange={e => updateCptData(cpt.code, d => ({ ...d, charges: parseFloat(e.target.value) || 0 }))}
                                  placeholder="0.00"
                                  className="w-20 rounded border border-slate-200 px-1.5 py-0.5 text-[9px] outline-none focus:border-brand-500"
                                />
                              </div>
                              {data.charges > 0 && (
                                <span className="text-[9px] text-brand-600 font-medium">
                                  = ${(data.charges * data.units).toFixed(2)}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {selectedCPTs.length === 0 && (
                    <p className="text-[10px] text-slate-400 italic">No CPT codes selected. Search and add above.</p>
                  )}

                  {/* ─── Collapsible Modifier & POS Reference ─── */}
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50">
                    <button
                      onClick={() => setShowModifierRef(v => !v)}
                      className="flex w-full items-center gap-1.5 px-2.5 py-2 text-left"
                    >
                      {showModifierRef ? (
                        <ChevronDown className="h-3 w-3 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                      )}
                      <BookOpen className="h-3 w-3 text-slate-500" />
                      <span className="text-[10px] font-semibold text-slate-600">Modifier &amp; POS Reference</span>
                      <span className="ml-1 text-[9px] text-slate-400">
                        {MODIFIER_REFERENCE.length} modifiers · {POS_REFERENCE.length} places of service
                      </span>
                    </button>
                    {showModifierRef && (
                      <div className="grid gap-3 border-t border-slate-200 p-2.5 md:grid-cols-2">
                        <div>
                          <p className="mb-1 text-[10px] font-semibold text-brand-700">Modifiers</p>
                          <div className="space-y-1">
                            {MODIFIER_REFERENCE.map(m => (
                              <div key={m.code} className="rounded border border-slate-200 bg-white px-2 py-1">
                                <p className="text-[10px] font-mono font-semibold text-slate-700">{m.code}</p>
                                <p className="text-[9px] text-slate-600">{m.description}</p>
                                <p className="text-[9px] italic text-slate-400">{m.teachingNote}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="mb-1 text-[10px] font-semibold text-green-700">Place of Service (POS)</p>
                          <div className="space-y-1">
                            {POS_REFERENCE.map(p => (
                              <div key={p.code} className="rounded border border-slate-200 bg-white px-2 py-1">
                                <p className="text-[10px] font-mono font-semibold text-slate-700">{p.code}</p>
                                <p className="text-[9px] text-slate-600">{p.description}</p>
                                <p className="text-[9px] italic text-slate-400">{p.teachingNote}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Total Charges Summary */}
                {selectedCPTs.length > 0 && totalCharges > 0 && (
                  <div className="mt-3 rounded-lg bg-brand-50 border border-brand-200 p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-brand-700">Total Charges</span>
                      <span className="text-sm font-bold text-brand-800">${totalCharges.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {/* Coding Quiz */}
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-[10px] font-semibold text-amber-700 mb-2"> Coding Quiz: Does the diagnosis support the procedure?</p>
                  <p className="text-[10px] text-amber-600 mb-2">E11.9 (Diabetes) + 99214 (Established visit) — Are these codes compatible?</p>
                  <div className="flex gap-2">
                    {["yes", "no"].map((ans) => (
                      <button
                        key={ans}
                        onClick={() => setQuizAnswer(ans)}
                        className={`px-3 py-1 rounded text-[10px] font-medium ${
                          quizAnswer === ans ? "bg-amber-600 text-white" : "bg-white text-amber-700 border border-amber-300"
                        }`}
                      >
                        {ans === "yes" ? "Yes" : "No"}
                      </button>
                    ))}
                    {quizAnswer && !quizFeedback && (
                      <button onClick={handleQuizSubmit} className="px-3 py-1 rounded text-[10px] font-medium bg-amber-600 text-white">
                        Check
                      </button>
                    )}
                  </div>
                  {quizFeedback && (
                    <p className="mt-2 text-[10px] font-medium">{quizFeedback}</p>
                  )}
                </div>

                {/* ─── PA Auto-Route Interstitial ─── */}
                {showPAInterstitial && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
                    <div className="relative w-full max-w-md rounded-xl bg-white shadow-2xl border-2 border-amber-300">
                      <div className="bg-amber-50 px-4 py-3 border-b border-amber-200 rounded-t-xl">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-amber-600" />
                          <span className="text-sm font-bold text-amber-700">
                            {paAnswer === null ? "Prior Authorisation Check" : "Prior Authorization Required"}
                          </span>
                        </div>
                      </div>
                      <div className="p-4 space-y-3">
                        {/* Rule 6 — the student answers before the app shows what
                            triggered the check. The old modal printed the trigger
                            list ("Triggered by: CPT codes …") and then asked. */}
                        {paAnswer === null ? (
                          <>
                            <p className="text-xs text-slate-600">
                              Does anything in this encounter need prior authorisation?{" "}
                              <span className="text-slate-500">Check the plan's PA list — Yes / No</span>
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setPaAnswer("yes")}
                                className="min-h-[40px] flex-1 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setPaAnswer("no")}
                                className="min-h-[40px] flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                              >
                                No
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="text-xs text-slate-600">
                              {paAnswer === "yes"
                                ? "One or more items require "
                                : "You answered No. The payer's PA list still flags this encounter — a claim sent without the authorisation is at risk of "}
                              <strong>{paAnswer === "yes" ? "Prior Authorization" : "CO-197 (prior authorisation)"}</strong>
                              {paAnswer === "yes" ? " before billing." : "."}
                            </p>
                            {paTriggerReasons.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-[10px] font-medium text-slate-500">Triggered by:</p>
                                {paTriggerReasons.map((reason, i) => (
                                  <div key={i} className="flex items-start gap-1.5 rounded bg-amber-50 px-2 py-1.5 text-[10px] text-amber-700">
                                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                                    <span>{reason}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <p className="text-[10px] text-slate-500">
                              Would you like to proceed to Prior Authorization or skip to Billing?
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={handleConfirmPA}
                                className="min-h-[40px] flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2.5 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
                              >
                                <ArrowRight className="h-3.5 w-3.5" />
                                Go to Prior Auth
                              </button>
                              <button
                                onClick={handleSkipPA}
                                className="min-h-[40px] flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                              >
                                Skip to Billing
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── Code Details Panel (D3) ─── */}
                {selectedCodeDetails && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setSelectedCodeDetails(null)}>
                    <div className="relative w-full max-w-lg rounded-xl bg-white shadow-2xl border border-slate-200" onClick={e => e.stopPropagation()}>
                      {/* Header */}
                      <div className={`flex items-center justify-between px-4 py-3 border-b border-slate-200 ${
                        detailsType === "icd10" ? "bg-brand-50" : "bg-brand-50"
                      }`}>
                        <div className="flex items-center gap-2">
                          <Activity className={`h-4 w-4 ${detailsType === "icd10" ? "text-brand-600" : "text-brand-600"}`} />
                          <span className={`text-xs font-bold ${detailsType === "icd10" ? "text-brand-700" : "text-brand-700"}`}>
                            {detailsType === "icd10" ? "ICD-10-CM" : "CPT"} Code Details
                          </span>
                        </div>
                        <button onClick={() => setSelectedCodeDetails(null)} className="text-slate-400 hover:text-slate-600">
                          <span className="text-lg">&times;</span>
                        </button>
                      </div>
                      {/* Body */}
                      <div className="p-4 max-h-96 overflow-y-auto space-y-3 text-xs">
                        {/* Code & Description */}
                        <div>
                          <p className="font-mono text-lg font-bold text-slate-800">{selectedCodeDetails.code}</p>
                          <p className="text-sm text-slate-600 mt-0.5">{selectedCodeDetails.description}</p>
                        </div>
                        {/* Category & Chapter */}
                        <div className="flex gap-2">
                          <span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600">
                            {"chapter" in selectedCodeDetails && selectedCodeDetails.chapter}
                          </span>
                          <span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600">
                            {selectedCodeDetails.category}
                          </span>
                          {"rvu" in selectedCodeDetails && (
                            <span className="rounded bg-brand-100 px-2 py-1 text-[10px] font-medium text-brand-700">
                              RVU: {selectedCodeDetails.rvu}
                            </span>
                          )}
                        </div>
                        {/* Reimbursement Rates */}
                        {"medicareRate" in selectedCodeDetails && selectedCodeDetails.medicareRate !== undefined && (
                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-lg border border-brand-100 bg-brand-50 p-2">
                              <p className="text-[9px] font-medium text-brand-500">Medicare Rate</p>
                              <p className="text-sm font-bold text-brand-700">${selectedCodeDetails.medicareRate.toFixed(2)}</p>
                            </div>
                            <div className="rounded-lg border border-green-100 bg-green-50 p-2">
                              <p className="text-[9px] font-medium text-green-500">Commercial Rate (est.)</p>
                              <p className="text-sm font-bold text-green-700">${("commercialRate" in selectedCodeDetails && selectedCodeDetails.commercialRate ? selectedCodeDetails.commercialRate : 0).toFixed(2)}</p>
                            </div>
                          </div>
                        )}
                        {/* Notes */}
                        {"notes" in selectedCodeDetails && selectedCodeDetails.notes && (
                          <div className="rounded-lg border border-amber-100 bg-amber-50 p-2">
                            <p className="text-[9px] font-semibold text-amber-600 mb-0.5">📝 Coding Tips</p>
                            <p className="text-[10px] text-amber-700">{selectedCodeDetails.notes}</p>
                          </div>
                        )}
                        {/* Guidelines */}
                        {"guidelines" in selectedCodeDetails && selectedCodeDetails.guidelines && selectedCodeDetails.guidelines.length > 0 && (
                          <div className="rounded-lg border border-brand-100 bg-brand-50 p-2">
                            <p className="text-[9px] font-semibold text-brand-600 mb-1">📋 Official Guidelines</p>
                            <ul className="list-disc pl-4 text-[10px] text-brand-700 space-y-0.5">
                              {selectedCodeDetails.guidelines.map((g, i) => <li key={i}>{g}</li>)}
                            </ul>
                          </div>
                        )}
                        {/* Excludes / Code First */}
                        {"excludes1" in selectedCodeDetails && selectedCodeDetails.excludes1 && selectedCodeDetails.excludes1.length > 0 && (
                          <div className="rounded-lg border border-red-100 bg-red-50 p-2">
                            <p className="text-[9px] font-semibold text-red-600 mb-1">⛔ Excludes1 (mutually exclusive)</p>
                            <p className="text-[10px] text-red-700">{selectedCodeDetails.excludes1.join(", ")}</p>
                          </div>
                        )}
                        {"excludes2" in selectedCodeDetails && selectedCodeDetails.excludes2 && selectedCodeDetails.excludes2.length > 0 && (
                          <div className="rounded-lg border border-amber-100 bg-amber-50 p-2">
                            <p className="text-[9px] font-semibold text-amber-600 mb-1">⚠️ Excludes2 (can code both)</p>
                            <p className="text-[10px] text-amber-700">{selectedCodeDetails.excludes2.join(", ")}</p>
                          </div>
                        )}
                        {"codeFirst" in selectedCodeDetails && selectedCodeDetails.codeFirst && (
                          <div className="rounded-lg border border-brand-100 bg-brand-50 p-2">
                            <p className="text-[9px] font-semibold text-brand-600 mb-1">🔝 Code First</p>
                            <p className="text-[10px] text-brand-700">{selectedCodeDetails.codeFirst}</p>
                          </div>
                        )}
                        {"useAdditional" in selectedCodeDetails && selectedCodeDetails.useAdditional && selectedCodeDetails.useAdditional.length > 0 && (
                          <div className="rounded-lg border border-brand-100 bg-brand-50 p-2">
                            <p className="text-[9px] font-semibold text-brand-600 mb-1">➕ Use Additional Code</p>
                            <p className="text-[10px] text-brand-700">{selectedCodeDetails.useAdditional.join(", ")}</p>
                          </div>
                        )}
                        {"laterality" in selectedCodeDetails && selectedCodeDetails.laterality && selectedCodeDetails.laterality !== "none" && (
                          <div className="rounded-lg border border-brand-100 bg-brand-50 p-2">
                            <p className="text-[9px] font-semibold text-brand-600 mb-1">🔵 Laterality: {selectedCodeDetails.laterality}</p>
                          </div>
                        )}
                        {"globalDays" in selectedCodeDetails && selectedCodeDetails.globalDays !== undefined && (
                          <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                            <p className="text-[9px] font-semibold text-slate-600">Global Surgery Period: {selectedCodeDetails.globalDays} days</p>
                          </div>
                        )}
                      </div>
                      {/* Footer */}
                      <div className="border-t border-slate-100 p-3 text-center">
                        <p className="text-[9px] text-slate-400">Reference: {"chapter" in selectedCodeDetails ? "ICD-10-CM Official Guidelines" : "AMA CPT Professional Edition"}</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Conventions Panel */}
            {showConventions && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" /> Coding Conventions — Educational Reference
                </p>
                {CONVENTIONS.map((c) => (
                  <div key={c.title} className={`rounded-lg border p-3 text-xs ${c.color}`}>
                    <p className="font-semibold">{c.title}</p>
                    <p className="mt-0.5 opacity-80">{c.desc}</p>
                  </div>
                ))}
                <div className="mt-3 rounded-lg bg-brand-50 border border-brand-200 p-3">
                  <p className="text-[10px] font-semibold text-brand-700 mb-1"> Coding Tip</p>
                  <p className="text-[10px] text-brand-600">Always code the definitive diagnosis over symptoms. When a definitive diagnosis is established, do not code the symptom that led to it — unless the symptom is a separate condition.</p>
                </div>
              </div>
            )}

            {/* Submit to Billing — or Success View */}
            {submitted ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="rounded-full bg-green-100 p-4">
                  <CheckCircle2 className="h-10 w-10 text-green-600" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-800">Codes Submitted to Billing!</h3>
                <p className="mt-2 text-sm text-slate-500">
                  The coded encounter has been sent to the Medical Biller for claim processing.
                </p>
                {codingScore !== null && (
                  <div className="mt-2 flex items-center gap-1.5 text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5 text-xs">
                    <Star className="h-3.5 w-3.5" />
                    Coder Score: <strong>{codingScore}/25</strong>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-3 justify-center">
                  <div className="rounded-lg bg-green-50 border border-green-200 p-2">
                    <p className="text-[10px] font-medium text-green-700">ICD-10 Codes ({selectedICDs.length})</p>
                    <p className="text-xs text-green-600">{selectedICDs.map(c => c.code).join(", ")}</p>
                  </div>
                  <div className="rounded-lg bg-brand-50 border border-brand-200 p-2">
                    <p className="text-[10px] font-medium text-brand-700">CPT Codes ({selectedCPTs.length})</p>
                    <p className="text-xs text-brand-600">{selectedCPTs.map(c => c.code).join(", ")}</p>
                  </div>
                  {totalCharges > 0 && (
                    <div className="rounded-lg bg-brand-50 border border-brand-200 p-2">
                      <p className="text-[10px] font-medium text-brand-700">Total Charges</p>
                      <p className="text-xs text-brand-600">${totalCharges.toFixed(2)}</p>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setRole("biller")}
                  className="mt-4 flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
                >
                  <ArrowRight className="h-4 w-4" />
                  Switch to Biller Role
                </button>
              </div>
            ) : (<>
              {selectedICDs.length > 0 && selectedCPTs.length > 0 && (
                <button
                  onClick={handleSubmitToBilling}
                  {...readOnlyAttrs(readOnly)}
                  className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-xs font-medium text-white hover:bg-brand-600 transition-colors"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Submit Coded Encounter to Billing ({selectedICDs.length} ICD-10, {selectedCPTs.length} CPT)
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </>)}
          </div>

          {/* ─── Right Sidebar: E/M Calculator ─── */}
          <div className="hidden w-64 border-l border-slate-200 bg-slate-50 p-4 lg:block overflow-y-auto">
            <div className="flex items-center gap-1.5 mb-3">
              <Info className="h-3.5 w-3.5 text-brand-500" />
              <span className="text-[10px] font-semibold text-slate-500">E/M Level Calculator</span>
            </div>
            <div className="space-y-3">
              <div>
                <label htmlFor="em-patient-type" className="text-[10px] text-slate-500">Patient Type</label>
                <select
                  id="em-patient-type"
                  value={emPatientType}
                  onChange={(e) => setEmPatientType(e.target.value === "new" ? "new" : "established")}
                  className="min-h-[40px] w-full rounded border border-slate-200 px-2 py-1 text-[10px]"
                >
                  <option value="established">Established patient</option>
                  <option value="new">New patient</option>
                </select>
              </div>
              <div>
                <label htmlFor="em-problems" className="text-[10px] text-slate-500">Problems Addressed</label>
                <input
                  id="em-problems"
                  type="range"
                  min="1"
                  max="4"
                  value={emProblems}
                  onChange={(e) => setEmProblems(Number(e.target.value))}
                  aria-label="Problems addressed — 1 minimal, 2 low, 3 moderate, 4 high"
                  className="w-full accent-brand-500"
                />
                <span className="text-[10px] text-slate-400">{emProblems}</span>
              </div>
              <div>
                <label htmlFor="em-data" className="text-[10px] text-slate-500">Data Reviewed</label>
                <input
                  id="em-data"
                  type="range"
                  min="1"
                  max="4"
                  value={emData}
                  onChange={(e) => setEmData(Number(e.target.value))}
                  aria-label="Data reviewed — 1 minimal, 2 limited, 3 moderate, 4 extensive"
                  className="w-full accent-brand-500"
                />
                <span className="text-[10px] text-slate-400">{emData}</span>
              </div>
              <div>
                <label htmlFor="em-risk" className="text-[10px] text-slate-500">Risk Level</label>
                <select
                  id="em-risk"
                  value={emRisk}
                  onChange={(e) => setEmRisk(e.target.value)}
                  className="min-h-[40px] w-full rounded border border-slate-200 px-2 py-1 text-[10px]"
                >
                  <option>Minimal</option>
                  <option>Low</option>
                  <option>Moderate</option>
                  <option>High</option>
                </select>
              </div>
              <div className="rounded-lg bg-white p-3 text-center shadow-sm">
                <p className="text-[10px] text-slate-400">Recommended Code</p>
                <p className="text-xl font-bold text-brand-600">{emLevel.code}</p>
                <p className="text-[10px] text-slate-500">{emLevel.name}</p>
                <p className="mt-1 text-[9px] text-slate-400">Two of three MDM elements met</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <Search className="mb-2 h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-400">Waiting for charted encounter...</p>
          <p className="text-xs text-slate-300">Complete charting in Scribe role first</p>
        </div>
      )}
    </div>
  );
}

function Lock({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}