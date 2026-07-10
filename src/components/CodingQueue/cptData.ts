/**
 * CPT Code Repository — Medical Coding Educational Content
 *
 * 30+ common procedure codes organized by category with descriptions,
 * RVU, Medicare rates, and coding tips.
 *
 * Inspiration: AMA CPT Professional Edition / AAPC
 */

export interface CPTCode {
  code: string;
  description: string;
  category: string;
  rvu: number;
  medicareRate?: number;      // approximate national Medicare payment
  commercialRate?: number;    // approximate commercial rate
  notes?: string;             // coding tips / guidelines
  globalDays?: number;        // global surgery period
  crosswalk?: string[];       // related/similar codes
}

export const CPT_CODES: CPTCode[] = [
  // ─── E/M New Patient ────────────────────────────────────────────
  {
    code: "99202",
    description: "Office/outpatient visit new, low MDM",
    category: "E/M New",
    rvu: 1.87,
    medicareRate: 78.00,
    commercialRate: 145.00,
    notes: "Straightforward MDM. 15-29 min typical time.",
    globalDays: 0,
  },
  {
    code: "99203",
    description: "Office/outpatient visit new, moderate MDM",
    category: "E/M New",
    rvu: 2.67,
    medicareRate: 112.00,
    commercialRate: 195.00,
    notes: "Low MDM. 30-44 min typical time. Most common new patient code.",
    globalDays: 0,
  },
  {
    code: "99204",
    description: "Office/outpatient visit new, high MDM",
    category: "E/M New",
    rvu: 3.77,
    medicareRate: 158.00,
    commercialRate: 275.00,
    notes: "Moderate MDM. 45-59 min typical time.",
    globalDays: 0,
  },
  {
    code: "99205",
    description: "Office/outpatient visit new, high MDM (comprehensive)",
    category: "E/M New",
    rvu: 4.92,
    medicareRate: 205.00,
    commercialRate: 345.00,
    notes: "High MDM. 60-74 min typical time. Comprehensive history and exam.",
    globalDays: 0,
  },

  // ─── E/M Established Patient ────────────────────────────────────
  {
    code: "99212",
    description: "Office/outpatient visit established, low MDM",
    category: "E/M Est",
    rvu: 1.18,
    medicareRate: 52.00,
    commercialRate: 95.00,
    notes: "Straightforward. 10-19 min typical time. Problem-focused.",
    globalDays: 0,
  },
  {
    code: "99213",
    description: "Office/outpatient visit established, moderate MDM",
    category: "E/M Est",
    rvu: 2.08,
    medicareRate: 88.00,
    commercialRate: 155.00,
    notes: "Low MDM. 20-29 min typical time. Most common established code — 60% of all E/M.",
    globalDays: 0,
  },
  {
    code: "99214",
    description: "Office/outpatient visit established, high MDM",
    category: "E/M Est",
    rvu: 3.18,
    medicareRate: 132.00,
    commercialRate: 225.00,
    notes: "Moderate MDM. 30-39 min typical time. Chronic disease management.",
    globalDays: 0,
  },
  {
    code: "99215",
    description: "Office/outpatient visit established, high MDM (comprehensive)",
    category: "E/M Est",
    rvu: 4.63,
    medicareRate: 195.00,
    commercialRate: 320.00,
    notes: "High MDM. 40-54 min typical time. Multiple complex chronic conditions.",
    globalDays: 0,
  },

  // ─── Preventive Medicine ────────────────────────────────────────
  {
    code: "99385",
    description: "Initial preventive medicine, 40-64 years",
    category: "Preventive",
    rvu: 3.45,
    medicareRate: 155.00,
    commercialRate: 265.00,
    notes: "Annual wellness visit. Includes comprehensive history, exam, counseling.",
    globalDays: 0,
  },
  {
    code: "99396",
    description: "Periodic preventive medicine, 40-64 years",
    category: "Preventive",
    rvu: 2.85,
    medicareRate: 128.00,
    commercialRate: 218.00,
    notes: "Annual physical. Established patient. Can add preventive counseling.",
    globalDays: 0,
  },

  // ─── Medicine / Cardiology ──────────────────────────────────────
  {
    code: "93000",
    description: "Electrocardiogram, routine ECG with interpretation and report",
    category: "Medicine",
    rvu: 0.59,
    medicareRate: 28.00,
    commercialRate: 55.00,
    notes: "12-lead ECG. Includes tracing, interpretation, and report.",
    globalDays: 0,
  },
  {
    code: "93015",
    description: "Cardiovascular stress test with supervision",
    category: "Medicine",
    rvu: 2.15,
    medicareRate: 95.00,
    commercialRate: 185.00,
    notes: "Treadmill stress test. Supervision, tracing, interpretation included.",
    globalDays: 0,
  },
  {
    code: "93306",
    description: "Echocardiography, transthoracic, complete with spectral Doppler",
    category: "Medicine",
    rvu: 3.28,
    medicareRate: 145.00,
    commercialRate: 265.00,
    notes: "Complete TTE with Doppler. 2D, M-mode, color flow mapping.",
    globalDays: 0,
  },
  {
    code: "94640",
    description: "Pressurized or nonpressurized inhalation treatment for acute airway obstruction",
    category: "Medicine",
    rvu: 0.78,
    medicareRate: 35.00,
    commercialRate: 68.00,
    notes: "Nebulizer treatment. Albuterol or similar bronchodilator.",
    globalDays: 0,
  },

  // ─── Surgery / Orthopedic ────────────────────────────────────────
  {
    code: "27130",
    description: "Total hip arthroplasty (hip replacement)",
    category: "Surgery",
    rvu: 20.34,
    medicareRate: 1050.00,
    commercialRate: 2200.00,
    notes: "Total hip replacement. Global 90 days. Major orthopedic procedure.",
    globalDays: 90,
  },
  {
    code: "27447",
    description: "Total knee arthroplasty (knee replacement)",
    category: "Surgery",
    rvu: 21.85,
    medicareRate: 1180.00,
    commercialRate: 2450.00,
    notes: "Total knee replacement. Global 90 days. Most common joint replacement.",
    globalDays: 90,
  },
  {
    code: "47562",
    description: "Laparoscopic cholecystectomy",
    category: "Surgery",
    rvu: 14.22,
    medicareRate: 725.00,
    commercialRate: 1550.00,
    notes: "Lap cholecystectomy. Global 90 days. Gold standard for gallstones.",
    globalDays: 90,
  },
  {
    code: "47563",
    description: "Lap cholecystectomy with cholangiography",
    category: "Surgery",
    rvu: 16.08,
    medicareRate: 820.00,
    commercialRate: 1720.00,
    notes: "Includes intraoperative cholangiogram to visualize bile ducts.",
    globalDays: 90,
  },
  {
    code: "44140",
    description: "Colectomy, partial; with anastomosis",
    category: "Surgery",
    rvu: 26.75,
    medicareRate: 1420.00,
    commercialRate: 2980.00,
    notes: "Partial colectomy with primary anastomosis. Global 90 days.",
    globalDays: 90,
  },
  {
    code: "43239",
    description: "Upper GI endoscopy with biopsy",
    category: "Surgery",
    rvu: 4.81,
    medicareRate: 245.00,
    commercialRate: 495.00,
    notes: "EGD with biopsy. Includes esophagus, stomach, duodenum evaluation.",
    globalDays: 10,
  },
  {
    code: "45380",
    description: "Colonoscopy with biopsy",
    category: "Surgery",
    rvu: 6.12,
    medicareRate: 315.00,
    commercialRate: 625.00,
    notes: "Screening or diagnostic colonoscopy with biopsy. Global 10 days.",
    globalDays: 10,
  },

  // ─── Radiology ──────────────────────────────────────────────────
  {
    code: "71045",
    description: "Chest X-ray, single view",
    category: "Radiology",
    rvu: 0.37,
    medicareRate: 18.00,
    commercialRate: 38.00,
    notes: "AP or PA view only. Most basic CXR.",
    globalDays: 0,
  },
  {
    code: "71046",
    description: "Chest X-ray, 2 views",
    category: "Radiology",
    rvu: 0.55,
    medicareRate: 28.00,
    commercialRate: 55.00,
    notes: "PA and lateral views. Standard CXR.",
    globalDays: 0,
  },
  {
    code: "74177",
    description: "CT abdomen and pelvis with contrast",
    category: "Radiology",
    rvu: 3.45,
    medicareRate: 185.00,
    commercialRate: 385.00,
    notes: "CT A/P with IV contrast. Common for abdominal pain workup.",
    globalDays: 0,
  },
  {
    code: "70551",
    description: "MRI brain without contrast",
    category: "Radiology",
    rvu: 4.28,
    medicareRate: 225.00,
    commercialRate: 465.00,
    notes: "Non-contrast brain MRI. For headache, stroke, MS evaluation.",
    globalDays: 0,
  },
  {
    code: "72125",
    description: "CT cervical spine without contrast",
    category: "Radiology",
    rvu: 2.97,
    medicareRate: 155.00,
    commercialRate: 325.00,
    notes: "Non-contrast CT C-spine. Trauma or degenerative evaluation.",
    globalDays: 0,
  },
  {
    code: "77067",
    description: "Screening mammography, bilateral",
    category: "Radiology",
    rvu: 2.15,
    medicareRate: 112.00,
    commercialRate: 225.00,
    notes: "Bilateral screening mammogram. Annual for women 40+. 2D or 3D.",
    globalDays: 0,
  },

  // ─── Pathology / Lab ────────────────────────────────────────────
  {
    code: "80053",
    description: "Comprehensive metabolic panel (CMP)",
    category: "Path/Lab",
    rvu: 0.38,
    medicareRate: 18.00,
    commercialRate: 35.00,
    notes: "14 tests: glucose, BUN, creatinine, electrolytes, liver function, calcium, protein.",
    globalDays: 0,
  },
  {
    code: "85025",
    description: "Complete blood count (CBC) with differential",
    category: "Path/Lab",
    rvu: 0.40,
    medicareRate: 18.00,
    commercialRate: 38.00,
    notes: "CBC with automated differential WBC count.",
    globalDays: 0,
  },
  {
    code: "81001",
    description: "Urinalysis with microscopy",
    category: "Path/Lab",
    rvu: 0.27,
    medicareRate: 12.00,
    commercialRate: 28.00,
    notes: "UA with microscopic examination if dipstick abnormal.",
    globalDays: 0,
  },
  {
    code: "80048",
    description: "Basic metabolic panel (BMP)",
    category: "Path/Lab",
    rvu: 0.31,
    medicareRate: 15.00,
    commercialRate: 30.00,
    notes: "8 tests: glucose, BUN, creatinine, Na, K, Cl, CO2, Ca.",
    globalDays: 0,
  },
  {
    code: "80061",
    description: "Lipid panel (total cholesterol, HDL, LDL, triglycerides)",
    category: "Path/Lab",
    rvu: 0.35,
    medicareRate: 16.00,
    commercialRate: 32.00,
    notes: "Fasting lipid profile. Monitor for hyperlipidemia management.",
    globalDays: 0,
  },

  // ─── Emergency / Critical Care ──────────────────────────────────
  {
    code: "99283",
    description: "Emergency department visit, moderate severity",
    category: "Emergency",
    rvu: 4.05,
    medicareRate: 175.00,
    commercialRate: 325.00,
    notes: "Level 3 ED visit. Moderate complexity. Urgent evaluation.",
    globalDays: 0,
  },
  {
    code: "99284",
    description: "Emergency department visit, high severity",
    category: "Emergency",
    rvu: 5.22,
    medicareRate: 225.00,
    commercialRate: 425.00,
    notes: "Level 4 ED visit. High severity, life-threatening condition possible.",
    globalDays: 0,
  },
  {
    code: "99285",
    description: "Emergency department visit, high severity with threat to life",
    category: "Emergency",
    rvu: 6.88,
    medicareRate: 295.00,
    commercialRate: 550.00,
    notes: "Level 5 ED visit. Highest complexity. Immediate threat to life or function.",
    globalDays: 0,
  },
];

export function searchCPT(query: string): CPTCode[] {
  if (!query || query.length < 1) return CPT_CODES.slice(0, 10);
  const q = query.toLowerCase();
  return CPT_CODES.filter(
    (c) =>
      c.code.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
  );
}
