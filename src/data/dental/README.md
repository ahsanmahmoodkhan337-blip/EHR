# Dental RCM Data Layer

Content layer for the dental track. **Data only** — nothing in this directory
imports React or touches UI.

| File | What it holds |
| --- | --- |
| `cdtCodes.ts` | CDT teaching subset (99 codes) with original descriptions, claim-line requirements, illustrative fees, attachment expectations and links to likely denials |
| `benefitRules.ts` | Three fictional payer plans: annual maximum, deductible, coinsurance by class, frequency limits, age limits, waiting periods, missing tooth clause, alternate benefit provisions, coordination of benefits, plus the 12-step adjudication order |
| `denialReasons.ts` | 39 dental denial scenarios with ordered corrective actions, appealability, and whether the balance is patient-billable |
| `caseScenarios.ts` | Nine graded cases (beginner / intermediate / advanced) with deliberate traps, expected line-by-line adjudication and grading rubrics |
| `toothNotation.ts` | Universal / FDI / Palmer cross-reference for all 52 teeth, surfaces, quadrants, oral-cavity areas, and a surface validator |
| `coverage.ts` | Runnable adjudication engine — `evaluateCoverage()` for one claim line, `evaluateClaim()` for a whole claim, returning a verdict per step of `ADJUDICATION_ORDER` |
| `attachmentRequirements.ts` | Structured map from CDT code → required attachments (radiographs, perio charting, narrative, …) plus the predetermination-candidate list with per-code guidance |
| `predeterminationRules.ts` | Three predetermination scenarios: the payer's line-by-line estimate (allowed / downgraded / excluded / frequency-limited) and the trap around requesting one vs submitting directly |
| `eraRemittance.ts` | Three sample ERA (835) remittances with line-level CAS adjustments, plus three denial-depth scenarios (missing attachment, COB, non-covered) wired to existing codes and plans |

Import from the barrel:

```ts
import { CDT_CODES, DENTAL_PLANS, DENTAL_CASE_SCENARIOS, findTooth, evaluateClaim, attachmentsForCode, PREDETERMINATION_SCENARIOS } from "~/data/dental";
```

## The evaluator is the entry point for adjudication

`coverage.ts` walks the twelve steps of `ADJUDICATION_ORDER` in the order a payer applies
them and returns `{ step, rule, verdict, reason }` for each, so a student sees exactly where
a claim died. Use `evaluateClaim()` for anything multi-line: it threads the deductible and
the consumed annual maximum from one line to the next, which changes each line's patient
share even though the claim total is fixed.

Contracted allowances are **inputs**, not derived. No fee schedule ships with this repo, and
inventing one would teach students false numbers. Where an allowance is not supplied the
evaluator uses the charged amount and says so in the step reason.

## Copyright rules — read before editing

**CDT codes and their official nomenclature and descriptors are copyright of
the American Dental Association.** This repository does not hold a CDT licence.

- Every `shortName` and `teachingDescription` in `cdtCodes.ts` is original
  teaching text written for this simulator.
- Code identifiers (`D2740`) are used as references only.
- If you add a code, **write your own description**. Do not paste from a CDT
  manual, a practice-management export, or a payer bulletin. If you cannot
  describe a code in your own words, leave it out.
- The same rule applies to CPT and ICD-10 content on the medical side.

## Accuracy rules

- **Fees are illustrative.** Every `illustrativeFeeUsd` and `allowedUsd` is a
  plausible teaching placeholder, not a fee schedule and not any payer's
  allowable. Do not present them to students as real.
- **Payers are fictional.** Cascadia Dental Guard, Meridian Smile Choice and
  Northwind Union Dental Trust do not exist. Their rule values are modelled on
  the *shape* of common US plan designs so the mechanics are learnable. Never
  attach a real insurer's name to a simulated policy.
- **CARC codes** in `denialReasons.ts` are from the X12 standard set; the
  plain-language text is original, and the mapping of a dental situation to a
  particular CARC reflects common practice, which varies by payer.
- Students will do this work for money. A wrong rule teaches a harmful habit —
  prefer omitting something over inventing it.

## Predetermination & attachment workflow

`attachmentRequirements.ts` and `predeterminationRules.ts` are the content half of
the predetermination / attachment-requirement UI (business-plan item 4). The
frontend should drive from these two files rather than from the loose
`CDTCode.commonAttachments` hint.

### How the UI should consume it

1. **When the treatment plan changes**, for each planned CDT code call
   `attachmentsForCode(code)` and show the result as the "what to attach" list.
   Each `AttachmentRequirement` carries `type` (for an icon/category),
   `when`/`condition` (always vs conditional), `whyRequired` (the plain-language
   reason to show the student), and `missingDenialId` (the denial the payer
   returns if the attachment is skipped).
2. **When deciding predetermine-vs-submit**, call
   `isPredeterminationCandidate(code)` and, for the reason, read the matching
   `PREDETERMINATION_CANDIDATES` entry's `driver` and `guidance`. The five
   drivers are `high-fee`, `cosmetic`, `removable-appliance`, `surgical` and
   `frequency-sensitive`.
