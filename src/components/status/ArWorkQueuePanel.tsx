/**
 * ArWorkQueuePanel — the AR work queue, on top of the patient ledger.
 *
 * Inspiration: the AR follow-up worklist behind every practice management
 * system (Epic's claim workqueue, eClinicalWorks' AR worklist, athenahealth's
 * denial queue). Each row is one piece of money that has not been settled: a
 * line a posted 835 refused, or a balance the patient still owes — with its age,
 * its bucket and its appeal deadline.
 *
 * Money-cycle slice 3 (`specs/task-5-posting-denials-ar.md`). Two rules this
 * screen keeps:
 *
 *  1. **Every figure traces to an 835 or a ledger entry.** The amount on a row
 *     is the group+CARC money the payer refused, or the ledger's own patient
 *     balance. Nothing is typed, nothing is estimated.
 *  2. **The student decides before the app answers.** A row shows the facts and
 *     the four actions and nothing else — no recommended action, no verdict. The
 *     effect of the action the student picked is shown at the confirmation step,
 *     and what it actually did to the ledger is shown after they commit.
 *
 * Clearing a row calls one store action that writes ledger entries; the row then
 * shows the entries it wrote, so the student can see the money move.
 */

import { useId, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, Clock3, DollarSign } from "lucide-react";
import {
  AGING_BUCKETS,
  AR_ACTION_EFFECTS,
  AR_ACTION_LABELS,
  arQueueTotals,
  type ArAction,
  type ArWorkItem,
} from "../../domain/arWorkQueue";
import { CARC_BY_CODE } from "../../data/claims/carc";
import { usePipeline } from "../../store/pipelineStore";
import { ReadOnlyNote, readOnlyAttrs, readOnlyNoteId } from "../shell/ReadOnlyStage";
import { refuseReadOnly } from "../../domain/tutorialReadOnly";
import { MoneyNotYet } from "./MoneyNotYet";

function money(cents: number): string {
  return `$${(Math.abs(cents) / 100).toFixed(2)}`;
}

/** The CARCs a contractual write-off may be taken under in this simulation. */
const WRITE_OFF_REASONS = ["CO-45", "CO-4", "CO-18", "CO-29", "CO-197", "CO-236"];

type Filter = "open" | "denial" | "balance" | "cleared";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "denial", label: "Denied lines" },
  { key: "balance", label: "Patient balances" },
  { key: "cleared", label: "Cleared" },
];

export interface ArWorkQueuePanelProps {
  /**
   * The Tutorial Patient's chart is the standard reference and cannot be
   * changed. Every action in this queue writes money to the ledger, so on that
   * chart the buttons are disabled and carry the reason instead of taking the
   * click and dropping it.
   */
  readOnly?: boolean;
  /**
   * True once the active claim has left draft. With no item in the queue, the
   * panel then names the step still missing (adjudicate, then post) rather than
   * asking for a Submit the student has already pressed.
   */
  claimSubmitted?: boolean;
  className?: string;
}

