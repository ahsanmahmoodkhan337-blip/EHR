/**
 * AuditTrail — HIPAA Audit Trail
 *
 * Security audit table tracking user actions with filtering.
 * Pre-seeded with mock audit events.
 */

import { useState } from "react";
import { Shield, Filter, Download, X, Search } from "lucide-react";

// ─── Mock Audit Events ──────────────────────────────────────────────

interface AuditEvent {
  timestamp: string;
  userId: string;
  action: "View" | "Edit" | "Delete" | "Export" | "Login" | "Logout";
  patientMRN: string;
  ipAddress: string;
  details: string;
}

const MOCK_EVENTS: AuditEvent[] = [
  { timestamp: "2026-07-25T14:30:00Z", userId: "dr.smith", action: "Login", patientMRN: "—", ipAddress: "192.168.1.42", details: "User authenticated via SSO" },
  { timestamp: "2026-07-25T14:32:00Z", userId: "dr.smith", action: "View", patientMRN: "MRN-1001", ipAddress: "192.168.1.42", details: "Viewed patient chart" },
  { timestamp: "2026-07-25T14:35:00Z", userId: "dr.smith", action: "Edit", patientMRN: "MRN-1001", ipAddress: "192.168.1.42", details: "Updated SOAP note" },
  { timestamp: "2026-07-25T14:40:00Z", userId: "coder.jones", action: "Login", patientMRN: "—", ipAddress: "10.0.0.15", details: "User authenticated" },
  { timestamp: "2026-07-25T14:42:00Z", userId: "coder.jones", action: "View", patientMRN: "MRN-1001", ipAddress: "10.0.0.15", details: "Viewed coding queue" },
  { timestamp: "2026-07-25T14:45:00Z", userId: "coder.jones", action: "Edit", patientMRN: "MRN-1001", ipAddress: "10.0.0.15", details: "Added ICD-10 codes" },
  { timestamp: "2026-07-25T14:50:00Z", userId: "biller.lee", action: "Login", patientMRN: "—", ipAddress: "172.16.0.8", details: "User authenticated" },
  { timestamp: "2026-07-25T14:52:00Z", userId: "biller.lee", action: "View", patientMRN: "MRN-1001", ipAddress: "172.16.0.8", details: "Opened billing ledger" },
  { timestamp: "2026-07-25T14:55:00Z", userId: "biller.lee", action: "Export", patientMRN: "MRN-1001", ipAddress: "172.16.0.8", details: "Exported CMS-1500 PDF" },
  { timestamp: "2026-07-25T15:00:00Z", userId: "dr.nguyen", action: "Login", patientMRN: "—", ipAddress: "192.168.2.100", details: "User authenticated" },
  { timestamp: "2026-07-25T15:05:00Z", userId: "dr.nguyen", action: "View", patientMRN: "MRN-1005", ipAddress: "192.168.2.100", details: "Viewed patient chart" },
  { timestamp: "2026-07-25T15:10:00Z", userId: "dr.smith", action: "Delete", patientMRN: "MRN-1003", ipAddress: "192.168.1.42", details: "Archived old encounter" },
  { timestamp: "2026-07-25T15:12:00Z", userId: "dr.smith", action: "Logout", patientMRN: "—", ipAddress: "192.168.1.42", details: "Session ended" },
  { timestamp: "2026-07-25T15:15:00Z", userId: "admin", action: "Login", patientMRN: "—", ipAddress: "10.0.0.1", details: "Admin login" },
  { timestamp: "2026-07-25T15:20:00Z", userId: "admin", action: "View", patientMRN: "—", ipAddress: "10.0.0.1", details: "Viewed audit trail" },
];

// ─── Component ──────────────────────────────────────────────────────

export function AuditTrail() {
  const [showPanel, setShowPanel] = useState(false);
  const [events] = useState<AuditEvent[]>(MOCK_EVENTS);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = events.filter(e => {
    if (actionFilter !== "all" && e.action !== actionFilter) return false;
    if (search && !e.userId.toLowerCase().includes(search.toLowerCase()) && !e.patientMRN.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).slice(0, 50);

  const actionColor = (a: string) => {
    switch (a) {
      case "Login": return "bg-green-100 text-green-700";
      case "Logout": return "bg-slate-100 text-slate-700";
      case "View": return "bg-blue-100 text-blue-700";
      case "Edit": return "bg-amber-100 text-amber-700";
      case "Delete": return "bg-red-100 text-red-700";
      case "Export": return "bg-purple-100 text-purple-700";
      default: return "bg-slate-100";
    }
  };

  return (
    <div className="relative">
      <button onClick={() => setShowPanel(!showPanel)} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100">
        <Shield className="h-3.5 w-3.5" /> Audit Trail
      </button>
      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/20" onClick={() => setShowPanel(false)}>
          <div className="relative w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl p-5 animate-slide-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div><h3 className="text-sm font-bold text-slate-800">HIPAA Audit Trail</h3><p className="text-[9px] text-slate-400">{events.length} events</p></div>
              <div className="flex items-center gap-2">
                <button className="rounded-lg border px-2 py-1 text-[9px] text-slate-500"><Download className="h-3 w-3 inline mr-1" />Export</button>
                <button onClick={() => setShowPanel(false)} className="text-slate-400"><X className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search user or MRN..." className="w-full rounded-lg border border-slate-200 pl-7 pr-2 py-1.5 text-[10px] outline-none" />
              </div>
              <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] outline-none">
                <option value="all">All Actions</option>
                {["Login","Logout","View","Edit","Delete","Export"].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead><tr className="border-b border-slate-200 text-left text-slate-500"><th className="pb-2 pr-3">Time</th><th className="pb-2 pr-3">User</th><th className="pb-2 pr-3">Action</th><th className="pb-2 pr-3">Patient</th><th className="pb-2 pr-3">IP</th><th className="pb-2 pr-3">Details</th></tr></thead>
                <tbody>
                  {filtered.map((e, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-1.5 pr-3 text-slate-400 whitespace-nowrap">{new Date(e.timestamp).toLocaleString()}</td>
                      <td className="py-1.5 pr-3 font-medium text-slate-700">{e.userId}</td>
                      <td className="py-1.5 pr-3"><span className={`rounded px-1.5 py-0.5 text-[9px] ${actionColor(e.action)}`}>{e.action}</span></td>
                      <td className="py-1.5 pr-3 text-slate-500">{e.patientMRN}</td>
                      <td className="py-1.5 pr-3 text-slate-400 font-mono text-[9px]">{e.ipAddress}</td>
                      <td className="py-1.5 text-slate-500">{e.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
