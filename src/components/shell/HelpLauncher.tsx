/**
 * HelpLauncher — the floating help head with the built-in "Ask a question" guide
 *
 * Owner, 2026-11-25: "help head should be floating" — a round head the student
 * can drag anywhere, which remembers where it was left (`hh_help_pos`). It
 * snaps to the nearer side edge on release, so it never parks over the middle
 * of a form, and a student who finds it covering a button simply moves it.
 *
 * Opening it gives:
 *   - "Ask a question" — answered offline from the app's own content
 *     (`domain/helpGuide.ts`: how-to FAQ, RCM glossary, the CARC table and the
 *     how-to guides). No AI service, nothing invented.
 *   - the six how-to guides, keyboard shortcuts, WhatsApp support and the
 *     simulated-data statement.
 *
 * A tap opens it; a drag moves it. Escape closes it and returns focus to the
 * head. Every control is a real button with an accessible name, a visible
 * focus ring and at least a 40 px hit area (STANDING-RULES 5).
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, BookOpen, GripVertical, MessageCircle, MessageCircleQuestion, Search, X } from "lucide-react";
import { HOW_TO_TUTORIALS, TUTORIAL_PATIENT_TIP } from "../../domain/howToTutorials";
import { askHelpGuide, SUGGESTED_QUESTIONS, type HelpAnswer } from "../../domain/helpGuide";
import { SHELL_SHORTCUTS } from "./stageReview";

const POS_KEY = "hh_help_pos";
const HEAD = 52;
const EDGE = 12;

const WHATSAPP_URL =
  "https://api.whatsapp.com/send/?phone=923350340888&text=Hi%21%20I%20need%20help%20with%20the%20EHR%20Simulation%20Portal.&type=phone_number&app_absent=0";

/** Where the head rests: which side edge, and how far down the screen (0–1). */
export interface HeadPosition {
  side: "left" | "right";
  ratio: number;
}

const DEFAULT_POS: HeadPosition = { side: "right", ratio: 0.7 };

export function readHeadPosition(raw: string | null): HeadPosition {
  try {
    const v = raw ? JSON.parse(raw) : null;
    if (v && (v.side === "left" || v.side === "right") && typeof v.ratio === "number" && v.ratio >= 0 && v.ratio <= 1) {
      return { side: v.side, ratio: v.ratio };
    }
  } catch {
    // A broken saved position falls back to the default.
  }
  return DEFAULT_POS;
}

/** Where a drag that ended at (x, y) rests, in a viewport of w × h. */
export function snapHead(x: number, y: number, w: number, h: number): HeadPosition {
  const top = Math.min(Math.max(y - HEAD / 2, EDGE), Math.max(EDGE, h - HEAD - EDGE));
  return { side: x < w / 2 ? "left" : "right", ratio: h > 0 ? top / h : DEFAULT_POS.ratio };
}

function viewport() {
  return { w: window.innerWidth, h: window.innerHeight };
}

function headTop(pos: HeadPosition, h: number) {
  return Math.min(Math.max(pos.ratio * h, EDGE), Math.max(EDGE, h - HEAD - EDGE));
}

