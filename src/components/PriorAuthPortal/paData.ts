// ──────────────────────────────────────────────────────────────────────
// Prior Auth Portal — paData.ts
// Full PA data structures: procedures, criteria, statuses, records
// Inspired by: CoverMyMeds + DrChrono PA workflows
// ──────────────────────────────────────────────────────────────────────

import { PA_DOCUMENT_BUNDLES, type PABundleKey, type PADocument } from "./paDocuments";

export type { PADocument, PADocumentRow, PADocumentSection } from "./paDocuments";

export interface PACriterion {
  id: string;
  text: string;
  required: boolean;
  typicalEvidence: string;
}

export interface PAStepTherapy {
  step: number;
  requirement: string;
  typicalDuration: string;
  alternatives: string[];
}

export interface PAProcedureData {
  label: string;
  cptCodes: string[];
  icdRanges: string[];
  criteria: PACriterion[];
  stepTherapy?: PAStepTherapy[];
  /** Names of the mandatory documents — derived from documentBundle, kept for the attach list UI */
  requiredDocs: string[];
  /** Openable mock documents (notes, labs, imaging, payer forms) behind each required doc */
  documentBundle: PADocument[];
  typicalTimeline: string;
  autoAuthThreshold?: number;
  commonDenialReasons: string[];
  letterTemplateSections: string[];
}

/** Mandatory document names for a case, derived from its bundle so the two can never drift. */
const requiredDocsFor = (key: PABundleKey): string[] =>
  (PA_DOCUMENT_BUNDLES[key] ?? []).filter((d) => d.required).map((d) => d.name);

export type ProcedureKey = PABundleKey;

/** Exact owner-specified PA status flow */
export const PA_STATUS_FLOW = [
  { key: "ordered", label: "Ordered/Prescribed", icon: "📋", color: "text-slate-600", bgColor: "bg-slate-100" },
  { key: "submitted", label: "Submitted", icon: "📤", color: "text-amber-600", bgColor: "bg-amber-50" },
  { key: "in-progress", label: "In Progress (1 day)", icon: "⏳", color: "text-brand-600", bgColor: "bg-brand-50" },
  { key: "pending", label: "Pending", icon: "⏸️", color: "text-orange-600", bgColor: "bg-orange-50" },
  { key: "info-required", label: "Info/Documents Required", icon: "📎", color: "text-yellow-600", bgColor: "bg-yellow-50" },
  { key: "approved", label: "Approved", icon: "✅", color: "text-green-600", bgColor: "bg-green-50" },
  { key: "denied", label: "Denied", icon: "❌", color: "text-red-600", bgColor: "bg-red-50" },
  { key: "closed", label: "Closed", icon: "🔒", color: "text-slate-500", bgColor: "bg-slate-100" },
  { key: "appeal", label: "Appeal", icon: "⚡", color: "text-brand-600", bgColor: "bg-brand-50" },
  { key: "next-followup", label: "Next Follow-Up Date", icon: "📅", color: "text-brand-600", bgColor: "bg-brand-50" },
  { key: "completed", label: "Completed (After billing)", icon: "🏁", color: "text-emerald-600", bgColor: "bg-emerald-50" },
];

/** Convenience lookup: status key → label/color */
export const PA_STATUS_LABELS: Record<string, { label: string; icon: string; color: string; bgColor: string }> = {};
PA_STATUS_FLOW.forEach((s) => {
  PA_STATUS_LABELS[s.key] = { label: s.label, icon: s.icon, color: s.color, bgColor: s.bgColor };
});

/** Convenience type for queue items (alias for PARecord) */
export type PAQueueItem = PARecord;

/** Timeline steps for the 11-step flow (used in status tracking) */
export const PA_TIMELINE_STEPS = PA_STATUS_FLOW.map((s) => ({
  key: s.key,
  label: s.label,
  description: `Status: ${s.label} — ${s.key === "ordered" ? "Awaiting submission" : s.key === "submitted" ? "Awaiting payer response" : s.key === "in-progress" ? "Payer reviewing" : s.key === "pending" ? "Awaiting decision" : s.key === "info-required" ? "Documents requested" : s.key === "approved" ? "Authorization granted" : s.key === "denied" ? "Authorization denied" : s.key === "closed" ? "Case closed" : s.key === "appeal" ? "Appeal in progress" : s.key === "next-followup" ? "Follow-up scheduled" : "Completed"}`,
}));

/** Full PA record with owner-specified fields */
export interface PARecord {
  id: string;
  patientName: string;
  procedure: string;
  /** Insurance name */
  insuranceName: string;
  /** Name of PA Processor at the insurance */
  paProcessor: string;
  /** Authorization start date */
  authStartDate: string;
  /** Authorization end date (alert 2 weeks before expiry) */
  authEndDate: string;
  /** Next refill date (alert 1 week before) */
  nextRefillDate: string;
  /** Method of submission */
  submissionMethod: string;
  /** Name of user who submitted */
  submittedBy: string;
  /** Time & date of PA submission */
  submittedAt: string;
  /** Status from PA_STATUS_FLOW */
  status: string;
  /**
   * The verification the chart recorded for this authorisation, carried through
   * so the queue prints the record's own proof (`domain/tutorialEncounter.ts`)
   * rather than running a fresh check on the screen.
   */
  verificationStatus?: "not-verified" | "verified" | "failed";
  verificationResult?: string;
  urgency: "routine" | "urgent" | "emergent";
  assignedTo?: string;
}

