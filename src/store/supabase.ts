/**
 * Supabase Client — Singleton
 *
 * Initializes the Supabase client for cross-device data sync.
 * Uses env vars SUPABASE_URL and SUPABASE_ANON_KEY.
 * All access store operations will use this client.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
