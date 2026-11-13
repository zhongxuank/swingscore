"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { errorMessage, useContestStore } from "@/components/use-contest-store";
import type { Contest } from "@/data/types";

export function ContestList() {
  const store = useContestStore();
  const router = useRouter();
  const [contests, setContests] = useState<Contest[] | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setContests(await store.listContests({ includeArchived: showArchived }));
    } catch (problem) {
      setError(errorMessage(problem));
    }
  }, [store, showArchived]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const contest = await store.createContest(name);
      router.push(`/contests/${contest.id}`);
    } catch (problem) {
      setError(errorMessage(problem));
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-6">
      <form onSubmit={onCreate} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="new-contest" className="sr-only">
          New contest name
        </label>
        <input
          id="new-contest"
          placeholder="New contest, e.g. Novice Jack & Jill"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="flex-1 rounded border border-gray-300 px-3 py-2"
        />
        <button type="submit" disabled={busy || name.trim() === ""} className="rounded bg-gray-900 px-4 py-2 font-medium text-white disabled:opacity-60">
          Create contest
        </button>
      </form>

      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
        Show archived contests
      </label>

      {contests === null ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : contests.length === 0 ? (
        <p className="text-sm text-gray-500">No contests yet.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded border border-gray-200">
          {contests.map((contest) => (
            <li key={contest.id}>
              <Link href={`/contests/${contest.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                <span className="font-medium">{contest.name}</span>
                {contest.archivedAt ? <span className="text-xs text-gray-500">Archived</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
