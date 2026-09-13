# Dental RCM Data Layer

Content layer for the dental track. **Data only** — nothing in this directory
imports React or touches UI.

| File | What it holds |
| --- | --- |
| `cdtCodes.ts` | CDT teaching subset (99 codes) with original descriptions, claim-line requirements, illustrative fees, attachment expectations and links to likely denials |
| `benefitRules.ts` | Three fictional payer plans: annual maximum, deductible, coinsurance by class, frequency limits, age limits, waiting periods, missing tooth clause, alternate benefit provisions, coordination of benefits, plus the 12-step adjudication order |
| `denialReasons.ts` | 38 dental denial scenarios with ordered corrective actions, appealability, and whether the balance is patient-billable |
| `caseScenarios.ts` | Three graded cases (beginner / intermediate / advanced) with deliberate traps, expected line-by-line adjudication and grading rubrics |
| `toothNotation.ts` | Universal / FDI / Palmer cross-reference for all 52 teeth, surfaces, quadrants, oral-cavity areas, and a surface validator |

Import from the barrel:

```ts
import { CDT_CODES, DENTAL_PLANS, DENTAL_CASE_SCENARIOS, findTooth } from "~/data/dental";
```

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
