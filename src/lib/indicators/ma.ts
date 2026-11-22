import type { OhlcvBar } from "@/lib/types";

/** Simple moving average of close. Returns null until enough bars. */
export function sma(bars: OhlcvBar[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(bars.length).fill(null);
  if (period <= 0 || bars.length < period) return out;

  let sum = 0;
  for (let i = 0; i < bars.length; i++) {
    sum += bars[i].close;
    if (i >= period) sum -= bars[i - period].close;
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}
