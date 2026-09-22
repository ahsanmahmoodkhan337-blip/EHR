/**
 * StagePinGate — PIN Entry Modal for Stage Access
 *
 * Renders a modal overlay when a student tries to access a locked
 * RCM stage. The student must enter the correct 4-digit PIN to
 * unlock the stage workspace.
 *
 * Inspiration: Epic Hyperspace security gates / two-factor prompts
 */

import { useState } from "react";
import { Lock, Key, AlertCircle } from "lucide-react";
import { verifyStagePin, isStageUnlocked } from "../store/pinStore";
import { type Role } from "../store/pipelineStore";

interface StagePinGateProps {
  role: Role;
  roleLabel: string;
  children: React.ReactNode;
}

export function StagePinGate({ role, roleLabel, children }: StagePinGateProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [unlocked, setUnlocked] = useState(isStageUnlocked(role));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (pin.length < 4) {
      setError("PIN must be 4 digits");
      return;
    }

    if (verifyStagePin(role, pin)) {
      setUnlocked(true);
      setPin("");
    } else {
      setError("Incorrect PIN. Please try again.");
      setPin("");
    }
  };

  // If already unlocked, render children directly
  if (unlocked) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
        {/* Lock icon */}
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100">
          <Lock className="h-7 w-7 text-amber-600" />
        </div>

        {/* Title */}
        <h2 className="text-center text-lg font-bold text-slate-800">
          Stage Locked
        </h2>
        <p className="mt-1 text-center text-xs text-slate-500">
          Enter the PIN to access the <strong>{roleLabel}</strong> workspace
        </p>

        {/* PIN form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Stage PIN
            </label>
            <div className="relative">
              <Key className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setError("");
                }}
                placeholder="Enter 4-digit PIN"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 pl-10 text-center text-lg font-mono tracking-widest text-slate-700 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                autoFocus
              />
            </div>
            {error && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-red-500">
                <AlertCircle className="h-3.5 w-3.5" />
                {error}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={pin.length < 4}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:bg-slate-300"
          >
            <Key className="h-4 w-4" />
            Unlock Stage
          </button>
        </form>

        {/* Hint */}
        <p className="mt-4 text-center text-[10px] text-slate-400">
          Ask your instructor or admin for the stage PIN
        </p>
      </div>
    </div>
  );
}