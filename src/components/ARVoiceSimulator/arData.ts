// ──────────────────────────────────────────────────────────────────────
// AR Voice Simulator — arData.ts
// Insurance carrier contacts, appeal letter templates, common AR scenarios
// Inspired by: Epic Resolute Hospital Billing AR Workbench
// ──────────────────────────────────────────────────────────────────────

export interface InsuranceCarrier {
  name: string;
  phone: string;
  hours: string;
  department: string;
  waitTime: string;
  notes: string;
}

export interface AppealTemplate {
  id: string;
  title: string;
  reason: string;
  body: string;
}

export interface ARScenario {
  id: string;
  type: "partial-pay" | "denied" | "underpaid" | "overpaid" | "no-response";
  title: string;
  description: string;
  script: string;
  resolution: string;
}

export interface CallScript {
  bucket: string;
  opening: string;
  questions: string[];
  closing: string;
  tips: string;
}

// ─── Insurance Carriers ──────────────────────────────────────────────

export const INSURANCE_CARRIERS: InsuranceCarrier[] = [
  {
    name: "Medicare",
    phone: "1-800-MEDICARE (1-800-633-4227)",
    hours: "24/7 (Automated) / M-F 7a-7p (Agent)",
    department: "Provider Line / MAC",
    waitTime: "10-20 min (peak), 3-5 min (off-peak)",
    notes: "Have NPI, PTAN, and beneficiary HICN/MBI ready. Call early AM for shortest hold."
  },
  {
    name: "Medicaid",
    phone: "Varies by state — check state MAC website",
    hours: "M-F 8a-5pm local time",
    department: "Provider Services / Claims",
    waitTime: "15-30 min typical",
    notes: "Each state has its own MAC. Keep NPI, TIN, and beneficiary ID ready. Expect longer holds during end-of-month."
  },
  {
    name: "Blue Cross Blue Shield",
    phone: "1-888-XXX-XXXX (varies by plan)",
    hours: "M-F 7a-7p CT",
    department: "Provider Relations / Claims",
    waitTime: "5-15 min",
    notes: "BCBS plans vary by state. Have group number, member ID, and claim number ready. Ask for 'claim reprocessing' not 'appeal' for simple fixes."
  },
  {
    name: "United Healthcare",
    phone: "1-877-842-3210 (Provider Line)",
    hours: "M-F 7a-7p CT",
    department: "Network Relations / Claims",
    waitTime: "8-12 min",
    notes: "Use Optum Pay portal for fast resolution. Have patient's UHC ID and claim number. Ask for 'claim reconsideration' for coding errors."
  },
  {
    name: "Aetna",
    phone: "1-800-624-0756 (Provider Services)",
    hours: "M-F 8a-6p ET",
    department: "Claims / Prior Auth / Appeals",
    waitTime: "5-10 min",
    notes: "Aetna has separate lines for different plan types (HMO, PPO, Medicare). Identify plan type first. Use 'virtual hold' callback option."
  },
  {
    name: "Cigna",
    phone: "1-800-882-6492 (Provider Line)",
    hours: "M-F 8a-6p CT",
    department: "Customer Service / Claims",
    waitTime: "10-15 min",
    notes: "Cigna prefers online portal submissions. Call only for complex denials. Have Cigna ID and claim reference number."
  },
  {
    name: "Humana",
    phone: "1-877-852-1877 (Provider Services)",
    hours: "M-F 8a-8p ET",
    department: "Claims / Provider Services",
    waitTime: "5-12 min",
    notes: "Humana has Medicare Advantage-specific processes. Verify if patient has Humana Medicare or Humana Commercial."
  },
  {
    name: "Tricare",
    phone: "1-800-442-6252",
    hours: "24/7 (Automated) / M-F 7a-6p CT (Agent)",
    department: "Tricare Provider Line",
    waitTime: "3-8 min",
    notes: "Have sponsor SSN/DoD ID, beneficiary relationship, and referral number ready. Use 'Tricare Encounter Data' system."
  },
];

// ─── Appeal Letter Templates ────────────────────────────────────────

