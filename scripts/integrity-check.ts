/**
 * Content-layer integrity checker — RCM data audit.
 *
 * One consolidated script that validates cross-references and internal
 * arithmetic across the medical and dental content layers. Run with:
 *
 *     bun run scripts/integrity-check.ts
 *
 * Exit code is non-zero when any check fails, so it can gate a PR. The
 * figures validated here are teaching placeholders — this script checks that
 * the numbers are internally consistent, not that they match any real payer.
 *
 * NOTE: This checker is deliberately data-only. It never renders React and
 * never touches Supabase. Keep it that way so it runs without a browser env.
 */
import { CDT_CODES } from "../src/data/dental/cdtCodes";
import { DENTAL_PLANS } from "../src/data/dental/benefitRules";
import { DENTAL_DENIALS } from "../src/data/dental/denialReasons";
import { DENTAL_CASE_SCENARIOS } from "../src/data/dental/caseScenarios";
import {
  PREDETERMINATION_SCENARIOS,
} from "../src/data/dental/predeterminationRules";
import {
  ATTACHMENT_REQUIREMENTS,
  PREDETERMINATION_CANDIDATES,
} from "../src/data/dental/attachmentRequirements";
import {
  ERA_REMITTANCES,
  DENIAL_SCENARIOS,
} from "../src/data/dental/eraRemittance";
import {
  MEDICAL_PLANS,
  MEDICAL_BENEFIT_SCENARIOS,
  MEDICAL_CASE_SCENARIOS,
  CHIEF_COMPLAINT_TEMPLATES,
} from "../src/data/medical";
import { CPT_CODES } from "../src/components/CodingQueue/cptData";
import { ICD10_CODES } from "../src/components/CodingQueue/icd10Data";
import { DENIAL_CODES } from "../src/components/BillingLedger/claimData";
import { AR_SCENARIOS } from "../src/components/ARVoiceSimulator/arData";

let checks = 0;
let failures = 0;

function ok(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    failures++;
    console.error("  \u2717 " + msg);
  }
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.01;

function unique<T>(arr: T[], key: (x: T) => string, label: string) {
  const seen = new Set<string>();
  for (const x of arr) {
    const k = key(x);
    ok(!seen.has(k), `${label}: duplicate key "${k}"`);
    seen.add(k);
  }
}

/* ── Code repositories ─────────────────────────────────────────────── */
const cdtIds = new Set(CDT_CODES.map((c) => c.code));
const cptIds = new Set(CPT_CODES.map((c) => c.code));
const icdIds = new Set(ICD10_CODES.map((c) => c.code));
const carcIds = new Set(DENIAL_CODES.map((c) => c.code));

unique(CDT_CODES, (c) => c.code, "CDT_CODES");
unique(CPT_CODES, (c) => c.code, "CPT_CODES");
unique(ICD10_CODES, (c) => c.code, "ICD10_CODES");
unique(DENIAL_CODES, (c) => c.code, "DENIAL_CODES");
ok(CDT_CODES.length > 0, "CDT_CODES is empty");
ok(CPT_CODES.length > 0, "CPT_CODES is empty");
ok(ICD10_CODES.length > 0, "ICD10_CODES is empty");

/* ── Medical layer ─────────────────────────────────────────────────── */
const medPlanIds = new Set(MEDICAL_PLANS.map((p) => p.id));
unique(MEDICAL_PLANS, (p) => p.id, "MEDICAL_PLANS");
unique(MEDICAL_BENEFIT_SCENARIOS, (s) => s.id, "MEDICAL_BENEFIT_SCENARIOS");
unique(MEDICAL_CASE_SCENARIOS, (c) => c.id, "MEDICAL_CASE_SCENARIOS");
unique(AR_SCENARIOS, (s) => s.id, "AR_SCENARIOS");
unique(CHIEF_COMPLAINT_TEMPLATES, (t) => t.caseId, "CHIEF_COMPLAINT_TEMPLATES (caseId)");

for (const s of MEDICAL_BENEFIT_SCENARIOS) {
  ok(medPlanIds.has(s.planId), `scenario ${s.id}: unknown planId ${s.planId}`);
  ok(
    MEDICAL_CASE_SCENARIOS.some((c) => c.id === s.caseId),
    `scenario ${s.id}: unknown caseId ${s.caseId}`,
  );
}

