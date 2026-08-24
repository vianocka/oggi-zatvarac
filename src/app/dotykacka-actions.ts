"use server";

import { DOTYKACKA_API_BASE_URL } from "@/lib/dotykacka-auth";

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

// From Dotykačka's payment-methods enum (docs.api.dotypos.com).
const PAYMENT_TYPE_CHOICE_QR = "901000006";
const PAYMENT_TYPE_WOLT = "901000004";

export type DotykackaDailyTotals =
  | { ok: true; totalSum: number; choiceQr: number; wolt: number; storno: number }
  | { ok: false; error: string };

type PaymentTypeInfoEntry = { typeId?: unknown; total?: unknown };

async function getAccessToken(): Promise<string> {
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

function sumByTypeId(entries: unknown, typeId: string): number {
  if (!Array.isArray(entries)) return 0;
  return (entries as PaymentTypeInfoEntry[])
    .filter((entry) => entry.typeId === typeId)
    .reduce((sum, entry) => sum + (Number(entry.total) || 0), 0);
}

export async function getDotykackaDailyTotals(
  dateStr: string
): Promise<DotykackaDailyTotals> {
  if (!process.env.DOTYKACKA_REFRESH_TOKEN || !process.env.DOTYKACKA_CLOUD_ID) {
    return {
      ok: false,
      error: "DOTYKACKA_REFRESH_TOKEN / DOTYKACKA_CLOUD_ID nie sú nastavené.",
    };
  }
  if (!process.env.DOTYKACKA_BRANCH_ID) {
    return { ok: false, error: "DOTYKACKA_BRANCH_ID nie je nastavený." };
  }
  if (!dateOnlyPattern.test(dateStr)) {
    return { ok: false, error: "Neplatný dátum." };
  }

  try {
    const accessToken = await getAccessToken();

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
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Dotykačka API vrátilo chybu (${res.status}).`);
    }

    const report = (await res.json()) as {
      moneyTransactionInfo?: { saleValue?: unknown; cancelValue?: unknown };
      revenue?: { paymentTypeInfo?: unknown };
    };

    // "Celková suma" = Total with VAT (saleValue) + Storno (cancelValue).
    const totalWithVat = Number(report.moneyTransactionInfo?.saleValue) || 0;
    const storno = Number(report.moneyTransactionInfo?.cancelValue) || 0;
    const paymentTypeInfo = report.revenue?.paymentTypeInfo;

    return {
      ok: true,
      totalSum: totalWithVat + storno,
      choiceQr: sumByTypeId(paymentTypeInfo, PAYMENT_TYPE_CHOICE_QR),
      wolt: sumByTypeId(paymentTypeInfo, PAYMENT_TYPE_WOLT),
      storno,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Nepodarilo sa spojiť s Dotykačka API.",
    };
  }
}