export const APPEAL_TEMPLATES: AppealTemplate[] = [
  {
    id: "coding-error",
    title: "Coding / Billing Error Appeal",
    reason: "CO-16 / CO-97 — Claim denied due to incorrect or missing code",
    body: `[Date]

[Payer Name]
[Payer Address]

RE: Appeal of Denied Claim — [Patient Name]
Claim ID: [Claim ID]
Date of Service: [DOS]
Patient ID: [Member ID]

Dear Claims Review Department,

This letter is a formal request for reconsideration of the above-referenced claim denied on [Denial Date] with denial code [Denial Code].

**Reason for Denial:** [Insert denial reason from payer]

**Our Position:**
Upon review, we believe this claim was denied in error. The service provided was [Briefly describe service]. The applicable ICD-10 code [ICD-10 Code] and CPT code [CPT Code] were correctly reported based on the clinical documentation attached.

**Supporting Documentation Attached:**
1. Copy of the original claim (CMS-1500 / UB-04)
2. Clinical progress notes from [Date]
3. Coding reference (ICD-10/CPT guideline citation)
4. Relevant imaging/lab reports

**Requested Action:**
We respectfully request that this claim be reprocessed and paid in accordance with the patient's benefits and the services rendered.

Please contact us at [Your Phone Number] if additional information is required.

Sincerely,
[Your Name]
[Practice Name]
[Provider NPI]`
  },
  {
    id: "medical-necessity",
    title: "Medical Necessity Appeal",
    reason: "CO-50 / CO-180 — Service deemed not medically necessary",
    body: `[Date]

[Payer Name]
[Payer Address]

RE: Medical Necessity Appeal — [Patient Name]
Claim ID: [Claim ID]
Date of Service: [DOS]

Dear Medical Director / Appeals Committee,

This letter is an appeal of the denial of medical necessity for [Procedure Name] performed on [Date].

**Clinical Indication:**
[Patient Name] presented with [Chief Complaint]. Diagnostic workup including [Relevant tests] revealed [Clinical findings]. Based on these findings, [Procedure Name] was medically necessary.

**Supporting Clinical Documentation:**
1. History and Physical examination dated [Date]
2. Progress notes documenting failed conservative therapy
3. Imaging/X-ray findings confirming diagnosis
4. Risk of not performing procedure: [Describe risks]

**Guideline Reference:**
The procedure meets criteria outlined in [MCG/InterQual/CMS NCD] guideline [Guideline Reference]. Specifically, the patient meets criteria [A], [B], and [C] as defined in the guideline.

We respectfully request an expedited review of this appeal. Additional clinical information can be provided upon request.

Sincerely,
[Provider Name]
[Specialty]
[NPI]`
  },
  {
    id: "authorization",
    title: "Prior Authorization / Referral Appeal",
    reason: "Missing or expired prior authorization",
    body: `[Date]

[Payer Name]
[Payer Address]

RE: Retroactive Authorization Appeal — [Patient Name]
Claim ID: [Claim ID]
Date of Service: [DOS]

Dear Appeals Department,

This letter is a request for retroactive authorization for [Procedure Name] performed on [Date].

**Circumstances:**
Due to [Reason — e.g., emergent nature of procedure, administrative oversight, system error], a prior authorization was not obtained before the service was rendered.

**Clinical Urgency:**
The procedure was medically urgent because [Describe urgency]. Delaying the procedure would have resulted in [Negative outcome].

**Supporting Evidence:**
1. Emergency department records
2. Physician attestation of medical urgency
3. Clinical findings supporting immediate intervention
4. Documentation of good faith effort to obtain authorization

We acknowledge the importance of pre-authorization and have implemented process improvements to prevent recurrence. We respectfully request that this claim be authorized retroactively and paid.

Sincerely,
[Provider Name]
[Practice Name]
[NPI]`
  },
  {
    id: "timely-filing",
    title: "Timely Filing Deadline Appeal",
    reason: "Claim filed beyond timely filing deadline",
    body: `[Date]

[Payer Name]
[Payer Address]

RE: Timely Filing Appeal — [Patient Name]
Claim ID: [Claim ID]
Date of Service: [DOS]

Dear Claims Department,

This letter is an appeal of the denial of the above-referenced claim based on the timely filing deadline.

**Reason for Late Filing:**
[Select applicable reason:]
□ System/clearinghouse error
□ Patient insurance eligibility verification delay
□ Coordination of benefits processing delay
□ Clerical/administrative error
□ Other: [Describe]

**Evidence of Good Faith:**
1. Proof of initial submission attempt within timely filing window
2. Clearinghouse transmission logs
3. Internal processing documentation
4. Patient insurance verification records

We respectfully request a one-time courtesy reprocessing. We have taken corrective action to ensure future claims are filed within the required timeframe.

Sincerely,
[Your Name]
[Practice Name]
[NPI]`
  },
  {
    id: "secondary-insurance",
    title: "Secondary / COB Appeal",
    reason: "Coordination of Benefits — claim should be paid by secondary payer",
    body: `[Date]

[Payer Name]
[Payer Address]

RE: Coordination of Benefits Appeal — [Patient Name]
Claim ID: [Claim ID]
Date of Service: [DOS]

Dear COB Department,

This letter is an appeal regarding the coordination of benefits (COB) denial for the above-referenced claim.

**Insurance Coverage:**
Primary Payer: [Primary Insurance Name]
Primary Paid: [Amount]
Secondary Payer: [Your Plan Name]

**COB Issue:**
The primary payer processed and paid $[Primary Payment]. The remaining balance of $[Remaining Balance] should be applied to the secondary coverage per standard COB rules.

**Supporting Documentation:**
1. Primary payer EOB showing paid amount
2. Secondary payer benefit summary
3. COB questionnaire from intake

Please reprocess this claim as secondary and apply the remaining patient responsibility appropriately.

Sincerely,
[Your Name]
[Practice Name]
[NPI]`
  },
];

