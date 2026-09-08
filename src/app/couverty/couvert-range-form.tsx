"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  getCouvertRangeSummary,
  type CouvertRangeSummary,
} from "../couverty-actions";

function todayIso() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function firstOfMonthIso() {
  return `${todayIso().slice(0, 7)}-01`;
}

function formatEur(value: number) {
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("sk-SK", { dateStyle: "medium" }).format(
    new Date(`${iso}T00:00:00.000Z`)
  );
}

export function CouvertRangeForm() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [startDate, setStartDate] = useState(
    () => searchParams.get("od") ?? firstOfMonthIso()
  );
  const [endDate, setEndDate] = useState(() => searchParams.get("do") ?? todayIso());
  const [result, setResult] = useState<CouvertRangeSummary | null>(null);
  const [isLoading, startLoading] = useTransition();

  // Keep the range in the URL so a refresh (or shared link) preserves it.
  useEffect(() => {
    if (searchParams.get("od") === startDate && searchParams.get("do") === endDate) {
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set("od", startDate);
    params.set("do", endDate);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [startDate, endDate, pathname, router, searchParams]);

  useEffect(() => {
    let cancelled = false;
    startLoading(async () => {
      const summary = await getCouvertRangeSummary(startDate, endDate);
      if (!cancelled) setResult(summary);
    });
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate]);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="startDate" className="text-sm font-medium">
            Od
          </label>
          <input
            id="startDate"
            type="date"
            lang="sk"
            required
            value={startDate}
            max={endDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="field"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="endDate" className="text-sm font-medium">
            Do
          </label>
          <input
            id="endDate"
            type="date"
            lang="sk"
            required
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="field"
          />
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted">Počíta sa...</p>}

      {!isLoading && result && !result.ok && (
        <p className="text-sm text-danger">{result.error}</p>
      )}

      {!isLoading && result?.ok && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface-muted px-4 py-3">
              <span className="text-sm font-medium text-muted">Couvert z účtu spolu</span>
              <span className="text-2xl font-semibold tracking-tight">
                {formatEur(result.totalZUctu)}
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface-muted px-4 py-3">
              <span className="text-sm font-medium text-muted">Čistý couvert spolu</span>
              <span className="text-2xl font-semibold tracking-tight">
                {formatEur(result.totalCisty)}
              </span>
            </div>
          </div>

          <p className="text-sm text-muted">
            {result.totalCount === 0
              ? "Za zvolené obdobie neboli nájdené žiadne položky Couvert."
              : `${result.totalCount} položiek za ${result.days.length} ${
                  result.days.length === 1 ? "deň" : "dní"
                }.`}
          </p>

          {result.days.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Podľa dní</span>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-muted text-left text-muted">
                      <th className="px-3 py-2 font-medium">Dátum</th>
                      <th className="px-3 py-2 text-right font-medium">Počet</th>
                      <th className="px-3 py-2 text-right font-medium">Z účtu</th>
                      <th className="px-3 py-2 text-right font-medium">Čistý</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.days.map((day) => (
                      <tr key={day.date} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">{formatDate(day.date)}</td>
                        <td className="px-3 py-2 text-right">{day.count}</td>
                        <td className="px-3 py-2 text-right">{formatEur(day.zUctu)}</td>
                        <td className="px-3 py-2 text-right">{formatEur(day.cisty)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
