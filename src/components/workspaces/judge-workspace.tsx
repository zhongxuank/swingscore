"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ListOrdered, Rows3, Search, Trophy } from "lucide-react";
import { demoCompetition, demoCompetitors, demoHeatEntries, demoPrelimScores, demoRound } from "@/lib/data/demo-data";
import type { Competitor, RawScore, SaveState } from "@/lib/types";
import { deriveJudgePrelimMarks } from "@/lib/scoring/prelims";
import { formatScore, validateScoreSheet } from "@/lib/scoring/score-utils";
import { AppFrame, Panel, StatusPill, competitorLabel, updateScore } from "@/components/workspaces/shared";

type JudgeView = "heat" | "rank" | "derived" | "name";

const judgeViews: Array<{ id: JudgeView; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = [
  { id: "heat", label: "Heat", icon: Rows3 },
  { id: "rank", label: "Rank", icon: ListOrdered },
  { id: "derived", label: "Results", icon: Trophy },
  { id: "name", label: "Name", icon: Search }
];

export function JudgeWorkspace({ token }: { token: string }) {
  const judgeId = "judge-1";
  const [scores, setScores] = useState<RawScore[]>(demoPrelimScores.filter((score) => score.judgeId === judgeId));
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [activeView, setActiveView] = useState<JudgeView>("heat");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (saveState !== "saving") return;
    const timeout = window.setTimeout(() => setSaveState("saved"), 450);
    return () => window.clearTimeout(timeout);
  }, [saveState]);

  const leaderMarks = useMemo(
    () =>
      deriveJudgePrelimMarks({
        competitors: demoCompetitors.filter((competitor) => competitor.role === "Leader"),
        scores: scores.filter((score) => score.role === "Leader"),
        requiredYeses: demoRound.requiredYeses,
        requiredAlts: demoRound.requiredAlts
      }),
    [scores]
  );
  const followerMarks = useMemo(
    () =>
      deriveJudgePrelimMarks({
        competitors: demoCompetitors.filter((competitor) => competitor.role === "Follower"),
        scores: scores.filter((score) => score.role === "Follower"),
        requiredYeses: demoRound.requiredYeses,
        requiredAlts: demoRound.requiredAlts
      }),
    [scores]
  );

  const validationErrors = [
    ...validateScoreSheet(scores.filter((score) => score.role === "Leader"), false),
    ...validateScoreSheet(scores.filter((score) => score.role === "Follower"), false),
    ...leaderMarks.ties.map((tie) => `Leader ${tie.kind} boundary tie at ${tie.boundary}.`),
    ...followerMarks.ties.map((tie) => `Follower ${tie.kind} boundary tie at ${tie.boundary}.`)
  ];

  function changeScore(subjectId: string, scoreX2: number) {
    setScores((current) => updateScore(current, subjectId, scoreX2, judgeId));
    setSaveState(window.navigator.onLine ? "saving" : "offline");
    setSubmitted(false);
  }

  return (
    <AppFrame
      eyebrow={`Judge link / ${token}`}
      title={demoCompetition.division}
      subtitle="Enter raw scores only. SwingScore derives callbacks, alternates, rankings, and submit validation."
      actions={<StatusPill state={saveState} />}
    >
      <div className="mx-auto max-w-3xl">
        <nav className="no-print sticky top-2 z-10 mb-3 grid grid-cols-4 gap-2 rounded-[8px] border border-graphite/15 bg-chalk/95 p-2 shadow-panel backdrop-blur">
          {judgeViews.map((view) => (
            <button
              key={view.id}
              type="button"
              onClick={() => setActiveView(view.id)}
              className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-[6px] text-xs font-black ${
                activeView === view.id ? "bg-graphite text-paper" : "bg-paper text-graphite"
              }`}
            >
              <view.icon size={17} />
              {view.label}
            </button>
          ))}
        </nav>

        {validationErrors.length > 0 ? (
          <div className="mb-3 rounded-[8px] border border-oxblood/20 bg-oxblood/10 p-3 text-sm font-bold text-oxblood">
            {validationErrors.join(" ")}
          </div>
        ) : null}

        <Panel title={viewTitle(activeView)}>
          {activeView === "heat" ? <HeatScoreList scores={scores} onChange={changeScore} /> : null}
          {activeView === "rank" ? <RankScoreList scores={scores} onChange={changeScore} /> : null}
          {activeView === "derived" ? <DerivedList marks={[...leaderMarks.marks, ...followerMarks.marks]} /> : null}
          {activeView === "name" ? <NameScoreList scores={scores} onChange={changeScore} /> : null}
        </Panel>

        <div className="no-print sticky bottom-3 mt-3 rounded-[8px] border border-graphite/15 bg-chalk/95 p-3 shadow-panel backdrop-blur">
          <button
            type="button"
            disabled={validationErrors.length > 0}
            onClick={() => setSubmitted(true)}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[6px] bg-graphite px-4 py-3 text-base font-black text-paper disabled:cursor-not-allowed disabled:bg-graphite/35"
          >
            <Check size={19} />
            {submitted ? "Submitted" : "Submit scores"}
          </button>
        </div>
      </div>
    </AppFrame>
  );
}

function HeatScoreList({ scores, onChange }: { scores: RawScore[]; onChange: (subjectId: string, scoreX2: number) => void }) {
  return (
    <div className="grid gap-4">
      {[1, 2].map((heat) => (
        <section key={heat}>
          <h3 className="mb-2 font-mono text-xs font-black uppercase tracking-[0.18em] text-graphite/55">Heat {heat}</h3>
          <ScoreRows
            scores={scores}
            subjectIds={demoHeatEntries.filter((entry) => entry.heatNumber === heat).map((entry) => entry.competitorId)}
            onChange={onChange}
          />
        </section>
      ))}
    </div>
  );
}

function RankScoreList({ scores, onChange }: { scores: RawScore[]; onChange: (subjectId: string, scoreX2: number) => void }) {
  const subjectIds = scores.slice().sort((a, b) => b.scoreX2 - a.scoreX2).map((score) => score.subjectId);
  return <ScoreRows scores={scores} subjectIds={subjectIds} onChange={onChange} showRank />;
}

function NameScoreList({ scores, onChange }: { scores: RawScore[]; onChange: (subjectId: string, scoreX2: number) => void }) {
  const subjectIds = demoCompetitors
    .slice()
    .sort((a, b) => a.preferredName.localeCompare(b.preferredName))
    .map((competitor) => competitor.id);
  return <ScoreRows scores={scores} subjectIds={subjectIds} onChange={onChange} />;
}

function ScoreRows({
  scores,
  subjectIds,
  onChange,
  showRank = false
}: {
  scores: RawScore[];
  subjectIds: string[];
  onChange: (subjectId: string, scoreX2: number) => void;
  showRank?: boolean;
}) {
  return (
    <div className="grid gap-2">
      {subjectIds.map((subjectId, index) => {
        const competitor = demoCompetitors.find((item) => item.id === subjectId);
        const score = scores.find((item) => item.subjectId === subjectId);
        if (!competitor || !score) return null;
        return (
          <ScoreSwipeRow
            key={subjectId}
            competitor={competitor}
            rank={showRank ? index + 1 : undefined}
            scoreX2={score.scoreX2}
            onChange={(next) => onChange(subjectId, next)}
          />
        );
      })}
    </div>
  );
}

function ScoreSwipeRow({
  competitor,
  rank,
  scoreX2,
  onChange
}: {
  competitor: Competitor;
  rank?: number;
  scoreX2: number;
  onChange: (scoreX2: number) => void;
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
      aria-label={`Score ${competitor.preferredName}`}
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
      <div className="relative grid min-h-[48px] grid-cols-[1fr_84px] items-center gap-3">
        <div>
          <p className="text-base font-black text-graphite">
            {rank ? <span className="mr-2 font-mono text-brass">{rank}</span> : null}
            {competitorLabel(competitor)}
          </p>
          <p className="mt-1 text-xs font-bold uppercase tracking-wide text-graphite/55">
            Swipe sideways to score. Swipe up or down to scroll.
          </p>
        </div>
        <div className="rounded-[6px] bg-chalk/85 px-3 py-2 text-right shadow-sm">
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-graphite/45">Score</p>
          <p className="font-display text-2xl font-black leading-none text-ink">{formatScore(scoreX2)}</p>
        </div>
      </div>
    </div>
  );
}

function DerivedList({
  marks
}: {
  marks: Array<{ competitorId: string; rank: number; status: string; points: number; altLevel?: number }>;
}) {
  return (
    <div className="grid gap-2">
      {marks
        .slice()
        .sort((a, b) => a.rank - b.rank)
        .map((mark) => {
          const competitor = demoCompetitors.find((item) => item.id === mark.competitorId);
          return (
            <div key={mark.competitorId} className="grid grid-cols-[42px_1fr_82px] items-center gap-3 rounded-[8px] bg-paper px-3 py-2 text-sm">
              <span className="font-mono font-black">{mark.rank}</span>
              <span className="font-bold">{competitorLabel(competitor)}</span>
              <span className="rounded-full bg-bluepaper px-2 py-1 text-center text-xs font-black uppercase">
                {mark.status}{mark.altLevel ? ` ${mark.altLevel}` : ""}
              </span>
            </div>
          );
        })}
    </div>
  );
}

function viewTitle(view: JudgeView) {
  if (view === "heat") return "Heat order";
  if (view === "rank") return "Current rank";
  if (view === "derived") return "Derived callbacks";
  return "Name order";
}
