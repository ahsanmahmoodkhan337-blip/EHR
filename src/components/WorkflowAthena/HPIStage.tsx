/**
 * HPIStage — History of Present Illness
 *
 * Inspiration: Athenahealth's HPI documentation workflow.
 * Athena presents HPI as a structured free-text field that
 * guides clinicians through the OLDCARTS mnemonic (Onset,
 * Location, Duration, Character, Aggravating factors,
 * Relieving factors, Timing, Severity). DrChrono provides
 * a simpler free-text approach. This component blends both
 * by offering a primary free-text area with an optional
 * OLDCARTS expandable template.
 *
 * The free-text area is a DotPhraseTextarea (Epic SmartPhrases /
 * eCW dot phrases) with an optional dictation mic (Web Speech API).
 */

import { useState, useEffect, useRef } from "react";
import { MessageSquare, ChevronDown, ChevronRight, Lightbulb, Mic, MicOff } from "lucide-react";
import type { SoapNoteData } from "./AssessmentPlanStage";
import { DotPhraseTextarea } from "../scribe/DotPhraseTextarea";
import { useDictation } from "../scribe/useDictation";

interface HPIStageProps {
  patientName?: string;
  chiefComplaint?: string;
  note?: SoapNoteData;
  onNoteChange?: (note: SoapNoteData) => void;
}

export function HPIStage({ patientName, chiefComplaint, note, onNoteChange }: HPIStageProps) {
  const [hpiText, setHpiText] = useState(note?.subjective ?? "");
  const [showTemplate, setShowTemplate] = useState(false);

  // Ref mirror of hpiText so the async dictation callback always appends to the
  // latest value (the speech callback closes over a render-scoped value).
  const hpiTextRef = useRef(hpiText);
  useEffect(() => {
    hpiTextRef.current = hpiText;
  }, [hpiText]);

  // Sync local state when note prop changes externally (e.g. patient switch, session restore)
  useEffect(() => {
    if (note && note.subjective !== undefined) {
      setHpiText(note.subjective);
    }
  }, [note?.subjective]);

  const dictation = useDictation((text) => {
    const prev = hpiTextRef.current;
    const next = prev + (prev && !/\s$/.test(prev) ? " " : "") + text;
    hpiTextRef.current = next;
    setHpiText(next);
    if (onNoteChange && note) {
      onNoteChange({ ...note, subjective: next });
    }
  });

  const oldcartsFields = [
    { label: "Onset", placeholder: "When did the symptoms begin?" },
    { label: "Location", placeholder: "Where is the symptom located?" },
    { label: "Duration", placeholder: "How long does it last?" },
    { label: "Character", placeholder: "Describe the quality/sensation" },
    { label: "Aggravating Factors", placeholder: "What makes it worse?" },
    { label: "Relieving Factors", placeholder: "What makes it better?" },
    { label: "Timing", placeholder: "Constant vs intermittent? Time of day?" },
    { label: "Severity", placeholder: "Rate severity 0-10. Effect on daily life?" },
  ];

  const [oldcartsValues, setOldcartsValues] = useState<Record<string, string>>({});

  const updateOldcarts = (label: string, value: string) => {
    setOldcartsValues((prev) => ({ ...prev, [label]: value }));
  };

  const buildFromOldcarts = () => {
    const parts = oldcartsFields
      .map((f) => {
        const val = oldcartsValues[f.label];
        return val ? `${f.label}: ${val}` : null;
      })
      .filter(Boolean);

    if (parts.length > 0) {
      const combined = parts.join("\n");
      setHpiText(combined);
      if (onNoteChange && note) {
        onNoteChange({ ...note, subjective: combined });
      }
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-800">History of Present Illness</h3>
          <p className="text-sm text-slate-500">
            {patientName ? `Documenting for ${patientName}` : "Document the patient's history"}
          </p>
        </div>
      </div>

      {/* Chief Complaint Reference */}
      {chiefComplaint && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-medium text-amber-700">Chief Complaint</p>
          <p className="text-sm text-amber-900">{chiefComplaint}</p>
        </div>
      )}

      {/* HPI Free-Text */}
      <div className="clinical-card flex flex-col">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-600" />
            <span className="clinical-label">HPI Narrative</span>
          </div>
          <div className="flex items-center gap-2">
            {dictation.supported && (
              <button
                type="button"
                onClick={() => (dictation.listening ? dictation.stop() : dictation.start())}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  dictation.listening
                    ? "bg-red-100 text-red-700 hover:bg-red-200"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
                title={dictation.listening ? "Stop dictation" : "Dictate into HPI"}
              >
                {dictation.listening ? (
                  <MicOff className="h-3.5 w-3.5" />
                ) : (
                  <Mic className="h-3.5 w-3.5" />
                )}
                {dictation.listening ? "Listening…" : "Dictate"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowTemplate(!showTemplate)}
              className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              <Lightbulb className="h-3.5 w-3.5" />
              OLDCARTS Template
              {showTemplate ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          </div>
        </div>

        {dictation.listening && (
          <p className="mb-2 flex items-center gap-1.5 rounded bg-blue-50 px-2 py-1 text-[11px] text-blue-700">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-600" />
            Dictating — speak clearly, then stop. Transcript appends to the note.
          </p>
        )}
        {dictation.error && (
          <p className="mb-2 rounded bg-red-50 px-2 py-1 text-[11px] text-red-700">
            {dictation.error}
          </p>
        )}

        <DotPhraseTextarea
          value={hpiText}
          onChange={(newVal) => {
            setHpiText(newVal);
            if (onNoteChange && note) {
              onNoteChange({ ...note, subjective: newVal });
            }
          }}
          section="HPI"
          placeholder={`Describe the history of present illness in narrative form.\n\nInclude: onset, location, duration, character, aggravating/relieving factors, timing, severity.\n\nExample: "${patientName || "Patient"} presents with chest pain that started 3 days ago. The pain is described as a dull ache, located substernally, rated 6/10 in severity. It is aggravated by exertion and partially relieved by rest. No associated shortness of breath or nausea."`}
          className="min-h-[250px] w-full resize-y rounded-lg border border-slate-200 p-3 text-sm text-slate-700 placeholder-slate-300 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
        />
      </div>

      {/* OLDCARTS Template (expandable) */}
      {showTemplate && (
        <div className="clinical-card">
          <div className="mb-2 flex items-center justify-between">
            <span className="clinical-label">OLDCARTS Mnemonic</span>
            <button
              onClick={buildFromOldcarts}
              className="rounded bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700 hover:bg-blue-100"
            >
              Build narrative from fields
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {oldcartsFields.map((field) => (
              <div key={field.label}>
                <label className="text-xs font-medium text-slate-500">{field.label}</label>
                <input
                  type="text"
                  value={oldcartsValues[field.label] || ""}
                  onChange={(e) => updateOldcarts(field.label, e.target.value)}
                  placeholder={field.placeholder}
                  className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-sm text-slate-700 placeholder-slate-300 outline-none focus:border-blue-400"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
