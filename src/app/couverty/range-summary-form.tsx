"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getRangeSummary, type RangeSummary } from "../couverty-actions";

function todayIso() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function firstOfMonthIso() {
  return `${todayIso().slice(0, 7)}-01`;
}

// Local (not UTC) today, so "last month" lines up with what the user sees
// on their clock, same convention as todayIso().
function localToday() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000);
}

// First/last day of the calendar month before the current one - handles
// the January-to-December rollover via JS Date's own normalization.
function lastMonthRange(): { start: string; end: string } {
  const local = localToday();
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  const start = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return { start, end };
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

function SectionTotal({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface-muted px-4 py-3">
      <span className="text-sm font-medium text-muted">{label}</span>
      <span className="text-2xl font-semibold tracking-tight">{formatEur(value)}</span>
    </div>
  );
}

export function RangeSummaryForm() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [startDate, setStartDate] = useState(
    () => searchParams.get("od") ?? firstOfMonthIso()
  );
  const [endDate, setEndDate] = useState(() => searchParams.get("do") ?? todayIso());
  const [result, setResult] = useState<RangeSummary | null>(null);
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
      const summary = await getRangeSummary(startDate, endDate);
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

      <button
        type="button"
        onClick={() => {
          const { start, end } = lastMonthRange();
          setStartDate(start);
          setEndDate(end);
        }}
        className="btn-ghost self-start"
      >
        Minulý mesiac
      </button>

      <div className="h-px bg-border" />

      {isLoading && <p className="text-sm text-muted">Počíta sa...</p>}

      {!isLoading && result && !result.ok && (
        <p className="text-sm text-danger">{result.error}</p>
      )}

      {!isLoading && result?.ok && (
        <>
          {/* Couvert */}
          <div className="flex flex-col gap-3">
            <span className="text-sm font-semibold">Couvert</span>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SectionTotal label="Couvert z účtu spolu" value={result.couvert.totalZUctu} />
              <SectionTotal label="Čistý couvert spolu" value={result.couvert.totalCisty} />
            </div>
            <p className="text-sm text-muted">
              {result.couvert.totalCount === 0
                ? "Žiadne položky Couvert za zvolené obdobie."
                : `${result.couvert.totalCount} položiek za ${result.couvert.days.length} ${
                    result.couvert.days.length === 1 ? "deň" : "dní"
                  }.`}
            </p>
            {result.couvert.days.length > 0 && (
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
                    {result.couvert.days.map((day) => (
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
            )}
          </div>

          <div className="h-px bg-border" />

          {/* Choice Tips */}
          <div className="flex flex-col gap-3">
            <span className="text-sm font-semibold">Choice Tips</span>
            <SectionTotal label="Choice Tips spolu" value={result.choiceTips.total} />
            <p className="text-sm text-muted">
              {result.choiceTips.days.length === 0
                ? "Žiadne Choice Tips za zvolené obdobie."
                : `${result.choiceTips.days.length} ${
                    result.choiceTips.days.length === 1 ? "deň" : "dní"
                  } s nenulovou sumou.`}
            </p>
            {result.choiceTips.days.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-muted text-left text-muted">
                      <th className="px-3 py-2 font-medium">Dátum</th>
                      <th className="px-3 py-2 text-right font-medium">Suma</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.choiceTips.days.map((day) => (
                      <tr key={day.date} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">{formatDate(day.date)}</td>
                        <td className="px-3 py-2 text-right">{formatEur(day.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="h-px bg-border" />

          {/* Blocky */}
          <div className="flex flex-col gap-3">
            <span className="text-sm font-semibold">Blocky</span>
            <SectionTotal label="Blocky spolu" value={result.blocky.total} />
            <p className="text-sm text-muted">
              {result.blocky.items.length === 0
                ? "Žiadne položky Blocky za zvolené obdobie."
                : `${result.blocky.items.length} ${
                    result.blocky.items.length === 1 ? "položka" : "položiek"
                  }.`}
            </p>
            {result.blocky.items.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-muted text-left text-muted">
                      <th className="px-3 py-2 font-medium">Dátum</th>
                      <th className="px-3 py-2 font-medium">Názov</th>
                      <th className="px-3 py-2 text-right font-medium">Suma</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.blocky.items.map((item, index) => (
                      <tr key={index} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">{formatDate(item.date)}</td>
                        <td className="px-3 py-2">{item.nazov}</td>
                        <td className="px-3 py-2 text-right">{formatEur(item.suma)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
