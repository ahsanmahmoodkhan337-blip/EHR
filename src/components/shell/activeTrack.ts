/**
 * activeTrack.ts — which revenue cycle the student is working in.
 *
 * Inspired by: a practice-management suite that keeps you in the module you were
 * last in when you move between screens, instead of dropping you back into the
 * default one on every navigation.
 *
 * The Medical/Dental switch in the top bar used to send a dental student to
 * `/dental`, which redirects to `/cases` — and `/cases` had no idea which track
 * had been chosen, so it rendered the medical list under a MEDICAL RCM header.
 * The chosen track is kept here, one key per device, so it survives the
 * navigation, a reload, and a deep link into a case.
 *
 * ONE SOURCE, ONE WRITE (owner's student-experience work order, 2026-11-21,
 * item 4): "The Medical/Dental track toggle changes by itself when opening
 * /coding, /claims and /cases. The track must change only when the student
 * clicks the toggle."
 *
 * Before this, half the app passed a hardcoded `track="medical"` to the frame
 * while `/coding`, `/claims`, `/payments`, `/denials-ar` and `/reports` read the
 * stored key — so the toggle appeared to move on its own the moment a student
 * walked from `/patients` to `/coding`. Now every shared page reads the one key
 * through `useActiveTrack()`, which re-renders when it changes, and the ONLY
 * writer is the toggle itself (`setActiveTrack`, called from the switch's click
 * handler). A page that IS one track — the dental case list, the practice AR
 * bench, a case's own stages — draws that track as a constant, because it is
 * that track's page, and it writes nothing.
 *
 * Deliberately free of React state: the key lives in `localStorage` and this
 * module owns the one subscription list, so no provider has to be threaded
 * through every route.
 */

import { useSyncExternalStore } from "react";
import type { ShellTrack } from "./navItems";

const ACTIVE_TRACK_KEY = "hh_active_track";

export function isShellTrack(value: unknown): value is ShellTrack {
  return value === "medical" || value === "dental";
}

/** The track the student last chose, or medical — the default product view. */
export function readActiveTrack(): ShellTrack {
  if (typeof window === "undefined") return "medical";
  try {
    const raw = window.localStorage.getItem(ACTIVE_TRACK_KEY);
    return isShellTrack(raw) ? raw : "medical";
  } catch {
    return "medical";
  }
}

/** Every mounted page that shows the track, so one click updates all of them. */
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/**
 * Watch the chosen track. Returns the unsubscribe function React expects, so
 * `useSyncExternalStore` can drop the listener on unmount.
 */
export function subscribeActiveTrack(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Remember the chosen track. A browser that refuses storage must not break the
 * switch: the page still renders the track the student just picked, because the
 * listeners are told either way.
 *
 * This is the ONLY place the track is written. Nothing else in the app — no
 * route, no effect, no case loader — may change the student's track for them.
 */
export function setActiveTrack(track: ShellTrack): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(ACTIVE_TRACK_KEY, track);
    } catch {
      /* storage refused — the current page is still correct */
    }
  }
  notify();
}

/**
 * The track the student chose, as live state. Every shared page passes this to
 * `AppShell`, so the toggle in the header and the page under it can never
 * disagree, and moving between pages cannot change it.
 */
export function useActiveTrack(): ShellTrack {
  return useSyncExternalStore(subscribeActiveTrack, readActiveTrack, () => "medical" as const);
}
