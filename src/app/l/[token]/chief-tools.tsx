"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAccessStore } from "@/components/use-access";
import type { AccessView, RoundScores } from "@/data/access";
import type { DancerRole } from "@/data/types";
import { roleResults } from "@/lib/chief-results";

const ROLE_TITLE: Record<DancerRole, string> = { leader: "Leaders", follower: "Followers" };
const STATUS_STYLE = { advancing: "bg-green-100 text-green-900", alternate: "bg-yellow-100 text-yellow-900", out: "text-gray-500" } as const;

/** The chief judge's tools for a callback round: the Yes and Alternate counts, then the combined ranking and the cut. */
export function ChiefTools({ token, view, onReload }: { token: string; view: AccessView; onReload: () => Promise<void> }) {
  const access = useAccessStore();
  const [data, setData] = useState<RoundScores | null>(null);
  const [yes, setYes] = useState(String(view.round.yesCount ?? ""));
  const [alt, setAlt] = useState(String(view.round.altCount ?? ""));
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await access.loadRoundScores(token));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load the scores.");
    }
  }, [access, token]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, [load]);

  async function onCounts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    try {
      await access.setCallbackCounts(token, Number(yes), Number(alt));
      await onReload();
      setMessage("Counts saved. Judges see them when they next load their sheet.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save the counts.");
    }
  }

  return (
    <main className="space-y-6 p-4">
      <form onSubmit={onCounts} className="space-y-2 rounded border border-gray-200 p-3" aria-label="Callback counts">
        <h2 className="font-semibold">Marks per judge</h2>
        <p className="text-xs text-gray-600">Set these before judging starts. Each judge&apos;s top scores become Yes, the next become Alternates.</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            Yes
            <input type="number" min={0} inputMode="numeric" value={yes} onChange={(e) => setYes(e.target.value)} className="ml-2 w-20 rounded border border-gray-300 px-2 py-1" />
          </label>
          <label className="text-sm">
            Alternates
            <input type="number" min={0} inputMode="numeric" value={alt} onChange={(e) => setAlt(e.target.value)} className="ml-2 w-20 rounded border border-gray-300 px-2 py-1" />
          </label>
          <button type="submit" disabled={yes === "" || alt === ""} className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
            Save counts
          </button>
        </div>
      </form>

      {message ? (
        <p role="status" className="text-sm text-gray-700">
          {message}
        </p>
      ) : null}

      {!data ? (
        <p className="text-sm text-gray-500">Loading scores…</p>
      ) : view.round.yesCount === null || view.round.altCount === null ? (
        <p className="text-sm text-gray-600">Set the counts first. The ranking appears once judges submit.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {(["leader", "follower"] as const).map((role) => (
            <RoleColumn key={role} role={role} token={token} view={view} data={data} onDecided={load} />
          ))}
        </div>
      )}
    </main>
  );
}

function RoleColumn({ role, token, view, data, onDecided }: { role: DancerRole; token: string; view: AccessView; data: RoundScores; onDecided: () => Promise<void> }) {
  const access = useAccessStore();
  const decided = data.cuts.find((c) => c.role === role);
  const [cut, setCut] = useState(String(decided?.cut ?? view.round.yesCount ?? 0));
  const [alternates, setAlternates] = useState(String(decided?.alternates ?? Math.min(view.round.altCount ?? 0, 3)));
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cutNumber = Math.max(0, Number(cut) || 0);
  const altNumber = Math.min(3, Math.max(0, Number(alternates) || 0));
  const { waiting, rows, cutTie } = roleResults(view, data, role, cutNumber, altNumber);

  async function onDecide() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    setError(null);
    try {
      await access.decideCut(token, role, cutNumber, altNumber, rows);
      await onDecided();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not save the cut.");
    }
  }

  return (
    <section aria-label={`${ROLE_TITLE[role]} results`} className="space-y-3">
      <h2 className="text-lg font-semibold">{ROLE_TITLE[role]}</h2>
      {waiting.length > 0 ? (
        <p className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm">Waiting for: {waiting.join(", ")}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              Advance
              <input aria-label={`${ROLE_TITLE[role]} advancing`} type="number" min={0} inputMode="numeric" value={cut} onChange={(e) => { setCut(e.target.value); setConfirming(false); }} className="ml-2 w-20 rounded border border-gray-300 px-2 py-1" />
            </label>
            <label className="text-sm">
              Alternates
              <input aria-label={`${ROLE_TITLE[role]} alternates`} type="number" min={0} max={3} inputMode="numeric" value={alternates} onChange={(e) => { setAlternates(e.target.value); setConfirming(false); }} className="ml-2 w-16 rounded border border-gray-300 px-2 py-1" />
            </label>
          </div>
          {cutTie ? (
            <p role="alert" className="text-sm text-purple-800">
              Tied across the cut: {cutTie.join(", ")}. Change the cut, or fix your own equal scores on your sheet.
            </p>
          ) : null}
          {decided ? (
            <p className="text-sm text-green-800">
              Decided: {decided.cut} advance, {decided.alternates} alternates. You can change it and decide again.
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void onDecide()}
            disabled={cutTie !== null || rows.length === 0}
            className="w-full rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {confirming ? `Tap again to confirm ${cutNumber} ${ROLE_TITLE[role].toLowerCase()}` : `Decide ${ROLE_TITLE[role].toLowerCase()} cut`}
          </button>
          {error ? (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="py-1">#</th>
                <th>Bib</th>
                <th className="text-right">Points</th>
                <th className="text-right">CJ</th>
                <th className="text-right">Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.competitorId} className="border-t border-gray-100">
                  <td className="py-1">{row.rank}</td>
                  <td className="font-mono font-semibold">{row.bib}</td>
                  <td className="text-right">{(row.pointsX100 / 100).toFixed(1)}</td>
                  <td className="text-right text-gray-600">{row.chiefScore === null ? "–" : (row.chiefScore / 10).toFixed(1)}</td>
                  <td className="text-right">
                    <span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_STYLE[row.status]}`}>
                      {row.status === "advancing" ? "In" : row.status === "alternate" ? `Alt ${row.alternateOrder}` : "Out"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
