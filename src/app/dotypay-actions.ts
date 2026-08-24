"use server";

import { roundToCents } from "@/lib/daily-closing";

const DOTYPAY_BASE_URL = "https://portal.dotypay.com";
const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

type TidAmount = { tid: string; amount: number };

export type DotypayTerminalTotals =
  | {
      ok: true;
      terminal1: TidAmount | null;
      terminal2: TidAmount | null;
      unmatched: TidAmount[];
    }
  | { ok: false; error: string };

async function fetchBatchTotalsByTid(dateStr: string): Promise<TidAmount[]> {
  const res = await fetch(
    `${DOTYPAY_BASE_URL}/api/batches?date=${dateStr}`,
    {
      headers: {
        Authorization: `ApiKey ${process.env.DOTYPAY_API_KEY}`,
        Accept: "application/x-ndjson",
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    throw new Error(`Dotypay API vrátilo chybu (${res.status}).`);
  }

  const text = await res.text();
  const totalsByTid = new Map<string, number>();

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let batch: { tid?: unknown; amount?: unknown };
    try {
      batch = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (typeof batch.tid !== "string" || typeof batch.amount !== "number") {
      continue;
    }
    totalsByTid.set(batch.tid, (totalsByTid.get(batch.tid) ?? 0) + batch.amount);
  }

  return Array.from(totalsByTid.entries())
    .map(([tid, amount]) => ({ tid, amount: roundToCents(amount) }))
    .sort((a, b) => a.tid.localeCompare(b.tid));
}

// Maps raw Dotypay terminal IDs to this app's "Terminal 1" / "Terminal 2" fields.
// Set DOTYPAY_TID_TERMINAL_1 / DOTYPAY_TID_TERMINAL_2 once the real TIDs are known;
// until then, terminals are assigned in sorted TID order as a best-effort fallback.
function assignTerminals(batches: TidAmount[]) {
  const remaining = [...batches];
  const tid1 = process.env.DOTYPAY_TID_TERMINAL_1;
  const tid2 = process.env.DOTYPAY_TID_TERMINAL_2;

  function takeByTid(tid: string | undefined) {
    if (!tid) return null;
    const index = remaining.findIndex((b) => b.tid === tid);
    if (index === -1) return null;
    return remaining.splice(index, 1)[0];
  }

  let terminal1 = takeByTid(tid1);
  let terminal2 = takeByTid(tid2);

  if (!terminal1 && remaining.length) terminal1 = remaining.shift() ?? null;
  if (!terminal2 && remaining.length) terminal2 = remaining.shift() ?? null;

  return { terminal1, terminal2, unmatched: remaining };
}

export async function getDotypayTerminalTotals(
  dateStr: string
): Promise<DotypayTerminalTotals> {
  if (!process.env.DOTYPAY_API_KEY) {
    return { ok: false, error: "DOTYPAY_API_KEY nie je nastavený na serveri." };
  }
  if (!dateOnlyPattern.test(dateStr)) {
    return { ok: false, error: "Neplatný dátum." };
  }

  try {
    const batches = await fetchBatchTotalsByTid(dateStr);
    return { ok: true, ...assignTerminals(batches) };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Nepodarilo sa spojiť s Dotypay API.",
    };
  }
}
