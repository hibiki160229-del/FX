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
  | "ma_bounce"
  | "swing_break"
  | "consol_break"
  | "inside_bar_break"
  | "bb_squeeze_break"
  | "false_break";

export type RuleParams = {
  ma_cross: { fast: number; slow: number };
  ema_cross: { fast: number; slow: number };
  rsi_reversal: { period: number; oversold: number; overbought: number };
  macd_hist_flip: { fast: number; slow: number; signal: number };
  /**
   * Touch/close beyond BB band. Optional `trendPeriod` (Rayner BB stretch /
   * Connors-style: only long below lower band when price above slow SMA).
   */
  bb_touch: { period: number; mult: number; trendPeriod?: number };
  /**
   * Pullback-to-MA bounce (Rayner / クロユキ / 迷晴れ / 及川).
   * Optional `trendPeriod` filters with a slower MA (price on trend side + slope).
   */
  ma_bounce: {
    period: number;
    kind: "sma" | "ema";
    trendPeriod?: number;
  };
  /**
   * Structure: close breaks N-bar swing high/low (押し安値/戻り高値近似).
   * Optional slow MA slope filter (クロユキ 200SMA 目線).
   */
  swing_break: {
    lookback: number;
    trendPeriod?: number;
    trendKind?: "sma" | "ema";
  };
  /**
   * Structure: tight consolidation then body breakout (クロユキ 停滞→抜け).
   * `window` bars' high-low range must be ≤ `maxRangeAtr` × ATR before break.
   */
  consol_break: {
    window: number;
    maxRangeAtr: number;
    atrPeriod: number;
  };
  /**
   * Rayner inside-bar: bar[-1] contained in mother bar[-2], then close breaks
   * mother high/low. Optional fast MA filter (price respecting SMA10 in trend).
   */
  inside_bar_break: {
    maPeriod?: number;
    maKind?: "sma" | "ema";
  };
  /**
   * Rayner Bollinger squeeze → breakout: prior bar BB width is lookback minimum,
   * then close breaks the squeeze-window high/low.
   */
  bb_squeeze_break: {
    period: number;
    mult: number;
    lookback: number;
  };
  /**
   * Rayner false break / trapped traders: pierce prior swing high/low then
   * close back inside (rejection reclaim). Optional slow MA trend filter.
   */
  false_break: {
    lookback: number;
    trendPeriod?: number;
    trendKind?: "sma" | "ema";
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
 * Live defaults after YouTube full-watch pass (クロユキ deep + Rayner slices).
 * Winners: FXism MA5/12, クロユキ RSI9 20/80,
 * クロユキ consol_break 5/1.2, Rayner bb_squeeze_break 20×2/LB12,
 * Rayner inside_bar_break + SMA10, Rayner bb_touch 20×2.5,
 * Rayner false_break LB20.
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
      params: { period: 9, oversold: 20, overbought: 80 },
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
      // Rayner BB stretch (CxFv): 2.5σ beats prior 水島 2.0 on H1 floors
      params: { period: 20, mult: 2.5 },
    },
    {
      id: "ma_bounce",
      labelJa: "MA押し目バウンス",
      enabled: false,
      params: { period: 50, kind: "ema", trendPeriod: 200 },
    },
    {
      id: "swing_break",
      labelJa: "スイングブレイク",
      enabled: false,
      params: { lookback: 20, trendPeriod: 200, trendKind: "sma" },
    },
    {
      id: "consol_break",
      labelJa: "停滞ブレイク",
      enabled: true,
      params: { window: 5, maxRangeAtr: 1.2, atrPeriod: 14 },
    },
    {
      id: "inside_bar_break",
      labelJa: "インサイドバーブレイク",
      enabled: true,
      params: { maPeriod: 10, maKind: "sma" },
    },
    {
      id: "bb_squeeze_break",
      labelJa: "BBスクイーズブレイク",
      enabled: true,
      params: { period: 20, mult: 2, lookback: 12 },
    },
    {
      id: "false_break",
      labelJa: "フェイクブレイク反転",
      enabled: true,
      // Rayner false break / trapped traders (ScxDv / up0Em / GS3-f)
      params: { lookback: 20 },
    },
  ],
};

export function getRule<K extends RuleId>(
  set: SignalRuleSet,
  id: K,
): RuleDefinition<K> | undefined {
  return set.rules.find((r) => r.id === id) as RuleDefinition<K> | undefined;
}
