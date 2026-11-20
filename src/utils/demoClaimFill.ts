/**
 * Demo fill — the builder rule for a claim box that has no captured value.
 *
 * Owner rule (2026-11-20), spec section 2 of
 * `specs/claim-forms-auto-generated.md`. Order of authority, per box:
 *
 *   1. the real value on the claim record;
 *   2. if there is none, the demo value for that box from `demoClaimData.ts`;
 *   3. nothing else — no invented ID, no today's-date stand-in.
 *
 * What this function does NOT do is the important half: it never writes a demo
 * value back onto the claim. It returns a *rendering* copy of the values plus
 * the list of boxes that are showing a demo, so the paper can style them
 * (grey italic + "demo" tag + tooltip naming the real source stage) and the
 * validation panel can count them separately ("N boxes filled with demo data")
 * instead of counting them as clean boxes.
 *
 * The switch `demoFillMissingBoxes` (default on) turns the whole rule off, so
 * an instructor or exam mode can show only what the student actually captured.
 *
 * Inspiration: the "missing data" affordance in Epic Resolute's claim edit —
 * a placeholder the biller can see through, never a value silently invented.
 */

import { DEMO_CLAIM_DATA } from "../data/claims/demoClaimData";

/** A box currently showing a demo value rather than captured data. */
export interface DemoFilledBox {
  /** Claim field the box binds to. */
  field: string;
  /** Printed box number, e.g. "1a". */
  box: string;
  /** Caption for the panel line, e.g. "Box 1a". */
  label: string;
  /** The demo value being shown. */
  value: string;
  /** The stage that should really supply this box. */
  stage: string;
}

export interface DemoFillResult {
  /** Values to render on the paper: real first, demo second. */
  values: Record<string, unknown>;
  /** Demo boxes keyed by claim field — the paper's styling lookup. */
  byField: Record<string, DemoFilledBox>;
  /** Demo boxes in box order — what the validation panel lists. */
  boxes: DemoFilledBox[];
}

/** Nothing captured: absent, null, or a whitespace-only string. */
export function isMissingValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  return false;
}

/**
 * Apply the real-first / demo-second rule to a set of claim values.
 *
 * `enabled` false (the instructor's assessment switch) returns the claim's own
 * values untouched and no demo boxes at all.
 */
export function applyDemoFill(
  values: Record<string, unknown>,
  { enabled = true }: { enabled?: boolean } = {},
): DemoFillResult {
  const byField: Record<string, DemoFilledBox> = {};
  const boxes: DemoFilledBox[] = [];
  const rendered: Record<string, unknown> = { ...values };

  if (enabled) {
    for (const [field, demo] of Object.entries(DEMO_CLAIM_DATA)) {
      if (!isMissingValue(values[field])) continue; // the real value wins
      const filled: DemoFilledBox = {
        field,
        box: demo.box,
        label: `Box ${demo.box}`,
        value: demo.value,
        stage: demo.stage,
      };
      rendered[field] = demo.value;
      byField[field] = filled;
      boxes.push(filled);
    }
  }

  return { values: rendered, byField, boxes };
}

/** "3 boxes filled with demo data" — the panel's summary line. */
export function demoFillSummary(count: number): string {
  if (count <= 0) return "No demo data on this claim";
  return `${count} box${count === 1 ? "" : "es"} filled with demo data`;
}
