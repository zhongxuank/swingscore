import type { Ordinals } from "./ordinals";

export interface Placement {
  entryId: string;
  /** Tied entries share the first place of their range. */
  place: number;
  tied: boolean;
}

export interface UnresolvedTie {
  /** First and last place the tied entries cover, for example [3, 4]. */
  places: [number, number];
  entryIds: string[];
}

export interface RelativePlacementResult {
  placements: Placement[];
  /** Ties the rules cannot break. The organiser decides these. They are never settled by id or bib. */
  unresolved: UnresolvedTie[];
}

/**
 * WSDC Relative Placement, following Tigges, "Unraveling the Mystery of the Relative Placement
 * Scoring System" (updated 12.20.2021).
 *
 * Walk the levels 1st, 1st-2nd, 1st-3rd, ... An entry is placed at the first level where a majority
 * of judges ranked it at that level or better. Entries reaching majority at the same level are
 * ordered by: more judges at that level, then the lower sum of those ordinals, then counts only at
 * each later level, then head to head.
 */
export function relativePlacement(entryIds: string[], sheets: Ordinals[]): RelativePlacementResult {
  validate(entryIds, sheets);

  const total = entryIds.length;
  const majority = Math.floor(sheets.length / 2) + 1;
  const countAt = (id: string, level: number) => sheets.filter((sheet) => sheet[id] <= level).length;
  const sumAt = (id: string, level: number) =>
    sheets.reduce((sum, sheet) => (sheet[id] <= level ? sum + sheet[id] : sum), 0);

  const remaining = new Set(entryIds);
  const placements: Placement[] = [];
  const unresolved: UnresolvedTie[] = [];
  let nextPlace = 1;

  for (let level = 1; level <= total && remaining.size > 0; level += 1) {
    const reached = [...remaining].filter((id) => countAt(id, level) >= majority);
    if (reached.length === 0) continue;

    const orderedGroups = groupBy(
      reached.sort((a, b) => countAt(b, level) - countAt(a, level) || sumAt(a, level) - sumAt(b, level)),
      (id) => `${countAt(id, level)}:${sumAt(id, level)}`
    );

    for (const group of orderedGroups) {
      for (const subgroup of breakTie(group, level)) {
        const tied = subgroup.length > 1;
        for (const entryId of subgroup) {
          placements.push({ entryId, place: nextPlace, tied });
          remaining.delete(entryId);
        }
        if (tied) unresolved.push({ places: [nextPlace, nextPlace + subgroup.length - 1], entryIds: subgroup });
        nextPlace += subgroup.length;
      }
    }
  }

  return { placements, unresolved };

  function breakTie(group: string[], level: number): string[][] {
    let groups: string[][] = [group];
    for (let next = level + 1; next <= total && groups.some((g) => g.length > 1); next += 1) {
      groups = groups.flatMap((g) =>
        g.length === 1 ? [g] : groupBy([...g].sort((a, b) => countAt(b, next) - countAt(a, next)), (id) => String(countAt(id, next)))
      );
    }
    return groups.flatMap((g) => (g.length === 1 ? [g] : headToHead(g)));
  }

  function headToHead(group: string[]): string[][] {
    const beats = (a: string, b: string) => {
      const aWins = sheets.filter((sheet) => sheet[a] < sheet[b]).length;
      const bWins = sheets.length - aWins;
      return aWins > bWins;
    };
    const wins = new Map(group.map((id) => [id, group.filter((other) => other !== id && beats(id, other)).length] as const));
    const ordered = groupBy([...group].sort((a, b) => wins.get(b)! - wins.get(a)!), (id) => String(wins.get(id)));
    return ordered.flatMap((g) => (g.length === 1 || g.length === group.length ? [g] : headToHead(g)));
  }
}

function groupBy(sorted: string[], key: (id: string) => string): string[][] {
  const groups: string[][] = [];
  for (const id of sorted) {
    const last = groups[groups.length - 1];
    if (last && key(last[0]) === key(id)) last.push(id);
    else groups.push([id]);
  }
  return groups;
}

function validate(entryIds: string[], sheets: Ordinals[]): void {
  if (sheets.length === 0) throw new Error("Relative Placement needs at least one judge sheet.");
  for (const sheet of sheets) {
    const seen = new Set<number>();
    for (const id of entryIds) {
      const ordinal = sheet[id];
      if (!Number.isInteger(ordinal) || ordinal < 1 || ordinal > entryIds.length || seen.has(ordinal)) {
        throw new Error(`Judge sheet has a missing or repeated ordinal for ${id}.`);
      }
      seen.add(ordinal);
    }
  }
}
