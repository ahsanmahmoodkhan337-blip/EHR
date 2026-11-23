/**
 * ClaimFormShell — the chrome around a printed claim.
 *
 * Shared by the medical CMS-1500 and the dental ADA form so both behave the
 * same way: a status / history strip, the toolbar (Save, Validate, Submit,
 * Print, Download PDF), the validation banner, and the paper itself passed in
 * as children through a render prop that carries the editing API.
 *
 * Editing model: the shell owns a draft of the paper's values and its service
 * lines. Every keystroke updates the draft immediately and commits it to the
 * store 300 ms later, so leaving the tab or reloading never loses an edit;
 * Save flushes that write at once.
 *
 * Demo fill: a box with no captured value renders the teaching demo value from
 * `data/claims/demoClaimData.ts` (grey italic + "demo" tag, see ClaimPaper) and
 * is counted separately here — "N boxes filled with demo data" — so it is never
 * read as captured data. The demo values are only ever in the *rendered* copy:
 * the draft, the commit and the claim record hold the real values, so a demo is
 * never written back onto the claim.
 *
 * Inspiration: the claim-entry chrome in Epic Resolute Professional Billing
 * (claim edit / claim form viewer) — status strip on top, edit checks in a
 * banner, and a printable paper underneath.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, FileDown, Info, Loader2, Printer, Save, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { ClaimIssue } from "../../utils/claimValidation";
import { applyDemoFill, applyLineDemoFill, demoFillSummary, unfilledBoxes, type DemoFilledBox } from "../../utils/demoClaimFill";
import { ReadOnlyNote, readOnlyAttrs, readOnlyNoteId } from "../shell/ReadOnlyStage";

/** The reason drawn under the claim's Submit button, at the point of the click. */
const CLAIM_SUBMIT_REASON = readOnlyNoteId("claim-submit");
const CLAIM_SAVE_REASON = readOnlyNoteId("claim-save");
import { READ_ONLY_REASON } from "../../domain/tutorialReadOnly";

export interface ClaimPaperApi {
  values: Record<string, unknown>;
  lines: Record<string, unknown>[];
  set: (field: string, value: unknown) => void;
  setLine: (index: number, patch: Record<string, unknown>) => void;
  addLine: () => void;
  removeLine: (index: number) => void;
  issues: ClaimIssue[];
  /** Fields currently showing a demo value — the paper styles these. */
  demoFields: Record<string, DemoFilledBox>;
  /** Line fields showing a demo value (box 24A), keyed by line field. */
  demoLineFields: Record<string, DemoFilledBox>;
  /** The same boxes as a list, for the paper's footer / the panel. */
  demoBoxes: DemoFilledBox[];
  /**
   * The standard reference chart refuses writes: the paper's boxes, Save and
   * Submit are disabled and say why. Read-only, not "unsaved".
   */
  readOnly?: boolean;
}

export interface ClaimFormShellProps {
  formCode: string;
  formTitle: string;
  /** Status shown in the strip, e.g. "Draft — edits not submitted". */
  statusLabel: string;
  history?: { at: string; message: string }[];
  values: Record<string, unknown>;
  lines: Record<string, unknown>[];
  /** Shape of a new service line, used by the add-line control. */
  emptyLine: Record<string, unknown>;
  maxLines: number;
  /** Changing this (patient id) reloads the draft from the store. */
  resetKey: string;
  validate: (values: Record<string, unknown>, lines: Record<string, unknown>[]) => ClaimIssue[];
  onCommit: (values: Record<string, unknown>, lines: Record<string, unknown>[]) => void;
  onSubmit: (values: Record<string, unknown>, lines: Record<string, unknown>[]) => void;
  onDownload: (values: Record<string, unknown>, lines: Record<string, unknown>[]) => void;
  submitting?: boolean;
  /** Dental screens use the teal accent. */
  accent?: "brand" | "accent";
  note?: string;
  /**
   * `demoFillMissingBoxes` — when on (the default) a box with no captured
   * value renders its teaching demo value. An instructor switches it off for
   * assessment, so the paper shows only what the student captured.
   */
  demoFillEnabled?: boolean;
  /**
   * The Tutorial Patient's chart is the standard reference and cannot be
   * changed: every control here that would write (a box, Save, Submit) is
   * disabled, with the reason and the way to Schedule beside it.
   */
  readOnly?: boolean;
  /**
   * Submit stays live on the standard reference chart.
   *
   * Owner, 2026-11-23: *"in billing section it should not be submitted, the
   * CMS-1500 should be filled and student should submit too … himself."* The
   * claim opens filled and unsent; pressing Submit is the one action the
   * read-only chart leaves the student, so this control is not disabled and its
   * note says what the press does instead of why it cannot.
   */
  submitLive?: boolean;
  children: (api: ClaimPaperApi) => ReactNode;
}

