/**
 * encounterRoute.ts — one address per encounter and stage
 *
 * Inspired by: Epic Hyperspace and athenaOne, where the activity in front of you
 * has its own address in the browser — refreshing the page puts you back in the
 * same patient's encounter, and the address can be pasted to a classmate (spec
 * `encounter-flow-audit-2026-11-20.md` item 2: "A real route per encounter and
 * stage: `/encounter/:encounterId/:stage`, so refresh and deep links work").
 *
 * WHAT AN ADDRESS IS
 *   /encounter/<encounterId>/<stageId>
 *
 * `stageId` is one of the seven ids in `domain/encounterFlow.ts` and nothing
 * else — a stage this build does not know is not an address. In this build an
 * encounter's id is its patient's id (`encounterKey` in
 * `store/pipelineEncounter.ts` keys one encounter per patient), so the address
 * names the patient the banner, the stepper and every stage work on.
 *
 * WHY THE WRITE IS SHALLOW
 * Moving between stages must not throw away the half-written note, the vitals
 * typed into the chart or the exam timer, so the workspace stays mounted while
 * the address follows it. The router reacts to any history write by re-rendering
 * the matched route, which would unmount the workspace — so the address is
 * written with the router's own subscriber muted for that one call. A refresh or
 * a pasted link is a real load of the address, and lands on the real route.
 *
 * Pure apart from `writeEncounterAddress`, which takes the history objects as
 * arguments so a test can pass fakes.
 */

import {
  ENCOUNTER_FLOW_OPENING_STAGE,
  flowStage,
  type EncounterFlowStageId,
} from "./encounterFlow";

/** The path prefix every encounter address starts with. */
export const ENCOUNTER_ROUTE_PREFIX = "/encounter";

/** The address of one stage of one encounter. */
export interface EncounterAddress {
  encounterId: string;
  stage: EncounterFlowStageId;
}

/** The address for a stage, e.g. `/encounter/MPT-2001/coding`. */
export function encounterPath(encounterId: string, stage: string): string {
  return `${ENCOUNTER_ROUTE_PREFIX}/${encodeURIComponent(encounterId)}/${stage}`;
}

/**
 * Read an encounter address, or null for anything that is not one. A path with
 * an unknown stage is not an address: the caller sends the student to the stage
 * the encounter opens on rather than to a screen that does not exist.
 */
export function parseEncounterPath(pathname: string | null | undefined): EncounterAddress | null {
  if (!pathname) return null;
  // Ignore the query and the hash, and tolerate a trailing slash.
  const path = pathname.split("?")[0].split("#")[0].replace(/\/+$/, "");
  const parts = path.split("/").filter(Boolean);
  if (parts.length !== 3) return null;
  if (`/${parts[0]}` !== ENCOUNTER_ROUTE_PREFIX) return null;
  const stage = parts[2];
  if (!flowStage(stage)) return null;
  let encounterId = parts[1];
  try {
    encounterId = decodeURIComponent(encounterId);
  } catch {
    // A malformed escape is still a usable id as typed.
  }
  if (!encounterId) return null;
  return { encounterId, stage: stage as EncounterFlowStageId };
}

/** The address an unknown or missing stage falls back to. */
export function openingStageId(): EncounterFlowStageId {
  return ENCOUNTER_FLOW_OPENING_STAGE;
}

/**
 * The two history objects a shallow address write touches. Passed in rather than
 * reached for, so this module stays testable and has no browser import.
 */
export interface AddressTarget {
  /**
   * The router's history object. Its `_ignoreSubscribers` flag is what the
   * router's own history wrapper checks before telling the router to re-render;
   * muting it for the one write keeps the workspace mounted.
   */
  history: { _ignoreSubscribers?: boolean };
  /** `window.history` — the real History API. */
  browserHistory: {
    state: unknown;
    replaceState(state: unknown, unused: string, url?: string): void;
  };
  /** `window.location.pathname` — the address as it is right now. */
  pathname: string;
}

/**
 * Put `href` in the address bar without re-rendering the route. Returns whether
 * the address changed. Writing the address it already has is a no-op, so the
 * caller can run this on every render without looping.
 */
export function writeEncounterAddress(href: string, target: AddressTarget): boolean {
  if (!href || target.pathname === href) return false;
  const previous = target.history._ignoreSubscribers;
  target.history._ignoreSubscribers = true;
  try {
    target.browserHistory.replaceState(target.browserHistory.state, "", href);
  } finally {
    target.history._ignoreSubscribers = previous;
  }
  return true;
}
