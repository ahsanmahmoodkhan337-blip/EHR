/**
 * Badge — Reusable Status Badge Component
 *
 * Variants: success (emerald), warning (amber), danger (rose),
 * info (sky), neutral (slate).
 */

import React from "react";

type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral";

const variantClasses: Record<BadgeVariant, string> = {
  success: "bg-emerald-100 text-emerald-700 border-emerald-200",
  warning: "bg-amber-100 text-amber-700 border-amber-200",
  danger: "bg-rose-100 text-rose-700 border-rose-200",
  info: "bg-sky-100 text-sky-700 border-sky-200",
  neutral: "bg-slate-100 text-slate-600 border-slate-200",
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "neutral", children, className = "" }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}
