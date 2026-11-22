import type { OhlcvBar } from "@/lib/types";
import { ema } from "./ema";

export type MacdPoint = {
  macd: number | null;
  signal: number | null;
  histogram: number | null;
};

/** MACD (12, 26, 9) on close. */
export function macd(
  bars: OhlcvBar[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): MacdPoint[] {
  const fastE = ema(bars, fast);
  const slowE = ema(bars, slow);
  const macdLine: (number | null)[] = bars.map((_, i) => {
    if (fastE[i] == null || slowE[i] == null) return null;
    return (fastE[i] as number) - (slowE[i] as number);
  });

  // EMA of MACD line for signal — reuse by synthesizing fake bars
  const synthetic: OhlcvBar[] = macdLine.map((v, i) => ({
    time: bars[i].time,
    open: v ?? 0,
    high: v ?? 0,
    low: v ?? 0,
    close: v ?? 0,
    volume: 0,
  }));

  // Only compute signal where macd is defined; seed from first non-null run
  const first = macdLine.findIndex((v) => v != null);
  const signalLine: (number | null)[] = new Array(bars.length).fill(null);
  if (first >= 0) {
    const slice = synthetic.slice(first);
    const sig = ema(slice, signalPeriod);
    for (let i = 0; i < sig.length; i++) {
      signalLine[first + i] = sig[i];
    }
  }

  return bars.map((_, i) => {
    const m = macdLine[i];
    const s = signalLine[i];
    return {
      macd: m,
      signal: s,
      histogram: m != null && s != null ? m - s : null,
    };
  });
}
