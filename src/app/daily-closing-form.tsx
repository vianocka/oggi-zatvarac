"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  getDailyClosing,
  saveDailyClosing,
  type DailyClosingState,
} from "./actions";
import {
  getDotypayTerminalTotals,
  type DotypayTerminalTotals,
} from "./dotypay-actions";
import {
  getDotykackaDailyTotals,
  type DotykackaDailyTotals,
} from "./dotykacka-actions";
import { calculateHotovostDoObalky, couvertCistySuma } from "@/lib/daily-closing";

const initialState: DailyClosingState = { ok: false, message: "" };

const emptyAmounts: Record<FieldKey, string> = {
  totalSum: "",
  terminal1: "",
  terminal2: "",
  choiceQr: "",
  wolt: "",
  choiceTips: "",
};

type BlockyRow = { nazov: string; suma: string };

function todayIso() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

// Keeps only digits and a single decimal separator (comma or dot), so typing
// or pasting anything else has no effect - the field never shows it. When
// `allowNegative` is set, a single leading "-" is kept too (e.g. for Blocky
// storno-style entries), wherever in the input it was typed.
function sanitizeAmountInput(raw: string, allowNegative = false): string {
  const allowedChars = allowNegative ? /[^0-9,.-]/g : /[^0-9,.]/g;
  const cleaned = raw.replace(allowedChars, "");

  const isNegative = allowNegative && cleaned.startsWith("-");
  const unsigned = allowNegative ? cleaned.replace(/-/g, "") : cleaned;
  const sign = isNegative ? "-" : "";

  const firstSeparatorIndex = unsigned.search(/[,.]/);
  if (firstSeparatorIndex === -1) return sign + unsigned;
  return (
    sign +
    unsigned.slice(0, firstSeparatorIndex + 1) +
    unsigned.slice(firstSeparatorIndex + 1).replace(/[,.]/g, "")
  );
}

