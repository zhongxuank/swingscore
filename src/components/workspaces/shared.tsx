"use client";

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
    <section className={clsx("rounded-[8px] border border-graphite/15 bg-chalk p-4 shadow-sm", className)}>
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
