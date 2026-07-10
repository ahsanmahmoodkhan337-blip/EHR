/**
 * Global Mock Patient Database — React Context Provider
 *
 * Inspiration: This store is designed to simulate the patient chart
 * experience found across Epic, eClinicalWorks (eCW), Athenahealth,
 * and DrChrono. The data model combines:
 *   - Epic's comprehensive chart review structure (problems, meds, allergies, vitals, labs)
 *   - eCW's right-panel summary layout (concise patient snapshot)
 *   - Athenahealth's workflow-oriented encounter tracking
 *   - DrChrono's appointment-based chronology
 */

import { createContext, useContext, useState, type ReactNode } from "react";

// ─── Audit Log ────────────────────────────────────────────────────

export interface AuditEntry {
  timestamp: string;
  role: string;
  message: string;
  status: "success" | "warning" | "error" | "info";
}

export type QueueStage =
  | "QUEUE_REGISTRATION"
  | "QUEUE_ELIGIBILITY"
  | "QUEUE_SCRIBE"
  | "QUEUE_CODER"
  | "QUEUE_BILLER"
  | "QUEUE_PA"
  | "QUEUE_AR"
  | "QUEUE_PAID";

export interface CaseState {
  patientId: string;
  currentQueue: QueueStage;
  auditLogs: AuditEntry[];
  modifier25Applied: boolean;
  // Phase 3: inter-departmental hand-off
  billingStatus: "DRAFT" | "SCRUB_FAILED" | "PENDING_PA_ROUTE" | "READY_TO_SUBMIT" | "CLEARED_AND_SENT";
  paStatus: "NOT_REQUIRED" | "REQUIRED_MISSING" | "PENDING_REVIEW" | "APPROVED";
  arStatus: "NONE" | "DENIED_QUEUE" | "APPEAL_PENDING" | "RESOLVED";
  routingNotes: RoutingNote[];
  // PA follow-up tracking
  followups: FollowUpEntry[];
}

export interface FollowUpEntry {
  date: string;
  trackingNumber: string;
  repName: string;
  notes: string;
}

export interface RoutingNote {
  timestamp: string;
  fromRole: string;
  toRole: string;
  noteText: string;
}

// ─── Types ────────────────────────────────────────────────────────

export interface VitalSigns {
  bloodPressure: string; // e.g. "120/80"
  heartRate: number; // bpm
  temperature: number; // °F
  respiratoryRate: number; // breaths/min
  oxygenSaturation: number; // %
  recordedAt: string; // ISO date
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  route: string;
  status: "active" | "discontinued" | "on-hold";
  prescribedDate: string;
  prescribedBy: string;
}

export interface Allergy {
  id: string;
  allergen: string;
  severity: "mild" | "moderate" | "severe";
  reaction: string;
  recordedDate: string;
}

export interface LabResult {
  id: string;
  testName: string;
  value: string;
  referenceRange: string;
  unit: string;
  status: "normal" | "abnormal" | "critical" | "pending";
  date: string;
}

export interface Encounter {
  id: string;
  date: string;
  type: string;
  provider: string;
  diagnosis: string;
  notes: string;
  department: string;
}

export interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  age: number;
  gender: string;
  preferredName?: string;
  phone: string;
  email: string;
  address: string;
  emergencyContact: { name: string; phone: string; relation: string };
  primaryCareProvider: string;
  insurance: string;
  chiefComplaint: string;
  vitals: VitalSigns;
  medications: Medication[];
  allergies: Allergy[];
  labResults: LabResult[];
  encounters: Encounter[];
  problems: string[]; // active problem list
}

// ─── Mock Data ─────────────────────────────────────────────────────

