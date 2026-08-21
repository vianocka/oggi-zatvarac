import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const STATE_COOKIE = "dotykacka_oauth_state";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}

function page(title: string, body: string) {
  return new Response(
    `<!doctype html>
<html lang="sk">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="font-family: sans-serif; max-width: 640px; margin: 40px auto; padding: 0 16px;">
    ${body}
  </body>
</html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const state = params.get("state");
  const token = params.get("token");
  const cloudId = params.get("cloudid") ?? params.get("cloudId");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (!state || !expectedState || state !== expectedState) {
    return page(
      "Dotykačka - chyba",
      `<h1>Overenie zlyhalo</h1>
      <p>Parameter "state" sa nezhoduje alebo vypršal. Skúste znova otvoriť
      <a href="/api/dotykacka/connect">/api/dotykacka/connect</a>.</p>`
    );
  }

  if (!token || !cloudId) {
    return page(
      "Dotykačka - chyba",
      `<h1>Chýbajú údaje</h1>
      <p>Dotykačka nevrátila očakávané parametre. Prijaté query parametre:</p>
      <pre>${escapeHtml(JSON.stringify(Object.fromEntries(params), null, 2))}</pre>`
    );
  }

  return page(
    "Dotykačka pripojená",
    `<h1>Dotykačka je pripojená</h1>
    <p>Skopírujte tieto hodnoty do <code>.env</code> (lokálne) a neskôr aj do
    premenných prostredia vo Vercel projekte:</p>
    <pre style="background:#f4f4f4;padding:12px;border-radius:6px;white-space:pre-wrap;word-break:break-all;">DOTYKACKA_REFRESH_TOKEN=${escapeHtml(token)}
DOTYKACKA_CLOUD_ID=${escapeHtml(cloudId)}</pre>
    <p>Tento token sa nikde automaticky neukladá – po skopírovaní môžete túto stránku zavrieť.</p>`
  );
}