/** Simulated PA records for the queue */
export const PA_RECORDS: PARecord[] = [
  {
    id: "PA-001", patientName: "John Smith", procedure: "MRI Lumbar Spine",
    insuranceName: "Northwind Health Plan", paProcessor: "Karen Miller",
    authStartDate: "2026-07-01", authEndDate: "2026-10-01", nextRefillDate: "2026-09-01",
    submissionMethod: "Electronic PA", submittedBy: "Dr. Sarah Chen", submittedAt: "2026-07-01T09:30:00Z",
    status: "submitted", urgency: "routine"
  },
  {
    id: "PA-002", patientName: "Sarah Johnson", procedure: "Total Knee Arthroplasty",
    insuranceName: "Medicare", paProcessor: "Medicare Part B",
    authStartDate: "2026-06-25", authEndDate: "2026-09-25", nextRefillDate: "2026-09-01",
    submissionMethod: "EHR", submittedBy: "Dr. Michael Patel", submittedAt: "2026-06-25T14:15:00Z",
    status: "in-progress", urgency: "routine"
  },
  {
    id: "PA-003", patientName: "Mike Chen", procedure: "Cardiac Catheterization",
    insuranceName: "Cascadia Health Plan", paProcessor: "Cascadia Clinical Review",
    authStartDate: "2026-06-20", authEndDate: "2026-09-20", nextRefillDate: "2026-08-20",
    submissionMethod: "Online Payer Portal", submittedBy: "Dr. James Wilson", submittedAt: "2026-06-20T11:00:00Z",
    status: "approved", urgency: "urgent"
  },
  {
    id: "PA-004", patientName: "Emily Davis", procedure: "Remicade Infusion",
    insuranceName: "Meridian Health Plan", paProcessor: "Meridian Specialty Pharmacy",
    authStartDate: "2026-06-15", authEndDate: "2026-09-15", nextRefillDate: "2026-07-15",
    submissionMethod: "Fax", submittedBy: "Dr. Lisa Wong", submittedAt: "2026-06-15T16:45:00Z",
    status: "denied", urgency: "routine"
  },
  {
    id: "PA-005", patientName: "Robert Wilson", procedure: "Sleep Study (Home)",
    insuranceName: "Ridgeline Health Plan", paProcessor: "Ridgeline Medical Review",
    authStartDate: "2026-06-30", authEndDate: "2026-09-30", nextRefillDate: "2026-08-30",
    submissionMethod: "EHR", submittedBy: "Dr. Sarah Chen", submittedAt: "2026-06-30T08:00:00Z",
    status: "ordered", urgency: "routine"
  },
  {
    id: "PA-006", patientName: "Maria Garcia", procedure: "Biologic Therapy (Humira)",
    insuranceName: "Cascadia Health Plan", paProcessor: "Cascadia Specialty Pharmacy",
    authStartDate: "2026-06-10", authEndDate: "2026-08-10", nextRefillDate: "2026-07-10",
    submissionMethod: "Electronic PA", submittedBy: "Dr. Karen Thompson", submittedAt: "2026-06-10T10:30:00Z",
    status: "info-required", urgency: "urgent"
  },
  {
    id: "PA-007", patientName: "David Kim", procedure: "CT Chest",
    insuranceName: "Medicaid", paProcessor: "Medicaid State Review",
    authStartDate: "2026-06-28", authEndDate: "2026-09-28", nextRefillDate: "2026-09-01",
    submissionMethod: "Mail", submittedBy: "Dr. Michael Patel", submittedAt: "2026-06-28T13:00:00Z",
    status: "pending", urgency: "routine"
  },
  {
    id: "PA-008", patientName: "Lisa Brown", procedure: "Infusion Therapy (Entyvio)",
    insuranceName: "Meridian Health Plan", paProcessor: "Meridian Clinical Review",
    authStartDate: "2026-05-01", authEndDate: "2026-07-28", nextRefillDate: "2026-07-14",
    submissionMethod: "Online Payer Portal", submittedBy: "Dr. Lisa Wong", submittedAt: "2026-05-01T09:00:00Z",
    status: "next-followup", urgency: "routine"
  },
  // ── Demo records for the three new case types (fictional payers) ──
  {
    id: "PA-009", patientName: "Ayesha Malik", procedure: "Medication — GLP-1 (Semaglutide) for Type 2 Diabetes",
    insuranceName: "Summit Care Advantage", paProcessor: "Summit Pharmacy Review",
    authStartDate: "2026-10-21", authEndDate: "2027-01-21", nextRefillDate: "2026-11-20",
    submissionMethod: "Electronic PA", submittedBy: "Dr. Ayesha Siddiqui", submittedAt: "2026-10-14T09:10:00Z",
    status: "submitted", urgency: "routine", assignedTo: "Pharmacy PA Team"
  },
  {
    id: "PA-010", patientName: "Bilal Ahmed", procedure: "Medication — GLP-1 (Semaglutide) Reauthorization",
    insuranceName: "Meridian Health Plan", paProcessor: "Meridian Specialty Drug Review",
    authStartDate: "2026-09-01", authEndDate: "2026-12-01", nextRefillDate: "2026-11-05",
    submissionMethod: "Online Payer Portal", submittedBy: "Dr. Ayesha Siddiqui", submittedAt: "2026-10-02T14:30:00Z",
    status: "info-required", urgency: "routine", assignedTo: "Pharmacy PA Team"
  },
  {
    id: "PA-011", patientName: "Hamza Sheikh", procedure: "MRI Brain w/o & w/ Contrast",
    insuranceName: "Cedar Valley Health", paProcessor: "Cedar Valley Radiology Review",
    authStartDate: "2026-10-20", authEndDate: "2027-01-20", nextRefillDate: "2026-11-20",
    submissionMethod: "EHR", submittedBy: "Dr. Imran Qureshi", submittedAt: "2026-10-09T11:45:00Z",
    status: "in-progress", urgency: "urgent", assignedTo: "Imaging PA Team"
  },
  {
    id: "PA-012", patientName: "Nadia Hussain", procedure: "CT Thorax with Contrast",
    insuranceName: "Summit Care Advantage", paProcessor: "Summit Imaging Review",
    authStartDate: "2026-10-16", authEndDate: "2027-01-16", nextRefillDate: "2026-11-16",
    submissionMethod: "Electronic PA", submittedBy: "Dr. Michael Patel", submittedAt: "2026-10-05T08:20:00Z",
    status: "approved", urgency: "routine", assignedTo: "Imaging PA Team"
  },
  {
    id: "PA-013", patientName: "Sana Tariq", procedure: "TMS — Treatment-Resistant Depression",
    insuranceName: "Northbridge Health", paProcessor: "Northbridge Behavioral Health Review",
    authStartDate: "2026-11-02", authEndDate: "2026-12-14", nextRefillDate: "2026-11-16",
    submissionMethod: "Fax", submittedBy: "Dr. Nadia Farooq", submittedAt: "2026-10-16T15:05:00Z",
    status: "pending", urgency: "routine", assignedTo: "Behavioral Health PA Team"
  },
  {
    id: "PA-014", patientName: "Usman Raza", procedure: "TMS — Treatment-Resistant Depression (Appeal)",
    insuranceName: "Meridian Health Plan", paProcessor: "Meridian Behavioral Health Review",
    authStartDate: "2026-09-22", authEndDate: "2026-10-20", nextRefillDate: "2026-10-20",
    submissionMethod: "Online Payer Portal", submittedBy: "Dr. Nadia Farooq", submittedAt: "2026-09-22T10:00:00Z",
    status: "appeal", urgency: "urgent", assignedTo: "Behavioral Health PA Team"
  },
];

