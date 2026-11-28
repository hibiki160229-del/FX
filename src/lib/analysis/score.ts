import type { ScoreFloors, ScoreMetrics } from "./types";
import { DEFAULT_SCORE_FLOORS } from "./types";

export function checkFloors(
  metrics: ScoreMetrics,
  floors: ScoreFloors = DEFAULT_SCORE_FLOORS,
): { passed: boolean; failReasons: string[] } {
  const failReasons: string[] = [];
  if (metrics.tradeCount < floors.minTrades) {
    failReasons.push(
      `取引数 ${metrics.tradeCount} < 下限 ${floors.minTrades}`,
    );
  }
  if (metrics.maxDrawdown > floors.maxDrawdown) {
    failReasons.push(
      `最大DD ${(metrics.maxDrawdown * 100).toFixed(1)}% > ${(floors.maxDrawdown * 100).toFixed(0)}%`,
    );
  }
  if (metrics.winRate < floors.minWinRate) {
    failReasons.push(
      `勝率 ${(metrics.winRate * 100).toFixed(0)}% < ${(floors.minWinRate * 100).toFixed(0)}%`,
    );
  }
  // Exclusive: return must beat minReturn (default 0 → require profit).
  if (!(metrics.totalReturn > floors.minReturn)) {
    failReasons.push(
      metrics.totalReturn <= 0
        ? `リターン ${(metrics.totalReturn * 100).toFixed(2)}% ≤ 0%（損失/ゼロ）`
        : `リターン ${(metrics.totalReturn * 100).toFixed(2)}% ≤ 下限 ${(floors.minReturn * 100).toFixed(2)}%`,
    );
  }
  return { passed: failReasons.length === 0, failReasons };
}

/**
 * Higher is better. Penalizes drawdown and rewards return / win rate / activity.
 */
export function compositeScore(metrics: ScoreMetrics): number {
  const ret = metrics.totalReturn;
  const ddPenalty = metrics.maxDrawdown * 1.4;
  const wr = metrics.winRate;
  const tradesBonus = Math.min(metrics.tradeCount, 40) / 40;
  const pf = Math.min(metrics.profitFactor, 5) / 5;
  return ret * 2.2 - ddPenalty + wr * 0.6 + tradesBonus * 0.25 + pf * 0.3;
}
