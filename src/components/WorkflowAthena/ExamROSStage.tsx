/**
 * ExamROSStage — Review of Systems / Exam Findings
 *
 * Inspiration: Athenahealth and DrChrono ROS checklists.
 * Athena provides a comprehensive, body-system-based Review of
 * Systems with checkboxes for normal/abnormal findings. DrChrono
 * offers a more streamlined exam findings interface. This component
 * blends both approaches with a categorized checkbox grid and
 * free-text exam notes.
 */

import { useState, useEffect, useRef } from "react";
import { Stethoscope, FileText, CheckCircle2, XCircle } from "lucide-react";
import type { SoapNoteData } from "./AssessmentPlanStage";
import { DotPhraseTextarea } from "../scribe/DotPhraseTextarea";
import { PhysicalExamMatrix } from "../scribe/PhysicalExamMatrix";

// ─── ROS System Definitions ────────────────────────────────────────

interface RosSystem {
  id: string;
  label: string;
  systems: RosItem[];
}

interface RosItem {
  id: string;
  label: string;
  normal?: boolean;
}

const ROS_SYSTEMS: RosSystem[] = [
  {
    id: "general",
    label: "General / Constitutional",
    systems: [
      { id: "gen-fever", label: "Fever/Chills" },
      { id: "gen-fatigue", label: "Fatigue" },
      { id: "gen-weight", label: "Weight changes" },
      { id: "gen-night", label: "Night sweats" },
    ],
  },
  {
    id: "cv",
    label: "Cardiovascular",
    systems: [
      { id: "cv-chest", label: "Chest pain/pressure" },
      { id: "cv-palp", label: "Palpitations" },
      { id: "cv-edema", label: "Edema" },
      { id: "cv-doe", label: "Dyspnea on exertion" },
      { id: "cv-pnd", label: "Paroxysmal nocturnal dyspnea" },
    ],
  },
  {
    id: "resp",
    label: "Respiratory",
    systems: [
      { id: "resp-cough", label: "Cough" },
      { id: "resp-wheeze", label: "Wheezing" },
      { id: "resp-sob", label: "Shortness of breath" },
      { id: "resp-sputum", label: "Sputum production" },
      { id: "resp-hemoptysis", label: "Hemoptysis" },
    ],
  },
  {
    id: "gi",
    label: "Gastrointestinal",
    systems: [
      { id: "gi-nausea", label: "Nausea/Vomiting" },
      { id: "gi-diarrhea", label: "Diarrhea" },
      { id: "gi-constipation", label: "Constipation" },
      { id: "gi-abd", label: "Abdominal pain" },
      { id: "gi-bleed", label: "GI bleeding" },
    ],
  },
  {
    id: "msk",
    label: "Musculoskeletal",
    systems: [
      { id: "msk-joint", label: "Joint pain/swelling" },
      { id: "msk-muscle", label: "Muscle pain" },
      { id: "msk-back", label: "Back pain" },
      { id: "msk-stiffness", label: "Morning stiffness" },
    ],
  },
  {
    id: "neuro",
    label: "Neurological",
    systems: [
      { id: "neuro-headache", label: "Headache" },
      { id: "neuro-dizzy", label: "Dizziness" },
      { id: "neuro-numbness", label: "Numbness/Tingling" },
      { id: "neuro-weakness", label: "Weakness" },
      { id: "neuro-vision", label: "Vision changes" },
    ],
  },
  {
    id: "psych",
    label: "Psychiatric",
    systems: [
      { id: "psych-anxiety", label: "Anxiety" },
      { id: "psych-depression", label: "Depression" },
      { id: "psych-sleep", label: "Sleep disturbance" },
      { id: "psych-memory", label: "Memory changes" },
    ],
  },
];

/** The prefix this stage adds to the student's own exam text. */
const ROS_PREFIX = /^(?:All systems reviewed and normal\.\s*|Abnormal ROS findings:[^.]*\.\s*)/;

