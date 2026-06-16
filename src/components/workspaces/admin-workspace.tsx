"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, Download, ExternalLink, FileSpreadsheet, Gavel, Link2, Lock, Plus, Shuffle, Smartphone, Unlock } from "lucide-react";
import {
  demoChiefScores,
  demoCompetition,
  demoCompetitors,
  demoCouples,
  demoFinalScores,
  demoFinalRound,
  demoHeatEntries,
  demoJudges,
  demoPrelimScores,
  demoRound,
  demoRounds,
  roleAssignmentAllows,
  roleAssignmentLabel,
  sampleCsv
} from "@/lib/data/demo-data";
import { createContestShell, readLocalContests, readLocalRoundJudges, readLocalRounds, writeLocalRoundJudges, writeLocalRounds } from "@/lib/data/local-contest-store";
import type { AdvancementRow, Competition, Competitor, Couple, HeatEntry, Judge, JudgeAssignmentRole, RawScore, Role, RoundConfig, RoundStage } from "@/lib/types";
import { chiefJudgeCountsForRound, generateHeatEntries, isCallbackRound, isFinalRound, roundStageLabel, roundTypeLabel, scoringMethodLabel, validateFinalPairings, validateFinalScoringPanel } from "@/lib/rounds";
import { buildRoundAccessLinks, type RoundAccessLink } from "@/lib/access-links";
import { parseCompetitorCsv } from "@/lib/scoring/csv";
import { advancementCsv, placementsCsv, rawScoresCsv } from "@/lib/scoring/exports";
import { calculatePrelimAdvancement } from "@/lib/scoring/prelims";
import { calculateRelativePlacements, convertRawScoresToOrdinals } from "@/lib/scoring/relative-placement";
import { AppFrame, HeatSheetGrid, NavButton, Panel, competitorLabel, coupleLabel } from "@/components/workspaces/shared";

type CallbackTab = "setup" | "competitors" | "judges" | "access" | "heats" | "results" | "exports";
type FinalTab = "setup" | "judges" | "access" | "pairings" | "results" | "exports";
type AdminTab = CallbackTab | FinalTab;

const callbackTabs: Array<{ id: CallbackTab; label: string }> = [
  { id: "setup", label: "Setup" },
  { id: "competitors", label: "Competitors" },
  { id: "judges", label: "Judges" },
  { id: "access", label: "Access" },
  { id: "heats", label: "Heats" },
  { id: "results", label: "Results" },
  { id: "exports", label: "Exports" }
];

const finalTabs: Array<{ id: FinalTab; label: string }> = [
  { id: "setup", label: "Setup" },
  { id: "judges", label: "Judges" },
  { id: "access", label: "Access" },
  { id: "pairings", label: "Pairings" },
  { id: "results", label: "Results" },
  { id: "exports", label: "Exports" }
];

const assignmentOptions: Array<{ value: JudgeAssignmentRole; label: string }> = [
  { value: "leaders", label: "L" },
  { value: "followers", label: "F" },
  { value: "both", label: "Both" }
];

