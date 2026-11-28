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
  | "bb_touch"
  | "ma_bounce";

export type RuleParams = {
  ma_cross: { fast: number; slow: number };
  ema_cross: { fast: number; slow: number };
  rsi_reversal: { period: number; oversold: number; overbought: number };
  macd_hist_flip: { fast: number; slow: number; signal: number };
  bb_touch: { period: number; mult: number };
  /**
   * Pullback-to-MA bounce (Rayner / クロユキ / 迷晴れ / 及川).
   * Optional `trendPeriod` filters with a slower MA (price on trend side + slope).
   */
  ma_bounce: {
    period: number;
    kind: "sma" | "ema";
    trendPeriod?: number;
  };
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

/**
 * Live defaults after YouTube first-batch backtest (USD/JPY 6mo 1h).
 * Winners promoted: FXism MA5/12, Rayner RSI14 30/70, 水島/共有 BB20×2.
 * ema_cross / macd / ma_bounce stay in the catalog but disabled until a
 * later analysis pass promotes a floor-passing variant.
 */
export const DEFAULT_RULE_SET: SignalRuleSet = {
  version: 1,
  pair: "USD/JPY",
  rules: [
    {
      id: "ma_cross",
      labelJa: "MAクロス",
      enabled: true,
      params: { fast: 5, slow: 12 },
    },
    {
      id: "ema_cross",
      labelJa: "EMAクロス",
      enabled: false,
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
      enabled: false,
      params: { fast: 12, slow: 26, signal: 9 },
    },
    {
      id: "bb_touch",
      labelJa: "ボリンジャー接触",
      enabled: true,
      params: { period: 20, mult: 2 },
    },
    {
      id: "ma_bounce",
      labelJa: "MA押し目バウンス",
      enabled: false,
      params: { period: 50, kind: "ema", trendPeriod: 200 },
    },
  ],
};

export function getRule<K extends RuleId>(
  set: SignalRuleSet,
  id: K,
): RuleDefinition<K> | undefined {
  return set.rules.find((r) => r.id === id) as RuleDefinition<K> | undefined;
}
