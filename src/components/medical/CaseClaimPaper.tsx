/**
 * CaseClaimPaper — the claim paper a graded case prints, drawn from the case's
 * own record.
 *
 * Inspiration: the printed UB-04 (CMS-1450) as it appears in a hospital
 * billing worklist in Epic Resolute — the paper is the claim, so a case that
 * bills a facility shows the facility's form and not a summary table.
 *
 * The paper itself is the app's one claim replica (`claims/ClaimPaper.tsx`) with
 * the UB-04 layout table (`data/claims/ub04Layout.ts`); this component supplies
 * the only part that is a table — locators 42 to 48 — and prints the whole sheet
 * read-only, because a graded case's claim is built from the case, not typed on
 * the sheet. Every value comes from `domain/caseClaimPaper.ts`, so the type of
 * bill and each revenue code can be traced to the case's own record.
 */

import { ClaimPaper } from "../claims/ClaimPaper";
import { UB04_LINE_COLUMNS, UB04_LAYOUT } from "../../data/claims/ub04Layout";
import type { CaseClaimPaper as CaseClaimPaperModel } from "../../domain/caseClaimPaper";

const noop = () => {};

export function CaseClaimPaper({ paper }: { paper: CaseClaimPaperModel }) {
  const totalCharges = paper.lines.reduce((sum, l) => sum + (Number(l.charge) || 0), 0);

  const table = (
    <div className="mt-0.5">
      <div className="flex gap-0.5 border-b border-form-red/40 pb-0.5">
        {UB04_LINE_COLUMNS.map((col) => (
          <div key={col.key} style={{ flexGrow: col.width, flexBasis: 0 }} className="min-w-0">
            <p className="text-[5.5px] font-bold uppercase leading-none text-form-red">{col.label}</p>
            <p
              className="mt-px text-[4.5px] font-semibold uppercase leading-none text-slate-400"
              title={col.x12Note ?? `On an electronic claim this column becomes ${col.x12}.`}
              data-x12-tag={col.x12}
            >
              {col.x12}
            </p>
          </div>
        ))}
      </div>

      {paper.lines.map((line, index) => (
        <div
          key={`${line.cpt}-${index}`}
          className="flex items-start gap-0.5 border-b border-form-red/20 py-0.5"
          data-case-claim-line={index + 1}
          data-revenue-code={line.revenueCode}
        >
          <div style={{ flexGrow: UB04_LINE_COLUMNS[0].width, flexBasis: 0 }} className="min-w-0">
            <p className="text-[7px] text-ink">{line.revenueCode}</p>
          </div>
          <div style={{ flexGrow: UB04_LINE_COLUMNS[1].width, flexBasis: 0 }} className="min-w-0">
            <p className="text-[7px] leading-tight text-ink">{line.revenueDescription}</p>
          </div>
          <div style={{ flexGrow: UB04_LINE_COLUMNS[2].width, flexBasis: 0 }} className="min-w-0">
            <p className="text-[7px] text-ink">
              {line.cpt}
              {line.modifier ? `-${line.modifier}` : ""}
            </p>
          </div>
          <div style={{ flexGrow: UB04_LINE_COLUMNS[3].width, flexBasis: 0 }} className="min-w-0">
            <p className="text-[7px] text-ink">{line.dateOfService}</p>
          </div>
          <div style={{ flexGrow: UB04_LINE_COLUMNS[4].width, flexBasis: 0 }} className="min-w-0">
            <p className="text-[7px] text-ink">{line.units}</p>
          </div>
          <div style={{ flexGrow: UB04_LINE_COLUMNS[5].width, flexBasis: 0 }} className="min-w-0">
            <p className="text-[7px] tabular-nums text-ink">
              {line.charge ? line.charge.toFixed(2) : ""}
            </p>
          </div>
          {/* Locator 48 — non-covered charges. The case records none, so it prints blank. */}
          <div style={{ flexGrow: UB04_LINE_COLUMNS[6].width, flexBasis: 0 }} className="min-w-0">
            <p className="text-[7px] tabular-nums text-ink" />
          </div>
        </div>
      ))}

      <div className="flex justify-end pt-0.5">
        <p className="text-[7px] font-bold tabular-nums text-ink">
          Total charges {totalCharges.toFixed(2)}
        </p>
      </div>
    </div>
  );

  return (
    <ClaimPaper
      layout={UB04_LAYOUT}
      values={paper.values}
      issues={[]}
      set={noop}
      table={table}
      readOnly
      note="Built from this case's own record — teaching data, not a real claim."
    />
  );
}
