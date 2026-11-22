/**
 * CaseAdaClaimPaper — the ADA Dental Claim Form 2019 (J430D) a graded dental
 * case prints, read-only, from the case's own record.
 *
 * Inspiration: the printed ADA claim on a Dentrix / Eaglesoft billing
 * worklist — the paper is the claim, so a case that already recorded its tooth,
 * surface, quadrant and fee shows the payer's form rather than a form the
 * student types into. It is the dental counterpart of
 * `components/medical/CaseClaimPaper.tsx`, which prints the UB-04 for a
 * facility medical case.
 *
 * The paper itself is the app's one claim replica (`claims/ClaimPaper.tsx`) with
 * the ADA layout table (`data/claims/adaLayout.ts`); this component supplies the
 * only part that is a table — box 31 — and prints the whole sheet read-only.
 * Every value comes from `domain/dentalCaseClaimPaper.ts`, so each tooth,
 * surface, quadrant and fee can be traced to the case's own record.
 */

import { ClaimPaper } from "../claims/ClaimPaper";
import { ADA_LINE_COLUMNS, ADA_LAYOUT } from "../../data/claims/adaLayout";
import type { DentalCaseClaimPaper as DentalCaseClaimPaperModel } from "../../domain/dentalCaseClaimPaper";

const noop = () => {};

export function CaseAdaClaimPaper({ paper }: { paper: DentalCaseClaimPaperModel }) {
  const totalFee = paper.lines.reduce((sum, l) => sum + (Number(l.fee) || 0), 0);

  const table = (
    <div className="mt-0.5">
      <div className="flex gap-0.5 border-b border-form-red/40 pb-0.5">
        {ADA_LINE_COLUMNS.map((col) => (
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
          key={`${line.cdt}-${index}`}
          className="flex items-start gap-0.5 border-b border-form-red/20 py-0.5"
          data-case-claim-line={index + 1}
          data-cdt={line.cdt}
        >
          <div style={{ flexGrow: ADA_LINE_COLUMNS[0].width, flexBasis: 0 }} className="min-w-0">
            <p className="text-[7px] text-ink">{line.dateOfService}</p>
          </div>
          <div style={{ flexGrow: ADA_LINE_COLUMNS[1].width, flexBasis: 0 }} className="min-w-0">
            <p className="text-[7px] font-semibold text-ink">{line.cdt}</p>
          </div>
          <div style={{ flexGrow: ADA_LINE_COLUMNS[2].width, flexBasis: 0 }} className="min-w-0">
            <p className="text-[7px] leading-tight text-ink">{line.description}</p>
          </div>
          <div style={{ flexGrow: ADA_LINE_COLUMNS[3].width, flexBasis: 0 }} className="min-w-0">
            <p className="text-[7px] text-ink">{line.tooth}</p>
          </div>
          <div style={{ flexGrow: ADA_LINE_COLUMNS[4].width, flexBasis: 0 }} className="min-w-0">
            <p className="text-[7px] text-ink">{line.surface}</p>
          </div>
          <div style={{ flexGrow: ADA_LINE_COLUMNS[5].width, flexBasis: 0 }} className="min-w-0">
            <p className="text-[7px] text-ink">{line.quadrant}</p>
          </div>
          <div style={{ flexGrow: ADA_LINE_COLUMNS[6].width, flexBasis: 0 }} className="min-w-0">
            <p className="text-[7px] tabular-nums text-ink">{line.fee ? line.fee.toFixed(2) : ""}</p>
          </div>
          <div style={{ flexGrow: ADA_LINE_COLUMNS[7].width, flexBasis: 0 }} className="min-w-0">
            <p className="text-[7px] tabular-nums text-ink">{line.units}</p>
          </div>
        </div>
      ))}

      {paper.lines.length === 0 && (
        <p className="py-1 text-[7px] text-ink-muted">No claim lines yet — code the case's procedures first.</p>
      )}

      <div className="flex justify-end pt-0.5">
        <p className="text-[7px] font-bold tabular-nums text-ink">Total fee {totalFee.toFixed(2)}</p>
      </div>
    </div>
  );

  return (
    <ClaimPaper
      layout={ADA_LAYOUT}
      values={paper.values}
      issues={[]}
      set={noop}
      table={table}
      readOnly
      note="Built from this case's own record — teaching data, not a real claim."
    />
  );
}
