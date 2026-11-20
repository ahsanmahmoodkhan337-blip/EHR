/**
 * ClaimPaper — the shared sheet of paper both claim replicas print on.
 *
 * Draws a form from its layout data (`cms1500Layout.ts` / `adaLayout.ts`):
 * one flex row per printed row, one bordered box per cell, the box caption in
 * the form's red-brown, and the editable values inside. Nothing about the
 * CMS-1500 or the ADA form is hard-coded here — only the *behaviour* of a
 * printed claim box is.
 *
 * Accessibility / print rules that live here:
 *  - values are near-black, captions are the form red, so the sheet still
 *    reads correctly when printed in greyscale (nothing is signalled by colour
 *    inside the paper except the validation outline, which also says so in the
 *    toolbar banner);
 *  - invalid boxes get a red inset outline;
 *  - inputs print as plain values (no borders, no focus ring).
 *
 * Inspiration: the printed CMS-1500 (02/12) and ADA 2019 claim forms.
 */

import type { ReactNode } from "react";
import type { ClaimBox, ClaimLayout } from "../../data/claims/cms1500Layout";
import { DIAGNOSIS_POINTERS } from "../../data/claims/cms1500Layout";
import { errorBoxes, type ClaimIssue } from "../../utils/claimValidation";
import type { DemoFilledBox } from "../../utils/demoClaimFill";

const MM = 3.2; // px per millimetre on screen

export interface ClaimPaperProps {
  layout: ClaimLayout;
  values: Record<string, unknown>;
  issues: ClaimIssue[];
  /** Rendered into the box whose `structural` is "table". */
  table?: ReactNode;
  /** Called with the box's field key and the new value. */
  set: (field: string, value: unknown) => void;
  /** Footer note printed under the sheet (demo-data marker). */
  note?: string;
  /**
   * Fields whose value is demo data, not captured data. They print grey italic
   * with a "demo" tag and a tooltip naming the stage that should supply them —
   * a demo value must never be mistakable for a captured one.
   */
  demoFields?: Record<string, DemoFilledBox>;
}

export function ClaimPaper({ layout, values, issues, table, set, note, demoFields }: ClaimPaperProps) {
  const bad = errorBoxes(issues);

  return (
    <div className="claim-paper mx-auto w-full max-w-[900px] bg-white" data-claim-paper>
      <div className="flex items-baseline justify-between border-b-2 border-form-red px-1 pb-1">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-form-red">{layout.title}</p>
          <p className="text-[8px] font-medium text-ink-muted">
            {layout.formCode} · Healthcare Hustlers teaching replica
          </p>
        </div>
        <p className="text-[8px] font-semibold uppercase tracking-wide text-form-red">Demo data — not a real claim</p>
      </div>

      {layout.rows.map((row, rowIndex) => (
        <div key={`row-${rowIndex}`} className="flex" style={{ minHeight: row.heightMm * MM }}>
          {row.cells.map((cell) => (
            <Box key={cell.id} box={cell} values={values} issues={issues} bad={bad} set={set} table={table} demoFields={demoFields} />
          ))}
        </div>
      ))}

      {note && <p className="border-t border-form-red/40 px-1 pt-1 text-[7px] text-ink-muted">{note}</p>}
    </div>
  );
}

function Box({
  box,
  values,
  issues,
  bad,
  set,
  table,
  demoFields,
}: {
  box: ClaimBox;
  values: Record<string, unknown>;
  issues: ClaimIssue[];
  bad: Set<string>;
  set: (field: string, value: unknown) => void;
  table?: ReactNode;
  demoFields?: Record<string, DemoFilledBox>;
}) {
  const invalid = bad.has(box.id);
  const issue = issues.find((i) => i.box === box.id && i.severity === "error");

  if (box.structural === "band") {
    return (
      <div className="flex items-center border border-form-red bg-form-red/10 px-1" style={{ flex: box.colSpan }}>
        <p className="text-[8px] font-bold uppercase tracking-wider text-form-red">{box.label}</p>
      </div>
    );
  }

  return (
    <div
      className={`relative min-w-0 border border-form-red/70 px-1 pt-0.5 ${
        box.reserved ? "bg-form-red/[0.07]" : ""
      } ${invalid ? "outline outline-2 -outline-offset-2 outline-danger" : ""}`}
      style={{ flex: box.colSpan }}
      data-box={box.id}
      title={invalid ? issue?.message : box.hint}
    >
      <p className="text-[6.5px] font-semibold uppercase leading-tight text-form-red">{box.label}</p>

      {box.structural === "table" && <div className="mt-0.5">{table}</div>}

      {box.structural === "pointerGrid" && (
        <div className="mt-1 grid grid-cols-6 gap-x-2 gap-y-0.5">
          {DIAGNOSIS_POINTERS.map((letter, i) => {
            const codes = (values.diagnosisCodes as string[]) ?? [];
            return (
              <label key={letter} className="flex items-baseline gap-0.5">
                <span className="text-[7px] font-bold text-form-red">{letter}.</span>
                <input
                  value={codes[i] ?? ""}
                  onChange={(e) => {
                    const next = [...codes];
                    while (next.length < 12) next.push("");
                    next[i] = e.target.value.toUpperCase();
                    set("diagnosisCodes", next);
                  }}
                  placeholder="ICD-10"
                  aria-label={`Box 21 diagnosis ${letter}`}
                  className="w-full min-w-0 bg-transparent text-[9px] text-ink outline-none placeholder:text-ink-muted/50"
                />
              </label>
            );
          })}
        </div>
      )}

      {box.checks && (
        <div className="mt-0.5 space-y-0.5">
          {box.checks.map((check) => (
            <label key={check.field} className="flex items-center gap-1 text-[8px] text-ink">
              <input
                type="checkbox"
                checked={Boolean(values[check.field])}
                onChange={(e) => set(check.field, e.target.checked)}
                className="h-2.5 w-2.5 accent-form-red"
              />
              {check.label}
            </label>
          ))}
        </div>
      )}

      {box.fields && (
        <div
          className={`mt-0.5 flex gap-x-1.5 ${
            // A stacked box prints its values one above the other (box 22's
            // resubmission code with ORIGINAL REF. NO. beneath it) instead of
            // side by side, as the paper folds them.
            box.stack ? "flex-col items-stretch gap-y-0.5" : "flex-wrap items-end"
          }`}
        >
          {box.fields.map((field) => (
            <Field key={field.field} box={box} field={field} values={values} set={set} demo={demoFields?.[field.field]} />
          ))}
        </div>
      )}
    </div>
  );
}

