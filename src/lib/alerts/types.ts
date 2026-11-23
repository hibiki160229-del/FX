import type { SignalSide } from "@/lib/types";

export type EntrySide = Exclude<SignalSide, "neutral">;

export type LevelsMethod = "atr" | "pct";

/** Suggested entry with take-profit / stop-loss from active TA signals. */
export type EntryAlert = {
  /** Stable fingerprint for dedupe (side + bar + contributing signals). */
  id: string;
  side: EntrySide;
  labelJa: "買い" | "売り";
  title: string;
  reasons: string[];
  signalIds: string[];
  strength: number;
  entryPrice: number;
  takeProfit: number;
  stopLoss: number;
  /** Distance to SL in price units (1R). */
  risk: number;
  /** Reward / risk (TP distance ÷ SL distance). */
  rewardR: number;
  atr: number | null;
  method: LevelsMethod;
  /** Unix seconds of the bar that produced the signals. */
  at: number;
};

export type RiskLevels = {
  takeProfit: number;
  stopLoss: number;
  risk: number;
  rewardR: number;
  atr: number | null;
  method: LevelsMethod;
};

/** Same fingerprint / side: suppress toast+Notification (panel still updates). */
export const ENTRY_ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 min — near-realtime anti-spam
export const ATR_PERIOD = 14;
export const ATR_SL_MULT = 1.5;
export const ATR_TP_MULT = 3; // 2R vs 1.5 ATR SL
export const PCT_SL = 0.003; // 0.3%
export const PCT_TP = 0.006; // 0.6% → 2R
/** Minimum combined strength to surface an entry alert. */
export const MIN_ENTRY_STRENGTH = 0.55;
