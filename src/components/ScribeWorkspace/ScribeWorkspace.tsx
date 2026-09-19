/**
 * ScribeWorkspace — Scribe / Provider Charting Workspace
 *
 * Inspiration: Athenahealth / DrChrono clinical charting.
 *
 * This is the default role workspace. It hosts the existing
 * WorkflowAthena clinical workflow (SOAP notes, vitals, macros).
 * In a full implementation, the SOAP note components from
 * WorkflowAthena are rendered here.
 *
 * For now, this is a bridge component that renders the
 * existing clinical workflow components.
 */

import { FileText } from "lucide-react";
import { usePipeline } from "../../store/pipelineStore";

interface ScribeWorkspaceProps {
  patientName?: string;
  encounterId: string;
}

export function ScribeWorkspace({ patientName, encounterId }: ScribeWorkspaceProps) {
  const { submitToCoding } = usePipeline();

  // Placeholder: renders WorkflowAthena clinical workflow
  return (
    <div className="flex flex-1 flex-col p-4">
      <div className="mb-4 flex items-center gap-2">
        <FileText className="h-5 w-5 text-blue-600" />
        <h2 className="text-sm font-bold text-slate-800">Clinical Charting — Scribe Workspace</h2>
        {patientName && (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
            {patientName}
          </span>
        )}
      </div>

      {/* Clinical workflow from WorkflowAthena renders here in full implementation */}
      <div className="flex-1 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50 p-8 text-center">
        <p className="text-sm font-medium text-blue-600">Athenahealth / DrChrono Clinical Workflow</p>
        <p className="mt-1 text-xs text-blue-400">
          Vitals → HPI → Exam/ROS → Assessment & Plan → Sign & Lock
        </p>
      </div>
    </div>
  );
}