const COMMIT_DELAY_MS = 300;

export function ClaimFormShell({
  formCode,
  formTitle,
  statusLabel,
  history = [],
  values,
  lines,
  emptyLine,
  maxLines,
  resetKey,
  validate,
  onCommit,
  onSubmit,
  onDownload,
  submitting = false,
  accent = "brand",
  note,
  demoFillEnabled = true,
  readOnly = false,
  submitLive = false,
  children,
}: ClaimFormShellProps) {
  const [draft, setDraft] = useState<Record<string, unknown>>(values);
  const [draftLines, setDraftLines] = useState<Record<string, unknown>[]>(lines);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const draftRef = useRef(draft);
  const linesRef = useRef(draftLines);
  const commitRef = useRef(onCommit);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetRef = useRef(resetKey);

  commitRef.current = onCommit;

  // A different claim (patient) opens → reload the draft from the store.
  useEffect(() => {
    if (resetRef.current === resetKey) return;
    resetRef.current = resetKey;
    if (timer.current) clearTimeout(timer.current);
    setDraft(values);
    setDraftLines(lines);
    draftRef.current = values;
    linesRef.current = lines;
    setDirty(false);
    setShowAll(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // The store can change under the shell: the claim is back-filled the moment
  // the encounter's patient resolves, and a reset restores an earlier claim.
  // Adopt those values while the student has no unsaved edit of their own —
  // otherwise the paper keeps showing the blank claim it mounted with and
  // reports boxes 1a / 2 / 3 as missing although the claim already carries them.
  const storeSnapshot = useRef(JSON.stringify({ values, lines }));
  useEffect(() => {
    const snapshot = JSON.stringify({ values, lines });
    if (snapshot === storeSnapshot.current) return;
    storeSnapshot.current = snapshot;
    if (dirty || timer.current) return; // the student's unsaved edits win
    setDraft(values);
    setDraftLines(lines);
    draftRef.current = values;
    linesRef.current = lines;
  }, [values, lines, dirty]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const schedule = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      commitRef.current(draftRef.current, linesRef.current);
      setSavedAt(new Date().toLocaleTimeString());
      setDirty(false);
    }, COMMIT_DELAY_MS);
  };

  const set = (field: string, value: unknown) => {
    setDraft((prev) => {
      const next = { ...prev, [field]: value };
      draftRef.current = next;
      return next;
    });
    setDirty(true);
    schedule();
  };

  const setLine = (index: number, patch: Record<string, unknown>) => {
    setDraftLines((prev) => {
      const next = prev.map((l, i) => (i === index ? { ...l, ...patch } : l));
      linesRef.current = next;
      return next;
    });
    setDirty(true);
    schedule();
  };

  const addLine = () => {
    if (draftLines.length >= maxLines) return;
    setDraftLines((prev) => {
      const next = [...prev, { ...emptyLine }];
      linesRef.current = next;
      return next;
    });
    setDirty(true);
    schedule();
  };

  const removeLine = (index: number) => {
    setDraftLines((prev) => {
      const next = prev.filter((_, i) => i !== index);
      linesRef.current = next;
      return next;
    });
    setDirty(true);
    schedule();
  };

  // Real value first, demo value second. The rendered copy carries the demo
  // values; `draft` (and therefore the commit) keeps only what was captured.
  const demo = useMemo(
    () => applyDemoFill(draft, { enabled: demoFillEnabled }),
    [draft, demoFillEnabled],
  );

  // The same rule for the box-24 lines (24A date of service). A blank line date
  // shows the tagged demo date, so the paper never prints a date the record does
  // not hold — and the draft keeps the line blank.
  const demoLines = useMemo(
    () => applyLineDemoFill(draftLines, { enabled: demoFillEnabled }),
    [draftLines, demoFillEnabled],
  );

  const demoBoxCount = demo.boxes.length + demoLines.boxes.length;

  // Boxes left blank because nothing captured them, with the stage that supplies
  // each (9c, 16, 17, 23 — `utils/demoClaimFill.ts`). They carry no value at all:
  // until 2026-11-21 each printed another patient's world as a demo. The sources
  // are CMS-1500 box numbers, so they are listed on that paper only — the UB-04
  // and the ADA form number their boxes differently and borrow nothing.
  const unfilled = useMemo(
    () => (formCode.startsWith("CMS-1500") ? unfilledBoxes(draft) : []),
    [draft, formCode],
  );

  const issues = useMemo(
    () => validate(demo.values, demoLines.lines),
    [demo.values, demoLines.lines, validate],
  );
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warn");
  const blocked = errors.length > 0;

  const flush = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    // The standard chart refuses the write, so the shell never makes one: a
    // commit here would be silently dropped by the store.
    if (readOnly) return;
    commitRef.current(draftRef.current, linesRef.current);
    setSavedAt(new Date().toLocaleTimeString());
    setDirty(false);
  };

  const handleSave = () => {
    if (readOnly) return;
    flush();
    toast.success(`${formCode} saved`);
  };

  const handleValidate = () => {
    setShowAll(true);
    flush();
    if (blocked) {
      toast.error(`${errors.length} edit check${errors.length === 1 ? "" : "s"} still open`);
    } else {
      toast.success(
        `All edit checks pass${warnings.length > 0 ? ` — ${warnings.length} advisory note${warnings.length === 1 ? "" : "s"}` : ""}${
          demoBoxCount > 0 ? ` · ${demoFillSummary(demoBoxCount)}` : ""
        }`,
      );
    }
  };

  const handleSubmit = () => {
    // On the standard reference chart Submit is the exercise: it is live, and it
    // is the only control on this paper that writes.
    if (readOnly && !submitLive) return;
    setShowAll(true);
    if (blocked) {
      toast.error(`Cannot submit — ${errors.length} edit check${errors.length === 1 ? "" : "s"} failed`);
      return;
    }
    // Nothing to flush on the read-only chart: its boxes are the seed's, and the
    // store would refuse the commit anyway.
    if (!readOnly) flush();
    onSubmit(draftRef.current, linesRef.current);
  };

  const btn =
    accent === "accent"
      ? "inline-flex items-center gap-1.5 rounded-lg bg-accent-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-accent-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      : "inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300";
  const btnGhost =
    "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50";

  return (
    <div className="clinical-card">
      {/* ── Status + history strip ───────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{formCode}</p>
          <p className="truncate text-xs font-bold text-slate-800">{formTitle}</p>
        </div>
        <span
          className={`status-badge ${blocked ? "is-warning" : "is-success"}`}
          title={blocked ? "Edit checks are open" : "Edit checks pass"}
        >
          {blocked ? <AlertTriangle className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
          {statusLabel}
        </span>
        <span className="text-[10px] text-slate-400">
          {dirty ? "Unsaved changes…" : savedAt ? `Saved ${savedAt}` : "Saved automatically"}
        </span>
        {history.length > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-2 text-[9px] text-slate-400">
            <span className="font-semibold uppercase tracking-wide">History</span>
            {history.slice(-3).map((h, i) => (
              <span key={`${h.at}-${i}`} className="rounded bg-slate-50 px-1.5 py-0.5 text-slate-500">
                {new Date(h.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {h.message}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Toolbar ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-3 py-2">
        <div className="flex flex-col">
          <button
            onClick={handleSave}
            className={btnGhost}
            {...(readOnly ? readOnlyAttrs(readOnly, CLAIM_SAVE_REASON) : { title: "Write the current edits to the claim record" })}
          >
            <Save className="h-3.5 w-3.5" /> Save
          </button>
          <ReadOnlyNote readOnly={readOnly} id={CLAIM_SAVE_REASON} />
        </div>
        <button onClick={handleValidate} className={btnGhost} title="Run the claim edit checks">
          <CheckCircle2 className="h-3.5 w-3.5" /> Validate
        </button>
        {/* Submit, and the reason directly under it: the standard chart cannot
            send this claim — except when Submit is the exercise itself, and then
            the note says what the press does rather than why it cannot. */}
        <div className="flex flex-col">
          <button
            onClick={handleSubmit}
            disabled={submitting || (readOnly ? !submitLive : blocked)}
            className={btn}
            title={
              readOnly && !submitLive
                ? READ_ONLY_REASON
                : blocked
                  ? `${errors.length} edit check(s) must clear before submission`
                  : "Submit to the clearinghouse"
            }
            {...(readOnly && !submitLive ? { "aria-describedby": CLAIM_SUBMIT_REASON } : {})}
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Submit
          </button>
          {readOnly && submitLive ? (
            <p className="mt-1.5 max-w-[260px] text-[10px] leading-snug text-slate-500">
              The reference claim is filled and waiting: pressing Submit is yours to do — it sends the
              837P, and the 277CA, the 835 and the AR row follow from it.
            </p>
          ) : (
            <ReadOnlyNote readOnly={readOnly} id={CLAIM_SUBMIT_REASON} />
          )}
        </div>
        <button onClick={() => window.print()} className={btnGhost} title="Print the paper at letter proportions">
          <Printer className="h-3.5 w-3.5" /> Print
        </button>
        <button
          onClick={() => onDownload(demo.values, demoLines.lines)}
          className={btnGhost}
          title="Download the boxed form as a PDF — the paper as drawn, demo values included"
        >
          <FileDown className="h-3.5 w-3.5" /> Download PDF
        </button>
        <span className="ml-auto text-[10px] font-medium text-slate-400">
          {errors.length} error{errors.length === 1 ? "" : "s"} · {warnings.length} advisory
        </span>
      </div>


      {/* ── Demo-data strip ──────────────────────────────────────────
          Counted apart from the edit checks: a demo box is not a clean box,
          so it is never folded into "0 errors". */}
      {demoBoxCount > 0 && (
        <div className="border-b border-slate-200 bg-slate-50 px-3 py-1.5">
          <p className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-slate-600">
            <Info className="h-3 w-3 text-slate-400" />
            {demoFillSummary(demoBoxCount)}
            <span className="font-normal text-slate-400">
              — teaching placeholders, not captured data; nothing here is saved to the claim.
            </span>
          </p>
          <p className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
            {[...demo.boxes, ...demoLines.boxes].map((d) => (
              <span key={d.field} className="text-[9px] italic text-slate-400" title={`${d.label} is normally supplied by ${d.stage}.`}>
                {d.label} · {d.value}
              </span>
            ))}
          </p>
        </div>
      )}

      {/* ── Not-captured strip ───────────────────────────────────────
          Boxes with no value at all. Each names the stage that supplies it, so
          the student can trace the gap instead of reading a borrowed value. */}
      {demoFillEnabled && unfilled.length > 0 && (
        <div className="border-b border-slate-200 bg-slate-50 px-3 py-1.5">
          <p className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-slate-600">
            <Info className="h-3 w-3 text-slate-400" />
            {unfilled.length === 1 ? "1 box left blank" : `${unfilled.length} boxes left blank`}
            <span className="font-normal text-slate-400">
              — nothing captured for them, so nothing is printed.
            </span>
          </p>
          <p className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
            {unfilled.map((d) => (
              <span
                key={d.field}
                className="text-[9px] text-slate-400"
                title={`${d.label} is supplied by ${d.stage}.`}
              >
                {d.label} · {d.stage}
              </span>
            ))}
          </p>
        </div>
      )}

      {/* ── Validation banner ────────────────────────────────────── */}
      {issues.length > 0 && (
        <div className={`border-b px-3 py-2 ${blocked ? "border-red-100 bg-red-50" : "border-amber-100 bg-amber-50"}`}>
          <p className={`flex items-center gap-1.5 text-[11px] font-semibold ${blocked ? "text-red-800" : "text-amber-800"}`}>
            <AlertTriangle className="h-3.5 w-3.5" />
            {blocked
              ? `${errors.length} edit check${errors.length === 1 ? "" : "s"} must clear before this claim can be submitted`
              : `All blocking edit checks pass — ${warnings.length} advisory note${warnings.length === 1 ? "" : "s"}`}
          </p>
          <ul className="mt-1 space-y-0.5">
            {(showAll ? issues : issues.slice(0, 3)).map((issue, i) => (
              <li key={`${issue.box}-${i}`} className="text-[10px] leading-snug">
                <button
                  onClick={() => {
                    const el = document.querySelector(`[data-box="${issue.box}"]`);
                    el?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                  className={`text-left underline-offset-2 hover:underline ${
                    issue.severity === "error" ? "text-red-700" : "text-amber-700"
                  }`}
                >
                  {issue.message}
                </button>
              </li>
            ))}
            {!showAll && issues.length > 3 && (
              <li className="text-[10px] text-slate-500">…and {issues.length - 3} more — press Validate for the full list.</li>
            )}
          </ul>
        </div>
      )}

      {/* ── The paper ────────────────────────────────────────────── */}
      <div className="bg-slate-100/70 p-3">
        {children({
          values: demo.values,
          lines: demoLines.lines,
          set,
          setLine,
          addLine,
          removeLine,
          issues,
          demoFields: demo.byField,
          demoLineFields: demoLines.byField,
          demoBoxes: [...demo.boxes, ...demoLines.boxes],
          readOnly,
        })}
      </div>

      {note && <p className="border-t border-slate-100 px-3 py-1.5 text-[9px] text-slate-400">{note}</p>}
    </div>
  );
}
