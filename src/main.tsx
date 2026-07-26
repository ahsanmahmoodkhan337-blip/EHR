import "tailwindcss";
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
import "~/styles/app.css";

const router = getRouter();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);