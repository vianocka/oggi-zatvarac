import { createHmac } from "node:crypto";

export const DOTYKACKA_CONNECT_URL = "https://admin.dotykacka.cz/client/connect/v2";
export const DOTYKACKA_API_BASE_URL = "https://api.dotykacka.cz/v2";

// Dotykačka's connect/v2 endpoint expects the timestamp signed with the
// client secret as an HMAC-SHA256 hex digest (verified against the live API).
export function signDotykackaTimestamp(clientSecret: string, timestamp: number): string {
  return createHmac("sha256", clientSecret).update(String(timestamp)).digest("hex");
}

export async function getAccessToken(): Promise<string> {
  const res = await fetch(`${DOTYKACKA_API_BASE_URL}/signin/token`, {
    method: "POST",
    headers: {
      Authorization: `User ${process.env.DOTYKACKA_REFRESH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ _cloudId: process.env.DOTYKACKA_CLOUD_ID }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Prihlásenie do Dotykačky zlyhalo (${res.status}).`);
  }

  const data = (await res.json()) as { accessToken?: unknown };
  if (typeof data.accessToken !== "string") {
    throw new Error("Dotykačka nevrátila access token.");
  }
  return data.accessToken;
}
