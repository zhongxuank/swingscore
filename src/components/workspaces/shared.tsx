"use client";

import { useRef } from "react";
import clsx from "clsx";
import Link from "next/link";
import { CheckCircle2, Loader2, Signal, SignalZero } from "lucide-react";
import type { Competitor, Couple, HeatEntry, RawScore, Role, SaveState } from "@/lib/types";
import { formatScore, MIN_SCORE_X2 } from "@/lib/scoring/score-utils";

export type TieHighlightTone = "rose" | "sky" | "violet" | "teal";

export interface ScoreTieHighlight {
  label: string;
  tone: TieHighlightTone;
}

export function AppFrame({
  eyebrow,
  title,
  subtitle,
  children,
  actions
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <main className="min-h-screen px-3 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-4 rounded-[8px] border border-graphite/15 bg-chalk/95 p-4 shadow-panel sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-brass">{eyebrow}</p>
              <h1 className="mt-2 font-display text-3xl font-black leading-tight text-ink sm:text-5xl">{title}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-graphite/75 sm:text-base">{subtitle}</p>
            </div>
            {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}

export function NavButton({
  href,
  children,
  tone = "light",
  testId
}: {
  href: string;
  children: React.ReactNode;
  tone?: "light" | "dark";
  testId?: string;
}) {
  return (
    <Link
      href={href}
      data-testid={testId}
      className={clsx(
        "inline-flex items-center justify-center rounded-[6px] px-4 py-2 text-sm font-bold transition",
        tone === "dark" ? "bg-graphite text-paper hover:bg-ink" : "border border-graphite/15 bg-paper hover:bg-bluepaper"
      )}
    >
      {children}
    </Link>
  );
}

export function Panel({
  title,
  children,
  action,
  className
}: {
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx("min-w-0 rounded-[8px] border border-graphite/15 bg-chalk p-4 shadow-sm", className)}>
      {title || action ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title ? <h2 className="text-lg font-black text-graphite">{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StatusPill({ state }: { state: SaveState }) {
  const icon =
    state === "saving" ? <Loader2 className="animate-spin" size={14} /> : state === "offline" ? <SignalZero size={14} /> : state === "reconnecting" ? <Signal size={14} /> : <CheckCircle2 size={14} />;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 font-mono text-xs uppercase",
        state === "saved" && "bg-celadon/20 text-graphite",
        state === "saving" && "bg-brass/20 text-graphite",
        state === "offline" && "bg-oxblood/15 text-oxblood",
        state === "reconnecting" && "bg-bluepaper text-graphite"
      )}
    >
      {icon}
      {state}
    </span>
  );
}

export function HeatSheetGrid({
  competitors,
  heatEntries,
  className
}: {
  competitors: Competitor[];
  heatEntries: HeatEntry[];
  className?: string;
}) {
  const heatNumbers = Array.from(new Set(heatEntries.map((entry) => entry.heatNumber))).sort((a, b) => a - b);

  return (
    <div className={clsx("grid gap-4 md:grid-cols-2", className)}>
      {heatNumbers.map((heatNumber) => (
        <article key={heatNumber} className="rounded-[8px] border border-graphite/15 bg-paper p-4" data-testid={`heat-card-${heatNumber}`}>
          <h3 className="mb-3 text-lg font-black">Heat {heatNumber}</h3>
          <div className="grid grid-cols-2 gap-3">
            {(["Leader", "Follower"] as Role[]).map((role) => {
              const roleEntries = heatEntries.filter((entry) => entry.heatNumber === heatNumber && entry.role === role);
              return (
                <section key={role} className="min-w-0" data-testid={`heat-${heatNumber}-${role.toLowerCase()}`}>
                  <h4 className="mb-2 rounded-[6px] bg-bluepaper px-2 py-1 text-center font-mono text-xs font-black uppercase tracking-[0.12em] text-graphite">
                    {role}s
                  </h4>
                  <div className="grid gap-2">
                    {roleEntries.map((entry) => {
                      const competitor = competitors.find((item) => item.id === entry.competitorId);
                      return (
                        <div key={entry.id} className="min-w-0 rounded-[6px] bg-chalk px-3 py-2">
                          <p className="font-display text-2xl font-black leading-none text-graphite">{competitor?.bibNumber ?? "?"}</p>
                          <p className="mt-1 truncate text-sm font-bold text-graphite/70">{competitor?.preferredName ?? "Unknown"}</p>
                          {entry.isFiller ? <p className="mt-1 text-xs font-black uppercase text-oxblood">Filler - do not score</p> : null}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </article>
      ))}
    </div>
  );
}

export function ScoreInput({
  score,
  onChange,
  label
}: {
  score: number;
  onChange: (nextScoreX2: number) => void;
  label: string;
}) {
  return (
    <label className="grid min-w-[88px] gap-1 text-xs font-bold uppercase tracking-wide text-graphite/65">
      <span className="sr-only">{label}</span>
      <input
        aria-label={label}
        type="number"
        inputMode="decimal"
        min="0"
        max="100"
        step="0.5"
        value={score === 0 ? "" : formatScore(score)}
        placeholder="0"
        onChange={(event) => onChange(Math.round(Number(event.target.value || 0) * 2))}
        className="h-11 rounded-[6px] border border-graphite/20 bg-paper px-3 text-right text-base font-black text-ink"
      />
    </label>
  );
}

export function ScoreSwipeRow({
  competitor,
  rank,
  scoreX2,
  onChange,
  label,
  statusTone = "neutral",
  tieHighlight
}: {
  competitor: Competitor;
  rank?: number;
  scoreX2: number;
  onChange: (scoreX2: number) => void;
  label?: string;
  statusTone?: "neutral" | "yes" | "alt" | "no";
  tieHighlight?: ScoreTieHighlight;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    mode: "idle" | "scoring" | "scrolling";
  }>({
    pointerId: null,
    startX: 0,
    startY: 0,
    mode: "idle"
  });
  const percentage = Math.max(0, Math.min(100, (scoreX2 / 200) * 100));
  const fillClass = scoreX2 === 0 ? "bg-transparent" : scoreFillClass(statusTone);

  function scoreFromClientX(clientX: number) {
    const rect = rowRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return scoreX2;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return normalizeScoreX2(Math.round(ratio * 200));
  }

  function beginGesture(event: React.PointerEvent<HTMLDivElement>) {
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      mode: "idle"
    };
  }

  function moveGesture(event: React.PointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    if (gesture.pointerId !== event.pointerId || gesture.mode === "scrolling") return;

    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    const horizontal = Math.abs(dx);
    const vertical = Math.abs(dy);
    const verticalIntent = vertical > 8 && vertical > horizontal * 1.15;
    const horizontalIntent = horizontal > 8 && horizontal > vertical * 1.15;

    if (verticalIntent) {
      gesture.mode = "scrolling";
      if (rowRef.current?.hasPointerCapture(event.pointerId)) {
        rowRef.current.releasePointerCapture(event.pointerId);
      }
      return;
    }

    if (gesture.mode === "idle") {
      if (horizontalIntent) {
        gesture.mode = "scoring";
        rowRef.current?.setPointerCapture(event.pointerId);
      } else {
        return;
      }
    }

    event.preventDefault();
    onChange(scoreFromClientX(event.clientX));
  }

  function endGesture(event: React.PointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    if (gesture.pointerId !== event.pointerId) return;

    const dx = Math.abs(event.clientX - gesture.startX);
    const dy = Math.abs(event.clientY - gesture.startY);
    if (gesture.mode === "idle" && dx < 8 && dy < 8) {
      onChange(scoreFromClientX(event.clientX));
    }

    if (rowRef.current?.hasPointerCapture(event.pointerId)) {
      rowRef.current.releasePointerCapture(event.pointerId);
    }

    gestureRef.current = {
      pointerId: null,
      startX: 0,
      startY: 0,
      mode: "idle"
    };
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const largeStep = event.shiftKey ? 10 : 1;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      onChange(scoreX2 === 0 ? MIN_SCORE_X2 : Math.min(200, scoreX2 + largeStep));
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      onChange(normalizeScoreX2(scoreX2 - largeStep));
    }
    if (event.key === "Home") {
      event.preventDefault();
      onChange(0);
    }
    if (event.key === "End") {
      event.preventDefault();
      onChange(200);
    }
  }

  return (
    <div
      ref={rowRef}
      role="slider"
      tabIndex={0}
      data-score-status={scoreX2 === 0 ? "unscored" : statusTone}
      data-score-tie={tieHighlight ? "true" : "false"}
      data-score-tie-group={tieHighlight?.label ?? ""}
      aria-label={label ?? `Score ${competitor.preferredName}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={scoreX2 / 2}
      aria-valuetext={scoreX2 === 0 ? "Unscored" : formatScore(scoreX2)}
      onPointerDown={beginGesture}
      onPointerMove={moveGesture}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      onKeyDown={handleKeyDown}
      className={clsx(
        "relative min-h-[76px] cursor-ew-resize overflow-hidden rounded-[8px] border p-3 shadow-sm touch-pan-y select-none",
        tieHighlight ? tieRowClass(tieHighlight.tone) : "border-graphite/10 bg-paper"
      )}
      style={{ touchAction: "pan-y" }}
    >
      <div
        aria-hidden="true"
        className={clsx("pointer-events-none absolute inset-y-0 left-0 transition-[width] duration-150", fillClass)}
        style={{ width: `${percentage}%` }}
      />
      <div className="relative grid min-h-[58px] grid-cols-[minmax(0,1fr)_84px] items-center gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-baseline gap-3">
            <p className="font-display text-[2.45rem] font-black leading-none text-graphite sm:text-[2.75rem]">{competitor.bibNumber}</p>
            {rank ? (
              <span className="rounded-full bg-brass/15 px-2 py-1 font-mono text-xs font-black uppercase text-brass">
                Rank {rank}
              </span>
            ) : null}
          </div>
          <p className="mt-1 truncate text-sm font-black text-graphite/70">{competitor.preferredName}</p>
        </div>
        <div
          className={clsx(
            "rounded-[6px] px-3 py-2 text-right shadow-sm",
            tieHighlight ? tieScoreClass(tieHighlight.tone) : "bg-chalk/85"
          )}
        >
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-graphite/45">Score</p>
          <p className="font-display text-2xl font-black leading-none text-ink">{formatScore(scoreX2)}</p>
        </div>
      </div>
    </div>
  );
}

function tieRowClass(tone: TieHighlightTone) {
  if (tone === "sky") return "border-sky-600/75 bg-sky-100/70 ring-2 ring-sky-500/45";
  if (tone === "violet") return "border-violet-600/75 bg-violet-100/70 ring-2 ring-violet-500/45";
  if (tone === "teal") return "border-teal-700/75 bg-teal-100/70 ring-2 ring-teal-500/45";
  return "border-oxblood/75 bg-oxblood/10 ring-2 ring-oxblood/45";
}

function tieScoreClass(tone: TieHighlightTone) {
  if (tone === "sky") return "bg-sky-100 ring-2 ring-sky-500/65";
  if (tone === "violet") return "bg-violet-100 ring-2 ring-violet-500/65";
  if (tone === "teal") return "bg-teal-100 ring-2 ring-teal-500/65";
  return "bg-oxblood/15 ring-2 ring-oxblood/60";
}

function normalizeScoreX2(scoreX2: number) {
  return scoreX2 < MIN_SCORE_X2 ? 0 : scoreX2;
}

function scoreFillClass(statusTone: "neutral" | "yes" | "alt" | "no") {
  if (statusTone === "yes") return "bg-celadon/40";
  if (statusTone === "alt") return "bg-brass/35";
  if (statusTone === "no") return "bg-oxblood/20";
  return "bg-celadon/30";
}

export function competitorLabel(competitor?: Competitor) {
  if (!competitor) return "Unknown";
  return `${competitor.role[0]}${competitor.bibNumber} ${competitor.preferredName}`;
}

export function coupleLabel(couple: Couple, competitors: Competitor[]) {
  const leader = competitors.find((competitor) => competitor.id === couple.leaderId);
  const follower = competitors.find((competitor) => competitor.id === couple.followerId);
  return `L${leader?.bibNumber ?? "?"}/F${follower?.bibNumber ?? "?"}`;
}

export function updateScore(scores: RawScore[], subjectId: string, scoreX2: number, judgeId: string): RawScore[] {
  return scores.map((score) =>
    score.subjectId === subjectId && score.judgeId === judgeId ? { ...score, scoreX2 } : score
  );
}
