/**
 * Serializable rule definitions.
 * A later optimizer / learner can swap `params` or promote new rule ids
 * without touching the chart or paper broker.
 */

export type RuleId =
  | "ma_cross"
  | "ema_cross"
  | "rsi_reversal"
  | "macd_hist_flip"
  | "bb_touch";

export type RuleParams = {
  ma_cross: { fast: number; slow: number };
  ema_cross: { fast: number; slow: number };
  rsi_reversal: { period: number; oversold: number; overbought: number };
  macd_hist_flip: { fast: number; slow: number; signal: number };
  bb_touch: { period: number; mult: number };
};

export type RuleDefinition<K extends RuleId = RuleId> = {
  id: K;
  /** Human label (JA) — UI only; logic keys off `id`. */
  labelJa: string;
  enabled: boolean;
  params: RuleParams[K];
};

export type SignalRuleSet = {
  version: 1;
  pair: "USD/JPY";
  rules: RuleDefinition[];
};

export const DEFAULT_RULE_SET: SignalRuleSet = {
  version: 1,
  pair: "USD/JPY",
  rules: [
    {
      id: "ma_cross",
      labelJa: "MAクロス",
      enabled: true,
      params: { fast: 20, slow: 50 },
    },
    {
      id: "ema_cross",
      labelJa: "EMAクロス",
      enabled: true,
      params: { fast: 12, slow: 26 },
    },
    {
      id: "rsi_reversal",
      labelJa: "RSI反転",
      enabled: true,
      params: { period: 14, oversold: 30, overbought: 70 },
    },
    {
      id: "macd_hist_flip",
      labelJa: "MACDヒストグラム転換",
      enabled: true,
      params: { fast: 12, slow: 26, signal: 9 },
    },
    {
      id: "bb_touch",
      labelJa: "ボリンジャー接触",
      enabled: true,
      params: { period: 20, mult: 2 },
    },
  ],
};

export function getRule<K extends RuleId>(
  set: SignalRuleSet,
  id: K,
): RuleDefinition<K> | undefined {
  return set.rules.find((r) => r.id === id) as RuleDefinition<K> | undefined;
}
