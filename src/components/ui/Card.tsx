/**
 * Card — Reusable Card Wrapper Component
 *
 * Consistent card styling with dark mode support.
 */

import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div className={`bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm rounded-xl ${className}`}>
      {children}
    </div>
  );
}
