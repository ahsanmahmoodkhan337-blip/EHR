/**
 * useStageUrlSync.tsx — one URL per case stage, shared by both tracks
 *
 * Inspired by: athenaOne and Epic, where the browser address is part of the
 * record you are working — the encounter activity you are in has its own URL and
 * a refresh puts you back in it (spec `task-1-app-shell.md` item 4).
 *
 * The case runner keeps the student's work in its own store, so the URL and the
 * store are kept in step in two directions:
 *
 *   URL → store  when the address changes (deep link, refresh, back/forward).
 *                A stage the student has not unlocked is refused: they are put
 *                on the furthest stage they actually reached and told why.
 *   store → URL  when the runner moves (stepper, Back/Continue, or a stage's own
 *                jump), so the address always names the stage on screen.
 *
 * Both directions are guarded by equality, so neither can loop.
 */

import { useEffect, useRef, useState } from "react";
import { Lock, X } from "lucide-react";

export interface StageUrlSyncOptions {
  /** Case id from the URL, undefined on the case-picker route. */
  urlCaseId?: string;
  /** Stage id from the URL, undefined on the case-picker route. */
  urlStage?: string;
  /** The case the store has open. */
  caseId: string | null;
  /** The stage the store is on. */
  stage: string;
  /** Furthest stage the student has reached for this case. */
  furthestStage: string;
  /** Every stage id the track accepts in a URL, in order. */
  stageIds: readonly string[];
  /** The stage a case opens on when it is selected (both tracks: briefing). */
  freshCaseStage: string;
  selectCase: (caseId: string) => void;
  goTo: (stage: string) => void;
  /**
   * Write the URL for one stage of one case. `replace` is used for a redirect
   * (a locked or unknown stage), so the browser's Back button never bounces
   * through it.
   */
  goToStage: (caseId: string, stage: string, replace?: boolean) => void;
  /** Write the URL for the case picker. */
  goToBase: () => void;
}

export interface StageUrlSync {
  /** A stage asked for by URL that is still locked (null once dismissed). */
  blockedStage: string | null;
  dismissBlocked: () => void;
}

/** How long the locked-stage notice stays up before it clears itself. */
const NOTICE_MS = 9000;

export function useStageUrlSync(options: StageUrlSyncOptions): StageUrlSync {
  const [blockedStage, setBlockedStage] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The latest store values, read by the URL effect without re-running it every
  // time the student types a character into the stage.
  const live = useRef(options);
  live.current = options;

  const { urlCaseId, urlStage } = options;

  /**
   * A cold deep link is handled by the URL effect below, which selects the case
   * the address names. Until the store has taken that case, `caseId` is still
   * null — and the store → URL effect used to read that as "no case open" and
   * send the student to the case list, so every deep link bounced to `/cases`
   * instead of opening its case. The first run is therefore left to the URL
   * effect; from the second run on, the two are in step.
   */
  const storeSettled = useRef(false);

  useEffect(() => {
    const o = live.current;
    if (!urlCaseId) return;

    const ids = o.stageIds;
    const switching = urlCaseId !== o.caseId;
    // A case opened for the first time has only reached its briefing; an open
    // case has reached whatever it recorded.
    const furthest = switching ? o.freshCaseStage : o.furthestStage;
    const furthestIdx = Math.max(ids.indexOf(furthest), ids.indexOf(o.freshCaseStage));
    const wantedIdx = urlStage ? ids.indexOf(urlStage) : -1;

    if (switching) o.selectCase(urlCaseId);

    if (wantedIdx < 0) {
      // No usable stage in the address — open the stage this case is on.
      if (switching) o.goToStage(urlCaseId, o.freshCaseStage);
      return;
    }

    if (wantedIdx <= furthestIdx) {
      if (switching || urlStage !== o.stage) o.goTo(urlStage as string);
      return;
    }

    // Locked. Keep the student on the furthest stage they reached and say why.
    setBlockedStage(urlStage as string);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setBlockedStage(null), NOTICE_MS);
    o.goToStage(urlCaseId, ids[furthestIdx] ?? o.freshCaseStage, true);
  }, [urlCaseId, urlStage]);

  useEffect(() => {
    if (!storeSettled.current) {
      storeSettled.current = true;
      return;
    }
    if (!options.caseId || options.stage === "case-select") {
      if (urlCaseId) options.goToBase();
      return;
    }
    if (urlCaseId !== options.caseId || urlStage !== options.stage) {
      // Restoring a case from the picker replaces the entry; moving between
      // stages pushes one, so Back walks the student back through the spine.
      options.goToStage(options.caseId, options.stage, !urlCaseId);
    }
  }, [options.caseId, options.stage, urlCaseId, urlStage]);

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  return {
    blockedStage,
    dismissBlocked: () => setBlockedStage(null),
  };
}

/**
 * The notice a student sees when they land on a stage the case has not opened
 * yet. It names the stage and tells them what to do instead of dropping them
 * somewhere silently.
 */
export function LockedStageNotice({
  stageLabel,
  onDismiss,
}: {
  stageLabel: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900"
    >
      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <p className="flex-1">
        <span className="font-semibold">{stageLabel}</span> is not unlocked yet for this case, so you are on
        the furthest stage you have reached. Use Continue to open it.
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss the locked-stage notice"
        className="flex min-h-10 min-w-10 items-center justify-center rounded text-amber-800 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
