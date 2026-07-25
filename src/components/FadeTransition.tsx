/**
 * FadeTransition — Reusable AnimatePresence fade wrapper
 *
 * Wraps framer-motion's AnimatePresence + motion.div pattern
 * to avoid esbuild parsing issues with large JSX files.
 */
import { motion, AnimatePresence } from "framer-motion";
import type { ReactNode } from "react";

interface FadeTransitionProps {
  children: ReactNode;
  id: string;
  className?: string;
}

export function FadeTransition({ children, id, className = "" }: FadeTransitionProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
