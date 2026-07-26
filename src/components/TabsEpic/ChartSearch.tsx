/**
 * ChartSearch — In-Chart Search Bar
 *
 * Inspiration: Epic Hyperspace chart search / "Find in Chart" feature.
 * Epic provides a dedicated search bar within a patient's chart that
 * lets clinicians quickly find specific notes, labs, meds, or problems
 * without scrolling through all tabs. This component replicates that
 * as a compact search bar positioned near the Epic tab navigation.
 *
 * Features:
 * - Compact design (fits alongside the tab bar)
 * - Searches the active patient's encounters, medications, labs, problems, allergies
 * - Results shown as a dropdown overlay
 * - Keyboard accessible
 */

import { useState, useRef, useEffect } from "react";
import { Search, FileText, Beaker, Pill, AlertTriangle, Stethoscope, X } from "lucide-react";
import { usePatientStore, type Patient } from "../../store/patientStore";

interface ChartSearchProps {
  patientId: string;
  className?: string;
}

interface SearchResult {
  id: string;
  type: "note" | "lab" | "medication" | "allergy" | "problem";
  label: string;
  detail: string;
  icon: React.ReactNode;
  tabId: string; // which tab to navigate to
}

export function ChartSearch({ patientId, className = "" }: ChartSearchProps) {
  const { getPatientById } = usePatientStore();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const patient = getPatientById(patientId);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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

  // Perform search when query changes
  useEffect(() => {
    if (!patient || !query.trim()) {
      setResults([]);
      return;
    }

    const q = query.toLowerCase();
    const found: SearchResult[] = [];

    // Search encounters / notes
    (patient.encounters || []).forEach((enc) => {
      if (
        enc.notes.toLowerCase().includes(q) ||
        enc.diagnosis.toLowerCase().includes(q) ||
        enc.type.toLowerCase().includes(q)
      ) {
        found.push({
          id: `enc-${enc.id}`,
          type: "note",
          label: enc.type,
          detail: enc.diagnosis.slice(0, 80),
          icon: <FileText className="h-3.5 w-3.5" />,
          tabId: "notes",
        });
      }
    });

    // Search medications
    patient.medications.forEach((med) => {
      if (med.name.toLowerCase().includes(q) || med.dosage.toLowerCase().includes(q)) {
        found.push({
          id: `med-${med.id}`,
          type: "medication",
          label: `${med.name} ${med.dosage}`,
          detail: `${med.frequency} — ${med.status}`,
          icon: <Pill className="h-3.5 w-3.5" />,
          tabId: "medications",
        });
      }
    });

    // Search labs
    (patient.labResults || []).forEach((lab) => {
      if (lab.testName.toLowerCase().includes(q) || lab.value.toLowerCase().includes(q)) {
        found.push({
          id: `lab-${lab.id}`,
          type: "lab",
          label: lab.testName,
          detail: `${lab.value} ${lab.unit} (${lab.status})`,
          icon: <Beaker className="h-3.5 w-3.5" />,
          tabId: "labs",
        });
      }
    });

    // Search allergies
    (patient.allergies || []).forEach((alg) => {
      if (alg.allergen.toLowerCase().includes(q) || alg.reaction.toLowerCase().includes(q)) {
        found.push({
          id: `alg-${alg.id}`,
          type: "allergy",
          label: alg.allergen,
          detail: `${alg.severity} — ${alg.reaction.slice(0, 60)}`,
          icon: <AlertTriangle className="h-3.5 w-3.5" />,
          tabId: "medications",
        });
      }
    });

    // Search problems
    patient.problems.forEach((prob, i) => {
      if (prob.toLowerCase().includes(q)) {
        found.push({
          id: `prob-${i}`,
          type: "problem",
          label: prob,
          detail: "Active problem",
          icon: <Stethoscope className="h-3.5 w-3.5" />,
          tabId: "problems",
        });
      }
    });

    // Limit results
    setResults(found.slice(0, 8));
  }, [query, patient]);

  // We'd ideally navigate to the tab, but for now we just show results
  // The tab navigation integration will be added in a future iteration

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.trim()) setIsOpen(true);
          }}
          onFocus={() => {
            if (query.trim()) setIsOpen(true);
          }}
          placeholder="Search this chart..."
          className="w-48 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-7 text-xs text-slate-700 placeholder-slate-400 outline-none transition-colors focus:border-blue-400 focus:bg-white focus:ring-1 focus:ring-blue-400"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute right-1.5 rounded p-0.5 text-slate-400 hover:text-slate-600"
            aria-label="Clear search"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
            Chart results ({results.length})
          </div>
          <div className="max-h-64 overflow-y-auto">
            {results.map((result) => (
              <button
                key={result.id}
                onClick={() => {
                  setIsOpen(false);
                  setQuery("");
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-blue-50"
              >
                <span className="shrink-0 text-slate-400">{result.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-700">
                    {result.label}
                  </p>
                  <p className="truncate text-[10px] text-slate-400">
                    {result.detail}
                  </p>
                </div>
                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium capitalize text-slate-500">
                  {result.type}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No results message */}
      {isOpen && query.trim() && results.length === 0 && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="px-3 py-4 text-center text-xs text-slate-400">
            No results found for "{query}"
          </div>
        </div>
      )}
    </div>
  );
}