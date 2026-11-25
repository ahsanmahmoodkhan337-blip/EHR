/**
 * GlobalPatientSearch — the one patient finder in the shell's top bar.
 *
 * Inspiration: Epic Hyperspace's patient search (type any identifier, pick a
 * row from a result grid) laid out the way athenaOne and eClinicalWorks print
 * a patient lookup — a real table with one column per identifier, not an
 * overlapping dropdown of free text.
 *
 * Searches by name, date of birth, MRN and insurance member ID (spec
 * `task-1-app-shell.md` item 3). The result list is a `<table>` whose rows are
 * the keyboard cursor: Arrow Down / Arrow Up move the highlight, Enter opens
 * the highlighted patient, Escape closes the panel, and every row is a real
 * option so a screen reader announces the name, DOB, MRN, phone and payer.
 *
 * Widths: the table never forces the page sideways. Name, DOB and MRN always
 * show; phone and insurance appear from `sm` up, where there is room for them.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { usePatientStore, type Patient } from "../../store/patientStore";
import { studentPatientList } from "../../domain/inbox";

interface GlobalPatientSearchProps {
  /** Patient currently open, shown as a hint on the closed trigger. */
  selectedId?: string;
  onSelect: (patientId: string) => void;
  className?: string;
}

const MAX_RESULTS = 25;

