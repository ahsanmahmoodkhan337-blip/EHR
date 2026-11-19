// ──────────────────────────────────────────────────────────────────────
// Prior Auth Portal — paDocuments.ts
// Mock clinical documents that sit behind each PA case's required-doc list.
// Every bundle answers the question "what does the payer actually want to
// read?" — a clinic note, a lab report with reference ranges and H/L flags,
// an imaging / test report, and the payer's own request form.
//
// Content notes for maintainers:
//  • All patient names, MRNs, providers and payer names are fictional.
//    Payer names are deliberately invented (Meridian, Summit, Cedar Valley…)
//    so no real payer's medical policy is being represented.
//  • Reference ranges are typical adult ranges for illustration; real labs
//    vary by analyser and by patient sex/age. Teaching material, not a
//    clinical reference.
//  • Drug doses and trial durations shown reflect common step-therapy
//    conventions (e.g. ≥6 weeks at an adequate dose for an antidepressant
//    trial) and are illustrative, not a specific plan's policy.
//  • Code numbers (CPT/HCPCS/ICD-10) are used; all descriptors are written
//    in our own plain language, never copied from AMA/WHO/ADA wording.
// ──────────────────────────────────────────────────────────────────────

export interface PADocumentRow {
  label: string;
  value: string;
  /** H = above reference range, L = below, N = explicitly normal */
  flag?: "H" | "L" | "N";
}

export interface PADocumentSection {
  heading: string;
  body?: string;
  rows?: PADocumentRow[];
}

export interface PADocument {
  id: string;
  name: string;
  kind: "note" | "lab" | "imaging" | "form" | "letter";
  date: string;
  author: string;
  summary: string;
  sections?: PADocumentSection[];
  required: boolean;
}

/** Keys of the PA cases that carry a document bundle. */
export type PABundleKey =
  | "mri"
  | "ct"
  | "knee-replacement"
  | "cardiac-cath"
  | "infusion-therapy"
  | "sleep-study"
  | "biologic"
  | "medication"
  | "radiograph"
  | "behavioral-health";

