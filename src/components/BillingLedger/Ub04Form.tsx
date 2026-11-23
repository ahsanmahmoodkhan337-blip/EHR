/**
 * Ub04Form — the institutional paper itself: the UB-04 (CMS-1450) replica.
 *
 * Same shell, same validation path and same paper component as the CMS-1500
 * (`CMS1500Form.tsx`): it hands `ClaimPaper` the UB-04 layout table and
 * supplies the one part that is a table rather than a box — the service lines,
 * locators 42 to 48, with the revenue code that says which department earned
 * the charge.
 *
 * The revenue-code list is the single teaching table in
 * `data/claims/revenueCodes.ts`; box 43 prints that table's own description of
 * the code in box 42, so a description can never disagree with its code.
 *
 * Inspiration: the printed UB-04 (CMS-1450) and hospital billing worklists in
 * Epic and eCW.
 */

import { Plus, Trash2 } from "lucide-react";
import { ClaimPaper } from "../claims/ClaimPaper";
import type { ClaimPaperApi } from "../claims/ClaimFormShell";
import {
  UB04_LAYOUT,
  UB04_LINE_COLUMNS,
  UB04_REVENUE_OPTIONS,
} from "../../data/claims/ub04Layout";
import { REVENUE_CODES_BY_CODE } from "../../data/claims/revenueCodes";
import type { ClaimServiceLine } from "../../store/pipelineStore";

/** Box 43 — the revenue code in box 42, read out in words. Never typed. */
function revenueDescription(revenueCode: unknown): string {
  const code = String(revenueCode ?? "").trim();
  if (!code) return "";
  return REVENUE_CODES_BY_CODE[code]?.teachingDescription ?? "";
}