/** `1979-03-15` → `03/15/1979`. Unparseable dates are shown as typed. */
function formatDob(raw: string): string {
  const value = (raw || "").trim();
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

function memberIdOf(patient: Patient): string {
  return (
    patient.insuranceRecord?.primary?.subscriberId ||
    patient.insuranceRecord?.secondary?.subscriberId ||
    ""
  );
}

function payerOf(patient: Patient): string {
  return patient.insuranceRecord?.primary?.payerName || patient.insurance || "No coverage on file";
}

/** Every identifier the search box accepts for one patient, lower-cased. */
function haystack(patient: Patient): string {
  const dob = (patient.dateOfBirth || "").trim();
  return [
    patient.firstName,
    patient.lastName,
    `${patient.firstName} ${patient.lastName}`,
    `${patient.lastName}, ${patient.firstName}`,
    patient.mrn,
    dob,
    formatDob(dob),
    memberIdOf(patient),
  ]
    .join(" ")
    .toLowerCase();
}

export function GlobalPatientSearch({ selectedId, onSelect, className = "" }: GlobalPatientSearchProps) {
  const { patients } = usePatientStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLTableElement>(null);

  const selected = patients.find((p) => p.id === selectedId);

  // Only the student's own charts (plus the pinned Tutorial Patient) are
  // searchable here — the 18 demo charts are teaching material and live in
  // Practice Cases (`specs/slice-inbox-patients.md`). The lookup above still
  // sees every chart, so an open demo chart still names itself.
  const searchable = useMemo(() => studentPatientList(patients), [patients]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return searchable.slice(0, MAX_RESULTS);
    return searchable.filter((p) => haystack(p).includes(q)).slice(0, MAX_RESULTS);
  }, [searchable, query]);

  const totalMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return searchable.length;
    return searchable.filter((p) => haystack(p).includes(q)).length;
  }, [searchable, query]);

  // Reset the cursor whenever the result set changes.
  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    if (!open) return;
    const row = listRef.current?.querySelector<HTMLElement>(`[data-row-index="${activeIndex}"]`);
    row?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  // "/" jumps to the patient search from anywhere on the page (spec
  // `task-1-app-shell.md` item 8). It stays out of the way of a student who is
  // typing into a field, where "/" is just a slash.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "/" || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = document.activeElement as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;
      event.preventDefault();
      setOpen(true);
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function openPanel() {
    setOpen(true);
    setQuery("");
    setActiveIndex(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function closePanel() {
    setOpen(false);
    setQuery("");
  }

  function choose(patient: Patient) {
    onSelect(patient.id);
    closePanel();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(matches.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(Math.max(matches.length - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const patient = matches[activeIndex];
      if (patient) choose(patient);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closePanel();
      return;
    }
    if (event.key === "Tab") {
      closePanel();
    }
  }

  return (
    <div ref={containerRef} className={`relative min-w-0 ${className}`}>
      {!open ? (
        <button
          type="button"
          onClick={openPanel}
          aria-label="Search patients by name, date of birth, MRN or member ID"
          title="Search patients by name, DOB, MRN or member ID"
          className="flex min-h-10 w-full items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-left text-xs text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <span className="min-w-0 truncate">
            {selected ? `${selected.lastName}, ${selected.firstName} — ${selected.mrn}` : "Search patients…"}
          </span>
        </button>
      ) : (
        <div className="flex min-h-10 items-center gap-2 rounded-lg border border-brand-400 bg-white px-3 ring-1 ring-brand-400/40 dark:border-brand-500 dark:bg-slate-800">
          <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Search patients by name, date of birth, MRN or member ID"
            aria-describedby="patient-search-hint"
            placeholder="Name, DOB, MRN or member ID"
            autoComplete="off"
            className="min-h-9 min-w-0 flex-1 bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400 dark:text-white"
          />
          <button
            type="button"
            onClick={closePanel}
            aria-label="Close patient search"
            title="Close patient search"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
          <div className="max-h-[60vh] overflow-y-auto overflow-x-hidden">
            <table ref={listRef} className="w-full table-fixed border-collapse text-left text-xs">
              <caption className="sr-only">
                Patient search results — {matches.length} of {totalMatches} shown. Use the up and down
                arrows to move, Enter to open.
              </caption>
              <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th scope="col" className="w-[38%] px-2 py-1.5 font-semibold sm:w-[30%]">
                    Name
                  </th>
                  <th scope="col" className="w-[28%] px-2 py-1.5 font-semibold sm:w-[16%]">
                    DOB
                  </th>
                  <th scope="col" className="w-[34%] px-2 py-1.5 font-semibold sm:w-[18%]">
                    MRN
                  </th>
                  <th scope="col" className="hidden px-2 py-1.5 font-semibold sm:table-cell sm:w-[18%]">
                    Phone
                  </th>
                  <th scope="col" className="hidden px-2 py-1.5 font-semibold sm:table-cell sm:w-[18%]">
                    Insurance
                  </th>
                </tr>
              </thead>
              <tbody id="patient-search-results">
                {matches.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-center text-slate-500 dark:text-slate-400">
                      No patient matches “{query}”. Try a name, date of birth, MRN or member ID.
                    </td>
                  </tr>
                )}
                {matches.map((patient, index) => {
                  const isActive = index === activeIndex;
                  return (
                    <tr
                      key={patient.id}
                      id={`patient-search-row-${index}`}
                      data-row-index={index}
                      aria-current={isActive ? "true" : undefined}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={`border-t border-slate-100 dark:border-slate-700 ${
                        isActive
                          ? "bg-brand-50 dark:bg-brand-900/40"
                          : "bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700"
                      }`}
                    >
                      <td className="px-2 py-0.5">
                        <button
                          type="button"
                          onClick={() => choose(patient)}
                          aria-label={`Open chart for ${patient.firstName} ${patient.lastName}, MRN ${patient.mrn}, date of birth ${formatDob(patient.dateOfBirth)}`}
                          className="flex min-h-10 w-full min-w-0 items-center truncate rounded text-left font-medium text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:text-white"
                        >
                          <span className="truncate">
                            {patient.lastName}, {patient.firstName}
                          </span>
                        </button>
                      </td>
                      <td className="truncate px-2 py-2 text-slate-600 dark:text-slate-300">
                        {formatDob(patient.dateOfBirth)}
                      </td>
                      <td className="truncate px-2 py-2 text-slate-600 dark:text-slate-300">{patient.mrn}</td>
                      <td className="hidden truncate px-2 py-2 text-slate-600 sm:table-cell dark:text-slate-300">
                        {patient.phone || "—"}
                      </td>
                      <td className="hidden truncate px-2 py-2 text-slate-600 sm:table-cell dark:text-slate-300">
                        {payerOf(patient)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p
            id="patient-search-hint"
            role="status"
            className="border-t border-slate-100 px-3 py-1.5 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400"
          >
            {totalMatches > matches.length
              ? `Showing ${matches.length} of ${totalMatches} matches — keep typing to narrow it.`
              : `${matches.length} patient${matches.length === 1 ? "" : "s"} · ↑ ↓ to move · Enter to open · Esc to close`}
          </p>
        </div>
      )}
    </div>
  );
}
