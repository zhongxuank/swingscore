import { deriveMarks, type MarkStatus } from "@/core/callback";
import { MAX_SCORE } from "@/core/score";
import type { AccessView } from "@/data/access";
import type { DancerRole } from "@/data/types";

/** Where a tap at `x` pixels on a row `width` pixels wide lands, in whole tenths (0 to 1000). */
export function tapToTenths(x: number, width: number): number {
  if (width <= 0) return 0;
  const fraction = Math.min(Math.max(x / width, 0), 1);
  return Math.round(fraction * MAX_SCORE);
}

export interface SheetRow {
  competitorId: string;
  bib: string;
  heatNumber: number;
  /** Shown in this heat to fill the floor. Scored in their own heat, not here. */
  redancer: boolean;
}

export interface RoleSheet {
  role: DancerRole;
  heats: Array<{ number: number; rows: SheetRow[] }>;
  /** Every dancer to score once, in bib order, with their own heat. */
  dancers: SheetRow[];
}

const byBib = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

/** Builds the sheet for one role from what the link loaded. */
export function buildRoleSheet(view: AccessView, role: DancerRole): RoleSheet {
  const bibs = new Map(view.competitors.map((c) => [c.id, c.bib]));
  const slots = view.heats
    .filter((slot) => slot.role === role && bibs.has(slot.competitorId))
    .sort((a, b) => a.heatNumber - b.heatNumber || a.slot - b.slot);
  const heatNumbers = [...new Set(slots.map((slot) => slot.heatNumber))];
  const heats = heatNumbers.map((number) => ({
    number,
    rows: slots
      .filter((slot) => slot.heatNumber === number)
      .map((slot) => ({ competitorId: slot.competitorId, bib: bibs.get(slot.competitorId)!, heatNumber: number, redancer: slot.redancer }))
  }));
  const dancers = heats
    .flatMap((heat) => heat.rows)
    .filter((row) => !row.redancer)
    .sort((a, b) => byBib(a.bib, b.bib));
  return { role, heats, dancers };
}

export interface SheetMarks {
  status: Map<string, MarkStatus>;
  /** Bibs with equal scores across a Yes, Alternate or No boundary. */
  boundaryTies: string[][];
  /** Bibs with any equal scores. Only matters on the chief judge's sheet. */
  equalScores: string[][];
}

/** Colours and ties for the current scores, using the Yes and Alternate counts the chief judge set. */
export function sheetMarks(sheet: RoleSheet, scores: Map<string, number>, yesCount: number | null, altCount: number | null): SheetMarks {
  const scored = Object.fromEntries(sheet.dancers.filter((d) => scores.has(d.competitorId)).map((d) => [d.competitorId, scores.get(d.competitorId)!]));
  const bibOf = new Map(sheet.dancers.map((d) => [d.competitorId, d.bib]));
  const groups = new Map<number, string[]>();
  for (const [id, tenths] of Object.entries(scored)) groups.set(tenths, [...(groups.get(tenths) ?? []), bibOf.get(id)!]);
  const equalScores = [...groups.values()].filter((group) => group.length > 1).map((group) => group.sort(byBib));

  if (yesCount === null || altCount === null) return { status: new Map(), boundaryTies: [], equalScores };
  const { marks, ties } = deriveMarks(scored, yesCount, altCount);
  return {
    status: new Map(marks.map((mark) => [mark.entryId, mark.status])),
    boundaryTies: ties.map((tie) => tie.entryIds.map((id) => bibOf.get(id)!).sort(byBib)),
    equalScores
  };
}

/** Why the sheet cannot be submitted yet. Empty when it can. */
export function submitProblems(sheet: RoleSheet, scores: Map<string, number>, marks: SheetMarks, isChief: boolean): string[] {
  const problems: string[] = [];
  if (sheet.dancers.length === 0) problems.push("There are no dancers to score yet.");
  const missing = sheet.dancers.filter((d) => !scores.has(d.competitorId)).length;
  if (missing > 0) problems.push(`${missing} ${missing === 1 ? "dancer still needs" : "dancers still need"} a score.`);
  if (isChief) {
    for (const group of marks.equalScores) problems.push(`Chief judge scores cannot tie: ${group.join(", ")}.`);
  } else {
    for (const group of marks.boundaryTies) problems.push(`Equal scores across a callback boundary: ${group.join(", ")}.`);
  }
  return problems;
}