// ─── Common AR Call Scenarios ───────────────────────────────────────

export const AR_SCENARIOS: ARScenario[] = [
  {
    id: "partial-pay",
    type: "partial-pay",
    title: "Partial Payment — Short-paid Claim",
    description: "The insurance paid only 60% of the allowed amount. The patient's benefits indicate 80% coverage.",
    script: "Hi, this is [Name] calling from [Practice]. I'm calling about claim #[ClaimID] for patient [PatientName]. It was processed and paid at $X but our records show it should be paid at 80% of the allowed amount per the patient's benefit plan. Could you please review the reimbursement rate on this claim?",
    resolution: "Call the payer's provider line. Ask them to verify the patient's outpatient surgery benefits. Most likely they applied the wrong copay/coinsurance. Request a claim reprocessing."
  },
  {
    id: "denied-coding",
    type: "denied",
    title: "Denied — Procedure Code Not Covered",
    description: "Claim denied with CO-119: Procedure code is not covered under the patient's plan.",
    script: "Hello, this is [Name] from [Practice]. I'm calling about denial code CO-119 on claim #[ClaimID]. The procedure [CPT] was denied as 'not covered.' Can you tell me if there is an alternative covered code for this service? Or can you provide the specific plan exclusion language?",
    resolution: "Check the patient's summary of benefits for exclusions. If the procedure IS covered, request reprocessing. If not covered, determine if a different CPT code (e.g., -59 modifier or different category) should be used."
  },
  {
    id: "underpaid",
    type: "underpaid",
    title: "Underpaid — Below Contracted Rate",
    description: "The insurance paid $85 but the contracted rate is $150 for this CPT code.",
    script: "Hi, I'm calling about an underpayment on claim #[ClaimID]. The CPT code [CPT] has a contracted rate of $150 per your fee schedule, but we received $85. Can you review the allowed amount and adjust it to the contracted rate?",
    resolution: "Ask the representative to verify the fee schedule for the specific CPT and modifier. If the rate is wrong, ask for a reprocessing. If a bundling/editing rule applied, request an itemized breakdown."
  },
  {
    id: "overpaid",
    type: "overpaid",
    title: "Overpaid — Duplicate Payment Received",
    description: "The insurance paid twice for the same claim due to a processing error.",
    script: "Good morning, I'm calling from [Practice] about an overpayment. Claim #[ClaimID] for [PatientName] was paid at $X on [Date1] AND again at $X on [Date2]. We need to return the duplicate payment. Can you provide instructions for the refund process?",
    resolution: "Acknowledge the overpayment and ask for specific refund instructions (check vs. electronic adjustment). Document the refund request reference number. Never keep overpayments — they will be recouped with interest."
  },
  {
    id: "no-response",
    type: "no-response",
    title: "No Response — Claim Not Processed",
    description: "The claim was submitted 45 days ago with no response from the payer.",
    script: "Hello, this is [Name] calling about claim #[ClaimID] submitted on [Date]. We haven't received any response — no payment, no denial, no request for information. Can you please check the status of this claim and let me know if additional information is needed?",
    resolution: "Ask if the claim was received. If not, resubmit with corrected submission method (electronic or paper). If received, ask for the expected processing timeline and a tracking reference number."
  },
  {
    id: "denied-medical-necessity",
    type: "denied",
    title: "Denied — Medical Necessity (CO-50)",
    description: "The visit was denied because the diagnosis on the claim does not support the level of service billed.",
    script: "Hi, I'm calling about denial code CO-50 on claim #[ClaimID] for [PatientName]. The higher-level visit was denied for medical necessity. Can you tell me whether the issue is the diagnosis codes or the documentation, so we can correct the right thing?",
    resolution: "Confirm whether the diagnosis or the documentation is the problem. Usually the definitive diagnosis is in the note but never reached the claim — correct the diagnosis codes and resubmit as a corrected claim rather than appealing."
  },
  {
    id: "denied-bundling-cci",
    type: "denied",
    title: "Denied — Bundling / Claim Edit (CO-236)",
    description: "One procedure was denied because the payer's claim edit treats it as part of another service on the same day.",
    script: "Hello, this is [Name] from [Practice] about denial code CO-236 on claim #[ClaimID]. We billed two procedures for [PatientName]. Can you confirm which pair the edit applied to, and whether a corrected claim with the right single service would resolve it?",
    resolution: "Ask which two codes the edit paired. If the note describes only one service on the same site, bill only that service and write off the other as a contractual adjustment. Do not appeal a same-site bundling edit."
  },
  {
    id: "denied-benefit-exhausted",
    type: "denied",
    title: "Denied — Benefit Exhausted (CO-97)",
    description: "The service was covered but the plan's allowance for that category has been used up.",
    script: "Good morning, I'm calling about denial code CO-97 on claim #[ClaimID] for [PatientName]. We show this as a covered service, but the denial says the benefit is exhausted. Can you confirm how many visits or dollars remain in this category, and when it resets?",
    resolution: "Confirm the benefit limit and the reset date. A true benefit-exhausted denial is not appealable on necessity grounds — move the balance to the patient and check whether the plan allows a coverage decision for additional visits."
  },
  {
    id: "denied-prior-auth",
    type: "denied",
    title: "Denied — Missing Prior Authorization (CO-119)",
    description: "The service requires prior authorization and none was on file when the claim processed.",
    script: "Hi, I'm calling about denial code CO-119 on claim #[ClaimID] for [PatientName]. The service required prior authorization. Can you tell me whether you accept a retrospective review, and what documentation you need to consider one?",
    resolution: "Ask whether retrospective review is available and what clinical documentation is required. Submit the clinical package showing the medical necessity, and once approved reference the authorization number on the corrected claim."
  },
  {
    id: "partial-pay-deductible",
    type: "partial-pay",
    title: "Partial Pay — Deductible & Coinsurance",
    description: "The claim paid, but less than the patient expected because a deductible and coinsurance applied.",
    script: "Hi, I'm calling about claim #[ClaimID] for [PatientName]. The remittance shows it paid, but the patient was quoted a different number. Can you confirm the remaining deductible at the time of service, and walk me through how the coinsurance was applied to the allowed amount?",
    resolution: "Reconcile the deductible and coinsurance against the benefit quoted at eligibility. The plan paid what the design says; post the deductible and coinsurance to the patient and correct the quoting process so the next visit is quoted accurately."
  },
  {
    id: "denied-non-covered",
    type: "denied",
    title: "Denied — Non-Covered Service (CO-96)",
    description: "The service is excluded from the plan, so it is not payable regardless of documentation.",
    script: "Good afternoon, I'm calling about denial code CO-96 on claim #[ClaimID] for [PatientName]. We understand this service is excluded. Can you point me to the plan's exclusion language and confirm there is no benefit category that would cover it?",
    resolution: "Confirm the exclusion in the plan documents. A true exclusion is patient responsibility with a signed waiver — do not appeal it on clinical grounds. Verify the signed waiver is on file, then bill the patient."
  },

  {
    id: "denied-duplicate",
    type: "denied",
    title: "Denied — Duplicate Claim or Service (CO-18)",
    description: "The payer says this exact service for this patient and date was already submitted and processed.",
    script: "Hi, I'm calling about denial code CO-18 on claim #[ClaimID] for [PatientName]. Could you check whether this is a true duplicate against an earlier claim, or whether this is a separate service on the same date that needs distinguishing detail? If it is a true duplicate, I'll stop the rebill right now.",
    resolution: "Pull the original claim before doing anything else. If it is the same service, do not rebill — a repeat submission just generates another denial. If it is a genuinely separate service, resubmit with the distinguishing documentation and a note explaining the difference.",
  },
  {
    id: "denied-timely-filing",
    type: "denied",
    title: "Denied — Timely Filing Limit Expired (CO-29)",
    description: "The claim arrived after the payer's filing deadline, and the payer is denying it on timing.",
    script: "Hello, I'm calling about denial code CO-29 on claim #[ClaimID] for [PatientName]. We have a clearinghouse acknowledgement showing the original submission was on time. Can you tell me where to send that proof so this can be reconsidered?",
    resolution: "Attach the clearinghouse report or payer acknowledgement that proves the original timely submission and appeal on that basis. If the claim was never sent within the deadline, this is a practice write-off — document it and correct the process so it does not happen again.",
  },
];

