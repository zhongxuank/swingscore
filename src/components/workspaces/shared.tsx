"use client";

import { useRef } from "react";
import clsx from "clsx";
import Link from "next/link";
import { CheckCircle2, Loader2, Signal, SignalZero } from "lucide-react";
import type { Competitor, Couple, RawScore, SaveState } from "@/lib/types";
import { formatScore } from "@/lib/scoring/score-utils";

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
  tone = "light"
}: {
  href: string;
  children: React.ReactNode;
  tone?: "light" | "dark";
}) {
  return (
    <Link
      href={href}
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
  instruction = "Swipe sideways to score. Swipe up or down to scroll."
}: {
  competitor: Competitor;
  rank?: number;
  scoreX2: number;
  onChange: (scoreX2: number) => void;
  label?: string;
  instruction?: string;
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

  function scoreFromClientX(clientX: number) {
    const rect = rowRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return scoreX2;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(ratio * 200);
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
      onChange(Math.min(200, scoreX2 + largeStep));
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      onChange(Math.max(0, scoreX2 - largeStep));
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
      className="relative min-h-[76px] cursor-ew-resize overflow-hidden rounded-[8px] border border-graphite/10 bg-paper p-3 shadow-sm touch-pan-y select-none"
      style={{ touchAction: "pan-y" }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 bg-celadon/30 transition-[width] duration-150"
        style={{ width: `${percentage}%` }}
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-3 bottom-2 h-1.5 rounded-full bg-graphite/10">
        <div className="h-full rounded-full bg-brass" style={{ width: `${percentage}%` }} />
      </div>
      <div className="relative grid min-h-[48px] grid-cols-[minmax(0,1fr)_84px] items-center gap-3">
        <div className="min-w-0">
          <p className="text-base font-black text-graphite">
            {rank ? <span className="mr-2 font-mono text-brass">{rank}</span> : null}
            {competitorLabel(competitor)}
          </p>
          <p className="mt-1 text-xs font-bold uppercase tracking-wide text-graphite/55">{instruction}</p>
        </div>
        <div className="rounded-[6px] bg-chalk/85 px-3 py-2 text-right shadow-sm">
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-graphite/45">Score</p>
          <p className="font-display text-2xl font-black leading-none text-ink">{formatScore(scoreX2)}</p>
        </div>
      </div>
    </div>
  );
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
