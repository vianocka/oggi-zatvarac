import { createHmac } from "node:crypto";

export const DOTYKACKA_CONNECT_URL = "https://admin.dotykacka.cz/client/connect/v2";
export const DOTYKACKA_API_BASE_URL = "https://api.dotykacka.cz/v2";

// Dotykačka's connect/v2 endpoint expects the timestamp signed with the
// client secret as an HMAC-SHA256 hex digest (verified against the live API).
export function signDotykackaTimestamp(clientSecret: string, timestamp: number): string {
  return createHmac("sha256", clientSecret).update(String(timestamp)).digest("hex");
}
