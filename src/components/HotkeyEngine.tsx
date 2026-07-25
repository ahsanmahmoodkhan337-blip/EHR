/**
 * HotkeyEngine — Global Keyboard Shortcut Handler
 *
 * Alt+1-4 for roles, Alt+S to save SOAP note, Alt+C to scrub claims.
 * Register in root App component via useEffect.
 */

import { useEffect } from "react";
import { toast } from "sonner";

interface HotkeyEngineProps {
  onRoleSwitch?: (role: string) => void;
  onSaveSOAP?: () => void;
  onScrubClaims?: () => void;
}

export function HotkeyEngine({ onRoleSwitch, onSaveSOAP, onScrubClaims }: HotkeyEngineProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      switch (e.key) {
        case "1": e.preventDefault(); onRoleSwitch?.("scribe"); toast.info("Role: Scribe"); break;
        case "2": e.preventDefault(); onRoleSwitch?.("coder"); toast.info("Role: Coder"); break;
        case "3": e.preventDefault(); onRoleSwitch?.("prior-auth"); toast.info("Role: Prior Auth"); break;
        case "4": e.preventDefault(); onRoleSwitch?.("ar-voice"); toast.info("Role: AR Voice"); break;
        case "s": case "S": e.preventDefault(); onSaveSOAP?.(); toast.success("SOAP Note Synced"); break;
        case "c": case "C": e.preventDefault(); onScrubClaims?.(); toast.info("Claim Scrubber Run"); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onRoleSwitch, onSaveSOAP, onScrubClaims]);

  return (
    <div className="fixed bottom-2 right-4 z-30">
      <span className="rounded-lg bg-slate-800/90 px-2 py-1 text-[9px] text-slate-300">
        ⌨️ Alt+1-4 roles · Alt+S save · Alt+C scrub
      </span>
    </div>
  );
}
