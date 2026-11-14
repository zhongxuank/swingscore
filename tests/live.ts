import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";
import { createSupabaseStore } from "../src/data/supabase-store";
import type { ContestStore } from "../src/data/store";

/*
 * Helpers for tests that run against the real Supabase project (SUPABASE_LIVE_TESTS=1).
 * They sign in a throwaway organiser through the app's callback with an admin-generated link,
 * so no email is sent, and delete that organiser (and their contests) afterwards.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const liveDisabled = process.env.SUPABASE_LIVE_TESTS !== "1" || !url || !serviceKey;

const admin = () => createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });

export async function createOrganiser(): Promise<{ email: string; store: () => Promise<ContestStore>; remove: () => Promise<void> }> {
  const email = `swingscore-test-${randomUUID()}@example.com`;
  const password = randomUUID();
  const created = await admin().auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  return {
    email,
    /** The same organiser's data layer, for setting up a test quickly without the screens. */
    store: async () => {
      const client = createClient(url!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
      const signIn = await client.auth.signInWithPassword({ email, password });
      if (signIn.error) throw signIn.error;
      return createSupabaseStore(client);
    },
    remove: async () => {
      await admin().auth.admin.deleteUser(created.data.user.id);
    }
  };
}

export async function signIn(page: Page, email: string, next = "/contests") {
  const link = await admin().auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) throw link.error;
  await page.goto(`/auth/callback?token_hash=${link.data.properties.hashed_token}&type=magiclink&next=${encodeURIComponent(next)}`);
  await expect(page).toHaveURL(new RegExp(`${next.replace(/\//g, "\\/")}$`));
}