export function AdminWorkspace({ competitionId }: { competitionId: string }) {
  const [activeTab, setActiveTab] = useState<AdminTab>("setup");
  const [contest, setContest] = useState<Competition>(() => (competitionId === demoCompetition.id ? demoCompetition : createContestShell(competitionId)));
  const [rounds, setRounds] = useState<RoundConfig[]>(() => (competitionId === demoCompetition.id ? demoRounds : []));
  const [activeRoundId, setActiveRoundId] = useState(() => (competitionId === demoCompetition.id ? demoRound.id : ""));
  const [roundCompetitorIds, setRoundCompetitorIds] = useState<Record<string, string[]>>({
    [demoRound.id]: demoCompetitors.map((competitor) => competitor.id),
    [demoFinalRound.id]: demoCouples.flatMap((couple) => [couple.leaderId, couple.followerId].filter(Boolean) as string[])
  });
  const [roundConfigs, setRoundConfigs] = useState<Record<string, RoundConfig>>(
    () => (competitionId === demoCompetition.id ? Object.fromEntries(demoRounds.map((round) => [round.id, round])) : {})
  );
  const [competitors, setCompetitors] = useState<Competitor[]>(() => (competitionId === demoCompetition.id ? demoCompetitors : []));
  const [heatEntries, setHeatEntries] = useState<HeatEntry[]>(() => (competitionId === demoCompetition.id ? demoHeatEntries : []));
  const [couples, setCouples] = useState<Couple[]>(() => (competitionId === demoCompetition.id ? demoCouples : []));
  const [csvText, setCsvText] = useState(sampleCsv);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [panelScores, setPanelScores] = useState<RawScore[]>(() => (competitionId === demoCompetition.id ? demoPrelimScores : []));
  const [chiefScores, setChiefScores] = useState<RawScore[]>(() => (competitionId === demoCompetition.id ? demoChiefScores : []));
  const [roundJudges, setRoundJudges] = useState<Record<string, Judge[]>>(() => ({
    [demoRound.id]: demoJudges,
    [demoFinalRound.id]: demoJudges
  }));
  const [heatCount, setHeatCount] = useState(2);
  const [maxDancersPerHeat, setMaxDancersPerHeat] = useState(4);
  const [notice, setNotice] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  const activeRound = activeRoundId ? roundConfigs[activeRoundId] ?? rounds.find((round) => round.id === activeRoundId) : undefined;
  const tabs = activeRound && isFinalRound(activeRound) ? finalTabs : callbackTabs;
  const activeCompetitors = useMemo(
    () => {
      if (!activeRound) return [];
      return competitors.filter((competitor) => (roundCompetitorIds[activeRound.id] ?? competitors.map((item) => item.id)).includes(competitor.id));
    },
    [activeRound, competitors, roundCompetitorIds]
  );
  const activeHeatEntries = useMemo(
    () => (activeRound ? heatEntries.filter((entry) => entry.roundId === activeRound.id) : []),
    [activeRound, heatEntries]
  );
  const activeJudges = useMemo(
    () => (activeRound ? roundJudges[activeRound.id] ?? createDefaultJudgePanel(activeRound.id) : []),
    [activeRound, roundJudges]
  );
  const activeJudgeAssignments = useMemo(
    () => Object.fromEntries(activeJudges.map((judge) => [judge.id, judge.roleAssignment])) as Record<string, JudgeAssignmentRole>,
    [activeJudges]
  );

  useEffect(() => {
    const nextContest = readLocalContests().find((item) => item.id === competitionId) ?? createContestShell(competitionId);
    const nextRounds = readLocalRounds()
      .filter((round) => round.competitionId === competitionId)
      .sort((a, b) => a.order - b.order);
    const storedRoundJudges = readLocalRoundJudges();
    const isDemoContest = competitionId === demoCompetition.id;

    setContest(nextContest);
    setRounds(nextRounds);
    setRoundConfigs(Object.fromEntries(nextRounds.map((round) => [round.id, round])));
    setActiveRoundId(nextRounds[0]?.id ?? "");
    setRoundCompetitorIds(
      isDemoContest
        ? {
            [demoRound.id]: demoCompetitors.map((competitor) => competitor.id),
            [demoFinalRound.id]: demoCouples.flatMap((couple) => [couple.leaderId, couple.followerId].filter(Boolean) as string[])
          }
        : {}
    );
    setCompetitors(isDemoContest ? demoCompetitors : []);
    setHeatEntries(isDemoContest ? demoHeatEntries : []);
    setCouples(isDemoContest ? demoCouples : []);
    setPanelScores(isDemoContest ? demoPrelimScores : []);
    setChiefScores(isDemoContest ? demoChiefScores : []);
    setRoundJudges({
      ...(isDemoContest ? { [demoRound.id]: demoJudges, [demoFinalRound.id]: demoJudges } : {}),
      ...storedRoundJudges
    });
    setActiveTab("setup");
    setNotice(null);
  }, [competitionId]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab("setup");
    }
  }, [activeRound?.id, activeTab, tabs]);

  const leaderResults = useMemo(
    () => (activeRound && isCallbackRound(activeRound) ? calculateRoleAdvancement("Leader", activeCompetitors, panelScores, chiefScores, activeRound, activeJudgeAssignments) : emptyAdvancementResult()),
    [activeCompetitors, panelScores, chiefScores, activeRound, activeJudgeAssignments]
  );
  const followerResults = useMemo(
    () => (activeRound && isCallbackRound(activeRound) ? calculateRoleAdvancement("Follower", activeCompetitors, panelScores, chiefScores, activeRound, activeJudgeAssignments) : emptyAdvancementResult()),
    [activeCompetitors, panelScores, chiefScores, activeRound, activeJudgeAssignments]
  );
  const advancementRows = [...leaderResults.rows, ...followerResults.rows];
  const finalsPanel = validateFinalScoringPanel({
    judges: activeJudges,
    chiefJudgeCounts: Boolean(activeRound?.chiefJudgeCountsForFinal)
  });
  const finalPlacements = useMemo(() => {
    const sheets = activeJudges
      .filter((judge) => finalsPanel.scoringJudgeIds.includes(judge.id))
      .map((judge) => convertRawScoresToOrdinals(demoFinalScores.filter((score) => score.judgeId === judge.id)));
    return calculateRelativePlacements(
      couples.map((couple) => couple.id),
      sheets
    );
  }, [activeJudges, couples, finalsPanel.scoringJudgeIds]);
  const pairingErrors = validateFinalPairings(couples);
  const accessLinks = useMemo(
    () =>
      activeRound?.judgePanelConfirmedAt
        ? buildRoundAccessLinks({
            competitionId: contest.id,
            round: activeRound,
            judges: activeJudges,
            judgeAssignments: activeJudgeAssignments
          })
        : [],
    [activeJudgeAssignments, activeJudges, activeRound, contest.id]
  );

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  function importCsv() {
    if (!activeRound) {
      setNotice("Add a Callback Round before importing competitors.");
      return;
    }

    const parsed = parseCompetitorCsv(csvText);
    setCsvErrors(parsed.errors);
    if (parsed.competitors.length > 0 && parsed.errors.length === 0 && !activeRound.setupLockedAt) {
      setCompetitors(parsed.competitors);
      setRoundCompetitorIds((current) => ({ ...current, [activeRound.id]: parsed.competitors.map((competitor) => competitor.id) }));
      setNotice("Competitors imported for this round.");
    }
  }

  function selectRound(roundId: string) {
    setActiveRoundId(roundId);
    setActiveTab("setup");
    setNotice(null);
  }

  function commitRounds(nextRounds: RoundConfig[]) {
    const sortedRounds = nextRounds.slice().sort((a, b) => a.order - b.order);
    setRounds(sortedRounds);
    setRoundConfigs(Object.fromEntries(sortedRounds.map((round) => [round.id, round])));
    writeLocalRounds([
      ...readLocalRounds().filter((round) => round.competitionId !== contest.id),
      ...sortedRounds
    ]);
  }

  function updateRound(roundId: string, updater: (round: RoundConfig) => RoundConfig) {
    const currentRound = roundConfigs[roundId] ?? rounds.find((round) => round.id === roundId);
    if (!currentRound) return;
    const updatedRound = updater(currentRound);
    commitRounds(rounds.map((round) => (round.id === roundId ? updatedRound : round)));
  }

  function commitRoundJudges(nextRoundJudges: Record<string, Judge[]>) {
    setRoundJudges(nextRoundJudges);
    writeLocalRoundJudges(nextRoundJudges);
  }

  function updateRoundJudgePanel(roundId: string, updater: (judges: Judge[]) => Judge[]) {
    const currentJudges = roundJudges[roundId] ?? createDefaultJudgePanel(roundId);
    commitRoundJudges({
      ...roundJudges,
      [roundId]: updater(currentJudges)
    });
    updateRound(roundId, (round) => ({ ...round, judgePanelConfirmedAt: undefined }));
  }

  function confirmJudgePanel() {
    if (!activeRound) return;
    const errors = validateJudgePanel(activeJudges);
    if (errors.length > 0) {
      setNotice(errors.join(" "));
      return;
    }

    if (isFinalRound(activeRound) && finalsPanel.errors.length > 0) {
      setNotice(finalsPanel.errors.join(" "));
      return;
    }

    updateRound(activeRound.id, (round) => ({
      ...round,
      judgePanelConfirmedAt: new Date().toISOString()
    }));
    setNotice(`${activeRound.name} judging panel confirmed. Access links are ready.`);
  }

  function startRound() {
    if (!activeRound) {
      setNotice("Add a round before starting.");
      return;
    }

    if (isFinalRound(activeRound) && finalsPanel.errors.length > 0) {
      setNotice(finalsPanel.errors.join(" "));
      return;
    }

    if (!activeRound.judgePanelConfirmedAt) {
      setNotice("Confirm the judging panel before starting this round.");
      return;
    }

    if (isCallbackRound(activeRound) && activeHeatEntries.length === 0) {
      setNotice("Generate heats before starting this Callback Round.");
      return;
    }

    updateRound(activeRound.id, (round) => ({
      ...round,
      status: "running",
      startedAt: new Date().toISOString(),
      setupLockedAt: new Date().toISOString(),
      setupSnapshot: {
        competitorIds: activeCompetitors.map((competitor) => competitor.id),
        judges: activeJudges,
        judgeAssignments: activeJudgeAssignments,
        heatEntryIds: activeHeatEntries.map((entry) => entry.id)
      }
    }));
    setNotice(`${activeRound.name} started. Setup is locked for judges.`);
  }

  function emergencyUnlock() {
    if (!activeRound) return;
    if (activeRound.status === "finalized") return;
    updateRound(activeRound.id, (round) => ({
      ...round,
      status: "draft",
      startedAt: undefined,
      setupLockedAt: undefined
    }));
    setNotice(`${activeRound.name} is unlocked. Judge submissions will need review before restart.`);
  }

  function finalizeRound() {
    if (!activeRound) {
      setNotice("Add a round before finalizing.");
      return;
    }

    if (isFinalRound(activeRound) && pairingErrors.length > 0) {
      setNotice(pairingErrors.join(" "));
      return;
    }

    updateRound(activeRound.id, (round) => ({
      ...round,
      status: "finalized",
      finalizedAt: new Date().toISOString()
    }));
    setNotice(`${activeRound.name} result snapshot finalized.`);
  }

  function generateHeats() {
    if (!activeRound) {
      setNotice("Add a Callback Round before generating heats.");
      return;
    }

    const nextEntries = generateHeatEntries({
      competitors: activeCompetitors,
      roundId: activeRound.id,
      heatCount,
      maxDancersPerHeat
    });
    setHeatEntries((current) => [...current.filter((entry) => entry.roundId !== activeRound.id), ...nextEntries]);
    setNotice(`Generated ${new Set(nextEntries.map((entry) => entry.heatNumber)).size} heats for ${activeRound.name}.`);
  }

  function moveHeatEntry(entryId: string, heatNumber: number) {
    setHeatEntries((current) => current.map((entry) => (entry.id === entryId ? { ...entry, heatNumber } : entry)));
  }

  function generateSemiFinalRound() {
    if (!activeRound) {
      addInitialCallbackRound();
      return;
    }

    const nextId = `${contest.id}-round-semi-final`;
    if (roundConfigs[nextId]) {
      selectRound(nextId);
      return;
    }

    const round = createCallbackRound({
      id: nextId,
      competitionId: contest.id,
      name: "Semi-Finals",
      stage: "semi_final",
      sourceRoundId: activeRound.id,
      order: rounds.length + 1
    });
    const nextCompetitors = competitorsFromRows(advancementRows);
    const existingFinal = rounds.find((item) => item.scoringMethod === "relative_placement");
    const finalRound = existingFinal
      ? { ...existingFinal, order: round.order + 1, sourceRoundId: round.id }
      : createFinalRound({ id: `${contest.id}-round-final`, competitionId: contest.id, sourceRoundId: round.id, order: round.order + 1 });
    commitRounds([...rounds.filter((item) => item.id !== finalRound.id), round, finalRound]);
    commitRoundJudges({
      ...roundJudges,
      [round.id]: roundJudges[round.id] ?? createDefaultJudgePanel(round.id),
      [finalRound.id]: roundJudges[finalRound.id] ?? createDefaultJudgePanel(finalRound.id)
    });
    setRoundCompetitorIds((current) => ({ ...current, [round.id]: nextCompetitors.map((competitor) => competitor.id) }));
    setHeatEntries((current) => [
      ...current,
      ...generateHeatEntries({ competitors: nextCompetitors, roundId: round.id, maxDancersPerHeat })
    ]);
    selectRound(round.id);
    setNotice("Semi-Final Callback Round generated from advancing callbacks.");
  }

  function generateFinalRound() {
    if (!activeRound) {
      addInitialFinalRound();
      return;
    }

    const nextCompetitors = competitorsFromRows(advancementRows);
    const leaders = nextCompetitors.filter((competitor) => competitor.role === "Leader");
    const followers = nextCompetitors.filter((competitor) => competitor.role === "Follower");
    const nextCouples = leaders.map((leader, index): Couple => ({
      id: `final-${leader.id}`,
      leaderId: leader.id,
      followerId: followers[index]?.id,
      danceOrder: index + 1
    }));
    const existingFinal = rounds.find((round) => round.scoringMethod === "relative_placement");
    const finalRound = existingFinal
      ? { ...existingFinal, sourceRoundId: activeRound.id }
      : createFinalRound({ id: `${contest.id}-round-final`, competitionId: contest.id, sourceRoundId: activeRound.id, order: rounds.length + 1 });
    setCouples(nextCouples.length > 0 ? nextCouples : couples);
    setRoundCompetitorIds((current) => ({ ...current, [finalRound.id]: nextCompetitors.map((competitor) => competitor.id) }));
    commitRounds(rounds.some((round) => round.id === finalRound.id) ? rounds.map((round) => (round.id === finalRound.id ? finalRound : round)) : [...rounds, finalRound]);
    commitRoundJudges({
      ...roundJudges,
      [finalRound.id]: roundJudges[finalRound.id] ?? createDefaultJudgePanel(finalRound.id)
    });
    selectRound(finalRound.id);
    setNotice("Final Round generated from the latest Callback Round.");
  }

  function addInitialCallbackRound() {
    const round = createCallbackRound({
      id: `${contest.id}-round-prelim`,
      competitionId: contest.id,
      name: "Prelims",
      stage: "prelim",
      sourceRoundId: "",
      order: 1
    });
    commitRounds([round]);
    commitRoundJudges({
      ...roundJudges,
      [round.id]: roundJudges[round.id] ?? createDefaultJudgePanel(round.id)
    });
    setRoundCompetitorIds((current) => ({ ...current, [round.id]: competitors.map((competitor) => competitor.id) }));
    setActiveRoundId(round.id);
    setActiveTab("setup");
    setNotice("Prelim Callback Round added.");
  }

  function addInitialFinalRound() {
    const round = createFinalRound({
      id: `${contest.id}-round-final`,
      competitionId: contest.id,
      sourceRoundId: "",
      order: 1
    });
    commitRounds([round]);
    commitRoundJudges({
      ...roundJudges,
      [round.id]: roundJudges[round.id] ?? createDefaultJudgePanel(round.id)
    });
    setActiveRoundId(round.id);
    setActiveTab("setup");
    setNotice("Final Round added.");
  }

  function setFinalFollower(coupleId: string, followerId: string) {
    setCouples((current) => current.map((couple) => (couple.id === coupleId ? { ...couple, followerId: followerId || undefined } : couple)));
  }

  return (
    <AppFrame
      eyebrow={`Contest / ${competitionId}`}
      title={contest.name}
      subtitle={`${contest.division} contest. Build each round, start it when setup is locked, then finalize a reproducible result snapshot.`}
      actions={
        <>
          <NavButton href="/admin/competitions">Contest Manager</NavButton>
          {competitionId === demoCompetition.id ? (
            <>
              <NavButton href="/judge/demo-judge" tone="dark">
                <Smartphone size={16} className="mr-2" /> Judge
              </NavButton>
              <NavButton href="/chief/demo-chief">Chief Judge</NavButton>
              <NavButton href="/emcee/demo-emcee">Emcee</NavButton>
            </>
          ) : null}
        </>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="grid gap-4">
          <Panel title="Rounds">
            <div className="grid gap-2">
              {rounds
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((round) => {
                  const resolvedRound = roundConfigs[round.id] ?? round;
                  return (
                    <button
                      key={round.id}
                      type="button"
                      onClick={() => selectRound(round.id)}
                      className={`rounded-[8px] border p-3 text-left transition ${
                        activeRound?.id === round.id ? "border-graphite bg-graphite text-paper" : "border-graphite/15 bg-paper text-graphite hover:bg-bluepaper"
                      }`}
                    >
                      <span className="font-black">{resolvedRound.name}</span>
                      <span className="mt-1 block text-xs font-bold uppercase opacity-75">{scoringMethodLabel(resolvedRound.scoringMethod)}</span>
                      <span className="mt-3 inline-flex rounded-full bg-chalk/80 px-2 py-1 font-mono text-[11px] font-black uppercase text-graphite">
                        {resolvedRound.status}
                      </span>
                    </button>
                  );
                })}
            </div>
          </Panel>

          <Panel title="Generate next round">
            <div className="grid gap-2">
              <button
                type="button"
                onClick={activeRound ? generateSemiFinalRound : addInitialCallbackRound}
                disabled={Boolean(activeRound && !isCallbackRound(activeRound))}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[6px] border border-graphite/15 bg-paper px-3 py-2 text-sm font-black hover:bg-bluepaper disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Plus size={16} />
                {activeRound ? "Semi-Final Callback Round" : "Prelim Callback Round"}
              </button>
              <button
                type="button"
                onClick={activeRound ? generateFinalRound : addInitialFinalRound}
                disabled={Boolean(activeRound && !isCallbackRound(activeRound))}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[6px] bg-graphite px-3 py-2 text-sm font-black text-paper disabled:cursor-not-allowed disabled:bg-graphite/35"
              >
                <Shuffle size={16} />
                Final Round
              </button>
            </div>
          </Panel>
        </div>

        <div className="min-w-0">
          {activeRound ? <RoundHeader round={activeRound} onStart={startRound} onUnlock={emergencyUnlock} onFinalize={finalizeRound} /> : null}

          {notice ? (
            <div className="mb-4 rounded-[8px] border border-brass/25 bg-brass/10 p-3 text-sm font-bold text-graphite" data-testid="admin-notice">
              {notice}
            </div>
          ) : null}

          {!activeRound ? (
            <EmptyRoundState onAddCallback={addInitialCallbackRound} onAddFinal={addInitialFinalRound} />
          ) : (
            <>
              <nav className="no-print mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
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
              {isCallbackRound(activeRound) ? (
            <CallbackRoundWorkspace
              activeTab={activeTab as CallbackTab}
              round={activeRound}
              competitors={activeCompetitors}
              csvText={csvText}
              csvErrors={csvErrors}
              heatCount={heatCount}
              maxDancersPerHeat={maxDancersPerHeat}
              heatEntries={activeHeatEntries}
              judges={activeJudges}
              leaderResults={leaderResults}
              followerResults={followerResults}
              onCsvTextChange={setCsvText}
              onImportCsv={importCsv}
              onRoundChange={(nextRound) => updateRound(activeRound.id, () => nextRound)}
              onHeatCountChange={setHeatCount}
              onMaxDancersPerHeatChange={setMaxDancersPerHeat}
              onGenerateHeats={generateHeats}
              onMoveHeatEntry={moveHeatEntry}
              onJudgesChange={(updater) => updateRoundJudgePanel(activeRound.id, updater)}
              onConfirmJudgePanel={confirmJudgePanel}
              panelScores={panelScores}
              chiefScores={chiefScores}
              accessLinks={accessLinks}
              origin={origin}
              contest={contest}
            />
              ) : (
            <FinalRoundWorkspace
              activeTab={activeTab as FinalTab}
              round={activeRound}
              competitors={competitors}
              couples={couples}
              panel={finalsPanel}
              pairingErrors={pairingErrors}
              placements={finalPlacements.placements}
              onRoundChange={(nextRound) => updateRound(activeRound.id, () => nextRound)}
              onFollowerChange={setFinalFollower}
              judges={activeJudges}
              onJudgesChange={(updater) => updateRoundJudgePanel(activeRound.id, updater)}
              onConfirmJudgePanel={confirmJudgePanel}
              accessLinks={accessLinks}
              origin={origin}
              contest={contest}
            />
              )}
            </>
          )}
        </div>
      </div>
    </AppFrame>
  );
}

