"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, FileDown, ShieldAlert } from "lucide-react";
import { demoChiefScores, demoCompetitors, demoJudges, demoPrelimScores, demoRound } from "@/lib/data/demo-data";
import type { RawScore, Role } from "@/lib/types";
import { advancementCsv, rawScoresCsv } from "@/lib/scoring/exports";
import { calculatePrelimAdvancement } from "@/lib/scoring/prelims";
import { AppFrame, NavButton, Panel, ScoreInput, competitorLabel, updateScore } from "@/components/workspaces/shared";

export function ChiefWorkspace({ token }: { token: string }) {
  const [chiefScores, setChiefScores] = useState<RawScore[]>(demoChiefScores);
  const [finalized, setFinalized] = useState(false);

  const leaders = useMemo(() => calculateRole("Leader", chiefScores), [chiefScores]);
  const followers = useMemo(() => calculateRole("Follower", chiefScores), [chiefScores]);
  const allTies = [...leaders.ties, ...followers.ties];
  const allRows = [...leaders.rows, ...followers.rows];

  function changeScore(subjectId: string, scoreX2: number) {
    setChiefScores((current) => updateScore(current, subjectId, scoreX2, "chief"));
    setFinalized(false);
  }

  return (
    <AppFrame
      eyebrow={`Chief Judge / ${token}`}
      title="Raw score review"
      subtitle="Chief Judge scores are captured as raw scores. In tiebreak-only mode they are excluded from original aggregation and applied only after a boundary tie is found."
      actions={
        <>
          <NavButton href="/admin/competitions/demo-novice-jj">Admin</NavButton>
          <NavButton href="/export/demo-novice-jj" tone="dark">
            <FileDown size={16} className="mr-2" /> Exports
          </NavButton>
        </>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Boundary review">
          {allTies.length === 0 ? (
            <div className="rounded-[8px] bg-celadon/20 p-4 text-sm font-bold text-graphite">
              No meaningful boundary ties in the current calculation.
            </div>
          ) : (
            <div className="grid gap-3">
              {allTies.map((tie, index) => (
                <article key={`${tie.kind}-${index}`} className="rounded-[8px] border border-brass/35 bg-brass/10 p-4">
                  <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-graphite">
                    <ShieldAlert size={17} className="text-brass" />
                    {tie.kind} boundary {tie.boundary}
                  </div>
                  <p className="mt-2 text-sm text-graphite/75">
                    {tie.subjectIds
                      .map((id) => competitorLabel(demoCompetitors.find((competitor) => competitor.id === id)))
                      .join(", ")}
                  </p>
                  <p className="mt-2 text-sm font-bold">
                    {tie.resolvedByChiefJudge ? "Resolved by Chief Judge raw score." : "Needs score adjustment or advancement change."}
                  </p>
                </article>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setFinalized(true)}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[6px] bg-graphite px-4 py-3 font-black text-paper"
          >
            <CheckCircle2 size={18} />
            {finalized ? "Advancement finalized" : "Finalize advancement snapshot"}
          </button>
        </Panel>

        <Panel title="Chief Judge raw scores">
          <div className="grid gap-5 md:grid-cols-2">
            {(["Leader", "Follower"] as Role[]).map((role) => (
              <section key={role}>
                <h3 className="mb-2 font-mono text-xs font-black uppercase tracking-[0.18em] text-graphite/55">{role}s</h3>
                <div className="grid gap-2">
                  {demoCompetitors
                    .filter((competitor) => competitor.role === role)
                    .map((competitor) => {
                      const score = chiefScores.find((item) => item.subjectId === competitor.id);
                      return (
                        <div key={competitor.id} className="grid grid-cols-[1fr_92px] items-center gap-3 rounded-[8px] border border-graphite/10 bg-paper p-3">
                          <div>
                            <p className="font-black">{competitorLabel(competitor)}</p>
                            <p className="text-xs font-bold uppercase tracking-wide text-graphite/55">Raw score</p>
                          </div>
                          <ScoreInput
                            label={`Chief Judge score ${competitor.preferredName}`}
                            score={score?.scoreX2 ?? 0}
                            onChange={(nextScore) => changeScore(competitor.id, nextScore)}
                          />
                        </div>
                      );
                    })}
                </div>
              </section>
            ))}
          </div>
        </Panel>

        <Panel title="Advancement snapshot" className="xl:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-separate border-spacing-y-2 text-left text-sm">
              <thead className="font-mono text-xs uppercase tracking-wide text-graphite/55">
                <tr>
                  <th>Rank</th>
                  <th>Competitor</th>
                  <th>Role</th>
                  <th>Points</th>
                  <th>Status</th>
                  <th>CJ raw</th>
                </tr>
              </thead>
              <tbody>
                {allRows.map((row) => {
                  const competitor = demoCompetitors.find((item) => item.id === row.competitorId);
                  return (
                    <tr key={row.competitorId} className="bg-paper">
                      <td className="rounded-l-[6px] px-3 py-2 font-mono font-black">{row.rank}</td>
                      <td className="px-3 py-2 font-bold">{competitorLabel(competitor)}</td>
                      <td className="px-3 py-2">{row.role}</td>
                      <td className="px-3 py-2">{row.totalPoints.toFixed(1)}</td>
                      <td className="px-3 py-2">{row.status}</td>
                      <td className="rounded-r-[6px] px-3 py-2">{row.chiefJudgeScoreX2 ? (row.chiefJudgeScoreX2 / 2).toFixed(1) : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Raw score export preview" className="xl:col-span-2">
          <textarea
            readOnly
            value={`${advancementCsv(allRows, demoCompetitors)}\n\n${rawScoresCsv({ judges: demoJudges, competitors: demoCompetitors, scores: [...demoPrelimScores, ...chiefScores] })}`}
            className="h-80 w-full rounded-[6px] border border-graphite/15 bg-paper p-3 font-mono text-xs"
          />
        </Panel>
      </div>
    </AppFrame>
  );
}

function calculateRole(role: Role, chiefScores: RawScore[]) {
  return calculatePrelimAdvancement({
    competitors: demoCompetitors.filter((competitor) => competitor.role === role),
    panelScores: demoPrelimScores.filter((score) => score.role === role),
    chiefScores: chiefScores.filter((score) => score.role === role),
    requiredYeses: demoRound.requiredYeses,
    requiredAlts: demoRound.requiredAlts,
    advancementCount: demoRound.advancementCount,
    chiefJudgeMode: "tiebreak_only"
  });
}
