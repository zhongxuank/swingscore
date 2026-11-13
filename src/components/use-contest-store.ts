"use client";

import { useMemo } from "react";
import type { ContestStore } from "@/data/store";
import { createSupabaseStore } from "@/data/supabase-store";
import { browserSupabase } from "@/lib/supabase/browser";

/** The store screens use. Screens never talk to Supabase directly. */
export function useContestStore(): ContestStore {
  return useMemo(() => createSupabaseStore(browserSupabase()), []);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}
