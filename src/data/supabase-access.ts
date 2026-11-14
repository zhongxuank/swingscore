import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { AccessStore, AccessView, RoundScores } from "./access";
import { StoreError } from "./store";

function toError(error: PostgrestError): Error {
  if (error.code === "P0002") return new StoreError("not_found", error.message);
  if (error.code === "22023" || error.code === "22P02" || error.code === "23503") return new StoreError("invalid", error.message);
  return new Error(`Database error (${error.code}): ${error.message}`);
}

/** AccessStore backed by the Supabase functions. Works signed out: the token is the only credential. */
export function createSupabaseAccess(client: SupabaseClient): AccessStore {
  return {
    async load(token) {
      const { data, error } = await client.rpc("load_access", { token });
      if (error) throw toError(error);
      return (data as AccessView | null) ?? null;
    },

    async saveScore(token, competitorId, tenths, changedAt) {
      const { error } = await client.rpc("save_callback_score", { token, competitor: competitorId, score: tenths, changed_at: changedAt });
      if (error) throw toError(error);
    },

    async submitSheet(token, role) {
      const { error } = await client.rpc("submit_callback_sheet", { token, sheet_role: role });
      if (error) throw toError(error);
    },

    async setCallbackCounts(token, yes, alternates) {
      const { error } = await client.rpc("set_callback_counts", { token, yes, alternates });
      if (error) throw toError(error);
    },

    async loadRoundScores(token) {
      const { data, error } = await client.rpc("load_round_scores", { token });
      if (error) throw toError(error);
      return (data as RoundScores | null) ?? null;
    },

    async decideCut(token, role, cut, alternates, results) {
      const rows = results.map((r) => ({
        competitor_id: r.competitorId,
        rank: r.rank,
        points_x100: r.pointsX100,
        status: r.status,
        alternate_order: r.alternateOrder
      }));
      const { error } = await client.rpc("decide_cut", { token, cut_role: role, cut, alternates, results: rows });
      if (error) throw toError(error);
    },

    async saveFinalScore(token, coupleId, tenths, changedAt) {
      const { error } = await client.rpc("save_final_score", { token, couple: coupleId, score: tenths, changed_at: changedAt });
      if (error) throw toError(error);
    },

    async submitFinalSheet(token) {
      const { error } = await client.rpc("submit_final_sheet", { token });
      if (error) throw toError(error);
    }
  };
}
