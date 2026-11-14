"use client";

import { useCallback, useEffect, useState } from "react";
import { errorMessage, useContestStore } from "@/components/use-contest-store";
import type { Competitor, DancerRole, Round, RoundCut, RoundResult } from "@/data/types";

const ROLE_TITLE: Record<DancerRole, string> = { leader: "Leaders", follower: "Followers" };

/** The chief judge's stored decision, read only for the organiser. */
export function CallbackResultsSection({ round }: { round: Round }) {
  const store = useContestStore();
  const [cuts, setCuts] = useState<RoundCut[]>([]);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [people, setPeople] = useState<Map<string, Competitor>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [stored, list] = await Promise.all([store.listRoundResults(round.id), store.listCompetitors(round.contestId)]);
      setCuts(stored.cuts);
      setResults(stored.results);
      setPeople(new Map(list.map((c) => [c.id, c])));
    } catch (problem) {
      setError(errorMessage(problem));
    }
  }, [store, round.id, round.contestId]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <section className="space-y-3" aria-label="Callback results">
      <h2 className="text-lg font-semibold">Results</h2>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {cuts.length === 0 ? <p className="text-sm text-gray-600">The chief judge decides the cut on their link once every sheet is in.</p> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cuts.map((cut) => (
          <div key={cut.role}>
            <h3 className="font-semibold">
              {ROLE_TITLE[cut.role]}: {cut.cut} through, {cut.alternates} alternates
            </h3>
            <ol className="mt-1 text-sm">
              {results
                .filter((r) => r.role === cut.role)
                .map((r) => (
                  <li key={r.competitorId} className="flex justify-between border-t border-gray-100 py-0.5">
                    <span>
                      {r.rank}. <span className="font-mono font-semibold">{people.get(r.competitorId)?.bib}</span> {people.get(r.competitorId)?.name}
                    </span>
                    <span className="text-xs text-gray-600">
                      {r.status === "advancing" ? "Through" : r.status === "alternate" ? `Alt ${r.alternateOrder}` : ""}
                    </span>
                  </li>
                ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}