const ROS_LABELS: Record<string, string> = Object.fromEntries(
  ROS_SYSTEMS.flatMap((system) => system.systems.map((item) => [item.id, item.label.toLowerCase()])),
);
const ROS_ITEM_COUNT = Object.keys(ROS_LABELS).length;

/**
 * The ROS line for the findings checked so far, in plain words — or "" when
 * nothing has been reviewed. The review of systems is what the patient reports,
 * so it belongs to the Subjective, not the Objective (the exam). It used to be
 * written into Objective with the checklist's internal ids ("gi-abd").
 */
export function rosLineFor(state: Record<string, boolean | null>): string {
  const reviewed = Object.entries(state).filter(([, v]) => v === true || v === false);
  if (reviewed.length === 0) return "";
  const positives = reviewed.filter(([, v]) => v === false).map(([id]) => ROS_LABELS[id] ?? id);
  const allReviewed = reviewed.length >= ROS_ITEM_COUNT;
  const rest = allReviewed ? "All other systems reviewed and negative." : "Other systems reviewed are negative.";
  if (positives.length === 0) {
    return allReviewed ? "ROS: All systems reviewed and negative." : "ROS: Systems reviewed are negative.";
  }
  return `ROS: Positive for ${positives.join(", ")}. ${rest}`;
}

/** The ROS line this stage keeps at the end of the Subjective. */
const ROS_LINE = /(?:\n+|^)ROS: [^\n]*$/;

/** The Subjective with its ROS line replaced by `line` (removed when empty). */
export function withRosLine(subjective: string, line: string): string {
  const body = (subjective ?? "").replace(ROS_LINE, "").replace(/\s+$/, "");
  if (!line) return body;
  return body ? `${body}\n\n${line}` : line;
}

/** The student's own words, without a prefix this stage (or an old save) added. */
export function stripRosPrefix(objective: string): string {
  return (objective ?? "").replace(ROS_PREFIX, "");
}

// ─── Component ─────────────────────────────────────────────────────

interface ExamROSStageProps {
  patientName?: string;
  note?: SoapNoteData;
  onNoteChange?: (note: SoapNoteData) => void;
  vitals?: { bp: string; hr: string; temp: string; rr: string; o2: string };
}

