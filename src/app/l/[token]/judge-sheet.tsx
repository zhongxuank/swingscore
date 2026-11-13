"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { MarkStatus } from "@/core/callback";
import { formatScore, MAX_SCORE } from "@/core/score";
import { useAccessStore } from "@/components/use-access";
import type { AccessView } from "@/data/access";
import type { DancerRole } from "@/data/types";
import { buildRoleSheet, sheetMarks, submitProblems, tapToTenths, type SheetRow } from "@/lib/judge-sheet";
import { createScoreQueue, type QueueState } from "@/lib/score-queue";

const DOUBLE_TAP_MS = 350;

const BAND: Record<MarkStatus | "none", { row: string; marker: string; label: string }> = {
  yes: { row: "bg-green-50", marker: "bg-green-600", label: "Yes" },
  alt: { row: "bg-yellow-50", marker: "bg-yellow-500", label: "Alt" },
  no: { row: "bg-red-50", marker: "bg-red-500", label: "No" },
  none: { row: "bg-white", marker: "bg-gray-700", label: "" }
};

const ROLE_TITLE: Record<DancerRole, string> = { leader: "Leaders", follower: "Followers" };

function queueStorage(token: string) {
  const key = `swingscore-scores-${token.slice(0, 16)}`;
  return {
    read: () => {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    write: (value: string) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // No storage (private mode): changes still send, they just don't survive a reload.
      }
    }
  };
}

