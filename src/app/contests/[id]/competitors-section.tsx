"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { errorMessage, useContestStore } from "@/components/use-contest-store";
import type { Competitor, DancerRole } from "@/data/types";
import { parseCompetitorLines } from "@/lib/parse-competitors";

const ROLE_LABEL: Record<DancerRole, string> = { leader: "Leader", follower: "Follower" };

export function CompetitorsSection({ contestId }: { contestId: string }) {
  const store = useContestStore();
  const [competitors, setCompetitors] = useState<Competitor[] | null>(null);
  const [text, setText] = useState("");
  const [defaultRole, setDefaultRole] = useState<DancerRole | "">("");
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setCompetitors(await store.listCompetitors(contestId));
    } catch (problem) {
      setProblems([errorMessage(problem)]);
    }
  }, [store, contestId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseCompetitorLines(text, defaultRole || null);
    if (parsed.problems.length > 0) {
      setProblems(parsed.problems);
      return;
    }
    setBusy(true);
    setProblems([]);
    try {
      await store.addCompetitors(contestId, parsed.competitors);
      setText("");
      await load();
    } catch (problem) {
      setProblems([errorMessage(problem)]);
    }
    setBusy(false);
  }

  async function onRemove(competitor: Competitor) {
    setProblems([]);
    try {
      await store.removeCompetitor(competitor.id);
      await load();
    } catch (problem) {
      setProblems([errorMessage(problem)]);
    }
  }

  const leaders = competitors?.filter((c) => c.role === "leader") ?? [];
  const followers = competitors?.filter((c) => c.role === "follower") ?? [];

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">
        Competitors{" "}
        {competitors ? (
          <span className="text-sm font-normal text-gray-500">
            {leaders.length} leaders, {followers.length} followers
          </span>
        ) : null}
      </h2>

      <form onSubmit={onAdd} className="space-y-2">
        <label htmlFor="competitor-lines" className="block text-sm font-medium">
          Add competitors, one per line: bib, L or F, then name (optional)
        </label>
        <textarea
          id="competitor-lines"
          rows={4}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={"101 L Ann Lee\n201 F Bo Tan"}
          className="w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm"
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            Lines without L or F are
            <select
              value={defaultRole}
              onChange={(event) => setDefaultRole(event.target.value as DancerRole | "")}
              className="rounded border border-gray-300 px-2 py-1"
            >
              <option value="">not allowed</option>
              <option value="leader">leaders</option>
              <option value="follower">followers</option>
            </select>
          </label>
          <button type="submit" disabled={busy || text.trim() === ""} className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60">
            {busy ? "Adding…" : "Add competitors"}
          </button>
        </div>
      </form>

      {problems.length > 0 ? (
        <ul role="alert" className="list-disc pl-5 text-sm text-red-700">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}

      {competitors && competitors.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {([
            ["Leaders", leaders],
            ["Followers", followers]
          ] as const).map(([title, list]) => (
            <div key={title}>
              <h3 className="mb-1 text-sm font-semibold">{title}</h3>
              <ul className="divide-y divide-gray-100 rounded border border-gray-200 text-sm" aria-label={title}>
                {list.map((competitor) => (
                  <li key={competitor.id} className="flex items-center justify-between px-3 py-1.5">
                    <span>
                      <span className="font-mono font-semibold">{competitor.bib}</span>{" "}
                      <span className="text-gray-600">{competitor.name}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => void onRemove(competitor)}
                      aria-label={`Remove ${ROLE_LABEL[competitor.role].toLowerCase()} ${competitor.bib}`}
                      className="text-xs text-gray-500 underline"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
