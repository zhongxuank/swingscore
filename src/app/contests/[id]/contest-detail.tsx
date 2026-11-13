"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { checkNewStage, ROUND_STAGES, STAGE_LABELS, type RoundStage } from "@/core/round-rules";
import { errorMessage, useContestStore } from "@/components/use-contest-store";
import { StoreError } from "@/data/store";
import type { Contest, Round } from "@/data/types";
import { RoundSettingsForm } from "./round-settings-form";

export function ContestDetail({ contestId }: { contestId: string }) {
  const store = useContestStore();
  const [contest, setContest] = useState<Contest | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [missing, setMissing] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const loaded = await store.getContest(contestId);
      setContest(loaded);
      setName(loaded.name);
      setRounds(await store.listRounds(contestId));
    } catch (problem) {
      if (problem instanceof StoreError && problem.code === "not_found") setMissing(true);
      else setError(errorMessage(problem));
    }
  }, [store, contestId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      await load();
    } catch (problem) {
      setError(errorMessage(problem));
    }
  }

  if (missing) {
    return (
      <p className="text-sm text-gray-600">
        This contest does not exist or is not yours. <Link href="/contests" className="underline">Back to contests</Link>
      </p>
    );
  }
  if (!contest) return <p className="text-sm text-gray-500">Loading…</p>;

  const stages = rounds.map((round) => round.stage);
  const addable = ROUND_STAGES.filter((stage) => checkNewStage(stages, stage) === null);

  function onRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(() => store.renameContest(contestId, name));
  }

  return (
    <div className="space-y-6">
      <Link href="/contests" className="text-sm text-gray-600 underline">
        All contests
      </Link>

      <form onSubmit={onRename} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label htmlFor="contest-name" className="sr-only">
          Contest name
        </label>
        <input
          id="contest-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-xl font-semibold"
        />
        <button
          type="submit"
          disabled={name.trim() === "" || name.trim() === contest.name}
          className="rounded border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
        >
          Rename
        </button>
      </form>

      {contest.archivedAt ? (
        <div className="flex items-center justify-between rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
          <span>This contest is archived.</span>
          <button type="button" onClick={() => void run(() => store.restoreContest(contestId))} className="underline">
            Restore
          </button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Rounds</h2>
        {rounds.length === 0 ? <p className="text-sm text-gray-500">No rounds yet. Add the first one below.</p> : null}
        {rounds.map((round) => (
          <RoundSettingsForm key={round.id} round={round} onSave={(settings) => run(() => store.updateRoundSettings(round.id, settings))} />
        ))}

        {addable.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {addable.map((stage: RoundStage) => (
              <button
                key={stage}
                type="button"
                onClick={() => void run(() => store.addRound(contestId, stage))}
                className="rounded border border-gray-300 px-3 py-2 text-sm"
              >
                Add {STAGE_LABELS[stage]}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">The final is the last round.</p>
        )}
      </section>

      {!contest.archivedAt ? (
        <button type="button" onClick={() => void run(() => store.archiveContest(contestId))} className="text-sm text-gray-600 underline">
          Archive this contest
        </button>
      ) : null}
    </div>
  );
}
