"use client";

import { useEffect, useMemo, useState } from "react";
import { getTurnoverOverview, type TurnoverOverview } from "../odhad-actions";

const WEEKDAYS = ["Nedeľa", "Pondelok", "Utorok", "Streda", "Štvrtok", "Piatok", "Sobota"];
// Monday-first display order.
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function currentMonth() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 7);
}

function lastMonths(count: number): string[] {
  const [y, m] = currentMonth().split("-").map(Number);
  return Array.from({ length: count }, (_, i) =>
    new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 7)
  );
}

function formatEur(value: number) {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(value);
}

function monthLabel(month: string) {
  const label = new Intl.DateTimeFormat("sk-SK", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00.000Z`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function dayLabel(iso: string) {
  const d = new Date(`${iso}T00:00:00.000Z`);
  return `${WEEKDAYS[d.getUTCDay()].slice(0, 2)} ${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
}

export function OdhadView() {
  const months = useMemo(() => lastMonths(24), []);
  const [month, setMonth] = useState(months[0]);
  const [result, setResult] = useState<{ month: string; data: TurnoverOverview } | null>(
    null
  );
  const loading = result?.month !== month;

  useEffect(() => {
    let cancelled = false;
    getTurnoverOverview(month)
      .then((data) => !cancelled && setResult({ month, data }))
      .catch(
        () =>
          !cancelled &&
          setResult({ month, data: { ok: false, error: "Načítanie zlyhalo." } })
      );
    return () => {
      cancelled = true;
    };
  }, [month]);

  const data = loading ? null : result.data;

  return (
    <div className="flex flex-col gap-6">
      <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
        Mesiac
        <select
          className="field"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        >
          {months.map((m, i) => (
            <option key={m} value={m}>
              {monthLabel(m)}
              {i === 0 ? " (aktuálny)" : ""}
            </option>
          ))}
        </select>
      </label>

      {loading && <p className="text-sm text-muted">Načítava sa z Dotykačky...</p>}
      {data && !data.ok && <p className="text-sm text-danger">{data.error}</p>}

      {data?.ok && (
        <>
          {data.projection ? (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl bg-surface-muted p-4 text-center">
                <p className="text-sm text-muted">Odhad tržby za {monthLabel(data.month)}</p>
                <p className="text-3xl font-semibold tracking-tight text-foreground">
                  {formatEur(data.projection.projected)}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted">Doteraz (bez dneška)</dt>
                  <dd className="font-medium text-foreground">
                    {formatEur(data.projection.soFar)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">
                    Očakávané za zvyšok ({data.projection.remainingDays} dní vrátane dneška)
                  </dt>
                  <dd className="font-medium text-foreground">
                    {formatEur(data.projection.expectedRemaining)}
                  </dd>
                </div>
              </dl>
              <div>
                <h2 className="mb-2 text-sm font-semibold text-foreground">
                  Priemerná tržba podľa dňa v týždni
                </h2>
                <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                  {WEEKDAY_ORDER.map((wd) => {
                    const avg = data.projection!.weekdayAverages[wd];
                    return (
                      <li key={wd} className="flex justify-between gap-2">
                        <span className="text-muted">{WEEKDAYS[wd]}</span>
                        <span className="text-foreground">
                          {avg === null ? "-" : avg === 0 ? "zatvorené" : formatEur(avg)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-surface-muted p-4 text-center">
              <p className="text-sm text-muted">Tržba za {monthLabel(data.month)}</p>
              <p className="text-3xl font-semibold tracking-tight text-foreground">
                {formatEur(data.total)}
              </p>
            </div>
          )}

          <div>
            <h2 className="mb-2 text-sm font-semibold text-foreground">Denné tržby</h2>
            <ul className="flex flex-col divide-y divide-border text-sm">
              {data.days.map((d) => (
                <li key={d.date} className="flex justify-between py-1.5">
                  <span className="text-muted">
                    {dayLabel(d.date)}
                    {d.date === data.today ? " (dnes, ešte prebieha)" : ""}
                  </span>
                  <span className="text-foreground">{formatEur(d.total)}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
