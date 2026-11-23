import type { OhlcvBar } from "@/lib/types";
import type { LiveQuote } from "@/lib/providers/types";

/**
 * Overlay a live mid onto the bar series for signal / alert evaluation.
 * - Same minute → update last bar OHLC extremes + close
 * - New minute → append a synthetic 1m bar starting at mid
 */
export function applyLiveMark(
  bars: OhlcvBar[],
  quote: LiveQuote,
  barSeconds = 60,
): OhlcvBar[] {
  if (bars.length === 0) return bars;
  const mid = quote.mid;
  if (!Number.isFinite(mid) || mid <= 0) return bars;

  const timeSec = Math.floor(quote.time / 1000);
  const bucket = Math.floor(timeSec / barSeconds) * barSeconds;
  const last = bars[bars.length - 1];

  if (last.time === bucket) {
    const next: OhlcvBar = {
      ...last,
      high: Math.max(last.high, mid),
      low: Math.min(last.low, mid),
      close: mid,
    };
    return [...bars.slice(0, -1), next];
  }

  if (bucket > last.time) {
    const synthetic: OhlcvBar = {
      time: bucket,
      open: mid,
      high: mid,
      low: mid,
      close: mid,
      volume: 0,
    };
    return [...bars, synthetic];
  }

  // Quote older than last bar — still nudge close for mark display
  const next: OhlcvBar = {
    ...last,
    high: Math.max(last.high, mid),
    low: Math.min(last.low, mid),
    close: mid,
  };
  return [...bars.slice(0, -1), next];
}
