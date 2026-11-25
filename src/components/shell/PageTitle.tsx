/**
 * PageTitle — the one title block every page opens with.
 *
 * Pages used to draw their own: 14, 16, 18, 20 or 24 px, with or without an
 * icon, the purpose line sometimes hidden on phones. One component means the
 * page name is always the same size in the same place, and the line under it
 * always says what the page is for.
 */

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface PageTitleProps {
  title: ReactNode;
  /** One sentence: what this page is for, or what to do here. */
  description?: ReactNode;
  icon?: LucideIcon;
  /** A short fact under the description, e.g. "3 claims on file". */
  meta?: ReactNode;
  /** Controls aligned to the right of the title (a button, a filter). */
  actions?: ReactNode;
  className?: string;
}

export function PageTitle({ title, description, icon: Icon, meta, actions, className = "" }: PageTitleProps) {
  return (
    <div className={`mb-5 flex flex-wrap items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-[-0.01em] text-slate-900 dark:text-slate-100">
          {Icon && <Icon className="h-6 w-6 shrink-0 text-brand-600" aria-hidden="true" />}
          {title}
        </h1>
        {description && <p className="mt-1 max-w-[70ch] text-[15px] text-slate-600 dark:text-slate-300">{description}</p>}
        {meta && <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200">{meta}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
