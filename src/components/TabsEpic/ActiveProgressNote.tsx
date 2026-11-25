/**
 * ActiveProgressNote — the encounter's one note record, on the home workspace
 *
 * Inspiration: Epic Hyperspace's note editor, opened from the chart.
 *
 * The 19 November build kept its own copy of the note: a component-local
 * `savedNotes` array, a hardcoded author "Dr. Resident", today's date stamped on
 * a note that might have been signed weeks ago, a status pill it computed itself
 * and so could never know the note was signed, and a Free-Text box held outside
 * `SoapNoteData` so nothing typed in it was ever saved.
 *
 * This panel holds no note of its own. It reads and writes the same record the
 * Progress Note stages, Sign & Lock and `/charts` use (`writeNoteFor`), takes its
 * status from `noteStatus` (`NOTE_STATUS_LABEL`), locks with `noteReadOnly` the
 * moment the note is signed, dates it from the encounter's own date of service,
 * names the signer the store stamped on the `NOTE_SIGNED` event, and lists that
 * event's timeline so the history survives a refresh.
 */

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Eye, FileEdit, History } from "lucide-react";

import { usePipeline } from "../../store/pipelineStore";
import { skipNoteAutosave } from "../../domain/tutorialReadOnly";
import {
  NOTE_STATUS_LABEL,
  noteFieldsOf,
  noteReadOnly,
  noteSignedBy,
  noteStatus,
  type NoteFields,
} from "../../domain/noteStatus";
import { formatWhen } from "../../domain/homeWorkQueues";
import { useEncounterDateOfService } from "../../utils/encounterPatient";
import { localDay } from "../../utils/localDay";
import { actorLabel } from "../../utils/actorLabel";

export interface ActiveProgressNoteProps {
  /** The patient whose chart is open, or null when nobody is. */
  patient: { id: string; firstName: string; lastName: string } | null;
}