function parseAmount(value: string): number {
  const n = parseFloat(value.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

// Cents-level tolerance so float rounding never causes a false mismatch.
function amountsMatch(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005;
}

function formatEur(value: number) {
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

type FieldKey =
  | "totalSum"
  | "terminal1"
  | "terminal2"
  | "choiceQr"
  | "wolt"
  | "choiceTips";

function AmountInput({
  id,
  label,
  value,
  onChange,
  extra,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  extra?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(sanitizeAmountInput(e.target.value))}
          className="flex-1 rounded-md border border-black/[.08] bg-transparent px-3 py-2 text-sm dark:border-white/[.145]"
        />
        {extra}
      </div>
    </div>
  );
}

function SumBadge({
  amount,
  matches,
  onCopy,
}: {
  amount: number;
  matches: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex flex-none items-center gap-1.5 whitespace-nowrap rounded-md border border-black/[.08] px-2 py-1.5 text-xs dark:border-white/[.145]">
      <span
        aria-hidden="true"
        title={
          matches
            ? "Zhoduje sa so zadanou sumou"
            : "Nezhoduje sa so zadanou sumou"
        }
        className={`h-2.5 w-2.5 flex-none rounded-sm ${
          matches ? "bg-green-500" : "bg-red-500"
        }`}
      />
      <span>{formatEur(amount)}</span>
      <button
        type="button"
        onClick={onCopy}
        className="font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        Kopírovať
      </button>
    </div>
  );
}

function ListHeader({
  title,
  count,
  subtotal,
  onAdd,
}: {
  title: string;
  count: number;
  subtotal: number;
  onAdd: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-medium">{title}</span>
        {count > 0 && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {count} · {formatEur(subtotal)}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        + Pridať
      </button>
    </div>
  );
}

function RepeatableCouvertList({
  values,
  onChange,
}: {
  values: string[]; // "Couvert z účtu" amounts
  onChange: (values: string[]) => void;
}) {
  const subtotal = useMemo(
    () => values.reduce((sum, v) => sum + couvertCistySuma(parseAmount(v)), 0),
    [values]
  );

  return (
    <div className="flex flex-col gap-2">
      <ListHeader
        title="Couvert"
        count={values.length}
        subtotal={subtotal}
        onAdd={() => onChange([...values, ""])}
      />
      {values.length === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Žiadne položky.
        </p>
      )}
      {values.map((value, index) => {
        const cistyDisplay =
          value.trim() === "" ? "" : couvertCistySuma(parseAmount(value)).toFixed(1);
        return (
          <div key={index} className="flex items-center gap-2">
            <input
              type="text"
              inputMode="decimal"
              placeholder="Couvert z účtu"
              aria-label={`Couvert z účtu ${index + 1}`}
              value={value}
              onChange={(e) => {
                const next = [...values];
                next[index] = sanitizeAmountInput(e.target.value);
                onChange(next);
              }}
              className="flex-1 rounded-md border border-black/[.08] bg-transparent px-3 py-2 text-sm dark:border-white/[.145]"
            />
            <input
              type="text"
              readOnly
              disabled
              placeholder="Čistý couvert"
              aria-label={`Čistý couvert ${index + 1}`}
              value={cistyDisplay}
              className="flex-1 cursor-not-allowed rounded-md border border-black/[.08] bg-black/[.03] px-3 py-2 text-sm text-zinc-500 dark:border-white/[.145] dark:bg-white/[.05] dark:text-zinc-400"
            />
            <button
              type="button"
              onClick={() => onChange(values.filter((_, i) => i !== index))}
              aria-label={`Odstrániť Couvert ${index + 1}`}
              className="rounded-md border border-black/[.08] px-2.5 py-2 text-sm text-red-600 hover:bg-red-600/5 dark:border-white/[.145]"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

function RepeatableBlockyList({
  values,
  onChange,
}: {
  values: BlockyRow[];
  onChange: (values: BlockyRow[]) => void;
}) {
  const subtotal = useMemo(
    () => values.reduce((sum, v) => sum + parseAmount(v.suma), 0),
    [values]
  );

  return (
    <div className="flex flex-col gap-2">
      <ListHeader
        title="Blocky"
        count={values.length}
        subtotal={subtotal}
        onAdd={() => onChange([...values, { nazov: "", suma: "" }])}
      />
      {values.length === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Žiadne položky.
        </p>
      )}
      {values.map((row, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            type="text"
            maxLength={200}
            placeholder="Názov"
            aria-label={`Blocky ${index + 1} názov`}
            value={row.nazov}
            onChange={(e) => {
              const next = [...values];
              next[index] = { ...next[index], nazov: e.target.value };
              onChange(next);
            }}
            className="flex-[2] rounded-md border border-black/[.08] bg-transparent px-3 py-2 text-sm dark:border-white/[.145]"
          />
          <input
            type="text"
            // "decimal" hides the "-" key on most mobile keyboards; Blocky
            // amounts can be negative (e.g. storno), so use "text" instead.
            inputMode="text"
            placeholder="Suma"
            aria-label={`Blocky ${index + 1} suma`}
            value={row.suma}
            onChange={(e) => {
              const next = [...values];
              next[index] = {
                ...next[index],
                suma: sanitizeAmountInput(e.target.value, true),
              };
              onChange(next);
            }}
            className="w-28 flex-none rounded-md border border-black/[.08] bg-transparent px-3 py-2 text-sm dark:border-white/[.145]"
          />
          <button
            type="button"
            onClick={() => onChange(values.filter((_, i) => i !== index))}
            aria-label={`Odstrániť Blocky ${index + 1}`}
            className="rounded-md border border-black/[.08] px-2.5 py-2 text-sm text-red-600 hover:bg-red-600/5 dark:border-white/[.145]"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
    >
      {pending ? "Ukladá sa..." : "Uložiť"}
    </button>
  );
}

export function DailyClosingForm() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dateInputRef = useRef<HTMLInputElement>(null);

  const [date, setDate] = useState(() => searchParams.get("date") ?? todayIso());
  const [amounts, setAmounts] = useState<Record<FieldKey, string>>(emptyAmounts);
  const [couvert, setCouvert] = useState<string[]>([]);
  const [blocky, setBlocky] = useState<BlockyRow[]>([]);
  const [isLoadingRecord, startLoadingRecord] = useTransition();

  const [dotypayState, setDotypayState] = useState<{
    date: string;
    result: DotypayTerminalTotals;
  } | null>(null);
  const [isFetchingDotypay, startFetchingDotypay] = useTransition();
  // Stale once the date changes without a fresh fetch for that date.
  const dotypayResult = dotypayState?.date === date ? dotypayState.result : null;

  function fetchDotypay(requestedDate: string) {
    startFetchingDotypay(async () => {
      const result = await getDotypayTerminalTotals(requestedDate);
      // A stale response for a since-changed date is harmless: dotypayResult
      // above only trusts state whose date still matches the current date.
      setDotypayState({ date: requestedDate, result });
    });
  }

  // Automatically pull Dotypay terminal totals whenever the date changes.
  useEffect(() => {
    fetchDotypay(date);
  }, [date]);

  const [dotykackaState, setDotykackaState] = useState<{
    date: string;
    result: DotykackaDailyTotals;
  } | null>(null);
  const [isFetchingDotykacka, startFetchingDotykacka] = useTransition();
  const dotykackaResult =
    dotykackaState?.date === date ? dotykackaState.result : null;

  function fetchDotykacka(requestedDate: string) {
    startFetchingDotykacka(async () => {
      const result = await getDotykackaDailyTotals(requestedDate);
      setDotykackaState({ date: requestedDate, result });
    });
  }

  // Automatically pull Dotykačka totals whenever the date changes.
  useEffect(() => {
    fetchDotykacka(date);
  }, [date]);

  // Keep the date in the URL so a refresh (or shared link) preserves it.
  useEffect(() => {
    if (searchParams.get("date") === date) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", date);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [date, pathname, router, searchParams]);

  // Load any existing entry for the selected date (including on first load).
  useEffect(() => {
    let cancelled = false;

    startLoadingRecord(async () => {
      const record = await getDailyClosing(date);
      if (cancelled) return;
      if (record) {
        setAmounts({
          totalSum: String(record.totalSum),
          terminal1: String(record.terminal1),
          terminal2: String(record.terminal2),
          choiceQr: String(record.choiceQr),
          wolt: String(record.wolt),
          choiceTips: String(record.choiceTips),
        });
        setCouvert(record.couvert.map(String));
        setBlocky(
          record.blocky.map((item) => ({
            nazov: item.nazov,
            suma: String(item.suma),
          }))
        );
      } else {
        setAmounts(emptyAmounts);
        setCouvert([]);
        setBlocky([]);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [date]);

  const hotovostDoObalky = useMemo(
    () =>
      calculateHotovostDoObalky({
        totalSum: parseAmount(amounts.totalSum),
        terminal1: parseAmount(amounts.terminal1),
        terminal2: parseAmount(amounts.terminal2),
        choiceQr: parseAmount(amounts.choiceQr),
        wolt: parseAmount(amounts.wolt),
        choiceTips: parseAmount(amounts.choiceTips),
        couvert: couvert.map(parseAmount),
        blocky: blocky.map((b) => ({ nazov: b.nazov, suma: parseAmount(b.suma) })),
      }),
    [amounts, couvert, blocky]
  );

  const [state, formAction] = useActionState(async () => {
    return saveDailyClosing({
      date,
      totalSum: parseAmount(amounts.totalSum),
      terminal1: parseAmount(amounts.terminal1),
      terminal2: parseAmount(amounts.terminal2),
      choiceQr: parseAmount(amounts.choiceQr),
      wolt: parseAmount(amounts.wolt),
      choiceTips: parseAmount(amounts.choiceTips),
      couvert: couvert.map(parseAmount),
      blocky: blocky.map((b) => ({ nazov: b.nazov, suma: parseAmount(b.suma) })),
    });
  }, initialState);

  // Auto-dismiss the save result after a few seconds instead of leaving it
  // on screen until the next submit or a page refresh. `state` gets a new
  // object identity on every action result (even an identical message
  // string on a second save), so "did state just change" is tracked by
  // comparing against the previous one seen - adjusted during render
  // (React's recommended pattern) rather than via setState inside an
  // effect, which would trigger cascading renders.
  const [showMessage, setShowMessage] = useState(false);
  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    setShowMessage(Boolean(state.message));
  }

  useEffect(() => {
    if (!showMessage) return;
    const timer = setTimeout(() => setShowMessage(false), 4000);
    return () => clearTimeout(timer);
  }, [showMessage, state]);

  return (
    <form action={formAction} className="flex w-full max-w-md flex-col gap-5">
      <div className="flex flex-col gap-1">
        <label htmlFor="date" className="text-sm font-medium">
          Dátum
        </label>
        <input
          ref={dateInputRef}
          id="date"
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          onClick={() => {
            try {
              dateInputRef.current?.showPicker?.();
            } catch {
              // Unsupported in this browser; native click-to-open still applies.
            }
          }}
          className="rounded-md border border-black/[.08] bg-transparent px-3 py-2 text-sm dark:border-white/[.145]"
        />
        {isLoadingRecord && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Načítavam záznam pre zvolený dátum...
          </p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
          {isFetchingDotykacka
            ? "Načítavam sumy z Dotykačky..."
            : "Sumy z Dotykačky"}
        </span>
        <button
          type="button"
          onClick={() => fetchDotykacka(date)}
          disabled={isFetchingDotykacka}
          className="text-sm font-medium text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400"
        >
          Obnoviť
        </button>
      </div>
      {dotykackaResult && !dotykackaResult.ok && (
        <p className="-mt-3 text-sm text-red-600">{dotykackaResult.error}</p>
      )}

      <AmountInput
        id="totalSum"
        label="Celková suma"
        value={amounts.totalSum}
        onChange={(value) => setAmounts({ ...amounts, totalSum: value })}
        extra={
          dotykackaResult?.ok ? (
            <SumBadge
              amount={dotykackaResult.totalSum}
              matches={amountsMatch(
                parseAmount(amounts.totalSum),
                dotykackaResult.totalSum
              )}
              onCopy={() =>
                setAmounts({
                  ...amounts,
                  totalSum: String(dotykackaResult.totalSum),
                })
              }
            />
          ) : undefined
        }
      />

      {dotykackaResult?.ok && (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Storno</span>
          <div className="cursor-not-allowed rounded-md border border-black/[.08] bg-black/[.03] px-3 py-2 text-sm text-zinc-500 dark:border-white/[.145] dark:bg-white/[.05] dark:text-zinc-400">
            {formatEur(dotykackaResult.storno)}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
          {isFetchingDotypay ? "Načítavam sumy z Dotypay..." : "Sumy z Dotypay"}
        </span>
        <button
          type="button"
          onClick={() => fetchDotypay(date)}
          disabled={isFetchingDotypay}
          className="text-sm font-medium text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400"
        >
          Obnoviť
        </button>
      </div>
      {dotypayResult && !dotypayResult.ok && (
        <p className="-mt-3 text-sm text-red-600">{dotypayResult.error}</p>
      )}

      <AmountInput
        id="terminal1"
        label="Terminal 1"
        value={amounts.terminal1}
        onChange={(value) => setAmounts({ ...amounts, terminal1: value })}
        extra={
          dotypayResult?.ok && dotypayResult.terminal1 ? (
            <SumBadge
              amount={dotypayResult.terminal1.amount}
              matches={amountsMatch(
                parseAmount(amounts.terminal1),
                dotypayResult.terminal1.amount
              )}
              onCopy={() =>
                setAmounts({
                  ...amounts,
                  terminal1: String(dotypayResult.terminal1!.amount),
                })
              }
            />
          ) : undefined
        }
      />
      <AmountInput
        id="terminal2"
        label="Terminal 2"
        value={amounts.terminal2}
        onChange={(value) => setAmounts({ ...amounts, terminal2: value })}
        extra={
          dotypayResult?.ok && dotypayResult.terminal2 ? (
            <SumBadge
              amount={dotypayResult.terminal2.amount}
              matches={amountsMatch(
                parseAmount(amounts.terminal2),
                dotypayResult.terminal2.amount
              )}
              onCopy={() =>
                setAmounts({
                  ...amounts,
                  terminal2: String(dotypayResult.terminal2!.amount),
                })
              }
            />
          ) : undefined
        }
      />
      {dotypayResult?.ok && dotypayResult.unmatched.length > 0 && (
        <p className="-mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Ďalšie terminály z Dotypay (nepriradené):{" "}
          {dotypayResult.unmatched
            .map((u) => `${u.tid}: ${formatEur(u.amount)}`)
            .join(", ")}
          . Nastavte DOTYPAY_TID_TERMINAL_1 / DOTYPAY_TID_TERMINAL_2 pre presné
          priradenie.
        </p>
      )}

      <AmountInput
        id="choiceQr"
        label="Choice QR"
        value={amounts.choiceQr}
        onChange={(value) => setAmounts({ ...amounts, choiceQr: value })}
        extra={
          dotykackaResult?.ok ? (
            <SumBadge
              amount={dotykackaResult.choiceQr}
              matches={amountsMatch(
                parseAmount(amounts.choiceQr),
                dotykackaResult.choiceQr
              )}
              onCopy={() =>
                setAmounts({
                  ...amounts,
                  choiceQr: String(dotykackaResult.choiceQr),
                })
              }
            />
          ) : undefined
        }
      />
      <AmountInput
        id="wolt"
        label="Wolt"
        value={amounts.wolt}
        onChange={(value) => setAmounts({ ...amounts, wolt: value })}
        extra={
          dotykackaResult?.ok ? (
            <SumBadge
              amount={dotykackaResult.wolt}
              matches={amountsMatch(
                parseAmount(amounts.wolt),
                dotykackaResult.wolt
              )}
              onCopy={() =>
                setAmounts({ ...amounts, wolt: String(dotykackaResult.wolt) })
              }
            />
          ) : undefined
        }
      />
      <AmountInput
        id="choiceTips"
        label="Choice Tips"
        value={amounts.choiceTips}
        onChange={(value) => setAmounts({ ...amounts, choiceTips: value })}
      />

      <RepeatableCouvertList values={couvert} onChange={setCouvert} />
      <RepeatableBlockyList values={blocky} onChange={setBlocky} />

      <div className="flex flex-col gap-1 rounded-md border border-black/[.08] bg-black/[.02] px-3 py-2 dark:border-white/[.145] dark:bg-white/[.03]">
        <span className="text-sm font-medium">Hotovosť do obálky</span>
        <span className="text-lg font-semibold">
          {formatEur(hotovostDoObalky)}
        </span>
      </div>

      <SubmitButton />

      {showMessage && state.message && (
        <p
          aria-live="polite"
          className={`text-sm ${state.ok ? "text-green-600" : "text-red-600"}`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
