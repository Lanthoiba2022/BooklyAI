"use client";
import { createClient } from "@supabase/supabase-js";
import { getEnv, getPublicEnv } from "./env";

// Prefer public env for browser usage; fall back to server vars in dev
const { supabaseUrl: pubUrl, supabaseAnonKey: pubAnon } = getPublicEnv();
const { supabaseUrl: srvUrl, supabaseAnonKey: srvAnon } = getEnv();
const supabaseUrl = pubUrl || srvUrl;
const supabaseAnonKey = pubAnon || srvAnon;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail fast in dev; in prod, Supabase client can be undefined if not configured
  console.warn("Supabase env vars missing: SUPABASE_URL or SUPABASE_ANON_API_KEY");
}

export const supabaseBrowser = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // Ensure robust session behavior across tabs and refreshes
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
        storageKey: "sb-bookly-auth",
      },
    })
  : undefined;


