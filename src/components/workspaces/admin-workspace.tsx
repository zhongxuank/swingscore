"use client";

import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, Gavel, Smartphone } from "lucide-react";
import {
  demoChiefScores,
  demoCompetition,
  demoCompetitors,
  demoCouples,
  demoFinalScores,
  demoHeatEntries,
  demoJudges,
  demoPrelimScores,
  demoRound,
  sampleCsv
} from "@/lib/data/demo-data";
import type { Competitor, RawScore, Role, RoundConfig } from "@/lib/types";
import { parseCompetitorCsv } from "@/lib/scoring/csv";
import { advancementCsv, placementsCsv, rawScoresCsv } from "@/lib/scoring/exports";
import { calculatePrelimAdvancement } from "@/lib/scoring/prelims";
import { convertRawScoresToOrdinals, calculateRelativePlacements } from "@/lib/scoring/relative-placement";
import { AppFrame, NavButton, Panel, competitorLabel, coupleLabel } from "@/components/workspaces/shared";

type AdminTab = "setup" | "import" | "judges" | "heats" | "results" | "finals" | "exports";

const tabs: Array<{ id: AdminTab; label: string }> = [
  { id: "setup", label: "Setup" },
  { id: "import", label: "Import" },
  { id: "judges", label: "Judges" },
  { id: "heats", label: "Heats" },
  { id: "results", label: "Results" },
  { id: "finals", label: "Finals" },
  { id: "exports", label: "Exports" }
];

