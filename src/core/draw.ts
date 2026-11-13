export type FollowerOrder = "ascending" | "descending";
/** Right moves each follower to the next leader in the line. Left moves each follower to the previous leader. */
export type DrawDirection = "left" | "right";

export interface Couple {
  leader: string;
  follower: string;
}

export interface DrawInput {
  leaders: readonly string[];
  followers: readonly string[];
  followerOrder: FollowerOrder;
  direction: DrawDirection;
  /** How many places the followers move along the line. Wraps around. */
  shift: number;
}

const byBib = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

/**
 * Builds the finals couples from the organiser's settings. The app does not randomise. Leaders stand in
 * ascending bib order and followers stand in the chosen order. Then the followers move `shift` places in
 * the chosen direction, and each leader dances with whoever ends up opposite. The result is the starting
 * point. The organiser can edit any pair before scoring starts.
 */
export function buildDraw({ leaders, followers, followerOrder, direction, shift }: DrawInput): Couple[] {
  if (leaders.length !== followers.length) {
    throw new Error(`A final needs the same number of leaders and followers. There are ${leaders.length} leaders and ${followers.length} followers.`);
  }
  if (!Number.isInteger(shift)) throw new RangeError("The shift must be a whole number.");

  const sortedLeaders = [...leaders].sort(byBib);
  const sortedFollowers = [...followers].sort(byBib);
  if (followerOrder === "descending") sortedFollowers.reverse();

  const count = sortedLeaders.length;
  const offset = direction === "right" ? shift : -shift;
  return sortedLeaders.map((leader, index) => ({
    leader,
    follower: sortedFollowers[(((index + offset) % count) + count) % count]
  }));
}

/** Checks edited couples against everyone in the final. Returns what is wrong, in plain words. */
export function validateCouples(couples: readonly Couple[], leaders: readonly string[], followers: readonly string[]): string[] {
  const problems: string[] = [];
  for (const [role, bibs, used] of [
    ["Leader", leaders, couples.map((couple) => couple.leader)],
    ["Follower", followers, couples.map((couple) => couple.follower)]
  ] as const) {
    const seen = new Set<string>();
    for (const bib of used) {
      if (!bibs.includes(bib)) problems.push(`${role} ${bib} is not in this contest.`);
      else if (seen.has(bib)) problems.push(`${role} ${bib} is paired more than once.`);
      seen.add(bib);
    }
    for (const bib of bibs) {
      if (!seen.has(bib)) problems.push(`${role} ${bib} has no partner.`);
    }
  }
  return problems;
}
