/**
 * DotPhraseTextarea — dot-phrase / smart-phrase autocomplete textarea
 *
 * Inspiration: Epic's SmartPhrases, eClinicalWorks' dot phrases, and
 * DrChrono's "Smart Phrases" panel. Typing a leading "." in the field opens a
 * filtered suggestion list of `DOT_PHRASES` (matched on shortcode + label,
 * optionally scoped/sorted by note section). Tab or Enter expands the shortcode
 * at the cursor; Arrow keys navigate the list; Escape dismisses it.
 *
 * The expansion is inserted at the cursor and the caret jumps to the first
 * bracketed `[placeholder]` when the phrase has one (e.g. ".hpi"), otherwise to
 * just past the inserted text. Data comes from `src/data/medical/scribeTemplates`.
 */

import { useMemo, useRef, useState } from "react";
import { DOT_PHRASES, type DotPhrase, type NoteSection } from "../../data/medical";

export interface DotPhraseTextareaProps {
  value: string;
  onChange: (value: string) => void;
  /** Scope / prioritise suggestions to one or more note sections. */
  section?: NoteSection | NoteSection[];
  placeholder?: string;
  className?: string;
  rows?: number;
  id?: string;
  name?: string;
  disabled?: boolean;
  /** Optional footer hint text in the suggestion dropdown. */
  hint?: string;
}

const DEFAULT_HINT = "Tab / Enter to expand · Arrow keys to navigate · Esc to dismiss";

export function DotPhraseTextarea({
  value,
  onChange,
  section,
  placeholder,
  className,
  rows,
  id,
  name,
  disabled,
  hint = DEFAULT_HINT,
}: DotPhraseTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const sections = useMemo<NoteSection[]>(
    () => (section == null ? [] : Array.isArray(section) ? section : [section]),
    [section],
  );

  const suggestions = useMemo<DotPhrase[]>(() => {
    if (!query || !query.startsWith(".")) return [];
    const q = query.slice(1).toLowerCase();
    const matches = DOT_PHRASES.filter(
      (p) => p.shortcode.toLowerCase().includes(q) || p.label.toLowerCase().includes(q),
    );
    if (sections.length > 0) {
      // Surface phrases for the active section(s) first; keep the rest as fallback.
      const inSection = matches.filter((p) => sections.includes(p.section));
      const outSection = matches.filter((p) => !sections.includes(p.section));
      return [...inSection, ...outSection].slice(0, 8);
    }
    return matches.slice(0, 8);
  }, [query, sections]);

  const close = () => {
    setQuery(null);
    setActiveIndex(0);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    onChange(next);
    const cursor = e.target.selectionStart ?? next.length;
    const before = next.slice(0, cursor);
    const match = before.match(/\.\w*$/);
    if (match) {
      setQuery(match[0]);
      setActiveIndex(0);
    } else {
      close();
    }
  };

  const apply = (phrase: DotPhrase) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const cursor = ta.selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const match = before.match(/\.\w*$/);
    if (!match || match.index == null) return;
    const start = match.index;
    const next = value.slice(0, start) + phrase.expansion + value.slice(cursor);
    onChange(next);
    close();
    // Jump the caret to the first [placeholder], else just past the expansion.
    const placeholderIdx = phrase.expansion.search(/\[[^\]]*\]/);
    const caret = start + (placeholderIdx >= 0 ? placeholderIdx : phrase.expansion.length);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(caret, caret);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!query || suggestions.length === 0) return;
    if (e.key === "Tab" || e.key === "Enter") {
      e.preventDefault();
      apply(suggestions[activeIndex] ?? suggestions[0]);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        id={id}
        name={name}
        rows={rows}
        disabled={disabled}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
      />
      {query && suggestions.length > 0 && (
        <div className="absolute inset-x-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Dot phrases
            </p>
          </div>
          {suggestions.map((p, i) => (
            <button
              key={p.shortcode}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => apply(p)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`flex w-full items-start gap-2 px-3 py-2 text-left transition-colors ${
                i === activeIndex ? "bg-blue-50" : "hover:bg-slate-50"
              }`}
            >
              <span className="mt-0.5 shrink-0 rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-blue-700">
                {p.shortcode}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-slate-700">{p.label}</span>
                {p.teachingNote && (
                  <span className="block truncate text-[10px] text-slate-400">{p.teachingNote}</span>
                )}
              </span>
              <span className="mt-0.5 shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">
                {p.section}
              </span>
            </button>
          ))}
          <div className="border-t border-slate-100 px-3 py-1.5">
            <p className="text-[9px] text-slate-400">{hint}</p>
          </div>
        </div>
      )}
    </div>
  );
}
