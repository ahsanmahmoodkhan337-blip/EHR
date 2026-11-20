/**
 * CMS1500Form — the paper itself: the CMS-1500 (02/12) replica.
 *
 * Draws the 33 printed boxes from `cms1500Layout.ts` through the shared
 * `ClaimPaper`, and supplies the one part that is a table rather than a box:
 * box 24's six service lines (24A date, 24B place of service, 24D CPT +
 * modifier, 24E diagnosis pointer, 24F charge, 24G units, 24J rendering NPI).
 *
 * Boxes 22 / 22a are always enabled and only meaningful for a corrected claim,
 * as on the real form — no gating.
 *
 * Inspiration: the NUCC CMS-1500 Health Insurance Claim Form (02/12).
 */

import { Plus, Trash2 } from "lucide-react";
import { ClaimPaper } from "../claims/ClaimPaper";
import type { ClaimPaperApi } from "../claims/ClaimFormShell";
import { CMS1500_LAYOUT, POS_CODE_OPTIONS } from "../../data/claims/cms1500Layout";
import { DEMO_PROVIDER_NOTE } from "../../data/claims/providerProfile";
import type { ClaimServiceLine } from "../../store/pipelineStore";

const COLUMNS: { key: keyof ClaimServiceLine | "modifiers"; label: string; width: string }[] = [
  { key: "dateOfService", label: "24A · DATE(S)", width: "15%" },
  { key: "placeOfService", label: "24B · POS", width: "9%" },
  { key: "cpt", label: "24D · CPT/HCPCS", width: "15%" },
  { key: "modifiers", label: "24D · MOD", width: "13%" },
  { key: "diagnosisPointer", label: "24E · PTR", width: "10%" },
  { key: "charge", label: "24F · CHARGE", width: "13%" },
  { key: "units", label: "24G · UNITS", width: "7%" },
  { key: "renderingNpi", label: "24J · NPI", width: "18%" },
];

export function CMS1500Form({ values, lines, set, setLine, addLine, removeLine, issues }: ClaimPaperApi) {
  const rows = lines as unknown as ClaimServiceLine[];
  const maxLines = CMS1500_LAYOUT.maxLines;

  const rowError = (box: string, index: number) =>
    issues.some((i) => i.severity === "error" && i.box === box && i.message.includes(`line ${index + 1}`));

  const table = (
    <div className="mt-0.5">
      <div className="flex gap-0.5 border-b border-form-red/40 pb-0.5">
        {COLUMNS.map((col) => (
          <p key={col.label} style={{ width: col.width }} className="shrink-0 text-[5.5px] font-bold uppercase leading-none text-form-red">
            {col.label}
          </p>
        ))}
        <span className="w-3 shrink-0 print:hidden" aria-hidden />
      </div>

      {rows.map((line, index) => (
        <div key={`line-${index}`} className="flex items-start gap-0.5 border-b border-form-red/20 py-0.5">
          <input
            type="date"
            value={line.dateOfService ?? ""}
            onChange={(e) => setLine(index, { dateOfService: e.target.value })}
            aria-label={`Box 24A date of service, line ${index + 1}`}
            style={{ width: "15%" }}
            className={`shrink-0 bg-transparent text-[8.5px] text-ink outline-none ${
              rowError("24A", index) ? "outline outline-2 outline-danger" : ""
            }`}
          />
          <select
            value={line.placeOfService ?? "11"}
            onChange={(e) => setLine(index, { placeOfService: e.target.value })}
            aria-label={`Box 24B place of service, line ${index + 1}`}
            style={{ width: "9%" }}
            className={`shrink-0 bg-transparent text-[8.5px] text-ink outline-none ${
              rowError("24B", index) ? "outline outline-2 outline-danger" : ""
            }`}
          >
            {POS_CODE_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <input
            value={line.cpt ?? ""}
            onChange={(e) => setLine(index, { cpt: e.target.value.toUpperCase() })}
            placeholder="99214"
            aria-label={`Box 24D CPT code, line ${index + 1}`}
            style={{ width: "15%" }}
            className={`shrink-0 bg-transparent text-[8.5px] text-ink outline-none ${
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
            style={{ width: "13%" }}
            className="shrink-0 bg-transparent text-[8.5px] text-ink outline-none"
          />
          <input
            value={line.diagnosisPointer ?? ""}
            onChange={(e) => setLine(index, { diagnosisPointer: e.target.value.toUpperCase() })}
            placeholder="A"
            maxLength={4}
            aria-label={`Box 24E diagnosis pointer, line ${index + 1}`}
            style={{ width: "10%" }}
            className={`shrink-0 bg-transparent text-[8.5px] font-semibold text-ink outline-none ${
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
            style={{ width: "13%" }}
            className={`shrink-0 bg-transparent text-[8.5px] tabular-nums text-ink outline-none ${
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
            style={{ width: "7%" }}
            className={`shrink-0 bg-transparent text-[8.5px] tabular-nums text-ink outline-none ${
              rowError("24G", index) ? "outline outline-2 outline-danger" : ""
            }`}
          />
          <input
            value={line.renderingNpi ?? ""}
            onChange={(e) => setLine(index, { renderingNpi: e.target.value.replace(/\D/g, "").slice(0, 10) })}
            aria-label={`Box 24J rendering NPI, line ${index + 1}`}
            style={{ width: "18%" }}
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

  return <ClaimPaper layout={CMS1500_LAYOUT} values={values} issues={issues} set={set} table={table} note={DEMO_PROVIDER_NOTE} />;
}
