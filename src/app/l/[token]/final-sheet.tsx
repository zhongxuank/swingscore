"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MAX_SCORE } from "@/core/score";
import { useAccessStore } from "@/components/use-access";
import type { AccessView } from "@/data/access";
import { createScoreQueue, type QueueState } from "@/lib/score-queue";
import { queueStorage } from "./judge-sheet";
import { ScoreTrack } from "./score-track";

/** A final judge's sheet: one row per couple, every score different, then submit. */
export function FinalSheet({ token, view, onReload }: { token: string; view: AccessView; onReload: () => Promise<void> }) {
  const access = useAccessStore();
  const [scores, setScores] = useState<Map<string, number>>(() => new Map(view.finalScores.map((s) => [s.coupleId, s.tenths])));
  const [queueState, setQueueState] = useState<QueueState>({ status: "saved", pending: [], rejected: null });
  const [submitted, setSubmitted] = useState(view.finalSubmitted);
  const [confirming, setConfirming] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const queueRef = useRef<ReturnType<typeof createScoreQueue> | null>(null);
  const lastChange = useRef(0);

  useEffect(() => {
    const queue = createScoreQueue({
      storage: queueStorage(token, "final"),
      send: (change) => access.saveFinalScore(token, change.competitorId, change.tenths, change.changedAt),
      onChange: setQueueState
    });
    queueRef.current = queue;
    const unsent = queue.state().pending;
    if (unsent.length > 0) {
      setScores((current) => {
        const next = new Map(current);
        for (const change of unsent) {
          if (change.tenths === null) next.delete(change.competitorId);
          else next.set(change.competitorId, change.tenths);
        }
        return next;
      });
      queue.retry();
    }
    const onOnline = () => queue.retry();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [access, token]);

  const bib = useMemo(() => new Map(view.competitors.map((c) => [c.id, c.bib])), [view.competitors]);
  const locked = submitted || view.round.status === "complete";

  const ranks = new Map([...scores.entries()].sort((a, b) => b[1] - a[1]).map(([id], index) => [id, index + 1]));
  const counts = new Map<number, number>();
  for (const value of scores.values()) counts.set(value, (counts.get(value) ?? 0) + 1);
  const equal = view.couples.filter((c) => (counts.get(scores.get(c.id) ?? -1) ?? 0) > 1).map((c) => c.number);
  const missing = view.couples.filter((c) => !scores.has(c.id)).length;
  const problem =
    view.couples.length === 0
      ? "The couples are not set yet."
      : missing > 0
        ? `${missing} ${missing === 1 ? "couple still needs" : "couples still need"} a score.`
        : equal.length > 0
          ? `Couples ${equal.join(", ")} have the same score. Every couple needs a different score.`
          : null;

  function setScore(coupleId: string, tenths: number | null) {
    if (locked) return;
    const now = Math.max(Date.now(), lastChange.current + 1);
    lastChange.current = now;
    const value = tenths === null ? null : Math.min(Math.max(tenths, 0), MAX_SCORE);
    setScores((current) => {
      const next = new Map(current);
      if (value === null) next.delete(coupleId);
      else next.set(coupleId, value);
      return next;
    });
    setConfirming(false);
    queueRef.current?.enqueue({ competitorId: coupleId, tenths: value, changedAt: new Date(now).toISOString() });
  }

  async function onSubmit() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    setSubmitError(null);
    if (queueState.pending.length > 0) {
      setSubmitError("Some scores are still saving. Submit again once the status shows Saved.");
      return;
    }
    try {
      await access.submitFinalSheet(token);
      setSubmitted(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not submit.");
    }
  }

  const statusText =
    queueState.status === "saved" ? "Saved" : queueState.status === "saving" ? "Saving…" : `Offline, ${queueState.pending.length} waiting`;

  return (
    <main className="pb-28">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2 text-sm">
        <span role="status" aria-live="polite" className={queueState.status === "offline" ? "font-semibold text-red-700" : "text-gray-600"}>
          {statusText}
        </span>
        <span className="text-gray-600">
          {view.couples.length - missing} of {view.couples.length} scored
        </span>
      </div>
      {locked ? (
        <p className="mx-4 mt-3 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-900">Final submitted. Ask the organiser if you need to change a score.</p>
      ) : null}
      {queueState.rejected ? (
        <p role="alert" className="mx-4 mt-3 text-sm text-red-700">
          A score was not saved: {queueState.rejected.message}
        </p>
      ) : null}

      <ul className="divide-y divide-gray-200" aria-label="Final sheet">
        {view.couples.map((couple) => {
          const score = scores.get(couple.id);
          const tied = equal.includes(couple.number);
          return (
            <li key={couple.id} aria-label={`Couple ${couple.number}`} className={`flex items-center gap-2 px-2 py-1 ${tied ? "ring-2 ring-inset ring-purple-500" : ""}`}>
              <span className="w-16 shrink-0 text-center leading-tight">
                <span className="block font-mono text-lg font-bold">{couple.number}</span>
                <span className="block text-[11px] text-gray-500">
                  {bib.get(couple.leaderId)} / {bib.get(couple.followerId)}
                </span>
              </span>
              <ScoreTrack
                label={`couple ${couple.number}`}
                testId={`couple-${couple.number}`}
                score={score}
                markerClass="bg-gray-800"
                locked={locked}
                onChange={(tenths) => setScore(couple.id, tenths)}
              />
              <span className="w-8 text-right text-xs text-gray-500">{score !== undefined ? `#${ranks.get(couple.id)}` : ""}</span>
            </li>
          );
        })}
      </ul>

      {!locked ? (
        <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white px-4 py-3">
          <div className="mx-auto max-w-3xl space-y-1">
            {problem ? <p className="text-xs text-gray-600">{problem}</p> : null}
            {submitError ? (
              <p role="alert" className="text-xs text-red-700">
                {submitError}
              </p>
            ) : null}
            <button type="button" disabled={problem !== null} onClick={() => void onSubmit()} className="w-full rounded bg-gray-900 px-4 py-2.5 font-medium text-white disabled:opacity-40">
              {confirming ? "Tap again to submit the final" : "Submit final"}
            </button>
          </div>
        </div>
      ) : (
        <div className="px-4 py-3">
          <button type="button" onClick={() => void onReload()} className="text-sm text-gray-600 underline">
            Refresh
          </button>
        </div>
      )}
    </main>
  );
}
