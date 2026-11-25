/**
 * payerDirectory — the payers a front desk can pick at booking.
 *
 * One row per plan in the simulator's plan table (`payerScenarios.ts`), with
 * the EDI payer ID a clearinghouse routes the 837P to. Picking a payer from this
 * list means the 271 returns real benefit figures and the 835 prices on that
 * plan's own rules. The IDs are fictional, like the plans — except Medicare
 * Part B, which uses the same 00102 the Tutorial Patient's card prints.
 */

import { MEDICAL_PLANS } from "./payerScenarios";

export interface PayerDirectoryEntry {
  /** As printed on the card and on the claim. */
  payerName: string;
  /** EDI payer ID (CMS-1500 box 1 routing, UB-04 box 51, 837 NM1*PR). */
  ediPayerId: string;
  planType: string;
}

const EDI_IDS: Record<string, string> = {
  "PLAN-CASCADIA-HEALTH-PPO": "CSCD1",
  "PLAN-MEDICARE-PART-B": "00102",
  "PLAN-MERIDIAN-ADVANTAGE": "MRDN1",
  "PLAN-NORTHWIND-MEDICAID": "NWMCD",
  "PLAN-ATLAS-SELECT-PPO": "ATLS1",
  "PLAN-VANGUARD-HMO": "VNGD1",
};

export const PAYER_DIRECTORY: PayerDirectoryEntry[] = MEDICAL_PLANS.map((plan) => ({
  payerName: plan.name,
  ediPayerId: EDI_IDS[plan.id] ?? "",
  planType: plan.planType,
}));

/** The directory row for a payer name, matched case-insensitively. */
export function payerDirectoryEntry(payerName: string): PayerDirectoryEntry | undefined {
  const name = payerName.trim().toLowerCase();
  return PAYER_DIRECTORY.find((p) => p.payerName.toLowerCase() === name);
}
