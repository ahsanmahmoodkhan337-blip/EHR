# Medical RCM Data Layer

Content layer for the medical track's case and payer content. **Data only** —
nothing in this directory imports React or touches UI.

| File | What it holds |
| --- | --- |
| `payerScenarios.ts` | Four fictional payer plans (commercial PPO, Medicare Advantage HMO, Medicaid MCO, and a deductible-carrying commercial PPO) plus the seven benefit scenarios each case exercises: clean-paid, medical-necessity denial, prior-auth-triggered, bundling/claim-edit, benefit-exhausted, deductible-coinsurance, and non-covered-service |
| `caseScenarios.ts` | Nine graded cases (beginner / intermediate / advanced) with deliberate traps, expected line-by-line adjudication and grading rubrics |
| `scribeTemplates.ts` | Dot-phrase (smart-phrase) library by note section (HPI / ROS / PE / A&P / Plan) plus one chief-complaint SOAP skeleton per case, with ICD-10 references that resolve to `icd10Data.ts` |

Import from the barrel:

```ts
import { MEDICAL_PLANS, MEDICAL_CASE_SCENARIOS, findCase, scenariosByKind } from "~/data/medical";
```

The medical code repositories and reference tables still live beside the stages
that use them (see `index.ts`), so extending a code set means editing the file
the stage already imports.

## Copyright rules — read before editing

**CPT codes and their official nomenclature and descriptors are copyright of
the American Medical Association. ICD-10-CM titles are produced and maintained
by the World Health Organization and the US National Center for Health
Statistics.** This repository does not hold a licence to reproduce either set.

- Every code description written for this simulator is original teaching text.
- Code identifiers (`99213`, `E11.22`) are used as references only.
- If you add a code, **write your own description**. Do not paste from a CPT or
  ICD-10 manual, a practice-management export, or a payer bulletin. If you
  cannot describe a code in your own words, leave it out.

## Accuracy rules

- **Fees are illustrative.** Every charged and allowed figure is a plausible
  teaching placeholder, not a fee schedule and not any payer's allowable. Do not
  present them to students as real.
- **Payers are fictional.** Cascadia Health PPO, Meridian Advantage,
  Northwind State Medicaid and Atlas Select PPO do not exist. Their rule values
  are modelled on the *shape* of common US plan designs so the mechanics are
  learnable. Never attach a real insurer's name to a simulated policy.
- **Prior-authorisation and bundling rules are presented as the fictional
  payer's own policy**, not as a statement of any national edit or real plan.
- **CARC codes** are from the X12 standard set; the plain-language text is
  original, and the mapping of a medical situation to a particular CARC reflects
  common practice, which varies by payer.
- Students will do this work for money. A wrong rule teaches a harmful habit —
  prefer omitting something over inventing it.

## How the cases hook into the existing mechanics

Two traps re-use logic that already ships in the medical UI, so the cases
exercise it rather than duplicate it:

1. **Modifier 25 (MCASE-004).** An E/M and a procedure on the same day, where
   the E/M must carry modifier 25. The biller's 837P transmit path denies the
   claim when two or more CPT codes are present without modifier 25.
2. **Conditional prior authorisation (MCASE-005).** A CPT code on the plan's PA
   list (`payerScenarios.ts`), which the coder queue detects and routes to the
   prior-authorisation stage.

Two newer cases exercise benefit-design mechanics rather than coding traps:

3. **Deductible + coinsurance (MCASE-008).** The Atlas Select PPO plan carries a
   real `deductibleUsd` and 70% `planCoinsurancePercent`, so the claim pays but
   the patient share is larger than the no-deductible baseline. The lesson is to
   read the plan's deductible and coinsurance before quoting a number.
4. **Non-covered service (MCASE-009).** Atlas excludes cosmetic removal of a
   benign growth. The claim returns CO-96; the balance is patient responsibility
   against a signed waiver, not an appeal. The new CPT `17110` and ICD-10
   `D23.9` exist in the repositories to support this case.

## Scribe templates workflow

`scribeTemplates.ts` is the content half of "make scribing more efficient /
practical" — a dot-phrase library and chief-complaint SOAP skeletons the
frontend can turn into an autocomplete / template picker.

### How the UI should consume it

1. **Dot-phrase autocomplete** reads `DOT_PHRASES`. Trigger on a leading `.`,
   match against `shortcode`, and insert `expansion`. Group the picker by
   `section` using `dotPhrasesBySection()`. Show `teachingNote` as the hint.
2. **Template picker** reads `CHIEF_COMPLAINT_TEMPLATES`. Choosing a complaint
   seeds the note with the SOAP skeleton: `subjective.hpiPrompt` become the
   fields the scribe fills, `subjective.ros` and `objective.exam` prefill the
   ROS/PE blocks, and `assessment` seeds the diagnosis lines.
3. **Diagnosis lines resolve.** Each `TemplateDiagnosisField.code` is guaranteed
   to exist in `ICD10_CODES` (`icd10Data.ts`), so the UI can look up the full
   description, chapter, and coding guidelines and display them alongside the
   scribe's plain-language `label`.
4. **`templateForCase(caseId)`** ties a template to its graded case, so a case
   runner can open the matching skeleton when the student reaches the
   scribe/provider stage.

### Schema notes

- `usesShortcodes` on a template lists the dot-phrases its ROS / exam / plan text
  was drawn from, so the UI can offer to insert them rather than paste inline.
- `label` fields are original paraphrases, never the official ICD-10 descriptor.
  The `code` is the only machine-resolvable reference.
- All seven templates map one-to-one onto `MEDICAL_CASE_SCENARIOS` by `caseId`.

## Notes for the UI work

These are data-side observations, not UI changes (the Frontend Engineer owns
components):

1. **Cases are stage-keyed.** `MedicalCaseTrap.stage` uses the same seven-stage
   spine as the medical track, so traps can be surfaced in the stage where the
   student makes the mistake. `trapsForStage()` supports a drill mode.
2. **Grading rubrics are per-stage and point-weighted**, with `passingPoints`
   set at 70% of `maxPoints`.
3. **Diagnosis pointers are modelled.** Each `MedicalProcedure` carries a
   `linkedDiagnosisPointer` and each `MedicalDiagnosis` a `pointer`, so a claim
   scrubber can validate the CMS-1500 box 24 pointer column without new data.
4. **The five benefit scenarios map one-to-one onto `BenefitScenarioKind`**, so
   a dashboard can group cases by the adjudication outcome they teach.