const mockPatients: Patient[] = [
  {
    id: "P001",
    mrn: "MRN-1001",
    firstName: "Jane",
    lastName: "Doe",
    dateOfBirth: "1979-03-15",
    age: 45,
    gender: "Female",
    preferredName: "Jane",
    phone: "(555) 123-4567",
    email: "jane.doe@email.com",
    address: "123 Main St, Springfield, IL 62701",
    emergencyContact: {
      name: "John Doe",
      phone: "(555) 987-6543",
      relation: "Spouse",
    },
    primaryCareProvider: "Dr. Sarah Chen, MD",
    insurance: "Blue Cross Blue Shield PPO",
    chiefComplaint: "Chest pain and shortness of breath",
    vitals: {
      bloodPressure: "142/92",
      heartRate: 88,
      temperature: 98.6,
      respiratoryRate: 20,
      oxygenSaturation: 96,
      recordedAt: "2026-06-15T09:30:00Z",
    },
    medications: [
      {
        id: "MED001",
        name: "Lisinopril",
        dosage: "10 mg",
        frequency: "Once daily",
        route: "Oral",
        status: "active",
        prescribedDate: "2025-11-01",
        prescribedBy: "Dr. Sarah Chen",
      },
      {
        id: "MED002",
        name: "Metformin",
        dosage: "500 mg",
        frequency: "Twice daily",
        route: "Oral",
        status: "active",
        prescribedDate: "2026-01-15",
        prescribedBy: "Dr. Sarah Chen",
      },
      {
        id: "MED003",
        name: "Atorvastatin",
        dosage: "20 mg",
        frequency: "Once daily at bedtime",
        route: "Oral",
        status: "active",
        prescribedDate: "2025-06-10",
        prescribedBy: "Dr. Sarah Chen",
      },
    ],
    allergies: [
      {
        id: "ALG001",
        allergen: "Penicillin",
        severity: "severe",
        reaction: "Anaphylaxis (hives, swelling, difficulty breathing)",
        recordedDate: "2020-03-22",
      },
      {
        id: "ALG002",
        allergen: "Sulfa Drugs",
        severity: "moderate",
        reaction: "Rash and fever",
        recordedDate: "2021-07-14",
      },
    ],
    labResults: [
      {
        id: "LAB001",
        testName: "Hemoglobin A1C",
        value: "7.2",
        referenceRange: "< 5.7",
        unit: "%",
        status: "abnormal",
        date: "2026-06-01",
      },
      {
        id: "LAB002",
        testName: "LDL Cholesterol",
        value: "130",
        referenceRange: "< 100",
        unit: "mg/dL",
        status: "abnormal",
        date: "2026-06-01",
      },
      {
        id: "LAB003",
        testName: "Comprehensive Metabolic Panel",
        value: "WNR",
        referenceRange: "See components",
        unit: "",
        status: "normal",
        date: "2026-06-01",
      },
      {
        id: "LAB004",
        testName: "Complete Blood Count",
        value: "Within normal limits",
        referenceRange: "",
        unit: "",
        status: "normal",
        date: "2026-05-15",
      },
    ],
    encounters: [
      {
        id: "ENC001",
        date: "2026-06-15",
        type: "Office Visit - Follow Up",
        provider: "Dr. Sarah Chen, MD",
        diagnosis: "Essential hypertension (I10), Type 2 diabetes (E11.9)",
        notes:
          "Patient reports intermittent chest pain over the past week. BP elevated today. Will adjust lisinopril dosage and order cardiac workup.",
        department: "Internal Medicine",
      },
      {
        id: "ENC002",
        date: "2026-04-22",
        type: "Office Visit - Routine",
        provider: "Dr. Sarah Chen, MD",
        diagnosis: "Essential hypertension (I10)",
        notes:
          "Routine follow-up for hypertension. BP well-controlled on current regimen. Encouraged dietary modifications and increased physical activity.",
        department: "Internal Medicine",
      },
      {
        id: "ENC003",
        date: "2026-01-15",
        type: "Office Visit - New Patient",
        provider: "Dr. Sarah Chen, MD",
        diagnosis:
          "Essential hypertension (I10), Type 2 diabetes (E11.9), Mixed hyperlipidemia (E78.2)",
        notes:
          "New patient establishing care. Comprehensive history and physical completed. Started on lisinopril, metformin, and atorvastatin. Lab orders placed.",
        department: "Internal Medicine",
      },
    ],
    problems: [
      "Essential hypertension (I10)",
      "Type 2 diabetes mellitus (E11.9)",
      "Mixed hyperlipidemia (E78.2)",
      "Obesity (E66.9)",
    ],
  },
  {
    id: "P002",
    mrn: "MRN-1002",
    firstName: "John",
    lastName: "Smith",
    dateOfBirth: "1968-09-22",
    age: 58,
    gender: "Male",
    phone: "(555) 234-5678",
    email: "john.smith@email.com",
    address: "456 Oak Ave, Springfield, IL 62702",
    emergencyContact: {
      name: "Mary Smith",
      phone: "(555) 876-5432",
      relation: "Spouse",
    },
    primaryCareProvider: "Dr. Michael Patel, MD",
    insurance: "Medicare Part B",
    chiefComplaint: "Shortness of breath on exertion",
    vitals: {
      bloodPressure: "138/85",
      heartRate: 76,
      temperature: 98.4,
      respiratoryRate: 18,
      oxygenSaturation: 94,
      recordedAt: "2026-06-14T14:00:00Z",
    },
    medications: [
      {
        id: "MED004",
        name: "Aspirin",
        dosage: "81 mg",
        frequency: "Once daily",
        route: "Oral",
        status: "active",
        prescribedDate: "2024-03-01",
        prescribedBy: "Dr. Michael Patel",
      },
      {
        id: "MED005",
        name: "Metoprolol Succinate",
        dosage: "50 mg",
        frequency: "Once daily",
        route: "Oral",
        status: "active",
        prescribedDate: "2025-08-15",
        prescribedBy: "Dr. Michael Patel",
      },
      {
        id: "MED006",
        name: "Furosemide",
        dosage: "40 mg",
        frequency: "Once daily",
        route: "Oral",
        status: "active",
        prescribedDate: "2026-02-10",
        prescribedBy: "Dr. Michael Patel",
      },
    ],
    allergies: [
      {
        id: "ALG003",
        allergen: "Codeine",
        severity: "moderate",
        reaction: "Nausea and vomiting",
        recordedDate: "2019-11-05",
      },
    ],
    labResults: [
      {
        id: "LAB005",
        testName: "BNP",
        value: "450",
        referenceRange: "< 100",
        unit: "pg/mL",
        status: "abnormal",
        date: "2026-06-10",
      },
      {
        id: "LAB006",
        testName: "Troponin I",
        value: "0.02",
        referenceRange: "< 0.04",
        unit: "ng/mL",
        status: "normal",
        date: "2026-06-10",
      },
      {
        id: "LAB007",
        testName: "eGFR",
        value: "62",
        referenceRange: "> 60",
        unit: "mL/min/1.73m²",
        status: "normal",
        date: "2026-06-10",
      },
    ],
    encounters: [
      {
        id: "ENC004",
        date: "2026-06-14",
        type: "Office Visit - Follow Up",
        provider: "Dr. Michael Patel, MD",
        diagnosis: "Congestive heart failure (I50.9), Coronary artery disease (I25.1)",
        notes:
          "Patient reports increased SOB with activity. Mild pedal edema noted. BNP elevated. Will adjust diuretic dose and schedule echocardiogram.",
        department: "Cardiology",
      },
      {
        id: "ENC005",
        date: "2026-03-20",
        type: "Office Visit - Follow Up",
        provider: "Dr. Michael Patel, MD",
        diagnosis: "Congestive heart failure (I50.9)",
        notes:
          "CHF stable. Ejection fraction 40% on last echo. Continue current management.",
        department: "Cardiology",
      },
    ],
    problems: [
      "Congestive heart failure (I50.9)",
      "Coronary artery disease (I25.1)",
      "Chronic kidney disease stage 3 (N18.3)",
    ],
  },
  {
    id: "P003",
    mrn: "MRN-1003",
    firstName: "Emily",
    lastName: "Chen",
    dateOfBirth: "1994-07-08",
    age: 32,
    gender: "Female",
    phone: "(555) 345-6789",
    email: "emily.chen@email.com",
    address: "789 Pine Rd, Springfield, IL 62703",
    emergencyContact: {
      name: "David Chen",
      phone: "(555) 765-4321",
      relation: "Brother",
    },
    primaryCareProvider: "Dr. Lisa Wong, MD",
    insurance: "Aetna HMO",
    chiefComplaint: "Worsening cough and wheezing",
    vitals: {
      bloodPressure: "118/72",
      heartRate: 82,
      temperature: 99.1,
      respiratoryRate: 22,
      oxygenSaturation: 95,
      recordedAt: "2026-06-13T11:00:00Z",
    },
    medications: [
      {
        id: "MED007",
        name: "Albuterol HFA",
        dosage: "90 mcg",
        frequency: "2 puffs q4-6h PRN",
        route: "Inhalation",
        status: "active",
        prescribedDate: "2025-12-01",
        prescribedBy: "Dr. Lisa Wong",
      },
      {
        id: "MED008",
        name: "Fluticasone/Salmeterol",
        dosage: "250/50 mcg",
        frequency: "1 inhalation twice daily",
        route: "Inhalation",
        status: "active",
        prescribedDate: "2026-01-20",
        prescribedBy: "Dr. Lisa Wong",
      },
      {
        id: "MED009",
        name: "Montelukast",
        dosage: "10 mg",
        frequency: "Once daily at bedtime",
        route: "Oral",
        status: "active",
        prescribedDate: "2026-01-20",
        prescribedBy: "Dr. Lisa Wong",
      },
    ],
    allergies: [
      {
        id: "ALG004",
        allergen: "Aspirin",
        severity: "moderate",
        reaction: "Urticaria and bronchospasm",
        recordedDate: "2022-08-12",
      },
      {
        id: "ALG005",
        allergen: "Pollen (Seasonal)",
        severity: "mild",
        reaction: "Sneezing, itchy eyes",
        recordedDate: "2020-04-01",
      },
    ],
    labResults: [
      {
        id: "LAB008",
        testName: "Pulmonary Function Test - FEV1",
        value: "65",
        referenceRange: "> 80",
        unit: "% predicted",
        status: "abnormal",
        date: "2026-05-20",
      },
      {
        id: "LAB009",
        testName: "IgE Level",
        value: "250",
        referenceRange: "< 100",
        unit: "IU/mL",
        status: "abnormal",
        date: "2026-05-20",
      },
    ],
    encounters: [
      {
        id: "ENC006",
        date: "2026-06-13",
        type: "Office Visit - Acute",
        provider: "Dr. Lisa Wong, MD",
        diagnosis: "Acute exacerbation of asthma (J45.901)",
        notes:
          "Patient presents with 3-day history of worsening cough, wheezing, and dyspnea. Peak flow 65% of personal best. Increased maintenance inhaler. Prescribed prednisone burst.",
        department: "Pulmonology",
      },
      {
        id: "ENC007",
        date: "2026-04-10",
        type: "Office Visit - Follow Up",
        provider: "Dr. Lisa Wong, MD",
        diagnosis: "Persistent asthma (J45.40)",
        notes:
          "Asthma well-controlled on current regimen. Peak flow 90% of personal best. Continue current medications.",
        department: "Pulmonology",
      },
    ],
    problems: [
      "Persistent asthma (J45.40)",
      "Allergic rhinitis (J30.9)",
    ],
  },
  {
    id: "P004",
    mrn: "MRN-1004",
    firstName: "Robert",
    lastName: "Johnson",
    dateOfBirth: "1954-11-30",
    age: 72,
    gender: "Male",
    phone: "(555) 456-7890",
    email: "robert.johnson@email.com",
    address: "321 Elm St, Springfield, IL 62704",
    emergencyContact: {
      name: "Patricia Johnson",
      phone: "(555) 654-3210",
      relation: "Daughter",
    },
    primaryCareProvider: "Dr. James Wilson, MD",
    insurance: "Medicare Advantage",
    chiefComplaint: "Increased fatigue and swelling in legs",
    vitals: {
      bloodPressure: "145/90",
      heartRate: 92,
      temperature: 97.8,
      respiratoryRate: 24,
      oxygenSaturation: 90,
      recordedAt: "2026-06-12T10:00:00Z",
    },
    medications: [
      {
        id: "MED010",
        name: "Tiotropium",
        dosage: "18 mcg",
        frequency: "Once daily",
        route: "Inhalation",
        status: "active",
        prescribedDate: "2025-05-01",
        prescribedBy: "Dr. James Wilson",
      },
      {
        id: "MED011",
        name: "Prednisone",
        dosage: "10 mg",
        frequency: "Once daily",
        route: "Oral",
        status: "active",
        prescribedDate: "2026-06-12",
        prescribedBy: "Dr. James Wilson",
      },
      {
        id: "MED012",
        name: "Digoxin",
        dosage: "0.125 mg",
        frequency: "Once daily",
        route: "Oral",
        status: "active",
        prescribedDate: "2025-10-15",
        prescribedBy: "Dr. James Wilson",
      },
    ],
    allergies: [
      {
        id: "ALG006",
        allergen: "Latex",
        severity: "moderate",
        reaction: "Contact dermatitis",
        recordedDate: "2018-06-20",
      },
    ],
    labResults: [
      {
        id: "LAB010",
        testName: "ABG - pO2",
        value: "62",
        referenceRange: "80-100",
        unit: "mmHg",
        status: "abnormal",
        date: "2026-06-12",
      },
      {
        id: "LAB011",
        testName: "ABG - pCO2",
        value: "52",
        referenceRange: "35-45",
        unit: "mmHg",
        status: "abnormal",
        date: "2026-06-12",
      },
      {
        id: "LAB012",
        testName: "Hemoglobin",
        value: "13.2",
        referenceRange: "13.5-17.5",
        unit: "g/dL",
        status: "abnormal",
        date: "2026-06-05",
      },
    ],
    encounters: [
      {
        id: "ENC008",
        date: "2026-06-12",
        type: "Office Visit - Follow Up",
        provider: "Dr. James Wilson, MD",
        diagnosis:
          "COPD exacerbation (J44.1), Chronic systolic heart failure (I50.22)",
        notes:
          "Patient presents with worsening dyspnea, bilateral lower extremity edema, and fatigue. O2 sat 90% on room air. Started prednisone burst. Scheduled pulmonary function tests.",
        department: "Pulmonary/Cardiology",
      },
      {
        id: "ENC009",
        date: "2026-03-05",
        type: "Office Visit - Routine",
        provider: "Dr. James Wilson, MD",
        diagnosis:
          "COPD (J44.9), Chronic diastolic heart failure (I50.32)",
        notes:
          "Stable COPD. Mild edema controlled with diuretics. Continue current regimen.",
        department: "Internal Medicine",
      },
    ],
    problems: [
      "COPD (J44.9)",
      "Chronic systolic heart failure (I50.22)",
      "Anemia of chronic disease (D63.0)",
    ],
  },
  {
    id: "P005",
    mrn: "MRN-1005",
    firstName: "Maria",
    lastName: "Garcia",
    dateOfBirth: "1998-02-14",
    age: 28,
    gender: "Female",
    phone: "(555) 567-8901",
    email: "maria.garcia@email.com",
    address: "654 Maple Dr, Springfield, IL 62705",
    emergencyContact: {
      name: "Carlos Garcia",
      phone: "(555) 543-2109",
      relation: "Father",
    },
    primaryCareProvider: "Dr. Karen Thompson, MD",
    insurance: "United Healthcare",
    chiefComplaint: "Fatigue and dizziness (prenatal visit)",
    vitals: {
      bloodPressure: "110/68",
      heartRate: 78,
      temperature: 98.4,
      respiratoryRate: 16,
      oxygenSaturation: 99,
      recordedAt: "2026-06-10T13:30:00Z",
    },
    medications: [
      {
        id: "MED013",
        name: "Prenatal Vitamin",
        dosage: "1 tablet",
        frequency: "Once daily",
        route: "Oral",
        status: "active",
        prescribedDate: "2026-01-15",
        prescribedBy: "Dr. Karen Thompson",
      },
      {
        id: "MED014",
        name: "Ferrous Sulfate",
        dosage: "325 mg",
        frequency: "Twice daily",
        route: "Oral",
        status: "active",
        prescribedDate: "2026-04-01",
        prescribedBy: "Dr. Karen Thompson",
      },
    ],
    allergies: [
      {
        id: "ALG007",
        allergen: "Peanuts",
        severity: "severe",
        reaction: "Angioedema and anaphylaxis",
        recordedDate: "2010-09-15",
      },
    ],
    labResults: [
      {
        id: "LAB013",
        testName: "Hemoglobin",
        value: "10.2",
        referenceRange: "12.0-15.5",
        unit: "g/dL",
        status: "abnormal",
        date: "2026-06-10",
      },
      {
        id: "LAB014",
        testName: "Hematocrit",
        value: "31",
        referenceRange: "36-46",
        unit: "%",
        status: "abnormal",
        date: "2026-06-10",
      },
      {
        id: "LAB015",
        testName: "Ferritin",
        value: "15",
        referenceRange: "20-200",
        unit: "ng/mL",
        status: "abnormal",
        date: "2026-06-10",
      },
      {
        id: "LAB016",
        testName: "Glucose Tolerance Test (1hr)",
        value: "135",
        referenceRange: "< 140",
        unit: "mg/dL",
        status: "normal",
        date: "2026-06-10",
      },
    ],
    encounters: [
      {
        id: "ENC010",
        date: "2026-06-10",
        type: "Prenatal Visit - 28 weeks",
        provider: "Dr. Karen Thompson, MD",
        diagnosis: "Iron deficiency anemia of pregnancy (O99.01), Normal pregnancy (Z34.90)",
        notes:
          "28-week prenatal visit. Fundal height 28 cm, fetal heart tones 140 bpm. Labs show iron deficiency anemia. Increased ferritin dose. RhoGAM ordered for Rh-negative status.",
        department: "Obstetrics",
      },
      {
        id: "ENC011",
        date: "2026-05-06",
        type: "Prenatal Visit - 24 weeks",
        provider: "Dr. Karen Thompson, MD",
        diagnosis: "Normal pregnancy (Z34.90)",
        notes:
          "24-week prenatal visit. Glucose tolerance test passed. Fundal height 24 cm. Fetal movement reported as normal.",
        department: "Obstetrics",
      },
    ],
    problems: [
      "Normal pregnancy (Z34.90)",
      "Iron deficiency anemia (D50.9)",
      "Rh-negative status (Z16.1)",
    ],
  },
  // ─── Phase D: 10 New Patient Scenarios ────────────────────────────
  {
    id: "P006",
    mrn: "MRN-2001",
    firstName: "Olivia",
    lastName: "Chen",
    dateOfBirth: "1998-05-20",
    age: 28,
    gender: "Female",
    phone: "(555) 111-2222",
    email: "olivia.chen@email.com",
    address: "100 Maple St, Springfield, IL 62701",
    emergencyContact: { name: "Mark Chen", phone: "(555) 222-3333", relation: "Father" },
    primaryCareProvider: "Dr. Lisa Wong, MD",
    insurance: "Aetna PPO",
    chiefComplaint: "Runny nose, sore throat, mild cough for 3 days",
    vitals: { bloodPressure: "118/72", heartRate: 76, temperature: 99.8, respiratoryRate: 16, oxygenSaturation: 99, recordedAt: "2026-07-08T10:00:00Z" },
    medications: [{ id: "MED015", name: "Ibuprofen", dosage: "400 mg", frequency: "q6h PRN", route: "Oral", status: "active", prescribedDate: "2026-07-08", prescribedBy: "Dr. Lisa Wong" }],
    allergies: [{ id: "ALG008", allergen: "Amoxicillin", severity: "mild", reaction: "Rash", recordedDate: "2022-03-15" }],
    labResults: [],
    encounters: [{ id: "ENC012", date: "2026-07-08", type: "Office Visit - Acute", provider: "Dr. Lisa Wong, MD", diagnosis: "Acute upper respiratory infection (J06.9)", notes: "Patient reports 3-day history of rhinorrhea, sore throat, and mild cough. No fever. No dyspnea. Supportive care recommended.", department: "Internal Medicine" }],
    problems: ["Acute URI (J06.9)"],
  },
  {
    id: "P007",
    mrn: "MRN-2002",
    firstName: "Robert",
    lastName: "Martinez",
    dateOfBirth: "1981-11-12",
    age: 45,
    gender: "Male",
    phone: "(555) 333-4444",
    email: "robert.martinez@email.com",
    address: "200 Oak Ave, Springfield, IL 62702",
    emergencyContact: { name: "Linda Martinez", phone: "(555) 444-5555", relation: "Spouse" },
    primaryCareProvider: "Dr. Sarah Chen, MD",
    insurance: "Blue Cross Blue Shield HMO",
    chiefComplaint: "Follow-up hypertension — BP readings elevated at home",
    vitals: { bloodPressure: "152/94", heartRate: 82, temperature: 98.4, respiratoryRate: 18, oxygenSaturation: 97, recordedAt: "2026-07-08T11:30:00Z" },
    medications: [
      { id: "MED016", name: "Lisinopril", dosage: "10 mg", frequency: "Once daily", route: "Oral", status: "active", prescribedDate: "2025-09-01", prescribedBy: "Dr. Sarah Chen" },
      { id: "MED017", name: "Amlodipine", dosage: "5 mg", frequency: "Once daily", route: "Oral", status: "active", prescribedDate: "2026-01-15", prescribedBy: "Dr. Sarah Chen" },
    ],
    allergies: [],
    labResults: [{ id: "LAB017", testName: "Serum Creatinine", value: "1.1", referenceRange: "0.7-1.3", unit: "mg/dL", status: "normal", date: "2026-07-08" }],
    encounters: [{ id: "ENC013", date: "2026-07-08", type: "Office Visit - Follow Up", provider: "Dr. Sarah Chen, MD", diagnosis: "Essential hypertension (I10)", notes: "Home BP readings 145-155/90-95. Today's office BP 152/94. Will increase lisinopril to 20mg daily. Continue amlodipine. Follow up in 4 weeks.", department: "Internal Medicine" }],
    problems: ["Essential hypertension (I10)"],
  },
  {
    id: "P008",
    mrn: "MRN-2003",
    firstName: "Harold",
    lastName: "Thompson",
    dateOfBirth: "1964-03-28",
    age: 62,
    gender: "Male",
    phone: "(555) 555-6666",
    email: "harold.thompson@email.com",
    address: "300 Pine Rd, Springfield, IL 62703",
    emergencyContact: { name: "Betty Thompson", phone: "(555) 666-7777", relation: "Spouse" },
    primaryCareProvider: "Dr. Michael Patel, MD",
    insurance: "Medicare Part B + Supplemental",
    chiefComplaint: "Crushing chest pain radiating to left arm, started 2 hours ago",
    vitals: { bloodPressure: "165/95", heartRate: 105, temperature: 98.2, respiratoryRate: 22, oxygenSaturation: 94, recordedAt: "2026-07-08T14:00:00Z" },
    medications: [
      { id: "MED018", name: "Aspirin", dosage: "81 mg", frequency: "Once daily", route: "Oral", status: "active", prescribedDate: "2024-06-01", prescribedBy: "Dr. Michael Patel" },
      { id: "MED019", name: "Atorvastatin", dosage: "40 mg", frequency: "Once daily at bedtime", route: "Oral", status: "active", prescribedDate: "2024-06-01", prescribedBy: "Dr. Michael Patel" },
    ],
    allergies: [{ id: "ALG009", allergen: "Sulfa Drugs", severity: "moderate", reaction: "Rash and fever", recordedDate: "2019-08-10" }],
    labResults: [
      { id: "LAB018", testName: "High-Sensitivity Troponin I", value: "0.85", referenceRange: "< 0.04", unit: "ng/mL", status: "critical", date: "2026-07-08" },
      { id: "LAB019", testName: "ECG", value: "ST elevation in V1-V4", referenceRange: "Normal sinus", unit: "", status: "critical", date: "2026-07-08" },
    ],
    encounters: [{ id: "ENC014", date: "2026-07-08", type: "Emergency - Chest Pain", provider: "Dr. James Wilson, MD", diagnosis: "Acute anterior STEMI (I21.0)", notes: "Patient presents with acute onset crushing chest pain radiating to left arm with diaphoresis. ECG shows ST elevation in V1-V4. Troponin elevated. Activate cath lab stat.", department: "Emergency/Cardiology" }],
    problems: ["Acute STEMI (I21.0)", "Coronary artery disease (I25.1)", "Hyperlipidemia (E78.5)"],
  },
  {
    id: "P009",
    mrn: "MRN-2004",
    firstName: "Mia",
    lastName: "Rodriguez",
    dateOfBirth: "2021-04-05",
    age: 5,
    gender: "Female",
    phone: "(555) 777-8888",
    email: "parent.mia@email.com",
    address: "400 Birch Ln, Springfield, IL 62704",
    emergencyContact: { name: "Sofia Rodriguez", phone: "(555) 888-9999", relation: "Mother" },
    primaryCareProvider: "Dr. Karen Thompson, MD",
    insurance: "Cigna PPO",
    chiefComplaint: "Ear pain and fever for 2 days",
    vitals: { bloodPressure: "100/62", heartRate: 110, temperature: 101.8, respiratoryRate: 22, oxygenSaturation: 99, recordedAt: "2026-07-07T09:00:00Z" },
    medications: [
      { id: "MED020", name: "Acetaminophen", dosage: "200 mg", frequency: "q6h PRN fever", route: "Oral", status: "active", prescribedDate: "2026-07-06", prescribedBy: "Mother" },
    ],
    allergies: [],
    labResults: [],
    encounters: [{ id: "ENC015", date: "2026-07-07", type: "Office Visit - Acute", provider: "Dr. Karen Thompson, MD", diagnosis: "Acute suppurative otitis media (H66.4)", notes: "5-year-old female with 2-day history of right ear pain and fever to 102F. Tympanic membrane erythematous and bulging on right. Diagnosed with acute otitis media. Prescribed amoxicillin 400mg BID x 10 days.", department: "Pediatrics" }],
    problems: ["Acute otitis media (H66.4)"],
  },
  {
    id: "P010",
    mrn: "MRN-2005",
    firstName: "Eleanor",
    lastName: "Hayes",
    dateOfBirth: "1948-08-15",
    age: 78,
    gender: "Female",
    phone: "(555) 999-0000",
    email: "eleanor.hayes@email.com",
    address: "500 Walnut St, Springfield, IL 62705",
    emergencyContact: { name: "Thomas Hayes", phone: "(555) 000-1111", relation: "Son" },
    primaryCareProvider: "Dr. Sarah Chen, MD",
    insurance: "Medicare Advantage",
    chiefComplaint: "Fell at home yesterday, increased confusion, diabetes out of control",
    vitals: { bloodPressure: "148/78", heartRate: 98, temperature: 98.9, respiratoryRate: 20, oxygenSaturation: 95, recordedAt: "2026-07-07T15:00:00Z" },
    medications: [
      { id: "MED021", name: "Metformin", dosage: "500 mg", frequency: "Twice daily", route: "Oral", status: "active", prescribedDate: "2024-01-15", prescribedBy: "Dr. Sarah Chen" },
      { id: "MED022", name: "Glipizide", dosage: "5 mg", frequency: "Once daily", route: "Oral", status: "active", prescribedDate: "2024-06-01", prescribedBy: "Dr. Sarah Chen" },
      { id: "MED023", name: "Gabapentin", dosage: "300 mg", frequency: "Three times daily", route: "Oral", status: "active", prescribedDate: "2025-03-10", prescribedBy: "Dr. Sarah Chen" },
      { id: "MED024", name: "Vitamin D3", dosage: "1000 IU", frequency: "Once daily", route: "Oral", status: "active", prescribedDate: "2025-01-01", prescribedBy: "Dr. Sarah Chen" },
    ],
    allergies: [{ id: "ALG010", allergen: "Ciprofloxacin", severity: "moderate", reaction: "Tendonitis", recordedDate: "2020-11-20" }],
    labResults: [
      { id: "LAB020", testName: "Hemoglobin A1C", value: "8.7", referenceRange: "< 5.7", unit: "%", status: "abnormal", date: "2026-07-07" },
      { id: "LAB021", testName: "Glucose", value: "245", referenceRange: "70-140", unit: "mg/dL", status: "abnormal", date: "2026-07-07" },
    ],
    encounters: [{ id: "ENC016", date: "2026-07-07", type: "Office Visit - Follow Up", provider: "Dr. Sarah Chen, MD", diagnosis: "Type 2 diabetes with neuropathy (E11.40), Fall risk (Z91.81)", notes: "78yo F with poorly controlled DM2, diabetic neuropathy, recent fall. A1C 8.7%. Gait unsteady. Will increase metformin to 1000mg BID, start insulin if no improvement. Physical therapy referral for fall prevention.", department: "Internal Medicine" }],
    problems: ["Type 2 diabetes with neuropathy (E11.40)", "Diabetic peripheral neuropathy (G63)", "Fall risk (Z91.81)", "Vitamin D deficiency (E55.9)"],
  },
  {
    id: "P011",
    mrn: "MRN-2006",
    firstName: "James",
    lastName: "Kowalski",
    dateOfBirth: "1971-09-03",
    age: 55,
    gender: "Male",
    phone: "(555) 111-3333",
    email: "james.kowalski@email.com",
    address: "600 Cedar Dr, Springfield, IL 62706",
    emergencyContact: { name: "Anna Kowalski", phone: "(555) 444-6666", relation: "Spouse" },
    primaryCareProvider: "Dr. Michael Patel, MD",
    insurance: "United Healthcare PPO",
    chiefComplaint: "Chronic right knee pain — wants to discuss total knee replacement",
    vitals: { bloodPressure: "128/80", heartRate: 72, temperature: 98.4, respiratoryRate: 16, oxygenSaturation: 98, recordedAt: "2026-07-07T10:00:00Z" },
    medications: [
      { id: "MED025", name: "Naproxen", dosage: "500 mg", frequency: "Twice daily", route: "Oral", status: "active", prescribedDate: "2025-08-01", prescribedBy: "Dr. Michael Patel" },
      { id: "MED026", name: "Acetaminophen", dosage: "1000 mg", frequency: "q6h PRN", route: "Oral", status: "active", prescribedDate: "2025-08-01", prescribedBy: "Dr. Michael Patel" },
    ],
    allergies: [],
    labResults: [{ id: "LAB022", testName: "Right Knee X-ray", value: "Severe OA with bone-on-bone medial compartment", referenceRange: "Normal", unit: "", status: "abnormal", date: "2026-06-20" }],
    encounters: [{ id: "ENC017", date: "2026-07-07", type: "Office Visit - Surgical Consult", provider: "Dr. Michael Patel, MD", diagnosis: "Primary osteoarthritis of right knee (M17.11)", notes: "55yo M with severe right knee OA refractory to conservative management. XR shows bone-on-bone changes. Discussed total knee arthroplasty. Patient wants to proceed. Prior auth required for planned 27447.", department: "Orthopedic Surgery" }],
    problems: ["Primary OA right knee (M17.11)"],
  },
  {
    id: "P012",
    mrn: "MRN-2007",
    firstName: "Alex",
    lastName: "Rivera",
    dateOfBirth: "1994-02-18",
    age: 32,
    gender: "Male",
    phone: "(555) 222-4444",
    email: "alex.rivera@email.com",
    address: "700 Elm St, Springfield, IL 62707",
    emergencyContact: { name: "Maria Rivera", phone: "(555) 555-7777", relation: "Mother" },
    primaryCareProvider: "Dr. Karen Thompson, MD",
    insurance: "Aetna HMO",
    chiefComplaint: "Feeling overwhelmed, trouble sleeping, loss of interest in activities",
    vitals: { bloodPressure: "122/78", heartRate: 80, temperature: 98.2, respiratoryRate: 16, oxygenSaturation: 99, recordedAt: "2026-07-06T13:00:00Z" },
    medications: [
      { id: "MED027", name: "Sertraline", dosage: "50 mg", frequency: "Once daily", route: "Oral", status: "active", prescribedDate: "2026-04-01", prescribedBy: "Dr. Karen Thompson" },
    ],
    allergies: [],
    labResults: [],
    encounters: [{ id: "ENC018", date: "2026-07-06", type: "Office Visit - Follow Up", provider: "Dr. Karen Thompson, MD", diagnosis: "Generalized anxiety disorder (F41.1), Major depressive disorder, moderate (F32.1)", notes: "32yo M with worsening anxiety and depression. PHQ-9 score 18. Reports anhedonia, sleep disturbance, poor concentration. Continue sertraline 50mg. Increase to 100mg after 2 weeks. Referred to CBT.", department: "Psychiatry" }],
    problems: ["Generalized anxiety disorder (F41.1)", "Major depressive disorder, moderate (F32.1)"],
  },
  {
    id: "P013",
    mrn: "MRN-2008",
    firstName: "Beatrice",
    lastName: "Okafor",
    dateOfBirth: "1958-04-22",
    age: 68,
    gender: "Female",
    phone: "(555) 333-5555",
    email: "beatrice.okafor@email.com",
    address: "800 Spruce Ave, Springfield, IL 62708",
    emergencyContact: { name: "Chinwe Okafor", phone: "(555) 666-8888", relation: "Daughter" },
    primaryCareProvider: "Dr. James Wilson, MD",
    insurance: "Medicare Part B + Blue Cross Supplemental",
    chiefComplaint: "Severe shortness of breath, wheezing, productive cough for 4 days",
    vitals: { bloodPressure: "142/86", heartRate: 98, temperature: 100.4, respiratoryRate: 28, oxygenSaturation: 88, recordedAt: "2026-07-06T09:30:00Z" },
    medications: [
      { id: "MED028", name: "Tiotropium", dosage: "18 mcg", frequency: "Once daily", route: "Inhalation", status: "active", prescribedDate: "2025-11-01", prescribedBy: "Dr. James Wilson" },
      { id: "MED029", name: "Fluticasone/Salmeterol", dosage: "250/50 mcg", frequency: "1 inhalation twice daily", route: "Inhalation", status: "active", prescribedDate: "2025-11-01", prescribedBy: "Dr. James Wilson" },
      { id: "MED030", name: "Prednisone", dosage: "40 mg", frequency: "Once daily x 5 days", route: "Oral", status: "active", prescribedDate: "2026-07-06", prescribedBy: "Dr. James Wilson" },
    ],
    allergies: [{ id: "ALG011", allergen: "Penicillin", severity: "severe", reaction: "Anaphylaxis", recordedDate: "2010-05-10" }],
    labResults: [
      { id: "LAB023", testName: "ABG - pO2", value: "58", referenceRange: "80-100", unit: "mmHg", status: "critical", date: "2026-07-06" },
      { id: "LAB024", testName: "Chest X-ray", value: "Hyperinflation, no consolidation", referenceRange: "Normal", unit: "", status: "abnormal", date: "2026-07-06" },
    ],
    encounters: [{ id: "ENC019", date: "2026-07-06", type: "Office Visit - Acute", provider: "Dr. James Wilson, MD", diagnosis: "COPD with acute exacerbation (J44.1)", notes: "68yo F with known COPD presents with 4-day worsening dyspnea, wheezing, purulent sputum. O2 sat 88% on RA. ABG shows hypoxemia. Started prednisone burst, antibiotics (doxycycline due to PCN allergy). Nebulizer treatments initiated.", department: "Pulmonary" }],
    problems: ["COPD with acute exacerbation (J44.1)", "Chronic hypoxemic respiratory failure (J96.11)"],
  },
  {
    id: "P014",
    mrn: "MRN-2009",
    firstName: "David",
    lastName: "Kim",
    dateOfBirth: "1991-07-30",
    age: 35,
    gender: "Male",
    phone: "(555) 444-6666",
    email: "david.kim@email.com",
    address: "900 Maple Dr, Springfield, IL 62709",
    emergencyContact: { name: "Eunice Kim", phone: "(555) 777-9999", relation: "Sister" },
    primaryCareProvider: "Dr. Lisa Wong, MD",
    insurance: "Cigna HMO",
    chiefComplaint: "Severe right lower quadrant abdominal pain, nausea, fever for 12 hours",
    vitals: { bloodPressure: "132/84", heartRate: 104, temperature: 101.2, respiratoryRate: 20, oxygenSaturation: 98, recordedAt: "2026-07-05T22:00:00Z" },
    medications: [],
    allergies: [{ id: "ALG012", allergen: "Codeine", severity: "moderate", reaction: "Nausea and vomiting", recordedDate: "2021-04-15" }],
    labResults: [
      { id: "LAB025", testName: "WBC Count", value: "15.2", referenceRange: "4.5-11.0", unit: "K/µL", status: "abnormal", date: "2026-07-05" },
      { id: "LAB026", testName: "CT Abdomen/Pelvis", value: "Enlarged appendix 12mm with wall thickening and periappendiceal fat stranding", referenceRange: "Normal", unit: "", status: "abnormal", date: "2026-07-05" },
    ],
    encounters: [{ id: "ENC020", date: "2026-07-05", type: "Emergency - Abdominal Pain", provider: "Dr. James Wilson, MD", diagnosis: "Acute appendicitis with periappendicitis (K35.80)", notes: "35yo M with 12-hour history of RLQ pain, nausea, fever. WBC 15.2. CT confirms acute appendicitis. General surgery consulted. Planned for laparoscopic appendectomy (47562).", department: "Emergency/General Surgery" }],
    problems: ["Acute appendicitis (K35.80)"],
  },
  {
    id: "P015",
    mrn: "MRN-2010",
    firstName: "Fatima",
    lastName: "Al-Rashid",
    dateOfBirth: "1976-12-08",
    age: 50,
    gender: "Female",
    phone: "(555) 555-8888",
    email: "fatima.al-rashid@email.com",
    address: "1000 Willow Ct, Springfield, IL 62710",
    emergencyContact: { name: "Hassan Al-Rashid", phone: "(555) 888-0000", relation: "Spouse" },
    primaryCareProvider: "Dr. Karen Thompson, MD",
    insurance: "United Healthcare PPO",
    chiefComplaint: "Found lump in right breast on self-exam 2 weeks ago",
    vitals: { bloodPressure: "125/78", heartRate: 76, temperature: 98.4, respiratoryRate: 16, oxygenSaturation: 99, recordedAt: "2026-07-05T11:00:00Z" },
    medications: [],
    allergies: [],
    labResults: [
      { id: "LAB027", testName: "Diagnostic Mammogram + Ultrasound", value: "1.5cm spiculated mass, right breast, upper outer quadrant. BI-RADS 5", referenceRange: "BI-RADS 1-2", unit: "", status: "abnormal", date: "2026-07-03" },
    ],
    encounters: [{ id: "ENC021", date: "2026-07-05", type: "Office Visit - Diagnostic Results", provider: "Dr. Karen Thompson, MD", diagnosis: "Suspicious breast mass, right (N63.01)", notes: "50yo F with self-palpated right breast mass. Mammo/US shows BI-RADS 5 lesion. Discussed need for stereotactic core needle biopsy (19081). Patient agrees. Prior auth required. Will refer to surgical oncology.", department: "Breast Surgery/Oncology" }],
    problems: ["Suspicious breast mass right (N63.01)", "Need for cancer screening (Z12.39)"],
  },
  // ── Inpatient: 72yo CHF Exacerbation ──
  {
    id: "P016",
    mrn: "MRN-1016",
    firstName: "George",
    lastName: "Harrison",
    dateOfBirth: "1954-02-25",
    age: 72,
    gender: "Male",
    phone: "(555) 234-5678",
    email: "george.h@email.com",
    address: "456 Oak Ave, Chicago, IL 60601",
    emergencyContact: { name: "Martha Harrison", phone: "(555) 234-5679", relation: "Spouse" },
    primaryCareProvider: "Dr. James Wilson, MD",
    insurance: "Medicare Part B",
    chiefComplaint: "Worsening shortness of breath, leg swelling, unable to lie flat for 2 days",
    vitals: { bloodPressure: "158/94", heartRate: 102, temperature: 98.8, respiratoryRate: 26, oxygenSaturation: 88, recordedAt: "2026-07-08T08:15:00Z" },
    medications: [
      { id: "MED040", name: "Furosemide", dosage: "40 mg", frequency: "Twice daily", route: "Oral", status: "active", prescribedDate: "2026-03-01", prescribedBy: "Dr. James Wilson" },
      { id: "MED041", name: "Lisinopril", dosage: "5 mg", frequency: "Once daily", route: "Oral", status: "active", prescribedDate: "2026-01-15", prescribedBy: "Dr. James Wilson" },
      { id: "MED042", name: "Metoprolol", dosage: "25 mg", frequency: "Twice daily", route: "Oral", status: "active", prescribedDate: "2026-01-15", prescribedBy: "Dr. James Wilson" },
      { id: "MED043", name: "Warfarin", dosage: "2 mg", frequency: "Once daily", route: "Oral", status: "active", prescribedDate: "2026-04-10", prescribedBy: "Dr. James Wilson" },
    ],
    allergies: [{ id: "ALG015", allergen: "Codeine", severity: "moderate", reaction: "Nausea and vomiting", recordedDate: "2020-05-10" }],
    labResults: [
      { id: "LAB028", testName: "BNP", value: "1,850", referenceRange: "< 100", unit: "pg/mL", status: "critical", date: "2026-07-08" },
      { id: "LAB029", testName: "Chest X-ray", value: "Cardiomegaly, pulmonary vascular congestion, small bilateral pleural effusions", referenceRange: "Normal", unit: "", status: "abnormal", date: "2026-07-08" },
      { id: "LAB030", testName: "Troponin I", value: "0.02", referenceRange: "< 0.04", unit: "ng/mL", status: "normal", date: "2026-07-08" },
    ],
    encounters: [
      { id: "ENC022", date: "2026-07-08", type: "Inpatient Admission - Telemetry", provider: "Dr. James Wilson, MD", diagnosis: "Acute on chronic systolic CHF exacerbation (I50.22)", notes: "72yo M with known CHF (EF 35-40%) presents with 2-day worsening SOB, orthopnea, bilateral leg edema, +JVD. O2 sat 88% on RA. CXR shows pulmonary congestion. BNP 1850. Admitted to telemetry. Start IV furosemide 40mg BID. Hold metoprolol until HR < 100. Daily weights, I/O monitoring. Echo ordered. Consult cardiology.", department: "Cardiology/Telemetry" },
    ],
    problems: ["Chronic systolic heart failure (I50.22)", "Essential hypertension (I10)", "Atrial fibrillation (I48.91)", "Chronic kidney disease stage 3 (N18.30)"],
  },
  // ── ER: 35yo Acute Abdominal Pain ──
  {
    id: "P017",
    mrn: "MRN-1017",
    firstName: "Samantha",
    lastName: "Green",
    dateOfBirth: "1991-04-18",
    age: 35,
    gender: "Female",
    phone: "(555) 345-6789",
    email: "samantha.g@email.com",
    address: "789 Pine St, Denver, CO 80201",
    emergencyContact: { name: "Michael Green", phone: "(555) 345-6780", relation: "Brother" },
    primaryCareProvider: "Dr. Lisa Park, MD",
    insurance: "Cigna PPO",
    chiefComplaint: "Severe right lower quadrant abdominal pain for 24 hours, started around umbilicus, now localized to RLQ",
    vitals: { bloodPressure: "132/84", heartRate: 108, temperature: 100.8, respiratoryRate: 18, oxygenSaturation: 97, recordedAt: "2026-07-09T14:30:00Z" },
    medications: [],
    allergies: [{ id: "ALG016", allergen: "Latex", severity: "mild", reaction: "Contact dermatitis", recordedDate: "2019-08-20" }],
    labResults: [
      { id: "LAB031", testName: "WBC Count", value: "14.5", referenceRange: "4.5-11.0", unit: "K/uL", status: "abnormal", date: "2026-07-09" },
      { id: "LAB032", testName: "CT Abdomen/Pelvis with Contrast", value: "Appendix dilated to 8mm with wall thickening, periappendiceal fat stranding. Findings consistent with acute appendicitis.", referenceRange: "Normal", unit: "", status: "abnormal", date: "2026-07-09" },
      { id: "LAB033", testName: "CRP", value: "45", referenceRange: "< 10", unit: "mg/L", status: "abnormal", date: "2026-07-09" },
    ],
    encounters: [
      { id: "ENC023", date: "2026-07-09", type: "Emergency Department - Acute", provider: "Dr. Robert Kim, MD, FACEP", diagnosis: "Acute appendicitis (K35.80)", notes: "35yo F presents with 24h of abdominal pain starting periumbilical then localizing to RLQ. Nausea, no vomiting. Low-grade fever. Tender at McBurney's point, positive Rovsing and psoas signs. WBC 14.5, CT confirms acute appendicitis. Started on IV fluids (LR at 125 mL/hr), IV Zosyn 3.375g. Consented for laparoscopic appendectomy. OR scheduled. NPO, pre-op labs drawn.", department: "Emergency Department" },
    ],
    problems: ["Acute appendicitis (K35.80)", "Dehydration (E86.0)"],
  },
  // ── Surgical: 55yo Elective Knee Replacement ──
  {
    id: "P018",
    mrn: "MRN-1018",
    firstName: "Robert",
    lastName: "Williams",
    dateOfBirth: "1971-11-03",
    age: 55,
    gender: "Male",
    phone: "(555) 456-7890",
    email: "robert.w@email.com",
    address: "321 Elm St, Portland, OR 97201",
    emergencyContact: { name: "Susan Williams", phone: "(555) 456-7891", relation: "Spouse" },
    primaryCareProvider: "Dr. Mark Taylor, MD",
    insurance: "Aetna PPO",
    chiefComplaint: "Right knee pain worsening over 6 months, failed conservative management, now scheduled for total knee arthroplasty",
    vitals: { bloodPressure: "128/76", heartRate: 72, temperature: 98.4, respiratoryRate: 14, oxygenSaturation: 98, recordedAt: "2026-07-07T10:00:00Z" },
    medications: [
      { id: "MED044", name: "Acetaminophen", dosage: "1000 mg", frequency: "Every 6 hours as needed", route: "Oral", status: "active", prescribedDate: "2026-01-10", prescribedBy: "Dr. Mark Taylor" },
      { id: "MED045", name: "Meloxicam", dosage: "15 mg", frequency: "Once daily", route: "Oral", status: "active", prescribedDate: "2026-02-01", prescribedBy: "Dr. Mark Taylor" },
    ],
    allergies: [{ id: "ALG017", allergen: "Sulfa", severity: "moderate", reaction: "Rash, hives", recordedDate: "2015-11-20" }],
    labResults: [
      { id: "LAB034", testName: "Right Knee X-ray 3-View", value: "Severe tricompartmental osteoarthritis, joint space narrowing, osteophyte formation, subchondral sclerosis. Bone-on-bone medial compartment.", referenceRange: "Normal", unit: "", status: "abnormal", date: "2026-06-15" },
      { id: "LAB035", testName: "Pre-op Hemoglobin", value: "14.2", referenceRange: "13.5-17.5", unit: "g/dL", status: "normal", date: "2026-07-05" },
      { id: "LAB036", testName: "Pre-op EKG", value: "Normal sinus rhythm, rate 72. No acute changes.", referenceRange: "Normal", unit: "", status: "normal", date: "2026-07-05" },
    ],
    encounters: [
      { id: "ENC024", date: "2026-07-07", type: "Pre-Op Visit - Surgical Clearance", provider: "Dr. Mark Taylor, MD", diagnosis: "Primary osteoarthritis, right knee (M17.11)", notes: "55yo M with severe right knee OA. Failed conservative therapy (PT, NSAIDs, injections). Indicated for elective right total knee arthroplasty (CPT 27447). Pre-op clearance obtained. EKG normal, labs WNL. Prior auth required for TKA. Will submit to Aetna. Discussed: risks, benefits, post-op rehab, anticoagulation plan. Patient cleared for surgery.", department: "Orthopedic Surgery" },
    ],
    problems: ["Primary osteoarthritis, right knee (M17.11)", "Essential hypertension (I10)", "Hyperlipidemia (E78.5)"],
  },
];