/** Sample PA queue for the dashboard (references PA_RECORDS — defined above) */
export const SAMPLE_PA_QUEUE: PAQueueItem[] = PA_RECORDS;
export const SUBMISSION_METHODS = [
  "EHR",
  "Fax",
  "Electronic PA",
  "Mail",
  "Online Payer Portal",
  "Verbal",
];

export const PA_PROCEDURES: Record<ProcedureKey, PAProcedureData> = {
  "mri": {
    label: "MRI (Lumbar / Cervical / Knee)",
    cptCodes: ["72141", "72142", "72146", "72147", "72148", "72149", "72156", "72157", "72158", "73721"],
    icdRanges: ["M51.1–M51.9 (Lumbar disc)", "M54.3–M54.5 (Sciatica)", "M17.0–M17.9 (Knee OA)"],
    criteria: [
      { id: "mri-1", text: "Conservative treatment failed (6+ weeks of PT / NSAIDs)", required: true, typicalEvidence: "PT notes, prescription history" },
      { id: "mri-2", text: "Pain scale documented >4/10 on multiple visits", required: true, typicalEvidence: "Progress notes with pain scores" },
      { id: "mri-3", text: "No red flags (cauda equina, malignancy, fracture)", required: true, typicalEvidence: "Physical exam documentation" },
      { id: "mri-4", text: "Focal neurologic deficit on exam", required: false, typicalEvidence: "Sensorimotor exam findings" },
      { id: "mri-5", text: "Failed prior imaging (X-ray / CT inconclusive)", required: false, typicalEvidence: "Prior imaging reports" },
    ],
    requiredDocs: requiredDocsFor("mri"),
    documentBundle: PA_DOCUMENT_BUNDLES["mri"],
    typicalTimeline: "5–10 business days",
    autoAuthThreshold: 1500,
    commonDenialReasons: ["No prior conservative treatment documented", "Pain level not documented across visits", "Payer prefers CT before MRI for this indication"],
    letterTemplateSections: ["Patient demographics and insurance information", "Diagnosis and ICD-10 code", "Clinical history: onset, duration, prior treatments tried", "Physical exam findings relevant to the study", "Why this imaging modality is necessary (vs alternatives)", "Risk of not performing the study (delayed diagnosis, progression)"]
  },
  "ct": {
    label: "CT Chest / Abdomen / Pelvis",
    cptCodes: ["71250", "71260", "71275", "74176", "74177", "74178"],
    icdRanges: ["R91.1 (Solitary pulmonary nodule)", "R93.3 (Abnormal abdominal findings)", "C78.0–C78.9 (Metastatic disease)"],
    criteria: [
      { id: "ct-1", text: "Abnormal X-ray or ultrasound findings", required: true, typicalEvidence: "Prior imaging reports" },
      { id: "ct-2", text: "Hemoptysis / unexplained cough > 4 weeks", required: false, typicalEvidence: "Progress notes" },
      { id: "ct-3", text: "Unexplained weight loss (>5% in 3 months)", required: false, typicalEvidence: "Weight tracking in chart" },
      { id: "ct-4", text: "Suspected malignancy based on labs or exam", required: false, typicalEvidence: "Lab results, exam findings" },
      { id: "ct-5", text: "Follow-up of known lesion (size/stability check)", required: true, typicalEvidence: "Prior CT report for comparison" },
    ],
    requiredDocs: requiredDocsFor("ct"),
    documentBundle: PA_DOCUMENT_BUNDLES["ct"],
    typicalTimeline: "3–7 business days",
    commonDenialReasons: ["No prior imaging to justify the CT", "Routine screening with no specific indication", "Payer prefers lower-dose imaging (X-ray or ultrasound) first"],
    letterTemplateSections: ["Patient demographics and insurance information", "Specific clinical indication for the study", "Prior imaging results and why they are inconclusive", "Signs/symptoms documented (hemoptysis, weight loss, etc.)", "Relevant lab values supporting the need", "Differential diagnosis being investigated"]
  },
  "knee-replacement": {
    label: "Total Knee Arthroplasty (TKA)",
    cptCodes: ["27447"],
    icdRanges: ["M17.0–M17.9 (OA of knee)", "M16.0 (Rheumatoid)"],
    criteria: [
      { id: "tka-1", text: "X-ray confirmed OA grade 3-4 (Kellgren-Lawrence)", required: true, typicalEvidence: "X-ray report with grading" },
      { id: "tka-2", text: "BMI < 40 (most payers)", required: true, typicalEvidence: "Anthropometric measurements in chart" },
      { id: "tka-3", text: "Non-smoker for 6+ months (or nicotine-free)", required: true, typicalEvidence: "Social history, cotinine test" },
      { id: "tka-4", text: "Failed conservative therapy (PT, injections, braces)", required: true, typicalEvidence: "PT notes, injection records" },
      { id: "tka-5", text: "Functional limitation documented (stairs, walking)", required: true, typicalEvidence: "Functional assessment scores" },
      { id: "tka-6", text: "No active infection or uncontrolled DM", required: true, typicalEvidence: "PCP clearance, HbA1c < 8.0" },
    ],
    stepTherapy: [
      { step: 1, requirement: "Conservative management: PT 2x/week for 6 weeks", typicalDuration: "6–8 weeks", alternatives: ["Home exercise program"] },
      { step: 2, requirement: "NSAIDs / pain management trial", typicalDuration: "4–8 weeks", alternatives: ["Topical analgesics"] },
      { step: 3, requirement: "Intra-articular steroid or viscosupplementation injection", typicalDuration: "1–3 injections", alternatives: ["Gel injections (Synvisc, Euflexxa)"] },
    ],
    requiredDocs: requiredDocsFor("knee-replacement"),
    documentBundle: PA_DOCUMENT_BUNDLES["knee-replacement"],
    typicalTimeline: "2–6 weeks (often requires step therapy completion)",
    autoAuthThreshold: 50000,
    commonDenialReasons: ["Conservative therapy not documented", "BMI criteria not met", "Smoking-cessation counselling not documented for a nicotine-positive patient"],
    letterTemplateSections: ["Patient demographics, insurance, and surgeon details", "Diagnosis and severity (OA grade, functional limitation)", "Documentation of failed conservative management (PT, injections)", "Comorbidities and surgical risk assessment", "BMI, smoking status, and optimization steps taken", "Expected outcome: pain relief, functional improvement, QoL gain"]
  },
  "cardiac-cath": {
    label: "Cardiac Catheterization / Coronary Angiogram",
    cptCodes: ["93458", "93460", "93461", "93593"],
    icdRanges: ["I20.0–I25.9 (CAD)", "I50.2–I50.9 (HF)", "R94.3 (Abnormal stress test)"],
    criteria: [
      { id: "cath-1", text: "Positive stress test (Echo, Nuclear, or Stress ECG)", required: true, typicalEvidence: "Stress test report" },
      { id: "cath-2", text: "Chest pain with high-risk features (unstable angina)", required: false, typicalEvidence: "ED notes, cardiology consult" },
      { id: "cath-3", text: "Abnormal echocardiogram (wall motion, low EF)", required: true, typicalEvidence: "Echo report with measurements" },
      { id: "cath-4", text: "Elevated troponin / biomarkers", required: false, typicalEvidence: "Lab results" },
      { id: "cath-5", text: "Failed medical management (anti-anginal therapy)", required: false, typicalEvidence: "Medication list, cardiology notes" },
      { id: "cath-6", text: "High-risk CAD based on risk calculators (ASCVD >20%)", required: false, typicalEvidence: "Risk assessment in chart" },
    ],
    requiredDocs: requiredDocsFor("cardiac-cath"),
    documentBundle: PA_DOCUMENT_BUNDLES["cardiac-cath"],
    typicalTimeline: "3–10 business days (urgent cases expedited)",
    autoAuthThreshold: 30000,
    commonDenialReasons: ["Abnormal cardiac imaging not documented", "Medical management not attempted first", "Payer prefers non-invasive CT coronary angiography first"],
    letterTemplateSections: ["Patient demographics and insurance information", "Cardiac diagnosis and symptoms (CCS class, angina type)", "Non-invasive test results (stress test, echo, ECG) with details", "Risk calculation (ASCVD, TIMI, GRACE scores)", "Medications tried and response", "Justification for invasive vs. non-invasive approach"]
  },
  "infusion-therapy": {
    label: "Infusion Therapy (Remicade / Entyvio / Ocrevus)",
    cptCodes: ["96413", "96415", "96417", "96365"],
    icdRanges: ["K50.0–K52.9 (IBD)", "M05.0–M06.9 (RA)", "G35.0–G35.9 (MS)"],
    criteria: [
      { id: "inf-1", text: "FDA-approved indication for the biologic", required: true, typicalEvidence: "Diagnosis confirmed in chart" },
      { id: "inf-2", text: "Failed or intolerant to conventional therapy (e.g., DMARDs, steroids)", required: true, typicalEvidence: "Treatment history, medication list" },
      { id: "inf-3", text: "Disease activity severity documented (DAS28, HBI, EDSS)", required: true, typicalEvidence: "Activity scores in progress notes" },
      { id: "inf-4", text: "TB screening completed (Quantiferon / PPD)", required: true, typicalEvidence: "Lab report in chart" },
      { id: "inf-5", text: "Hepatitis B / C screening completed", required: true, typicalEvidence: "Serology lab report" },
      { id: "inf-6", text: "No active infections or contraindications", required: true, typicalEvidence: "PCP clearance, infection screen" },
    ],
    stepTherapy: [
      { step: 1, requirement: "Trial of conventional DMARD (methotrexate, sulfasalazine, hydroxychloroquine)", typicalDuration: "3–6 months", alternatives: ["Leflunomide", "Azathioprine"] },
      { step: 2, requirement: "Trial of steroids (if appropriate for disease)", typicalDuration: "4–8 weeks", alternatives: ["Budesonide (for Crohn's)", "IV methylprednisolone (for MS)"] },
      { step: 3, requirement: "Consider preferred biologic on formulary first (if applicable)", typicalDuration: "N/A — formulary check", alternatives: ["Humira", "Enbrel", "Tysabri"] },
    ],
    requiredDocs: requiredDocsFor("infusion-therapy"),
    documentBundle: PA_DOCUMENT_BUNDLES["infusion-therapy"],
    typicalTimeline: "7–14 business days (first dose); 3–5 days (reauthorization)",
    commonDenialReasons: ["Conventional DMARDs not tried first", "Disease activity not documented", "TB / HepB screening missing"],
    letterTemplateSections: ["Patient demographics, insurance, and prescribing specialist", "Diagnosis and disease duration", "Previous therapies tried (conventional DMARDs, steroids) and why they failed", "Disease activity scores with dates", "Screening results (TB, HepB, HepC) — negative status confirmed", "Why this specific biologic is indicated (vs. alternatives on formulary)", "Infusion schedule and monitoring plan"]
  },
  "sleep-study": {
    label: "Sleep Study (Polysomnography / Home Sleep Test)",
    cptCodes: ["95800", "95801", "95806", "95810", "95811"],
    icdRanges: ["G47.30–G47.39 (Sleep apnea)", "R06.83 (Snoring)", "G47.0 (Insomnia)"],
    criteria: [
      { id: "sleep-1", text: "High STOP-BANG score (≥3) or Epworth Sleepiness Scale >10", required: true, typicalEvidence: "Screening questionnaire results" },
      { id: "sleep-2", text: "Witnessed apneas or gasping during sleep (bed partner report)", required: true, typicalEvidence: "Sleep history in progress notes" },
      { id: "sleep-3", text: "Daytime somnolence affecting work/driving", required: false, typicalEvidence: "ESS score, patient-reported impact" },
      { id: "sleep-4", text: "BMI > 30 with snoring and fatigue", required: false, typicalEvidence: "Anthropometrics, sleep questionnaire" },
      { id: "sleep-5", text: "Hypertension (HTN) resistant to treatment", required: false, typicalEvidence: "BP logs, medication list" },
    ],
    requiredDocs: requiredDocsFor("sleep-study"),
    documentBundle: PA_DOCUMENT_BUNDLES["sleep-study"],
    typicalTimeline: "2–4 weeks (home test); 4–8 weeks (in-lab PSG)",
    autoAuthThreshold: 2000,
    commonDenialReasons: ["Screening questionnaire not documented", "Payer prefers a home sleep test over an in-lab study", "Mild OSA — lifestyle modification recommended first"],
    letterTemplateSections: ["Patient demographics and insurance information", "Sleep-related symptoms and duration", "STOP-BANG and Epworth Sleepiness Scale scores", "Comorbidities (HTN, obesity, diabetes) and their relationship to sleep", "Why this specific sleep study type is appropriate", "Risk of untreated sleep apnea (cardiovascular, accident risk)"]
  },
  "biologic": {
    label: "Biologic Therapy (Humira / Enbrel / Stelara)",
    cptCodes: ["96413", "96365", "J0135", "J1438", "J1745"],
    icdRanges: ["L40.0–L40.9 (Psoriasis)", "M05.0–M06.9 (RA)", "K50.0–K50.9 (Crohn's)"],
    criteria: [
      { id: "bio-1", text: "Diagnosis confirmed by biopsy / imaging / lab criteria", required: true, typicalEvidence: "Pathology report, diagnostic criteria met" },
      { id: "bio-2", text: "Failed or intolerant to 2+ conventional therapies", required: true, typicalEvidence: "Treatment history with dates and outcomes" },
      { id: "bio-3", text: "Moderate to severe disease activity (PASI >10, DAS28 >3.2)", required: true, typicalEvidence: "Activity scores documented" },
      { id: "bio-4", text: "TB / HepB screening completed and negative", required: true, typicalEvidence: "Screening lab reports (within 1 year)" },
      { id: "bio-5", text: "No prior serious infection on biologics", required: true, typicalEvidence: "Prior biologic history if applicable" },
      { id: "bio-6", text: "CBC, LFTs, renal function checked within 30 days", required: false, typicalEvidence: "Recent lab results" },
    ],
    stepTherapy: [
      { step: 1, requirement: "Trial of topical therapy (for psoriasis) or conventional DMARD (for RA/IBD)", typicalDuration: "3–6 months", alternatives: ["Phototherapy (psoriasis)", "5-ASA (IBD)"] },
      { step: 2, requirement: "Trial of preferred biologic on formulary", typicalDuration: "3–6 months", alternatives: ["Adalimumab biosimilar", "Infliximab"] },
    ],
    requiredDocs: requiredDocsFor("biologic"),
    documentBundle: PA_DOCUMENT_BUNDLES["biologic"],
    typicalTimeline: "7–14 business days (new); 5–7 days (reauthorization)",
    commonDenialReasons: ["Step therapy not completed", "Disease severity not documented with a validated score", "TB / HepB screening missing or outdated (over a year old)", "Payer prefers a biosimilar over the brand biologic"],
    letterTemplateSections: ["Patient demographics, insurance, prescribing specialist", "Confirmed diagnosis with supporting evidence (biopsy, imaging)", "Complete treatment history: topicals → DMARDs → prior biologics", "Disease activity scores (PASI, DAS28, CDAI) with dates", "Screening results: TB negative, HepB/C negative", "Why this biologic is medically necessary (vs. alternatives)", "Monitoring plan (labs, follow-up schedule, infection surveillance)"]
  },
  "medication": {
    label: "Medication PA — GLP-1 (Semaglutide) for Type 2 Diabetes",
    // Illustrative billing routes: a GLP-1 pen is usually a pharmacy-benefit (NDC) claim.
    // J3490 (unclassified drug) + 96372 (injection administration) is the medical-benefit
    // route students will see when the plan requires a buy-and-bill PA instead.
    cptCodes: ["J3490", "96372"],
    icdRanges: ["E11.0–E11.9 (Type 2 diabetes mellitus)", "E78.5 (Dyslipidaemia)", "I10 (Essential hypertension)"],
    criteria: [
      { id: "med-1", text: "Confirmed type 2 diabetes diagnosis (not type 1, not weight loss alone)", required: true, typicalEvidence: "Problem list, diagnosis code on the order" },
      { id: "med-2", text: "A1c above goal (>7.0 %, plan may require >7.5 %) documented within 90 days", required: true, typicalEvidence: "Lab report with collection date" },
      { id: "med-3", text: "Metformin at maximum tolerated dose for ≥3 months", required: true, typicalEvidence: "Medication history with start date and dose" },
      { id: "med-4", text: "Second glucose-lowering agent trialled and failed or not tolerated", required: true, typicalEvidence: "Sulfonylurea / DPP-4 / SGLT2 trial with dates and reason stopped" },
      { id: "med-5", text: "eGFR ≥30 mL/min/1.73 m² (renal threshold for GLP-1 therapy)", required: true, typicalEvidence: "Recent renal function panel" },
      { id: "med-6", text: "No personal/family history of medullary thyroid carcinoma or MEN2", required: true, typicalEvidence: "Attestation on the payer form" },
      { id: "med-7", text: "No history of pancreatitis or gastroparesis", required: false, typicalEvidence: "Problem list, lipase if indicated" },
      { id: "med-8", text: "Not pregnant or breastfeeding", required: true, typicalEvidence: "Pregnancy attestation / urine hCG" },
    ],
    stepTherapy: [
      { step: 1, requirement: "Metformin at maximum tolerated dose", typicalDuration: "≥3 months", alternatives: ["Extended-release metformin if immediate-release is not tolerated"] },
      { step: 2, requirement: "Second agent — sulfonylurea, DPP-4 inhibitor, or SGLT2 inhibitor", typicalDuration: "≥3 months or documented intolerance", alternatives: ["SGLT2 inhibitor (preferred if heart failure or CKD present)"] },
      { step: 3, requirement: "GLP-1 receptor agonist (formulary-preferred agent first)", typicalDuration: "Titrate over 8–12 weeks", alternatives: ["Tirzepatide (dual agonist) if formulary-preferred", "Basal insulin if A1c >10 % or catabolic features"] },
    ],
    requiredDocs: requiredDocsFor("medication"),
    documentBundle: PA_DOCUMENT_BUNDLES["medication"],
    typicalTimeline: "2–5 business days (electronic); 1 business day if urgent",
    autoAuthThreshold: 1200,
    commonDenialReasons: [
      "Step therapy not met — metformin trial shorter than 3 months or at a sub-therapeutic dose",
      "No A1c within the last 90 days (or A1c value not attached)",
      "Requested for weight loss rather than glycaemic control (off-label for the plan)",
      "Non-formulary GLP-1 requested without a trial of the preferred agent",
      "eGFR below 30 mL/min/1.73 m² or dialysis",
      "Pregnancy attestation missing",
    ],
    letterTemplateSections: ["Patient demographics and insurance information", "Diagnosis and A1c trend with dates", "Every prior glucose-lowering agent: dose, dates, outcome, reason stopped", "Renal function and why the renal threshold is met", "Cardiovascular and renal benefit of the requested agent", "Contraindication screen (MTC/MEN2, pancreatitis, pregnancy)", "Monitoring and discontinuation plan (repeat A1c, review date)"]
  },
  "radiograph": {
    label: "Advanced Imaging — MRI Brain / CT Thorax (Radiograph PA)",
    cptCodes: ["70551", "70552", "70553", "71250", "71260", "71270", "71271", "71046", "71047", "71048"],
    icdRanges: ["G43.0–G44.9 (Headache / migraine)", "R29.810 (Focal neurological deficit)", "R91.1 (Solitary pulmonary nodule)", "R05.9 (Cough, unspecified)", "C78.0–C78.9 (Metastatic disease)"],
    criteria: [
      { id: "rad-1", text: "Specific indication documented — not a screening or 'rule-out everything' order", required: true, typicalEvidence: "Ordering note with a focused differential" },
      { id: "rad-2", text: "Red-flag features or abnormal neurological / respiratory exam documented", required: true, typicalEvidence: "Exam findings, red-flag checklist" },
      { id: "rad-3", text: "Appropriate prior imaging already performed and non-diagnostic", required: true, typicalEvidence: "Prior CT / plain film report" },
      { id: "rad-4", text: "No duplicate advanced imaging of the same region within 90 days", required: true, typicalEvidence: "Imaging history / HIE query" },
      { id: "rad-5", text: "Conservative management trialled where the indication allows (headache prophylaxis, therapy, antibiotics)", required: false, typicalEvidence: "Medication trials with dates" },
      { id: "rad-6", text: "Contrast justified when a contrast study is requested (enhancement, pituitary, infection, tumour)", required: false, typicalEvidence: "Clinical question stated on the form" },
      { id: "rad-7", text: "Renal function within 30 days if iodinated or gadolinium contrast is planned", required: false, typicalEvidence: "eGFR / creatinine result" },
      { id: "rad-8", text: "No implanted device or metallic foreign body contraindication (MRI)", required: false, typicalEvidence: "MRI safety questionnaire" },
    ],
    stepTherapy: [
      { step: 1, requirement: "Plain radiograph or non-contrast CT of the region", typicalDuration: "Same day", alternatives: ["Ultrasound where appropriate (abdominal)"] },
      { step: 2, requirement: "Conservative or symptomatic management where clinically appropriate", typicalDuration: "6–8 weeks", alternatives: ["Physical therapy", "Prophylactic headache medication", "Antibiotics / inhaled therapy"] },
      { step: 3, requirement: "Advanced cross-sectional imaging (MRI / contrast CT)", typicalDuration: "After steps 1–2 or immediately if red flags", alternatives: ["CT where MRI is contraindicated", "PET-CT when staging a known malignancy"] },
    ],
    requiredDocs: requiredDocsFor("radiograph"),
    documentBundle: PA_DOCUMENT_BUNDLES["radiograph"],
    typicalTimeline: "2–7 business days (routine); 24–72 hours (expedited with red flags)",
    autoAuthThreshold: 1800,
    commonDenialReasons: [
      "No prior conservative care documented for a non-red-flag indication",
      "Duplicate imaging — same study already authorised or performed within 90 days",
      "Criteria for contrast not documented (no clinical question that requires gadolinium/iodine)",
      "Indication reads as screening rather than a diagnostic question",
      "Prior imaging not attached, so the payer cannot see why it was non-diagnostic",
      "Renal function missing on a contrast request",
    ],
    letterTemplateSections: ["Patient demographics and insurance information", "Specific diagnostic question being answered", "Red-flag symptoms and abnormal exam findings", "Prior imaging and why it was non-diagnostic", "Conservative therapy already completed (if applicable)", "Why the contrast phase is required", "Risk of delay: neurological deficit, missed malignancy, progressive disease"]
  },
  "behavioral-health": {
    label: "Behavioral Health — TMS for Treatment-Resistant Depression",
    cptCodes: ["90867", "90868", "90869"],
    icdRanges: ["F33.1–F33.3 (Recurrent depressive disorder)", "F32.1–F32.9 (Depressive episode)", "F41.1 (Generalised anxiety disorder)"],
    criteria: [
      { id: "bh-1", text: "Major depressive disorder confirmed by a psychiatric evaluation (DSM-5 criteria met)", required: true, typicalEvidence: "Psychiatric evaluation note" },
      { id: "bh-2", text: "Two or more adequate antidepressant trials failed (therapeutic dose, ≥6 weeks each, adherence documented)", required: true, typicalEvidence: "Medication trial log with doses and dates" },
      { id: "bh-3", text: "Measurement-based scores on file showing severity and trend (PHQ-9 / GAD-7)", required: true, typicalEvidence: "Scoring record with dates" },
      { id: "bh-4", text: "Psychotherapy trialled (or documented reason it was not appropriate)", required: false, typicalEvidence: "Therapy notes, session count" },
      { id: "bh-5", text: "Bipolar disorder and psychosis excluded", required: true, typicalEvidence: "Psychiatric history, screening instruments" },
      { id: "bh-6", text: "No seizure history, epilepsy, or implanted cranial/cochlear device", required: true, typicalEvidence: "TMS safety checklist" },
      { id: "bh-7", text: "Substance-induced mood disorder excluded", required: false, typicalEvidence: "Urine drug screen, history" },
      { id: "bh-8", text: "Medical-necessity letter from the treating psychiatrist", required: true, typicalEvidence: "Signed letter with the trial history restated" },
    ],
    stepTherapy: [
      { step: 1, requirement: "First antidepressant at therapeutic dose", typicalDuration: "≥6 weeks", alternatives: ["SSRI or SNRI per formulary"] },
      { step: 2, requirement: "Second antidepressant or augmentation trial", typicalDuration: "≥6 weeks", alternatives: ["Switch within class", "Add bupropion / mirtazapine / aripiprazole"] },
      { step: 3, requirement: "Structured psychotherapy (CBT / IPT)", typicalDuration: "12–20 sessions", alternatives: ["Group therapy where individual therapy is unavailable"] },
      { step: 4, requirement: "TMS acute course after documented treatment resistance", typicalDuration: "36 sessions over 6 weeks", alternatives: ["Esketamine (if formulary)", "Electroconvulsive therapy for psychotic or life-threatening depression"] },
    ],
    requiredDocs: requiredDocsFor("behavioral-health"),
    documentBundle: PA_DOCUMENT_BUNDLES["behavioral-health"],
    typicalTimeline: "3–10 business days (behavioral health review is often a separate queue)",
    autoAuthThreshold: 8000,
    commonDenialReasons: [
      "Fewer than two adequate antidepressant trials (dose too low or duration under 6 weeks)",
      "No measurement-based scores (PHQ-9 / GAD-7) submitted with dates",
      "Medical-necessity letter missing or not signed by the treating psychiatrist",
      "Bipolar disorder not excluded in the documentation",
      "Requested session count exceeds the plan's approved acute course",
      "Submitted without the psychiatric evaluation, only progress notes",
    ],
    letterTemplateSections: ["Patient demographics, insurance, and treating psychiatrist", "DSM-5 diagnosis and current episode duration", "Every antidepressant trial: drug, dose, duration, outcome, reason stopped", "PHQ-9 / GAD-7 scores with dates showing the trend", "Psychotherapy course and response", "Exclusion of bipolar disorder, psychosis and substance causes", "TMS safety screen and the monitoring plan for the acute course"]
  }
};

/** Common PA submission errors */
export const PA_COMMON_ERRORS = [
  { field: "ICD-10 Code", error: "Missing or invalid diagnosis code", fix: "Verify ICD-10 matches procedure indication" },
  { field: "CPT Code", error: "CPT not covered by patient's plan", fix: "Check plan benefits / use alternative code" },
  { field: "Clinical Notes", error: "Insufficient documentation of medical necessity", fix: "Add specific symptom details and prior treatment history" },
  { field: "Authorization Number", error: "Missing or expired auth number (re-auth)", fix: "Reference original auth number and reason for renewal" },
  { field: "Timing", error: "Retrospective auth (procedure already done)", fix: "Always submit PA before performing procedure for elective cases" },
  { field: "Payer Policy", error: "Procedure not on payer's approved list", fix: "Request single-case agreement or appeal with medical necessity letter" },
  { field: "Step Therapy", error: "Step therapy not completed before requesting advanced therapy", fix: "Document all prior step therapy attempts and failures" },
  { field: "Supporting Docs", error: "Missing required attachments (lab, imaging, notes)", fix: "Use clinical documentation mapper checklist before submitting" }
];