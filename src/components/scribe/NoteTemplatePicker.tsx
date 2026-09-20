/**
 * NoteTemplatePicker — chief-complaint note templates
 *
 * Inspiration: Epic's SmartPhrases / NoteWriter and Athenahealth's chief-
 * complaint driven documentation. Offers the seven `CHIEF_COMPLAINT_TEMPLATES`
 * so a scribe can pre-fill a full SOAP skeleton (HPI / ROS / exam / assessment /
 * plan) for the active visit, then edit each section to match the actual
 * findings. Templates map to the graded medical cases (`templateForCase`).
 */

import { useEffect, useState } from "react";
import { BookOpen, FileText, Lightbulb, Sparkles } from "lucide-react";
import {
  CHIEF_COMPLAINT_TEMPLATES,
  templateForCase,
  type ChiefComplaintTemplate,
} from "../../data/medical";
import { ICD10_CODES, type ICD10Code } from "../CodingQueue/icd10Data";
import type { SoapNoteData } from "../WorkflowAthena/AssessmentPlanStage";

export interface NoteTemplatePickerProps {
  /** Optional MCASE-00X id — when present, pre-selects via `templateForCase`. */
  caseId?: string;
  /** Fallback pre-selection when no case id is available. */
  chiefComplaint?: string;
  onApply: (note: SoapNoteData) => void;
  onTemplateChange?: (template: ChiefComplaintTemplate) => void;
}

/** Resolve a template's diagnosis codes into ICD10Code objects for the A&P editor. */
function resolveIcds(t: ChiefComplaintTemplate): ICD10Code[] {
  const out: ICD10Code[] = [];
  for (const d of t.assessment) {
    const match = ICD10_CODES.find((c) => c.code === d.code);
    if (match) out.push(match);
  }
  return out;
}

/** Map a chief-complaint template to a full SOAP skeleton (all four quadrants). */
export function templateToSoapNote(t: ChiefComplaintTemplate): SoapNoteData {
  const subjective = [
    t.chiefComplaint,
    "",
    "HPI:",
    ...t.subjective.hpiPrompt.map((q) => `- ${q}`),
    "",
    "ROS: " + t.subjective.ros,
  ].join("\n");

  const objective = [
    "Vitals: " + t.objective.vitalsPrompt.join(" · "),
    "",
    "Exam:",
    t.objective.exam,
  ].join("\n");

  const assessment = [
    "Assessment:",
    ...t.assessment.map((d) => `${d.code} — ${d.label}`),
  ].join("\n");

  const plan = ["Plan:", ...t.plan.map((p, i) => `${i + 1}. ${p}`)].join("\n");

  return { subjective, objective, assessment, plan, selectedICDs: resolveIcds(t) };
}

/** Best-effort template match from a free-text chief complaint (no case id). */
function findTemplateForChiefComplaint(cc?: string): ChiefComplaintTemplate | undefined {
  const needle = (cc ?? "").toLowerCase().trim();
  if (!needle) return undefined;
  const exact = CHIEF_COMPLAINT_TEMPLATES.find((t) => t.chiefComplaint.toLowerCase() === needle);
  if (exact) return exact;

  const keywords = needle.split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  let best: ChiefComplaintTemplate | undefined;
  let bestScore = 0;
  for (const t of CHIEF_COMPLAINT_TEMPLATES) {
    const hay = `${t.title} ${t.chiefComplaint}`.toLowerCase();
    const score = keywords.reduce((acc, w) => acc + (hay.includes(w) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return bestScore > 0 ? best : undefined;
}

export function NoteTemplatePicker({
  caseId,
  chiefComplaint,
  onApply,
  onTemplateChange,
}: NoteTemplatePickerProps) {
  const [selectedId, setSelectedId] = useState<string>("");

  // Pre-select for the active case when a case id is known, else try to match
  // the patient's chief complaint.
  useEffect(() => {
    const pre = caseId
      ? templateForCase(caseId)
      : findTemplateForChiefComplaint(chiefComplaint);
    if (pre) setSelectedId(pre.id);
  }, [caseId, chiefComplaint]);

  const selected = CHIEF_COMPLAINT_TEMPLATES.find((t) => t.id === selectedId) ?? null;

  const applySelected = () => {
    if (!selected) return;
    onApply(templateToSoapNote(selected));
    onTemplateChange?.(selected);
  };

  return (
    <div className="clinical-card">
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-blue-600" />
        <span className="clinical-label">Note templates</span>
        <span className="status-badge is-info">7 chief complaints</span>
        <span className="ml-auto flex items-center gap-1 text-[10px] text-slate-400">
          <Sparkles className="h-3 w-3" /> pre-fills the SOAP note
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
        >
          <option value="" disabled>
            Choose a template…
          </option>
          {CHIEF_COMPLAINT_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={applySelected}
          disabled={!selected}
          className="btn-primary px-3 py-2 text-xs"
        >
          <FileText className="h-3.5 w-3.5" /> Load template
        </button>
      </div>

      {selected && (
        <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
          <p className="text-xs font-semibold text-slate-800">{selected.title}</p>
          <p className="mt-0.5 text-[11px] italic text-slate-600">“{selected.chiefComplaint}”</p>

          {selected.usesShortcodes.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1">
              <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                Uses:
              </span>
              {selected.usesShortcodes.map((sc) => (
                <span
                  key={sc}
                  className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-blue-700"
                >
                  {sc}
                </span>
              ))}
            </div>
          )}

          <div className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-500">
            <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
            <span>{selected.teachingNote}</span>
          </div>
        </div>
      )}
    </div>
  );
}
