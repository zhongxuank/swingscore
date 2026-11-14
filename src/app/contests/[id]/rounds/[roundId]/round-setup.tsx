"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { STAGE_LABELS } from "@/core/round-rules";
import { errorMessage, useContestStore } from "@/components/use-contest-store";
import { StoreError } from "@/data/store";
import type { Contest, Round, RoundJudge, RoundSettings } from "@/data/types";
import { CallbackResultsSection } from "./callback-results-section";
import { CouplesSection } from "./couples-section";
import { FinalResultsSection } from "./final-results-section";
import { ProgressSection } from "./progress-section";
import { HeatsSection } from "./heats-section";
import { PanelSection } from "./panel-section";
import { RoundSettingsForm } from "./round-settings-form";

export function RoundSetup({ contestId, roundId }: { contestId: string; roundId: string }) {
  const store = useContestStore();
  const [contest, setContest] = useState<Contest | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [judges, setJudges] = useState<RoundJudge[]>([]);

  const load = useCallback(async () => {
    try {
      const loaded = await store.getRound(roundId);
      if (loaded.contestId !== contestId) throw new StoreError("not_found", "Round not in this contest.");
      setRound(loaded);
      setContest(await store.getContest(contestId));
    } catch (problem) {
      if (problem instanceof StoreError && problem.code === "not_found") setMissing(true);
      else setError(errorMessage(problem));
    }
  }, [store, contestId, roundId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSettings(settings: RoundSettings) {
    setError(null);
    try {
      setRound(await store.updateRoundSettings(roundId, settings));
    } catch (problem) {
      setError(errorMessage(problem));
    }
  }

  if (missing) {
    return (
      <p className="text-sm text-gray-600">
        This round does not exist or is not yours. <Link href="/contests" className="underline">Back to contests</Link>
      </p>
    );
  }
  if (!round || !contest) return <p className="text-sm text-gray-500">{error ?? "Loading…"}</p>;

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/contests/${contestId}`} className="text-sm text-gray-600 underline">
          {contest.name}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{STAGE_LABELS[round.stage]}</h1>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <RoundSettingsForm key={`${round.id}-${round.yesCount}-${round.altCount}-${round.maxPerHeat}-${round.chiefJudgeCounts}`} round={round} onSave={saveSettings} />
      <PanelSection round={round} onJudges={setJudges} />
      {round.kind === "callback" ? <HeatsSection round={round} /> : <CouplesSection round={round} />}
      <ProgressSection round={round} judges={judges} />
      {round.kind === "callback" ? <CallbackResultsSection round={round} /> : <FinalResultsSection round={round} judges={judges} />}
    </div>
  );
}
