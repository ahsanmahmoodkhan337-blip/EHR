/**
 * ADAForm — the ADA Dental Claim Form (2019) replica, on the shared paper.
 *
 * Same shell, same editing model, same validation banner and the same
 * print / PDF path as the medical CMS-1500 replica; only the layout data and
 * box 31's service-line table differ. Box 31 carries the CDT code and the
 * tooth / surface / quadrant detail, which is what makes a dental claim a
 * dental claim.
 *
 * Inspiration: the ADA Dental Claim Form 2019 (J430D) as printed by Dentrix /
 * Eaglesoft and submitted through an ADA clearinghouse.
 */

import { Plus, Trash2 } from "lucide-react";
import { ClaimPaper } from "../claims/ClaimPaper";
import type { ClaimPaperApi } from "../claims/ClaimFormShell";
import { ADA_LAYOUT, ADA_LINE_COLUMNS, type ADAServiceLine } from "../../data/claims/adaLayout";
import { DEMO_PROVIDER_NOTE } from "../../data/claims/providerProfile";

/**
 * The eight printed columns of box 31, with the 837D element each one becomes.
 * The list lives in `adaLayout.ts` so the screen, the paper and the PDF cannot
 * drift apart.
 */
const COLUMNS = ADA_LINE_COLUMNS;

export function ADAForm({ values, lines, set, setLine, addLine, removeLine, issues }: ClaimPaperApi) {
  const rows = lines as unknown as ADAServiceLine[];
  const maxLines = ADA_LAYOUT.maxLines;

  const rowError = (index: number) =>
    issues.some((i) => i.severity === "error" && i.box === "31" && i.message.includes(`line ${index + 1}`));

  const table = (
    <div className="mt-0.5">
      <div className="flex gap-0.5 border-b border-form-red/40 pb-0.5">
        {COLUMNS.map((col) => (
          <div key={col.label} style={{ width: `${col.width * 100}%` }} className="shrink-0">
            <p className="text-[5.5px] font-bold uppercase leading-none text-form-red">{col.label}</p>
            {/* The 837D element this column becomes — same list as the PDF. */}
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
        <div key={`ada-line-${index}`} className="flex items-start gap-0.5 border-b border-form-red/20 py-0.5">
          <input
            type="date"
            value={line.dateOfService ?? ""}
            onChange={(e) => setLine(index, { dateOfService: e.target.value })}
            aria-label={`Box 31 date of service, line ${index + 1}`}
            style={{ width: "12%" }}
            className={`shrink-0 bg-transparent text-[8.5px] text-ink outline-none ${
              rowError(index) ? "outline outline-2 outline-danger" : ""
            }`}
          />
          <input
            value={line.cdt ?? ""}
            onChange={(e) => setLine(index, { cdt: e.target.value.toUpperCase() })}
            placeholder="D2740"
            aria-label={`Box 31 CDT code, line ${index + 1}`}
            style={{ width: "11%" }}
            className="shrink-0 bg-transparent text-[8.5px] font-semibold text-ink outline-none"
          />
          <input
            value={line.description ?? ""}
            onChange={(e) => setLine(index, { description: e.target.value })}
            aria-label={`Box 31 description, line ${index + 1}`}
            style={{ width: "25%" }}
            className="shrink-0 bg-transparent text-[8.5px] text-ink outline-none"
          />
          <input
            value={line.tooth ?? ""}
            onChange={(e) => setLine(index, { tooth: e.target.value })}
            placeholder="30"
            aria-label={`Box 31 tooth, line ${index + 1}`}
            style={{ width: "9%" }}
            className="shrink-0 bg-transparent text-[8.5px] text-ink outline-none"
          />
          <input
            value={line.surface ?? ""}
            onChange={(e) => setLine(index, { surface: e.target.value.toUpperCase() })}
            placeholder="MO"
            aria-label={`Box 31 surface, line ${index + 1}`}
            style={{ width: "10%" }}
            className="shrink-0 bg-transparent text-[8.5px] text-ink outline-none"
          />
          <input
            value={line.quadrant ?? ""}
            onChange={(e) => setLine(index, { quadrant: e.target.value })}
            placeholder="02"
            aria-label={`Box 31 quadrant, line ${index + 1}`}
            style={{ width: "7%" }}
            className="shrink-0 bg-transparent text-[8.5px] text-ink outline-none"
          />
          <input
            inputMode="decimal"
            value={line.fee ? String(line.fee) : ""}
            onChange={(e) => {
              const cleaned = e.target.value.replace(/[^0-9.]/g, "");
              setLine(index, { fee: cleaned === "" ? 0 : Number(cleaned) });
            }}
            placeholder="0.00"
            aria-label={`Box 31 fee, line ${index + 1}`}
            style={{ width: "12%" }}
            className="shrink-0 bg-transparent text-[8.5px] tabular-nums text-ink outline-none"
          />
          <input
            inputMode="numeric"
            value={line.units ?? 1}
            onChange={(e) => {
              const cleaned = e.target.value.replace(/[^0-9]/g, "");
              setLine(index, { units: cleaned === "" ? 0 : Number(cleaned) });
            }}
            aria-label={`Box 31 units, line ${index + 1}`}
            style={{ width: "10%" }}
            className="shrink-0 bg-transparent text-[8.5px] tabular-nums text-ink outline-none"
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
          title={rows.length >= maxLines ? "Six lines is the printed maximum" : "Add a service line"}
        >
          <Plus className="h-2.5 w-2.5" /> Add line ({rows.length}/{maxLines})
        </button>
      </div>
    </div>
  );

  return (
    <ClaimPaper layout={ADA_LAYOUT} values={values} issues={issues} set={set} table={table} note={DEMO_PROVIDER_NOTE} />
  );
}
