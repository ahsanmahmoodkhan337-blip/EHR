/**
 * Supabase Client — Singleton
 *
 * Initializes the Supabase client for cross-device data sync.
 * Uses env vars VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
 * All access store operations use this client.
 *
 * RESILIENCE: this module is imported (transitively) by almost every route.
 * createClient() THROWS if the URL/key are missing, and a module-level throw
 * blanks the entire app before React ever renders — a missing env var used to
 * take the whole product down with a white screen. We now degrade instead:
 * if config is absent we export null and callers fall back to localStorage.
 *
 * Always guard usage:  if (!supabase) { ...local fallback... }
 * or use the isSupabaseConfigured() helper below.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function createSupabaseClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn(
      "[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. " +
        "Running in local-only mode — data will persist in this browser but will not sync across devices.",
    );
    return null;
  }

  try {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (err) {
    console.error("[supabase] Failed to initialise client; falling back to local-only mode.", err);
    return null;
  }
}

export const supabase = createSupabaseClient();

/** True when cross-device sync is available. */
export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}
