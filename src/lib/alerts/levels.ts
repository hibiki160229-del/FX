import { latestAtr } from "@/lib/indicators";
import type { OhlcvBar, TradeSide } from "@/lib/types";
import {
  ATR_PERIOD,
  ATR_SL_MULT,
  ATR_TP_MULT,
  PCT_SL,
  PCT_TP,
  type EntrySide,
  type RiskLevels,
} from "./types";

function roundPx(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * ATR-based (preferred) or percent-based TP/SL around an entry price.
 * Long: SL below, TP above. Short: SL above, TP below.
 * Target reward ≈ 2R.
 */
export function computeRiskLevels(
  entryPrice: number,
  side: EntrySide | TradeSide,
  bars: OhlcvBar[],
): RiskLevels {
  const dir: EntrySide =
    side === "buy" || side === "long" ? "long" : "short";
  const atrVal = latestAtr(bars, ATR_PERIOD);
  const useAtr =
    atrVal != null && atrVal > 0 && atrVal / entryPrice < 0.05;

  let risk: number;
  let reward: number;
  let method: RiskLevels["method"];

  if (useAtr && atrVal != null) {
    risk = atrVal * ATR_SL_MULT;
    reward = atrVal * ATR_TP_MULT;
    method = "atr";
  } else {
    risk = entryPrice * PCT_SL;
    reward = entryPrice * PCT_TP;
    method = "pct";
  }

  // Guard tiny / zero risk
  if (!Number.isFinite(risk) || risk <= 0) {
    risk = entryPrice * PCT_SL;
    reward = entryPrice * PCT_TP;
    method = "pct";
  }

  const takeProfit =
    dir === "long" ? entryPrice + reward : entryPrice - reward;
  const stopLoss =
    dir === "long" ? entryPrice - risk : entryPrice + risk;

  return {
    takeProfit: roundPx(takeProfit),
    stopLoss: roundPx(stopLoss),
    risk: roundPx(risk),
    rewardR: roundPx(reward / risk),
    atr: atrVal != null ? roundPx(atrVal) : null,
    method,
  };
}
