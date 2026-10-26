"use server";

import { z } from "zod";
import { DOTYKACKA_API_BASE_URL, getAccessToken } from "@/lib/dotykacka-auth";
import { roundToCents } from "@/lib/daily-closing";
import {
  daysInMonth,
  projectMonth,
  type DayTotal,
  type TurnoverProjection,
} from "@/lib/turnover-projection";

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Neplatný mesiac");

export type TurnoverOverview =
  | {
      ok: true;
      month: string;
      today: string;
      days: DayTotal[];
      total: number;
      // Only for the month still in progress.
      projection: TurnoverProjection | null;
    }
  | { ok: false; error: string };

// "Today" in the restaurant's timezone, as YYYY-MM-DD.
function todayInBratislava(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Bratislava" }).format(
    new Date()
  );
}

async function fetchDayTotal(accessToken: string, dateStr: string): Promise<number> {
  const dateFrom = new Date(`${dateStr}T00:00:00.000Z`);
  const dateTo = new Date(dateFrom.getTime() + 24 * 60 * 60 * 1000);
  const url = new URL(
    `${DOTYKACKA_API_BASE_URL}/clouds/${process.env.DOTYKACKA_CLOUD_ID}/branches/${process.env.DOTYKACKA_BRANCH_ID}/sales-report`
  );
  url.searchParams.set("dateFrom", dateFrom.toISOString());
  url.searchParams.set("dateTo", dateTo.toISOString());
  url.searchParams.set("lang", "sk");

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    // Finished days never change; only today needs a fresh read.
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Dotykačka API vrátilo chybu (${res.status}).`);

  const report = (await res.json()) as {
    moneyTransactionInfo?: { saleValue?: unknown; cancelValue?: unknown };
  };
  // Same definition as the daily closing: sales with VAT + storno.
  return roundToCents(
    (Number(report.moneyTransactionInfo?.saleValue) || 0) +
      (Number(report.moneyTransactionInfo?.cancelValue) || 0)
  );
}

export async function getTurnoverOverview(monthStr: string): Promise<TurnoverOverview> {
  const parsed = monthSchema.safeParse(monthStr);
  if (!parsed.success) return { ok: false, error: "Neplatný mesiac." };
  const month = parsed.data;

  if (
    !process.env.DOTYKACKA_REFRESH_TOKEN ||
    !process.env.DOTYKACKA_CLOUD_ID ||
    !process.env.DOTYKACKA_BRANCH_ID
  ) {
    return { ok: false, error: "Dotykačka nie je nastavená (chýbajú env premenné)." };
  }

  const today = todayInBratislava();
  if (month > today.slice(0, 7)) return { ok: false, error: "Mesiac je v budúcnosti." };

  try {
    const accessToken = await getAccessToken();
    const dates = daysInMonth(month).filter((d) => d <= today);

    // Small batches: ~30 report requests per month, keep API load polite.
    const days: DayTotal[] = [];
    const BATCH = 8;
    for (let i = 0; i < dates.length; i += BATCH) {
      const chunk = dates.slice(i, i + BATCH);
      const totals = await Promise.all(chunk.map((d) => fetchDayTotal(accessToken, d)));
      chunk.forEach((date, j) => days.push({ date, total: totals[j] }));
    }

    const isCurrent = month === today.slice(0, 7);
    return {
      ok: true,
      month,
      today,
      days,
      total: roundToCents(days.reduce((s, d) => s + d.total, 0)),
      projection: isCurrent ? projectMonth(month, days, today) : null,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Nepodarilo sa spojiť s Dotykačka API.",
    };
  }
}
