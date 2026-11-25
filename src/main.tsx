import "./index.css";
/**
 * Healthcare Hustlers EHR — SPA Entry Point
 *
 * Mounts the TanStack Router app to #root for pure client-side rendering.
 * This replaces the TanStack Start SSR bootstrap and enables static SPA
 * hosting on Vercel.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import { getLoggedInPhone } from "./store/accessStore";
import { bootstrapEhrStore } from "./store/ehrStore";
import { removeStagePinState } from "./store/removeStagePinState";
import "~/styles/app.css";

// Light-only: clear a "dark" class an earlier build's toggle may have left set.
if (typeof document !== "undefined") document.documentElement.classList.remove("dark");

const router = getRouter();

// Stage PINs are retired (specs/task-0b-remove-pin.md): drop the two keys the
// old gate wrote, so no saved lock state can put a student on a locked stage.
// Every other saved key — including their progress — is left untouched.
removeStagePinState();

// Phase 0: load this student's persisted record set (patients, appointments,
// case state) before the first screen renders.
bootstrapEhrStore(getLoggedInPhone());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);