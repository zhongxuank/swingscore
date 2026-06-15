"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ListOrdered, Rows3, Search, Trophy } from "lucide-react";
import { demoCompetition, demoCompetitors, demoHeatEntries, demoPrelimScores, demoRound } from "@/lib/data/demo-data";
import type { RawScore, SaveState } from "@/lib/types";
import { deriveJudgePrelimMarks } from "@/lib/scoring/prelims";
import { validateScoreSheet } from "@/lib/scoring/score-utils";
import { AppFrame, Panel, ScoreSwipeRow, StatusPill, competitorLabel, updateScore } from "@/components/workspaces/shared";

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
  const statusByCompetitor = useMemo(
    () =>
      new Map(
        [...leaderMarks.marks, ...followerMarks.marks].map((mark) => [
          mark.competitorId,
          mark.status === "yes" ? "yes" : mark.status === "alt" ? "alt" : "no"
        ] as const)
      ),
    [leaderMarks.marks, followerMarks.marks]
  );

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

        <Panel title={viewTitle(activeView)}>
          {activeView === "heat" ? <HeatScoreList scores={scores} statusByCompetitor={statusByCompetitor} onChange={changeScore} /> : null}
          {activeView === "rank" ? <RankScoreList scores={scores} statusByCompetitor={statusByCompetitor} onChange={changeScore} /> : null}
          {activeView === "derived" ? <DerivedList marks={[...leaderMarks.marks, ...followerMarks.marks]} /> : null}
          {activeView === "name" ? <NameScoreList scores={scores} statusByCompetitor={statusByCompetitor} onChange={changeScore} /> : null}
        </Panel>

        <div data-testid="judge-action-panel" className="no-print mt-3 rounded-[8px] border border-graphite/15 bg-chalk p-3 shadow-sm">
          {validationErrors.length > 0 ? (
            <div data-testid="judge-warning" className="mb-3 rounded-[8px] border border-oxblood/20 bg-oxblood/10 p-3 text-sm font-bold text-oxblood">
              {validationErrors.join(" ")}
            </div>
          ) : null}
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

function HeatScoreList({
  scores,
  statusByCompetitor,
  onChange
}: {
  scores: RawScore[];
  statusByCompetitor: Map<string, "yes" | "alt" | "no">;
  onChange: (subjectId: string, scoreX2: number) => void;
}) {
  return (
    <div className="grid gap-4">
      {[1, 2].map((heat) => (
        <section key={heat}>
          <h3 className="mb-2 font-mono text-xs font-black uppercase tracking-[0.18em] text-graphite/55">Heat {heat}</h3>
          <ScoreRows
            scores={scores}
            subjectIds={demoHeatEntries.filter((entry) => entry.heatNumber === heat).map((entry) => entry.competitorId)}
            statusByCompetitor={statusByCompetitor}
            onChange={onChange}
          />
        </section>
      ))}
    </div>
  );
}

function RankScoreList({
  scores,
  statusByCompetitor,
  onChange
}: {
  scores: RawScore[];
  statusByCompetitor: Map<string, "yes" | "alt" | "no">;
  onChange: (subjectId: string, scoreX2: number) => void;
}) {
  const subjectIds = scores.slice().sort((a, b) => b.scoreX2 - a.scoreX2).map((score) => score.subjectId);
  return <ScoreRows scores={scores} subjectIds={subjectIds} statusByCompetitor={statusByCompetitor} onChange={onChange} showRank />;
}

function NameScoreList({
  scores,
  statusByCompetitor,
  onChange
}: {
  scores: RawScore[];
  statusByCompetitor: Map<string, "yes" | "alt" | "no">;
  onChange: (subjectId: string, scoreX2: number) => void;
}) {
  const subjectIds = demoCompetitors
    .slice()
    .sort((a, b) => a.preferredName.localeCompare(b.preferredName))
    .map((competitor) => competitor.id);
  return <ScoreRows scores={scores} subjectIds={subjectIds} statusByCompetitor={statusByCompetitor} onChange={onChange} />;
}

function ScoreRows({
  scores,
  subjectIds,
  statusByCompetitor,
  onChange,
  showRank = false
}: {
  scores: RawScore[];
  subjectIds: string[];
  statusByCompetitor: Map<string, "yes" | "alt" | "no">;
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
            statusTone={score.scoreX2 === 0 ? "neutral" : statusByCompetitor.get(subjectId) ?? "neutral"}
            onChange={(next) => onChange(subjectId, next)}
          />
        );
      })}
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
