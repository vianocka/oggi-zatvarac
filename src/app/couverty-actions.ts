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

export type ChoiceTipsDaySummary = {
  date: string;
  amount: number;
};

export type BlockyItemSummary = {
  date: string;
  nazov: string;
  suma: number;
};

export type RangeSummary =
  | {
      ok: true;
      couvert: {
        totalCount: number;
        totalZUctu: number;
        totalCisty: number;
        days: CouvertDaySummary[];
      };
      choiceTips: {
        total: number;
        days: ChoiceTipsDaySummary[];
      };
      blocky: {
        total: number;
        items: BlockyItemSummary[];
      };
    }
  | { ok: false; error: string };

export async function getRangeSummary(
  startDateStr: string,
  endDateStr: string
): Promise<RangeSummary> {
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
    select: {
      date: true,
      couvert: true,
      choiceTips: true,
      blockyItems: {
        select: { nazov: true, suma: true },
        orderBy: { position: "asc" },
      },
    },
    orderBy: { date: "asc" },
  });

  const couvertDays: CouvertDaySummary[] = records
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

  const choiceTipsDays: ChoiceTipsDaySummary[] = records
    .filter((record) => Number(record.choiceTips) !== 0)
    .map((record) => ({
      date: record.date.toISOString().slice(0, 10),
      amount: Number(record.choiceTips),
    }));

  const blockyItems: BlockyItemSummary[] = records.flatMap((record) =>
    record.blockyItems.map((item) => ({
      date: record.date.toISOString().slice(0, 10),
      nazov: item.nazov,
      suma: Number(item.suma),
    }))
  );

  return {
    ok: true,
    couvert: {
      totalCount: couvertDays.reduce((sum, d) => sum + d.count, 0),
      totalZUctu: couvertDays.reduce((sum, d) => sum + d.zUctu, 0),
      totalCisty: couvertDays.reduce((sum, d) => sum + d.cisty, 0),
      days: couvertDays,
    },
    choiceTips: {
      total: choiceTipsDays.reduce((sum, d) => sum + d.amount, 0),
      days: choiceTipsDays,
    },
    blocky: {
      total: blockyItems.reduce((sum, item) => sum + item.suma, 0),
      items: blockyItems,
    },
  };
}
