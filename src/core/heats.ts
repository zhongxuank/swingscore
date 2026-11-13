export interface HeatSlot {
  bib: string;
  /** A dancer brought back from an earlier heat to fill the floor. Redancers are not judged. */
  redancer: boolean;
}

export interface Heat {
  /** 1-based. */
  number: number;
  leaders: HeatSlot[];
  followers: HeatSlot[];
}

export interface HeatInput {
  leaders: readonly string[];
  followers: readonly string[];
  /** Dancers per role on the floor at once, for example 20 for 20 couples. */
  maxPerHeat: number;
}

const byBib = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

/**
 * Splits sign-ups into heats in bib order, max per heat per role. The number of heats follows the larger
 * role. Where a role runs short in a heat it is topped up with redancers from its earlier dancers,
 * chosen by fewest redances so far, then bib order, so nobody redances twice before everyone else has redanced once. A role with fewer dancers than
 * a heat holds is not topped up.
 */
export function buildHeats({ leaders, followers, maxPerHeat }: HeatInput): Heat[] {
  if (!Number.isInteger(maxPerHeat) || maxPerHeat < 1) {
    throw new RangeError("maxPerHeat must be a whole number, one or more.");
  }
  const heatCount = Math.ceil(Math.max(leaders.length, followers.length) / maxPerHeat);
  const leaderSlots = fillRole([...leaders].sort(byBib), maxPerHeat, heatCount);
  const followerSlots = fillRole([...followers].sort(byBib), maxPerHeat, heatCount);

  return Array.from({ length: heatCount }, (_, index) => ({
    number: index + 1,
    leaders: leaderSlots[index],
    followers: followerSlots[index]
  }));
}

function fillRole(sorted: string[], maxPerHeat: number, heatCount: number): HeatSlot[][] {
  const redances = new Map<string, number>(sorted.map((bib) => [bib, 0]));
  return Array.from({ length: heatCount }, (_, heat) => {
    const fresh = sorted.slice(heat * maxPerHeat, (heat + 1) * maxPerHeat);
    const slots: HeatSlot[] = fresh.map((bib) => ({ bib, redancer: false }));
    const needed = maxPerHeat - fresh.length;
    if (needed === 0 || sorted.length < maxPerHeat) return slots;

    const freshSet = new Set(fresh);
    const chosen = sorted
      .filter((bib) => !freshSet.has(bib))
      .sort((a, b) => redances.get(a)! - redances.get(b)! || byBib(a, b))
      .slice(0, needed);
    for (const bib of chosen) {
      redances.set(bib, redances.get(bib)! + 1);
      slots.push({ bib, redancer: true });
    }
    return slots;
  });
}
