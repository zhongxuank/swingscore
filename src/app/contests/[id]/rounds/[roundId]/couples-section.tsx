"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildDraw, validateCouples, type DrawDirection, type FollowerOrder } from "@/core/draw";
import { errorMessage, useContestStore } from "@/components/use-contest-store";
import type { Competitor, FinalCouple, Round } from "@/data/types";

/** Ticket 7: generate the final's couples from the draw settings, edit any pair, and save before scoring starts. */
export function CouplesSection({ round }: { round: Round }) {
  const store = useContestStore();
  const [entries, setEntries] = useState<Competitor[]>([]);
  const [saved, setSaved] = useState<FinalCouple[] | null>(null);
  const [locked, setLocked] = useState(false);
  const [followerOrder, setFollowerOrder] = useState<FollowerOrder>("ascending");
  const [direction, setDirection] = useState<DrawDirection>("right");
  const [shift, setShift] = useState("0");
  const [draft, setDraft] = useState<Array<{ leader: string; follower: string }> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, couples, scores] = await Promise.all([store.listRoundEntries(round.id), store.listCouples(round.id), store.listFinalScores(round.id)]);
      setEntries(list);
      setSaved(couples);
      setLocked(scores.length > 0);
    } catch (problem) {
      setError(errorMessage(problem));
    }
  }, [store, round.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const leaders = useMemo(() => entries.filter((c) => c.role === "leader"), [entries]);
  const followers = useMemo(() => entries.filter((c) => c.role === "follower"), [entries]);
  const bibToId = new Map(entries.map((c) => [`${c.role}:${c.bib}`, c.id]));
  const idToBib = new Map(entries.map((c) => [c.id, c.bib]));

  function generate() {
    setError(null);
    try {
      setDraft(buildDraw({ leaders: leaders.map((c) => c.bib), followers: followers.map((c) => c.bib), followerOrder, direction, shift: Number(shift) || 0 }));
    } catch (problem) {
      setError(errorMessage(problem));
    }
  }

  const problems = draft ? validateCouples(draft, leaders.map((c) => c.bib), followers.map((c) => c.bib)) : [];

  async function save() {
    if (!draft) return;
    setError(null);
    try {
      await store.saveCouples(
        round.id,
        draft.map((pair) => ({ leaderId: bibToId.get(`leader:${pair.leader}`)!, followerId: bibToId.get(`follower:${pair.follower}`)! }))
      );
      setDraft(null);
      await load();
    } catch (problem) {
      setError(errorMessage(problem));
    }
  }

  if (!saved) return <p className="text-sm text-gray-500">{error ?? "Loading couples…"}</p>;

  return (
    <section className="space-y-3" aria-label="Couples">
      <h2 className="text-lg font-semibold">Couples</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-600">{round.position === 1 ? "Add competitors to the contest first." : "Waiting for the chief judge to decide the previous round's cut."}</p>
      ) : (
        <p className="text-sm text-gray-600">
          {leaders.length} leaders and {followers.length} followers in this final.
        </p>
      )}

      {saved.length > 0 && !draft ? (
        <ol className="divide-y divide-gray-100 rounded border border-gray-200 text-sm" aria-label="Saved couples">
          {saved.map((couple) => (
            <li key={couple.id} className="flex gap-3 px-3 py-1.5">
              <span className="w-8 font-semibold">{couple.number}</span>
              <span className="font-mono">
                {idToBib.get(couple.leaderId) ?? "?"} / {idToBib.get(couple.followerId) ?? "?"}
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      {locked ? (
        <p className="text-sm text-gray-600">Scoring has started, so the couples are fixed.</p>
      ) : (
        <div className="space-y-3 rounded border border-gray-200 p-3">
          <div className="flex flex-wrap items-end gap-3 text-sm">
            <label>
              Followers
              <select aria-label="Follower order" value={followerOrder} onChange={(e) => setFollowerOrder(e.target.value as FollowerOrder)} className="ml-2 rounded border border-gray-300 px-2 py-1">
                <option value="ascending">ascending</option>
                <option value="descending">descending (flipped)</option>
              </select>
            </label>
            <label>
              Rotate
              <select aria-label="Rotation direction" value={direction} onChange={(e) => setDirection(e.target.value as DrawDirection)} className="ml-2 rounded border border-gray-300 px-2 py-1">
                <option value="right">right</option>
                <option value="left">left</option>
              </select>
            </label>
            <label>
              Shift
              <input aria-label="Shift" type="number" inputMode="numeric" value={shift} onChange={(e) => setShift(e.target.value)} className="ml-2 w-16 rounded border border-gray-300 px-2 py-1" />
            </label>
            <button type="button" onClick={generate} disabled={entries.length === 0} className="rounded border border-gray-300 px-3 py-1.5 disabled:opacity-50">
              Generate couples
            </button>
          </div>

          {draft ? (
            <>
              <ol className="space-y-1 text-sm" aria-label="Draft couples">
                {draft.map((pair, index) => (
                  <li key={pair.leader} className="flex items-center gap-3">
                    <span className="w-8 font-semibold">{index + 1}</span>
                    <span className="w-16 font-mono">L {pair.leader}</span>
                    <select
                      aria-label={`Partner for leader ${pair.leader}`}
                      value={pair.follower}
                      onChange={(e) => setDraft(draft.map((p, i) => (i === index ? { ...p, follower: e.target.value } : p)))}
                      className="rounded border border-gray-300 px-2 py-0.5 font-mono"
                    >
                      {followers.map((f) => (
                        <option key={f.id} value={f.bib}>
                          F {f.bib}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ol>
              {problems.length > 0 ? (
                <ul className="list-disc pl-5 text-sm text-amber-900">
                  {problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              ) : null}
              <div className="flex gap-2">
                <button type="button" onClick={() => void save()} disabled={problems.length > 0} className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
                  Save couples
                </button>
                <button type="button" onClick={() => setDraft(null)} className="rounded border border-gray-300 px-3 py-1.5 text-sm">
                  Cancel
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}
