import type { OhlcvBar } from "@/lib/types";

/**
 * Wilder ATR (Average True Range).
 * Returns null until enough bars exist for the period.
 */
export function atr(bars: OhlcvBar[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(bars.length).fill(null);
  if (bars.length < period + 1) return out;

  const tr: number[] = new Array(bars.length).fill(0);
  for (let i = 1; i < bars.length; i++) {
    const high = bars[i].high;
    const low = bars[i].low;
    const prevClose = bars[i - 1].close;
    tr[i] = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose),
    );
  }

  let sum = 0;
  for (let i = 1; i <= period; i++) sum += tr[i];
  let prev = sum / period;
  out[period] = prev;

  for (let i = period + 1; i < bars.length; i++) {
    prev = (prev * (period - 1) + tr[i]) / period;
    out[i] = prev;
  }
  return out;
}

/** Latest non-null ATR value, or null if unavailable. */
export function latestAtr(bars: OhlcvBar[], period = 14): number | null {
  const series = atr(bars, period);
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i] != null) return series[i] as number;
  }
  return null;
}