export function JudgeSheet({ token, view, onReload }: { token: string; view: AccessView; onReload: () => Promise<void> }) {
  const access = useAccessStore();
  const [role, setRole] = useState<DancerRole>(view.roles[0]);
  const [mode, setMode] = useState<"heat" | "all">("heat");
  const [heatNumber, setHeatNumber] = useState(1);
  const [scores, setScores] = useState<Map<string, number>>(() => new Map(view.scores.map((s) => [s.competitorId, s.tenths])));
  const [queueState, setQueueState] = useState<QueueState>({ status: "saved", pending: [], rejected: null });
  const [submitted, setSubmitted] = useState<Set<DancerRole>>(() => new Set(view.submitted));
  const [confirming, setConfirming] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const queueRef = useRef<ReturnType<typeof createScoreQueue> | null>(null);
  const lastChange = useRef(0);
  const lastTap = useRef<{ id: string; at: number } | null>(null);

  // Start the save queue once. Unsent changes from an earlier visit win over what the server sent.
  useEffect(() => {
    const queue = createScoreQueue({
      storage: queueStorage(token),
      send: (change) => access.saveScore(token, change.competitorId, change.tenths, change.changedAt),
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

  const sheet = useMemo(() => buildRoleSheet(view, role), [view, role]);
  const marks = useMemo(() => sheetMarks(sheet, scores, view.round.yesCount, view.round.altCount), [sheet, scores, view.round]);
  const isChief = view.judge?.isChief ?? false;
  const problems = submitProblems(sheet, scores, marks, isChief);
  const tiedBibs = new Set((isChief ? marks.equalScores : marks.boundaryTies).flat());
  const locked = submitted.has(role) || view.round.status === "complete";

  function setScore(competitorId: string, tenths: number | null) {
    if (locked) return;
    const now = Math.max(Date.now(), lastChange.current + 1);
    lastChange.current = now;
    setScores((current) => {
      const next = new Map(current);
      if (tenths === null) next.delete(competitorId);
      else next.set(competitorId, Math.min(Math.max(tenths, 0), MAX_SCORE));
      return next;
    });
    setConfirming(false);
    queueRef.current?.enqueue({ competitorId, tenths: tenths === null ? null : Math.min(Math.max(tenths, 0), MAX_SCORE), changedAt: new Date(now).toISOString() });
  }

  function onTrackTap(event: PointerEvent<HTMLDivElement>, row: SheetRow) {
    if (row.redancer || locked) return;
    const now = event.timeStamp;
    const previous = lastTap.current;
    lastTap.current = { id: row.competitorId, at: now };
    if (!previous || previous.id !== row.competitorId || now - previous.at > DOUBLE_TAP_MS) return;
    lastTap.current = null;
    if (scores.has(row.competitorId)) {
      setScore(row.competitorId, null);
    } else {
      const rect = event.currentTarget.getBoundingClientRect();
      setScore(row.competitorId, tapToTenths(event.clientX - rect.left, rect.width));
    }
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
      await access.submitSheet(token, role);
      setSubmitted((current) => new Set(current).add(role));
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not submit.");
    }
  }

  const heat = sheet.heats.find((h) => h.number === heatNumber) ?? sheet.heats[0];
  const rows: SheetRow[] =
    mode === "heat"
      ? (heat?.rows ?? [])
      : [...sheet.dancers].sort((a, b) => (scores.get(b.competitorId) ?? -1) - (scores.get(a.competitorId) ?? -1));
  const scoredCount = sheet.dancers.filter((d) => scores.has(d.competitorId)).length;

  const statusText =
    queueState.status === "saved" ? "Saved" : queueState.status === "saving" ? "Saving…" : `Offline, ${queueState.pending.length} waiting`;

  return (
    <main className="pb-28">
      <div className="sticky top-0 z-10 space-y-2 border-b border-gray-200 bg-white px-4 py-2">
        <div className="flex items-center justify-between text-sm">
          <span aria-live="polite" role="status" className={queueState.status === "offline" ? "font-semibold text-red-700" : "text-gray-600"}>
            {statusText}
          </span>
          <span className="text-gray-600">
            {scoredCount} of {sheet.dancers.length} scored
            {view.round.yesCount !== null ? ` · Yes ${view.round.yesCount}, Alt ${view.round.altCount}` : ""}
          </span>
        </div>

        {view.roles.length > 1 ? (
          <div className="flex gap-2" role="tablist" aria-label="Role">
            {view.roles.map((r) => (
              <button
                key={r}
                type="button"
                role="tab"
                aria-selected={r === role}
                onClick={() => setRole(r)}
                className={`flex-1 rounded px-3 py-1.5 text-sm font-medium ${r === role ? "bg-gray-900 text-white" : "border border-gray-300"}`}
              >
                {ROLE_TITLE[r]}
                {submitted.has(r) ? " ✓" : ""}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMode("heat")}
            aria-pressed={mode === "heat"}
            className={`rounded px-2 py-1 text-sm ${mode === "heat" ? "bg-gray-200 font-semibold" : ""}`}
          >
            Heat
          </button>
          {mode === "heat"
            ? sheet.heats.map((h) => (
                <button
                  key={h.number}
                  type="button"
                  onClick={() => setHeatNumber(h.number)}
                  aria-label={`Heat ${h.number}`}
                  aria-pressed={heat?.number === h.number}
                  className={`h-8 w-8 rounded text-sm ${heat?.number === h.number ? "bg-gray-900 text-white" : "border border-gray-300"}`}
                >
                  {h.number}
                </button>
              ))
            : null}
          <button
            type="button"
            onClick={() => setMode("all")}
            aria-pressed={mode === "all"}
            className={`ml-auto rounded px-2 py-1 text-sm ${mode === "all" ? "bg-gray-200 font-semibold" : ""}`}
          >
            Overall
          </button>
        </div>

        {/* Reserved line, so a tie message never pushes the rows around. */}
        <p className="min-h-5 text-xs text-purple-800" aria-live="polite">
          {tiedBibs.size > 0 ? `${isChief ? "Equal scores" : "Tie across a boundary"}: ${[...tiedBibs].join(", ")}` : ""}
        </p>
      </div>

      {locked ? (
        <p className="mx-4 mt-3 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-900">
          {ROLE_TITLE[role]} submitted. Ask the organiser if you need to change a score.
        </p>
      ) : null}
      {queueState.rejected ? (
        <p role="alert" className="mx-4 mt-3 text-sm text-red-700">
          A score was not saved: {queueState.rejected.message}
        </p>
      ) : null}

      {sheet.heats.length === 0 ? <p className="p-4 text-sm text-gray-600">Heats are not ready yet. Check back soon.</p> : null}

      <ul className="divide-y divide-gray-200" aria-label={`${ROLE_TITLE[role]} sheet`}>
        {rows.map((row) => {
          const score = scores.get(row.competitorId);
          const band = BAND[row.redancer || score === undefined ? "none" : (marks.status.get(row.competitorId) ?? "none")];
          const tied = !row.redancer && tiedBibs.has(row.bib);
          return (
            <li
              key={`${row.competitorId}-${row.redancer}`}
              className={`flex items-center gap-2 px-2 py-1 ${row.redancer ? "bg-gray-100 text-gray-400" : band.row} ${tied ? "ring-2 ring-inset ring-purple-500" : ""}`}
              aria-label={`Bib ${row.bib}${row.redancer ? ", redancer" : ""}`}
            >
              <span className="w-12 shrink-0 text-center font-mono text-lg font-bold">{row.bib}</span>
              {row.redancer ? (
                <span className="flex-1 text-sm">Redancer, scored in heat {sheet.dancers.find((d) => d.competitorId === row.competitorId)?.heatNumber}</span>
              ) : (
                <div
                  data-testid={`track-${row.bib}`}
                  onPointerUp={(event) => onTrackTap(event, row)}
                  className="relative h-11 flex-1 cursor-pointer rounded border border-gray-300 bg-white/60"
                  style={{ touchAction: "manipulation" }}
                  aria-label={`Score track for bib ${row.bib}. Double tap to ${score === undefined ? "score" : "clear"}.`}
                >
                  <div className="pointer-events-none absolute inset-y-0 left-1/2 border-l border-dashed border-gray-300" />
                  {score !== undefined ? (
                    <div
                      className={`pointer-events-none absolute top-1 bottom-1 w-1.5 -translate-x-1/2 rounded ${band.marker}`}
                      style={{ left: `${(score / MAX_SCORE) * 100}%` }}
                    />
                  ) : null}
                </div>
              )}
              {!row.redancer ? (
                <div className="flex w-28 shrink-0 items-center justify-end gap-1">
                  {score !== undefined && !locked ? (
                    <button type="button" aria-label={`Lower ${row.bib} by 0.1`} onClick={() => setScore(row.competitorId, score - 1)} className="h-9 w-7 rounded border border-gray-300 text-sm">
                      −
                    </button>
                  ) : null}
                  <span className="w-12 text-right font-mono text-sm" data-testid={`score-${row.bib}`}>
                    {score !== undefined ? formatScore(score) : "–"}
                  </span>
                  {score !== undefined && !locked ? (
                    <button type="button" aria-label={`Raise ${row.bib} by 0.1`} onClick={() => setScore(row.competitorId, score + 1)} className="h-9 w-7 rounded border border-gray-300 text-sm">
                      +
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {!locked ? (
        <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white px-4 py-3">
          <div className="mx-auto max-w-3xl space-y-1">
            {problems.length > 0 ? <p className="text-xs text-gray-600">{problems[0]}</p> : null}
            {submitError ? (
              <p role="alert" className="text-xs text-red-700">
                {submitError}
              </p>
            ) : null}
            <button
              type="button"
              disabled={problems.length > 0}
              onClick={() => void onSubmit()}
              className="w-full rounded bg-gray-900 px-4 py-2.5 font-medium text-white disabled:opacity-40"
            >
              {confirming ? `Tap again to submit ${ROLE_TITLE[role].toLowerCase()}` : `Submit ${ROLE_TITLE[role].toLowerCase()}`}
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