function CallbackRoundWorkspace({
  activeTab,
  round,
  competitors,
  csvText,
  csvErrors,
  heatCount,
  maxDancersPerHeat,
  heatEntries,
  judges,
  leaderResults,
  followerResults,
  panelScores,
  chiefScores,
  accessLinks,
  origin,
  contest,
  onCsvTextChange,
  onImportCsv,
  onRoundChange,
  onHeatCountChange,
  onMaxDancersPerHeatChange,
  onGenerateHeats,
  onMoveHeatEntry,
  onJudgesChange,
  onConfirmJudgePanel
}: {
  activeTab: CallbackTab;
  round: RoundConfig;
  competitors: Competitor[];
  csvText: string;
  csvErrors: string[];
  heatCount: number;
  maxDancersPerHeat: number;
  heatEntries: HeatEntry[];
  judges: Judge[];
  leaderResults: ReturnType<typeof calculatePrelimAdvancement>;
  followerResults: ReturnType<typeof calculatePrelimAdvancement>;
  panelScores: RawScore[];
  chiefScores: RawScore[];
  accessLinks: RoundAccessLink[];
  origin: string;
  contest: Competition;
  onCsvTextChange: (value: string) => void;
  onImportCsv: () => void;
  onRoundChange: (round: RoundConfig) => void;
  onHeatCountChange: (value: number) => void;
  onMaxDancersPerHeatChange: (value: number) => void;
  onGenerateHeats: () => void;
  onMoveHeatEntry: (entryId: string, heatNumber: number) => void;
  onJudgesChange: (updater: (judges: Judge[]) => Judge[]) => void;
  onConfirmJudgePanel: () => void;
}) {
  if (activeTab === "setup") {
    return (
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Callback Round setup">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Round stage" value={roundStageLabel(round.stage)} />
            <Field label="Scoring method" value="Callback Round" />
            <NumberField label="Required Yeses per role" value={round.requiredYeses} disabled={Boolean(round.setupLockedAt)} onChange={(value) => onRoundChange({ ...round, requiredYeses: value })} />
            <NumberField label="Required alternates per role" value={round.requiredAlts} disabled={Boolean(round.setupLockedAt)} onChange={(value) => onRoundChange({ ...round, requiredAlts: value })} />
            <NumberField label="Callbacks per role" value={round.advancementCount} disabled={Boolean(round.setupLockedAt)} onChange={(value) => onRoundChange({ ...round, advancementCount: value })} />
            <Field label="Callback total" value={`${round.advancementCount} Leaders + ${round.advancementCount} Followers`} />
            <Field label="Setup lock" value={round.setupLockedAt ? "Locked after Start" : "Editable"} />
          </div>
        </Panel>
        <Panel title="Readiness">
          <ReadinessList
            rows={[
              ["Competitors", competitors.length > 0, `${competitors.length} dancers on this round`],
              ["Judges", Boolean(round.judgePanelConfirmedAt), round.judgePanelConfirmedAt ? `${scoringJudgeCount(judges)} scoring judges confirmed` : "Confirm names and role assignments"],
              ["Heats", heatEntries.length > 0, `${new Set(heatEntries.map((entry) => entry.heatNumber)).size} heats generated`],
              ["Results", round.status === "finalized", round.status === "finalized" ? "Snapshot finalized" : "Waiting for finalization"]
            ]}
          />
        </Panel>
      </div>
    );
  }

  if (activeTab === "competitors") {
    return (
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Panel
          title="CSV import"
          action={
            <button
              type="button"
              onClick={onImportCsv}
              disabled={Boolean(round.setupLockedAt)}
              className="inline-flex items-center gap-2 rounded-[6px] bg-graphite px-3 py-2 text-sm font-bold text-paper disabled:cursor-not-allowed disabled:bg-graphite/35"
            >
              <FileSpreadsheet size={16} /> Validate
            </button>
          }
        >
          <textarea
            value={csvText}
            onChange={(event) => onCsvTextChange(event.target.value)}
            disabled={Boolean(round.setupLockedAt)}
            className="min-h-[280px] w-full rounded-[6px] border border-graphite/20 bg-paper p-3 font-mono text-sm disabled:opacity-60"
          />
          {csvErrors.length > 0 ? (
            <div className="mt-3 rounded-[6px] bg-oxblood/10 p-3 text-sm font-bold text-oxblood">
              {csvErrors.join(" ")}
            </div>
          ) : null}
        </Panel>
        <CompetitorTable competitors={competitors} />
      </div>
    );
  }

  if (activeTab === "judges") {
    return (
      <JudgePanel
        round={round}
        judges={judges}
        locked={Boolean(round.setupLockedAt)}
        finalPanel={null}
        chiefJudgeCounts={chiefJudgeCountsForRound(round)}
        onChiefJudgeCountsChange={(counts) =>
          onRoundChange(applyCallbackChiefJudgeConfig(round, counts, chiefJudgeAssignment(judges)))
        }
        onChiefJudgeAssignmentChange={(assignment) => {
          onJudgesChange((current) => updateChiefJudgeAssignment(current, round.id, assignment));
          onRoundChange(applyCallbackChiefJudgeConfig(round, chiefJudgeCountsForRound(round), assignment));
        }}
        onJudgesChange={onJudgesChange}
        onConfirm={onConfirmJudgePanel}
      />
    );
  }

  if (activeTab === "access") {
    return <AccessLinksPanel contest={contest} round={round} accessLinks={accessLinks} origin={origin} />;
  }

  if (activeTab === "heats") {
    return (
      <div className="grid gap-4">
        <Panel title="Heat Builder">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <NumberField label="Number of heats" value={heatCount} disabled={Boolean(round.setupLockedAt)} onChange={onHeatCountChange} />
            <NumberField label="Max dancers per heat" value={maxDancersPerHeat} disabled={Boolean(round.setupLockedAt)} onChange={onMaxDancersPerHeatChange} />
            <button
              type="button"
              onClick={onGenerateHeats}
              disabled={Boolean(round.setupLockedAt)}
              className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-[6px] bg-graphite px-4 py-2 text-sm font-black text-paper disabled:cursor-not-allowed disabled:bg-graphite/35"
            >
              <Shuffle size={16} />
              Generate
            </button>
          </div>
        </Panel>
        <Panel title="Heat sheet">
          <HeatSheetGrid competitors={competitors} heatEntries={heatEntries} />
          {!round.setupLockedAt ? <HeatMoveControls heatEntries={heatEntries} competitors={competitors} onMove={onMoveHeatEntry} /> : null}
        </Panel>
      </div>
    );
  }

  if (activeTab === "results") {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <AdvancementPanel title="Leader advancement" competitors={competitors} result={leaderResults} />
        <AdvancementPanel title="Follower advancement" competitors={competitors} result={followerResults} />
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ExportCard title="Full raw scores" value={rawScoresCsv({ judges, competitors, scores: [...panelScores, ...chiefScores] })} />
      <ExportCard title="Advancement list" value={advancementCsv([...leaderResults.rows, ...followerResults.rows], competitors)} />
      <ExportCard title="Finals import" value={advancementCsv([...leaderResults.rows, ...followerResults.rows].filter((row) => row.status === "advancing"), competitors)} />
    </div>
  );
}

