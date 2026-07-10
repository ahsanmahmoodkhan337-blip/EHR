/**
 * Skeleton — Loading Placeholder Component
 *
 * Skeleton screens provide a visual placeholder while content is loading.
 * Uses Tailwind's animate-pulse with a soft shimmer effect.
 * Inspired by: shadcn/ui Skeleton component
 */

interface SkeletonProps {
  className?: string;
  /** Number of skeleton lines to render (for text blocks) */
  lines?: number;
  /** Width of each line (used with lines) */
  lineWidths?: string[];
  /** Shape variant */
  variant?: "text" | "card" | "circle" | "avatar" | "chart";
}

export function Skeleton({ className = "", lines, lineWidths, variant = "text" }: SkeletonProps) {
  // Single skeleton item
  if (variant === "circle") {
    return <div className={`rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse ${className}`} />;
  }
  if (variant === "avatar") {
    return <div className={`h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse ${className}`} />;
  }
  if (variant === "card") {
    return (
      <div className={`rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm ${className}`}>
        <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-700 animate-pulse mb-3" />
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
          <div className="h-3 w-5/6 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
          <div className="h-3 w-2/3 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
        </div>
      </div>
    );
  }
  if (variant === "chart") {
    return (
      <div className={`rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm ${className}`}>
        <div className="h-4 w-1/2 rounded bg-slate-200 dark:bg-slate-700 animate-pulse mb-4" />
        <div className="flex items-end gap-2 h-32">
          {[60, 80, 45, 90, 70, 55, 85].map((h, i) => (
            <div key={i} className="flex-1 rounded-t bg-slate-200 dark:bg-slate-700 animate-pulse" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    );
  }

  // Text variant — single or multiple lines
  if (lines && lines > 1) {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-3 rounded bg-slate-200 dark:bg-slate-700 animate-pulse"
            style={{ width: lineWidths?.[i] ?? (i === lines - 1 ? "60%" : "100%") }}
          />
        ))}
      </div>
    );
  }

  return <div className={`h-4 rounded bg-slate-200 dark:bg-slate-700 animate-pulse ${className}`} />;
}

/**
 * SkeletonCard — Pre-built card skeleton for patient cards
 */
export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <Skeleton variant="avatar" />
        <div className="flex-1">
          <Skeleton className="h-4 w-32 mb-1" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="h-3 w-full mb-2" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  );
}