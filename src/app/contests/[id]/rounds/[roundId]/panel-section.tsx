"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { validatePanel, type Panel } from "@/core/panel";
import { errorMessage, useContestStore } from "@/components/use-contest-store";
import type { JudgeAssignment, Round, RoundJudge } from "@/data/types";
import { LinksSection } from "./links-section";

const ASSIGNMENT_LABELS: Record<JudgeAssignment, string> = { leaders: "Leaders", followers: "Followers", both: "Both roles" };

function toPanel(round: Round, judges: RoundJudge[]): Panel {
  const chief = judges.find((judge) => judge.isChief);
  return {
    judges: judges.filter((judge) => !judge.isChief).map(({ id, name, assignment }) => ({ id, name, assignment })),
    chiefJudge: chief ? { name: chief.name } : null,
    chiefJudgeCounts: round.chiefJudgeCounts
  };
}

export function PanelSection({ round, onJudges }: { round: Round; onJudges?: (judges: RoundJudge[]) => void }) {
  const store = useContestStore();
  const [judges, setJudges] = useState<RoundJudge[] | null>(null);
  const [name, setName] = useState("");
  const [assignment, setAssignment] = useState<JudgeAssignment>("leaders");
  const [chiefName, setChiefName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isCallback = round.kind === "callback";

  const load = useCallback(async () => {
    try {
      const list = await store.listJudges(round.id);
      setJudges(list);
      onJudges?.(list);
    } catch (problem) {
      setError(errorMessage(problem));
    }
  }, [store, round.id, onJudges]);

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

  function onAddJudge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => {
      await store.addJudge(round.id, { name, assignment: isCallback ? assignment : "both" });
      setName("");
    });
  }

  function onAddChief(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => {
      await store.addJudge(round.id, { name: chiefName, assignment: "both", isChief: true });
      setChiefName("");
    });
  }

  if (!judges) return <p className="text-sm text-gray-500">{error ?? "Loading panel…"}</p>;

  const chief = judges.find((judge) => judge.isChief);
  const others = judges.filter((judge) => !judge.isChief);
  const problems = validatePanel(round.kind, toPanel(round, judges));

  return (
    <>
    <section className="space-y-3" aria-label="Panel">
      <h2 className="text-lg font-semibold">Panel</h2>

      <div className="rounded border border-gray-200 p-3">
        <h3 className="text-sm font-semibold">Chief judge</h3>
        {chief ? (
          <div className="mt-1 flex items-center justify-between text-sm">
            <span>
              {chief.name} <span className="text-gray-500">· judges both roles</span>
            </span>
            <button type="button" onClick={() => void run(() => store.removeJudge(chief.id))} className="text-xs text-gray-500 underline">
              Remove
            </button>
          </div>
        ) : (
          <form onSubmit={onAddChief} className="mt-2 flex gap-2">
            <label htmlFor="chief-name" className="sr-only">
              Chief judge name
            </label>
            <input
              id="chief-name"
              value={chiefName}
              onChange={(event) => setChiefName(event.target.value)}
              placeholder="Name"
              className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
            />
            <button type="submit" disabled={chiefName.trim() === ""} className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-50">
              Set chief judge
            </button>
          </form>
        )}
      </div>

      <div className="rounded border border-gray-200 p-3">
        <h3 className="text-sm font-semibold">Judges</h3>
        {others.length === 0 ? <p className="mt-1 text-sm text-gray-500">No judges yet.</p> : null}
        <ul className="mt-1 divide-y divide-gray-100 text-sm">
          {others.map((judge) => (
            <li key={judge.id} className="flex items-center justify-between gap-2 py-1.5">
              <span>{judge.name}</span>
              <span className="flex items-center gap-3">
                {isCallback ? (
                  <select
                    aria-label={`Role for ${judge.name}`}
                    value={judge.assignment}
                    onChange={(event) => void run(() => store.updateJudge(judge.id, { assignment: event.target.value as JudgeAssignment }))}
                    className="rounded border border-gray-300 px-2 py-0.5"
                  >
                    {(["leaders", "followers", "both"] as const).map((value) => (
                      <option key={value} value={value}>
                        {ASSIGNMENT_LABELS[value]}
                      </option>
                    ))}
                  </select>
                ) : null}
                <button type="button" onClick={() => void run(() => store.removeJudge(judge.id))} className="text-xs text-gray-500 underline">
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>

        <form onSubmit={onAddJudge} className="mt-2 flex flex-wrap gap-2">
          <label htmlFor="judge-name" className="sr-only">
            Judge name
          </label>
          <input
            id="judge-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Judge name"
            className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
          />
          {isCallback ? (
            <select
              aria-label="New judge's role"
              value={assignment}
              onChange={(event) => setAssignment(event.target.value as JudgeAssignment)}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            >
              {(["leaders", "followers", "both"] as const).map((value) => (
                <option key={value} value={value}>
                  {ASSIGNMENT_LABELS[value]}
                </option>
              ))}
            </select>
          ) : null}
          <button type="submit" disabled={name.trim() === ""} className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-50">
            Add judge
          </button>
        </form>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {problems.length > 0 ? (
        <ul className="list-disc rounded border border-amber-300 bg-amber-50 py-2 pl-8 pr-3 text-sm text-amber-900" aria-label="Panel problems">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-green-700">Panel is complete.</p>
      )}
    </section>
    <LinksSection round={round} judges={judges} />
    </>
  );
}
