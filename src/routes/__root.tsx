import { Outlet, createRootRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Toaster } from "sonner";

export const Route = createRootRoute({
  notFoundComponent: () => <div>Page not found</div>,
  component: RootComponent,
});

function RootComponent() {
  return <RootDocument><Outlet /></RootDocument>;
}

function RootDocument({ children }: { children: ReactNode }) {
  // One Toaster for every `toast()` from sonner (claim edit checks, patient
  // loaded, prior-auth and billing messages). It was never mounted, so those
  // messages were silently dropped (button audit, 2026-11-25).
  return (
    <div className="root-layout">
      {children}
      <Toaster position="bottom-right" richColors closeButton duration={4500} toastOptions={{ style: { fontFamily: "inherit" } }} />
    </div>
  );
}