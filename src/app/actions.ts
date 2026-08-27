"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { calculateHotovostDoObalky } from "@/lib/daily-closing";

// Generous ceiling for a single day's till amount - guards against overflow,
// typos, or a crafted payload bypassing the UI, without constraining real use.
const MAX_AMOUNT = 1_000_000;
const amountSchema = z.number().finite().min(0).max(MAX_AMOUNT);

const blockyItemSchema = z.object({
  nazov: z.string().trim().min(1, "Zadajte názov položky Blocky").max(200),
  suma: amountSchema,
});

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Neplatný dátum")
  .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime()), {
    message: "Neplatný dátum",
  });

const dailyClosingSchema = z.object({
  date: isoDateSchema,
  totalSum: amountSchema,
  terminal1: amountSchema,
  terminal2: amountSchema,
  choiceQr: amountSchema,
  wolt: amountSchema,
  choiceTips: amountSchema,
  couvert: z.array(amountSchema).max(500),
  blocky: z.array(blockyItemSchema).max(500),
});

export type DailyClosingInput = z.infer<typeof dailyClosingSchema>;

export type DailyClosingState = {
  ok: boolean;
  message: string;
  hotovostDoObalky?: number;
  updatedAt?: string;
};

export async function saveDailyClosing(
  input: DailyClosingInput
): Promise<DailyClosingState> {
  const parsed = dailyClosingSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: "Vo formulári sú neplatné údaje." };
  }

  const data = parsed.data;
  const hotovostDoObalky = calculateHotovostDoObalky(data);
  const date = new Date(`${data.date}T00:00:00.000Z`);

  const blockyItems = data.blocky.map((item, position) => ({
    nazov: item.nazov,
    suma: item.suma,
    position,
  }));

  const scalarFields = {
    date,
    totalSum: data.totalSum,
    terminal1: data.terminal1,
    terminal2: data.terminal2,
    choiceQr: data.choiceQr,
    wolt: data.wolt,
    choiceTips: data.choiceTips,
    couvert: data.couvert,
    hotovostDoObalky,
  };

  const saved = await prisma.dailyClosing.upsert({
    where: { date },
    create: {
      ...scalarFields,
      blockyItems: { create: blockyItems },
    },
    update: {
      ...scalarFields,
      blockyItems: {
        deleteMany: {},
        create: blockyItems,
      },
    },
  });

  return {
    ok: true,
    message: `Uložené pre ${data.date}.`,
    hotovostDoObalky,
    updatedAt: saved.updatedAt.toISOString(),
  };
}

export type DailyClosingRecord = {
  totalSum: number;
  terminal1: number;
  terminal2: number;
  choiceQr: number;
  wolt: number;
  choiceTips: number;
  couvert: number[];
  blocky: { nazov: string; suma: number }[];
  updatedAt: string;
};

export async function getDailyClosing(
  dateStr: string
): Promise<DailyClosingRecord | null> {
  const parsedDate = isoDateSchema.safeParse(dateStr);
  if (!parsedDate.success) return null;

  const record = await prisma.dailyClosing.findUnique({
    where: { date: new Date(`${parsedDate.data}T00:00:00.000Z`) },
    include: { blockyItems: { orderBy: { position: "asc" } } },
  });

  if (!record) return null;

  return {
    totalSum: Number(record.totalSum),
    terminal1: Number(record.terminal1),
    terminal2: Number(record.terminal2),
    choiceQr: Number(record.choiceQr),
    wolt: Number(record.wolt),
    choiceTips: Number(record.choiceTips),
    couvert: record.couvert.map(Number),
    blocky: record.blockyItems.map((item) => ({
      nazov: item.nazov,
      suma: Number(item.suma),
    })),
    updatedAt: record.updatedAt.toISOString(),
  };
}
