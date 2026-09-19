/**
 * RoleSwitcher — Centered Dropdown for RCM Role Selection
 *
 * Renders in the dark navy header bar. Lets students switch
 * between all 5 RCM pipeline roles:
 *   Scribe, Coder, Biller, Prior Auth, AR Voice Specialist
 *
 * Uses `setRole()` from the pipeline store. Selected role
 * changes the workspace view.
 *
 * Inspiration: Epic Hyperspace role/task switcher
 */

import { useState, useEffect, useRef } from "react";
import { Users, ChevronDown } from "lucide-react";
import { usePipeline, type Role } from "../store/pipelineStore";

const ROLES: Role[] = ["scribe", "coder", "biller", "prior-auth", "ar-voice"];

export function RoleSwitcher() {
  const { currentRole, setRole, getRoleLabel } = usePipeline();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 transition-colors"
      >
        <Users className="h-4 w-4 text-blue-400" />
        <span>{getRoleLabel(currentRole)}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
          open ? "rotate-180" : ""
        }`} />
      </button>

      {open && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-52 rounded-xl border border-slate-700 bg-slate-800 py-1 shadow-xl z-50">
          {ROLES.map((role) => (
            <button
              key={role}
              onClick={() => {
                setRole(role);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium transition-colors ${
                currentRole === role
                  ? "bg-blue-600/20 text-blue-300"
                  : "text-slate-300 hover:bg-slate-700 hover:text-white"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${
                currentRole === role ? "bg-blue-400" : "bg-slate-500"
              }`} />
              {getRoleLabel(role)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}