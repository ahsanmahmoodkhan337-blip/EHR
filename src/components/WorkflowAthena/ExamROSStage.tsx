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

import { useState } from "react";
import { Stethoscope, FileText, CheckCircle2, XCircle } from "lucide-react";
import type { SoapNoteData } from "./AssessmentPlanStage";

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

// ─── Component ─────────────────────────────────────────────────────

interface ExamROSStageProps {
  patientName?: string;
  note?: SoapNoteData;
  onNoteChange?: (note: SoapNoteData) => void;
}

export function ExamROSStage({ patientName, note, onNoteChange }: ExamROSStageProps) {
  const [rosState, setRosState] = useState<Record<string, boolean | null>>({});
  const [examNotes, setExamNotes] = useState(note?.objective ?? "");

  const setStatus = (itemId: string, status: boolean | null) => {
    setRosState((prev) => {
      const updated = { ...prev, [itemId]: status };
      // Push objective changes up to parent on every ROS change
      if (onNoteChange && note) {
        const abnormalItems = Object.entries(updated)
          .filter(([, v]) => v === false)
          .map(([id]) => id);
        const rosSummary = abnormalItems.length > 0
          ? `Abnormal ROS findings: ${abnormalItems.join(", ")}. `
          : "All systems reviewed and normal. ";
        onNoteChange({ ...note, objective: rosSummary + examNotes });
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
      onNoteChange({ ...note, objective: "All systems reviewed and normal. " + examNotes });
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
                  <span className="ml-auto rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                    {abnormalCount} abnormal
                  </span>
                )}
                {allNormal && (
                  <span className="ml-auto rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
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
          <FileText className="h-4 w-4 text-blue-600" />
          <span className="clinical-label">Physical Exam Findings</span>
        </div>
        <textarea
          value={examNotes}
          onChange={(e) => {
            const newVal = e.target.value;
            setExamNotes(newVal);
            if (onNoteChange && note) {
              const abnormalItems = Object.entries(rosState)
                .filter(([, v]) => v === false)
                .map(([id]) => id);
              const rosSummary = abnormalItems.length > 0
                ? `Abnormal ROS findings: ${abnormalItems.join(", ")}. `
                : "All systems reviewed and normal. ";
              onNoteChange({ ...note, objective: rosSummary + newVal });
            }
          }}
          placeholder="Document physical exam findings here...\n\nExample:\n- General: Alert and oriented, in no acute distress\n- HEENT: Normocephalic, mucous membranes moist\n- CV: Regular rate and rhythm, no murmurs\n- Resp: Clear to auscultation bilaterally\n- Abd: Soft, non-tender, non-distended\n- MSK: Full range of motion all extremities\n- Neuro: CN II-XII intact, strength 5/5 all groups"
          className="min-h-[180px] w-full resize-y rounded-lg border border-slate-200 p-3 text-sm text-slate-700 placeholder-slate-300 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
        />
      </div>
    </div>
  );
}