function FinalRoundWorkspace({
  activeTab,
  round,
  competitors,
  couples,
  panel,
  pairingErrors,
  placements,
  judges,
  onRoundChange,
  onFollowerChange,
  onJudgesChange,
  onConfirmJudgePanel,
  accessLinks,
  origin,
  contest
}: {
  activeTab: FinalTab;
  round: RoundConfig;
  competitors: Competitor[];
  couples: Couple[];
  panel: ReturnType<typeof validateFinalScoringPanel>;
  pairingErrors: string[];
  placements: ReturnType<typeof calculateRelativePlacements>["placements"];
  judges: Judge[];
  onRoundChange: (round: RoundConfig) => void;
  onFollowerChange: (coupleId: string, followerId: string) => void;
  onJudgesChange: (updater: (judges: Judge[]) => Judge[]) => void;
  onConfirmJudgePanel: () => void;
  accessLinks: RoundAccessLink[];
  origin: string;
  contest: Competition;
}) {
  if (activeTab === "setup") {
    return (
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Final Round setup">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Round stage" value={roundStageLabel(round.stage)} />
            <Field label="Scoring method" value="Final Round" />
            <Field label="Scoring judges" value={`${panel.scoringJudgeCount} counted`} />
            <Field label="Setup lock" value={round.setupLockedAt ? "Judges and leader order locked" : "Editable"} />
          </div>
        </Panel>
        <Panel title="Readiness">
            <ReadinessList
            rows={[
              ["Odd judging panel", panel.errors.length === 0, panel.errors.length === 0 ? "Panel is valid" : panel.errors.join(" ")],
              ["Judges", Boolean(round.judgePanelConfirmedAt), round.judgePanelConfirmedAt ? `${scoringJudgeCount(judges)} scoring judges confirmed` : "Confirm names before links are generated"],
              ["Leader order", couples.length > 0, `${couples.length} finals rows`],
              ["Follower bibs", pairingErrors.length === 0, pairingErrors.length === 0 ? "Pairings complete" : pairingErrors.join(" ")],
              ["Results", round.status === "finalized", round.status === "finalized" ? "Snapshot finalized" : "Waiting for finalization"]
            ]}
          />
        </Panel>
      </div>
    );
  }

  if (activeTab === "judges") {
    return (
      <JudgePanel
        round={round}
        judges={judges}
        locked={Boolean(round.setupLockedAt)}
        finalPanel={panel}
        chiefJudgeCounts={Boolean(round.chiefJudgeCountsForFinal)}
        onChiefJudgeCountsChange={(counts) =>
          onRoundChange({
            ...round,
            chiefJudgeCountsForFinal: counts,
            judgePanelConfirmedAt: undefined
          })
        }
        onJudgesChange={onJudgesChange}
        onConfirm={onConfirmJudgePanel}
      />
    );
  }

  if (activeTab === "access") {
    return <AccessLinksPanel contest={contest} round={round} accessLinks={accessLinks} origin={origin} />;
  }

  if (activeTab === "pairings") {
    return <PairingEditor competitors={competitors} couples={couples} locked={round.status === "finalized"} onFollowerChange={onFollowerChange} />;
  }

  if (activeTab === "results") {
    return (
      <Panel title="Relative Placement results">
        {pairingErrors.length > 0 ? (
          <div className="mb-3 rounded-[6px] border border-oxblood/20 bg-oxblood/10 p-3 text-sm font-bold text-oxblood">
            {pairingErrors.join(" ")}
          </div>
        ) : null}
        <PlacementTable placements={placements} couples={couples} competitors={competitors} />
      </Panel>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ExportCard title="Final placements" value={placementsCsv(placements, couples, competitors)} />
      <ExportCard title="Final raw scores" value={rawScoresCsv({ judges, competitors, couples, scores: demoFinalScores })} />
    </div>
  );
}

function EmptyRoundState({
  onAddCallback,
  onAddFinal
}: {
  onAddCallback: () => void;
  onAddFinal: () => void;
}) {
  return (
    <Panel title="No rounds yet">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-sm font-bold leading-6 text-graphite/70">
            Add the first round for this contest. Most Jack and Jill contests begin with a Callback Round, then generate later Callback or Final rounds from finalized results.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[380px]">
          <button
            type="button"
            onClick={onAddCallback}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[6px] bg-graphite px-4 py-2 text-sm font-black text-paper"
          >
            <Plus size={16} />
            Add Prelim Callback Round
          </button>
          <button
            type="button"
            onClick={onAddFinal}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[6px] border border-graphite/15 bg-paper px-4 py-2 text-sm font-black text-graphite hover:bg-bluepaper"
          >
            <Shuffle size={16} />
            Add Final Round
          </button>
        </div>
      </div>
    </Panel>
  );
}

function RoundHeader({
  round,
  onStart,
  onUnlock,
  onFinalize
}: {
  round: RoundConfig;
  onStart: () => void;
  onUnlock: () => void;
  onFinalize: () => void;
}) {
  return (
    <Panel className="mb-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-mono text-xs font-black uppercase tracking-[0.18em] text-brass">{roundTypeLabel(round)}</p>
          <h2 className="mt-1 text-2xl font-black text-ink">{round.name}</h2>
          <p className="mt-1 text-sm font-bold text-graphite/65">
            {round.setupLockedAt ? "Setup is locked for live judging." : "Setup is editable until Start."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onStart}
            disabled={round.status === "running" || round.status === "finalized"}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[6px] bg-graphite px-4 py-2 text-sm font-black text-paper disabled:cursor-not-allowed disabled:bg-graphite/35"
          >
            <Lock size={16} />
            Start
          </button>
          <button
            type="button"
            onClick={onUnlock}
            disabled={!round.setupLockedAt || round.status === "finalized"}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[6px] border border-graphite/15 bg-paper px-4 py-2 text-sm font-black hover:bg-bluepaper disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Unlock size={16} />
            Emergency unlock
          </button>
          <button
            type="button"
            onClick={onFinalize}
            disabled={round.status === "finalized"}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[6px] border border-celadon/40 bg-celadon/20 px-4 py-2 text-sm font-black text-graphite disabled:cursor-not-allowed disabled:opacity-45"
          >
            <CheckCircle2 size={16} />
            Finalize snapshot
          </button>
        </div>
      </div>
    </Panel>
  );
}

function JudgePanel({
  round,
  judges,
  locked,
  finalPanel,
  chiefJudgeCounts = false,
  onChiefJudgeCountsChange,
  onChiefJudgeAssignmentChange,
  onJudgesChange,
  onConfirm
}: {
  round: RoundConfig;
  judges: Judge[];
  locked: boolean;
  finalPanel: ReturnType<typeof validateFinalScoringPanel> | null;
  chiefJudgeCounts?: boolean;
  onChiefJudgeCountsChange: (counts: boolean) => void;
  onChiefJudgeAssignmentChange?: (assignment: JudgeAssignmentRole) => void;
  onJudgesChange: (updater: (judges: Judge[]) => Judge[]) => void;
  onConfirm: () => void;
}) {
  const panelJudges = judges.filter((judge) => !judge.isChiefJudge);
  const chiefJudge = judges.find((judge) => judge.isChiefJudge) ?? createChiefJudge(round.id);
  const panelErrors = [...validateJudgePanel(judges), ...(finalPanel?.errors ?? [])];
  const chiefCountDescription = isFinalRound(round)
    ? chiefJudgeCounts
      ? "Included in the odd-number finals panel."
      : "Review access only; excluded from the finals panel count."
    : chiefJudgeCounts
      ? "Included as a normal callback scoring sheet."
      : "Tiebreak and boundary review only.";

  return (
    <div className="grid gap-4">
      <Panel
        title="Round judging panel"
        action={
          <span className={`rounded-full px-3 py-1 font-mono text-xs font-black uppercase ${round.judgePanelConfirmedAt ? "bg-celadon/20 text-graphite" : "bg-brass/15 text-graphite"}`}>
            {round.judgePanelConfirmedAt ? "Confirmed" : "Needs confirmation"}
          </span>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <NumberField
            label="Number of scoring judges"
            value={panelJudges.length}
            disabled={locked}
            onChange={(value) => onJudgesChange((current) => resizeScoringJudges(current, round.id, value))}
          />
          <label className="grid gap-1">
            <span className="font-mono text-xs uppercase tracking-[0.18em] text-graphite/55">Chief Judge name</span>
            <input
              type="text"
              aria-label="Chief Judge name"
              data-testid="chief-judge-name"
              value={chiefJudge.name}
              disabled={locked}
              onChange={(event) => onJudgesChange((current) => updateChiefJudgeName(current, round.id, event.target.value))}
              className="rounded-[6px] border border-graphite/15 bg-paper px-3 py-3 font-bold text-graphite disabled:opacity-60"
            />
          </label>
        </div>

        {panelErrors.length > 0 ? (
          <div className="mt-4 rounded-[6px] border border-oxblood/20 bg-oxblood/10 p-3 text-sm font-bold text-oxblood">
            {panelErrors.join(" ")}
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {panelJudges.map((judge, index) => (
            <article key={judge.id} className="rounded-[8px] border border-graphite/15 bg-paper p-4">
              <Gavel className="text-brass" size={20} />
              <label className="mt-3 grid gap-1">
                <span className="font-mono text-xs uppercase tracking-[0.18em] text-graphite/55">Judge {index + 1} name</span>
                <input
                  type="text"
                  aria-label={`Judge ${index + 1} name`}
                  data-testid={`judge-name-${index + 1}`}
                  value={judge.name}
                  disabled={locked}
                  onChange={(event) => onJudgesChange((current) => updateJudgeName(current, judge.id, event.target.value))}
                  className="rounded-[6px] border border-graphite/15 bg-chalk px-3 py-2 font-bold text-graphite disabled:opacity-60"
                />
              </label>
              <p className="mt-3 rounded-full bg-bluepaper px-3 py-1 text-xs font-bold uppercase text-graphite">
                {isFinalRound(round) ? "Finals panel" : roleAssignmentLabel(judge.roleAssignment)}
              </p>
              {!isFinalRound(round) ? (
                <div className="mt-4 grid grid-cols-3 gap-1 rounded-[6px] border border-graphite/15 bg-chalk p-1">
                  {assignmentOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={judge.roleAssignment === option.value}
                      data-testid={`judge-role-${index + 1}-${option.value}`}
                      disabled={locked}
                      onClick={() => onJudgesChange((current) => updateJudgeAssignment(current, judge.id, option.value))}
                      className={`min-h-9 rounded-[5px] text-sm font-black disabled:cursor-not-allowed disabled:opacity-50 ${
                        judge.roleAssignment === option.value ? "bg-graphite text-paper" : "bg-transparent text-graphite hover:bg-paper"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </article>
          ))}

          <article className="rounded-[8px] border border-graphite/15 bg-paper p-4">
            <Gavel className={chiefJudgeCounts ? "text-brass" : "text-graphite/45"} size={20} />
            <h3 className="mt-3 font-black">{chiefJudge.name}</h3>
            <p className="mt-1 text-sm font-bold text-graphite/75">{chiefJudgeCounts ? "Counts as scoring judge" : "Chief Judge access"}</p>
            <p className="mt-3 rounded-full bg-bluepaper px-3 py-1 text-xs font-bold uppercase text-graphite">
              {isFinalRound(round) ? "Final review" : chiefJudgeCounts ? "Callback scoring sheet" : "Raw tiebreak scores"}
            </p>
            {!isFinalRound(round) ? (
              <div className="mt-4 grid grid-cols-3 gap-1 rounded-[6px] border border-graphite/15 bg-chalk p-1">
                {assignmentOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={chiefJudge.roleAssignment === option.value}
                    data-testid={`chief-role-${option.value}`}
                    disabled={locked}
                    onClick={() => onChiefJudgeAssignmentChange?.(option.value)}
                    className={`min-h-9 rounded-[5px] text-sm font-black disabled:cursor-not-allowed disabled:opacity-50 ${
                      chiefJudge.roleAssignment === option.value ? "bg-graphite text-paper" : "bg-transparent text-graphite hover:bg-paper"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
            <label className="mt-4 flex min-h-[78px] items-start gap-3 rounded-[6px] border border-graphite/15 bg-chalk p-3 font-bold">
              <input
                type="checkbox"
                aria-label="Chief Judge score counts"
                checked={chiefJudgeCounts}
                disabled={locked}
                onChange={(event) => onChiefJudgeCountsChange(event.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-graphite disabled:cursor-not-allowed"
              />
              <span className="grid gap-1">
                <span>Chief Judge score counts</span>
                <span className="text-sm leading-5 text-graphite/60">{chiefCountDescription}</span>
              </span>
            </label>
          </article>
        </div>

        <CountedPanelSummary
          round={round}
          panelJudges={panelJudges}
          chiefJudge={chiefJudge}
          chiefJudgeCounts={chiefJudgeCounts}
        />

        <button
          type="button"
          onClick={onConfirm}
          disabled={locked || panelErrors.length > 0}
          data-testid="confirm-judge-panel"
          className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-[6px] bg-graphite px-4 py-2 text-sm font-black text-paper disabled:cursor-not-allowed disabled:bg-graphite/35"
        >
          <CheckCircle2 size={16} />
          Confirm panel
        </button>
      </Panel>
    </div>
  );
}

function CountedPanelSummary({
  round,
  panelJudges,
  chiefJudge,
  chiefJudgeCounts
}: {
  round: RoundConfig;
  panelJudges: Judge[];
  chiefJudge: Judge;
  chiefJudgeCounts: boolean;
}) {
  if (isFinalRound(round)) {
    const countedJudges = chiefJudgeCounts ? [...panelJudges, chiefJudge] : panelJudges;
    return (
      <div className="mt-4 rounded-[8px] border border-graphite/15 bg-paper p-4" data-testid="counted-panel-summary">
        <p className="font-mono text-xs font-black uppercase tracking-[0.18em] text-graphite/55">Scores counting at confirmation</p>
        <p className="mt-2 text-lg font-black text-graphite">{countedJudges.length} finals scoring judges</p>
        <p className="mt-1 text-sm font-bold leading-6 text-graphite/65">{judgeNameList(countedJudges)}</p>
      </div>
    );
  }

  const rows = (["Leader", "Follower"] as Role[]).map((role) => {
    const countedJudges = countedCallbackJudgesForRole(role, panelJudges, chiefJudge, chiefJudgeCounts);
    return {
      role,
      countedJudges
    };
  });

  return (
    <div className="mt-4 rounded-[8px] border border-graphite/15 bg-paper p-4" data-testid="counted-panel-summary">
      <p className="font-mono text-xs font-black uppercase tracking-[0.18em] text-graphite/55">Scores counting at confirmation</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {rows.map(({ role, countedJudges }) => (
          <div key={role} data-testid={`counted-${role.toLowerCase()}s`} className="rounded-[6px] border border-graphite/10 bg-chalk p-3">
            <p className="text-sm font-black uppercase text-graphite/60">{role}s</p>
            <p className="mt-1 text-2xl font-black text-graphite">{countedJudges.length} counted</p>
            <p className="mt-1 text-sm font-bold leading-6 text-graphite/65">{judgeNameList(countedJudges)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AccessLinksPanel({
  contest,
  round,
  accessLinks,
  origin
}: {
  contest: Competition;
  round: RoundConfig;
  accessLinks: RoundAccessLink[];
  origin: string;
}) {
  const groups: Array<{ role: RoundAccessLink["role"]; title: string; detail: string }> = [
    { role: "judge", title: "Judge sheets", detail: "Round-specific scoring links for the assigned panel." },
    { role: "chief", title: "Chief Judge", detail: "Raw score review, tiebreak scoring, and finalization support." },
    { role: "emcee", title: "Emcee", detail: "Read-only announcing views for heats, callbacks, pairings, and placements." }
  ];
  const judgeChatMessage = buildJudgeChatMessage({ contest, round, accessLinks, origin });

  return (
    <div className="grid gap-4">
      <Panel title="Access links">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <p className="text-sm font-bold leading-6 text-graphite/70">
              {round.judgePanelConfirmedAt
                ? `Links are generated for this ${round.name} round and reflect the confirmed judge panel.`
                : `Confirm the judging panel for ${round.name} before generating access links.`}
            </p>
          </div>
          <div className="rounded-[6px] border border-brass/20 bg-brass/10 px-3 py-2 text-sm font-bold text-graphite">
            Supabase Beta should replace these with stored opaque tokens.
          </div>
        </div>
      </Panel>

      {!round.judgePanelConfirmedAt ? (
        <Panel title="Links locked">
          <p className="text-sm font-bold leading-6 text-graphite/70">
            Go to the Judges tab, set the number of scoring judges, enter names, assign roles, then confirm the panel.
          </p>
        </Panel>
      ) : null}

      {round.judgePanelConfirmedAt && judgeChatMessage ? (
        <Panel
          title="Judge chat copy"
          action={<CopyLinkButton value={judgeChatMessage} label="Copy message" />}
        >
          <pre
            data-testid="whatsapp-message-preview"
            className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-[6px] border border-graphite/15 bg-chalk p-3 font-sans text-sm font-bold leading-6 text-graphite"
          >
            {judgeChatMessage}
          </pre>
        </Panel>
      ) : null}

      {groups.map((group) => {
        const links = accessLinks.filter((link) => link.role === group.role);
        if (links.length === 0) return null;
        return (
          <Panel key={group.role} title={group.title}>
            <p className="mb-3 text-sm font-bold text-graphite/65">{group.detail}</p>
            <div className="grid gap-3">
              {links.map((link) => (
                <article
                  key={link.id}
                  data-testid={`access-link-${link.id}`}
                  className="grid gap-3 rounded-[8px] border border-graphite/15 bg-paper p-3 lg:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <Link2 size={16} className="shrink-0 text-brass" />
                      <h3 className="truncate font-black text-graphite">{link.label}</h3>
                    </div>
                    <p className="mt-1 text-sm font-bold text-graphite/65">{link.description}</p>
                    <p className="mt-2 break-all rounded-[6px] bg-chalk px-2 py-2 font-mono text-xs text-graphite/75">
                      {absoluteHref(origin, link.href)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <CopyLinkButton value={absoluteHref(origin, link.href)} />
                    <NavButton href={link.href} testId={`access-open-${link.id}`}>
                      <ExternalLink size={15} className="mr-2" />
                      Open
                    </NavButton>
                  </div>
                </article>
              ))}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}

function CopyLinkButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await window.navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copyLink()}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[6px] bg-graphite px-3 py-2 text-sm font-black text-paper"
    >
      <Copy size={15} />
      {copied ? "Copied" : label}
    </button>
  );
}

function buildJudgeChatMessage({
  contest,
  round,
  accessLinks,
  origin
}: {
  contest: Competition;
  round: RoundConfig;
  accessLinks: RoundAccessLink[];
  origin: string;
}) {
  const chiefLinks = accessLinks.filter((link) => link.role === "chief");
  const judgeLinks = accessLinks.filter((link) => link.role === "judge");
  const messageLinks = [...chiefLinks, ...judgeLinks];
  if (messageLinks.length === 0) return "";

  const headingParts = [contest.division, round.name].filter(Boolean);
  const heading = headingParts.length > 0 ? `${headingParts.join(" ")} Judge Sheets` : `${round.name} Judge Sheets`;
  return [
    `*${heading}*`,
    ...messageLinks.map((link) => `${link.displayName} (${link.messageRole}): ${absoluteHref(origin, link.href)}`)
  ].join("\n");
}

function absoluteHref(origin: string, href: string) {
  return `${origin || "http://localhost:3000"}${href}`;
}

function PairingEditor({
  competitors,
  couples,
  locked,
  onFollowerChange
}: {
  competitors: Competitor[];
  couples: Couple[];
  locked: boolean;
  onFollowerChange: (coupleId: string, followerId: string) => void;
}) {
  const followers = competitors.filter((competitor) => competitor.role === "Follower");
  return (
    <Panel title="Leader-ordered pairings">
      <div className="grid gap-2">
        {couples.map((couple) => {
          const leader = competitors.find((competitor) => competitor.id === couple.leaderId);
          return (
            <div key={couple.id} className="grid gap-3 rounded-[8px] border border-graphite/15 bg-paper p-3 md:grid-cols-[80px_minmax(0,1fr)_minmax(220px,0.7fr)] md:items-center">
              <span className="font-display text-3xl font-black text-brass">#{couple.danceOrder}</span>
              <div className="min-w-0">
                <p className="font-black">L{leader?.bibNumber ?? "?"} {leader?.preferredName ?? "Unknown leader"}</p>
                <p className="mt-1 text-xs font-bold uppercase text-graphite/55">Leader order is locked after Start</p>
              </div>
              <label className="grid gap-1">
                <span className="font-mono text-xs uppercase tracking-[0.18em] text-graphite/55">Follower bib</span>
                <select
                  value={couple.followerId ?? ""}
                  disabled={locked}
                  onChange={(event) => onFollowerChange(couple.id, event.target.value)}
                  className="rounded-[6px] border border-graphite/15 bg-chalk px-3 py-2 font-bold"
                >
                  <option value="">Unassigned</option>
                  {followers.map((follower) => (
                    <option key={follower.id} value={follower.id}>
                      F{follower.bibNumber} {follower.preferredName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function HeatMoveControls({
  heatEntries,
  competitors,
  onMove
}: {
  heatEntries: HeatEntry[];
  competitors: Competitor[];
  onMove: (entryId: string, heatNumber: number) => void;
}) {
  const heatNumbers = Array.from(new Set(heatEntries.map((entry) => entry.heatNumber))).sort((a, b) => a - b);
  return (
    <div className="mt-4 grid gap-2">
      {heatEntries.map((entry) => {
        const competitor = competitors.find((item) => item.id === entry.competitorId);
        return (
          <label key={entry.id} className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-2 rounded-[6px] bg-chalk px-3 py-2 text-sm font-bold">
            <span>{competitorLabel(competitor)}</span>
            <select
              value={entry.heatNumber}
              onChange={(event) => onMove(entry.id, Number(event.target.value))}
              className="rounded-[6px] border border-graphite/15 bg-paper px-2 py-1"
            >
              {heatNumbers.map((heatNumber) => (
                <option key={heatNumber} value={heatNumber}>
                  Heat {heatNumber}
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
  );
}

function ReadinessList({ rows }: { rows: Array<[string, boolean, string]> }) {
  return (
    <div className="grid gap-2">
      {rows.map(([label, ready, detail]) => (
        <div key={label} className="grid grid-cols-[28px_minmax(0,1fr)] gap-2 rounded-[6px] bg-paper px-3 py-2">
          {ready ? <CheckCircle2 size={18} className="mt-0.5 text-celadon" /> : <AlertTriangle size={18} className="mt-0.5 text-brass" />}
          <div>
            <p className="font-black">{label}</p>
            <p className="text-sm font-bold text-graphite/65">{detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function createDefaultJudgePanel(roundId: string, count = 3): Judge[] {
  return [...Array.from({ length: Math.max(1, count) }, (_, index) => createScoringJudge(roundId, index + 1)), createChiefJudge(roundId)];
}

function createScoringJudge(roundId: string, index: number): Judge {
  return {
    id: `${roundId}-judge-${index}`,
    name: `Judge ${index}`,
    roleAssignment: "both"
  };
}

function createChiefJudge(roundId: string): Judge {
  return {
    id: `${roundId}-chief`,
    name: "Chief Judge",
    roleAssignment: "both",
    isChiefJudge: true
  };
}

function resizeScoringJudges(judges: Judge[], roundId: string, count: number): Judge[] {
  const nextCount = Math.max(1, Math.min(15, Math.floor(Number.isFinite(count) ? count : 1)));
  const currentPanel = judges.filter((judge) => !judge.isChiefJudge);
  const chiefJudge = judges.find((judge) => judge.isChiefJudge) ?? createChiefJudge(roundId);
  const nextPanel = currentPanel.slice(0, nextCount);
  for (let index = nextPanel.length; index < nextCount; index += 1) {
    nextPanel.push(createScoringJudge(roundId, index + 1));
  }
  return [...nextPanel, chiefJudge];
}

function updateJudgeName(judges: Judge[], judgeId: string, name: string): Judge[] {
  return judges.map((judge) => (judge.id === judgeId ? { ...judge, name } : judge));
}

function updateChiefJudgeName(judges: Judge[], roundId: string, name: string): Judge[] {
  const hasChiefJudge = judges.some((judge) => judge.isChiefJudge);
  const nextJudges = hasChiefJudge ? judges : [...judges, createChiefJudge(roundId)];
  return nextJudges.map((judge) => (judge.isChiefJudge ? { ...judge, name } : judge));
}

function updateChiefJudgeAssignment(judges: Judge[], roundId: string, roleAssignment: JudgeAssignmentRole): Judge[] {
  const hasChiefJudge = judges.some((judge) => judge.isChiefJudge);
  const nextJudges = hasChiefJudge ? judges : [...judges, createChiefJudge(roundId)];
  return nextJudges.map((judge) => (judge.isChiefJudge ? { ...judge, roleAssignment } : judge));
}

function updateJudgeAssignment(judges: Judge[], judgeId: string, roleAssignment: JudgeAssignmentRole): Judge[] {
  return judges.map((judge) => (judge.id === judgeId ? { ...judge, roleAssignment } : judge));
}

function validateJudgePanel(judges: Judge[]) {
  const errors: string[] = [];
  const panelJudges = judges.filter((judge) => !judge.isChiefJudge);
  const chiefJudge = judges.find((judge) => judge.isChiefJudge);
  if (panelJudges.length < 1) errors.push("Add at least one scoring judge.");
  if (!chiefJudge) errors.push("Add a Chief Judge.");
  if (chiefJudge && chiefJudge.name.trim().length === 0) errors.push("Chief Judge name is required.");
  const unnamedJudge = panelJudges.find((judge, index) => judge.name.trim().length === 0 ? index + 1 : false);
  if (unnamedJudge) errors.push("Every scoring judge needs a name.");
  return errors;
}

function scoringJudgeCount(judges: Judge[]) {
  return judges.filter((judge) => !judge.isChiefJudge).length;
}

function chiefJudgeAssignment(judges: Judge[]) {
  return judges.find((judge) => judge.isChiefJudge)?.roleAssignment ?? "both";
}

function applyCallbackChiefJudgeConfig(round: RoundConfig, counts: boolean, assignment: JudgeAssignmentRole): RoundConfig {
  return {
    ...round,
    leaderChiefJudgeMode: chiefJudgeModeForRole(counts, assignment, "Leader"),
    followerChiefJudgeMode: chiefJudgeModeForRole(counts, assignment, "Follower"),
    judgePanelConfirmedAt: undefined
  };
}

function chiefJudgeModeForRole(counts: boolean, assignment: JudgeAssignmentRole, role: Role) {
  if (!roleAssignmentAllows(assignment, role)) return "none";
  return counts ? "full_panel" : "tiebreak_only";
}

function countedCallbackJudgesForRole(role: Role, panelJudges: Judge[], chiefJudge: Judge, chiefJudgeCounts: boolean) {
  const countedJudges = panelJudges.filter((judge) => roleAssignmentAllows(judge.roleAssignment, role));
  if (chiefJudgeCounts && roleAssignmentAllows(chiefJudge.roleAssignment, role)) {
    countedJudges.push(chiefJudge);
  }
  return countedJudges;
}

function judgeNameList(judges: Judge[]) {
  if (judges.length === 0) return "No scoring sheets count for this role.";
  return judges.map((judge) => judge.name).join(", ");
}

function calculateRoleAdvancement(
  role: Role,
  competitors: Competitor[],
  panelScores: RawScore[],
  chiefScores: RawScore[],
  round: RoundConfig,
  judgeAssignments: Record<string, JudgeAssignmentRole>
) {
  const roleCompetitors = competitors.filter((competitor) => competitor.role === role);
  return calculatePrelimAdvancement({
    competitors: roleCompetitors,
    panelScores: panelScores.filter((score) => score.role === role && roleAssignmentAllows(judgeAssignments[score.judgeId] ?? "both", role)),
    chiefScores: chiefScores.filter((score) => score.role === role),
    requiredYeses: round.requiredYeses,
    requiredAlts: round.requiredAlts,
    advancementCount: round.advancementCount,
    chiefJudgeMode: role === "Leader" ? round.leaderChiefJudgeMode : round.followerChiefJudgeMode
  });
}

function createCallbackRound({
  id,
  competitionId,
  name,
  stage,
  sourceRoundId,
  order
}: {
  id: string;
  competitionId: string;
  name: string;
  stage: RoundStage;
  sourceRoundId: string;
  order: number;
}): RoundConfig {
  return {
    id,
    competitionId,
    name,
    stage,
    scoringMethod: "callback",
    status: "draft",
    order,
    requiredYeses: 3,
    requiredAlts: 2,
    advancementCount: demoRound.advancementCount,
    leaderChiefJudgeMode: "tiebreak_only",
    followerChiefJudgeMode: "tiebreak_only",
    sourceRoundId
  };
}

function createFinalRound({
  id,
  competitionId,
  sourceRoundId,
  order
}: {
  id: string;
  competitionId: string;
  sourceRoundId: string;
  order: number;
}): RoundConfig {
  return {
    id,
    competitionId,
    name: "Finals",
    stage: "final",
    scoringMethod: "relative_placement",
    status: "draft",
    order,
    requiredYeses: 0,
    requiredAlts: 0,
    advancementCount: 0,
    leaderChiefJudgeMode: "none",
    followerChiefJudgeMode: "none",
    chiefJudgeCountsForFinal: false,
    sourceRoundId: sourceRoundId || undefined
  };
}

function emptyAdvancementResult(): ReturnType<typeof calculatePrelimAdvancement> {
  return {
    rows: [],
    ties: [],
    judgeMarks: []
  };
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="grid gap-1">
      <span className="font-mono text-xs uppercase tracking-[0.18em] text-graphite/55">{label}</span>
      <span className="rounded-[6px] border border-graphite/15 bg-paper px-3 py-3 font-bold text-graphite">{value}</span>
    </label>
  );
}

function NumberField({ label, value, onChange, disabled = false }: { label: string; value: number; onChange: (value: number) => void; disabled?: boolean }) {
  return (
    <label className="grid gap-1">
      <span className="font-mono text-xs uppercase tracking-[0.18em] text-graphite/55">{label}</span>
      <input
        type="number"
        min="0"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="rounded-[6px] border border-graphite/15 bg-paper px-3 py-3 font-bold text-graphite disabled:opacity-60"
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

function PlacementTable({ placements, couples, competitors }: { placements: ReturnType<typeof calculateRelativePlacements>["placements"]; couples: Couple[]; competitors: Competitor[] }) {
  return (
    <div className="grid gap-2">
      {placements.map((placement) => {
        const couple = couples.find((item) => item.id === placement.coupleId);
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

function competitorsFromRows(rows: AdvancementRow[]) {
  const advancingIds = new Set(rows.filter((row) => row.status === "advancing").map((row) => row.competitorId));
  return demoCompetitors
    .filter((competitor) => advancingIds.has(competitor.id))
    .sort((a, b) => (a.role === b.role ? a.bibNumber.localeCompare(b.bibNumber, undefined, { numeric: true }) : a.role === "Leader" ? -1 : 1));
}
