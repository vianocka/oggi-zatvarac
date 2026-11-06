"use client";

import { useEffect, useRef, useState } from "react";
import { getMonthCheckedStatus } from "./actions";

const WEEKDAY_HEADERS = ["Po", "Ut", "St", "Št", "Pi", "So", "Ne"];

function monthOf(iso: string) {
  return iso.slice(0, 7);
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

function monthLabel(month: string) {
  const label = new Intl.DateTimeFormat("sk-SK", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00.000Z`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("sk-SK", { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00.000Z`)
  );
}

// Month grid (Monday first) with a bullet under each saved day: green when
// it is Skontrolovane, orange when it is not. Days with no saved closing
// get no bullet. A native <input type="date"> can't render these, hence
// the custom picker.
export function AdminCalendar({
  value,
  onSelect,
  refreshKey,
}: {
  value: string;
  onSelect: (iso: string) => void;
  // Changes whenever the selected day is saved/toggled so bullets refetch.
  refreshKey: string;
}) {
  const [open, setOpen] = useState(false);
  // Month being browsed; null = follow the selected date's month.
  const [browsedMonth, setBrowsedMonth] = useState<string | null>(null);
  const viewMonth = browsedMonth ?? monthOf(value);
  const [status, setStatus] = useState<{ month: string; days: Record<string, boolean> } | null>(
    null
  );
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getMonthCheckedStatus(viewMonth).then((days) => {
      if (!cancelled) setStatus({ month: viewMonth, days });
    });
    return () => {
      cancelled = true;
    };
  }, [open, viewMonth, refreshKey]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const [y, m] = viewMonth.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  // getUTCDay: 0 = Sunday; shift so Monday = 0.
  const leading = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const cells: (string | null)[] = [
    ...Array<null>(leading).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${viewMonth}-${String(i + 1).padStart(2, "0")}`),
  ];
  const days = status?.month === viewMonth ? status.days : {};

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <button
        type="button"
        id="date"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setBrowsedMonth(null);
          setOpen((o) => !o);
        }}
        className="field w-full text-left"
      >
        {formatDate(value)}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Výber dátumu"
          className="absolute left-0 z-10 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-surface p-3 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              className="btn-icon"
              aria-label="Predchádzajúci mesiac"
              onClick={() => setBrowsedMonth(shiftMonth(viewMonth, -1))}
            >
              ‹
            </button>
            <span className="text-sm font-semibold text-foreground">{monthLabel(viewMonth)}</span>
            <button
              type="button"
              className="btn-icon"
              aria-label="Nasledujúci mesiac"
              onClick={() => setBrowsedMonth(shiftMonth(viewMonth, 1))}
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
            {WEEKDAY_HEADERS.map((h) => (
              <span key={h} className="py-1 text-muted">
                {h}
              </span>
            ))}
            {cells.map((iso, i) =>
              iso === null ? (
                <span key={`b${i}`} />
              ) : (
                <button
                  key={iso}
                  type="button"
                  onClick={() => {
                    onSelect(iso);
                    setBrowsedMonth(null);
                    setOpen(false);
                  }}
                  aria-label={`${formatDate(iso)}${
                    iso in days ? (days[iso] ? ", skontrolované" : ", neskontrolované") : ""
                  }`}
                  aria-current={iso === value ? "date" : undefined}
                  className={`flex flex-col items-center gap-0.5 rounded-lg py-1 text-sm outline-none transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-accent/40 ${
                    iso === value ? "bg-surface-muted font-semibold text-foreground" : "text-foreground"
                  }`}
                >
                  {Number(iso.slice(8))}
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 rounded-full ${
                      iso in days ? (days[iso] ? "bg-green-600" : "bg-orange-500") : "bg-transparent"
                    }`}
                  />
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
