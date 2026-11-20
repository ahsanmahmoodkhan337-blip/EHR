/**
 * AppSidebar — the single left navigation rail for both revenue cycles.
 *
 * Inspiration: athenaOne's collapsible left navigation rail (icon-only when
 * collapsed, one entry per revenue-cycle workspace) and Epic Hyperspace's
 * activity toolbar.
 *
 * It replaces the per-page headers' ad-hoc Home / Settings / track links: one
 * list of destinations, the same on every page, driven by `navItems.ts`. Every
 * entry is a real page (spec `phase-1-navigation.md` item 1): there is no
 * "SOON" state any more, so every item is a link and the current one is marked
 * with `aria-current="page"`.
 *
 * Accessibility (STANDING-RULES): every item is at least 40 px tall, keeps a
 * visible label or an `aria-label`, and is reachable by keyboard. Below `lg`
 * the rail becomes an off-canvas drawer opened from the top bar's menu button.
 */

import { useNavigate } from "@tanstack/react-router";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { SHELL_NAV_ITEMS, type ShellNavId, type ShellTrack } from "./navItems";

interface AppSidebarProps {
  track: ShellTrack;
  /** The item to show as the current page, or null when none matches. */
  activeNav: ShellNavId | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** True while the off-canvas drawer is open (below `lg`). */
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function AppSidebar({
  track,
  activeNav,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}: AppSidebarProps) {
  const navigate = useNavigate();

  // The drawer always shows labels; the icon rail is a desktop affordance.
  const iconOnly = collapsed;

  const rail = (
    <div className="flex h-full min-h-0 flex-col bg-white dark:bg-slate-900">
      <div className="flex min-h-10 items-center gap-2 border-b border-slate-200 px-2 py-2 dark:border-slate-800">
        <img
          src="/healthcarehustlers-logo.png"
          alt="Healthcare Hustlers"
          className={iconOnly ? "h-7 w-7 object-contain" : "h-7 w-auto"}
          style={iconOnly ? undefined : { maxWidth: "150px" }}
        />
        {!iconOnly && (
          <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {track === "dental" ? "Dental RCM" : "Medical RCM"}
          </span>
        )}
        {/* Close the drawer (mobile only) */}
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation"
          title="Close navigation"
          className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <nav aria-label="Primary" className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <ul className="flex flex-col gap-1">
          {SHELL_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            const baseClass =
              "flex min-h-10 w-full items-center gap-3 rounded-lg px-2.5 text-left text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600";
            const activeClass = isActive
              ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-900/30 dark:text-brand-200 dark:ring-brand-800"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white";

            return (
              <li key={item.id}>
                <a
                  href={item.to}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={iconOnly ? item.label : undefined}
                  title={iconOnly ? item.label : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    onCloseMobile();
                    void navigate({ to: item.to });
                  }}
                  className={`${baseClass} ${activeClass}`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {iconOnly ? (
                    <span className="sr-only">{item.label}</span>
                  ) : (
                    <span className="truncate">{item.label}</span>
                  )}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="hidden border-t border-slate-200 p-2 lg:block dark:border-slate-800">
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand navigation sidebar" : "Collapse navigation sidebar to icons"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className="flex min-h-10 w-full items-center gap-3 rounded-lg px-2.5 text-[13px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          {!collapsed && <span className="truncate">Collapse</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop / tablet rail — sticky, full height, never wider than the page */}
      <aside
        className={`hidden shrink-0 border-r border-slate-200 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col dark:border-slate-800 ${
          collapsed ? "lg:w-16" : "lg:w-56"
        }`}
      >
        {rail}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
          <button
            type="button"
            aria-label="Close navigation"
            title="Close navigation"
            onClick={onCloseMobile}
            className="absolute inset-0 h-full w-full bg-slate-900/50"
          />
          <div className="relative z-10 h-full w-64 max-w-[85vw] border-r border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
            {rail}
          </div>
        </div>
      )}
    </>
  );
}
