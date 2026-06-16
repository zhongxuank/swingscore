"use client";

import { useMemo, useState } from "react";
import { Mic2, MonitorUp } from "lucide-react";
import {
  demoChiefScores,
  demoCompetitors,
  demoCouples,
  demoFinalScores,
  demoHeatEntries,
  demoJudges,
  demoPrelimScores,
  demoRound
} from "@/lib/data/demo-data";
import { calculatePrelimAdvancement } from "@/lib/scoring/prelims";
import { calculateRelativePlacements, convertRawScoresToOrdinals } from "@/lib/scoring/relative-placement";
import { AppFrame, HeatSheetGrid, NavButton, Panel, competitorLabel, coupleLabel } from "@/components/workspaces/shared";

type EmceeView = "callbacks" | "alternates" | "finals" | "heats";

export function EmceeWorkspace({ token }: { token: string }) {
  const [view, setView] = useState<EmceeView>("callbacks");
  const advancement = useMemo(() => {
    const byRole = (role: "Leader" | "Follower") =>
      calculatePrelimAdvancement({
        competitors: demoCompetitors.filter((competitor) => competitor.role === role),
        panelScores: demoPrelimScores.filter((score) => score.role === role),
        chiefScores: demoChiefScores.filter((score) => score.role === role),
        requiredYeses: demoRound.requiredYeses,
        requiredAlts: demoRound.requiredAlts,
        advancementCount: demoRound.advancementCount,
        chiefJudgeMode: "tiebreak_only"
      }).rows;
    return [...byRole("Leader"), ...byRole("Follower")];
  }, []);
  const placements = useMemo(() => {
    const sheets = demoJudges
      .filter((judge) => !judge.isChiefJudge)
      .map((judge) => convertRawScoresToOrdinals(demoFinalScores.filter((score) => score.judgeId === judge.id)));
    return calculateRelativePlacements(
      demoCouples.map((couple) => couple.id),
      sheets
    ).placements;
  }, []);

  return (
    <AppFrame
      eyebrow={`Emcee / ${token}`}
      title="Announcements"
      subtitle="Read-only views for callbacks, alternates, finals announcements, pairings, and heat instructions."
      actions={<NavButton href="/admin/competitions/demo-novice-jj">Admin</NavButton>}
    >
      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <Panel>
          <div className="grid gap-2">
            {[
              ["callbacks", "Callbacks"],
              ["alternates", "Alternates"],
              ["finals", "Awards"],
              ["heats", "Heats"]
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id as EmceeView)}
                className={`flex items-center gap-2 rounded-[6px] px-3 py-3 text-left font-black ${
                  view === id ? "bg-graphite text-paper" : "bg-paper text-graphite"
                }`}
              >
                <Mic2 size={16} />
                {label}
              </button>
            ))}
          </div>
        </Panel>

        <Panel
          title={view === "callbacks" ? "Callback list" : view === "alternates" ? "Alternate list" : view === "finals" ? "Placement announcements" : "Heat instructions"}
          action={<MonitorUp size={18} className="text-brass" />}
        >
          {view === "callbacks" ? (
            <AnnouncementGrid
              rows={advancement
                .filter((row) => row.status === "advancing")
                .sort((a, b) => bibFor(a.competitorId).localeCompare(bibFor(b.competitorId), undefined, { numeric: true }))
                .map((row) => competitorLabel(demoCompetitors.find((competitor) => competitor.id === row.competitorId)))}
            />
          ) : null}

          {view === "alternates" ? (
            <AnnouncementGrid
              rows={advancement
                .filter((row) => row.status === "alternate")
                .sort((a, b) => a.rank - b.rank)
                .map((row, index) => `${index + 1} alternate: ${competitorLabel(demoCompetitors.find((competitor) => competitor.id === row.competitorId))}`)}
            />
          ) : null}

          {view === "finals" ? (
            <div className="grid gap-3">
              {placements.map((placement) => {
                const couple = demoCouples.find((item) => item.id === placement.coupleId);
                return (
                  <div key={placement.coupleId} className="rounded-[8px] border border-graphite/10 bg-paper p-5">
                    <p className="font-display text-5xl font-black text-brass">{placement.placement}</p>
                    <p className="mt-2 text-2xl font-black">{couple ? coupleLabel(couple, demoCompetitors) : placement.coupleId}</p>
                    {couple ? (
                      <p className="mt-1 text-graphite/70">
                        {demoCompetitors.find((competitor) => competitor.id === couple.leaderId)?.preferredName} /{" "}
                        {demoCompetitors.find((competitor) => competitor.id === couple.followerId)?.preferredName}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}

          {view === "heats" ? (
            <HeatSheetGrid competitors={demoCompetitors} heatEntries={demoHeatEntries} />
          ) : null}
        </Panel>
      </div>
    </AppFrame>
  );
}

function AnnouncementGrid({ rows }: { rows: string[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => (
        <div key={row} className="rounded-[8px] border border-graphite/10 bg-paper p-5 text-2xl font-black">
          {row}
        </div>
      ))}
    </div>
  );
}

function bibFor(competitorId: string) {
  return demoCompetitors.find((competitor) => competitor.id === competitorId)?.bibNumber ?? "";
}
