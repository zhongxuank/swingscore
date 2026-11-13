import type { RoundKind } from "./round-rules";

export type JudgeAssignment = "leaders" | "followers" | "both";
export type PanelRole = "leaders" | "followers";

export interface PanelJudge {
  id: string;
  name: string;
  /** Callback rounds: which role the judge scores. Ignored in a final, where every judge scores couples. */
  assignment: JudgeAssignment;
}

export interface Panel {
  judges: PanelJudge[];
  chiefJudge: { name: string } | null;
  /** Whether the chief judge's score counts as part of the panel. Off by default. */
  chiefJudgeCounts: boolean;
}

/** Judges whose scores count for one role in a callback round. A chief judge who counts is in both roles. */
export function countedJudges(panel: Panel, role: PanelRole): Array<{ id: string; name: string }> {
  const scoring = panel.judges.filter((judge) => judge.assignment === role || judge.assignment === "both");
  const chief = panel.chiefJudge && panel.chiefJudgeCounts ? [{ id: "chief", name: panel.chiefJudge.name }] : [];
  return [...scoring, ...chief].map(({ id, name }) => ({ id, name }));
}

/** Returns what is wrong with a round's panel, in plain words. An empty list means the panel can be confirmed. */
export function validatePanel(kind: RoundKind, panel: Panel): string[] {
  const problems: string[] = [];
  if (panel.judges.some((judge) => judge.name.trim() === "") || (panel.chiefJudge && panel.chiefJudge.name.trim() === "")) {
    problems.push("Every judge needs a name.");
  }

  if (kind === "callback") {
    if (!panel.chiefJudge) problems.push("Add a chief judge.");
    for (const role of ["leaders", "followers"] as const) {
      if (!panel.judges.some((judge) => judge.assignment === role || judge.assignment === "both")) {
        problems.push(`Add at least one judge for ${role}.`);
      }
    }
    return problems;
  }

  const counted = panel.judges.length + (panel.chiefJudge && panel.chiefJudgeCounts ? 1 : 0);
  if (counted < 3) problems.push(`A final needs at least 3 counted judges. It has ${counted}.`);
  else if (counted % 2 === 0) problems.push(`The counted panel must be an odd number of judges. It has ${counted}.`);
  return problems;
}
