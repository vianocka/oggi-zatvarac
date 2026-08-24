export type BlockyEntry = {
  nazov: string;
  suma: number;
};

export type DailyClosingAmounts = {
  totalSum: number;
  terminal1: number;
  terminal2: number;
  choiceQr: number;
  wolt: number;
  choiceTips: number;
  couvert: number[]; // "Couvert z účtu" - 70% of each (rounded to 1 decimal) is deducted
  blocky: BlockyEntry[];
};

// Rounds to the nearest cent. Summing floats (e.g. amounts pulled from an
// API and added together) routinely leaves binary-float artifacts like
// 5917.699999999995 - round at the source so nothing downstream (display,
// "Kopírovať" copying the value into an input, ...) ever sees them.
export function roundToCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// "Čistý couvert" = 70% of "Couvert z účtu", rounded to 1 decimal place.
export function couvertCistySuma(zUctu: number): number {
  return Math.round(zUctu * 0.7 * 10) / 10;
}

export function calculateHotovostDoObalky(amounts: DailyClosingAmounts): number {
  const sum = (values: number[]) => values.reduce((acc, v) => acc + v, 0);

  const deductions =
    amounts.terminal1 +
    amounts.terminal2 +
    amounts.choiceQr +
    amounts.wolt +
    amounts.choiceTips +
    sum(amounts.couvert.map(couvertCistySuma)) +
    sum(amounts.blocky.map((b) => b.suma));

  return amounts.totalSum - deductions;
}
