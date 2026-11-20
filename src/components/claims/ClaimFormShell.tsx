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
 * Inspiration: the claim-entry chrome in Epic Resolute Professional Billing
 * (claim edit / claim form viewer) — status strip on top, edit checks in a
 * banner, and a printable paper underneath.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, FileDown, Loader2, Printer, Save, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { ClaimIssue } from "../../utils/claimValidation";

export interface ClaimPaperApi {
  values: Record<string, unknown>;
  lines: Record<string, unknown>[];
  set: (field: string, value: unknown) => void;
  setLine: (index: number, patch: Record<string, unknown>) => void;
  addLine: () => void;
  removeLine: (index: number) => void;
  issues: ClaimIssue[];
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

  const issues = useMemo(
    () => validate(draft, draftLines),
    [draft, draftLines, validate],
  );
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warn");
  const blocked = errors.length > 0;

  const flush = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    commitRef.current(draftRef.current, linesRef.current);
    setSavedAt(new Date().toLocaleTimeString());
    setDirty(false);
  };

  const handleSave = () => {
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
        `All edit checks pass${warnings.length > 0 ? ` — ${warnings.length} advisory note${warnings.length === 1 ? "" : "s"}` : ""}`,
      );
    }
  };

  const handleSubmit = () => {
    setShowAll(true);
    if (blocked) {
      toast.error(`Cannot submit — ${errors.length} edit check${errors.length === 1 ? "" : "s"} failed`);
      return;
    }
    flush();
    onSubmit(draftRef.current, linesRef.current);
  };

  const btn =
    accent === "accent"
      ? "inline-flex items-center gap-1.5 rounded-lg bg-accent-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-accent-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      : "inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300";
  const btnGhost =
    "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50";

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
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
        <button onClick={handleSave} className={btnGhost} title="Write the current edits to the claim record">
          <Save className="h-3.5 w-3.5" /> Save
        </button>
        <button onClick={handleValidate} className={btnGhost} title="Run the claim edit checks">
          <CheckCircle2 className="h-3.5 w-3.5" /> Validate
        </button>
        <button
          onClick={handleSubmit}
          disabled={blocked || submitting}
          className={btn}
          title={blocked ? `${errors.length} edit check(s) must clear before submission` : "Submit to the clearinghouse"}
        >
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Submit
        </button>
        <button onClick={() => window.print()} className={btnGhost} title="Print the paper at letter proportions">
          <Printer className="h-3.5 w-3.5" /> Print
        </button>
        <button
          onClick={() => onDownload(draftRef.current, linesRef.current)}
          className={btnGhost}
          title="Download the boxed form as a PDF"
        >
          <FileDown className="h-3.5 w-3.5" /> Download PDF
        </button>
        <span className="ml-auto text-[10px] font-medium text-slate-400">
          {errors.length} error{errors.length === 1 ? "" : "s"} · {warnings.length} advisory
        </span>
      </div>

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
        {children({ values: draft, lines: draftLines, set, setLine, addLine, removeLine, issues })}
      </div>

      {note && <p className="border-t border-slate-100 px-3 py-1.5 text-[9px] text-slate-400">{note}</p>}
    </div>
  );
}