for (const c of MEDICAL_CASE_SCENARIOS) {
  ok(medPlanIds.has(c.planId), `${c.id}: unknown planId ${c.planId}`);
  for (const d of c.diagnoses) {
    ok(icdIds.has(d.code), `${c.id}: diagnosis ${d.code} not in ICD10_CODES`);
  }
  for (const p of c.procedures) {
    ok(cptIds.has(p.code), `${c.id}: procedure ${p.code} not in CPT_CODES`);
  }
  let charged = 0, allowed = 0, plan = 0, patient = 0, writeOff = 0;
  let lineNo = 0;
  for (const l of c.expectedOutcome) {
    lineNo++;
    ok(l.line === lineNo, `${c.id}: expectedOutcome line numbering off at ${lineNo}`);
    ok(cptIds.has(l.code), `${c.id}: outcome code ${l.code} not in CPT_CODES`);
    if (l.carcCode) {
      ok(carcIds.has(l.carcCode), `${c.id} line ${l.line}: unknown CARC ${l.carcCode}`);
    }
    ok(near(l.chargedUsd, l.allowedUsd + l.writeOffUsd), `${c.id} line ${l.line}: charged != allowed + writeoff`);
    ok(near(l.allowedUsd, l.planPaysUsd + l.patientOwesUsd), `${c.id} line ${l.line}: allowed != plan + patient`);
    charged += l.chargedUsd; allowed += l.allowedUsd; plan += l.planPaysUsd;
    patient += l.patientOwesUsd; writeOff += l.writeOffUsd;
  }
  const t = c.expectedTotals;
  ok(near(t.chargedUsd, charged), `${c.id}: charged total mismatch`);
  ok(near(t.allowedUsd, allowed), `${c.id}: allowed total mismatch`);
  ok(near(t.planPaysUsd, plan), `${c.id}: plan total mismatch`);
  ok(near(t.patientOwesUsd, patient), `${c.id}: patient total mismatch`);
  ok(near(t.writeOffUsd, writeOff), `${c.id}: writeoff total mismatch`);
}

/* ── Dental layer ──────────────────────────────────────────────────── */
const dentalPlanIds = new Set(DENTAL_PLANS.map((p) => p.id));
const dentalDenialIds = new Set(DENTAL_DENIALS.map((d) => d.id));
unique(DENTAL_PLANS, (p) => p.id, "DENTAL_PLANS");
unique(DENTAL_DENIALS, (d) => d.id, "DENTAL_DENIALS");
unique(DENTAL_CASE_SCENARIOS, (c) => c.id, "DENTAL_CASE_SCENARIOS");

for (const c of DENTAL_CASE_SCENARIOS) {
  ok(dentalPlanIds.has(c.planId), `${c.id}: unknown planId ${c.planId}`);
  for (const p of c.procedures) {
    ok(cdtIds.has(p.code), `${c.id}: procedure ${p.code} not in CDT_CODES`);
  }
  let charged = 0, allowed = 0, plan = 0, patient = 0, writeOff = 0;
  let lineNo = 0;
  for (const l of c.expectedOutcome) {
    lineNo++;
    ok(l.line === lineNo, `${c.id}: expectedOutcome line numbering off at ${lineNo}`);
    ok(cdtIds.has(l.code), `${c.id}: outcome code ${l.code} not in CDT_CODES`);
    if (l.denialId) {
      ok(dentalDenialIds.has(l.denialId), `${c.id} line ${l.line}: unknown denial ${l.denialId}`);
    }
    ok(near(l.chargedUsd, l.allowedUsd + l.contractualWriteOffUsd), `${c.id} line ${l.line}: charged != allowed + writeoff`);
    ok(near(l.allowedUsd, l.planPaysUsd + l.patientOwesUsd), `${c.id} line ${l.line}: allowed != plan + patient`);
    charged += l.chargedUsd; allowed += l.allowedUsd; plan += l.planPaysUsd;
    patient += l.patientOwesUsd; writeOff += l.contractualWriteOffUsd;
  }
  const t = c.expectedTotals;
  ok(near(t.chargedUsd, charged), `${c.id}: charged total mismatch`);
  ok(near(t.allowedUsd, allowed), `${c.id}: allowed total mismatch`);
  ok(near(t.planPaysUsd, plan), `${c.id}: plan total mismatch`);
  ok(near(t.patientOwesUsd, patient), `${c.id}: patient total mismatch`);
  ok(near(t.writeOffUsd, writeOff), `${c.id}: writeoff total mismatch`);
}