export const PA_DOCUMENT_BUNDLES: Record<PABundleKey, PADocument[]> = {
  // ── MRI (lumbar spine) ────────────────────────────────────────────
  mri: [
    {
      id: "mri-note-1",
      name: "Orthopedic Clinic Progress Note — Lumbar Radiculopathy",
      kind: "note",
      date: "2026-06-22",
      author: "Dr. Sarah Chen, Orthopedics",
      summary: "Documents 9 weeks of radicular pain, failed PT and NSAIDs, and a positive straight-leg raise.",
      required: true,
      sections: [
        {
          heading: "Chief Complaint / HPI",
          body:
            "46-year-old male with 9 weeks of low back pain radiating down the right posterior thigh to the lateral calf. Onset after lifting at work, no inciting trauma. Pain 7/10 at worst, 4/10 at rest, worse with sitting >30 minutes and with coughing. Numbness over the right dorsum of the foot. No bowel or bladder dysfunction, no saddle anesthesia, no fever, no unexplained weight loss, no history of cancer.",
        },
        {
          heading: "Prior Treatment",
          body:
            "Naproxen 500 mg twice daily for 6 weeks — partial relief only. Physical therapy 2x/week x 8 weeks (core stabilization, neural mobilization) completed 2026-06-10 with no meaningful change in pain or function. Cyclobenzaprine trialled 3 weeks, discontinued for sedation. No epidural steroid injection to date.",
        },
        {
          heading: "Physical Exam",
          rows: [
            { label: "Lumbar flexion", value: "40° (limited by pain)" },
            { label: "Straight-leg raise, right", value: "Positive at 40° with radicular reproduction" },
            { label: "Straight-leg raise, left", value: "Negative at 70°" },
            { label: "Ankle dorsiflexion strength, right", value: "4/5" },
            { label: "Patellar / Achilles reflex, right", value: "Achilles diminished" },
            { label: "Sensation", value: "Decreased light touch, right L5 dermatome" },
            { label: "Red flags (fever, weight loss, cancer hx, saddle anesthesia)", value: "None present" },
          ],
        },
        {
          heading: "Assessment",
          body:
            "Right L5 radiculopathy, clinically suspected L5-S1 disc herniation with nerve root compression. M54.16 (radiculopathy, lumbar region) with M51.26 (lumbar disc displacement). Conservative care has been adequate in duration and dose and has failed.",
        },
        {
          heading: "Plan",
          body:
            "Request MRI lumbar spine without contrast (72148) to define the level and size of disc herniation before considering epidural steroid injection versus microdiscectomy referral. Red flags absent, so no urgent same-day imaging required. Patient advised to continue activity as tolerated; avoid bed rest.",
        },
      ],
    },
    {
      id: "mri-lab-1",
      name: "Lab Report — CBC with Differential, CRP, ESR",
      kind: "lab",
      date: "2026-06-20",
      author: "Meridian Reference Laboratory",
      summary: "Rules out infection or inflammatory arthropathy as an alternative cause of the back pain.",
      required: true,
      sections: [
        {
          heading: "Specimen: venous blood, fasting not required",
          rows: [
            { label: "White blood cells", value: "7.2 ×10³/µL (ref 4.0–11.0)", flag: "N" },
            { label: "Hemoglobin", value: "14.6 g/dL (ref 13.5–17.5)", flag: "N" },
            { label: "Hematocrit", value: "43.1 % (ref 38.8–50.0)", flag: "N" },
            { label: "Platelets", value: "268 ×10³/µL (ref 150–450)", flag: "N" },
            { label: "Neutrophils (absolute)", value: "4.1 ×10³/µL (ref 1.8–7.7)", flag: "N" },
            { label: "C-reactive protein", value: "3.1 mg/L (ref <5.0)", flag: "N" },
            { label: "Erythrocyte sedimentation rate", value: "11 mm/hr (ref 0–15)", flag: "N" },
            { label: "Creatinine", value: "0.98 mg/dL (ref 0.7–1.3)", flag: "N" },
          ],
        },
        {
          heading: "Interpretation",
          body:
            "No leukocytosis and normal inflammatory markers. Combined with the absence of fever and night pain, this makes spinal infection and inflammatory spondyloarthritis unlikely; the clinical picture remains mechanical/radicular.",
        },
      ],
    },
    {
      id: "mri-img-1",
      name: "Lumbar Spine X-ray (2 Views) — Radiology Report",
      kind: "imaging",
      date: "2026-06-12",
      author: "Dr. S. Iqbal, Radiology",
      summary: "Plain films already done and inconclusive — the reason a cross-sectional study is being requested.",
      required: true,
      sections: [
        {
          heading: "Technique",
          body: "AP and lateral radiographs of the lumbar spine, weight-bearing. No contrast.",
        },
        {
          heading: "Findings",
          body:
            "Alignment preserved; no spondylolisthesis. Mild disc space narrowing at L5-S1 with small anterior osteophytes. Vertebral body heights maintained. Pedicles intact. No obvious pars defect. Soft tissues unremarkable. Visualised sacroiliac joints appear normal.",
        },
        {
          heading: "Impression",
          body:
            "1. Mild degenerative change, L5-S1. 2. No fracture or malalignment. 3. Plain films cannot assess disc herniation or nerve root compression — clinical radiculopathy is not explained by these findings.",
        },
      ],
    },
    {
      id: "mri-note-2",
      name: "Physical Therapy Discharge Summary",
      kind: "letter",
      date: "2026-06-10",
      author: "A. Rehman, DPT — Cedar Ridge Physical Therapy",
      summary: "Independent proof that a supervised conservative trial was completed and failed.",
      required: true,
      sections: [
        {
          heading: "Course of care",
          body:
            "Sixteen visits over 8 weeks (2026-04-15 to 2026-06-10). Interventions: core stabilisation, directional preference exercises, neural mobilisation, manual therapy. Home programme reviewed at each visit.",
        },
        {
          heading: "Outcome measures",
          rows: [
            { label: "Oswestry Disability Index, start", value: "44 % (severe)" },
            { label: "Oswestry Disability Index, discharge", value: "38 % (severe)" },
            { label: "Numeric pain rating, start", value: "7/10" },
            { label: "Numeric pain rating, discharge", value: "6/10" },
            { label: "Straight-leg raise, right", value: "Still positive at 45°" },
          ],
        },
        {
          heading: "Discharge disposition",
          body:
            "Discharged at patient request with plateaued progress. No further functional gain expected from continued skilled therapy without a definitive diagnosis. Recommend imaging and specialist review.",
        },
      ],
    },
    {
      id: "mri-form-1",
      name: "Payer Prior Authorization Request Form — Advanced Imaging",
      kind: "form",
      date: "2026-06-22",
      author: "Dr. Sarah Chen (submitted via Meridian Health Plan portal)",
      summary: "The payer's own imaging request form, completed with the ordering indication and prior-care attestations.",
      required: true,
      sections: [
        {
          heading: "Member and order",
          rows: [
            { label: "Member ID", value: "MRD-4481927" },
            { label: "Plan", value: "Meridian Choice PPO — radiology benefit" },
            { label: "Ordering provider", value: "Dr. Sarah Chen, Orthopedics (NPI 1xxxxxxxxx)" },
            { label: "Requested service", value: "MRI lumbar spine without contrast (72148)" },
            { label: "Diagnosis codes", value: "M54.16, M51.26" },
            { label: "Requested date of service", value: "2026-07-02" },
            { label: "Urgency", value: "Routine" },
          ],
        },
        {
          heading: "Attestations",
          rows: [
            { label: "Supervised conservative care ≥6 weeks", value: "Yes — 16 PT visits, 8 weeks" },
            { label: "Analgesic trial documented", value: "Yes — naproxen 6 weeks, cyclobenzaprine 3 weeks" },
            { label: "Prior imaging on file", value: "Yes — lumbar X-ray 2026-06-12" },
            { label: "Red flags present (urgent imaging)", value: "No" },
            { label: "Same study billed within 90 days", value: "No" },
          ],
        },
        {
          heading: "Provider signature",
          body: "Signed electronically by Dr. Sarah Chen on 2026-06-22. Attachments: clinic note, X-ray report, PT discharge summary, lab report.",
        },
      ],
    },
    {
      id: "mri-letter-1",
      name: "Medical Necessity Letter — Ordering Physician",
      kind: "letter",
      date: "2026-06-22",
      author: "Dr. Sarah Chen, Orthopedics",
      summary: "Optional supporting letter used when a peer-to-peer review is requested.",
      required: false,
      sections: [
        {
          heading: "Re: Prior authorization request — MRI lumbar spine",
          body:
            "To the reviewing clinician: this patient has a clinically clear right L5 radiculopathy with a positive straight-leg raise, dermatomal sensory loss and 4/5 dorsiflexion. He has completed eight weeks of supervised physical therapy and two analgesic trials without functional gain. Plain films show only mild degeneration and cannot exclude a compressive lesion. The result of the MRI will determine whether he proceeds to epidural steroid injection or surgical referral — without it, both pathways are blind. Delay risks progressive motor weakness in an L5 distribution.",
        },
        {
          heading: "Signature",
          body: "Dr. Sarah Chen, MD — Orthopedics, Cedar Ridge Medical Group. 2026-06-22.",
        },
      ],
    },
  ],

  // ── CT chest ─────────────────────────────────────────────────────
  ct: [
    {
      id: "ct-note-1",
      name: "Pulmonology Consultation Note — Solitary Pulmonary Nodule",
      kind: "note",
      date: "2026-06-26",
      author: "Dr. Michael Patel, Pulmonology",
      summary: "Indication note: a nodule seen on plain film plus 6 kg weight loss and a 30 pack-year smoking history.",
      required: true,
      sections: [
        {
          heading: "HPI",
          body:
            "58-year-old female referred after a chest radiograph for persistent cough showed a 2.1 cm opacity in the right upper lobe. Cough for 7 weeks, non-productive, no hemoptysis. Unintentional weight loss of 6 kg over 3 months (72 kg → 66 kg, 8.3 %). Smoking history 30 pack-years, quit 4 years ago. No prior CT chest. No known malignancy.",
        },
        {
          heading: "Exam",
          rows: [
            { label: "Vitals", value: "BP 128/78, HR 84, RR 16, SpO₂ 96 % on room air, temp 36.8 °C" },
            { label: "Lungs", value: "Vesicular, no crackles or wheeze" },
            { label: "Clubbing / lymphadenopathy", value: "Absent" },
            { label: "Weight trend", value: "72 kg (2026-03) → 66 kg (2026-06)" },
          ],
        },
        {
          heading: "Assessment",
          body:
            "Indeterminate right upper lobe nodule (R91.1) with constitutional weight loss in a former smoker. Differential: primary bronchogenic carcinoma, granuloma, organising pneumonia, metastasis.",
        },
        {
          heading: "Plan",
          body:
            "Request CT chest with contrast (71260) to characterise the nodule (size, margins, spiculation, enhancement) and to stage the mediastinum. If malignant features, proceed to PET-CT and tissue sampling. Discussed with patient; agrees.",
        },
      ],
    },
    {
      id: "ct-img-1",
      name: "Chest Radiograph (PA and Lateral) — Radiology Report",
      kind: "imaging",
      date: "2026-06-19",
      author: "Dr. S. Iqbal, Radiology",
      summary: "The abnormal plain film that triggers the CT request — the payer's first required comparison study.",
      required: true,
      sections: [
        {
          heading: "Technique",
          body: "PA and lateral chest radiographs, standard technique. No contrast.",
        },
        {
          heading: "Findings",
          body:
            "There is a rounded 2.1 cm opacity in the right upper lobe projecting over the posterior fourth rib. Margins are ill-defined on the PA view. No cavitation. No hilar or mediastinal enlargement. No pleural effusion. Cardiac silhouette normal. Bones: no destructive lesion.",
        },
        {
          heading: "Impression",
          body:
            "1. Indeterminate right upper lobe opacity, 2.1 cm — cannot exclude neoplasm. 2. Recommend CT chest with contrast for characterisation. 3. No effusion or consolidation.",
        },
      ],
    },
    {
      id: "ct-lab-1",
      name: "Lab Report — CBC, CMP, CRP",
      kind: "lab",
      date: "2026-06-24",
      author: "Meridian Reference Laboratory",
      summary: "Baseline bloodwork supporting the workup: mild anaemia of chronic disease pattern, raised CRP.",
      required: true,
      sections: [
        {
          heading: "Specimen: venous blood",
          rows: [
            { label: "Hemoglobin", value: "10.9 g/dL (ref 12.0–15.5)", flag: "L" },
            { label: "Hematocrit", value: "33.4 % (ref 35.5–44.9)", flag: "L" },
            { label: "MCV", value: "82 fL (ref 80–100)", flag: "N" },
            { label: "White blood cells", value: "9.8 ×10³/µL (ref 4.0–11.0)", flag: "N" },
            { label: "Platelets", value: "402 ×10³/µL (ref 150–450)", flag: "N" },
            { label: "C-reactive protein", value: "28 mg/L (ref <5.0)", flag: "H" },
            { label: "ALT", value: "22 U/L (ref 7–56)", flag: "N" },
            { label: "Creatinine", value: "0.81 mg/dL (ref 0.7–1.3)", flag: "N" },
            { label: "Alkaline phosphatase", value: "148 U/L (ref 44–121)", flag: "H" },
            { label: "Calcium", value: "9.4 mg/dL (ref 8.6–10.2)", flag: "N" },
          ],
        },
        {
          heading: "Interpretation",
          body:
            "Normocytic anaemia with raised CRP and mildly raised alkaline phosphatase. Non-specific, but consistent with an inflammatory or malignant process and supports the need for cross-sectional imaging rather than watchful waiting.",
        },
      ],
    },
    {
      id: "ct-form-1",
      name: "Payer Prior Authorization Request Form — CT Chest with Contrast",
      kind: "form",
      date: "2026-06-26",
      author: "Dr. Michael Patel (submitted via Summit Care Advantage portal)",
      summary: "Payer form documenting the abnormal radiograph, weight loss and contrast justification.",
      required: true,
      sections: [
        {
          heading: "Member and order",
          rows: [
            { label: "Member ID", value: "SMT-9902341" },
            { label: "Plan", value: "Summit Care Advantage — Medicaid managed care" },
            { label: "Requested service", value: "CT thorax with contrast (71260)" },
            { label: "Diagnosis codes", value: "R91.1, R63.4 (abnormal weight loss), Z87.891 (former smoker)" },
            { label: "Requested date of service", value: "2026-07-06" },
            { label: "Urgency", value: "Routine (7-day standard review)" },
          ],
        },
        {
          heading: "Clinical questions on the form",
          rows: [
            { label: "Prior imaging available", value: "Yes — chest radiograph 2026-06-19, indeterminate RUL opacity" },
            { label: "Reason contrast is needed", value: "Assessment of nodule enhancement and mediastinal/hilar nodal staging" },
            { label: "Renal function within 30 days", value: "Yes — creatinine 0.81 mg/dL, eGFR >90" },
            { label: "Contrast allergy", value: "None known" },
            { label: "Alternative lower-cost study considered", value: "Non-contrast CT would not assess enhancement; PET-CT requires this CT first" },
          ],
        },
        {
          heading: "Signature",
          body: "Dr. Michael Patel, MD — Pulmonology. Submitted 2026-06-26. Attachments: consult note, radiograph report, lab report.",
        },
      ],
    },
  ],

  // ── Total knee arthroplasty ──────────────────────────────────────
  "knee-replacement": [
    {
      id: "tka-note-1",
      name: "Orthopedic Surgical Evaluation Note — Right Knee OA",
      kind: "note",
      date: "2026-06-24",
      author: "Dr. Michael Patel, Orthopedics",
      summary: "Documents Kellgren-Lawrence grade 4, BMI, functional loss and the full conservative course.",
      required: true,
      sections: [
        {
          heading: "HPI",
          body:
            "67-year-old female with 5 years of progressive right knee pain, now daily and night-waking. Cannot descend stairs without a rail, walks 1 block before stopping, stopped gardening and cannot kneel. Pain 8/10 with weight-bearing. Swelling after activity. No locking or true giving-way.",
        },
        {
          heading: "Exam and measurements",
          rows: [
            { label: "BMI", value: "32.4 kg/m² (height 1.60 m, weight 83 kg)" },
            { label: "Right knee ROM", value: "5°–105° with crepitus" },
            { label: "Varus deformity", value: "8° on standing" },
            { label: "Effusion", value: "Small, trace" },
            { label: "Ligament stability", value: "MCL/LCL intact; no instability" },
            { label: "Nicotine status", value: "Never smoker; urine cotinine negative 2026-06-20" },
            { label: "HbA1c", value: "6.4 % — prediabetic range, cleared for surgery" },
          ],
        },
        {
          heading: "Assessment",
          body:
            "Severe right knee osteoarthritis (M17.11), Kellgren-Lawrence grade 4 on 2026-06-18 radiograph, with functional limitation and failure of conservative care. Candidate for total knee arthroplasty (27447).",
        },
        {
          heading: "Plan",
          body:
            "Request prior authorization for right total knee arthroplasty. Pre-operative optimisation: continue weight management, medical clearance from PCP, dental screen complete. Patient understands 4–6 week recovery and rehabilitation plan.",
        },
      ],
    },
    {
      id: "tka-img-1",
      name: "Right Knee Radiograph — Radiology Report (Kellgren-Lawrence Grade)",
      kind: "imaging",
      date: "2026-06-18",
      author: "Dr. S. Iqbal, Radiology",
      summary: "Bearing weight-bearing views that grade the OA — the single document most TKA criteria hinge on.",
      required: true,
      sections: [
        {
          heading: "Technique",
          body: "Weight-bearing AP, lateral and skyline patellofemoral views of the right knee. No contrast.",
        },
        {
          heading: "Findings",
          body:
            "Severe joint space narrowing of the medial compartment with bone-on-bone contact. Large marginal osteophytes medially, laterally and on the patella. Subchondral sclerosis and cysts in the medial tibial plateau. Varus alignment 8°. No acute fracture. No loose body. Patellofemoral joint space narrowed with osteophytosis.",
        },
        {
          heading: "Impression",
          body:
            "1. Severe tricompartmental osteoarthritis, right knee. 2. Kellgren-Lawrence grade 4. 3. Medial compartment bone-on-bone with varus deformity. Findings meet radiographic criteria for arthroplasty.",
        },
      ],
    },
    {
      id: "tka-letter-1",
      name: "Physical Therapy Notes — Conservative Care Course",
      kind: "letter",
      date: "2026-05-30",
      author: "J. Okafor, DPT — Cedar Ridge Physical Therapy",
      summary: "Proves the PT step of conservative therapy was completed, with dates and outcome measures.",
      required: true,
      sections: [
        {
          heading: "Course of care",
          body:
            "Twelve visits over 6 weeks (2026-04-18 to 2026-05-30): quadriceps and hip strengthening, gait training, manual therapy, knee brace fitting and education.",
        },
        {
          heading: "Outcome measures",
          rows: [
            { label: "KOOS pain subscale, start", value: "38" },
            { label: "KOOS pain subscale, discharge", value: "41" },
            { label: "6-minute walk, start", value: "290 m" },
            { label: "6-minute walk, discharge", value: "305 m" },
            { label: "Pain rating, discharge", value: "8/10 with weight-bearing" },
          ],
        },
        {
          heading: "Discharge disposition",
          body:
            "No clinically meaningful improvement. Therapy discontinued as the patient has reached a plateau with end-stage radiographic disease. Recommend orthopedic surgical evaluation.",
        },
      ],
    },
    {
      id: "tka-form-1",
      name: "Payer Arthroplasty Authorization Form (with Injection History)",
      kind: "form",
      date: "2026-06-24",
      author: "Dr. Michael Patel (submitted via Meridian Health Plan portal)",
      summary: "Payer's surgical PA form, including the injection log and the BMI/nicotine attestations.",
      required: true,
      sections: [
        {
          heading: "Member and order",
          rows: [
            { label: "Member ID", value: "MRD-7712045" },
            { label: "Plan", value: "Meridian Choice PPO — surgical benefit" },
            { label: "Requested service", value: "Total knee arthroplasty, right (27447)" },
            { label: "Diagnosis codes", value: "M17.11" },
            { label: "Requested date of service", value: "2026-07-28" },
          ],
        },
        {
          heading: "Conservative care log",
          rows: [
            { label: "Supervised PT", value: "12 visits / 6 weeks, completed 2026-05-30, no gain" },
            { label: "NSAID trial", value: "Celecoxib 200 mg daily, 8 weeks, discontinued — GI upset" },
            { label: "Topical therapy", value: "Diclofenac gel 1 %, 6 weeks, minimal relief" },
            { label: "Intra-articular steroid", value: "2026-02-11 — 4 weeks partial relief, then relapse" },
            { label: "Viscosupplementation", value: "2026-04-02 — single series, no sustained benefit" },
            { label: "Assistive device", value: "Cane and hinged knee brace trialled" },
          ],
        },
        {
          heading: "Attestations",
          rows: [
            { label: "BMI", value: "32.4 kg/m² (plan threshold <40)" },
            { label: "Nicotine negative", value: "Yes — cotinine <10 ng/mL, 2026-06-20" },
            { label: "HbA1c", value: "6.4 % (plan threshold <8.0)" },
            { label: "Active infection", value: "None" },
            { label: "Kellgren-Lawrence grade", value: "4 (2026-06-18 radiograph)" },
          ],
        },
      ],
    },
    {
      id: "tka-lab-1",
      name: "Pre-operative Lab Report — HbA1c, CBC, Cotinine",
      kind: "lab",
      date: "2026-06-20",
      author: "Meridian Reference Laboratory",
      summary: "Shows the diabetic and nicotine thresholds the payer's criteria test are actually met.",
      required: true,
      sections: [
        {
          heading: "Specimen: venous blood / urine",
          rows: [
            { label: "HbA1c", value: "6.4 % (ref 4.0–5.6; goal for surgery <8.0)", flag: "H" },
            { label: "Fasting glucose", value: "112 mg/dL (ref 70–99)", flag: "H" },
            { label: "Hemoglobin", value: "13.1 g/dL (ref 12.0–15.5)", flag: "N" },
            { label: "White blood cells", value: "6.4 ×10³/µL (ref 4.0–11.0)", flag: "N" },
            { label: "Platelets", value: "241 ×10³/µL (ref 150–450)", flag: "N" },
            { label: "Creatinine", value: "0.72 mg/dL (ref 0.7–1.3)", flag: "N" },
            { label: "Urine cotinine", value: "4 ng/mL (ref <10 non-smoker)", flag: "N" },
            { label: "C-reactive protein", value: "2.2 mg/L (ref <5.0)", flag: "N" },
          ],
        },
        {
          heading: "Interpretation",
          body:
            "Prediabetes with HbA1c well under the surgical threshold. No anaemia, no leukocytosis, no inflammatory marker elevation to suggest septic joint. Cotinine confirms nicotine abstinence.",
        },
      ],
    },
  ],

  // ── Cardiac catheterisation ──────────────────────────────────────
  "cardiac-cath": [
    {
      id: "cath-note-1",
      name: "Cardiology Consultation Note — Unstable Angina",
      kind: "note",
      date: "2026-06-18",
      author: "Dr. James Wilson, Cardiology",
      summary: "Symptoms, CCS class, the positive stress test and why invasive angiography is now indicated.",
      required: true,
      sections: [
        {
          heading: "HPI",
          body:
            "61-year-old male with exertional chest pressure for 4 months, now occurring at rest twice in the past 2 weeks (each 10–15 minutes, relieved by sublingual nitrate). CCS class III. Risk factors: hypertension, dyslipidaemia, type 2 diabetes, 20 pack-year smoking history. No prior MI, PCI or CABG.",
        },
        {
          heading: "Exam and ECG",
          rows: [
            { label: "BP / HR", value: "148/88 mmHg / 92 bpm" },
            { label: "Cardiac exam", value: "Regular, no murmur, no S3, JVP normal" },
            { label: "ECG", value: "Sinus rhythm, 1 mm ST depression in V4–V6 at rest" },
            { label: "TIMI risk score", value: "4 (intermediate-high)" },
            { label: "10-year ASCVD risk", value: "27.4 %" },
          ],
        },
        {
          heading: "Assessment",
          body:
            "Unstable angina (I20.0) on a background of hypertension and diabetes, with resting ischaemic ECG changes and a positive stress study. High-risk features justify invasive evaluation rather than further non-invasive testing.",
        },
        {
          heading: "Plan",
          body:
            "Request prior authorization for left heart catheterisation with coronary angiography (93458). Continue aspirin 81 mg, atorvastatin 80 mg, metoprolol succinate 50 mg, nitroglycerin PRN. Consent discussed including contrast nephropathy and access-site risk.",
        },
      ],
    },
    {
      id: "cath-img-1",
      name: "Exercise Stress Echocardiogram Report",
      kind: "imaging",
      date: "2026-06-11",
      author: "Dr. L. Fernandes, Cardiology",
      summary: "The positive non-invasive study the payer expects to see before an invasive angiogram.",
      required: true,
      sections: [
        {
          heading: "Technique",
          body: "Bruce protocol treadmill stress echocardiography. Resting and peak-stress 2D echo with Doppler. Exercise terminated at 6 minutes 12 seconds for chest pain and 2 mm ST depression.",
        },
        {
          heading: "Findings",
          rows: [
            { label: "Resting EF", value: "52 %" },
            { label: "Peak workload", value: "7.1 METs" },
            { label: "Peak heart rate", value: "138 bpm (84 % predicted)" },
            { label: "Peak BP", value: "182/94 mmHg" },
            { label: "ECG during stress", value: "2 mm downsloping ST depression, V4–V6" },
            { label: "Wall motion at peak", value: "New hypokinesis, mid-to-apical anterior and anterolateral segments" },
            { label: "Symptoms at peak", value: "Reproduced typical chest pressure" },
          ],
        },
        {
          heading: "Impression",
          body:
            "1. Positive stress echocardiogram with inducible anterior/anterolateral ischaemia. 2. Exercise-induced angina and ECG ischaemia at a moderate workload. 3. Findings are consistent with significant LAD territory coronary disease; invasive angiography is recommended.",
        },
      ],
    },
    {
      id: "cath-lab-1",
      name: "Lab Report — High-Sensitivity Troponin, BNP, Lipid Panel",
      kind: "lab",
      date: "2026-06-17",
      author: "Meridian Reference Laboratory",
      summary: "Serial troponins exclude acute infarction; the lipid panel and BNP round out the risk picture.",
      required: true,
      sections: [
        {
          heading: "Specimen: venous blood",
          rows: [
            { label: "hs-troponin I, 0 h", value: "0.02 ng/mL (ref <0.04)", flag: "N" },
            { label: "hs-troponin I, 3 h", value: "0.03 ng/mL (ref <0.04)", flag: "N" },
            { label: "BNP", value: "184 pg/mL (ref <100)", flag: "H" },
            { label: "Total cholesterol", value: "228 mg/dL (ref <200)", flag: "H" },
            { label: "LDL cholesterol", value: "152 mg/dL (ref <100)", flag: "H" },
            { label: "HDL cholesterol", value: "34 mg/dL (ref >40)", flag: "L" },
            { label: "Triglycerides", value: "196 mg/dL (ref <150)", flag: "H" },
            { label: "HbA1c", value: "8.1 % (ref 4.0–5.6)", flag: "H" },
            { label: "Creatinine", value: "1.18 mg/dL (ref 0.7–1.3)", flag: "N" },
            { label: "eGFR", value: "68 mL/min/1.73 m² (ref >90)", flag: "L" },
          ],
        },
        {
          heading: "Interpretation",
          body:
            "No rise in serial troponin — acute myocardial infarction excluded, consistent with unstable angina rather than NSTEMI. Elevated BNP suggests early diastolic strain. Markedly abnormal lipids and uncontrolled diabetes reinforce aggressive risk-factor management. Creatinine is acceptable for contrast exposure with hydration.",
        },
      ],
    },
    {
      id: "cath-form-1",
      name: "Payer Cardiac Procedure Authorization Form",
      kind: "form",
      date: "2026-06-18",
      author: "Dr. James Wilson (submitted via United-style portal — fictional plan: Northbridge Health)",
      summary: "Payer form capturing the non-invasive results and the medical-management history.",
      required: true,
      sections: [
        {
          heading: "Member and order",
          rows: [
            { label: "Member ID", value: "NBH-5560128" },
            { label: "Plan", value: "Northbridge Health — commercial PPO" },
            { label: "Requested service", value: "Left heart catheterisation with coronary angiography (93458)" },
            { label: "Diagnosis codes", value: "I20.0, I10, E11.9" },
            { label: "Requested date of service", value: "2026-06-25" },
            { label: "Urgency", value: "Urgent — resting angina, 5-day expedited review requested" },
          ],
        },
        {
          heading: "Non-invasive testing summary",
          rows: [
            { label: "Stress echo", value: "2026-06-11 — positive, inducible anterior ischaemia, 7.1 METs" },
            { label: "Resting ECG", value: "ST depression V4–V6" },
            { label: "Troponin", value: "Serial negative" },
            { label: "Echocardiogram", value: "EF 52 %, no significant valvular disease" },
          ],
        },
        {
          heading: "Medical management to date",
          rows: [
            { label: "Antiplatelet", value: "Aspirin 81 mg daily" },
            { label: "Statin", value: "Atorvastatin 80 mg daily (intolerance to rosuvastatin)" },
            { label: "Beta-blocker", value: "Metoprolol succinate 50 mg daily" },
            { label: "Antianginal", value: "Nitroglycerin SL PRN; isosorbide mononitrate trialled, headache" },
            { label: "Reason for proceeding", value: "Symptoms at rest despite maximal tolerated therapy" },
          ],
        },
      ],
    },
  ],

  // ── Infusion therapy ─────────────────────────────────────────────
  "infusion-therapy": [
    {
      id: "inf-note-1",
      name: "Gastroenterology Progress Note — Crohn's Disease (HBI 11)",
      kind: "note",
      date: "2026-06-13",
      author: "Dr. Lisa Wong, Gastroenterology",
      summary: "Disease activity score, failed DMARD/steroid course and the infusion request.",
      required: true,
      sections: [
        {
          heading: "HPI",
          body:
            "34-year-old female with ileocolonic Crohn's disease diagnosed 2023 by colonoscopy and biopsy. Currently 5–6 loose stools daily, urgency, nocturnal waking, cramping abdominal pain, fatigue. Two steroid courses in the past year. Weight down 4 kg in 3 months.",
        },
        {
          heading: "Disease activity",
          rows: [
            { label: "Harvey-Bradshaw Index", value: "11 (moderate-severe activity)" },
            { label: "Stool frequency", value: "5–6/day, nocturnal present" },
            { label: "Abdominal pain", value: "Daily, rated 6/10" },
            { label: "Faecal calprotectin", value: "480 µg/g (ref <50)", flag: "H" },
            { label: "CRP", value: "22 mg/L (ref <5.0)", flag: "H" },
          ],
        },
        {
          heading: "Treatment history",
          body:
            "Mesalamine 4.8 g/day for 5 months — no response. Azathioprine 100 mg daily for 4 months — stopped for nausea and transaminitis. Budesonide 9 mg for 8 weeks — partial response, relapsed on taper. Prednisolone 40 mg taper — responded then relapsed within 6 weeks.",
        },
        {
          heading: "Assessment / Plan",
          body:
            "Moderate-severe Crohn's disease (K50.10) with inadequate response to conventional therapy and steroid dependence. Request prior authorization for anti-TNF infusion (infliximab biosimilar) induction at weeks 0, 2 and 6, then every 8 weeks. Screening labs reviewed and negative for latent TB and hepatitis B/C.",
        },
      ],
    },
    {
      id: "inf-lab-1",
      name: "Lab Report — TB Screening (Interferon-Gamma Release Assay) and Hepatitis Serology",
      kind: "lab",
      date: "2026-06-09",
      author: "Meridian Reference Laboratory",
      summary: "The screening the payer will not approve a biologic without — with the collection date visible.",
      required: true,
      sections: [
        {
          heading: "QuantiFERON-TB Gold Plus — specimen collected 2026-06-09",
          rows: [
            { label: "Nil control", value: "0.02 IU/mL (ref <0.35)" },
            { label: "TB1 antigen tube", value: "0.01 IU/mL (ref <0.35)", flag: "N" },
            { label: "TB2 antigen tube", value: "0.02 IU/mL (ref <0.35)", flag: "N" },
            { label: "Mitogen control", value: "8.40 IU/mL (ref ≥0.50 — valid)" },
            { label: "Result", value: "Negative for tuberculosis infection", flag: "N" },
          ],
        },
        {
          heading: "Hepatitis serology",
          rows: [
            { label: "Hepatitis B surface antigen", value: "Non-reactive", flag: "N" },
            { label: "Hepatitis B surface antibody", value: "48 mIU/mL (ref ≥10 = immune)" },
            { label: "Hepatitis B core antibody, total", value: "Non-reactive", flag: "N" },
            { label: "Hepatitis C antibody", value: "Non-reactive", flag: "N" },
            { label: "HIV 1/2 antigen/antibody", value: "Non-reactive", flag: "N" },
          ],
        },
        {
          heading: "Safety labs",
          rows: [
            { label: "Hemoglobin", value: "10.4 g/dL (ref 12.0–15.5)", flag: "L" },
            { label: "White blood cells", value: "11.6 ×10³/µL (ref 4.0–11.0)", flag: "H" },
            { label: "Platelets", value: "468 ×10³/µL (ref 150–450)", flag: "H" },
            { label: "ALT", value: "31 U/L (ref 7–56)", flag: "N" },
            { label: "Creatinine", value: "0.68 mg/dL (ref 0.7–1.3)", flag: "L" },
          ],
        },
      ],
    },
    {
      id: "inf-img-1",
      name: "Colonoscopy Report with Biopsy — Terminal Ileum",
      kind: "imaging",
      date: "2026-05-20",
      author: "Dr. Lisa Wong, Gastroenterology",
      summary: "Diagnostic endoscopy confirming the diagnosis and disease extent.",
      required: true,
      sections: [
        {
          heading: "Technique",
          body: "Colonoscopy to the caecum under conscious sedation. Biopsies taken from terminal ileum, ascending colon and transverse colon.",
        },
        {
          heading: "Findings",
          body:
            "Patchy deep ulceration in the terminal ileum with a stricture that admits a standard scope with mild resistance. Cobblestoning of the ileocaecal valve. Skip lesions in the ascending colon with mucosal erythema. Rectum spared. No dysplasia on visual inspection.",
        },
        {
          heading: "Impression",
          body:
            "1. Active ileocolonic Crohn's disease with ileal stricture. 2. Histology: chronic active ileitis with granulomas, consistent with Crohn's disease. 3. SES-CD score 12 (moderate-severe endoscopic activity).",
        },
      ],
    },
    {
      id: "inf-form-1",
      name: "Payer Specialty Drug Authorization Form — Biologic Infusion",
      kind: "form",
      date: "2026-06-13",
      author: "Dr. Lisa Wong (submitted via Cedar Valley Health portal)",
      summary: "Payer form listing every prior therapy with dates and outcomes, plus screening attestations.",
      required: true,
      sections: [
        {
          heading: "Member and order",
          rows: [
            { label: "Member ID", value: "CVH-3310557" },
            { label: "Plan", value: "Cedar Valley Health — commercial HMO, specialty pharmacy rider" },
            { label: "Requested service", value: "Infliximab biosimilar infusion, induction + maintenance (96413, J1745)" },
            { label: "Diagnosis codes", value: "K50.10" },
            { label: "Site of care", value: "Hospital outpatient infusion centre" },
          ],
        },
        {
          heading: "Step therapy attestation",
          rows: [
            { label: "Step 1 — mesalamine", value: "4.8 g/day, 5 months, no response" },
            { label: "Step 2 — azathioprine", value: "100 mg/day, 4 months, stopped for adverse effect" },
            { label: "Step 3 — corticosteroid", value: "Budesonide 8 weeks + prednisolone taper, steroid-dependent relapse" },
            { label: "Preferred formulary biologic trialled", value: "No — ustekinumab not indicated for this phenotype per treating GI" },
          ],
        },
        {
          heading: "Screening attestation",
          rows: [
            { label: "TB screening", value: "Negative IGRA, collected 2026-06-09" },
            { label: "Hepatitis B/C", value: "Negative, 2026-06-09" },
            { label: "Active infection", value: "None" },
            { label: "Pregnancy status", value: "Negative urine hCG 2026-06-09" },
          ],
        },
      ],
    },
  ],

  // ── Sleep study ──────────────────────────────────────────────────
  "sleep-study": [
    {
      id: "sleep-note-1",
      name: "Sleep Medicine Consultation Note — Suspected OSA",
      kind: "note",
      date: "2026-06-28",
      author: "Dr. Sarah Chen, Sleep Medicine",
      summary: "STOP-BANG and Epworth scores, witnessed apnoeas and the daytime-functioning impact.",
      required: true,
      sections: [
        {
          heading: "HPI",
          body:
            "44-year-old male with 2 years of loud snoring, witnessed apnoeas and gasping reported by his wife 4–5 nights per week. Wakes unrefreshed, falls asleep watching television, and has nodded off once while driving short distances. Morning headaches. No sedative use; 2 cups of coffee daily.",
        },
        {
          heading: "Screening instruments",
          rows: [
            { label: "STOP-BANG", value: "5 of 8 (high risk)" },
            { label: "Epworth Sleepiness Scale", value: "14/24 (excessive daytime sleepiness)" },
            { label: "BMI", value: "34.1 kg/m²" },
            { label: "Neck circumference", value: "43 cm" },
            { label: "Blood pressure", value: "146/92 mmHg (on 2 agents)" },
            { label: "Mallampati score", value: "III" },
          ],
        },
        {
          heading: "Assessment",
          body:
            "High pre-test probability of moderate-severe obstructive sleep apnoea (G47.33) with resistant hypertension and excessive daytime sleepiness. Comorbid obesity.",
        },
        {
          heading: "Plan",
          body:
            "Request authorization for attended in-lab polysomnography (95810) rather than a home test — the patient has significant cardiopulmonary comorbidity and possible central events, and a home test cannot differentiate or titrate. Sleep hygiene education given; avoid alcohol and driving when drowsy.",
        },
      ],
    },
    {
      id: "sleep-lab-1",
      name: "Lab Report — TSH, CBC, Ferritin",
      kind: "lab",
      date: "2026-06-26",
      author: "Meridian Reference Laboratory",
      summary: "Excludes hypothyroidism and iron deficiency as alternative causes of fatigue and sleepiness.",
      required: true,
      sections: [
        {
          heading: "Specimen: venous blood",
          rows: [
            { label: "TSH", value: "2.1 mIU/L (ref 0.4–4.0)", flag: "N" },
            { label: "Free T4", value: "1.2 ng/dL (ref 0.8–1.8)", flag: "N" },
            { label: "Hemoglobin", value: "17.2 g/dL (ref 13.5–17.5)", flag: "H" },
            { label: "Hematocrit", value: "51.0 % (ref 38.8–50.0)", flag: "H" },
            { label: "RBC", value: "5.86 ×10⁶/µL (ref 4.5–5.9)", flag: "N" },
            { label: "Ferritin", value: "96 ng/mL (ref 24–336)", flag: "N" },
            { label: "Fasting glucose", value: "118 mg/dL (ref 70–99)", flag: "H" },
          ],
        },
        {
          heading: "Interpretation",
          body:
            "Euthyroid. Borderline erythrocytosis with haematocrit at the upper limit — a pattern seen with chronic nocturnal hypoxaemia and supportive of the sleep-disordered breathing hypothesis. No iron deficiency.",
        },
      ],
    },
    {
      id: "sleep-form-1",
      name: "Payer Sleep Study Authorization Form (with Sleep History Questionnaire)",
      kind: "form",
      date: "2026-06-28",
      author: "Dr. Sarah Chen (submitted via Northbridge Health portal)",
      summary: "Payer form plus the bed-partner questionnaire it requires before approving in-lab testing.",
      required: true,
      sections: [
        {
          heading: "Member and order",
          rows: [
            { label: "Member ID", value: "NBH-6620473" },
            { label: "Plan", value: "Northbridge Health — commercial PPO" },
            { label: "Requested service", value: "Attended polysomnography, in-lab (95810)" },
            { label: "Diagnosis codes", value: "G47.33, I10, E66.9" },
            { label: "Requested date of service", value: "2026-07-15" },
          ],
        },
        {
          heading: "Why not a home test",
          rows: [
            { label: "Home sleep test trialled", value: "No — not appropriate for this patient" },
            { label: "Reason in-lab needed", value: "Resistant hypertension, possible central events, need for CPAP titration" },
            { label: "STOP-BANG", value: "5/8 — high risk" },
            { label: "Epworth Sleepiness Scale", value: "14/24" },
            { label: "Safety", value: "Reported drowsy driving — expedited review requested" },
          ],
        },
        {
          heading: "Bed-partner questionnaire (patient-reported)",
          rows: [
            { label: "Witnessed pauses in breathing", value: "4–5 nights per week" },
            { label: "Gasping or choking", value: "Most nights" },
            { label: "Snoring loudness", value: "Audible through a closed door" },
            { label: "Sleep position dependence", value: "Worse on back" },
          ],
        },
      ],
    },
  ],

  // ── Biologic therapy ─────────────────────────────────────────────
  biologic: [
    {
      id: "bio-note-1",
      name: "Dermatology Consultation Note — Severe Plaque Psoriasis (PASI 18.4)",
      kind: "note",
      date: "2026-06-08",
      author: "Dr. Karen Thompson, Dermatology",
      summary: "Severity scoring, the topical and phototherapy failures, and the adalimumab request.",
      required: true,
      sections: [
        {
          heading: "HPI",
          body:
            "41-year-old female with plaque psoriasis for 12 years, now involving trunk, elbows, knees and scalp. Itching severe enough to disturb sleep. New nail pitting and two painful palmar plaques affecting work as a hairdresser. No psoriatic arthritis symptoms.",
        },
        {
          heading: "Severity scoring (2026-06-08)",
          rows: [
            { label: "PASI", value: "18.4 (severe, >10 threshold)" },
            { label: "Body surface area", value: "26 %" },
            { label: "Dermatology Life Quality Index", value: "19/30 (very large effect)" },
            { label: "Physician Global Assessment", value: "4 — severe" },
            { label: "Nail involvement", value: "Pitting and onycholysis, 6 nails" },
          ],
        },
        {
          heading: "Prior therapy",
          body:
            "Clobetasol 0.05 % and calcipotriol for 6 months — inadequate control. NB-UVB phototherapy 30 sessions over 4 months — 30 % improvement, relapsed within 8 weeks. Methotrexate 15 mg weekly for 4 months — stopped for nausea and transaminitis (ALT peaked 96 U/L). Ciclosporin declined by patient for blood pressure concern.",
        },
        {
          heading: "Assessment / Plan",
          body:
            "Severe chronic plaque psoriasis (L40.0) with high DLQI, failed topical, phototherapy and methotrexate. Request prior authorization for adalimumab 80 mg loading then 40 mg every other week. TB and hepatitis screening negative within the last 6 months; CBC, LFTs and renal function within 30 days.",
        },
      ],
    },
    {
      id: "bio-lab-1",
      name: "Lab Report — QuantiFERON-TB Gold, Hepatitis Panel, CBC, LFTs",
      kind: "lab",
      date: "2026-06-05",
      author: "Meridian Reference Laboratory",
      summary: "Negative TB and hepatitis screening with a dated result — the most common missing-document denial.",
      required: true,
      sections: [
        {
          heading: "QuantiFERON-TB Gold Plus — collected 2026-06-05",
          rows: [
            { label: "Nil", value: "0.01 IU/mL (ref <0.35)" },
            { label: "TB antigen 1", value: "0.00 IU/mL (ref <0.35)", flag: "N" },
            { label: "TB antigen 2", value: "0.01 IU/mL (ref <0.35)", flag: "N" },
            { label: "Mitogen", value: "9.20 IU/mL (ref ≥0.50 — valid)" },
            { label: "Result", value: "Negative — no evidence of latent TB", flag: "N" },
          ],
        },
        {
          heading: "Hepatitis and HIV serology",
          rows: [
            { label: "HBsAg", value: "Non-reactive", flag: "N" },
            { label: "Anti-HBs", value: "112 mIU/mL (immune)" },
            { label: "Anti-HBc total", value: "Non-reactive", flag: "N" },
            { label: "Anti-HCV", value: "Non-reactive", flag: "N" },
            { label: "HIV Ag/Ab", value: "Non-reactive", flag: "N" },
          ],
        },
        {
          heading: "Safety labs",
          rows: [
            { label: "Hemoglobin", value: "13.0 g/dL (ref 12.0–15.5)", flag: "N" },
            { label: "White blood cells", value: "8.1 ×10³/µL (ref 4.0–11.0)", flag: "N" },
            { label: "ALT", value: "38 U/L (ref 7–56)", flag: "N" },
            { label: "AST", value: "29 U/L (ref 10–40)", flag: "N" },
            { label: "Creatinine", value: "0.74 mg/dL (ref 0.7–1.3)", flag: "N" },
            { label: "CRP", value: "6.8 mg/L (ref <5.0)", flag: "H" },
          ],
        },
      ],
    },
    {
      id: "bio-img-1",
      name: "Skin Biopsy Report — Plaque Psoriasis (Histopathology)",
      kind: "imaging",
      date: "2026-05-14",
      author: "Dr. R. Ahmed, Dermatopathology",
      summary: "Diagnostic confirmation the payer asks for when the diagnosis itself is questioned.",
      required: true,
      sections: [
        {
          heading: "Specimen",
          body: "4 mm punch biopsy, right elbow plaque. H&E with periodic acid-Schiff stain.",
        },
        {
          heading: "Findings",
          body:
            "Marked regular psoriasiform epidermal hyperplasia with hypogranulosis. Confluent parakeratosis containing neutrophils. Dilated tortuous capillaries in the dermal papillae with a perivascular lymphocytic infiltrate. No fungal organisms on PAS. No interface change to suggest lichen planus.",
        },
        {
          heading: "Impression",
          body: "Histological features of plaque psoriasis. No evidence of fungal infection or drug eruption. Diagnosis of psoriasis vulgaris confirmed.",
        },
      ],
    },
    {
      id: "bio-form-1",
      name: "Payer Biologic Authorization Form — Step Therapy Attestation",
      kind: "form",
      date: "2026-06-08",
      author: "Dr. Karen Thompson (submitted via Meridian Health Plan portal)",
      summary: "Payer form listing prior therapies with dates and why each failed, plus screening results.",
      required: true,
      sections: [
        {
          heading: "Member and order",
          rows: [
            { label: "Member ID", value: "MRD-2214986" },
            { label: "Plan", value: "Meridian Choice PPO — specialty drug rider" },
            { label: "Requested service", value: "Adalimumab 40 mg subcutaneous, every other week (J0135 / pharmacy benefit)" },
            { label: "Diagnosis codes", value: "L40.0" },
            { label: "Quantity / duration requested", value: "3 months initial, re-review at 4 months with repeat PASI" },
          ],
        },
        {
          heading: "Step therapy attestation",
          rows: [
            { label: "Topical corticosteroids + vitamin D analogue", value: "6 months, inadequate response" },
            { label: "NB-UVB phototherapy", value: "30 sessions / 4 months, 30 % improvement, relapsed" },
            { label: "Methotrexate", value: "15 mg weekly x 4 months, stopped for transaminitis" },
            { label: "Preferred formulary agent", value: "Adalimumab biosimilar — accepted, dispense as written" },
          ],
        },
        {
          heading: "Attestations",
          rows: [
            { label: "TB screening", value: "Negative IGRA 2026-06-05" },
            { label: "Hepatitis B/C", value: "Negative 2026-06-05" },
            { label: "PASI / DLQI", value: "18.4 / 19 — severe, documented 2026-06-08" },
            { label: "No prior serious infection on biologic", value: "Confirmed — biologic-naive" },
          ],
        },
      ],
    },
  ],

  // ── NEW: Medication (GLP-1 / semaglutide) ───────────────────────
  medication: [
    {
      id: "med-note-1",
      name: "Primary Care Progress Note — Type 2 Diabetes, Semaglutide Request",
      kind: "note",
      date: "2026-10-14",
      author: "Dr. Ayesha Siddiqui, Internal Medicine",
      summary: "Shows the A1c trajectory, the metformin and second-agent trials, and the reason a GLP-1 is now needed.",
      required: true,
      sections: [
        {
          heading: "HPI",
          body:
            "52-year-old female with type 2 diabetes for 7 years, hypertension and dyslipidaemia. Reports polyuria, fatigue and blurred vision over the last 2 months. Home glucose readings 180–240 mg/dL fasting. BMI 33.8 kg/m². No history of pancreatitis, no personal or family history of medullary thyroid carcinoma or MEN2, no gastroparesis, not pregnant.",
        },
        {
          heading: "Glycaemic and metabolic history",
          rows: [
            { label: "HbA1c 2026-04-08", value: "8.1 %" },
            { label: "HbA1c 2026-07-09", value: "8.6 %" },
            { label: "HbA1c 2026-10-12", value: "9.2 %", flag: "H" },
            { label: "Weight", value: "92 kg (BMI 33.8 kg/m²)" },
            { label: "Blood pressure", value: "138/84 mmHg on lisinopril 20 mg" },
            { label: "eGFR (CKD-EPI)", value: "62 mL/min/1.73 m²", flag: "L" },
          ],
        },
        {
          heading: "Current and prior therapy",
          body:
            "Metformin 1000 mg twice daily since 2021 (maximum tolerated dose; 1500 mg caused GI intolerance). Glipizide 5 mg daily added 2026-05-12 and titrated to 10 mg — discontinued 2026-08-20 after two documented hypoglycaemic episodes (glucose 58 mg/dL and 62 mg/dL). Pioglitazone discussed but declined due to oedema history. No insulin to date; patient reluctant to start basal insulin.",
        },
        {
          heading: "Assessment",
          body:
            "Type 2 diabetes mellitus without complications (E11.9) with A1c above goal despite metformin at maximum tolerated dose and a failed sulfonylurea trial. Meets plan criteria for GLP-1 receptor agonist therapy as add-on: A1c >7.5 %, metformin ≥3 months, second agent trialled and failed, eGFR ≥30.",
        },
        {
          heading: "Plan",
          body:
            "Request prior authorization for semaglutide (once-weekly injectable GLP-1) 0.25 mg weekly x 4 weeks, then 0.5 mg weekly, titrating to 1 mg weekly by week 9. Continue metformin. Diabetes education referral; retinal screening booked. Review in 12 weeks with repeat A1c; discontinue if A1c does not fall by ≥0.5 % at 6 months.",
        },
      ],
    },
    {
      id: "med-lab-1",
      name: "Lab Report — HbA1c, Renal Function, Lipid Panel",
      kind: "lab",
      date: "2026-10-12",
      author: "Meridian Reference Laboratory",
      summary: "The exact three panels the payer's GLP-1 criteria test — glycaemic control, renal eligibility and cardiovascular risk.",
      required: true,
      sections: [
        {
          heading: "Specimen: venous blood, fasting 10 hours",
          rows: [
            { label: "HbA1c", value: "9.2 % (ref 4.0–5.6; goal on therapy <7.0)", flag: "H" },
            { label: "Fasting glucose", value: "214 mg/dL (ref 70–99)", flag: "H" },
            { label: "Creatinine", value: "1.06 mg/dL (ref 0.7–1.3)", flag: "N" },
            { label: "eGFR (CKD-EPI 2021)", value: "62 mL/min/1.73 m² (ref >90)", flag: "L" },
            { label: "Urine albumin/creatinine ratio", value: "48 mg/g (ref <30)", flag: "H" },
            { label: "Total cholesterol", value: "212 mg/dL (ref <200)", flag: "H" },
            { label: "LDL cholesterol", value: "128 mg/dL (ref <100)", flag: "H" },
            { label: "HDL cholesterol", value: "41 mg/dL (ref >50)", flag: "L" },
            { label: "Triglycerides", value: "224 mg/dL (ref <150)", flag: "H" },
            { label: "ALT", value: "34 U/L (ref 7–56)", flag: "N" },
            { label: "Lipase", value: "31 U/L (ref 13–60)", flag: "N" },
          ],
        },
        {
          heading: "Interpretation",
          body:
            "Uncontrolled type 2 diabetes (A1c 9.2 %) with mildly reduced renal function (eGFR 62) and early albuminuria, plus an atherogenic lipid profile. eGFR is above the 30 mL/min threshold at which GLP-1 therapy is contraindicated. Normal lipase and no pancreatitis history.",
        },
      ],
    },
    {
      id: "med-form-1",
      name: "Payer GLP-1 Step Therapy Authorization Form",
      kind: "form",
      date: "2026-10-14",
      author: "Dr. Ayesha Siddiqui (submitted via Summit Care Advantage portal)",
      summary: "The payer's diabetes-drug PA form: diagnosis, A1c, every prior agent with dose and dates, and contraindication screening.",
      required: true,
      sections: [
        {
          heading: "Member and order",
          rows: [
            { label: "Member ID", value: "SMT-7741308" },
            { label: "Plan", value: "Summit Care Advantage — commercial PPO, pharmacy benefit" },
            { label: "Requested drug", value: "Semaglutide injection, once weekly (GLP-1 receptor agonist)" },
            { label: "Diagnosis codes", value: "E11.9, E78.5 (dyslipidaemia), I10" },
            { label: "Strength / quantity", value: "0.25 mg → 0.5 mg → 1 mg weekly pens; 90-day supply" },
            { label: "Requested start date", value: "2026-10-21" },
          ],
        },
        {
          heading: "Step therapy section",
          rows: [
            { label: "Step 1 — metformin", value: "1000 mg BID since 2021, maximum tolerated dose; therapy ongoing" },
            { label: "Step 2 — second agent", value: "Glipizide 5→10 mg daily, 2026-05-12 to 2026-08-20, failed (hypoglycaemia)" },
            { label: "Preferred GLP-1 on formulary", value: "Yes — this drug is the formulary-preferred GLP-1" },
            { label: "Insulin trialled", value: "No — patient declined; not required by plan criteria" },
          ],
        },
        {
          heading: "Clinical attestations",
          rows: [
            { label: "Most recent HbA1c and date", value: "9.2 % on 2026-10-12 (within 90 days)" },
            { label: "eGFR", value: "62 mL/min/1.73 m² — above the 30 threshold" },
            { label: "Personal/family history of medullary thyroid carcinoma or MEN2", value: "No" },
            { label: "History of pancreatitis", value: "No" },
            { label: "Gastroparesis", value: "No" },
            { label: "Pregnancy / breastfeeding", value: "Not pregnant, not breastfeeding" },
            { label: "Indication is weight loss alone", value: "No — indication is glycaemic control in type 2 diabetes" },
          ],
        },
        {
          heading: "Signature",
          body: "Dr. Ayesha Siddiqui, MD — Internal Medicine. Signed 2026-10-14. Attachments: progress note, lab report.",
        },
      ],
    },
    {
      id: "med-letter-1",
      name: "Medical Necessity Letter — GLP-1 Therapy",
      kind: "letter",
      date: "2026-10-14",
      author: "Dr. Ayesha Siddiqui, Internal Medicine",
      summary: "Supporting letter used on appeal or peer-to-peer when the step-therapy form alone is questioned.",
      required: false,
      sections: [
        {
          heading: "Re: Prior authorization — semaglutide for type 2 diabetes",
          body:
            "This patient's A1c has risen from 8.1 % to 9.2 % over six months despite metformin at the maximum dose she tolerates and a documented sulfonylurea failure with symptomatic hypoglycaemia. She has early diabetic kidney disease (eGFR 62, albumin/creatinine 48) and an atherogenic lipid profile. A GLP-1 receptor agonist addresses glycaemia, weight and cardiovascular risk in one agent and carries low hypoglycaemia risk, which matters because she has already had two hypoglycaemic episodes. Basal insulin was offered and declined; it would also increase her hypoglycaemia risk. Delaying intensification at an A1c of 9.2 % with albuminuria risks progressive renal and microvascular injury.",
        },
        {
          heading: "Monitoring plan",
          body:
            "Repeat A1c at 12 weeks and 6 months; continue retinal screening; renal function every 6 months. Therapy will be discontinued if A1c falls by less than 0.5 % at 6 months.",
        },
        {
          heading: "Signature",
          body: "Dr. Ayesha Siddiqui, MD — Internal Medicine, Cedar Ridge Medical Group. 2026-10-14.",
        },
      ],
    },
  ],

  // ── NEW: Radiographs / advanced imaging (MRI brain, CT thorax) ──
  radiograph: [
    {
      id: "rad-note-1",
      name: "Neurology Consultation Note — Chronic Headache with Focal Deficit",
      kind: "note",
      date: "2026-10-09",
      author: "Dr. Imran Qureshi, Neurology",
      summary: "Documents the abnormal neurological exam and the failed conservative management that justify MRI brain.",
      required: true,
      sections: [
        {
          heading: "HPI",
          body:
            "38-year-old male with 3 months of daily bifrontal headache, worse in the morning and with Valsalva. Two episodes of transient right-sided visual blurring lasting under a minute. No fever, no head trauma, no cancer history, no anticoagulation. Headaches have not responded to two preventive trials.",
        },
        {
          heading: "Prior management",
          body:
            "Amitriptyline 25 mg nightly for 8 weeks — no reduction in headache days (22/month before, 20/month after). Propranolol 40 mg twice daily for 6 weeks — discontinued for fatigue and postural lightheadedness. Analgesic overuse addressed; ibuprofen limited to 2 days/week.",
        },
        {
          heading: "Neurological exam",
          rows: [
            { label: "Visual acuity / fields", value: "20/20 both eyes; mild right inferior quadrant defect on confrontation" },
            { label: "Fundoscopy", value: "No papilloedema" },
            { label: "Cranial nerves", value: "Right pronator drift; otherwise intact" },
            { label: "Motor", value: "5/5 throughout except mild right pronator drift" },
            { label: "Reflexes", value: "Brisk right biceps, otherwise 2+" },
            { label: "Gait / coordination", value: "Normal, no ataxia" },
            { label: "Red flags", value: "Morning-predominant headache, focal deficit, Valsalva worsening" },
          ],
        },
        {
          heading: "Assessment",
          body:
            "Chronic daily headache (G44.2) with a new focal neurological deficit and red-flag features. Differential includes intracranial mass, pituitary lesion, venous sinus thrombosis and demyelinating disease. Plain films are unhelpful for intracranial pathology; cross-sectional imaging is required.",
        },
        {
          heading: "Plan",
          body:
            "Request MRI brain without and with contrast (70553) to evaluate for mass, enhancement pattern and pituitary region. If a mass or enhancement is found, neurosurgery referral. No prior MRI brain in the last 12 months.",
        },
      ],
    },
    {
      id: "rad-img-1",
      name: "CT Head Without Contrast (Prior Study) — Radiology Report",
      kind: "imaging",
      date: "2026-09-02",
      author: "Dr. S. Iqbal, Radiology",
      summary: "The plain-film / CT step already done and non-diagnostic — the payer's 'why not something cheaper first' answer.",
      required: true,
      sections: [
        {
          heading: "Technique",
          body: "Non-contrast CT of the head, axial 5 mm reconstructions with coronal and sagittal reformats.",
        },
        {
          heading: "Findings",
          body:
            "No acute intracranial haemorrhage. Grey-white differentiation preserved. No large territorial infarct. Ventricles normal in size and position. No midline shift. No hydrocephalus. Sella is partially visualised and appears unremarkable on this study. No calvarial fracture. Paranasal sinuses clear.",
        },
        {
          heading: "Impression",
          body:
            "1. No acute intracranial abnormality on non-contrast CT. 2. CT is insensitive to small masses, pituitary microadenoma and demyelination — a normal study does not exclude these. 3. If symptoms persist with focal deficit, contrast-enhanced MRI is recommended.",
        },
      ],
    },
    {
      id: "rad-lab-1",
      name: "Lab Report — CBC, ESR, Prolactin, TSH",
      kind: "lab",
      date: "2026-10-07",
      author: "Meridian Reference Laboratory",
      summary: "Screens for an inflammatory or endocrine cause before committing to contrast MRI.",
      required: true,
      sections: [
        {
          heading: "Specimen: venous blood",
          rows: [
            { label: "White blood cells", value: "6.9 ×10³/µL (ref 4.0–11.0)", flag: "N" },
            { label: "Hemoglobin", value: "15.1 g/dL (ref 13.5–17.5)", flag: "N" },
            { label: "Platelets", value: "232 ×10³/µL (ref 150–450)", flag: "N" },
            { label: "ESR", value: "34 mm/hr (ref 0–15)", flag: "H" },
            { label: "C-reactive protein", value: "4.2 mg/L (ref <5.0)", flag: "N" },
            { label: "Prolactin", value: "38 ng/mL (ref 4.0–15.2)", flag: "H" },
            { label: "TSH", value: "1.8 mIU/L (ref 0.4–4.0)", flag: "N" },
            { label: "Creatinine", value: "0.94 mg/dL (ref 0.7–1.3)", flag: "N" },
            { label: "eGFR", value: "96 mL/min/1.73 m² (ref >90)", flag: "N" },
          ],
        },
        {
          heading: "Interpretation",
          body:
            "Mildly raised ESR without leukocytosis. Prolactin is modestly elevated, which may reflect stalk effect, a prolactin-secreting lesion, or medication effect — the differential is only resolvable with pituitary-protocol MRI. Renal function is normal, so gadolinium contrast is safe.",
        },
      ],
    },
    {
      id: "rad-form-1",
      name: "Payer Advanced Imaging Authorization Form — MRI Brain with Contrast",
      kind: "form",
      date: "2026-10-09",
      author: "Dr. Imran Qureshi (submitted via Cedar Valley Health portal)",
      summary: "Payer form answering the three questions advanced-imaging denials usually turn on: prior care, duplicate imaging, contrast justification.",
      required: true,
      sections: [
        {
          heading: "Member and order",
          rows: [
            { label: "Member ID", value: "CVH-8892214" },
            { label: "Plan", value: "Cedar Valley Health — commercial PPO, radiology benefit manager review" },
            { label: "Requested service", value: "MRI brain without and with contrast (70553)" },
            { label: "Diagnosis codes", value: "G44.2, R29.810 (focal neurological deficit), E22.1 (hyperprolactinaemia)" },
            { label: "Requested date of service", value: "2026-10-20" },
            { label: "Urgency", value: "Expedited — focal deficit on exam" },
          ],
        },
        {
          heading: "Criteria questions",
          rows: [
            { label: "Prior conservative therapy", value: "Amitriptyline 8 weeks; propranolol 6 weeks — both failed" },
            { label: "Prior imaging", value: "CT head non-contrast 2026-09-02 — normal, non-diagnostic" },
            { label: "Duplicate imaging within 90 days", value: "No prior MRI brain in the last 12 months" },
            { label: "Reason contrast is required", value: "Pituitary/sellar evaluation and detection of enhancing lesions; raised prolactin" },
            { label: "Renal function within 30 days", value: "eGFR 96 — contrast safe" },
            { label: "Gadolinium allergy / prior reaction", value: "None" },
            { label: "Pregnancy status", value: "Not applicable" },
          ],
        },
        {
          heading: "Signature",
          body: "Dr. Imran Qureshi, MD — Neurology. Signed 2026-10-09. Attachments: neurology note, CT head report, lab report.",
        },
      ],
    },
    {
      id: "rad-letter-1",
      name: "Medical Necessity Letter — Contrast-Enhanced MRI Brain",
      kind: "letter",
      date: "2026-10-09",
      author: "Dr. Imran Qureshi, Neurology",
      summary: "Supporting letter for peer-to-peer review; explains why a non-contrast study or repeat CT would not answer the question.",
      required: false,
      sections: [
        {
          heading: "Re: Prior authorization — MRI brain without and with contrast",
          body:
            "This patient has a three-month daily headache with a focal right-sided deficit, morning predominance and Valsalva worsening, plus a raised prolactin at 38 ng/mL. A non-contrast CT on 2026-09-02 was normal, but CT cannot resolve the pituitary or detect small enhancing lesions. Non-contrast MRI would miss enhancement, which is the specific finding that would change management (microadenoma, metastasis, demyelinating plaque). A repeat CT would add nothing. Without this study, the differential — pituitary lesion, low-grade glioma, demyelination — cannot be narrowed, and the patient remains on symptomatic treatment that has already failed twice.",
        },
        {
          heading: "Signature",
          body: "Dr. Imran Qureshi, MD — Neurology, Cedar Ridge Medical Group. 2026-10-09.",
        },
      ],
    },
  ],

  // ── NEW: Behavioral health (TMS for treatment-resistant depression) ──
  "behavioral-health": [
    {
      id: "bh-note-1",
      name: "Psychiatric Evaluation Note — Treatment-Resistant Major Depression",
      kind: "note",
      date: "2026-10-16",
      author: "Dr. Nadia Farooq, Psychiatry",
      summary: "Diagnostic interview with PHQ-9 / GAD-7 scores, suicide-risk screen and the two failed antidepressant trials.",
      required: true,
      sections: [
        {
          heading: "Presenting problem",
          body:
            "44-year-old female with recurrent major depressive disorder since age 29, current episode 14 months. Persistent low mood, anhedonia, early-morning waking, poor concentration, guilt, hopelessness. Unable to work for 5 months. No manic or hypomanic episode ever; no psychotic features. No substance use beyond occasional alcohol (<2 units/week). No current suicidal ideation, plan or intent; no prior attempt.",
        },
        {
          heading: "Measurement-based scores",
          rows: [
            { label: "PHQ-9 2026-04-21", value: "19 (moderately severe)" },
            { label: "PHQ-9 2026-07-15", value: "21 (severe)" },
            { label: "PHQ-9 2026-10-16", value: "22 (severe)", flag: "H" },
            { label: "GAD-7 2026-10-16", value: "14 (moderate)", flag: "H" },
            { label: "Columbia Suicide Severity Rating", value: "No ideation in the past month" },
            { label: "Sheehan Disability Scale", value: "18/30 — marked impairment" },
          ],
        },
        {
          heading: "Prior pharmacotherapy",
          body:
            "Sertraline titrated to 100 mg daily for 10 weeks (2025-11 to 2026-02) — PHQ-9 fell from 20 to 17, discontinued for lack of response. Escitalopram titrated to 20 mg daily for 12 weeks (2026-03 to 2026-06) — PHQ-9 21 at week 12, no response. Bupropion XL 300 mg added for 8 weeks (2026-06 to 2026-08) — no change, discontinued for insomnia. All trials at adequate dose for at least 6 weeks with documented adherence and serum levels where applicable. Venlafaxine considered but patient declined for blood-pressure concern.",
        },
        {
          heading: "Psychotherapy",
          body:
            "Cognitive behavioural therapy, 22 sessions over 14 months (2026-01 to 2026-10), with documented adherence and homework completion. No meaningful improvement in PHQ-9 across the course.",
        },
        {
          heading: "Assessment",
          body:
            "Recurrent major depressive disorder, severe, without psychotic features (F33.2), treatment-resistant — failure of two adequate antidepressant trials plus augmentation and an adequate psychotherapy course. No bipolar disorder, no psychosis, no substance-induced mood disorder. Candidate for repetitive transcranial magnetic stimulation (TMS).",
        },
        {
          heading: "Plan",
          body:
            "Request prior authorization for a standard TMS course: 5 sessions per week for 6 weeks (36 sessions), with measurement-based PHQ-9 review every 2 weeks and a repeat PHQ-9 at the end of the acute course. Continue current antidepressant without change during the course. Safety plan reviewed; crisis resources given.",
        },
      ],
    },
    {
      id: "bh-form-1",
      name: "Measurement-Based Scoring Record — PHQ-9 and GAD-7 Trend",
      kind: "form",
      date: "2026-10-16",
      author: "Cedar Ridge Behavioral Health — clinical registry extract",
      summary: "The scores over time that prove treatment resistance objectively — payers reject TMS without them.",
      required: true,
      sections: [
        {
          heading: "PHQ-9 trend (0–27; ≥20 severe)",
          rows: [
            { label: "2026-01-12 (baseline)", value: "18 — moderately severe", flag: "H" },
            { label: "2026-04-21", value: "19 — moderately severe", flag: "H" },
            { label: "2026-07-15", value: "21 — severe", flag: "H" },
            { label: "2026-10-16", value: "22 — severe", flag: "H" },
            { label: "Change from baseline", value: "+4 points — worsening, no response to any trial" },
          ],
        },
        {
          heading: "GAD-7 trend (0–21)",
          rows: [
            { label: "2026-01-12", value: "12 — moderate", flag: "H" },
            { label: "2026-07-15", value: "13 — moderate", flag: "H" },
            { label: "2026-10-16", value: "14 — moderate", flag: "H" },
          ],
        },
        {
          heading: "Antidepressant trial log",
          rows: [
            { label: "Trial 1 — sertraline", value: "100 mg daily, 10 weeks, adherence confirmed, no response" },
            { label: "Trial 2 — escitalopram", value: "20 mg daily, 12 weeks, adherence confirmed, no response" },
            { label: "Augmentation — bupropion XL", value: "300 mg daily added 8 weeks, no response, stopped for insomnia" },
            { label: "Psychotherapy", value: "CBT 22 sessions over 14 months, no response" },
          ],
        },
        {
          heading: "Attestation",
          body:
            "Scores recorded by a licensed clinician at each visit using the standard instruments. Registry extract certified by Dr. Nadia Farooq, Psychiatry, on 2026-10-16.",
        },
      ],
    },
    {
      id: "bh-lab-1",
      name: "Lab Report — Medical Rule-Out Panel Before TMS",
      kind: "lab",
      date: "2026-10-13",
      author: "Meridian Reference Laboratory",
      summary: "Confirms the depression is not driven by thyroid disease, anaemia, B12 deficiency or an substance.",
      required: true,
      sections: [
        {
          heading: "Specimen: venous blood and urine",
          rows: [
            { label: "TSH", value: "2.4 mIU/L (ref 0.4–4.0)", flag: "N" },
            { label: "Free T4", value: "1.1 ng/dL (ref 0.8–1.8)", flag: "N" },
            { label: "Hemoglobin", value: "12.6 g/dL (ref 12.0–15.5)", flag: "N" },
            { label: "Vitamin B12", value: "312 pg/mL (ref 200–900)", flag: "N" },
            { label: "Folate", value: "11.8 ng/mL (ref >5.4)", flag: "N" },
            { label: "Vitamin D, 25-OH", value: "21 ng/mL (ref 30–100)", flag: "L" },
            { label: "Creatinine", value: "0.71 mg/dL (ref 0.7–1.3)", flag: "N" },
            { label: "ALT", value: "19 U/L (ref 7–56)", flag: "N" },
            { label: "Urine drug screen", value: "Negative for amphetamines, benzodiazepines, cannabinoids, cocaine, opioids", flag: "N" },
            { label: "Urine hCG", value: "Negative", flag: "N" },
          ],
        },
        {
          heading: "Interpretation",
          body:
            "Euthyroid, no anaemia, normal B12 and folate, negative urine drug screen — a substance- or medically-induced mood disorder is excluded. Vitamin D mildly low; supplement started. No laboratory contraindication to TMS (no implanted device or seizure history documented clinically).",
        },
      ],
    },
    {
      id: "bh-form-2",
      name: "Payer TMS Authorization Form — Medical Necessity and Safety Checklist",
      kind: "form",
      date: "2026-10-16",
      author: "Dr. Nadia Farooq (submitted via Northbridge Health portal)",
      summary: "The payer's TMS-specific form: diagnosis, failed trials, scores, and the seizure/device safety screen.",
      required: true,
      sections: [
        {
          heading: "Member and order",
          rows: [
            { label: "Member ID", value: "NBH-4417620" },
            { label: "Plan", value: "Northbridge Health — commercial PPO, behavioral health carve-out" },
            { label: "Requested service", value: "Repetitive TMS, major depressive disorder — 36 sessions over 6 weeks (90867, 90868, 90869)" },
            { label: "Diagnosis codes", value: "F33.2" },
            { label: "Requested start date", value: "2026-11-02" },
            { label: "Setting", value: "Outpatient behavioral health clinic, psychiatrist-supervised" },
          ],
        },
        {
          heading: "Criteria section",
          rows: [
            { label: "Diagnosis confirmed by psychiatric evaluation", value: "Yes — 2026-10-16, DSM-5 criteria met" },
            { label: "Adequate antidepressant trials", value: "2 trials ≥6 weeks at therapeutic dose (10 and 12 weeks) plus augmentation" },
            { label: "Measurement-based scores on file", value: "PHQ-9 22, GAD-7 14, trend over 9 months" },
            { label: "Psychotherapy trialled", value: "CBT 22 sessions, 14 months" },
            { label: "Bipolar disorder excluded", value: "Yes — no manic/hypomanic history" },
            { label: "Psychosis excluded", value: "Yes" },
            { label: "Substance-induced excluded", value: "Yes — UDS negative" },
            { label: "Seizure history / epilepsy", value: "None" },
            { label: "Implanted device (pacemaker, cochlear, DBS, aneurysm clip)", value: "None" },
            { label: "Pregnancy", value: "Negative urine hCG 2026-10-13" },
          ],
        },
        {
          heading: "Signature",
          body: "Dr. Nadia Farooq, MD — Psychiatry. Signed 2026-10-16. Attachments: psychiatric evaluation, scoring record, lab report, medical necessity letter.",
        },
      ],
    },
    {
      id: "bh-letter-1",
      name: "Medical Necessity Letter — TMS for Treatment-Resistant Depression",
      kind: "letter",
      date: "2026-10-16",
      author: "Dr. Nadia Farooq, Psychiatry",
      summary: "The letter whose absence is the most common TMS denial — states the treatment resistance case in the payer's language.",
      required: true,
      sections: [
        {
          heading: "Re: Prior authorization — repetitive transcranial magnetic stimulation",
          body:
            "This patient has severe recurrent major depressive disorder that has not responded to two adequate antidepressant trials (sertraline 100 mg for 10 weeks and escitalopram 20 mg for 12 weeks), a bupropion augmentation trial of 8 weeks, and 22 sessions of cognitive behavioural therapy over 14 months. Her PHQ-9 has risen from 18 to 22 across nine months of treatment and her Sheehan Disability Score is 18/30, with five months out of work. She has no psychotic features, no bipolar history, no substance use and no seizure or implanted-device contraindication. TMS is indicated for exactly this presentation: a documented failure of at least two adequate trials in a non-psychotic unipolar depression. Continuing to cycle oral antidepressants at this point has a low probability of response and carries ongoing functional loss. Requesting a standard 36-session acute course with measurement-based review at two weeks and at completion.",
        },
        {
          heading: "Monitoring plan",
          body:
            "PHQ-9 every 2 weeks during the acute course; repeat PHQ-9 and clinical review at session 20 to decide continuation; maintenance planning at completion. Concurrent antidepressant continued unchanged so response can be attributed.",
        },
        {
          heading: "Signature",
          body: "Dr. Nadia Farooq, MD — Psychiatry, Cedar Ridge Behavioral Health. 2026-10-16.",
        },
      ],
    },
  ],
};