export function ExamROSStage({ patientName, note, onNoteChange, vitals }: ExamROSStageProps) {
  const [rosState, setRosState] = useState<Record<string, boolean | null>>({});
  /**
   * The free-text exam findings WITHOUT the ROS summary prefix.
   *
   * This is the dropped-keystrokes fix (spec `slice-note-behaves.md`, first
   * section). Before: every keystroke wrote `rosSummary + newVal` into
   * `note.objective`, the sync effect below copied `note.objective` straight back
   * into this textarea, and the prefix therefore re-accumulated on every render
   * while the caret jumped to the end — the student's typing looked like it was
   * losing characters. Now:
   *   - the textarea holds the body only, and the prefix is added once, on the
   *     way up to the parent;
   *   - `lastEmitted` remembers what we last sent, so our own write echoed back
   *     through the prop is NOT re-applied (no re-render, no caret jump, no
   *     doubling);
   *   - a note restored from the record has its prefix stripped before it is
   *     shown, so an old save cannot double its prefix on the next keystroke.
   */
  const [examNotes, setExamNotes] = useState(() => stripRosPrefix(note?.objective ?? ""));
  const lastEmitted = useRef<string | null>(null);

  // Sync local examNotes when the note changes for a reason of its own (patient
  // switch, session restore) — never for the echo of what we just wrote.
  useEffect(() => {
    const incoming = note?.objective;
    if (incoming === undefined) return;
    if (incoming === lastEmitted.current) return;
    setExamNotes(stripRosPrefix(incoming));
  }, [note?.objective]);

  // Commit the free-text exam findings (with a ROS summary prefix) up to the parent.
  const commitExamText = (newVal: string) => {
    setExamNotes(newVal);
    if (onNoteChange && note) {
      // The Objective holds the exam only; the ROS line lives in the Subjective.
      const objective = newVal;
      lastEmitted.current = objective;
      onNoteChange({ ...note, objective });
    }
  };

  const setStatus = (itemId: string, status: boolean | null) => {
    setRosState((prev) => {
      const updated = { ...prev, [itemId]: status };
      // Push objective changes up to parent on every ROS change
      if (onNoteChange && note) {
        const objective = examNotes;
        lastEmitted.current = objective;
        onNoteChange({ ...note, objective, subjective: withRosLine(note.subjective, rosLineFor(updated)) });
      }
      return updated;
    });
  };

  const markAllNormal = () => {
    const allNormal: Record<string, boolean | null> = {};
    ROS_SYSTEMS.forEach((system) => {
      system.systems.forEach((item) => {
        allNormal[item.id] = true;
      });
    });
    setRosState(allNormal);
    // Push to parent
    if (onNoteChange && note) {
      const objective = examNotes;
      lastEmitted.current = objective;
      onNoteChange({ ...note, objective, subjective: withRosLine(note.subjective, rosLineFor(allNormal)) });
    }
  };

  const getStatusIcon = (status: boolean | null) => {
    if (status === true) return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (status === false) return <XCircle className="h-4 w-4 text-red-500" />;
    return null;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-800">Review of Systems & Exam</h3>
          <p className="text-sm text-slate-500">
            {patientName ? `ROS for ${patientName}` : "Document systems review findings"}
          </p>
        </div>
        <button
          onClick={markAllNormal}
          className="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
        >
          Mark All Normal
        </button>
      </div>

      {/* ROS Grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {ROS_SYSTEMS.map((system) => {
          const abnormalCount = system.systems.filter(
            (item) => rosState[item.id] === false
          ).length;
          const allNormal = system.systems.every(
            (item) => rosState[item.id] === true
          );

          return (
            <div
              key={system.id}
              className={`clinical-card ${
                abnormalCount > 0
                  ? "border-red-200 bg-red-50/30"
                  : allNormal
                    ? "border-green-200 bg-green-50/30"
                    : ""
              }`}
            >
              <div className="mb-2 flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-slate-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {system.label}
                </span>
                {abnormalCount > 0 && (
                  <span className="ml-auto rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                    {abnormalCount} abnormal
                  </span>
                )}
                {allNormal && (
                  <span className="ml-auto rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
                    Normal
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {system.systems.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setStatus(
                          item.id,
                          rosState[item.id] === undefined
                            ? true
                            : rosState[item.id] === true
                              ? false
                              : null
                        )
                      }
                      className={`flex flex-1 items-center gap-2 rounded px-2 py-1 text-xs transition-colors ${
                        rosState[item.id] === undefined
                          ? "text-slate-500 hover:bg-slate-50"
                          : rosState[item.id] === true
                            ? "bg-green-50 text-green-700"
                            : "bg-red-50 text-red-700"
                      }`}
                    >
                      <span className="w-4 shrink-0">
                        {getStatusIcon(rosState[item.id] ?? null)}
                      </span>
                      <span>{item.label}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Exam Notes */}
      <div className="clinical-card">
        <div className="mb-2 flex items-center gap-2">
          <FileText className="h-4 w-4 text-brand-600" />
          <span className="clinical-label">Physical Exam Findings</span>
          <div className="ml-auto">
            <PhysicalExamMatrix onInsert={commitExamText} />
          </div>
        </div>
        <DotPhraseTextarea
          value={examNotes}
          onChange={commitExamText}
          section={["PE", "ROS"]}
          vitals={vitals}
          placeholder="Document physical exam findings here...\n\nExample:\n- General: Alert and oriented, in no acute distress\n- HEENT: Normocephalic, mucous membranes moist\n- CV: Regular rate and rhythm, no murmurs\n- Resp: Clear to auscultation bilaterally\n- Abd: Soft, non-tender, non-distended\n- MSK: Full range of motion all extremities\n- Neuro: CN II-XII intact, strength 5/5 all groups"
          className="min-h-[180px] w-full resize-y rounded-lg border border-slate-200 p-3 text-sm text-slate-700 placeholder-slate-300 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
        />
      </div>
    </div>
  );
}