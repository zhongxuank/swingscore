import { StoreError } from "./store";
import type { Round, RoundSettings } from "./types";

/** Checks a settings change against a round. Shared by every store so they reject the same things. Throws StoreError. */
export function checkRoundSettings(round: Pick<Round, "kind">, settings: RoundSettings): void {
  const callbackOnly = settings.yesCount !== undefined || settings.altCount !== undefined || settings.maxPerHeat !== undefined;
  if (round.kind === "final" && callbackOnly) {
    throw new StoreError("invalid", "Yes counts, alternate counts and heat sizes apply to callback rounds only.");
  }
  for (const [field, value] of Object.entries({ yesCount: settings.yesCount, altCount: settings.altCount })) {
    if (value !== undefined && value !== null && (!Number.isInteger(value) || value < 0)) {
      throw new StoreError("invalid", `${field} must be a whole number, zero or more.`);
    }
  }
  if (settings.maxPerHeat !== undefined && settings.maxPerHeat !== null && (!Number.isInteger(settings.maxPerHeat) || settings.maxPerHeat < 1)) {
    throw new StoreError("invalid", "maxPerHeat must be a whole number, one or more.");
  }
}

/** Trims a contest name and rejects a blank one. */
export function cleanContestName(name: string): string {
  const trimmed = name.trim();
  if (trimmed === "") throw new StoreError("invalid", "A contest needs a name.");
  return trimmed;
}
