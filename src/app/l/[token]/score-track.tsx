"use client";

import { useRef, type PointerEvent } from "react";
import { formatScore, MAX_SCORE } from "@/core/score";
import { tapToTenths } from "@/lib/judge-sheet";

const DOUBLE_TAP_MS = 350;

/**
 * One row's scoring control: double tap the track to set a score where you tapped, double tap again to clear it,
 * and nudge by 0.1 with the buttons. `label` names the row for screen readers and tests.
 */
export function ScoreTrack({
  label,
  testId,
  score,
  markerClass,
  locked,
  onChange
}: {
  label: string;
  testId: string;
  score: number | undefined;
  markerClass: string;
  locked: boolean;
  onChange: (tenths: number | null) => void;
}) {
  const lastTap = useRef<number | null>(null);

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (locked) return;
    const now = event.timeStamp;
    const previous = lastTap.current;
    lastTap.current = now;
    if (previous === null || now - previous > DOUBLE_TAP_MS) return;
    lastTap.current = null;
    if (score !== undefined) {
      onChange(null);
    } else {
      const rect = event.currentTarget.getBoundingClientRect();
      onChange(tapToTenths(event.clientX - rect.left, rect.width));
    }
  }

  return (
    <>
      <div
        data-testid={`track-${testId}`}
        onPointerUp={onPointerUp}
        className="relative h-11 flex-1 cursor-pointer rounded border border-gray-300 bg-white/60"
        style={{ touchAction: "manipulation" }}
        aria-label={`Score track for ${label}. Double tap to ${score === undefined ? "score" : "clear"}.`}
      >
        <div className="pointer-events-none absolute inset-y-0 left-1/2 border-l border-dashed border-gray-300" />
        {score !== undefined ? (
          <div className={`pointer-events-none absolute top-1 bottom-1 w-1.5 -translate-x-1/2 rounded ${markerClass}`} style={{ left: `${(score / MAX_SCORE) * 100}%` }} />
        ) : null}
      </div>
      <div className="flex w-28 shrink-0 items-center justify-end gap-1">
        {score !== undefined && !locked ? (
          <button type="button" aria-label={`Lower ${testId} by 0.1`} onClick={() => onChange(Math.max(score - 1, 0))} className="h-9 w-7 rounded border border-gray-300 text-sm">
            −
          </button>
        ) : null}
        <span className="w-12 text-right font-mono text-sm" data-testid={`score-${testId}`}>
          {score !== undefined ? formatScore(score) : "–"}
        </span>
        {score !== undefined && !locked ? (
          <button type="button" aria-label={`Raise ${testId} by 0.1`} onClick={() => onChange(Math.min(score + 1, MAX_SCORE))} className="h-9 w-7 rounded border border-gray-300 text-sm">
            +
          </button>
        ) : null}
      </div>
    </>
  );
}
