/**
 * DentalRemittance.tsx — the 835 (ERA) side of the money cycle
 *
 * Inspired by: the ERA / remittance posting screen a dental biller works in
 * Dentrix and Open Dental — read the payer's 835 line by line, post it, and the
 * patient ledger underneath is the result. Nothing here adjudicates; the payer's
 * answer was decided when the claim was transmitted.
 *
 * Spec `sidebar-stage-fixes.md`, defect 2: the money path runs **Claim →
 * Remittance → AR**. Building the claim, the ADA form, the 277CA and the claim
 * timeline belong to Claim; this claim's 835, the sample ERAs and the posting
 * belong here; AR chases whatever is left after posting. The posting button used
 * to sit inside Claim, which made AR's "Post to ledger" a step that ran
 * backwards — it is here now, in the order the work happens.
 */

import { FileText } from "lucide-react";
import { useMemo } from "react";
import { ERA_REMITTANCES } from "../../data/dental";
import { buildDentalClaimRemittance } from "../../domain/dentalRemittance";
import { adjudicateDentalClaim } from "./adjudication";
import { DentalEraRemittance } from "./DentalEraRemittance";
import { useDentalTrack } from "./DentalTrackStore";

export function DentalRemittance() {
  const { state, activeCase, planId, postRemittance, isRemittancePosted } = useDentalTrack();
  const adjudication = useMemo(() => adjudicateDentalClaim(state.lines, activeCase), [state.lines, activeCase]);

  const remittances = useMemo(() => ERA_REMITTANCES.filter((r) => r.payerPlanId === planId), [planId]);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  /**
   * This claim's own 835. Built from the adjudication, never from a sample: one
   * line per CDT code, with the group code + CARC behind every adjustment, and
   * the claim number the clearinghouse accepted. This is the only remittance on
   * this screen that can be posted.
   */
  const claimRemittance = useMemo(() => {
    if (!state.claimSubmitted || !state.claimNumber || !activeCase || adjudication.lines.length === 0) {
      return null;
    }
    return buildDentalClaimRemittance({
      claimNumber: state.claimNumber,
      payerPlanId: planId,
      patientName: `${activeCase.patient.firstName} ${activeCase.patient.lastName}`,
      remittanceDate: today,
      lines: adjudication.lines.map((line, index) => ({
        line: index + 1,
        code: line.code,
        tooth: line.claimLine.tooth,
        dateOfService: line.claimLine.dateOfService,
        result: line.result,
        denial: line.denial,
      })),
    });
  }, [state.claimSubmitted, state.claimNumber, activeCase, planId, adjudication.lines, today]);

  return (
    <div className="p-4">
      {claimRemittance ? (
        <>
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">835 remittance for this claim</h3>
              <p className="text-[10px] text-slate-400">
                The payer's answer on {claimRemittance.claimControlNumber}. Read it, then post it to the patient
                ledger below.
              </p>
            </div>
            <span className="rounded bg-teal-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-700">
              {claimRemittance.lines.length} line{claimRemittance.lines.length === 1 ? "" : "s"}
            </span>
          </div>
          <DentalEraRemittance
            remittance={claimRemittance}
            onPost={() => postRemittance(claimRemittance)}
            posted={isRemittancePosted(claimRemittance)}
          />
        </>
      ) : (
        <div className="empty-state">
          <FileText className="mx-auto mb-2 h-6 w-6 text-slate-300" />
          <p className="empty-hint">
            No 835 yet. The payer answers once the claim has been transmitted from the Claim stage.
          </p>
        </div>
      )}

      {claimRemittance && remittances.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Sample ERAs — practice reading</h3>
              <p className="text-[10px] text-slate-400">
                Extra 835s to read and reconcile. They belong to other patients and other claims, so they are
                read-only — nothing here can be posted to this patient's ledger.
              </p>
            </div>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
              {remittances.length} sample{remittances.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="space-y-3">
            {remittances.map((r) => (
              <DentalEraRemittance key={r.id} remittance={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
