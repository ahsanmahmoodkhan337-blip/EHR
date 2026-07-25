/**
 * CommandPalette — Cmd+K command palette for EHR navigation
 *
 * Opens with Cmd+K (Mac) or Ctrl+K (Windows/Linux).
 * Sections: Navigate (to workspace sections), Actions (switch roles,
 * load demos), and Patient Search (by name or MRN).
 *
 * Uses cmdk + Zustand for state.
 */

import { useEffect, useState } from "react";
import { Command } from "cmdk";
import {
  Search,
  Layout,
  FileText,
  Stethoscope,
  FileCode,
  Shield,
  Receipt,
  Phone,
  BarChart3,
  ArrowRight,
  RefreshCw,
  User,
  Users,
  Zap,
} from "lucide-react";
import { useAppStore, type Role } from "../stores/appStore";
import { usePatientStore } from "../store/patientStore";

// ─── Props ──────────────────────────────────────────────────────────

interface CommandPaletteProps {
  onSelectRole?: (role: Role) => void;
  onSelectPatient?: (patientId: string) => void;
}

// ─── Component ──────────────────────────────────────────────────────

export function CommandPalette({ onSelectRole, onSelectPatient }: CommandPaletteProps) {
  const open = useAppStore((s) => s.ui.commandPaletteOpen);
  const setOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const patients = usePatientStore((s) => s.patients);
  const [query, setQuery] = useState("");

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(!open);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, setOpen]);

  const handleSelectRole = (role: Role) => {
    setOpen(false);
    onSelectRole?.(role);
    useAppStore.getState().setRole(role);
  };

  const handleSelectPatient = (id: string) => {
    setOpen(false);
    onSelectPatient?.(id);
  };

  const resetAll = () => {
    setOpen(false);
    window.location.reload();
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command Palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder="Search patients, switch roles, navigate modules..."
            className="flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200 dark:placeholder:text-slate-500"
            autoFocus
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 dark:border-slate-600 dark:bg-slate-700">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>

        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="py-8 text-center text-xs text-slate-400">
            No results found.
          </Command.Empty>

          {/* ── Patient Search ── */}
          {query && (
            <Command.Group heading="Patients" className="mb-2">
              {patients
                .filter(
                  (p) =>
                    `${p.firstName} ${p.lastName}`.toLowerCase().includes(query.toLowerCase()) ||
                    p.mrn.includes(query)
                )
                .slice(0, 8)
                .map((p) => (
                  <Command.Item
                    key={p.id}
                    value={`patient-${p.id}-${p.firstName}-${p.lastName}-${p.mrn}`}
                    onSelect={() => handleSelectPatient(p.id)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-600 data-[selected=true]:bg-slate-100 dark:text-slate-300 dark:data-[selected=true]:bg-slate-700 cursor-pointer"
                  >
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      {p.firstName} {p.lastName}
                    </span>
                    <span className="ml-auto text-[10px] text-slate-400">
                      {p.mrn}
                    </span>
                  </Command.Item>
                ))}
            </Command.Group>
          )}

          {/* ── Navigate ── */}
          <Command.Group heading="Navigate" className="mb-2">
            {[
              { label: "Front Desk / Registration", icon: Layout, action: "registration" },
              { label: "Clinical EHR / Scribe", icon: Stethoscope, action: "clinical" },
              { label: "Coding Station", icon: FileCode, action: "coding" },
              { label: "Prior Authorization", icon: Shield, action: "prior-auth" },
              { label: "Billing / CMS-1500", icon: Receipt, action: "billing" },
              { label: "AR & ERA Posting", icon: Phone, action: "ar" },
              { label: "Analytics Dashboard", icon: BarChart3, action: "analytics" },
            ].map((item) => (
              <Command.Item
                key={item.action}
                value={`nav-${item.label}`}
                onSelect={() => {
                  setOpen(false);
                  if (item.action === "scribe" || item.action === "clinical") handleSelectRole("scribe");
                  else if (item.action === "coder" || item.action === "coding") handleSelectRole("coder");
                  else if (item.action === "biller" || item.action === "billing") handleSelectRole("biller");
                  else if (item.action === "prior-auth") handleSelectRole("prior-auth");
                  else if (item.action === "ar") handleSelectRole("ar-voice");
                }}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-600 data-[selected=true]:bg-slate-100 dark:text-slate-300 dark:data-[selected=true]:bg-slate-700 cursor-pointer"
              >
                <item.icon className="h-3.5 w-3.5 text-slate-400" />
                {item.label}
                <ArrowRight className="ml-auto h-3 w-3 text-slate-300" />
              </Command.Item>
            ))}
          </Command.Group>

          {/* ── Actions ── */}
          <Command.Group heading="Actions" className="mb-2">
            {([
              { label: "Switch Role to Physician/Scribe", icon: Stethoscope, role: "scribe" as Role },
              { label: "Switch Role to Coder", icon: FileCode, role: "coder" as Role },
              { label: "Switch Role to Biller", icon: Receipt, role: "biller" as Role },
              { label: "Switch Role to Prior Auth", icon: Shield, role: "prior-auth" as Role },
              { label: "Switch Role to AR Voice", icon: Phone, role: "ar-voice" as Role },
            ] as const).map((item) => (
              <Command.Item
                key={item.role}
                value={`action-${item.label}`}
                onSelect={() => handleSelectRole(item.role)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-600 data-[selected=true]:bg-slate-100 dark:text-slate-300 dark:data-[selected=true]:bg-slate-700 cursor-pointer"
              >
                <item.icon className="h-3.5 w-3.5 text-indigo-400" />
                {item.label}
              </Command.Item>
            ))}
          </Command.Group>

          {/* ── Utilities ── */}
          <Command.Group heading="Utilities" className="mb-2">
            <Command.Item
              value="utility-reset"
              onSelect={resetAll}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-600 data-[selected=true]:bg-slate-100 dark:text-slate-300 dark:data-[selected=true]:bg-slate-700 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5 text-red-400" />
              Reset Sandbox
            </Command.Item>
            <Command.Item
              value="utility-demo"
              onSelect={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-600 data-[selected=true]:bg-slate-100 dark:text-slate-300 dark:data-[selected=true]:bg-slate-700 cursor-pointer"
            >
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              Load Demo Scenario
            </Command.Item>
          </Command.Group>
        </Command.List>

        {/* Footer */}
        <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-2">
          <div className="flex items-center gap-4 text-[10px] text-slate-400">
            <span>
              <kbd className="rounded bg-slate-100 px-1 dark:bg-slate-700">↑↓</kbd> Navigate
            </span>
            <span>
              <kbd className="rounded bg-slate-100 px-1 dark:bg-slate-700">↵</kbd> Select
            </span>
            <span>
              <kbd className="rounded bg-slate-100 px-1 dark:bg-slate-700">Esc</kbd> Close
            </span>
          </div>
        </div>
      </div>
    </Command.Dialog>
  );
}
