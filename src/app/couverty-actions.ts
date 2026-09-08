"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { couvertCistySuma } from "@/lib/daily-closing";

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Neplatný dátum")
  .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime()), {
    message: "Neplatný dátum",
  });

export type CouvertDaySummary = {
  date: string;
  count: number;
  zUctu: number;
  cisty: number;
};

export type CouvertRangeSummary =
  | {
      ok: true;
      totalCount: number;
      totalZUctu: number;
      totalCisty: number;
      days: CouvertDaySummary[];
    }
  | { ok: false; error: string };

export async function getCouvertRangeSummary(
  startDateStr: string,
  endDateStr: string
): Promise<CouvertRangeSummary> {
  const start = isoDateSchema.safeParse(startDateStr);
  const end = isoDateSchema.safeParse(endDateStr);
  if (!start.success || !end.success) {
    return { ok: false, error: "Neplatný dátum." };
  }
  if (start.data > end.data) {
    return { ok: false, error: "Dátum od musí byť pred dátumom do (alebo rovnaký)." };
  }

  const records = await prisma.dailyClosing.findMany({
    where: {
      date: {
        gte: new Date(`${start.data}T00:00:00.000Z`),
        lte: new Date(`${end.data}T00:00:00.000Z`),
      },
    },
    select: { date: true, couvert: true },
    orderBy: { date: "asc" },
  });

  const days: CouvertDaySummary[] = records
    .filter((record) => record.couvert.length > 0)
    .map((record) => {
      const amounts = record.couvert.map(Number);
      return {
        date: record.date.toISOString().slice(0, 10),
        count: amounts.length,
        zUctu: amounts.reduce((sum, v) => sum + v, 0),
        cisty: amounts.reduce((sum, v) => sum + couvertCistySuma(v), 0),
      };
    });

  const totalCount = days.reduce((sum, d) => sum + d.count, 0);
  const totalZUctu = days.reduce((sum, d) => sum + d.zUctu, 0);
  const totalCisty = days.reduce((sum, d) => sum + d.cisty, 0);

  return { ok: true, totalCount, totalZUctu, totalCisty, days };
}
