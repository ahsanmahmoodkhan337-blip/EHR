/**
 * PDF Export Utilities — jspdf-based document generation
 *
 * Provides shared functions for exporting clinical forms and certificates
 * as downloadable PDF files.
 *
 * Inspiration: Epic print-merge / DrChrono document export
 */

import jsPDF from "jspdf";

/** Add a clean header bar to any PDF */
function addHeader(doc: jsPDF, title: string): void {
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, doc.internal.pageSize.width, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Healthcare Hustlers EHR Simulation", 14, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(title, 14, 22);
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(200, 200, 210);
  doc.line(14, 32, doc.internal.pageSize.width - 14, 32);
}

/** Add a footer to every page */
function addFooter(doc: jsPDF, pageNum: number): void {
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 160);
  doc.text(`Page ${pageNum} • Generated ${new Date().toLocaleDateString()}`, 14, doc.internal.pageSize.height - 10);
}

/**
 * Generate a SOAP Note PDF from assessment data
 */
export function exportSOAPNotePDF(noteData: {
  patientName: string;
  dob: string;
  mrn: string;
  date: string;
  chiefComplaint: string;
  hpi: string;
  vitals: { bp: string; hr: string; temp: string; rr: string; o2: string };
  exam: string;
  assessment: string;
  plan: string;
}): void {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.width;
  addHeader(doc, "SOAP Note — Clinical Encounter");

  let y = 40;
  const lineH = 5.5;
  const margin = 14;
  const maxW = pageW - 28;

  // Patient Info
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Patient Information", margin, y); y += lineH + 1;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`Name: ${noteData.patientName}     DOB: ${noteData.dob}     MRN: ${noteData.mrn}     Date: ${noteData.date}`, margin, y); y += lineH + 3;

  // Vitals
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Vital Signs", margin, y); y += lineH;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`BP: ${noteData.vitals.bp}     HR: ${noteData.vitals.hr}     Temp: ${noteData.vitals.temp}     RR: ${noteData.vitals.rr}     O2 Sat: ${noteData.vitals.o2}`, margin, y); y += lineH + 2;

  // Section helper
  const addSection = (title: string, text: string) => {
    if (y > 260) { doc.addPage(); y = 40; addHeader(doc, "SOAP Note (cont.)"); }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(title, margin, y); y += lineH;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(text || "Not documented", maxW);
    doc.text(lines, margin, y);
    y += lines.length * lineH + 2;
  };

  addSection("Chief Complaint", noteData.chiefComplaint);
  addSection("History of Present Illness", noteData.hpi);
  // Re-add vitals summary
  addSection("Physical Exam", noteData.exam);
  addSection("Assessment", noteData.assessment);
  addSection("Plan", noteData.plan);

  addFooter(doc, 1);
  doc.save(`SOAP_Note_${noteData.patientName.replace(/\s+/g, "_")}.pdf`);
}

/**
 * Generate a CMS-1500 claim form PDF
 */
export function exportCMS1500PDF(claimData: {
  patientName: string;
  dob: string;
  insurance: string;
  diagnosisCodes: string[];
  procedureCodes: string[];
  charges: number;
  status: string;
}): void {
  const doc = new jsPDF();
  const margin = 14;
  let y = 40;
  const lineH = 5.5;
  const pageW = doc.internal.pageSize.width;

  addHeader(doc, "CMS-1500 Claim Form");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Patient & Insurance Information", margin, y); y += lineH + 1;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`Patient: ${claimData.patientName}     DOB: ${claimData.dob}`, margin, y); y += lineH;
  doc.text(`Insurance: ${claimData.insurance}`, margin, y); y += lineH + 3;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Diagnosis Codes (ICD-10)", margin, y); y += lineH;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  claimData.diagnosisCodes.forEach((code, i) => {
    doc.text(`${i + 1}. ${code}`, margin + 5, y); y += lineH;
  });
  y += 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Procedure Codes (CPT)", margin, y); y += lineH;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  claimData.procedureCodes.forEach((code, i) => {
    doc.text(`${i + 1}. ${code}`, margin + 5, y); y += lineH;
  });
  y += 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Billing Summary", margin, y); y += lineH + 1;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`Total Charges: $${claimData.charges.toFixed(2)}`, margin, y); y += lineH;
  doc.text(`Claim Status: ${claimData.status}`, margin, y);

  addFooter(doc, 1);
  doc.save(`CMS1500_${claimData.patientName.replace(/\s+/g, "_")}.pdf`);
}

/**
 * Generate a Prior Authorization form PDF
 */
export function exportPAFormPDF(paData: {
  patientName: string;
  procedure: string;
  diagnosis: string;
  clinicalIndication: string;
  status: string;
}): void {
  const doc = new jsPDF();
  const margin = 14;
  let y = 40;
  const lineH = 5.5;

  addHeader(doc, "Prior Authorization Request Form");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Prior Authorization Details", margin, y); y += lineH + 1;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`Patient: ${paData.patientName}`, margin, y); y += lineH;
  doc.text(`Procedure: ${paData.procedure}`, margin, y); y += lineH;
  doc.text(`Diagnosis: ${paData.diagnosis}`, margin, y); y += lineH;
  doc.text(`Clinical Indication: ${paData.clinicalIndication || "N/A"}`, margin, y); y += lineH;

  y += 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Status", margin, y); y += lineH + 1;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(paData.status, margin, y);

  addFooter(doc, 1);
  doc.save(`PA_Form_${paData.patientName.replace(/\s+/g, "_")}.pdf`);
}

/**
 * Generate a completion certificate PDF
 */
export function exportCertificatePDF(certData: {
  studentName: string;
  completedModules: string[];
  score: number;
  date: string;
}): void {
  const doc = new jsPDF("landscape");
  const pageW = doc.internal.pageSize.width;
  const pageH = doc.internal.pageSize.height;

  // Gold border
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(3);
  doc.rect(8, 8, pageW - 16, pageH - 16);

  // Inner border
  doc.setDrawColor(180, 140, 40);
  doc.setLineWidth(1);
  doc.rect(14, 14, pageW - 28, pageH - 28);

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(212, 175, 55);
  doc.text("Certificate of Completion", pageW / 2, 40, { align: "center" });

  doc.setFontSize(12);
  doc.setTextColor(100, 100, 110);
  doc.text("Healthcare Hustlers EHR Simulation", pageW / 2, 52, { align: "center" });

  // Divider
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.5);
  doc.line(pageW * 0.2, 60, pageW * 0.8, 60);

  // Body
  doc.setFontSize(11);
  doc.setTextColor(80, 80, 90);
  doc.text("This certifies that", pageW / 2, 80, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(30, 30, 40);
  doc.text(certData.studentName, pageW / 2, 100, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 90);
  doc.text("has successfully completed the complete RCM pipeline", pageW / 2, 115, { align: "center" });

  // Modules
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Completed Modules:", pageW / 2, 135, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const moduleStr = certData.completedModules.join("  •  ");
  doc.text(moduleStr || "All 5 Stages", pageW / 2, 145, { align: "center" });

  // Score
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(212, 175, 55);
  doc.text(`Score: ${certData.score}%`, pageW / 2, 165, { align: "center" });

  // Date
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 110);
  doc.text(`Date: ${certData.date}`, pageW / 2, 185, { align: "center" });
  doc.text(`Certificate ID: HH-${Date.now().toString(36).toUpperCase()}`, pageW / 2, 195, { align: "center" });

  doc.save(`Certificate_${certData.studentName.replace(/\s+/g, "_")}.pdf`);
}
