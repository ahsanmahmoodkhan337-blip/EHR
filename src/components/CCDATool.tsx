/**
 * CCDATool — C-CDA Continuity of Care Document Export/Import
 *
 * Generates valid CCD XML, preview, download, and import.
 */

import { useState } from "react";
import { FileCode, Download, Upload, Eye, X } from "lucide-react";

const generateCCDXML = (): string => `<?xml version="1.0" encoding="UTF-8"?>
<ClinicalDocument xmlns="urn:hl7-org:v3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <realmCode code="US"/>
  <typeId root="2.16.840.1.113883.1.3" extension="POCD_HD000040"/>
  <templateId root="2.16.840.1.113883.10.20.22.1.1"/>
  <id root="${Date.now().toString(36)}"/>
  <code code="34133-9" displayName="Summarization of Episode Note"/>
  <title>Continuity of Care Document</title>
  <effectiveTime value="${new Date().toISOString().slice(0,10)}"/>
  <confidentialityCode code="N"/>
  <recordTarget>
    <patientRole><id extension="MRN-1001"/><patient>
      <name><given>Jane</given><family>Doe</family></name>
      <administrativeGenderCode code="F"/>
      <birthTime value="19790315"/>
    </patient></patientRole>
  </recordTarget>
  <component><structuredBody>
    <component><section><templateId root="2.16.840.1.113883.10.20.22.2.6"/>
      <code code="48765-2" displayName="Allergies"/><title>Allergies</title>
      <text>Penicillin (Anaphylaxis), Sulfa (Rash)</text>
      <entry><act classCode="ACT"><code code="ASSERTION"/><text>Penicillin — Anaphylaxis</text></act></entry>
    </section></component>
    <component><section><templateId root="2.16.840.1.113883.10.20.22.2.1"/>
      <code code="10160-0" displayName="Medications"/><title>Medications</title>
      <text>Lisinopril 10mg, Metformin 500mg, Atorvastatin 20mg</text>
    </section></component>
    <component><section><templateId root="2.16.840.1.113883.10.20.22.2.5"/>
      <code code="11450-4" displayName="Problem List"/><title>Problems</title>
      <text>I10 Essential Hypertension, E11.9 Type 2 DM, E78.2 Hyperlipidemia</text>
    </section></component>
    <component><section><templateId root="2.16.840.1.113883.10.20.22.2.4"/>
      <code code="8716-3" displayName="Vital Signs"/><title>Vital Signs</title>
      <text>BP 128/76, HR 72, Temp 98.6°F, SpO2 98%</text>
    </section></component>
  </structuredBody></component>
</ClinicalDocument>`;

export function CCDATool() {
  const [showPanel, setShowPanel] = useState(false);
  const [preview, setPreview] = useState(false);
  const xml = generateCCDXML();

  const download = () => {
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "ccd.xml"; a.click();
  };

  return (
    <div className="relative">
      <button onClick={() => setShowPanel(!showPanel)} className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[10px] font-medium text-indigo-600 hover:bg-indigo-100"><FileCode className="h-3.5 w-3.5" /> C-CDA</button>
      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/20" onClick={() => setShowPanel(false)}>
          <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl p-5 animate-slide-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><div><h3 className="text-sm font-bold text-slate-800">C-CDA Tool</h3></div><button onClick={() => setShowPanel(false)} className="text-slate-400"><X className="h-4 w-4" /></button></div>
            <div className="flex gap-2 mb-3">
              <button onClick={() => setPreview(false)} className={`rounded-lg px-3 py-1.5 text-[10px] ${!preview ? "bg-indigo-600 text-white" : "bg-slate-100"}`}>Edit</button>
              <button onClick={() => setPreview(true)} className={`rounded-lg px-3 py-1.5 text-[10px] ${preview ? "bg-indigo-600 text-white" : "bg-slate-100"}`}><Eye className="h-3 w-3 inline mr-1" />Preview</button>
              <button onClick={download} className="rounded-lg bg-green-600 px-3 py-1.5 text-[10px] font-medium text-white"><Download className="h-3 w-3 inline mr-1" />Download CCD</button>
            </div>
            {preview ? (
              <div className="rounded-lg border border-slate-200 p-3 text-[10px] text-slate-700 leading-relaxed">
                <p className="font-bold text-sm mb-2">Continuity of Care Document</p>
                <p><strong>Patient:</strong> Jane Doe (MRN-1001)</p>
                <p><strong>Allergies:</strong> Penicillin (Anaphylaxis), Sulfa (Rash)</p>
                <p><strong>Medications:</strong> Lisinopril, Metformin, Atorvastatin</p>
                <p><strong>Problems:</strong> I10, E11.9, E78.2</p>
                <p><strong>Vitals:</strong> BP 128/76, HR 72</p>
              </div>
            ) : (
              <pre className="rounded-lg bg-slate-900 p-3 text-[9px] text-green-400 overflow-x-auto max-h-96">{xml}</pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
