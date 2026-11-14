/** A new private-link token: 32 random bytes, URL-safe base64 (43 characters). */
export function newAccessToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** SHA-256 of the token as lowercase hex. The database stores only this, and hashes the same way to look a link up. */
export async function hashAccessToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export type AccessKind = "judge" | "emcee";

/** The address a private link opens. */
export function accessLinkPath(token: string): string {
  return `/l/${token}`;
}
