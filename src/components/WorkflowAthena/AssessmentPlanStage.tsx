/**
 * AssessmentPlanStage — SOAP Note with One-Click Macros
 *
 * Inspiration: DrChrono's SOAP note editor with structured
 * quadrant layout and Athenahealth's assessment/plan workflow.
 * DrChrono organizes notes into Subjective, Objective, Assessment,
 * and Plan quadrants with a sidebar of "Smart Phrases" (macros)
 * that auto-populate common clinical phrases. This component
 * replicates that pattern for rapid clinical documentation.
 */

import { useState, useEffect, useMemo } from "react";
import {
  ClipboardCheck,
  FileText,
  MessageSquare,
  Stethoscope,
  Lightbulb,
  Plus,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import { ICD10_CODES, searchICD10 } from "../CodingQueue/icd10Data";
import type { ICD10Code } from "../CodingQueue/icd10Data";

// ─── One-Click Macros ──────────────────────────────────────────────

interface MacroCategory {
  label: string;
  macros: { label: string; text: string }[];
}

const MACRO_CATEGORIES: MacroCategory[] = [
  {
    label: "Assessment Phrases",
    macros: [
      { label: "Well-controlled", text: "Patient's condition appears well-controlled on current regimen." },
      { label: "Stable", text: "Condition remains stable. No acute changes identified." },
      { label: "Improving", text: "Patient reports improvement since last visit. Tolerating treatment well." },
      { label: "Worsening", text: "Condition has worsened since last evaluation. Discussed treatment options." },
      { label: "Unchanged", text: "Condition unchanged from previous assessment." },
    ],
  },
  {
    label: "Plan Phrases",
    macros: [
      { label: "Continue Meds", text: "Continue current medication regimen as prescribed." },
      { label: "Lifestyle Mod", text: "Discussed lifestyle modifications including diet, exercise, and smoking cessation." },
      { label: "Follow-up", text: "Patient to follow up in clinic in [X] weeks or sooner if symptoms worsen." },
      { label: "Labs Ordered", text: "Ordered lab work to be completed prior to next visit." },
      { label: "Referral", text: "Placed referral to specialist for further evaluation." },
    ],
  },
  {
    label: "Common Diagnoses",
    macros: [
      { label: "HTN", text: "Essential hypertension (I10) — continues to require management." },
      { label: "DM2", text: "Type 2 diabetes mellitus (E11.9) — monitoring blood glucose control." },
      { label: "Hyperlipidemia", text: "Mixed hyperlipidemia (E78.2) — on statin therapy." },
      { label: "Asthma", text: "Persistent asthma (J45.40) — using maintenance inhaler." },
      { label: "CHF", text: "Congestive heart failure (I50.9) — monitoring volume status." },
    ],
  },
  {
    label: "Disposition",
    macros: [
      { label: "D/C Home", text: "Discharged home in stable condition. Follow-up precautions reviewed." },
      { label: "Admit", text: "Admitting to [floor/service] for further management." },
      { label: "RTC prn", text: "Return to clinic as needed. Educated on signs/symptoms requiring urgent evaluation." },
    ],
  },
];

// ─── SOAP Note Data ───────────────────────────────────────────────

export interface SoapNoteData {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  selectedICDs?: ICD10Code[];
}

// ─── Component ─────────────────────────────────────────────────────

interface AssessmentPlanStageProps {
  patientName?: string;
  note?: SoapNoteData;
  onNoteChange?: (note: SoapNoteData) => void;
}

export function AssessmentPlanStage({ patientName, note, onNoteChange }: AssessmentPlanStageProps) {
  const [showMacros, setShowMacros] = useState(true);
  const [activeMacroCategory, setActiveMacroCategory] = useState(0);
  const [lastInserted, setLastInserted] = useState("");

  // Use lifted note if provided, otherwise use local fallback state
  const [localFallback, setLocalFallback] = useState<SoapNoteData>({
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
  });

  const currentNote = note ?? localFallback;

  const updateNote = (updated: SoapNoteData) => {
    if (onNoteChange) {
      onNoteChange(updated);
    } else {
      setLocalFallback(updated);
    }
  };

  const updateField = (field: keyof SoapNoteData, value: string) => {
    const updated = { ...currentNote, [field]: value };
    updateNote(updated);
  };

  const insertMacro = (text: string, field: keyof SoapNoteData) => {
    const updated = {
      ...currentNote,
      [field]: currentNote[field] + (currentNote[field] ? "\n\n" : "") + text,
    };
    updateNote(updated);
    setLastInserted(text);
    setTimeout(() => setLastInserted(""), 2000);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-800">Assessment & Plan</h3>
          <p className="text-sm text-slate-500">
            {patientName ? `SOAP note for ${patientName}` : "Structured SOAP note"}
          </p>
        </div>
        <button
          onClick={() => setShowMacros(!showMacros)}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            showMacros
              ? "bg-blue-100 text-blue-700"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <Lightbulb className="h-3.5 w-3.5" />
          One-Click Macros
        </button>
      </div>

      <div className="flex gap-4">
        {/* Main SOAP Note Area */}
        <div className="flex-1 space-y-3">
          {/* Subjective */}
          <div className="clinical-card">
            <div className="mb-2 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                Subjective (S)
              </span>
              {showMacros && (
                <button
                  onClick={() => insertMacro("Patient reports... ", "subjective")}
                  className="ml-auto rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 hover:bg-blue-100"
                >
                  + Macro
                </button>
              )}
            </div>
            <textarea
              value={currentNote.subjective}
              onChange={(e) => updateField("subjective", e.target.value)}
              placeholder="Patient's report of symptoms, chief complaint, HPI, review of systems..."
              className="min-h-[120px] w-full resize-y rounded border border-slate-200 p-2.5 text-sm text-slate-700 placeholder-slate-300 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            />
          </div>

          {/* Objective */}
          <div className="clinical-card">
            <div className="mb-2 flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-green-600" />
              <span className="text-xs font-semibold uppercase tracking-wider text-green-600">
                Objective (O)
              </span>
              {showMacros && (
                <button
                  onClick={() => insertMacro("Vitals: BP [X]/[Y], HR [Z], Temp [T], SpO2 [S]%\nExam: ", "objective")}
                  className="ml-auto rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 hover:bg-blue-100"
                >
                  + Macro
                </button>
              )}
            </div>
            <textarea
              value={currentNote.objective}
              onChange={(e) => updateField("objective", e.target.value)}
              placeholder="Vital signs, physical exam findings, lab results, imaging..."
              className="min-h-[120px] w-full resize-y rounded border border-slate-200 p-2.5 text-sm text-slate-700 placeholder-slate-300 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            />
          </div>

          {/* Assessment */}
          <div className="clinical-card">
            <div className="mb-2 flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                Assessment (A)
              </span>
              {showMacros && (
                <button
                  onClick={() => insertMacro("", "assessment")}
                  className="ml-auto rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 hover:bg-blue-100"
                >
                  + Macro
                </button>
              )}
            </div>
            <textarea
              value={currentNote.assessment}
              onChange={(e) => updateField("assessment", e.target.value)}
              placeholder="Diagnoses, differentials, clinical impression, problem list updates..."
              className="min-h-[120px] w-full resize-y rounded border border-slate-200 p-2.5 text-sm text-slate-700 placeholder-slate-300 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            />

            {/* ICD-10 Code Search & Selection */}
            <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50/30 p-2.5">
              <div className="flex items-center gap-1.5 mb-2">
                <Search className="h-3 w-3 text-amber-600" />
                <span className="text-[10px] font-semibold text-amber-700">ICD-10 Diagnosis Codes</span>
                <span className="text-[9px] text-amber-500">(attach codes to assessment)</span>
              </div>
              <ICDSearchField
                selectedICDs={currentNote.selectedICDs ?? []}
                onSelect={(code) => {
                  const existing = currentNote.selectedICDs ?? [];
                  if (!existing.find(c => c.code === code.code)) {
                    updateNote({ ...currentNote, selectedICDs: [...existing, code] });
                  }
                }}
                onRemove={(code) => {
                  updateNote({ ...currentNote, selectedICDs: (currentNote.selectedICDs ?? []).filter(c => c.code !== code.code) });
                }}
              />
            </div>
          </div>

          {/* Plan */}
          <div className="clinical-card">
            <div className="mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-600">
                Plan (P)
              </span>
              {showMacros && (
                <button
                  onClick={() => insertMacro("", "plan")}
                  className="ml-auto rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 hover:bg-blue-100"
                >
                  + Macro
                </button>
              )}
            </div>
            <textarea
              value={currentNote.plan}
              onChange={(e) => updateField("plan", e.target.value)}
              placeholder="Medication changes, orders, referrals, follow-up plan, patient education..."
              className="min-h-[120px] w-full resize-y rounded border border-slate-200 p-2.5 text-sm text-slate-700 placeholder-slate-300 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            />
          </div>
        </div>

        {/* One-Click Macros Sidebar */}
        {showMacros && (
          <aside className="w-64 shrink-0">
            <div className="clinical-card">
              <div className="mb-2 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Macros
                </span>
              </div>

              {/* Category tabs */}
              <div className="mb-2 flex flex-wrap gap-1">
                {MACRO_CATEGORIES.map((cat, i) => (
                  <button
                    key={cat.label}
                    onClick={() => setActiveMacroCategory(i)}
                    className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                      i === activeMacroCategory
                        ? "bg-blue-100 text-blue-700"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Macro items */}
              <div className="space-y-1">
                {MACRO_CATEGORIES[activeMacroCategory].macros.map((macro) => (
                  <div
                    key={macro.label}
                    className="group cursor-pointer rounded-lg border border-slate-200 p-2 transition-colors hover:border-blue-300 hover:bg-blue-50"
                    onClick={() => {
                      // Insert into Assessment by default, or pop up a selector
                      insertMacro(macro.text, "assessment");
                    }}
                    title={`Click to insert: "${macro.text}"`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Plus className="h-3 w-3 shrink-0 text-blue-400 opacity-0 transition-opacity group-hover:opacity-100" />
                      <span className="text-xs font-medium text-slate-700">
                        {macro.label}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[10px] text-slate-400">
                      {macro.text}
                    </p>
                  </div>
                ))}
              </div>

              {/* Last inserted indicator */}
              {lastInserted && (
                <div className="mt-2 rounded bg-green-50 px-2 py-1 text-[10px] text-green-700">
                  Inserted into Assessment
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

// ─── ICD-10 Search Autocomplete Component ───────────────────────────

interface ICDSearchFieldProps {
  selectedICDs: ICD10Code[];
  onSelect: (code: ICD10Code) => void;
  onRemove: (code: ICD10Code) => void;
}

function ICDSearchField({ selectedICDs, onSelect, onRemove }: ICDSearchFieldProps) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return ICD10_CODES.filter(c =>
      c.code.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [query]);

  return (
    <div>
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search ICD-10 by code or description..."
          className="w-full rounded-md border border-slate-200 py-1.5 pl-7 pr-3 text-[10px] outline-none focus:border-amber-400"
        />
      </div>
      {query && results.length > 0 && (
        <div className="mt-1 max-h-32 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-sm">
          {results.map((code) => {
            const alreadySelected = selectedICDs.some(c => c.code === code.code);
            return (
              <button
                key={code.code}
                onClick={() => {
                  if (!alreadySelected) onSelect(code);
                  setQuery("");
                }}
                disabled={alreadySelected}
                className={`flex w-full items-center justify-between px-2 py-1.5 text-left text-[10px] border-b border-slate-50 last:border-0 ${
                  alreadySelected ? "text-slate-300 cursor-not-allowed" : "hover:bg-amber-50 text-slate-700"
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-mono font-semibold text-amber-700 shrink-0">{code.code}</span>
                  <span className="truncate">{code.description}</span>
                </div>
                <span className="text-[9px] text-slate-400 shrink-0 ml-1">{code.chapter}</span>
              </button>
            );
          })}
        </div>
      )}
      {query && results.length === 0 && (
        <p className="mt-1 text-[9px] text-slate-400">No matching ICD-10 codes found</p>
      )}
      {/* Selected codes as removable tags */}
      {selectedICDs.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {selectedICDs.map((code) => (
            <span key={code.code} className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-800">
              <span className="font-mono">{code.code}</span>
              <span className="max-w-[120px] truncate">{code.description}</span>
              <button onClick={() => onRemove(code)} className="text-amber-500 hover:text-amber-700">
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}