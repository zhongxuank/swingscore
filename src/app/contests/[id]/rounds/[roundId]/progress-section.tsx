"use client";

import { useCallback, useEffect, useState } from "react";
import { errorMessage, useContestStore } from "@/components/use-contest-store";
import type { DancerRole, Round, RoundJudge, SheetSubmission } from "@/data/types";

const ROLE_SHORT: Record<DancerRole, string> = { leader: "Leaders", follower: "Followers" };

function sheetsFor(round: Round, judge: RoundJudge): Array<DancerRole | null> {
  if (round.kind === "final") return [null];
  return judge.assignment === "both" ? ["leader", "follower"] : [judge.assignment === "leaders" ? "leader" : "follower"];
}

/** Which judges have submitted, refreshed every 10 seconds. The organiser can reopen a sheet. */
export function ProgressSection({ round, judges }: { round: Round; judges: RoundJudge[] }) {
  const store = useContestStore();
  const [submissions, setSubmissions] = useState<SheetSubmission[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSubmissions(await store.listSubmissions(round.id));
    } catch (problem) {
      setError(errorMessage(problem));
    }
  }, [store, round.id]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 10000);
    return () => clearInterval(timer);
  }, [load]);

  const done = (judgeId: string, role: DancerRole | null) => submissions.some((s) => s.judgeId === judgeId && s.role === role);
  const total = judges.reduce((sum, judge) => sum + sheetsFor(round, judge).length, 0);
  const finished = judges.reduce((sum, judge) => sum + sheetsFor(round, judge).filter((role) => done(judge.id, role)).length, 0);

  async function reopen(judgeId: string, role: DancerRole | null) {
    setError(null);
    try {
      await store.reopenSheet(round.id, judgeId, role);
      await load();
    } catch (problem) {
      setError(errorMessage(problem));
    }
  }

  return (
    <section className="space-y-2" aria-label="Judge progress">
      <h2 className="text-lg font-semibold">
        Judge progress <span className="text-sm font-normal text-gray-500">{finished} of {total} sheets submitted</span>
      </h2>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <ul className="divide-y divide-gray-100 rounded border border-gray-200 text-sm">
        {judges.map((judge) => (
          <li key={judge.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5">
            <span>
              {judge.name}
              {judge.isChief ? <span className="text-gray-500"> (chief judge)</span> : null}
            </span>
            <span className="flex flex-wrap gap-2">
              {sheetsFor(round, judge).map((role) => (
                <span key={role ?? "final"} className="flex items-center gap-1">
                  <span className={`rounded px-1.5 py-0.5 text-xs ${done(judge.id, role) ? "bg-green-100 text-green-900" : "bg-gray-100 text-gray-600"}`}>
                    {role ? ROLE_SHORT[role] : "Final"}: {done(judge.id, role) ? "submitted" : "scoring"}
                  </span>
                  {done(judge.id, role) ? (
                    <button type="button" onClick={() => void reopen(judge.id, role)} className="text-xs text-gray-500 underline">
                      Reopen
                    </button>
                  ) : null}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
