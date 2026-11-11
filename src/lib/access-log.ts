import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export type AccessEvent = "view" | "login-ok" | "login-fail";

function decode(value: string | null): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// Records who opened which page. IP comes from the proxy headers; the
// approximate location comes from Vercel's geo headers (country/region/city
// of the IP) - absent locally or off Vercel. Never throws: logging must not
// take a page down (e.g. if the table hasn't been migrated yet).
export async function logAccess(event: AccessEvent, path: string): Promise<void> {
  try {
    const h = await headers();
    const ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
    const country = h.get("x-vercel-ip-country");
    const region = decode(h.get("x-vercel-ip-country-region"));
    const city = decode(h.get("x-vercel-ip-city"));
    const userAgent = h.get("user-agent")?.slice(0, 300) ?? null;

    console.log(
      `[access] ${event} ${path} ip=${ip ?? "?"} loc=${[city, region, country].filter(Boolean).join("/") || "?"}`
    );
    await prisma.accessLog.create({
      data: { event, path, ip, country, region, city, userAgent },
    });
  } catch (error) {
    console.error("[access] logging failed", error);
  }
}