export function AdminWorkspace({ competitionId }: { competitionId: string }) {
  const [activeTab, setActiveTab] = useState<AdminTab>("setup");
  const [round, setRound] = useState<RoundConfig>(demoRound);
  const [competitors, setCompetitors] = useState<Competitor[]>(demoCompetitors);
  const [csvText, setCsvText] = useState(sampleCsv);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [panelScores] = useState<RawScore[]>(demoPrelimScores);
  const [chiefScores] = useState<RawScore[]>(demoChiefScores);

  const leaderResults = useMemo(
    () => calculateRoleAdvancement("Leader", competitors, panelScores, chiefScores, round),
    [competitors, panelScores, chiefScores, round]
  );
  const followerResults = useMemo(
    () => calculateRoleAdvancement("Follower", competitors, panelScores, chiefScores, round),
    [competitors, panelScores, chiefScores, round]
  );
  const finalPlacements = useMemo(() => {
    const sheets = demoJudges
      .filter((judge) => !judge.isChiefJudge)
      .map((judge) => convertRawScoresToOrdinals(demoFinalScores.filter((score) => score.judgeId === judge.id)));
    return calculateRelativePlacements(
      demoCouples.map((couple) => couple.id),
      sheets
    );
  }, []);

  function importCsv() {
    const parsed = parseCompetitorCsv(csvText);
    setCsvErrors(parsed.errors);
    if (parsed.competitors.length > 0 && parsed.errors.length === 0) {
      setCompetitors(parsed.competitors);
    }
  }

  return (
    <AppFrame
      eyebrow={`Admin / ${competitionId}`}
      title={demoCompetition.name}
      subtitle="A Supabase-ready control room for setup, live scoring, Chief Judge review, emcee screens, and exports."
      actions={
        <>
          <NavButton href="/judge/demo-judge" tone="dark">
            <Smartphone size={16} className="mr-2" /> Judge
          </NavButton>
          <NavButton href="/chief/demo-chief">Chief Judge</NavButton>
          <NavButton href="/emcee/demo-emcee">Emcee</NavButton>
        </>
      }
    >
      <nav className="no-print mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-[6px] border px-3 py-2 text-sm font-black transition ${
              activeTab === tab.id
                ? "border-graphite bg-graphite text-paper"
                : "border-graphite/15 bg-chalk text-graphite hover:bg-bluepaper"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "setup" ? (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Panel title="Competition setup">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Division" value={demoCompetition.division} />
              <Field label="Status" value={demoCompetition.status} />
              <NumberField
                label="Required Yeses"
                value={round.requiredYeses}
                onChange={(value) => setRound((current) => ({ ...current, requiredYeses: value }))}
              />
              <NumberField
                label="Required alternates"
                value={round.requiredAlts}
                onChange={(value) => setRound((current) => ({ ...current, requiredAlts: value }))}
              />
              <NumberField
                label="Advancing per role"
                value={round.advancementCount}
                onChange={(value) => setRound((current) => ({ ...current, advancementCount: value }))}
              />
              <Field label="CJ scoring" value="Raw scores: tiebreak only" />
            </div>
          </Panel>
          <Panel title="Live links">
            <div className="grid gap-3">
              {[
                ["/judge/demo-judge", "Judge link"],
                ["/chief/demo-chief", "Chief Judge link"],
                ["/emcee/demo-emcee", "Emcee link"],
                ["/export/demo-novice-jj", "Export center"]
              ].map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  className="flex items-center justify-between rounded-[6px] border border-graphite/15 bg-paper px-3 py-3 text-sm font-bold hover:bg-bluepaper"
                >
                  {label}
                  <span className="font-mono text-xs text-graphite/55">{href}</span>
                </a>
              ))}
            </div>
          </Panel>
        </div>
      ) : null}

      {activeTab === "import" ? (
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <Panel
            title="CSV import"
            action={
              <button
                type="button"
                onClick={importCsv}
                className="inline-flex items-center gap-2 rounded-[6px] bg-graphite px-3 py-2 text-sm font-bold text-paper"
              >
                <FileSpreadsheet size={16} /> Validate
              </button>
            }
          >
            <textarea
              value={csvText}
              onChange={(event) => setCsvText(event.target.value)}
              className="min-h-[280px] w-full rounded-[6px] border border-graphite/20 bg-paper p-3 font-mono text-sm"
            />
            {csvErrors.length > 0 ? (
              <div className="mt-3 rounded-[6px] bg-oxblood/10 p-3 text-sm font-bold text-oxblood">
                {csvErrors.join(" ")}
              </div>
            ) : null}
          </Panel>
          <CompetitorTable competitors={competitors} />
        </div>
      ) : null}

      {activeTab === "judges" ? (
        <Panel title="Judging panel">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {demoJudges.map((judge) => (
              <article key={judge.id} className="rounded-[8px] border border-graphite/15 bg-paper p-4">
                <Gavel className="text-brass" size={20} />
                <h3 className="mt-3 font-black">{judge.name}</h3>
                <p className="mt-1 text-sm text-graphite/70">{judge.roleAssignment}</p>
                <p className="mt-3 rounded-full bg-bluepaper px-3 py-1 text-xs font-bold uppercase text-graphite">
                  {judge.isChiefJudge ? "Chief Judge raw scores" : "Panel raw scores"}
                </p>
              </article>
            ))}
          </div>
        </Panel>
      ) : null}

      {activeTab === "heats" ? (
        <Panel title="Heat sheet">
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2].map((heat) => (
              <div key={heat} className="rounded-[8px] border border-graphite/15 bg-paper p-4">
                <h3 className="mb-3 text-lg font-black">Heat {heat}</h3>
                <div className="grid gap-2">
                  {demoHeatEntries
                    .filter((entry) => entry.heatNumber === heat)
                    .map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between rounded-[6px] bg-chalk px-3 py-2">
                        <span>{competitorLabel(competitors.find((competitor) => competitor.id === entry.competitorId))}</span>
                        {entry.isFiller ? <span className="text-xs font-black text-oxblood">FILLER - DO NOT SCORE</span> : null}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      {activeTab === "results" ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <AdvancementPanel title="Leader advancement" competitors={competitors} result={leaderResults} />
          <AdvancementPanel title="Follower advancement" competitors={competitors} result={followerResults} />
        </div>
      ) : null}

      {activeTab === "finals" ? (
        <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <Panel title="Pairings">
            <div className="grid gap-2">
              {demoCouples.map((couple) => (
                <div key={couple.id} className="flex items-center justify-between rounded-[6px] border border-graphite/10 bg-paper px-3 py-3">
                  <span className="font-black">#{couple.danceOrder} {coupleLabel(couple, competitors)}</span>
                  <span className="text-sm text-graphite/65">
                    {competitors.find((competitor) => competitor.id === couple.leaderId)?.preferredName} /{" "}
                    {competitors.find((competitor) => competitor.id === couple.followerId)?.preferredName}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Relative Placement results">
            <PlacementTable placements={finalPlacements.placements} competitors={competitors} />
          </Panel>
        </div>
      ) : null}

      {activeTab === "exports" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <ExportCard title="Full raw scores" value={rawScoresCsv({ judges: demoJudges, competitors, scores: [...panelScores, ...chiefScores] })} />
          <ExportCard title="Advancement list" value={advancementCsv([...leaderResults.rows, ...followerResults.rows], competitors)} />
          <ExportCard title="Final placements" value={placementsCsv(finalPlacements.placements, demoCouples, competitors)} />
        </div>
      ) : null}
    </AppFrame>
  );
}

function calculateRoleAdvancement(
  role: Role,
  competitors: Competitor[],
  panelScores: RawScore[],
  chiefScores: RawScore[],
  round: RoundConfig
) {
  const roleCompetitors = competitors.filter((competitor) => competitor.role === role);
  return calculatePrelimAdvancement({
    competitors: roleCompetitors,
    panelScores: panelScores.filter((score) => score.role === role),
    chiefScores: chiefScores.filter((score) => score.role === role),
    requiredYeses: round.requiredYeses,
    requiredAlts: round.requiredAlts,
    advancementCount: round.advancementCount,
    chiefJudgeMode: role === "Leader" ? round.leaderChiefJudgeMode : round.followerChiefJudgeMode
  });
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="grid gap-1">
      <span className="font-mono text-xs uppercase tracking-[0.18em] text-graphite/55">{label}</span>
      <span className="rounded-[6px] border border-graphite/15 bg-paper px-3 py-3 font-bold text-graphite">{value}</span>
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="grid gap-1">
      <span className="font-mono text-xs uppercase tracking-[0.18em] text-graphite/55">{label}</span>
      <input
        type="number"
        min="0"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="rounded-[6px] border border-graphite/15 bg-paper px-3 py-3 font-bold text-graphite"
      />
    </label>
  );
}

function CompetitorTable({ competitors }: { competitors: Competitor[] }) {
  return (
    <Panel title={`Competitors (${competitors.length})`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-separate border-spacing-y-2 text-left text-sm">
          <thead className="font-mono text-xs uppercase tracking-wide text-graphite/55">
            <tr>
              <th>Bib</th>
              <th>Name</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {competitors.map((competitor) => (
              <tr key={competitor.id} className="bg-paper">
                <td className="rounded-l-[6px] px-3 py-2 font-black">{competitor.bibNumber}</td>
                <td className="px-3 py-2">{competitor.preferredName}</td>
                <td className="rounded-r-[6px] px-3 py-2">{competitor.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function AdvancementPanel({
  title,
  competitors,
  result
}: {
  title: string;
  competitors: Competitor[];
  result: ReturnType<typeof calculatePrelimAdvancement>;
}) {
  return (
    <Panel title={title}>
      {result.ties.length > 0 ? (
        <div className="mb-3 rounded-[6px] bg-brass/15 p-3 text-sm font-bold text-graphite">
          {result.ties.map((tie) => `${tie.kind} boundary tie at ${tie.boundary}${tie.resolvedByChiefJudge ? " resolved by CJ raw score" : ""}`).join(". ")}
        </div>
      ) : null}
      <div className="grid gap-2">
        {result.rows.map((row) => {
          const competitor = competitors.find((item) => item.id === row.competitorId);
          return (
            <div key={row.competitorId} className="grid grid-cols-[48px_1fr_82px_98px] items-center gap-2 rounded-[6px] bg-paper px-3 py-2 text-sm">
              <span className="font-mono font-black">{row.rank}</span>
              <span className="font-bold">{competitorLabel(competitor)}</span>
              <span>{row.totalPoints.toFixed(1)}</span>
              <span className="rounded-full bg-bluepaper px-2 py-1 text-center text-xs font-black uppercase">{row.status}</span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function PlacementTable({ placements, competitors }: { placements: ReturnType<typeof calculateRelativePlacements>["placements"]; competitors: Competitor[] }) {
  return (
    <div className="grid gap-2">
      {placements.map((placement) => {
        const couple = demoCouples.find((item) => item.id === placement.coupleId);
        return (
          <div key={placement.coupleId} className="grid grid-cols-[52px_1fr_120px] items-center gap-2 rounded-[6px] bg-paper px-3 py-2 text-sm">
            <span className="font-display text-2xl font-black">{placement.placement}</span>
            <span className="font-black">{couple ? coupleLabel(couple, competitors) : placement.coupleId}</span>
            <span className="font-mono text-xs text-graphite/60">maj {placement.majorityCount}@{placement.majorityAt}</span>
          </div>
        );
      })}
    </div>
  );
}

function ExportCard({ title, value }: { title: string; value: string }) {
  return (
    <Panel
      title={title}
      action={
        <span className="inline-flex items-center gap-1 font-mono text-xs uppercase text-graphite/55">
          <Download size={14} /> CSV
        </span>
      }
    >
      <textarea readOnly value={value} className="h-72 w-full rounded-[6px] border border-graphite/15 bg-paper p-3 font-mono text-xs" />
    </Panel>
  );
}
