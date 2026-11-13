"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";

let client: SupabaseClient | undefined;

/** One shared Supabase client for the browser. The session lives in cookies so the server sees it too. */
export function browserSupabase(): SupabaseClient {
  if (!client) {
    const { url, anonKey } = supabaseConfig();
    client = createBrowserClient(url, anonKey);
  }
  return client;
}
