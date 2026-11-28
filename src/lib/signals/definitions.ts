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
 * Live H1 desk defaults after YouTube TF-policy retest (pass11).
 * High-WR keep rule: floors + wr≥50% + n≥20 on the method's TF.
 * H1: RSI2 30/70 replaces fragile RSI9 20/80 (n=8); other H1 winners unchanged.
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
      // TF-policy pass11: RSI2 30/70 (wr~62% n=89) beats fragile RSI9 20/80 (n=8)
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
      // Rayner BB stretch: 2.5σ best high-WR on H1 (wr~72% n=47)
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
      // Rayner Donchian LB100 (H1); other TFs often fail wr floor
      enabled: true,
      params: { lookback: 100 },
    },
    {
      id: "consol_break",
      labelJa: "停滞ブレイク",
      enabled: true,
      // 迷晴れ fight-zone: window8 / ATR×1.5 on H1
      params: { window: 8, maxRangeAtr: 1.5, atrPeriod: 14 },
    },
    {
      id: "inside_bar_break",
      labelJa: "インサイドバーブレイク",
      enabled: true,
      // 水島/迷晴れ: SMA21 on H1
      params: { maPeriod: 21, maKind: "sma" },
    },
    {
      id: "bb_squeeze_break",
      labelJa: "BBスクイーズブレイク",
      enabled: true,
      // LB8 keeps best composite on H1 (LB12 hits wr=50% but lower score)
      params: { period: 20, mult: 2, lookback: 8 },
    },
    {
      id: "false_break",
      labelJa: "フェイクブレイク反転",
      enabled: true,
      // LB12 best high-WR on H1 (wr~66% n=133)
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
 * Per-interval packs from TF-policy retest (high-WR keeps).
 * Use `getRuleSetForInterval` when analyzing / enabling signals on a TF.
 */
export const RULE_SETS_BY_INTERVAL: Record<string, SignalRuleSet> = {
  // Desk/analysis H1
  "1h": DEFAULT_RULE_SET,
  "60m": DEFAULT_RULE_SET,
  // 5m: 水島 flag consol + BB±1σ + longer FB lookback
  "5m": overlayRuleSet(DEFAULT_RULE_SET, {
    bb_touch: { enabled: true, params: { period: 20, mult: 1 } },
    false_break: { enabled: true, params: { lookback: 50 } },
    consol_break: {
      enabled: true,
      params: { window: 6, maxRangeAtr: 1.2, atrPeriod: 14 },
    },
    // H1-tuned rules often fail wr on 5m
    swing_break: { enabled: false },
    inside_bar_break: { enabled: false },
    rsi_reversal: { enabled: false },
    ma_cross: { enabled: false },
    bb_squeeze_break: { enabled: false },
  }),
  // 15m: Oikawa M15 context — BB×1 + FB LB50
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
  // 30m: BB×1 + FB LB30
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
  // 4h: 迷晴れ/水島 H4 — BB×1.5 + FB LB16
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
  // 1d: BB×1 + FB LB14
  "1d": overlayRuleSet(DEFAULT_RULE_SET, {
    bb_touch: { enabled: true, params: { period: 20, mult: 1 } },
    false_break: { enabled: true, params: { lookback: 14 } },
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
