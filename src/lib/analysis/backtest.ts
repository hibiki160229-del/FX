import type { OhlcvBar } from "@/lib/types";
import type { RuleId, RuleParams } from "@/lib/signals";
import { makeSideLookup } from "./signal-at";
import type { ScoreMetrics } from "./types";

export type BacktestOptions = {
  /** Starting cash in quote units (JPY-like). */
  initialEquity?: number;
  /** Fixed notional per trade as fraction of equity. */
  riskFraction?: number;
  /** Skip first N bars for indicator warm-up. */
  warmup?: number;
};

/**
 * Flip-on-signal backtester: long/short flat-to-position, reverse on opposite.
 * PnL in price points × position size (1 lot ≈ 1 unit of quote per pip-ish).
 */
export function backtestRule(
  bars: OhlcvBar[],
  ruleId: RuleId,
  params: RuleParams[RuleId],
  opts: BacktestOptions = {},
): ScoreMetrics {
  const initialEquity = opts.initialEquity ?? 1_000_000;
  const riskFraction = opts.riskFraction ?? 0.1;
  // Long MAs (e.g. 200) need deeper warm-up before signals are meaningful.
  const paramValues = Object.values(params as Record<string, unknown>).filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
  const inferred = Math.max(60, ...paramValues, 0) + 10;
  const warmup = opts.warmup ?? inferred;

  if (bars.length < warmup + 10) {
    return {
      totalReturn: 0,
      maxDrawdown: 0,
      winRate: 0,
      tradeCount: 0,
      profitFactor: 0,
    };
  }

  const sideAt = makeSideLookup(bars, ruleId, params);

  let cash = initialEquity;
  let position: "long" | "short" | null = null;
  let entry = 0;
  let size = 0;
  let equity = initialEquity;
  let peak = initialEquity;
  let maxDd = 0;

  let wins = 0;
  let losses = 0;
  let grossWin = 0;
  let grossLoss = 0;
  let tradeCount = 0;

  const markEquity = (price: number) => {
    if (position === "long") {
      equity = cash + size * (price - entry);
    } else if (position === "short") {
      equity = cash + size * (entry - price);
    } else {
      equity = cash;
    }
    if (equity > peak) peak = equity;
    const dd = peak > 0 ? (peak - equity) / peak : 0;
    if (dd > maxDd) maxDd = dd;
  };

  const closePosition = (price: number) => {
    if (!position || size <= 0) return;
    const pnl =
      position === "long" ? size * (price - entry) : size * (entry - price);
    cash += pnl;
    tradeCount += 1;
    if (pnl > 0) {
      wins += 1;
      grossWin += pnl;
    } else if (pnl < 0) {
      losses += 1;
      grossLoss += -pnl;
    }
    position = null;
    size = 0;
    entry = 0;
  };

  const openPosition = (side: "long" | "short", price: number) => {
    const notional = Math.max(0, equity) * riskFraction;
    // Size so that 1 yen move ≈ notional / price impact scale.
    size = price > 0 ? notional / price : 0;
    if (size <= 0) return;
    position = side;
    entry = price;
  };

  for (let i = warmup; i < bars.length; i++) {
    const price = bars[i].close;
    const signal = sideAt(i);
    if (signal) {
      if (position && position !== signal) {
        closePosition(price);
      }
      if (!position) {
        markEquity(price);
        openPosition(signal, price);
      }
    }
    markEquity(price);
  }

  // Flatten at end.
  if (position) {
    closePosition(bars[bars.length - 1].close);
    markEquity(bars[bars.length - 1].close);
  }

  const totalReturn = (equity - initialEquity) / initialEquity;
  const closed = wins + losses;
  const winRate = closed > 0 ? wins / closed : 0;
  const profitFactor =
    grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;

  return {
    totalReturn,
    maxDrawdown: maxDd,
    winRate,
    tradeCount,
    profitFactor: Number.isFinite(profitFactor) ? profitFactor : 99,
  };
}
