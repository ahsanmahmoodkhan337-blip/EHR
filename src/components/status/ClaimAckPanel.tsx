/**
 * ClaimAckPanel — the 277CA as the student sees it, on either track.
 *
 * Inspiration: the claim acknowledgement strip in Epic's claim worklist and
 * athenahealth's "Accepted / Rejected" claim status — a clearinghouse answer,
 * not a payer decision. It is drawn from the claim's own timeline
 * (`ackForClaim`), so what it shows survives a reload.
 *
 * The distinction it exists to teach (money-cycle item 9):
 *  - **A1 accepted** — the claim is on the payer's file and awaits adjudication.
 *    Nothing has been paid or denied; the 835 does that.
 *  - **A3 rejected** — the claim never reached adjudication. The 277CA names a
 *    category, an entity and a plain reason, and the claim returns for
 *    correction. There is no CARC, no payment and no patient balance on it.
 */

import { AlertTriangle, CheckCircle2, FileWarning, Wrench } from "lucide-react";
import {
  CLAIM_ACK_CATEGORY_LABELS,
  CLAIM_ACK_ENTITY_LABELS,
  REJECTION_IS_NOT_A_DENIAL,
  type ClaimAck,
  type ClaimTrack,
} from "../../domain/clearinghouse";

export interface ClaimAckPanelProps {
  ack: ClaimAck | null;
  track: ClaimTrack;
  /** Send the student back to the paper to fix the named box. */
  onCorrect?: () => void;
  className?: string;
}

export function ClaimAckPanel({ ack, track, onCorrect, className = "" }: ClaimAckPanelProps) {
  if (!ack) return null;

  const accepted = ack.category === "A1";
  const paper = track === "dental" ? "ADA claim" : "CMS-1500";

  return (
    <section
      aria-live="polite"
      aria-label={`277CA claim acknowledgement — ${CLAIM_ACK_CATEGORY_LABELS[ack.category]}`}
      className={`rounded-xl border ${
        accepted ? "border-emerald-200 bg-emerald-50" : "border-amber-300 bg-amber-50"
      } ${className}`}
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-black/5 px-3 py-2">
        {accepted ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
        ) : (
          <FileWarning className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
        )}
        <h3 className={`text-xs font-bold ${accepted ? "text-emerald-800" : "text-amber-900"}`}>
          277CA {ack.category} — {CLAIM_ACK_CATEGORY_LABELS[ack.category]}
          {accepted ? " by the clearinghouse" : " before adjudication"}
        </h3>
        <span className="ml-auto rounded bg-white/70 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-600">
          {ack.claimNumber}
        </span>
      </header>

      <div className="space-y-1.5 px-3 py-2">
        <p className={`text-[11px] font-medium ${accepted ? "text-emerald-900" : "text-amber-900"}`}>
          {ack.reason}
        </p>

        {!accepted && ack.entity && (
          <p className="text-xs text-amber-800">
            <span className="font-semibold">Entity {ack.entity}</span> —{" "}
            {CLAIM_ACK_ENTITY_LABELS[ack.entity]} · category {ack.category} (rejected)
          </p>
        )}

        {!accepted && ack.rejection && (
          <p className="rounded border border-amber-200 bg-white px-2 py-1 text-xs text-slate-700">
            <span className="font-semibold">Correct box {ack.rejection.box}</span> on the {paper} —{" "}
            {ack.rejection.correction}
          </p>
        )}

        {accepted ? (
          <p className="text-xs text-emerald-800">
            Acceptance is not payment. The payer adjudicates next; its 835 is what pays, part-pays or
            denies the claim and is what creates a patient balance.
          </p>
        ) : (
          <p className="text-xs text-amber-800">{REJECTION_IS_NOT_A_DENIAL}</p>
        )}

        <p className="pt-0.5 font-mono text-[11px] text-slate-500">
          837P {ack.batchControlNumber || "—"} · 277CA {ack.responseControlNumber || "—"}
        </p>

        {!accepted && onCorrect && (
          <button
            type="button"
            onClick={onCorrect}
            aria-label={`Correct box ${ack.rejection?.box ?? ""} on the ${paper} and transmit again`}
            className="mt-1 inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-amber-600 px-3 text-[11px] font-semibold text-white hover:bg-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
          >
            <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
            Correct the claim and resubmit
          </button>
        )}
      </div>
    </section>
  );
}

/** A one-line status chip for headers and rails. */
export function ClaimAckChip({ ack }: { ack: ClaimAck | null }) {
  if (!ack) return null;
  const accepted = ack.category === "A1";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold ${
        accepted ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
      }`}
    >
      {accepted ? (
        <CheckCircle2 className="h-2.5 w-2.5" aria-hidden="true" />
      ) : (
        <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />
      )}
      277CA {ack.category}
    </span>
  );
}
