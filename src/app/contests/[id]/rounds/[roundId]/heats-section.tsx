"use client";

import { useCallback, useEffect, useState } from "react";
import { buildHeats } from "@/core/heats";
import { errorMessage, useContestStore } from "@/components/use-contest-store";
import type { Competitor, Round, SavedHeat } from "@/data/types";

/** True when the saved heats hold exactly the current competitors (ignoring redancers). */
function heatsMatch(heats: SavedHeat[], competitors: Competitor[]): boolean {
  const onFloor = new Set(heats.flatMap((heat) => [...heat.leaders, ...heat.followers]).filter((slot) => !slot.redancer).map((slot) => slot.competitorId));
  return onFloor.size === competitors.length && competitors.every((c) => onFloor.has(c.id));
}

export function HeatsSection({ round }: { round: Round }) {
  const store = useContestStore();
  const [heats, setHeats] = useState<SavedHeat[] | null>(null);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstRound = round.position === 1;

  const load = useCallback(async () => {
    try {
      const [saved, list] = await Promise.all([store.listHeats(round.id), store.listCompetitors(round.contestId)]);
      setHeats(saved);
      setCompetitors(list);
    } catch (problem) {
      setError(errorMessage(problem));
    }
  }, [store, round.id, round.contestId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onBuild() {
    if (round.maxPerHeat === null) return;
    setBusy(true);
    setError(null);
    try {
      const built = buildHeats({
        leaders: competitors.filter((c) => c.role === "leader").map((c) => c.bib),
        followers: competitors.filter((c) => c.role === "follower").map((c) => c.bib),
        maxPerHeat: round.maxPerHeat
      });
      setHeats(await store.saveHeats(round.id, built));
    } catch (problem) {
      setError(errorMessage(problem));
    }
    setBusy(false);
  }

  if (!heats) return <p className="text-sm text-gray-500">{error ?? "Loading heats…"}</p>;

  const blocked = !firstRound
    ? "Entries for later rounds come from the previous round's cut. Heats for this round arrive with the chief judge tools."
    : round.maxPerHeat === null
      ? "Set Max per heat above, then build heats."
      : competitors.length === 0
        ? "Add competitors to the contest first."
        : null;
  const stale = heats.length > 0 && !heatsMatch(heats, competitors);

  return (
    <section className="space-y-3" aria-label="Heats">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Heats</h2>
        <button
          type="button"
          onClick={() => void onBuild()}
          disabled={busy || blocked !== null}
          className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Building…" : heats.length > 0 ? "Rebuild heats" : "Build heats"}
        </button>
      </div>

      {blocked ? <p className="text-sm text-gray-600">{blocked}</p> : null}
      {stale ? (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Competitors have changed since these heats were built. Rebuild heats to include everyone.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {heats.length > 0 ? (
        <p className="text-sm text-gray-600">
          {heats.length} heats. <span className="rounded bg-amber-100 px-1 font-semibold text-amber-900">R</span> marks a redancer, who is not judged.
        </p>
      ) : null}

      <div className="space-y-4">
        {heats.map((heat) => (
          <div key={heat.number} className="rounded border border-gray-200 p-3" aria-label={`Heat ${heat.number}`}>
            <h3 className="font-semibold">Heat {heat.number}</h3>
            <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
              {([
                ["Leaders", heat.leaders],
                ["Followers", heat.followers]
              ] as const).map(([title, slots]) => (
                <div key={title}>
                  <h4 className="mb-1 text-xs font-semibold uppercase text-gray-500">
                    {title} ({slots.filter((s) => !s.redancer).length}
                    {slots.some((s) => s.redancer) ? ` + ${slots.filter((s) => s.redancer).length} R` : ""})
                  </h4>
                  <ul className="flex flex-wrap gap-1" aria-label={`Heat ${heat.number} ${title.toLowerCase()}`}>
                    {slots.map((slot) => (
                      <li
                        key={`${slot.competitorId}-${slot.redancer}`}
                        className={`rounded px-1.5 py-0.5 font-mono ${slot.redancer ? "bg-amber-100 text-amber-900" : "bg-gray-100"}`}
                      >
                        {slot.bib}
                        {slot.redancer ? <span className="ml-0.5 font-sans font-semibold">R</span> : null}
                        {slot.redancer ? <span className="sr-only"> (redancer)</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
