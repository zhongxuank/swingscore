import type { DancerRole, NewCompetitor } from "@/data/types";

const ROLE_WORDS: Record<string, DancerRole> = {
  l: "leader",
  lead: "leader",
  leader: "leader",
  leaders: "leader",
  f: "follower",
  follow: "follower",
  follower: "follower",
  followers: "follower"
};

export interface ParsedCompetitors {
  competitors: NewCompetitor[];
  problems: string[];
}

/**
 * Reads one competitor per line: a bib, then a role (L, Lead, Leader, F, Follow, Follower), then an optional name.
 * Spaces, commas or tabs separate them, so a column copied from a spreadsheet works. A line with only a bib, or a
 * bib and a name, takes `defaultRole`; without one it is a problem. Blank lines are skipped.
 */
export function parseCompetitorLines(text: string, defaultRole: DancerRole | null = null): ParsedCompetitors {
  const competitors: NewCompetitor[] = [];
  const problems: string[] = [];

  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (line === "") return;
    const parts = line.split(/[\t,]+|\s+/).map((part) => part.trim()).filter(Boolean);
    const [bib, second, ...rest] = parts;
    const role = second ? ROLE_WORDS[second.toLowerCase()] : undefined;
    const nameParts = role ? rest : second ? [second, ...rest] : [];
    const finalRole = role ?? defaultRole;
    if (!finalRole) {
      problems.push(`Line ${index + 1} ("${line}") needs a role: L or F after the bib.`);
      return;
    }
    competitors.push({ bib, role: finalRole, name: nameParts.join(" ") });
  });

  return { competitors, problems };
}
