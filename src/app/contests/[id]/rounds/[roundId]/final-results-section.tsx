"use client";

import { useCallback, useEffect, useState } from "react";
import { errorMessage, useContestStore } from "@/components/use-contest-store";
import type { Competitor, FinalCouple, FinalPlacement, FinalScoreRow, Round, RoundJudge, SheetSubmission } from "@/data/types";
import { finalPlacements, tallyFinal } from "@/lib/final-results";

/** Ticket 8: Relative Placement from the submitted final sheets, the organiser's tie decisions, and publishing. */
export function FinalResultsSection({ round, judges }: { round: Round; judges: RoundJudge[] }) {
  const store = useContestStore();
  const [couples, setCouples] = useState<FinalCouple[]>([]);
  const [people, setPeople] = useState<Map<string, Competitor>>(new Map());
  const [submissions, setSubmissions] = useState<SheetSubmission[]>([]);
  const [scores, setScores] = useState<FinalScoreRow[]>([]);
  const [published, setPublished] = useState<FinalPlacement[]>([]);
  const [tieOrders, setTieOrders] = useState<Record<number, string[]>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [c, s, sc, p, entries] = await Promise.all([
        store.listCouples(round.id),
        store.listSubmissions(round.id),
        store.listFinalScores(round.id),
        store.listPlacements(round.id),
        store.listCompetitors(round.contestId)
      ]);
      setCouples(c);
      setSubmissions(s);
      setScores(sc);
      setPublished(p);
      setPeople(new Map(entries.map((e) => [e.id, e])));
    } catch (problem) {
      setError(errorMessage(problem));
    }
  }, [store, round.id, round.contestId]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, [load]);

  const tally = tallyFinal(couples, judges, submissions, scores, round.chiefJudgeCounts);
  const label = (coupleId: string) => {
    const couple = couples.find((c) => c.id === coupleId);
    if (!couple) return "?";
    return `#${couple.number} (${people.get(couple.leaderId)?.bib ?? "?"} / ${people.get(couple.followerId)?.bib ?? "?"})`;
  };

  const orderFor = (places: [number, number], ids: string[]) => tieOrders[places[0]] ?? ids;
  const move = (places: [number, number], ids: string[], index: number, by: number) => {
    const order = [...orderFor(places, ids)];
    const target = index + by;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    setTieOrders({ ...tieOrders, [places[0]]: order });
  };

  const ready = tally.result
    ? finalPlacements(tally.result, Object.fromEntries(tally.result.unresolved.map((tie) => [tie.places[0], orderFor(tie.places, tie.entryIds)])))
    : null;
  const allTiesDecided = tally.result ? tally.result.unresolved.every((tie) => tieOrders[tie.places[0]] !== undefined) : false;

  async function publish() {
    if (!ready) return;
    setError(null);
    try {
      await store.savePlacements(round.id, ready);
      await load();
    } catch (problem) {
      setError(errorMessage(problem));
    }
  }

  return (
    <section className="space-y-3" aria-label="Final results">
      <h2 className="text-lg font-semibold">Results</h2>
      {tally.waiting.length > 0 ? <p className="text-sm text-gray-600">Waiting for: {tally.waiting.join(", ")}</p> : null}
      {tally.problems.length > 0 ? (
        <ul className="list-disc pl-5 text-sm text-amber-900">
          {tally.problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : null}

      {tally.result ? (
        <>
          <ol className="divide-y divide-gray-100 rounded border border-gray-200 text-sm" aria-label="Relative Placement">
            {tally.result.placements.map((p) => (
              <li key={p.entryId} className="flex justify-between px-3 py-1.5">
                <span>
                  <span className="inline-block w-8 font-semibold">{p.place}</span>
                  {label(p.entryId)}
                </span>
                {p.tied ? <span className="text-xs text-purple-800">tied</span> : null}
              </li>
            ))}
          </ol>

          {tally.result.unresolved.map((tie) => (
            <div key={tie.places[0]} className="space-y-2 rounded border border-purple-300 bg-purple-50 p-3 text-sm" aria-label={`Tie for places ${tie.places[0]} to ${tie.places[1]}`}>
              <p className="font-medium text-purple-900">
                The rules cannot separate places {tie.places[0]} to {tie.places[1]}. Put them in order, then confirm.
              </p>
              <ol className="space-y-1">
                {orderFor(tie.places, tie.entryIds).map((id, index, list) => (
                  <li key={id} className="flex items-center gap-2">
                    <span className="w-8 font-semibold">{tie.places[0] + index}</span>
                    <span className="flex-1">{label(id)}</span>
                    <button type="button" aria-label={`Move ${label(id)} up`} disabled={index === 0} onClick={() => move(tie.places, tie.entryIds, index, -1)} className="rounded border border-gray-300 px-2 disabled:opacity-30">
                      ↑
                    </button>
                    <button type="button" aria-label={`Move ${label(id)} down`} disabled={index === list.length - 1} onClick={() => move(tie.places, tie.entryIds, index, 1)} className="rounded border border-gray-300 px-2 disabled:opacity-30">
                      ↓
                    </button>
                  </li>
                ))}
              </ol>
              {tieOrders[tie.places[0]] === undefined ? (
                <button type="button" onClick={() => setTieOrders({ ...tieOrders, [tie.places[0]]: tie.entryIds })} className="rounded border border-purple-400 px-2 py-1 text-xs">
                  Keep this order
                </button>
              ) : (
                <p className="text-xs text-purple-900">Order chosen.</p>
              )}
            </div>
          ))}

          <button type="button" onClick={() => void publish()} disabled={!ready || !allTiesDecided} className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40">
            {published.length > 0 ? "Publish again" : "Publish placements"}
          </button>
        </>
      ) : null}

      {published.length > 0 ? (
        <p className="text-sm text-green-800">Published. The emcee can now read the placements.</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}
