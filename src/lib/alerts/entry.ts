import type { OhlcvBar, SignalHint } from "@/lib/types";
import { computeRiskLevels } from "./levels";
import {
  MIN_ENTRY_STRENGTH,
  type EntryAlert,
  type EntrySide,
} from "./types";

function fingerprint(
  side: EntrySide,
  at: number,
  signalIds: string[],
): string {
  return `${side}:${at}:${[...signalIds].sort().join("+")}`;
}

function aggregateSide(
  hints: SignalHint[],
  side: EntrySide,
  entryPrice: number,
  bars: OhlcvBar[],
): EntryAlert | null {
  const matched = hints.filter((h) => h.side === side);
  if (matched.length === 0) return null;

  const strength =
    matched.reduce((s, h) => s + h.strength, 0) / matched.length;
  if (strength < MIN_ENTRY_STRENGTH) return null;

  const signalIds = matched.map((h) => h.id);
  const at = matched.reduce((m, h) => Math.max(m, h.at), 0);
  const levels = computeRiskLevels(entryPrice, side, bars);
  const labelJa = side === "long" ? ("買い" as const) : ("売り" as const);
  const primary = matched[0];

  return {
    id: fingerprint(side, at, signalIds),
    side,
    labelJa,
    title:
      matched.length === 1
        ? `${labelJa}エントリー — ${primary.title}`
        : `${labelJa}エントリー — ${matched.length}件のシグナル合流`,
    reasons: matched.map((h) => `${h.title}：${h.reason}`),
    signalIds,
    strength,
    entryPrice: Math.round(entryPrice * 1000) / 1000,
    takeProfit: levels.takeProfit,
    stopLoss: levels.stopLoss,
    risk: levels.risk,
    rewardR: levels.rewardR,
    atr: levels.atr,
    method: levels.method,
    at,
  };
}

/**
 * Build clear buy/sell entry alerts from active signal hints + mark price.
 * Prefers a single dominant side; if both fire, keeps the stronger one
 * and only includes the other when within 0.08 strength.
 */
export function buildEntryAlerts(
  hints: SignalHint[],
  bars: OhlcvBar[],
  entryPrice?: number,
): EntryAlert[] {
  if (hints.length === 0 || bars.length === 0) return [];
  const mark = entryPrice ?? bars[bars.length - 1]?.close;
  if (!mark || !Number.isFinite(mark) || mark <= 0) return [];

  const long = aggregateSide(hints, "long", mark, bars);
  const short = aggregateSide(hints, "short", mark, bars);

  if (!long && !short) return [];
  if (long && !short) return [long];
  if (short && !long) return [short];

  // Both sides — prefer stronger; show both only if nearly tied
  const a = long!;
  const b = short!;
  if (Math.abs(a.strength - b.strength) < 0.08) {
    return [a, b].sort((x, y) => y.strength - x.strength);
  }
  return [a.strength >= b.strength ? a : b];
}

/** Levels for an open paper position at its own entry (TP/SL hints). */
export function levelsForPosition(
  side: "buy" | "sell",
  positionEntry: number,
  bars: OhlcvBar[],
) {
  return computeRiskLevels(positionEntry, side, bars);
}
