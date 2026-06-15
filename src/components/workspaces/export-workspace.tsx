"use client";

import { Download, Printer } from "lucide-react";
import {
  demoChiefScores,
  demoCompetitors,
  demoCouples,
  demoFinalScores,
  demoJudges,
  demoPrelimScores,
  demoRound
} from "@/lib/data/demo-data";
import { advancementCsv, placementsCsv, rawScoresCsv } from "@/lib/scoring/exports";
import { calculatePrelimAdvancement } from "@/lib/scoring/prelims";
import { calculateRelativePlacements, convertRawScoresToOrdinals } from "@/lib/scoring/relative-placement";
import { AppFrame, NavButton, Panel } from "@/components/workspaces/shared";

export function ExportWorkspace({ competitionId }: { competitionId: string }) {
  const advancementRows = (["Leader", "Follower"] as const).flatMap((role) =>
    calculatePrelimAdvancement({
      competitors: demoCompetitors.filter((competitor) => competitor.role === role),
      panelScores: demoPrelimScores.filter((score) => score.role === role),
      chiefScores: demoChiefScores.filter((score) => score.role === role),
      requiredYeses: demoRound.requiredYeses,
      requiredAlts: demoRound.requiredAlts,
      advancementCount: demoRound.advancementCount,
      chiefJudgeMode: "tiebreak_only"
    }).rows
  );
  const placements = calculateRelativePlacements(
    demoCouples.map((couple) => couple.id),
    demoJudges
      .filter((judge) => !judge.isChiefJudge)
      .map((judge) => convertRawScoresToOrdinals(demoFinalScores.filter((score) => score.judgeId === judge.id)))
  ).placements;

  const exports = [
    {
      title: "Full raw scores",
      value: rawScoresCsv({ judges: demoJudges, competitors: demoCompetitors, scores: [...demoPrelimScores, ...demoChiefScores] })
    },
    {
      title: "Advancement list",
      value: advancementCsv(advancementRows, demoCompetitors)
    },
    {
      title: "Final placements",
      value: placementsCsv(placements, demoCouples, demoCompetitors)
    },
    {
      title: "Finals import",
      value: advancementCsv(
        advancementRows.filter((row) => row.status === "advancing"),
        demoCompetitors
      )
    }
  ];

  return (
    <AppFrame
      eyebrow={`Exports / ${competitionId}`}
      title="Results package"
      subtitle="CSV and print-ready outputs for scorekeepers, Chief Judge review, emcee announcements, and event records."
      actions={
        <>
          <NavButton href="/admin/competitions/demo-novice-jj">Admin</NavButton>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center rounded-[6px] bg-graphite px-4 py-2 text-sm font-bold text-paper"
          >
            <Printer size={16} className="mr-2" />
            Print PDFs
          </button>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {exports.map((item) => (
          <Panel
            key={item.title}
            title={item.title}
            action={
              <span className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wide text-graphite/55">
                <Download size={14} /> CSV
              </span>
            }
          >
            <textarea readOnly value={item.value} className="h-80 w-full rounded-[6px] border border-graphite/15 bg-paper p-3 font-mono text-xs" />
          </Panel>
        ))}
      </div>
    </AppFrame>
  );
}
