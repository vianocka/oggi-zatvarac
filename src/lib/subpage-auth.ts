import { createHmac, timingSafeEqual } from "node:crypto";

// Password gate for every page except the home page (see src/proxy.ts).
// The password lives only in the SUBPAGES_PASSWORD env var on the server.
export const SUBPAGES_COOKIE = "oz_subpages";
export const SUBPAGES_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// Prefixes that need the password. "/" itself, /login and the Dotykačka
// OAuth routes stay outside the gate.
export const PROTECTED_PREFIXES = ["/admin", "/mesacny-prehlad", "/odhad"];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

// The cookie holds a keyed hash, never the password itself, and stops
// matching as soon as the password is changed.
export function sessionToken(password: string): string {
  return createHmac("sha256", password).update("oz-subpages-session").digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// Only same-site relative paths, so /login?next= can't bounce off-site.
export function safeNextPath(next: string | null | undefined): string {
  if (next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")) {
    return next;
  }
  return "/admin";
}