export function ArWorkQueuePanel({ readOnly = false, claimSubmitted = false, className = "" }: ArWorkQueuePanelProps) {
  const headingId = useId();
  const { arWorkItems, resolveArItem, updateArItemWork, getEncounter } = usePipeline();
  const [filter, setFilter] = useState<Filter>("open");
  const [pending, setPending] = useState<{ itemId: string; action: ArAction } | null>(null);
  const [reasonCode, setReasonCode] = useState(WRITE_OFF_REASONS[0]);
  const [note, setNote] = useState("");

  const totals = arQueueTotals(arWorkItems);
  const visible = arWorkItems.filter((item) => {
    if (filter === "cleared") return item.status === "resolved";
    if (item.status === "resolved") return false;
    if (filter === "denial") return item.kind === "denial";
    if (filter === "balance") return item.kind === "balance";
    return true;
  });

  const entriesWritten = (item: ArWorkItem) =>
    (getEncounter(item.patientId)?.ledger ?? []).filter((e) => e.id.includes(`-ar-${item.id}-`));

  const startAction = (item: ArWorkItem, action: ArAction) => {
    if (readOnly) {
      refuseReadOnly("The AR action");
      return;
    }
    setPending({ itemId: item.id, action });
    setReasonCode(item.carc && WRITE_OFF_REASONS.includes(item.carc) ? item.carc : WRITE_OFF_REASONS[0]);
    setNote("");
  };

  const commit = (item: ArWorkItem) => {
    if (!pending || pending.itemId !== item.id) return;
    // Clearing a row writes ledger entries. The standard chart refuses it.
    if (readOnly) {
      refuseReadOnly("The AR action");
      return;
    }
    resolveArItem({
      itemId: item.id,
      action: pending.action,
      ...(pending.action === "write_off" ? { reasonCode } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    });
    setPending(null);
    setNote("");
  };

  return (
    <section
      aria-labelledby={headingId}
      className={`rounded-xl border border-slate-200 bg-white ${className}`}
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
        <ClipboardList className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
        <h3 id={headingId} className="text-xs font-bold text-slate-800">
          AR work queue
        </h3>
        <span className="ml-auto rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
          {visible.length} shown
        </span>
      </header>

      {/* Two totals, never added together: refused money is not patient money.
          With no posted 835 there is no money to total, and "0 · $0.00" is a
          figure with nothing behind it — the not-yet sentence below says why. */}
      {arWorkItems.length > 0 && (
        <dl className="grid grid-cols-1 gap-2 border-b border-slate-100 px-3 py-2 text-[10px] sm:grid-cols-2">
          <div className="flex items-baseline gap-1.5">
            <dt className="text-slate-400">Denied lines</dt>
            <dd className="font-semibold tabular-nums text-slate-700">
              {totals.denialCount} · {money(totals.denialCents)}
            </dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-slate-400">Patient balances</dt>
            <dd className="font-semibold tabular-nums text-slate-700">
              {totals.balanceCount} · {money(totals.balanceCents)}
            </dd>
          </div>
        </dl>
      )}

      <div role="group" aria-label="Filter the work queue" className="flex flex-wrap gap-1 border-b border-slate-100 px-3 py-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={`inline-flex min-h-[40px] items-center rounded-lg px-2.5 text-[10px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 ${
              filter === f.key ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        arWorkItems.length === 0 ? (
          /* No posted 835 anywhere yet: the queue names the step that produces
             its first row instead of printing an empty table of zeroes. */
          <MoneyNotYet stage="denials-ar" claimSubmitted={claimSubmitted} variant="inline" />
        ) : (
          <p className="px-3 py-4 text-[10px] leading-relaxed text-slate-500">
            Nothing in this filter. The queue holds {arWorkItems.length} item
            {arWorkItems.length === 1 ? "" : "s"} — switch the filter above to see them.
          </p>
        )
      ) : (
        <ul className="divide-y divide-slate-100">
          {visible.map((item) => {
            const isPending = pending?.itemId === item.id;
            // The reason sits under this claim's own buttons, not in a banner at
            // the top of the panel: a control with its sentence a scroll away
            // reads as a dead button.
            const reasonId = readOnlyNoteId(`ar-${item.id}`);
            const written = entriesWritten(item);
            return (
              <li key={item.id} className="px-3 py-2.5">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-mono text-[11px] font-bold text-slate-800">{item.claimNumber}</span>
                  <span className="text-[10px] text-slate-500">
                    {item.patientName || (item.patientId ? `Patient ${item.patientId}` : "No patient attached")}
                    {item.payerName ? ` · ${item.payerName}` : ""}
                  </span>
                  <span className="ml-auto text-[11px] font-bold tabular-nums text-slate-800">
                    {money(item.amountCents)}
                  </span>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-600">
                  <span
                    className={`rounded px-1.5 py-0.5 font-semibold ${
                      item.kind === "denial" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {item.kind === "denial" ? "Denied line" : "Patient balance"}
                  </span>
                  {item.kind === "denial" ? (
                    <span className="font-mono">
                      {item.group}-{item.carc?.replace(/^[A-Z]{2}-/, "")}
                      {item.cpt ? ` · CPT ${item.cpt}` : ""}
                      {item.lineNumber !== undefined ? ` · line ${item.lineNumber}` : ""}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-3 w-3" aria-hidden="true" />
                    {item.ageDays} days · {item.bucket}
                  </span>
                  <span>Appeal by {item.appealDeadline}</span>
                  <span className="text-slate-400">
                    Patient balance on this claim {money(item.patientBalanceCents)}
                  </span>
                </div>

                {item.kind === "denial" && item.carc && CARC_BY_CODE[item.carc] ? (
                  <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                    {CARC_BY_CODE[item.carc].description}
                  </p>
                ) : null}

                {item.status === "resolved" ? (
                  <div className="mt-1.5 rounded-lg bg-green-50 px-2 py-1.5">
                    <p className="flex items-center gap-1 text-[10px] font-semibold text-green-800">
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      Cleared — {item.action ? AR_ACTION_LABELS[item.action] : "resolved"}
                      {item.reasonCode ? ` (${item.reasonCode})` : ""}
                    </p>
                    {written.length > 0 ? (
                      <ul className="mt-1 space-y-0.5">
                        {written.map((e) => (
                          <li key={e.id} className="text-[10px] text-green-900">
                            {e.type.replace("_", " ")} · {e.code} · {e.amountCents < 0 ? "−" : "+"}
                            {money(e.amountCents)} — {e.description}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-[10px] text-green-900">
                        No ledger entry was written: the 835 had already settled this money.
                      </p>
                    )}
                    <p className="mt-1 text-[10px] text-green-900">
                      Patient balance on this claim now {money(item.patientBalanceCents)}.
                    </p>
                  </div>
                ) : isPending ? (
                  <div className="mt-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2 py-1.5">
                    <p className="text-[10px] font-semibold text-brand-800">
                      {AR_ACTION_LABELS[pending.action]} on {item.claimNumber}
                    </p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-brand-900">
                      {AR_ACTION_EFFECTS[pending.action]}
                    </p>
                    {pending.action === "write_off" ? (
                      <label className="mt-1.5 block text-[10px] font-medium text-brand-900">
                        Reason code for the write-off
                        <select
                          value={reasonCode}
                          onChange={(e) => setReasonCode(e.target.value)}
                          className="mt-0.5 block min-h-[40px] w-full rounded border border-brand-300 bg-white px-2 text-[11px] text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
                        >
                          {WRITE_OFF_REASONS.map((code) => (
                            <option key={code} value={code}>
                              {code} — {CARC_BY_CODE[code]?.description ?? "adjustment"}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <label className="mt-1.5 block text-[10px] font-medium text-brand-900">
                      Note (optional)
                      <input
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="What you did, and what you expect next"
                        className="mt-0.5 block min-h-[40px] w-full rounded border border-brand-300 bg-white px-2 text-[11px] text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
                      />
                    </label>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => commit(item)}
                        aria-label={`Confirm ${AR_ACTION_LABELS[pending.action].toLowerCase()} for ${item.claimNumber}`}
                        className="inline-flex min-h-[40px] items-center rounded-lg bg-brand-600 px-3 text-[10px] font-semibold text-white hover:bg-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                        {...readOnlyAttrs(readOnly, reasonId)}
                      >
                        Confirm and post
                      </button>
                      <button
                        type="button"
                        onClick={() => setPending(null)}
                        aria-label={`Cancel working ${item.claimNumber}`}
                        className="inline-flex min-h-[40px] items-center rounded-lg bg-white px-3 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {item.actions.map((action) => (
                        <button
                          key={action}
                          type="button"
                          onClick={() => startAction(item, action)}
                          aria-label={`${AR_ACTION_LABELS[action]} on ${item.claimNumber}`}
                          className="inline-flex min-h-[40px] items-center rounded-lg bg-slate-100 px-2.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
                          {...readOnlyAttrs(readOnly, reasonId)}
                        >
                          {AR_ACTION_LABELS[action]}
                        </button>
                      ))}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (readOnly) {
                            refuseReadOnly("The AR work item");
                            return;
                          }
                          updateArItemWork({ itemId: item.id, status: "in-progress" });
                        }}
                        aria-label={`Mark ${item.claimNumber} in progress`}
                        className="inline-flex min-h-[40px] items-center rounded-lg px-2 text-[10px] font-medium text-slate-500 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
                        {...readOnlyAttrs(readOnly, reasonId)}
                      >
                        {item.status === "in-progress" ? "In progress" : "Mark in progress"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (readOnly) {
                            refuseReadOnly("The AR work item");
                            return;
                          }
                          updateArItemWork({ itemId: item.id, status: "escalated" });
                        }}
                        aria-label={`Escalate ${item.claimNumber}`}
                        className="inline-flex min-h-[40px] items-center gap-1 rounded-lg px-2 text-[10px] font-medium text-slate-500 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
                        {...readOnlyAttrs(readOnly, reasonId)}
                      >
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                        {item.status === "escalated" ? "Escalated" : "Escalate"}
                      </button>
                    </div>
                  </>
                )}
                <ReadOnlyNote readOnly={readOnly} id={reasonId} />
              </li>
            );
          })}
        </ul>
      )}

      <footer className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 px-3 py-2 text-[10px] text-slate-400">
        <DollarSign className="h-3 w-3" aria-hidden="true" />
        Every amount here comes from a posted 835 or from the patient ledger. Buckets:{" "}
        {AGING_BUCKETS.join(" · ")} days.
      </footer>
    </section>
  );
}
