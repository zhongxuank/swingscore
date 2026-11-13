import type { Heat } from "@/core/heats";
import { StoreError } from "./store";
import type { Competitor, DancerRole, Round, SavedHeat } from "./types";

/** One stored row of a saved heat. */
export interface HeatSlotRecord {
  role: DancerRole;
  heatNumber: number;
  slot: number;
  competitorId: string;
  redancer: boolean;
}

/** Turns built heats into rows, checking the round is a callback round and every bib is a competitor in that role. */
export function heatsToSlots(round: Pick<Round, "kind">, heats: Heat[], competitors: Competitor[]): HeatSlotRecord[] {
  if (round.kind !== "callback") throw new StoreError("invalid", "Only callback rounds have heats.");
  const byBib = new Map(competitors.map((c) => [c.bib, c]));
  const rows: HeatSlotRecord[] = [];
  for (const heat of heats) {
    for (const [role, list] of [["leader", heat.leaders], ["follower", heat.followers]] as const) {
      list.forEach((entry, index) => {
        const competitor = byBib.get(entry.bib);
        if (!competitor) throw new StoreError("invalid", `Bib ${entry.bib} is not in this contest.`);
        if (competitor.role !== role) throw new StoreError("invalid", `Bib ${entry.bib} is not a ${role}.`);
        rows.push({ role, heatNumber: heat.number, slot: index + 1, competitorId: competitor.id, redancer: entry.redancer });
      });
    }
  }
  return rows;
}

/** Groups stored rows back into heats, in heat and slot order. Rows whose competitor is gone are dropped. */
export function slotsToHeats(rows: HeatSlotRecord[], competitors: Competitor[]): SavedHeat[] {
  const bibs = new Map(competitors.map((c) => [c.id, c.bib]));
  const heats = new Map<number, SavedHeat>();
  const sorted = [...rows].sort((a, b) => a.heatNumber - b.heatNumber || a.slot - b.slot);
  for (const row of sorted) {
    const bib = bibs.get(row.competitorId);
    if (bib === undefined) continue;
    const heat = heats.get(row.heatNumber) ?? { number: row.heatNumber, leaders: [], followers: [] };
    heats.set(row.heatNumber, heat);
    (row.role === "leader" ? heat.leaders : heat.followers).push({ competitorId: row.competitorId, bib, redancer: row.redancer });
  }
  return [...heats.values()].sort((a, b) => a.number - b.number);
}
