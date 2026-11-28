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
 * Live H1 desk defaults after high-WR + positive-return prune (pass13).
 * Keep only: WR≥50% AND totalReturn>0 (trades≥4, MDD≤25%). Prefer n≥20.
 * BT window H1=1y Yahoo. DROPPED on 1y re-BT: RSI2 (loss), swing100 (WR36%),
 * consol8 (WR40%+loss), ma_cross / inside_bar / squeeze (prior).
 */
export const DEFAULT_RULE_SET: SignalRuleSet = {
  version: 1,
  pair: "USD/JPY",
  rules: [
    {
      id: "ma_cross",
      labelJa: "MAクロス",
      enabled: false,
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
      enabled: false,
      params: { period: 2, oversold: 30, overbought: 70 },
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
      params: { lookback: 100 },
    },
    {
      id: "consol_break",
      labelJa: "停滞ブレイク",
      enabled: false,
      params: { window: 8, maxRangeAtr: 1.5, atrPeriod: 14 },
    },
    {
      id: "inside_bar_break",
      labelJa: "インサイドバーブレイク",
      enabled: false,
      params: { maPeriod: 21, maKind: "sma" },
    },
    {
      id: "bb_squeeze_break",
      labelJa: "BBスクイーズブレイク",
      enabled: false,
      params: { period: 20, mult: 2, lookback: 8 },
    },
    {
      id: "false_break",
      labelJa: "フェイクブレイク反転",
      enabled: true,
      params: { lookback: 12 },
    },
  ],
};

function overlayRuleSet(
  base: SignalRuleSet,
  patches: Partial<
    Record<
      RuleId,
      { enabled?: boolean; params?: RuleParams[RuleId] }
    >
  >,
): SignalRuleSet {
  return {
    version: 1,
    pair: "USD/JPY",
    rules: base.rules.map((r) => {
      const p = patches[r.id];
      if (!p) return { ...r, params: { ...r.params } as never };
      return {
        ...r,
        enabled: p.enabled ?? r.enabled,
        params: (p.params ?? r.params) as never,
      };
    }),
  };
}

/**
 * Per-interval packs — only high-WR + positive-return keeps enabled.
 * Yahoo max windows used in BT: 1m≈7–8d, 5m/15m/30m=60d, 1h/4h≈1y, 1d=1y.
 */
export const RULE_SETS_BY_INTERVAL: Record<string, SignalRuleSet> = {
  "1h": DEFAULT_RULE_SET,
  "60m": DEFAULT_RULE_SET,
  // 1m: Yahoo caps ~7d. BB×1 + FB50 pass; consol6 DROPPED (WR40%).
  "1m": overlayRuleSet(DEFAULT_RULE_SET, {
    bb_touch: { enabled: true, params: { period: 20, mult: 1 } },
    false_break: { enabled: true, params: { lookback: 50 } },
    consol_break: {
      enabled: false,
      params: { window: 6, maxRangeAtr: 1.2, atrPeriod: 14 },
    },
  }),
  // 5m: 60d Yahoo max — BB±1σ + FB50 + consol flag
  "5m": overlayRuleSet(DEFAULT_RULE_SET, {
    bb_touch: { enabled: true, params: { period: 20, mult: 1 } },
    false_break: { enabled: true, params: { lookback: 50 } },
    consol_break: {
      enabled: true,
      params: { window: 6, maxRangeAtr: 1.2, atrPeriod: 14 },
    },
  }),
  // 15m: 60d — BB×1 + FB LB50
  "15m": overlayRuleSet(DEFAULT_RULE_SET, {
    bb_touch: { enabled: true, params: { period: 20, mult: 1 } },
    false_break: { enabled: true, params: { lookback: 50 } },
    swing_break: { enabled: false },
    inside_bar_break: { enabled: false },
    rsi_reversal: { enabled: false },
    ma_cross: { enabled: false },
    consol_break: { enabled: false },
    bb_squeeze_break: { enabled: false },
  }),
  // 30m: 60d — BB×1 + FB LB30
  "30m": overlayRuleSet(DEFAULT_RULE_SET, {
    bb_touch: { enabled: true, params: { period: 20, mult: 1 } },
    false_break: { enabled: true, params: { lookback: 30 } },
    swing_break: { enabled: false },
    inside_bar_break: { enabled: false },
    rsi_reversal: { enabled: false },
    ma_cross: { enabled: false },
    consol_break: { enabled: false },
    bb_squeeze_break: { enabled: false },
  }),
  // 4h: 1y H1 agg — BB×1.5 + FB LB16
  "4h": overlayRuleSet(DEFAULT_RULE_SET, {
    bb_touch: { enabled: true, params: { period: 20, mult: 1.5 } },
    false_break: { enabled: true, params: { lookback: 16 } },
    swing_break: { enabled: false },
    inside_bar_break: { enabled: false },
    rsi_reversal: { enabled: false },
    ma_cross: { enabled: false },
    consol_break: { enabled: false },
    bb_squeeze_break: { enabled: false },
  }),
  // 1d: 1y — BB×1 only (FB14 was loss under return floor)
  "1d": overlayRuleSet(DEFAULT_RULE_SET, {
    bb_touch: { enabled: true, params: { period: 20, mult: 1 } },
    false_break: { enabled: false, params: { lookback: 14 } },
    swing_break: { enabled: false },
    inside_bar_break: { enabled: false },
    rsi_reversal: { enabled: false },
    ma_cross: { enabled: false },
    consol_break: { enabled: false },
    bb_squeeze_break: { enabled: false },
  }),
};

/** Resolve rule pack for a Yahoo/OANDA interval string. */
export function getRuleSetForInterval(interval: string): SignalRuleSet {
  const key = interval === "60m" ? "1h" : interval;
  return RULE_SETS_BY_INTERVAL[key] ?? DEFAULT_RULE_SET;
}

export function getRule<K extends RuleId>(
  set: SignalRuleSet,
  id: K,
): RuleDefinition<K> | undefined {
  return set.rules.find((r) => r.id === id) as RuleDefinition<K> | undefined;
}
