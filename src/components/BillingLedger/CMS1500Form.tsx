/**
 * CMS1500Form — the paper itself: the CMS-1500 (02/12) replica.
 *
 * Draws the 33 printed boxes from `cms1500Layout.ts` through the shared
 * `ClaimPaper`, and supplies the one part that is a table rather than a box:
 * box 24's six service lines (24A date, 24B place of service, 24C EMG, 24D CPT
 * + modifier, 24E diagnosis pointer, 24F charge, 24G units, 24H EPSDT, 24I ID
 * qualifier, 24J rendering provider ID #).
 *
 * Box 22 is always enabled and only meaningful for a corrected claim, as on the
 * real form — no gating. Its ORIGINAL REF. NO. prints inside the same box,
 * beneath the code; there is no separate 22a.
 *
 * Inspiration: the NUCC CMS-1500 Health Insurance Claim Form (02/12).
 */

import { Plus, Trash2 } from "lucide-react";
import { ClaimPaper } from "../claims/ClaimPaper";
import type { ClaimPaperApi } from "../claims/ClaimFormShell";
import {
  CMS1500_LAYOUT,
  CMS1500_LINE_COLUMNS,
  EMG_OPTIONS,
  ID_QUALIFIER_OPTIONS,
  POS_CODE_OPTIONS,
} from "../../data/claims/cms1500Layout";
import { DEMO_PROVIDER_NOTE } from "../../data/claims/providerProfile";
import type { ClaimServiceLine } from "../../store/pipelineStore";

/**
 * The eleven printed columns of box 24, A–J (24D carries the code and the
 * modifier), with the 837P element each one becomes. The list lives in
 * `cms1500Layout.ts` so the screen and the PDF cannot drift apart.
 */
const COLUMNS = CMS1500_LINE_COLUMNS;

