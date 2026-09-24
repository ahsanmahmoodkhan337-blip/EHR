/**
 * GlobalPatientSearch — Searchable Patient Selector
 *
 * Inspiration: Epic Hyperspace patient search / quick lookup.
 * Epic's global search bar lets clinicians find any patient by
 * name, MRN, or DOB across the entire health system. This
 * component replicates that pattern as a live-filtering dropdown
 * in the header, allowing instant patient switching.
 *
 * Features:
 * - Live search-as-you-type filtering
 * - Matches on first name, last name, MRN, and chief complaint
 * - Results in a scrollable dropdown with patient initials avatars
 * - Keyboard accessible (Enter/Space to select, Escape to close)
 * - Closes on blur/click-outside
 */

import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, X } from "lucide-react";
import { usePatientStore } from "../../store/patientStore";

interface GlobalPatientSearchProps {
  selectedId: string;
  onSelect: (patientId: string) => void;
  className?: string;
}

export function GlobalPatientSearch({
  selectedId,
  onSelect,
  className = "",
}: GlobalPatientSearchProps) {
  const { patients } = usePatientStore();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = patients.find((p) => p.id === selectedId);

  // Filter patients based on search query
  const filtered = query.trim()
    ? patients.filter((p) => {
        const q = query.toLowerCase();
        return (
          p.firstName.toLowerCase().includes(q) ||
          p.lastName.toLowerCase().includes(q) ||
          p.mrn.toLowerCase().includes(q) ||
          p.chiefComplaint.toLowerCase().includes(q) ||
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(q)
        );
      })
    : patients;

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen]);

  function handleSelect(patientId: string) {
    onSelect(patientId);
    setQuery("");
    setIsOpen(false);
  }

  function handleOpen() {
    setIsOpen(true);
    // Focus the input on next tick
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger / Search Input */}
      <div
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors cursor-text ${
          isOpen
            ? "border-blue-400 bg-blue-900/30 ring-1 ring-blue-400/50"
            : "border-slate-600 bg-slate-800 hover:border-slate-500"
        }`}
        onClick={handleOpen}
      >
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        {isOpen ? (
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search patients by name, MRN, or complaint..."
            className="min-w-0 flex-1 bg-transparent text-white placeholder-slate-400 outline-none"
            autoFocus
          />
        ) : (
          <span className="flex-1 truncate text-slate-300">
            {selected
              ? `${selected.lastName}, ${selected.firstName} (${selected.mrn})`
              : "Search patients..."}
          </span>
        )}
        {isOpen ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setQuery("");
              setIsOpen(false);
            }}
            className="shrink-0 rounded p-0.5 text-slate-400 hover:text-white transition-colors"
            aria-label="Close search"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-slate-600 bg-white shadow-2xl">
          {/* Results count */}
          <div className="border-b border-slate-100 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-400">
            {filtered.length} patient{filtered.length !== 1 ? "s" : ""} found
          </div>

          {/* Results list */}
          <div className="search-dropdown">
            {filtered.length > 0 ? (
              filtered.map((p) => {
                const isSelected = p.id === selectedId;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleSelect(p.id)}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-blue-50 ${
                      isSelected ? "bg-blue-50" : ""
                    }`}
                  >
                    {/* Avatar initials */}
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        isSelected
                          ? "bg-blue-600 text-white"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {p.firstName[0]}
                      {p.lastName[0]}
                    </div>

                    {/* Patient info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">
                          {p.lastName}, {p.firstName}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          MRN: {p.mrn}
                        </span>
                      </div>
                      <p className="truncate text-xs text-slate-500">
                        {p.gender} | {p.age} yrs | {p.chiefComplaint}
                      </p>
                    </div>

                    {/* Quick vitals indicator */}
                    <div className="hidden shrink-0 text-right text-[10px] text-slate-400 sm:block">
                      <div>{p.vitals.bloodPressure}</div>
                      <div>{p.vitals.heartRate} bpm</div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-6 text-center text-sm text-slate-400">
                No patients match "{query}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}