export function Ub04Form({
  values,
  lines,
  set,
  setLine,
  addLine,
  removeLine,
  issues,
  demoFields,
  readOnly,
}: ClaimPaperApi) {
  const rows = lines as unknown as ClaimServiceLine[];
  const maxLines = UB04_LAYOUT.maxLines;

  const totalCharges = rows.reduce((sum, l) => sum + (Number(l.charge) || 0), 0);
  const totalNonCovered = rows.reduce((sum, l) => sum + (Number(l.nonCovered) || 0), 0);

  const table = (
    // Eight columns on a 360 px screen: the table scrolls inside its own
    // container rather than pushing the page sideways (standing rule 4).
    <div className="mt-0.5 overflow-x-auto print:overflow-visible">
      <div className="min-w-[560px]">
        <div className="flex gap-0.5 border-b border-form-red/40 pb-0.5">
          {UB04_LINE_COLUMNS.map((col) => (
            <div key={col.key} style={{ flexGrow: col.width, flexBasis: 0 }} className="min-w-0">
              <p className="text-[5.5px] font-bold uppercase leading-none text-form-red">
                {col.label}
              </p>
              {/* The 837I element this column becomes — the same list the PDF
                  prints, so the screen and the paper cannot disagree. */}
              <p
                className="mt-px text-[4.5px] font-semibold uppercase leading-none text-slate-400"
                title={col.x12Note ?? `On an electronic claim this column becomes ${col.x12}.`}
                data-x12-tag={col.x12}
              >
                {col.x12}
              </p>
            </div>
          ))}
          <span className="w-5 shrink-0 print:hidden" />
        </div>

        {rows.map((line, index) => (
          <div key={index} className="flex items-center gap-0.5 border-b border-form-red/20 py-0.5">
            <div style={{ flexGrow: UB04_LINE_COLUMNS[0].width, flexBasis: 0 }} className="shrink-0">
              <select
                value={String(line.revenueCode ?? "")}
                onChange={(e) => setLine(index, { revenueCode: e.target.value })}
                aria-label={`Box 42 revenue code, line ${index + 1}`}
                className="w-full bg-transparent text-[7px] text-ink outline-none"
              >
                {UB04_REVENUE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.value ? `${option.value} — ${REVENUE_CODES_BY_CODE[option.value]?.teachingDescription ?? option.label}` : option.label}
                  </option>
                ))}
              </select>
            </div>

            <p
              style={{ flexGrow: UB04_LINE_COLUMNS[1].width, flexBasis: 0 }}
              className="min-w-0 truncate text-[7px] italic text-ink-muted"
              title={revenueDescription(line.revenueCode)}
              data-derived-box="43"
            >
              {revenueDescription(line.revenueCode) || "—"}
            </p>

            <div style={{ flexGrow: UB04_LINE_COLUMNS[2].width, flexBasis: 0 }} className="shrink-0">
              <input
                value={String(line.cpt ?? "")}
                onChange={(e) => setLine(index, { cpt: e.target.value.toUpperCase() })}
                aria-label={`Box 44 HCPCS, line ${index + 1}`}
                className="w-full bg-transparent text-[7px] text-ink outline-none"
              />
            </div>

            <div style={{ flexGrow: UB04_LINE_COLUMNS[3].width, flexBasis: 0 }} className="shrink-0">
              <input
                type="date"
                value={String(line.dateOfService ?? "")}
                onChange={(e) => setLine(index, { dateOfService: e.target.value })}
                aria-label={`Box 45 service date, line ${index + 1}`}
                className="w-full bg-transparent text-[7px] text-ink outline-none"
              />
            </div>

            <div style={{ flexGrow: UB04_LINE_COLUMNS[4].width, flexBasis: 0 }} className="shrink-0">
              <input
                inputMode="numeric"
                value={line.units === undefined || line.units === null ? "" : String(line.units)}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^0-9]/g, "");
                  setLine(index, { units: cleaned === "" ? 0 : Number(cleaned) });
                }}
                aria-label={`Box 46 service units, line ${index + 1}`}
                className="w-full bg-transparent text-[7px] tabular-nums text-ink outline-none"
              />
            </div>

            <div style={{ flexGrow: UB04_LINE_COLUMNS[5].width, flexBasis: 0 }} className="shrink-0">
              <input
                inputMode="decimal"
                value={line.charge ? String(line.charge) : ""}
                placeholder="0.00"
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^0-9.]/g, "");
                  setLine(index, { charge: cleaned === "" ? 0 : Number(cleaned) });
                }}
                aria-label={`Box 47 total charges, line ${index + 1}`}
                className="w-full bg-transparent text-[7px] tabular-nums text-ink outline-none"
              />
            </div>

            <div style={{ flexGrow: UB04_LINE_COLUMNS[6].width, flexBasis: 0 }} className="shrink-0">
              <input
                inputMode="decimal"
                value={line.nonCovered ? String(line.nonCovered) : ""}
                placeholder="0.00"
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^0-9.]/g, "");
                  setLine(index, { nonCovered: cleaned === "" ? 0 : Number(cleaned) });
                }}
                aria-label={`Box 48 non-covered charges, line ${index + 1}`}
                className="w-full bg-transparent text-[7px] tabular-nums text-ink outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => removeLine(index)}
              aria-label={`Remove service line ${index + 1}`}
              title={`Remove service line ${index + 1}`}
              className="flex h-5 w-5 shrink-0 items-center justify-center text-danger/70 hover:text-danger print:hidden"
            >
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          </div>
        ))}

        {/* Box 49 — the printed 23rd row carries no data; the totals do. */}
        <div className="flex gap-0.5 border-t border-form-red/60 pt-0.5 text-[6px] font-semibold uppercase text-form-red">
          <p style={{ flexGrow: UB04_LINE_COLUMNS[0].width, flexBasis: 0 }} className="shrink-0">
            49 · (blank)
          </p>
          <p style={{ flexGrow: UB04_LINE_COLUMNS[1].width, flexBasis: 0 }} className="shrink-0">
            TOTALS
          </p>
          <p style={{ flexGrow: UB04_LINE_COLUMNS[2].width, flexBasis: 0 }} className="shrink-0" />
          <p style={{ flexGrow: UB04_LINE_COLUMNS[3].width, flexBasis: 0 }} className="shrink-0" />
          <p style={{ flexGrow: UB04_LINE_COLUMNS[4].width, flexBasis: 0 }} className="shrink-0" />
          <p
            style={{ flexGrow: UB04_LINE_COLUMNS[5].width, flexBasis: 0 }}
            className="min-w-0 tabular-nums"
            data-derived-box="47"
          >
            {totalCharges ? totalCharges.toFixed(2) : "0.00"}
          </p>
          <p
            style={{ flexGrow: UB04_LINE_COLUMNS[6].width, flexBasis: 0 }}
            className="min-w-0 tabular-nums"
            data-derived-box="48"
          >
            {totalNonCovered ? totalNonCovered.toFixed(2) : "0.00"}
          </p>
        </div>

        <div className="mt-0.5 flex items-center gap-1 print:hidden">
          <button
            type="button"
            onClick={addLine}
            disabled={rows.length >= maxLines}
            className="inline-flex min-h-5 items-center gap-0.5 rounded border border-form-red/50 px-1 py-0.5 text-[7px] font-semibold uppercase tracking-wide text-form-red hover:bg-form-red/10 disabled:cursor-not-allowed disabled:opacity-40"
            title={
              rows.length >= maxLines
                ? "The UB-04 prints 22 service lines on a page"
                : "Add a service line"
            }
          >
            <Plus className="h-2.5 w-2.5" /> Add line ({rows.length}/{maxLines})
          </button>
          {rows.length >= maxLines && (
            <span className="text-[7px] text-ink-muted">
              22 lines is the printed page — continue on a second bill.
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <ClaimPaper
      layout={UB04_LAYOUT}
      values={values}
      issues={issues}
      set={set}
      table={table}
      demoFields={demoFields}
      readOnly={readOnly}
    />
  );
}