// ─── Bucket Call Scripts ────────────────────────────────────────────

export const BUCKET_SCRIPTS: Record<string, CallScript> = {
  "0-30": {
    bucket: "0-30 Days",
    opening: "Hi, this is [Name] from [Practice]. I'm following up on claim #[ClaimID] for [Patient] — it's been 15 days since submission and we haven't received payment. Can you check the status?",
    questions: [
      "Was the claim received?",
      "Is there any missing information?",
      "What is the expected processing date?",
      "Is there a pending review or audit?"
    ],
    closing: "Thank you! I've noted the reference #[Ref]. We'll follow up again if we don't see payment within the promised timeframe.",
    tips: "Early bucket claims are easiest to resolve. Use a friendly, non-confrontational tone. Most issues at this stage are simple — missing info or pending processing. Get a reference number for every call."
  },
  "31-60": {
    bucket: "31-60 Days",
    opening: "Hello, I'm calling about claim #[ClaimID] that's now in the 31-60 day bucket. It was submitted on [SubmitDate]. We need assistance getting this claim processed. Can you escalate or expedite?",
    questions: [
      "Why is this claim delayed?",
      "Can you expedite processing?",
      "Is a manual review needed?",
      "Who is the supervisor I can speak with?"
    ],
    closing: "I appreciate your help. Please note my escalation request on the account. If I don't hear back within 10 business days, I'll be calling back for a supervisor review.",
    tips: "Claims in this bucket need escalation. Ask for a supervisor if the representative can't help. Be polite but persistent. Document every call — you may need proof of outreach for a timely filing appeal."
  },
  "61-90": {
    bucket: "61-90 Days",
    opening: "Good morning, this is [Name] from [Practice]. We have a critical aging claim — #[ClaimID] for [Patient] at $[Amount]. It's now in the 61-90 day range. I need supervisor assistance to get this resolved today.",
    questions: [
      "What is the specific reason for the delay?",
      "Can you escalate to the claims supervisor?",
      "Has this been sent for medical review?",
      "What is the exact documentation needed?"
    ],
    closing: "Thank you for the escalation. Please send me a written status update. If this isn't resolved within 5 business days, I'll be filing a formal complaint with the state insurance department.",
    tips: "Be more direct and urgent with this bucket. Reference the aging and the financial impact. Mentioning state insurance department complaint authority often speeds things up. Get everything in writing."
  },
  "90+": {
    bucket: "90+ Days (High Risk)",
    opening: "This is an urgent call regarding claim #[ClaimID] for [Patient]. This claim is over 90 days old and approaching the timely filing deadline. I need immediate supervisor intervention to prevent write-off.",
    questions: [
      "Will this claim be denied for timely filing?",
      "Can you approve a deadline extension?",
      "What documentation is needed TODAY?",
      "Who is the claims manager?"
    ],
    closing: "I need a written commitment on resolution by end of week. If we cannot resolve this, I need documentation of the denial reason so we can file a formal appeal. Please escalate to your manager immediately.",
    tips: "This is the most urgent bucket. Use firm, professional language. Reference timely filing deadlines. Ask for the manager's name and direct line. Consider filing a formal appeal if the claim is at risk of write-off."
  }
};

// ─── Sample Aging Ledger Data ───────────────────────────────────────

export interface AgingBucketData {
  bucket: string;
  label: string;
  totalClaims: number;
  totalAmount: number;
  color: string;
}

export const AGING_LEDGER_DATA: AgingBucketData[] = [
  { bucket: "0-30", label: "0-30 Days", totalClaims: 12, totalAmount: 34250.00, color: "bg-yellow-50 border-yellow-200" },
  { bucket: "31-60", label: "31-60 Days", totalClaims: 8, totalAmount: 28750.00, color: "bg-orange-50 border-orange-200" },
  { bucket: "61-90", label: "61-90 Days", totalClaims: 5, totalAmount: 19800.00, color: "bg-red-50 border-red-200" },
  { bucket: "90+", label: "90+ Days (High Risk)", totalClaims: 3, totalAmount: 12450.00, color: "bg-rose-50 border-rose-300" },
];

export const AGING_LEDGER_TOTAL = { totalClaims: 28, totalAmount: 95250.00 };