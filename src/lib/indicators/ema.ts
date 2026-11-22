import type { OhlcvBar } from "@/lib/types";

/** Exponential moving average of close. */
export function ema(bars: OhlcvBar[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(bars.length).fill(null);
  if (period <= 0 || bars.length < period) return out;

  const k = 2 / (period + 1);
  let prev = 0;
  for (let i = 0; i < period; i++) prev += bars[i].close;
  prev /= period;
  out[period - 1] = prev;

  for (let i = period; i < bars.length; i++) {
    prev = bars[i].close * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}