export function ActiveProgressNote({ patient }: ActiveProgressNoteProps) {
  const { getEncounter, writeNoteFor } = usePipeline();
  const patientId = patient?.id ?? null;
  const encounter = patientId ? getEncounter(patientId) : undefined;

  const status = noteStatus(encounter);
  const readOnly = noteReadOnly(encounter);
  const savedAt = encounter?.noteUpdatedAt ?? null;
  const signer = noteSignedBy(encounter);
  // The visit date: the chart's encounter, else the claim's line 1 date of
  // service, else the day the note was signed. The Tutorial Patient's note read
  // "Date: Not on file" beside a banner showing its service date.
  const chartDateOfService = useEncounterDateOfService(patientId);
  const claimDateOfService = encounter?.claimForm?.serviceLines?.find((l) => l.dateOfService)?.dateOfService;
  const signedDay = (encounter?.statusEvents ?? []).find((e) => e.reasonCode === "NOTE_SIGNED")?.at;
  const dateOfService =
    chartDateOfService || claimDateOfService || (signedDay ? localDay(signedDay) : null);
  const signedEvents = (encounter?.statusEvents ?? []).filter(
    (event) => event.reasonCode === "NOTE_SIGNED",
  );

  const [fields, setFields] = useState<NoteFields>(() => noteFieldsOf(encounter));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [showHistory, setShowHistory] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Load this patient's own note when the chart changes — never on a keystroke.
  useEffect(() => {
    setFields(noteFieldsOf(patientId ? getEncounter(patientId) : undefined));
    setSaveState("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(fields);
  latest.current = fields;

  /**
   * Write the note — unless this chart refuses student writes. The standard
   * reference chart's note is the worked example and is filled by the seed, so
   * an autosave there has nothing to save and must not report a refusal the
   * student never asked for.
   */
  const saveNote = (fields: NoteFields) => {
    if (!patientId || skipNoteAutosave(patientId)) return;
    if (writeNoteFor(patientId, fields)) setSaveState("saved");
  };

  const flush = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    saveNote(latest.current);
  };

  const edit = (key: keyof NoteFields, value: string) => {
    if (readOnly) return;
    const next = { ...fields, [key]: value };
    setFields(next);
    latest.current = next;
    setSaveState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      saveNote(next);
    }, 1200);
  };

  // Never leave an unsaved keystroke behind when the panel is left.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        saveNote(latest.current);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [patientId],
  );

  if (!patient || !patientId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <FileEdit className="h-10 w-10 text-slate-300" aria-hidden="true" />
        <h2 className="mt-3 text-lg font-bold text-slate-800">Active Progress Note</h2>
        <p className="mt-1 max-w-md text-sm text-slate-500">
          No patient open. Pick one from the Inbox on the left, or open an encounter from Home, and
          their note opens here.
        </p>
      </div>
    );
  }

  const field = (
    key: keyof NoteFields,
    label: string,
    placeholder: string,
    tone: string,
  ) => (
    <div className="rounded-lg border border-slate-200 p-2">
      <label
        htmlFor={`active-note-${key}`}
        className={`mb-1 block text-xs font-semibold uppercase tracking-wider ${tone}`}
      >
        {label}
      </label>
      <textarea
        id={`active-note-${key}`}
        value={fields[key]}
        onChange={(e) => edit(key, e.target.value)}
        onBlur={flush}
        readOnly={readOnly}
        aria-readonly={readOnly}
        placeholder={readOnly ? "" : placeholder}
        className="min-h-[90px] w-full resize-y rounded border-0 bg-transparent text-[12px] text-slate-800 placeholder:text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 read-only:text-slate-700"
      />
    </div>
  );

  const iconButton =
    "inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600";

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <FileEdit className="h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-800">Active Progress Note</h2>
          <p className="text-sm text-slate-500">
            Encounter note for {patient.firstName} {patient.lastName}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            aria-expanded={showHistory}
            aria-controls="active-note-history"
            aria-label={`Note history, ${signedEvents.length} signed`}
            className={iconButton}
          >
            <History className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">History ({signedEvents.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            aria-pressed={showPreview}
            aria-label={showPreview ? "Edit the note" : "Preview the note"}
            className={iconButton}
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">{showPreview ? "Edit" : "Preview"}</span>
          </button>
        </div>
      </div>

      {showHistory && (
        <div id="active-note-history" className="clinical-card mb-3">
          <p className="mb-2 text-xs font-semibold text-slate-700">Signatures on this note</p>
          {signedEvents.length === 0 ? (
            <p className="text-xs text-slate-500">
              No signed note yet — signing happens in the encounter's Sign &amp; Lock step.
            </p>
          ) : (
            <ul className="max-h-48 space-y-1 overflow-y-auto">
              {signedEvents.map((event) => (
                <li key={event.id} className="text-[11px] text-slate-600">
                  <span className="font-medium">{formatWhen(event.at)}</span>
                  {" · signed by "}
                  <span className="font-medium">{actorLabel(event.by)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="clinical-card flex flex-1 flex-col">
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-100 pb-3 text-xs text-slate-500">
          <div>
            <span className="font-medium text-slate-600">Date:</span> {dateOfService ?? "Not on file"}
          </div>
          <div>
            <span className="font-medium text-slate-600">Author:</span>{" "}
            {signer ? actorLabel(signer) : "Not signed yet"}
          </div>
          <div>
            <span className="font-medium text-slate-600">Type:</span> Progress Note
          </div>
          <div>
            <span className="font-medium text-slate-600">Status:</span>{" "}
            <span
              className={`rounded px-1.5 py-0.5 text-xs font-semibold uppercase ${
                status === "signed"
                  ? "bg-green-100 text-green-700"
                  : status === "draft"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-slate-100 text-slate-500"
              }`}
            >
              {NOTE_STATUS_LABEL[status]}
            </span>
          </div>
          <span role="status" aria-live="polite" className="ml-auto text-xs text-slate-500">
            {readOnly && savedAt
              ? `Signed ${formatWhen(savedAt)}`
              : saveState === "saving"
                ? "Saving…"
                : savedAt
                  ? `Saved ${formatWhen(savedAt)}`
                  : "Not saved yet"}
          </span>
        </div>

        {showPreview ? (
          <div className="space-y-3 text-sm">
            {(["subjective", "objective", "assessment", "plan"] as const).map((key) => (
              <div key={key}>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {key}
                </p>
                <p className="whitespace-pre-wrap text-slate-700">
                  {fields[key].trim() || "—"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-2 md:grid-cols-2">
              {field("subjective", "Subjective (S)", "Chief complaint, history of present illness, review of systems…", "text-brand-600")}
              {field("objective", "Objective (O)", "Vital signs, exam findings, lab and imaging results…", "text-emerald-600")}
              {field("assessment", "Assessment (A)", "Diagnoses, differentials, clinical impression…", "text-amber-600")}
              {field("plan", "Plan (P)", "Medication changes, orders, referrals, follow-up…", "text-brand-600")}
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
              {readOnly ? (
                <>
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  This note is signed and locked. It is the record the coder, the biller and the payer
                  read, so it is read-only here.
                </>
              ) : (
                <>
                  This is the patient&apos;s progress note — the same record the encounter autosaves.
                  It saves as you type; signing it stays in the encounter&apos;s Sign &amp; Lock step.
                </>
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
