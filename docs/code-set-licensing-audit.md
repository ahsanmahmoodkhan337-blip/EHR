# Code-set licensing & content-consistency audit

**Date:** 2026-09-26
**Author:** RCM Content Specialist
**Scope:** CDT, CPT, ICD-10 code descriptions + full content-layer consistency
**Status:** Audit complete. One accuracy fix applied. One licensing risk flagged for an owner decision.

> This is an internal compliance snapshot, **not legal advice**. The owner should
> have the licensing questions reviewed by counsel before relying on them for a
> commercial decision.

---

## 1. Inventory

| Code set | Count | File | Copyright holder |
|----------|-------|------|------------------|
| CDT (dental procedures) | 101 | `src/data/dental/cdtCodes.ts` | American Dental Association |
| CPT (medical procedures) | 45 | `src/components/CodingQueue/cptData.ts` | American Medical Association |
| ICD-10-CM (diagnoses) | 68 | `src/components/CodingQueue/icd10Data.ts` | WHO (US CM: CDC/NCHS) |
| Denial CARC codes | 16 | `src/components/BillingLedger/claimData.ts` | X12 |

Also audited for consistency (not code-description licensing): 5 medical plans,
9 medical cases, 3 dental plans, 9 dental cases, 5 predetermination scenarios,
13 AR scenarios, attachment requirements, and ERA remittances.

## 2. Paraphrase review — is anything verbatim?

### CDT — ✅ clean
All 101 `shortName` / `teachingDescription` fields are original plain-language
teaching text. No ADA nomenclature reproduced. The file already carries an
explicit "original wording only" header that new entries must honour.

### CPT — ✅ clean (one accuracy bug fixed)
`description` fields are short, original labels (e.g. "Office/outpatient visit
new, straightforward MDM"); `notes` fields are original coding tips. No AMA long
descriptors reproduced.

**Fixed in this audit:** the E/M office-visit `description` labels were shifted
one MDM level (99202 was "low" instead of "straightforward", 99205 was "high
(comprehensive)" instead of "high", and the same off-by-one pattern repeated for
the established-visit series 99212–99215). The `notes` field already carried the
correct levels, so the `description` labels were corrected to match. This is an
accuracy fix, not a licensing fix. (8 labels corrected.)

### ICD-10-CM — ⚠ risk to decide
The `description` field largely reproduces the **official ICD-10-CM short title
verbatim**, e.g.:

- `E11.9` — "Type 2 diabetes mellitus without complications"
- `I10` — "Essential (primary) hypertension"
- `J44.9` — "Chronic obstructive pulmonary disease, unspecified"
- `C50.911` — "Malignant neoplasm of unspecified site of right female breast"
- `Z12.31` — "Encounter for screening mammogram for malignant neoplasm of breast"

Most of the 68 entries use the official title; the entries added most recently
(e.g. `D23.9` "Harmless (benign) growth of the skin…", `L57.0` "Actinic keratosis
(sun-damaged, pre-cancerous skin spot)", `G43.909` "Migraine headache without
aura…", `M51.16` "Intervertebral disc disorder with nerve root symptoms…") are
already paraphrased.

This is the one area that does **not** currently satisfy the project's
"original paraphrased descriptions" mitigation. See the recommendation in §5.

### Denial CARCs — ✅ clean
All 16 CARC `description` / `meaning` / `howToFix` fields are original teaching
text (short paraphrases), not the X12 official reason-code descriptions.

## 3. Integrity & arithmetic verification

A consolidated checker was added at `scripts/integrity-check.ts` (run with
`bun run scripts/integrity-check.ts`) so this verification is reproducible and
version-controlled — the earlier per-specialty checkers lived only in a scratch
home directory and were lost on environment refresh.

It validates, across both tracks:

- code-set uniqueness (CDT/CPT/ICD/CARC) and all cross-references (plans, cases,
  scenarios, diagnoses → ICD, procedures/outcome codes → CPT/CDT, CARC/denial ids);
- per-line arithmetic (`charged = allowed + write-off`, `allowed = plan + patient`);
- every `expectedTotals` against the sum of its lines, for all 9 dental and all 9
  medical cases, and all 5 predetermination scenarios (including the downgrade
  `paidAtAllowedUsd ≤ allowed` invariant and coverage of all four verdict kinds);
- ERA remittance and denial-scenario plan/code references.

**Result: 874 checks, 0 failures.** The arithmetic in the predetermination
scenarios, payer-benefit-rule references, and the 12-step dental adjudication
cases is internally consistent.

The script is a standalone data-audit tool (imports `src/` but is not part of the
Vite SPA bundle); it is excluded from the frontend typecheck in `tsconfig.json`,
alongside the existing server-launcher exclusions.

## 4. What changed in this PR

- `src/components/CodingQueue/cptData.ts` — corrected 8 E/M MDM level labels.
- `scripts/integrity-check.ts` — new consolidated content-layer checker.
- `tsconfig.json` — exclude `scripts/**` from the SPA typecheck (tool scripts).
- This report (`docs/code-set-licensing-audit.md`).

## 5. Residual risk & recommendation

- **ICD-10-CM titles are the main exposure.** WHO licenses ICD-10; wholesale use
  of the official titles in a paid product is the same class of risk already
  acknowledged in the business plan for CPT/CDT. Recommend one of:
  1. paraphrase the ICD-10 `description` fields to original wording (consistent
     with the CDT/CPT treatment), or
  2. obtain a WHO ICD licensing arrangement.
  Option 1 is the lower-cost path and matches the existing mitigation.
- **CPT / CDT** remain paraphrased and, on this review, present no verbatim
  descriptor issue. Code *numbers* themselves are used as references, which is
  the intended design.
- **CARC codes** are paraphrased here; note the X12 reason-code descriptions are
  also protected, so keep the "original wording only" rule when adding CARCs.

No other content-consistency defects were found. This report does not opine on
the enforceability of any third party's copyright — that is a question for the
owner's counsel.
