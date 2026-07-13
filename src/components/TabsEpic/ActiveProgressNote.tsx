/**
 * ActiveProgressNote — Functional Progress Note Editor
 *
 * Inspiration: Epic Hyperspace progress note editor.
 * Epic's note editor allows clinicians to write structured
 * clinical notes (SOAP, H&P, Progress Note) directly within
 * the chart. This component provides a fully functional SOAP
 * note editor with state management, save, preview, and
 * history features.
 */

import { useState } from "react";
import { FileEdit, Save, Eye, History, CheckCircle2 } from "lucide-react";
import { type SoapNoteData } from "../WorkflowAthena/AssessmentPlanStage";

interface ActiveProgressNoteProps {
  patientName?: string;
  soapNote?: SoapNoteData;
  onNoteChange?: (note: SoapNoteData) => void;
}

interface SavedNote {
  id: string;
  date: string;
  patientName: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  freeText: string;
}

export function ActiveProgressNote({ patientName, soapNote, onNoteChange }: ActiveProgressNoteProps) {
  const [localSubjective, setLocalSubjective] = useState("");
  const [localObjective, setLocalObjective] = useState("");
  const [localAssessment, setLocalAssessment] = useState("");
  const [localPlan, setLocalPlan] = useState("");
  const [freeText, setFreeText] = useState("");

  // Use controlled props if provided, otherwise local state
  const subjective = soapNote?.subjective ?? localSubjective;
  const objective = soapNote?.objective ?? localObjective;
  const assessment = soapNote?.assessment ?? localAssessment;
  const plan = soapNote?.plan ?? localPlan;

  const setSubjective = (v: string) => {
    if (soapNote && onNoteChange) {
      onNoteChange({ ...soapNote, subjective: v });
    } else {
      setLocalSubjective(v);
    }
  };
  const setObjective = (v: string) => {
    if (soapNote && onNoteChange) {
      onNoteChange({ ...soapNote, objective: v });
    } else {
      setLocalObjective(v);
    }
  };
  const setAssessment = (v: string) => {
    if (soapNote && onNoteChange) {
      onNoteChange({ ...soapNote, assessment: v });
    } else {
      setLocalAssessment(v);
    }
  };
  const setPlan = (v: string) => {
    if (soapNote && onNoteChange) {
      onNoteChange({ ...soapNote, plan: v });
    } else {
      setLocalPlan(v);
    }
  };

  const [saved, setSaved] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [savedNotes, setSavedNotes] = useState<SavedNote[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const handleSave = () => {
    const note: SavedNote = {
      id: `note-${Date.now()}`,
      date: new Date().toISOString(),
      patientName: patientName || "Unknown",
      subjective,
      objective,
      assessment,
      plan,
      freeText,
    };
    setSavedNotes((prev) => [note, ...prev]);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const hasContent = subjective || objective || assessment || plan || freeText;

  return (
    <div className="flex flex-1 flex-col p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileEdit className="h-5 w-5 text-blue-600" />
          <div>
            <h2 className="text-lg font-bold text-slate-800">Active Progress Note</h2>
            <p className="text-sm text-slate-500">
              {patientName ? `Encounter note for ${patientName}` : "No patient selected"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            <History className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">History ({savedNotes.length})</span>
          </button>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            <Eye className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{showPreview ? "Edit" : "Preview"}</span>
          </button>
          <button
            onClick={handleSave}
            disabled={!hasContent}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              saved
                ? "bg-green-500 text-white"
                : hasContent
                  ? "bg-blue-600 text-white hover:bg-blue-500"
                  : "bg-slate-300 text-slate-100 cursor-not-allowed"
            }`}
          >
            {saved ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{saved ? "Saved!" : "Save"}</span>
          </button>
        </div>
      </div>

      {/* Saved success banner */}
      {saved && (
        <div className="mb-3 rounded-lg bg-green-50 p-2 text-xs text-green-700 border border-green-200">
          <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
          Note saved successfully!
        </div>
      )}

      {/* History panel */}
      {showHistory && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-700 mb-3">Saved Notes History</p>
          {savedNotes.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No saved notes yet.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {savedNotes.map((n) => (
                <div key={n.id} className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-[10px]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-slate-600">{n.patientName}</span>
                    <span className="text-slate-400">{new Date(n.date).toLocaleString()}</span>
                  </div>
                  <p className="text-slate-500 truncate">
                    S: {n.subjective?.slice(0, 60) || "—"} | A: {n.assessment?.slice(0, 60) || "—"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Note Editor */}
      {showPreview ? (
        <div className="clinical-card flex flex-1 flex-col">
          <p className="text-xs font-semibold text-slate-700 mb-3">Note Preview</p>
          <div className="space-y-3 text-sm">
            {subjective && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">Subjective</p>
                <p className="text-slate-700 whitespace-pre-wrap">{subjective}</p>
              </div>
            )}
            {objective && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-green-600 mb-1">Objective</p>
                <p className="text-slate-700 whitespace-pre-wrap">{objective}</p>
              </div>
            )}
            {assessment && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 mb-1">Assessment</p>
                <p className="text-slate-700 whitespace-pre-wrap">{assessment}</p>
              </div>
            )}
            {plan && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-purple-600 mb-1">Plan</p>
                <p className="text-slate-700 whitespace-pre-wrap">{plan}</p>
              </div>
            )}
            {freeText && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Additional Notes</p>
                <p className="text-slate-700 whitespace-pre-wrap">{freeText}</p>
              </div>
            )}
            {!hasContent && (
              <p className="text-sm text-slate-400 italic">No content to preview. Start typing in the editor.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="clinical-card flex flex-1 flex-col">
          {/* Note metadata bar */}
          <div className="mb-3 flex flex-wrap gap-4 border-b border-slate-100 pb-3 text-xs text-slate-500">
            <div>
              <span className="font-medium text-slate-600">Date:</span>{" "}
              {new Date().toLocaleDateString()}
            </div>
            <div>
              <span className="font-medium text-slate-600">Author:</span> Dr. Resident
            </div>
            <div>
              <span className="font-medium text-slate-600">Type:</span> Progress Note
            </div>
            <div>
              <span className="font-medium text-slate-600">Status:</span>{" "}
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">
                {hasContent ? "Draft" : "Empty"}
              </span>
            </div>
          </div>

          {/* SOAP Note Template */}
          <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            {/* Subjective */}
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-blue-600">
                Subjective (S)
              </p>
              <textarea
                value={subjective}
                onChange={(e) => setSubjective(e.target.value)}
                placeholder="Patient's chief complaint, history of present illness, review of systems..."
                className="min-h-[100px] w-full resize-none rounded border-0 bg-transparent text-sm text-slate-700 placeholder-slate-300 outline-none"
              />
            </div>

            {/* Objective */}
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-green-600">
                Objective (O)
              </p>
              <textarea
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="Vital signs, physical exam findings, lab/imaging results..."
                className="min-h-[100px] w-full resize-none rounded border-0 bg-transparent text-sm text-slate-700 placeholder-slate-300 outline-none"
              />
            </div>

            {/* Assessment */}
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-600">
                Assessment (A)
              </p>
              <textarea
                value={assessment}
                onChange={(e) => setAssessment(e.target.value)}
                placeholder="Diagnoses, differentials, clinical impression..."
                className="min-h-[100px] w-full resize-none rounded border-0 bg-transparent text-sm text-slate-700 placeholder-slate-300 outline-none"
              />
            </div>

            {/* Plan */}
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-purple-600">
                Plan (P)
              </p>
              <textarea
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                placeholder="Medication changes, orders, referrals, follow-up plan..."
                className="min-h-[100px] w-full resize-none rounded border-0 bg-transparent text-sm text-slate-700 placeholder-slate-300 outline-none"
              />
            </div>
          </div>

          {/* Free text area */}
          <div className="flex-1 rounded-lg border border-slate-200 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Free-Text Notes
            </p>
            <textarea
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="Additional notes, instructions, follow-up details..."
              className="min-h-[80px] w-full resize-none rounded border-0 bg-transparent text-sm text-slate-700 placeholder-slate-300 outline-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}