3. **The scenarios are the teaching layer.** `PREDETERMINATION_SCENARIOS`
   supplies three complete walks of the estimate workflow, each with a
   line-by-line estimate (`estimate`) whose verdicts cover `allowed`,
   `downgraded`, `excluded` and `frequency-limited`, plus a `trap` that states
   the mistake, its consequence and the correct action. Render these as
   interactive exercises; the estimate lines are already arithmetic-consistent
   so a "did the student catch the downgrade?" check can be computed.

### Schema notes

- `AttachmentRequirement` is one row per (code, attachment). Group with
  `ATTACHMENT_REQUIREMENTS_BY_CODE` or `attachmentsForCode()`.
- `PredeterminationEstimateLine` mirrors `ExpectedLineOutcome` from
  `caseScenarios.ts` so the same rendering code can draw both a claim outcome
  and a pre-treatment estimate. The `verdict` field is the extra discriminator
  (`allowed` / `downgraded` / `excluded` / `frequency-limited`), and
  `paidAtAllowedUsd` records the downgrade benchmark where one applies.
- **A downgrade is not a denial.** In `PRED-01` the line carries
  `denialId: "DEN-ALT-BENEFIT"` and a `paidAtAllowedUsd`, but the money is an
  adjustment that leaves the patient a documented upgrade balance — the UI must
  render it as an adjustment, not as a rejected line.

## ERA (835) remittance workflow

`eraRemittance.ts` is the content half of "make dental billing better" — teaching
students to read a remittance line by line instead of looking only at the check
total.

### How the UI should consume it

1. **Render a remittance** from `ERA_REMITTANCES`. Each `EraClaimLine` carries the
   four money buckets (`paidUsd`, `patientOwesUsd`, `writeOffUsd`,
   `providerAdjustmentUsd`) plus an `adjustments` array whose `groupCode` +
   `reasonCode` resolve to `denialReasons.ts` via `denialId`. Show the CAS codes
   as chips (e.g. "CO-59") with the `note` as the tooltip.
2. **The money invariant is what the student checks.** Every line satisfies
   `chargedUsd = allowedUsd + writeOffUsd` and
   `allowedUsd = paidUsd + patientOwesUsd + providerAdjustmentUsd`. A "did the
   student reconcile the remittance?" exercise can be scored by checking whether
   they spot a line that breaks the pattern they were taught.
3. **`disposition` is the top-level read**: `paid`, `paid-with-adjustment`, or
   `denied`. A `paid-with-adjustment` line that carries a CO-59 must be read as
   *paid at a lower allowance*, never as a denial.
4. **`DENIAL_SCENARIOS`** are the drill layer — a situation, the expected
   adjudication lines, and the correct action. Render them as a "what would the
   remittance say?" exercise.

### Schema notes

- `EraClaimLine` uses a four-bucket model so CO denials (not paid, not billable)
  are distinguished from PR denials (patient responsibility). The existing
  `ExpectedLineOutcome` in `caseScenarios.ts` folds both into one
  `patientOwesUsd`; here the extra `providerAdjustmentUsd` bucket makes the
  distinction explicit, which is what reading a real remittance requires.
- `EraClaimLevelAdjustment` is a PLB entry with a signed `amountUsd` (negative =
  recovery/takeback). `totalPaidUsd` equals the sum of line `paidUsd` plus these
  signed amounts.
- `DentalDenialScenario.expectedLines` reuses `EraClaimLine`, so one renderer
  draws both a remittance and a drill's expected outcome.

## Notes for the UI work

These are data-side observations, not UI changes (the Frontend Engineer owns
components):

1. **Claim-line validation is already expressible.** `CDTCode.requires` lists
   what each line needs (`tooth`, `surface`, `quadrant`, `arch`,
   `date-of-prior-placement`). A scrubber can enforce it without any new data.
2. **Surface validation ships here.** `validateSurfaces("8", "MOD")` returns a
   student-facing reason string explaining why an occlusal surface on an
   incisor is impossible.
3. **The adjudication engine has a defined order.** `ADJUDICATION_ORDER` in
   `benefitRules.ts` is the sequence a payer applies rules in. Implementing the
   simulated adjudicator in that order reproduces real explanation-of-benefits
   behaviour, including the case where everything passes and the annual
   maximum still pays nothing.
4. **Cases are stage-keyed.** `CaseTrap.stage` uses the same seven-stage spine
   as the medical track, so traps can be surfaced in the stage where the
   student makes the mistake. `trapsForStage()` supports a drill mode.
5. **Grading rubrics are per-stage and point-weighted**, with
   `passingPoints` set at 70% of `maxPoints`.
6. Case 2 spans a benefit-year boundary (prep in December, cementation in
   January). Whatever holds encounter state will need the date of service to be
   settable per line rather than inherited from the appointment date.
