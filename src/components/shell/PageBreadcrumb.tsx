/**
 * PageBreadcrumb — the Back button and the trail, on every page but the dashboard
 *
 * Inspiration: Epic Hyperspace's chart trail (the thin line under the activity
 * bar that names the record you are in) with a browser-style Back.
 *
 * Spec `slice-navigation.md` items 3 and 4:
 *
 *   `[← Back]  Dashboard › Claims › CLM-000006`
 *
 * Back goes through the router's own history, so it returns to the page the
 * student came from **without a reload and without resetting a store** — the
 * note draft, the open patient and the stage on screen are still there when
 * they land (STANDING-RULES 3). A student who arrived on a pasted link has no
 * page behind them, so Back opens the trail's own parent instead of leaving the
 * app.
 *
 * The strip is the 19 November frame's second row: white, one line of slate
 * type, no new palette. At 360 px it wraps under the bar and long names are
 * truncated inside their own crumb, so the page never scrolls sideways
 * (STANDING-RULES 4). Every control has a visible label, a keyboard focus ring
 * and a 40 px hit area (STANDING-RULES 5).
 */

import { useRouter } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { DASHBOARD_CRUMB, type Crumb } from "../../domain/breadcrumb";

interface PageBreadcrumbProps {
  /** The trail, Dashboard first. The last crumb is the page on screen. */
  trail: Crumb[];
}

export function PageBreadcrumb({ trail }: PageBreadcrumbProps) {
  const router = useRouter();

  /**
   * Back: the browser's own step first. `canGoBack` is false on a fresh tab or
   * a pasted address, where stepping back would leave the simulator — there the
   * parent page in the trail is the honest destination.
   */
  const goBack = () => {
    if (router.history.canGoBack()) {
      router.history.back();
      return;
    }
    const parent = [...trail].reverse().find((crumb) => crumb.to)?.to ?? DASHBOARD_CRUMB.to;
    if (parent) void router.navigate({ to: parent });
  };

  const parentLabel = [...trail].reverse().find((crumb) => crumb.to)?.label ?? "Dashboard";

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-h-10 flex-wrap items-center gap-x-1 gap-y-0.5 border-b border-slate-200 bg-white px-2 py-1 text-slate-500 sm:px-3 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
    >
      <button
        type="button"
        onClick={goBack}
        aria-label={`Back to ${parentLabel}`}
        title={`Back to ${parentLabel}`}
        className="flex min-h-10 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-brand-700 transition-colors hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:text-brand-300 dark:hover:bg-slate-800"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Back</span>
      </button>

      <ol className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5">
        {trail.map((crumb, index) => {
          const last = index === trail.length - 1;
          return (
            <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-x-1">
              {index > 0 && (
                <ChevronRight className="h-3 w-3 shrink-0 text-slate-300 dark:text-slate-600" aria-hidden="true" />
              )}
              {crumb.to && !last ? (
                <a
                  href={crumb.to}
                  onClick={(event) => {
                    // A real link (middle-click and copy work) that still
                    // navigates inside the app, so nothing is reloaded.
                    event.preventDefault();
                    void router.navigate({ to: crumb.to as string });
                  }}
                  className="max-w-[12rem] truncate rounded px-1 text-[11px] font-medium text-slate-600 hover:text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 sm:max-w-[18rem] dark:text-slate-300 dark:hover:text-brand-300"
                >
                  {crumb.label}
                </a>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  className={`max-w-[12rem] truncate px-1 text-[11px] sm:max-w-[22rem] ${
                    last ? "font-semibold text-slate-800 dark:text-slate-100" : "font-medium text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
