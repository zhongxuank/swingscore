import { demoCompetitions, demoRounds } from "@/lib/data/demo-data";
import type { Competition, Judge, RoundConfig } from "@/lib/types";

export const localContestStorageKey = "swingscore.demo.contests";
export const localRoundStorageKey = "swingscore.demo.rounds";
export const localRoundJudgeStorageKey = "swingscore.demo.roundJudges";

export function readLocalContests(): Competition[] {
  return mergeById(demoCompetitions, readStorage<Competition[]>(localContestStorageKey));
}

export function writeLocalContests(contests: Competition[]) {
  writeStorage(localContestStorageKey, contests);
}

export function readLocalRounds(): RoundConfig[] {
  return mergeById(demoRounds, readStorage<RoundConfig[]>(localRoundStorageKey));
}

export function writeLocalRounds(rounds: RoundConfig[]) {
  writeStorage(localRoundStorageKey, rounds);
}

export function readLocalRoundJudges(): Record<string, Judge[]> {
  return readStorage<Record<string, Judge[]>>(localRoundJudgeStorageKey) ?? {};
}

export function writeLocalRoundJudges(roundJudges: Record<string, Judge[]>) {
  writeStorage(localRoundJudgeStorageKey, roundJudges);
}

export function createContestShell(contestId: string): Competition {
  return {
    id: contestId,
    name: titleFromId(contestId),
    division: "Draft",
    kind: "contest",
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function readStorage<T>(key: string): T | null {
  if (typeof window === "undefined") return null;

  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function mergeById<T extends { id: string }>(defaults: T[], stored: T[] | null): T[] {
  if (!stored) return defaults;
  const records = new Map(defaults.map((item) => [item.id, item]));
  for (const item of stored) {
    if (item?.id) records.set(item.id, item);
  }
  return Array.from(records.values());
}

function titleFromId(contestId: string) {
  return contestId
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ") || "New Contest";
}
