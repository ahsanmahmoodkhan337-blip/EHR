/**
 * MoneyNotYet — what the money stages show before the claim has been sent.
 *
 * Inspired by: Epic's and athenahealth's empty remittance and AR worklists,
 * which say which step produces the money rather than printing a zero balance
 * as if it were an answer.
 *
 * Owner's ruling, 2026-11-23 — *"all information should be pre filled"* and
 * *"in billing section it should not be submitted, the CMS-1500 should be filled
 * and student should submit too … himself"*. So the Tutorial Patient's chart
 * opens with a filled, unsubmitted claim and **no money at all**: no 277CA, no
 * 835, no posting and therefore no AR row (`domain/tutorialClaim.ts`). Payments
 * (835) and Denials & AR used to answer that with an empty table, a zero total
 * or an amber "no remittance backs this claim" panel — money-shaped furniture
 * with nothing behind it, which reads as a broken screen.
 *
 * This component replaces that with one honest sentence per stage, naming the
 * step that produces the money and where it is taken. It shows **only** while
 * the record holds nothing: the moment a real 835 or a real AR row exists, the
 * stage draws that instead (`RemittancePanel`, `PatientLedgerPanel`,
 * `ArWorkQueuePanel`).
 *
 * The look is the 19 November build's: `.clinical-card`, the slate type scale,
 * a lucide icon at 3.5, no new palette and no new spacing.
 */

import { Clock3, Receipt } from "lucide-react";

/** Which money stage is asking. */
export type MoneyStage = "payments" | "denials-ar";

export interface MoneyNotYetProps {
  stage: MoneyStage;
  /**
   * True once the claim has left draft. The sentence then names the step that
   * is still missing (adjudicate, then post) instead of asking for a Submit the
   * student has already pressed.
   */
  claimSubmitted?: boolean;
  /** `card` where the stage is the whole screen, `inline` inside a panel. */
  variant?: "card" | "inline";
  className?: string;
}

interface Copy {
  title: string;
  body: string;
}

/** One sentence per stage, and per step the student has already taken. */
export function moneyNotYetCopy(stage: MoneyStage, claimSubmitted = false): Copy {
  if (stage === "payments") {
    if (claimSubmitted) {
      return {
        title: "Not yet — adjudicate this claim",
        body: "The claim has been sent and the clearinghouse accepted it. Press Adjudicate this claim: the payer prices every line against the plan's own rules, and its 835 is what allows, pays, adjusts or denies the money. Nothing reaches the ledger until that 835 is posted.",
      };
    }
    return {
      title: "Not yet — press Submit on Billing first",
      body: "This stage carries the payer's 835, and there is none until the claim has gone out: press Submit on the Billing / Claim stage, then press Adjudicate this claim here. Nothing has been allowed, paid, adjusted or posted, so there is no money to show.",
    };
  }
  if (claimSubmitted) {
    return {
      title: "Not yet — adjudicate on Payments (835), then post the 835",
      body: "The claim is with the payer and no 835 has come back. Adjudicate the claim on the Payments (835) stage and post the remittance: a denial or a patient balance reaches this queue only from a posted 835, never from a guess.",
    };
  }
  return {
    title: "Not yet — press Submit on Billing first",
    body: "This queue holds money a payer refused or a patient still owes, and it fills from a posted 835: press Submit on the Billing / Claim stage, adjudicate the claim on Payments (835), then post the 835. Until then there is no denial, no balance and no AR row.",
  };
}

export function MoneyNotYet({
  stage,
  claimSubmitted = false,
  variant = "card",
  className = "",
}: MoneyNotYetProps) {
  const copy = moneyNotYetCopy(stage, claimSubmitted);
  const Icon = stage === "payments" ? Receipt : Clock3;
  return (
    <div
      data-testid={`money-not-yet-${stage}`}
      className={
        variant === "card"
          ? `clinical-card ${className}`
          : `px-3 py-4 ${className}`
      }
    >
      <p className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
        <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
        {copy.title}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">{copy.body}</p>
    </div>
  );
}
