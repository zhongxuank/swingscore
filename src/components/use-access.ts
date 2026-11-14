"use client";

import { createClient } from "@supabase/supabase-js";
import { useMemo } from "react";
import type { AccessStore } from "@/data/access";
import { createSupabaseAccess } from "@/data/supabase-access";
import { supabaseConfig } from "@/lib/supabase/config";

/** The store a private link uses. It never signs in or keeps a session: the token is the only credential. */
export function useAccessStore(): AccessStore {
  return useMemo(() => {
    const { url, anonKey } = supabaseConfig();
    return createSupabaseAccess(createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } }));
  }, []);
}