export function CMS1500Form({
  values,
  lines,
  set,
  setLine,
  addLine,
  removeLine,
  issues,
  demoFields,
  demoLineFields,
  readOnly,
}: ClaimPaperApi) {
  const rows = lines as unknown as ClaimServiceLine[];
  const maxLines = CMS1500_LAYOUT.maxLines;
  // Box 24A when the claim holds no per-line date: the encounter supplied none,
  // so the cell shows the tagged demo date as a placeholder. It is never the
  // input's value, so it cannot be saved as if the student had captured it.
  const demoDate = demoLineFields?.dateOfService;

  const rowError = (box: string, index: number) =>
    issues.some((i) => i.severity === "error" && i.box === box && i.message.includes(`line ${index + 1}`));

  const table = (
    <div className="mt-0.5">
      <div className="flex gap-0.5 border-b border-form-red/40 pb-0.5">
        {COLUMNS.map((col) => (
          <div key={`${col.box}-${col.caption}`} style={{ flexGrow: col.width, flexBasis: 0 }} className="min-w-0">
            <p className="text-[5.5px] font-bold uppercase leading-none text-form-red">
              {col.box} · {col.caption}
            </p>
            {/* The 837P element this column becomes — same list as the PDF. */}
            <p
              className="mt-px text-[4.5px] font-semibold uppercase leading-none text-slate-400"
              title={col.x12Note ?? `On an electronic claim this column becomes ${col.x12}.`}
              data-x12-tag={col.x12}
            >
              {col.x12}
            </p>
          </div>
        ))}
        <span className="w-3 shrink-0 print:hidden" aria-hidden />
      </div>

      {rows.map((line, index) => (
        <div key={`line-${index}`} className="flex items-start gap-0.5 border-b border-form-red/20 py-0.5">
          {line.dateOfService || !demoDate ? (
            <input
              type="date"
              value={line.dateOfService ?? ""}
              onChange={(e) => setLine(index, { dateOfService: e.target.value })}
              aria-label={`Box 24A date of service, line ${index + 1}`}
              style={{ flexGrow: 12, flexBasis: 0 }}
              className={`min-w-0 bg-transparent text-[8.5px] text-ink outline-none ${
                rowError("24A", index) ? "outline outline-2 outline-danger" : ""
              }`}
            />
          ) : (
            <input
              type="text"
              value=""
              placeholder={demoDate.value}
              onChange={(e) => setLine(index, { dateOfService: e.target.value })}
              aria-label={`Box 24A date of service, line ${index + 1} — demo date, type to replace`}
              title={`Demo date — the per-line date of service is normally supplied by ${demoDate.stage}. Type the real date to replace it.`}
              data-demo-box={demoDate.box}
              style={{ flexGrow: 12, flexBasis: 0 }}
              className={`min-w-0 bg-transparent text-[8.5px] italic text-slate-400 outline-none placeholder:text-slate-400 ${
                rowError("24A", index) ? "outline outline-2 outline-danger" : ""
              }`}
            />
          )}
          <select
            value={line.placeOfService ?? "11"}
            onChange={(e) => setLine(index, { placeOfService: e.target.value })}
            aria-label={`Box 24B place of service, line ${index + 1}`}
            style={{ flexGrow: 6, flexBasis: 0 }}
            className={`min-w-0 bg-transparent text-[8.5px] text-ink outline-none ${
              rowError("24B", index) ? "outline outline-2 outline-danger" : ""
            }`}
          >
            {POS_CODE_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <select
            value={line.emg ?? ""}
            onChange={(e) => setLine(index, { emg: e.target.value })}
            aria-label={`Box 24C emergency indicator, line ${index + 1}`}
            title="24C EMG — Y only when the service was an emergency. Blank is the normal state."
            style={{ flexGrow: 5, flexBasis: 0 }}
            className="min-w-0 bg-transparent text-[8.5px] text-ink outline-none"
          >
            {EMG_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            value={line.cpt ?? ""}
            onChange={(e) => setLine(index, { cpt: e.target.value.toUpperCase() })}
            placeholder="99214"
            aria-label={`Box 24D CPT code, line ${index + 1}`}
            style={{ flexGrow: 12, flexBasis: 0 }}
            className={`min-w-0 bg-transparent text-[8.5px] text-ink outline-none ${
              rowError("24D", index) ? "outline outline-2 outline-danger" : ""
            }`}
          />
          <input
            value={(line.modifiers ?? []).join(", ")}
            onChange={(e) =>
              setLine(index, {
                modifiers: e.target.value
                  .split(",")
                  .map((m) => m.trim().toUpperCase())
                  .filter(Boolean),
              })
            }
            placeholder="25"
            aria-label={`Box 24D modifiers, line ${index + 1}`}
            style={{ flexGrow: 9, flexBasis: 0 }}
            className="min-w-0 bg-transparent text-[8.5px] text-ink outline-none"
          />
          <input
            value={line.diagnosisPointer ?? ""}
            onChange={(e) => setLine(index, { diagnosisPointer: e.target.value.toUpperCase() })}
            placeholder="A"
            maxLength={4}
            aria-label={`Box 24E diagnosis pointer, line ${index + 1}`}
            style={{ flexGrow: 7, flexBasis: 0 }}
            className={`min-w-0 bg-transparent text-[8.5px] font-semibold text-ink outline-none ${
              rowError("24E", index) ? "outline outline-2 outline-danger" : ""
            }`}
          />
          <input
            inputMode="decimal"
            value={line.charge ? String(line.charge) : ""}
            onChange={(e) => {
              const cleaned = e.target.value.replace(/[^0-9.]/g, "");
              setLine(index, { charge: cleaned === "" ? 0 : Number(cleaned) });
            }}
            placeholder="0.00"
            aria-label={`Box 24F charge, line ${index + 1}`}
            style={{ flexGrow: 11, flexBasis: 0 }}
            className={`min-w-0 bg-transparent text-[8.5px] tabular-nums text-ink outline-none ${
              rowError("24F", index) ? "outline outline-2 outline-danger" : ""
            }`}
          />
          <input
            inputMode="numeric"
            value={line.units ?? 1}
            onChange={(e) => {
              const cleaned = e.target.value.replace(/[^0-9]/g, "");
              setLine(index, { units: cleaned === "" ? 0 : Number(cleaned) });
            }}
            aria-label={`Box 24G units, line ${index + 1}`}
            style={{ flexGrow: 6, flexBasis: 0 }}
            className={`min-w-0 bg-transparent text-[8.5px] tabular-nums text-ink outline-none ${
              rowError("24G", index) ? "outline outline-2 outline-danger" : ""
            }`}
          />
          <input
            value={line.epsdt ?? ""}
            onChange={(e) => setLine(index, { epsdt: e.target.value.toUpperCase() })}
            aria-label={`Box 24H EPSDT family plan code, line ${index + 1}`}
            title="24H EPSDT / family-plan code — blank unless the service was an EPSDT referral."
            style={{ flexGrow: 7, flexBasis: 0 }}
            className="min-w-0 bg-transparent text-[8.5px] text-ink outline-none"
          />
          <select
            value={line.idQualifier ?? "XX"}
            onChange={(e) => setLine(index, { idQualifier: e.target.value })}
            aria-label={`Box 24I ID qualifier, line ${index + 1}`}
            title="24I ID qualifier — the kind of number in 24J. 24J is an NPI, so XX."
            style={{ flexGrow: 8, flexBasis: 0 }}
            className={`min-w-0 bg-transparent text-[8.5px] text-ink outline-none ${
              rowError("24I", index) ? "outline outline-2 outline-danger" : ""
            }`}
          >
            {ID_QUALIFIER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.value}
              </option>
            ))}
          </select>
          <input
            value={line.renderingNpi ?? ""}
            onChange={(e) => setLine(index, { renderingNpi: e.target.value.replace(/\D/g, "").slice(0, 10) })}
            aria-label={`Box 24J rendering provider ID, line ${index + 1}`}
            style={{ flexGrow: 17, flexBasis: 0 }}
            className={`min-w-0 bg-transparent text-[8.5px] tabular-nums text-ink outline-none ${
              rowError("24J", index) ? "outline outline-2 outline-danger" : ""
            }`}
          />
          <button
            onClick={() => removeLine(index)}
            aria-label={`Remove service line ${index + 1}`}
            title="Remove this line"
            className="w-3 shrink-0 text-danger/70 hover:text-danger print:hidden"
          >
            <Trash2 className="h-2.5 w-2.5" />
          </button>
        </div>
      ))}

      <div className="mt-0.5 flex items-center gap-1 print:hidden">
        <button
          onClick={addLine}
          disabled={rows.length >= maxLines}
          className="inline-flex items-center gap-0.5 rounded border border-form-red/50 px-1 py-0.5 text-[7px] font-semibold uppercase tracking-wide text-form-red hover:bg-form-red/10 disabled:cursor-not-allowed disabled:opacity-40"
          title={rows.length >= maxLines ? "The CMS-1500 prints six service lines" : "Add a service line"}
        >
          <Plus className="h-2.5 w-2.5" /> Add line ({rows.length}/{maxLines})
        </button>
        {rows.length >= maxLines && (
          <span className="text-[7px] text-ink-muted">Six lines is the printed maximum — start a second claim.</span>
        )}
      </div>
    </div>
  );

  return (
    <ClaimPaper
      layout={CMS1500_LAYOUT}
      values={values}
      issues={issues}
      set={set}
      table={table}
      note={DEMO_PROVIDER_NOTE}
      demoFields={demoFields}
      readOnly={readOnly}
    />
  );
}