/* ── Predetermination scenarios ────────────────────────────────────── */
unique(PREDETERMINATION_SCENARIOS, (s) => s.id, "PREDETERMINATION_SCENARIOS");
const verdictsSeen = new Set<string>();
for (const s of PREDETERMINATION_SCENARIOS) {
  ok(dentalPlanIds.has(s.planId), `${s.id}: unknown planId ${s.planId}`);
  let charged = 0, allowed = 0, plan = 0, patient = 0, writeOff = 0;
  let lineNo = 0;
  for (const l of s.estimate) {
    lineNo++;
    ok(l.line === lineNo, `${s.id}: estimate line numbering off at ${lineNo}`);
    ok(cdtIds.has(l.code), `${s.id}: estimate code ${l.code} not in CDT_CODES`);
    if (l.denialId) {
      ok(dentalDenialIds.has(l.denialId), `${s.id} line ${l.line}: unknown denial ${l.denialId}`);
    }
    if (l.verdict === "downgraded") {
      ok(typeof l.paidAtAllowedUsd === "number", `${s.id} line ${l.line}: downgraded but missing paidAtAllowedUsd`);
      if (typeof l.paidAtAllowedUsd === "number") {
        ok(l.paidAtAllowedUsd <= l.allowedUsd + 0.01, `${s.id} line ${l.line}: paidAtAllowedUsd exceeds allowedUsd`);
      }
    }
    ok(near(l.chargedUsd, l.allowedUsd + l.writeOffUsd), `${s.id} line ${l.line}: charged != allowed + writeoff`);
    ok(near(l.allowedUsd, l.planPaysUsd + l.patientOwesUsd), `${s.id} line ${l.line}: allowed != plan + patient`);
    verdictsSeen.add(l.verdict);
    charged += l.chargedUsd; allowed += l.allowedUsd; plan += l.planPaysUsd;
    patient += l.patientOwesUsd; writeOff += l.writeOffUsd;
  }
  const t = s.estimateTotals;
  ok(near(t.chargedUsd, charged), `${s.id}: charged total mismatch`);
  ok(near(t.allowedUsd, allowed), `${s.id}: allowed total mismatch`);
  ok(near(t.planPaysUsd, plan), `${s.id}: plan total mismatch`);
  ok(near(t.patientOwesUsd, patient), `${s.id}: patient total mismatch`);
  ok(near(t.writeOffUsd, writeOff), `${s.id}: writeoff total mismatch`);
}
for (const v of ["allowed", "downgraded", "excluded", "frequency-limited"]) {
  ok(verdictsSeen.has(v), `predetermination verdict "${v}" not represented`);
}

/* ── Attachment requirements / predetermination candidates ─────────── */
for (const r of ATTACHMENT_REQUIREMENTS) {
  ok(cdtIds.has(r.code), `attachment: unknown CDT code ${r.code}`);
  if (r.missingDenialId) {
    ok(dentalDenialIds.has(r.missingDenialId), `attachment ${r.code}: unknown denial ${r.missingDenialId}`);
  }
}
unique(PREDETERMINATION_CANDIDATES, (c) => c.code, "PREDETERMINATION_CANDIDATES");
for (const c of PREDETERMINATION_CANDIDATES) {
  ok(cdtIds.has(c.code), `candidate: unknown CDT code ${c.code}`);
}

/* ── ERA remittances / denial scenarios ────────────────────────────── */
unique(ERA_REMITTANCES, (r) => r.id, "ERA_REMITTANCES");
unique(DENIAL_SCENARIOS, (s) => s.id, "DENIAL_SCENARIOS");
for (const r of ERA_REMITTANCES) {
  ok(dentalPlanIds.has(r.payerPlanId), `${r.id}: unknown payerPlanId ${r.payerPlanId}`);
  for (const line of r.lines) {
    ok(cdtIds.has(line.code), `${r.id}: line code ${line.code} not in CDT_CODES`);
  }
}
for (const s of DENIAL_SCENARIOS) {
  ok(dentalPlanIds.has(s.planId), `${s.id}: unknown planId ${s.planId}`);
  ok(dentalDenialIds.has(s.denialId), `${s.id}: unknown denialId ${s.denialId}`);
  for (const c of s.procedureCodes) {
    ok(cdtIds.has(c), `${s.id}: procedure ${c} not in CDT_CODES`);
  }
}

/* ── Summary ───────────────────────────────────────────────────────── */
console.log(`\n${checks} checks, ${failures} failures`);
console.log(
  `Volumes: ${CDT_CODES.length} CDT, ${CPT_CODES.length} CPT, ${ICD10_CODES.length} ICD-10, ` +
    `${DENIAL_CODES.length} denial CARCs, ${MEDICAL_PLANS.length} medical plans, ` +
    `${MEDICAL_CASE_SCENARIOS.length} medical cases, ${DENTAL_PLANS.length} dental plans, ` +
    `${DENTAL_CASE_SCENARIOS.length} dental cases, ${PREDETERMINATION_SCENARIOS.length} predetermination scenarios, ` +
    `${AR_SCENARIOS.length} AR scenarios`,
);
process.exit(failures === 0 ? 0 : 1);
