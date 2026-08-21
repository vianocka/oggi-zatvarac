import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { DOTYKACKA_CONNECT_URL, signDotykackaTimestamp } from "@/lib/dotykacka-auth";

const STATE_COOKIE = "dotykacka_oauth_state";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}

export async function GET(request: NextRequest) {
  const clientId = process.env.DOTYKACKA_CLIENT_ID;
  const clientSecret = process.env.DOTYKACKA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new Response(
      "DOTYKACKA_CLIENT_ID / DOTYKACKA_CLIENT_SECRET nie sú nastavené v .env.",
      { status: 500 }
    );
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signDotykackaTimestamp(clientSecret, timestamp);
  const state = randomBytes(16).toString("hex");

  // request.url can reflect the server's bind address (e.g. 0.0.0.0) rather
  // than the Host the browser actually used, so derive the origin from headers.
  const host = request.headers.get("host") ?? request.nextUrl.host;
  const protocol =
    request.headers.get("x-forwarded-proto") ??
    (host.match(/^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|$)/) ? "http" : "https");
  const redirectUri = `${protocol}://${host}/api/dotykacka/callback`;

  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  const fields: Record<string, string> = {
    client_id: clientId,
    timestamp: String(timestamp),
    signature,
    scope: "*",
    redirect_uri: redirectUri,
    state,
  };

  const inputs = Object.entries(fields)
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" />`
    )
    .join("\n      ");

  const html = `<!doctype html>
<html lang="sk">
  <head>
    <meta charset="utf-8" />
    <title>Pripojiť Dotykačku</title>
  </head>
  <body style="font-family: sans-serif; display: flex; min-height: 100vh; align-items: center; justify-content: center;">
    <form method="POST" action="${DOTYKACKA_CONNECT_URL}">
      ${inputs}
      <p>Kliknutím sa prihlásite do Dotykačky a povolíte prístup tejto aplikácii.</p>
      <button type="submit">Pripojiť Dotykačku</button>
    </form>
  </body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