export function HelpLauncher() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<HeadPosition>(() =>
    readHeadPosition(typeof localStorage !== "undefined" ? localStorage.getItem(POS_KEY) : null),
  );
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [vp, setVp] = useState(() => (typeof window !== "undefined" ? viewport() : { w: 1440, h: 900 }));
  const [query, setQuery] = useState("");
  const [guideId, setGuideId] = useState<string | null>(null);
  const guide = HOW_TO_TUTORIALS.find((t) => t.id === guideId) ?? null;
  const headRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const press = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    const onResize = () => setVp(viewport());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(POS_KEY, JSON.stringify(pos));
    } catch {
      // A position that cannot be stored is not student work.
    }
  }, [pos]);

  const close = useCallback(() => {
    setOpen(false);
    headRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  function onPointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return;
    press.current = { x: e.clientX, y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    const p = press.current;
    if (!p) return;
    if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 6) return;
    p.moved = true;
    setDrag({ x: e.clientX, y: e.clientY });
  }
  function onPointerUp(e: ReactPointerEvent<HTMLButtonElement>) {
    const p = press.current;
    press.current = null;
    if (p?.moved) {
      suppressClick.current = true;
      setPos(snapHead(e.clientX, e.clientY, window.innerWidth, window.innerHeight));
      setDrag(null);
    }
  }
  function onClick() {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    setOpen((v) => !v);
  }

  function go(answer: HelpAnswer) {
    if (answer.guideId) {
      setGuideId(answer.guideId);
      return;
    }
    if (answer.goTo) {
      setOpen(false);
      void navigate({ to: answer.goTo.to });
    }
  }

  const top = drag ? drag.y - HEAD / 2 : headTop(pos, vp.h);
  const headStyle: CSSProperties = drag
    ? { left: drag.x - HEAD / 2, top }
    : pos.side === "right"
      ? { right: EDGE, top }
      : { left: EDGE, top };

  const phone = vp.w < 640;
  const below = top < vp.h / 2;
  const panelStyle: CSSProperties = phone
    ? { left: 8, right: 8, bottom: 8 }
    : {
        [pos.side]: EDGE,
        ...(below ? { top: top + HEAD + 8 } : { bottom: vp.h - top + 8 }),
      };
  const answers = askHelpGuide(query);

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="Help"
          style={panelStyle}
          className="fixed z-[60] flex max-h-[min(72vh,38rem)] w-auto flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:w-[24rem] print:hidden"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <MessageCircleQuestion className="h-5 w-5 text-brand-700" aria-hidden="true" />
            <h2 className="text-[14px] font-semibold text-slate-800">Help</h2>
            <button
              type="button"
              onClick={close}
              aria-label="Close help"
              className="ml-auto flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="overflow-y-auto p-3">
            {guide ? (
              <div>
                <button
                  type="button"
                  onClick={() => setGuideId(null)}
                  className="flex min-h-10 items-center gap-1 rounded-lg px-1 text-[12px] font-medium text-brand-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand-600"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  Back to help
                </button>
                <h3 className="mt-1 text-[14px] font-semibold text-slate-800">{guide.title}</h3>
                <p className="text-[12px] text-slate-500">
                  {guide.where} · about {guide.minutes} min
                </p>
                <ol className="mt-2 space-y-2">
                  {guide.steps.map((step, i) => (
                    <li key={step.title} className="flex gap-2">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-brand-50 text-[11px] font-bold text-brand-700">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-[13px] font-semibold text-slate-800">{step.title}</p>
                        <p className="text-[12px] leading-relaxed text-slate-600">{step.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <p className="mt-2 border-t border-slate-100 pt-2 text-[12px] text-slate-500">
                  <span className="font-semibold text-slate-700">You'll finish with: </span>
                  {guide.outcome}
                </p>
              </div>
            ) : (
              <>
                <label htmlFor="help-ask" className="text-[13px] font-semibold text-slate-800">
                  Ask a question
                </label>
                <div className="relative mt-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    id="help-ask"
                    ref={inputRef}
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g. What does CO-45 mean?"
                    autoComplete="off"
                    className="h-11 w-full rounded-lg border border-slate-300 pl-8 pr-3 text-[14px] focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                  />
                </div>

                {query.trim() ? (
                  <div className="mt-2" aria-live="polite">
                    {answers.length === 0 ? (
                      <p className="rounded-lg bg-slate-50 p-3 text-[13px] text-slate-600">
                        No answer for that yet. Try a shorter question or a code like “CO-97”, or message
                        support below.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {answers.map((a) => (
                          <li key={a.id} className="rounded-lg border border-slate-200 p-3">
                            <p className="text-[13px] font-semibold text-slate-800">{a.title}</p>
                            <p className="mt-0.5 text-[13px] leading-relaxed text-slate-600">{a.answer}</p>
                            {(a.goTo || a.guideId) && (
                              <button
                                type="button"
                                onClick={() => go(a)}
                                className="mt-1.5 inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-[12px] font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-brand-600"
                              >
                                {a.guideId ? "Open the guide" : a.goTo?.label}
                                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {SUGGESTED_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setQuery(q)}
                        className="min-h-9 rounded-full bg-slate-100 px-3 text-[12px] text-slate-700 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-brand-600"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                <p className="mt-4 text-[13px] font-semibold text-slate-800">How-to guides</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">{TUTORIAL_PATIENT_TIP}</p>
                <ol className="mt-1.5 space-y-1">
                  {HOW_TO_TUTORIALS.map((t, i) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setGuideId(t.id)}
                        className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand-600"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1">{t.title}</span>
                        <BookOpen className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ol>

                <p className="mt-4 text-[13px] font-semibold text-slate-800">Keyboard shortcuts</p>
                <dl className="mt-1 space-y-1">
                  {SHELL_SHORTCUTS.map((shortcut) => (
                    <div key={shortcut.keys} className="flex items-baseline gap-2">
                      <dt className="shrink-0 rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
                        {shortcut.keys}
                      </dt>
                      <dd className="min-w-0 text-[12px] text-slate-600">{shortcut.action}</dd>
                    </div>
                  ))}
                </dl>

                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex min-h-10 items-center gap-2 rounded-lg bg-green-600 px-3 text-[13px] font-semibold text-white hover:bg-green-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700"
                >
                  <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Message support on WhatsApp
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                  Simulated data — every patient, payer, NPI and fee in this app is fictional and for teaching only.
                  Drag the help head to move it out of your way.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      <button
        ref={headRef}
        type="button"
        style={headStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          press.current = null;
          setDrag(null);
        }}
        onClick={onClick}
        aria-expanded={open}
        aria-label={open ? "Hide help" : "Help — ask a question (drag to move)"}
        title={open ? "Hide help" : "Help — ask a question. Drag to move."}
        className={`group fixed z-[55] flex touch-none select-none items-center justify-center rounded-full bg-brand-900 text-white shadow-lg ring-4 ring-white/80 transition-[box-shadow,transform] hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 print:hidden ${
          drag ? "scale-110 cursor-grabbing shadow-2xl" : "cursor-pointer"
        }`}
      >
        <span style={{ width: HEAD, height: HEAD }} className="flex items-center justify-center">
          {open ? <X className="h-6 w-6" aria-hidden="true" /> : <MessageCircleQuestion className="h-6 w-6" aria-hidden="true" />}
        </span>
        <GripVertical
          className="absolute -left-1 top-1/2 h-4 w-4 -translate-y-1/2 rounded bg-white text-slate-400 opacity-0 shadow transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        />
      </button>
    </>
  );
}