// ─── Context ───────────────────────────────────────────────────────

interface PatientContextValue {
  patients: Patient[];
  getPatientById: (id: string) => Patient | undefined;
  getPatientByMrn: (mrn: string) => Patient | undefined;
  caseStates: Record<string, CaseState>;
  addAuditLog: (patientId: string, entry: AuditEntry) => void;
  setQueueStage: (patientId: string, stage: QueueStage) => void;
  setModifier25: (patientId: string, applied: boolean) => void;
  setBillingStatus: (patientId: string, status: CaseState["billingStatus"]) => void;
  setPaStatus: (patientId: string, status: CaseState["paStatus"]) => void;
  setArStatus: (patientId: string, status: CaseState["arStatus"]) => void;
  addRoutingNote: (patientId: string, note: RoutingNote) => void;
  addFollowUp: (patientId: string, entry: FollowUpEntry) => void;
}

const DEFAULT_CASE = (patientId: string): CaseState => ({
  patientId,
  currentQueue: "QUEUE_REGISTRATION" as QueueStage,
  auditLogs: [],
  modifier25Applied: false,
  billingStatus: "DRAFT",
  paStatus: "NOT_REQUIRED",
  arStatus: "NONE",
  routingNotes: [],
  followups: [],
});

const PatientContext = createContext<PatientContextValue | null>(null);

