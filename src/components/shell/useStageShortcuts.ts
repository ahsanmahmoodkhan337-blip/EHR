/**
 * useStageShortcuts — Alt+→ and Alt+← move through the case spine
 *
 * Inspired by: Epic Hyperspace's keyboard-driven activity navigation and the
 * key chords athenaOne's worklists accept, moved into the shared shell so both
 * the medical and the dental runner answer the same keys (spec
 * `task-1-app-shell.md` item 8).
 *
 * Why a hook and not a component: the runner owns the spine, so the runner
 * decides what "next" means (it may be locked). The hook only listens, calls
 * the handler and returns a sentence to announce. Every outcome is spoken
 * through a polite live region the runner renders — including "that stage is
 * locked", so a keyboard-only student is never left guessing whether the key
 * worked.
 *
 * The listener is on `window`, ignores Ctrl/Meta combos (so it cannot collide
 * with the browser's own shortcuts beyond Alt+← / Alt+→, which it takes over
 * deliberately), and calls `preventDefault()` only when it actually handles the
 * key.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface StageShortcutHandlers {
  /** Alt+→. Called on every press; the handler decides whether it can move. */
  onNext: () => void;
  /** Alt+←. */
  onPrevious: () => void;
}

export interface StageShortcutApi {
  /** The last thing the shortcuts did, for the runner's live region. */
  announcement: string;
  /** Say something in the live region (also used for the blocked case). */
  announce: (message: string) => void;
}

export function useStageShortcuts({ onNext, onPrevious }: StageShortcutHandlers): StageShortcutApi {
  const [announcement, setAnnouncement] = useState("");

  // Handlers change on every render (they close over the current stage), so the
  // listener reads them from a ref instead of re-binding on each render.
  const live = useRef({ onNext, onPrevious });
  live.current = { onNext, onPrevious };

  const announce = useCallback((message: string) => {
    // A screen reader ignores a live region whose text did not change. Repeating
    // the same sentence (pressing Alt+→ twice on a locked stage) appends a space
    // so the second press is announced too.
    setAnnouncement((current) => (current === message ? `${message} ` : message));
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      const handler = event.key === "ArrowRight" ? live.current.onNext : live.current.onPrevious;
      event.preventDefault();
      handler();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return { announcement, announce };
}
