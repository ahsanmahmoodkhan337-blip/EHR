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
 * Deliberately free of React: the top bar, the case list and the case routes all
 * read and write this one key, and nothing has to re-render to keep it.
 */

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

/**
 * Remember the chosen track. A browser that refuses storage must not break the
 * switch: the page still renders the track the student just picked.
 */
export function setActiveTrack(track: ShellTrack): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVE_TRACK_KEY, track);
  } catch {
    /* storage refused — the current page is still correct */
  }
}
