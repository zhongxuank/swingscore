/** Only allow redirects to a path on this site, so a crafted sign-in link cannot send the organiser elsewhere. */
export function safeNextPath(next: string | null | undefined, fallback = "/contests"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