function Field({
  box,
  field,
  values,
  set,
  demo,
}: {
  box: ClaimBox;
  field: NonNullable<ClaimBox["fields"]>[number];
  values: Record<string, unknown>;
  set: (field: string, value: unknown) => void;
  /** Set when this box is showing a demo value instead of a captured one. */
  demo?: DemoFilledBox;
}) {
  const raw = values[field.field];
  const common =
    "min-w-0 w-full bg-transparent text-[9.5px] leading-tight text-ink outline-none placeholder:text-ink-muted/40 focus:bg-brand-50";

  // A demo value is never an input: it cannot be typed over, so it can never be
  // written back onto the claim, and it always looks different from captured data.
  if (demo && field.kind !== "checkbox") {
    return (
      <div className="min-w-0 flex-1" style={{ flex: field.flex ?? 1 }}>
        {field.label && <p className="text-[6px] uppercase tracking-wide text-ink-muted">{field.label}</p>}
        <p
          className="flex min-w-0 items-baseline gap-1 text-[9px] italic leading-tight text-slate-400"
          title={`Demo value — ${demo.label} is normally supplied by ${demo.stage}. Not saved to the claim.`}
          data-demo-box={demo.box}
        >
          <span className="min-w-0 truncate">{String(raw ?? "")}</span>
          <span className="shrink-0 rounded-sm bg-slate-200 px-0.5 text-[5.5px] font-bold uppercase not-italic tracking-wide text-slate-500">
            demo
          </span>
        </p>
      </div>
    );
  }

  const control = (() => {
    switch (field.kind) {
      case "select":
        return (
          <select
            value={String(raw ?? "")}
            onChange={(e) => set(field.field, e.target.value)}
            aria-label={box.label}
            className={`${common} text-[9px]`}
          >
            {field.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        );
      case "checkbox":
        return (
          <label className="flex items-center gap-1 text-[8px] text-ink">
            <input
              type="checkbox"
              checked={Boolean(raw)}
              onChange={(e) => set(field.field, e.target.checked)}
              className="h-2.5 w-2.5 accent-form-red"
            />
            {field.label}
          </label>
        );
      case "date":
        return (
          <input
            type="date"
            value={String(raw ?? "")}
            onChange={(e) => set(field.field, e.target.value)}
            aria-label={field.label ?? box.label}
            className={common}
          />
        );
      case "money":
        return (
          <input
            type="text"
            inputMode="decimal"
            value={raw === undefined || raw === null || raw === 0 ? "" : String(raw)}
            placeholder="0.00"
            onChange={(e) => {
              const cleaned = e.target.value.replace(/[^0-9.]/g, "");
              set(field.field, cleaned === "" ? 0 : Number(cleaned));
            }}
            aria-label={field.label ?? box.label}
            className={`${common} tabular-nums`}
          />
        );
      case "number":
        return (
          <input
            type="text"
            inputMode="numeric"
            value={raw === undefined || raw === null ? "" : String(raw)}
            onChange={(e) => {
              const cleaned = e.target.value.replace(/[^0-9]/g, "");
              set(field.field, cleaned === "" ? 0 : Number(cleaned));
            }}
            aria-label={field.label ?? box.label}
            className={`${common} tabular-nums`}
          />
        );
      default:
        return (
          <input
            type="text"
            value={String(raw ?? "")}
            placeholder={field.placeholder}
            onChange={(e) => set(field.field, e.target.value)}
            aria-label={field.label ?? box.label}
            className={common}
          />
        );
    }
  })();

  return (
    <div className="min-w-0 flex-1" style={{ flex: field.flex ?? 1 }}>
      {field.label && (
        <p className="text-[6px] uppercase tracking-wide text-ink-muted">{field.label}</p>
      )}
      {control}
    </div>
  );
}