export function PatientProvider({ children }: { children: ReactNode }) {
  const [caseStates, setCaseStates] = useState<Record<string, CaseState>>({});
  const getPatientById = (id: string) => mockPatients.find((p) => p.id === id);
  const getPatientByMrn = (mrn: string) =>
    mockPatients.find((p) => p.mrn === mrn);

  const updateCase = (patientId: string, updater: (cs: CaseState) => CaseState) => {
    setCaseStates(prev => ({
      ...prev,
      [patientId]: updater(prev[patientId] || DEFAULT_CASE(patientId)),
    }));
  };

  const addAuditLog = (patientId: string, entry: AuditEntry) => {
    updateCase(patientId, cs => ({ ...cs, auditLogs: [...cs.auditLogs, entry] }));
  };
  const setQueueStage = (patientId: string, stage: QueueStage) => {
    updateCase(patientId, cs => ({ ...cs, currentQueue: stage }));
  };
  const setModifier25 = (patientId: string, applied: boolean) => {
    updateCase(patientId, cs => ({ ...cs, modifier25Applied: applied }));
  };
  const setBillingStatus = (patientId: string, status: CaseState["billingStatus"]) => {
    updateCase(patientId, cs => ({ ...cs, billingStatus: status }));
  };
  const setPaStatus = (patientId: string, status: CaseState["paStatus"]) => {
    updateCase(patientId, cs => ({ ...cs, paStatus: status }));
  };
  const setArStatus = (patientId: string, status: CaseState["arStatus"]) => {
    updateCase(patientId, cs => ({ ...cs, arStatus: status }));
  };
  const addRoutingNote = (patientId: string, note: RoutingNote) => {
    updateCase(patientId, cs => ({ ...cs, routingNotes: [...cs.routingNotes, note] }));
  };
  const addFollowUp = (patientId: string, entry: FollowUpEntry) => {
    updateCase(patientId, cs => ({ ...cs, followups: [...cs.followups, entry] }));
  };

  return (
    <PatientContext.Provider
      value={{ patients: mockPatients, getPatientById, getPatientByMrn, caseStates, addAuditLog, setQueueStage, setModifier25, setBillingStatus, setPaStatus, setArStatus, addRoutingNote, addFollowUp }}
    >
      {children}
    </PatientContext.Provider>
  );
}

export function usePatientStore(): PatientContextValue {
  const ctx = useContext(PatientContext);
  if (!ctx) {
    throw new Error("usePatientStore must be used within a PatientProvider");
  }
  return ctx;
}