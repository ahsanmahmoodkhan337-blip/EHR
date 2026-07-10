/**
 * Header — Global Application Header
 *
 * Inspiration: Epic Hyperspace header bar.
 * Epic's header features a dark navy/charcoal top bar with the
 * institution logo on the left, role/task switcher in the center,
 * and user/clinic context + search on the right.
 *
 * Zones:
 * - Left:   Logo + brand
 * - Center: RoleSwitcher dropdown
 * - Right:  Patient search + toggle + profile + logout
 */

import { useState, useEffect, useRef } from "react";
import { Building2, PanelRightClose, LogOut, Timer } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { GlobalPatientSearch } from "./GlobalPatientSearch";
import { getLoggedInPhone, logout } from "../../store/accessStore";
import { RoleSwitcher } from "../RoleSwitcher";
import { DarkModeToggle } from "../DarkModeToggle";
import { LeaderboardPanel } from "../LeaderboardPanel";

interface HeaderProps {
  businessName: string;
  selectedPatientId: string;
  onPatientSelect: (patientId: string) => void;
  showRightPanel: boolean;
  onToggleRightPanel: () => void;
  selectedPatientName?: string;
  examMode?: boolean;
  examTimeRemaining?: number;
  onToggleExamMode?: () => void;
}

export function Header({
  businessName,
  selectedPatientId,
  onPatientSelect,
  showRightPanel,
  onToggleRightPanel,
  selectedPatientName,
  examMode,
  examTimeRemaining,
  onToggleExamMode,
}: HeaderProps) {
  const loggedInPhone = getLoggedInPhone();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate({ to: "/login" });
  };

  // Format time remaining
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Exam mode warning colors
  const examUrgent = examTimeRemaining !== undefined && examTimeRemaining < 120;

  return (
    <header className="header-nav sticky top-0 z-30 flex items-center justify-between gap-4 px-4 py-2 shadow-lg">
      {/* ─── Left: Brand ─── */}
      <div className="flex items-center gap-3 shrink-0">
        <img
          src="/healthcarehustlers-logo.png"
          alt="Healthcare Hustlers"
          className="h-7 w-auto"
          style={{ maxWidth: "140px" }}
        />
      </div>

      {/* ─── Center: Role Switcher ─── */}
      <div className="flex-1 flex justify-center">
        <RoleSwitcher />
      </div>

      {/* ─── Right: Patient Search + Toggle + Profile + Logout ─── */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Global Patient Search (compact on right) */}
        <div className="hidden md:block w-48 lg:w-56">
          <GlobalPatientSearch
            selectedId={selectedPatientId}
            onSelect={onPatientSelect}
          />
        </div>

        {/* Right Panel Toggle */}
        <button
          onClick={onToggleRightPanel}
          className={`hidden rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors sm:flex items-center gap-1.5 ${
            showRightPanel
              ? "bg-sky-600 text-white hover:bg-sky-500"
              : "bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white"
          }`}
          aria-label={showRightPanel ? "Hide patient summary panel" : "Show patient summary panel"}
          title={showRightPanel ? "Hide summary panel" : "Show summary panel"}
        >
          <PanelRightClose className="h-4 w-4" />
          <span className="hidden lg:inline">Summary</span>
        </button>

        {/* Active patient indicator */}
        {selectedPatientName && (
          <div className="hidden items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 md:flex">
            <span className="h-2 w-2 rounded-full bg-green-400" />
            <span className="text-xs text-slate-300 truncate max-w-[120px]">
              {selectedPatientName}
            </span>
          </div>
        )}

        {/* Clinic widget */}
        <div className="hidden items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5 md:flex">
          <Building2 className="h-4 w-4 text-slate-400" />
          <div className="text-xs">
            <p className="font-medium text-slate-200">Main Clinic</p>
            <p className="text-[10px] text-slate-500">Internal Medicine</p>
          </div>
        </div>

        {/* User avatar */}
        <div className="group relative flex items-center gap-2 rounded-lg bg-slate-800 px-2 py-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500 text-xs font-bold text-white">
            DR
          </div>
          <div className="hidden text-xs lg:block">
            <p className="font-medium text-slate-200">Dr. Resident</p>
            <p className="text-[10px] text-slate-500">Teaching Clinic</p>
          </div>
        </div>

        {/* Leaderboard */}
        <LeaderboardPanel />

        {/* Exam Mode Toggle */}
        <button
          onClick={onToggleExamMode}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition-colors ${
            examMode
              ? examUrgent
                ? "bg-red-600 text-white animate-pulse"
                : "bg-amber-600 text-white"
              : "bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white"
          }`}
          title={examMode ? "Exit exam mode" : "Start exam mode (30 min)"}
        >
          <Timer className="h-3.5 w-3.5" />
          {examMode && examTimeRemaining !== undefined ? (
            <span className="font-mono font-bold">{formatTime(examTimeRemaining)}</span>
          ) : (
            <span className="hidden sm:inline">Exam</span>
          )}
        </button>

        {/* Dark Mode Toggle */}
        <DarkModeToggle />

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="rounded-lg bg-slate-800 p-1.5 text-slate-400 transition-colors hover:bg-red-900/50 hover:text-red-300"
          title="Logout"
          aria-label="Logout"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}