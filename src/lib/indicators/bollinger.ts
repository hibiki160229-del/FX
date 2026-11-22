import type { OhlcvBar } from "@/lib/types";
import { sma } from "./ma";

export type BollingerPoint = {
  mid: number | null;
  upper: number | null;
  lower: number | null;
};

/** Bollinger Bands (period, k·σ). */
export function bollinger(
  bars: OhlcvBar[],
  period = 20,
  mult = 2,
): BollingerPoint[] {
  const mid = sma(bars, period);
  return bars.map((_, i) => {
    if (mid[i] == null) {
      return { mid: null, upper: null, lower: null };
    }
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = bars[j].close - (mid[i] as number);
      sumSq += d * d;
    }
    const std = Math.sqrt(sumSq / period);
    const m = mid[i] as number;
    return {
      mid: m,
      upper: m + mult * std,
      lower: m - mult * std,
    };
  });
}
