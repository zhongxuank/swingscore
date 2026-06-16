"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, ArchiveRestore, ArrowRight, Pencil, Plus, Save } from "lucide-react";
import type { Competition, RoundConfig } from "@/lib/types";
import { demoCompetitions, demoRounds } from "@/lib/data/demo-data";
import { readLocalContests, readLocalRounds, writeLocalContests } from "@/lib/data/local-contest-store";
import { AppFrame, NavButton, Panel } from "@/components/workspaces/shared";

type ContestForm = {
  id?: string;
  name: string;
  division: string;
};

const blankForm: ContestForm = {
  name: "",
  division: ""
};

export function ContestManager() {
  const [contests, setContests] = useState<Competition[]>(demoCompetitions);
  const [rounds, setRounds] = useState<RoundConfig[]>(demoRounds);
  const [form, setForm] = useState<ContestForm>(blankForm);

  const activeContests = useMemo(() => contests.filter((contest) => !contest.archivedAt), [contests]);
  const archivedContests = useMemo(() => contests.filter((contest) => contest.archivedAt), [contests]);
  const editing = Boolean(form.id);

  useEffect(() => {
    setContests(readLocalContests());
    setRounds(readLocalRounds());
  }, []);

  function commitContests(nextContests: Competition[]) {
    setContests(nextContests);
    writeLocalContests(nextContests);
  }

  function saveContest(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const formData = event?.currentTarget ? new FormData(event.currentTarget) : null;
    const trimmedName = String(formData?.get("name") ?? form.name).trim();
    const trimmedDivision = String(formData?.get("division") ?? form.division).trim();
    if (!trimmedName || !trimmedDivision) return;

    if (form.id) {
      commitContests(
        contests.map((contest) =>
          contest.id === form.id
            ? {
                ...contest,
                name: trimmedName,
                division: trimmedDivision,
                updatedAt: new Date().toISOString()
              }
            : contest
        )
      );
    } else {
      commitContests([
        {
          id: uniqueContestId(trimmedName, contests),
          name: trimmedName,
          division: trimmedDivision,
          kind: "contest",
          status: "draft",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        ...contests
      ]);
    }

    setForm(blankForm);
  }

  function archiveContest(contestId: string) {
    commitContests(
      contests.map((contest) =>
        contest.id === contestId
          ? {
              ...contest,
              archivedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          : contest
      )
    );
    if (form.id === contestId) setForm(blankForm);
  }

  function restoreContest(contestId: string) {
    commitContests(
      contests.map((contest) =>
        contest.id === contestId
          ? {
              ...contest,
              archivedAt: undefined,
              updatedAt: new Date().toISOString()
            }
          : contest
      )
    );
  }

  return (
    <AppFrame
      eyebrow="Admin / Contest Manager"
      title="Contests"
      subtitle="Create contest containers, open round setup, and keep past contests archived."
      actions={<NavButton href="/admin/competitions/demo-novice-jj" tone="dark">Open demo contest</NavButton>}
    >
      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Panel title={editing ? "Edit contest" : "Create contest"}>
          <form className="grid gap-3" onSubmit={saveContest}>
            <label className="grid gap-1">
              <span className="font-mono text-xs uppercase tracking-[0.18em] text-graphite/55">Contest name</span>
              <input
                data-testid="contest-name-input"
                name="name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Novice Jack and Jill"
                className="rounded-[6px] border border-graphite/15 bg-paper px-3 py-3 font-bold text-graphite"
              />
            </label>
            <label className="grid gap-1">
              <span className="font-mono text-xs uppercase tracking-[0.18em] text-graphite/55">Division</span>
              <input
                data-testid="contest-division-input"
                name="division"
                value={form.division}
                onChange={(event) => setForm((current) => ({ ...current, division: event.target.value }))}
                placeholder="Novice"
                className="rounded-[6px] border border-graphite/15 bg-paper px-3 py-3 font-bold text-graphite"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="submit"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[6px] bg-graphite px-3 py-2 text-sm font-black text-paper hover:bg-ink"
              >
                {editing ? <Save size={16} /> : <Plus size={16} />}
                {editing ? "Save" : "Create"}
              </button>
              <button
                type="button"
                onClick={() => setForm(blankForm)}
                className="min-h-11 rounded-[6px] border border-graphite/15 bg-paper px-3 py-2 text-sm font-black text-graphite hover:bg-bluepaper"
              >
                Clear
              </button>
            </div>
          </form>
        </Panel>

        <div className="grid gap-4">
          <ContestList
            title="Active contests"
            contests={activeContests}
            rounds={rounds}
            onEdit={(contest) => setForm({ id: contest.id, name: contest.name, division: contest.division })}
            onArchive={archiveContest}
          />
          <ContestList
            title="Archived contests"
            contests={archivedContests}
            rounds={rounds}
            archived
            onRestore={restoreContest}
          />
        </div>
      </div>
    </AppFrame>
  );
}

function ContestList({
  title,
  contests,
  rounds,
  archived = false,
  onEdit,
  onArchive,
  onRestore
}: {
  title: string;
  contests: Competition[];
  rounds: RoundConfig[];
  archived?: boolean;
  onEdit?: (contest: Competition) => void;
  onArchive?: (contestId: string) => void;
  onRestore?: (contestId: string) => void;
}) {
  return (
    <Panel title={`${title} (${contests.length})`}>
      {contests.length === 0 ? (
        <div className="rounded-[8px] border border-dashed border-graphite/20 bg-paper p-5 text-sm font-bold text-graphite/70">
          No contests in this list.
        </div>
      ) : (
        <div className="grid gap-3">
          {contests.map((contest) => (
            <article
              key={contest.id}
              data-testid={`contest-card-${contest.id}`}
              className="grid gap-3 rounded-[8px] border border-graphite/15 bg-paper p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-black text-ink">{contest.name}</h2>
                  <StatusBadge status={contest.status} />
                </div>
                <div className="mt-3 grid gap-2 text-sm font-bold text-graphite/70 sm:grid-cols-3">
                  <span>{contest.division}</span>
                  <span>{roundCount(contest.id, rounds)} rounds</span>
                  <span>Updated {formatShortDate(contest.updatedAt ?? contest.createdAt)}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {archived ? (
                  <button
                    type="button"
                    data-testid={`contest-restore-${contest.id}`}
                    onClick={() => onRestore?.(contest.id)}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[6px] border border-graphite/15 bg-chalk px-3 text-sm font-black hover:bg-bluepaper"
                  >
                    <ArchiveRestore size={16} />
                    Restore
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      data-testid={`contest-edit-${contest.id}`}
                      onClick={() => onEdit?.(contest)}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[6px] border border-graphite/15 bg-chalk px-3 text-sm font-black hover:bg-bluepaper"
                    >
                      <Pencil size={16} />
                      Edit
                    </button>
                    <button
                      type="button"
                      data-testid={`contest-archive-${contest.id}`}
                      onClick={() => onArchive?.(contest.id)}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[6px] border border-graphite/15 bg-chalk px-3 text-sm font-black hover:bg-bluepaper"
                    >
                      <Archive size={16} />
                      Archive
                    </button>
                    <NavButton href={`/admin/competitions/${contest.id}`} testId={`contest-open-${contest.id}`}>
                      Open
                      <ArrowRight size={16} className="ml-2" />
                    </NavButton>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </Panel>
  );
}

function StatusBadge({ status }: { status: Competition["status"] }) {
  return (
    <span className="rounded-full bg-bluepaper px-3 py-1 font-mono text-xs font-black uppercase text-graphite">
      {status}
    </span>
  );
}

function roundCount(contestId: string, rounds: RoundConfig[]) {
  return rounds.filter((round) => round.competitionId === contestId).length;
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function uniqueContestId(name: string, contests: Competition[]) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42) || "contest";
  const existingIds = new Set(contests.map((contest) => contest.id));
  let candidate = base;
  let index = 2;
  while (existingIds.has(candidate)) {
    candidate = `${base}-${index}`;
    index += 1;
  }
  return candidate;
}
