import type { RuleId, RuleParams } from "@/lib/signals";
import { dedupe, LABELS } from "./seeds";
import type { RuleCandidate } from "./types";

/**
 * First-batch YouTube / companion-blog candidates from the six learning channels.
 * Maps concrete TA (periods, oscillators) onto serializable RuleIds.
 * Discretionary-only methods (pure S/R / Dow without indicators) are omitted here
 * and documented in docs/ta-channel-notes.md as drop-for-encoding.
 */
function yt<K extends RuleId>(
  ruleId: K,
  params: RuleParams[K],
  channel: string,
  note: string,
): RuleCandidate {
  return {
    id: `${ruleId}:${JSON.stringify(params)}`,
    ruleId,
    labelJa: LABELS[ruleId],
    params,
    source: "youtube",
    channel,
    note,
  };
}

export function youtubeCandidates(): RuleCandidate[] {
  const out: RuleCandidate[] = [];

  // —— 1. Rayner Teo (TradingwithRayner) ——
  // 200 EMA trend + 50 EMA value bounce; 20 EMA first-pullback; RSI confluence
  out.push(
    yt(
      "ma_bounce",
      { period: 50, kind: "ema", trendPeriod: 200 },
      "Rayner Teo",
      "200EMAトレンド＋50EMA押し目バウンス",
    ),
    yt(
      "ma_bounce",
      { period: 20, kind: "ema", trendPeriod: 200 },
      "Rayner Teo",
      "200EMAトレンド＋20EMA初回押し目",
    ),
    yt(
      "ma_bounce",
      { period: 50, kind: "ema" },
      "Rayner Teo",
      "50EMAエリア・オブ・バリュー（トレンドフィルタなし）",
    ),
    yt(
      "ema_cross",
      { fast: 20, slow: 50 },
      "Rayner Teo",
      "EMA20/50 短期モメンタム",
    ),
    yt(
      "ema_cross",
      { fast: 50, slow: 200 },
      "Rayner Teo",
      "EMA50/200 長期トレンド転換",
    ),
    yt(
      "rsi_reversal",
      { period: 14, oversold: 30, overbought: 70 },
      "Rayner Teo",
      "RSI30/70 合流（レンジ寄り）",
    ),
    yt(
      "rsi_reversal",
      { period: 10, oversold: 30, overbought: 70 },
      "Rayner Teo",
      "Connors系 RSI10<30 プルバック近似（W8ENI; 株式向け・FX対照）",
    ),
    yt(
      "ma_bounce",
      { period: 20, kind: "sma", trendPeriod: 200 },
      "Rayner Teo",
      "BB中帯=SMA20押し目＋200トレンド（KxlUFKPCxeg）",
    ),
    yt(
      "ma_bounce",
      { period: 10, kind: "sma" },
      "Rayner Teo",
      "SMA10尊重トレンド（インサイドバー動画のMAフィルタ）",
    ),
    yt(
      "inside_bar_break",
      { maPeriod: 10, maKind: "sma" },
      "Rayner Teo",
      "インサイドバー→マザー抜け＋SMA10（N23YyEm9Mf4）",
    ),
    yt(
      "inside_bar_break",
      {},
      "Rayner Teo",
      "インサイドバー単体ブレイク（対照）",
    ),
    yt(
      "bb_squeeze_break",
      { period: 20, mult: 2, lookback: 20 },
      "Rayner Teo",
      "BBスクイーズ後ブレイク（KxlUFKPCxeg）",
    ),
    yt(
      "bb_squeeze_break",
      { period: 20, mult: 2, lookback: 12 },
      "Rayner Teo",
      "BBスクイーズ短めLB12",
    ),
    yt(
      "consol_break",
      { window: 7, maxRangeAtr: 1.0, atrPeriod: 14 },
      "Rayner Teo",
      "ビルドアップ→ブレイク近似（xTd6nlbcIZc / _BBjCdVfRvU）",
    ),
  );

  // —— 2. オレ的ゲーム速報JIN FX ——
  // 200日MA中心；RSI+MACDクロスは確認用。ファンダ主体のため指標は控えめ
  out.push(
    yt(
      "ma_cross",
      { fast: 50, slow: 200 },
      "JIN FX",
      "200日MA中心のスイング（50/200クロス近似）",
    ),
    yt(
      "ma_bounce",
      { period: 200, kind: "sma" },
      "JIN FX",
      "200SMAタッチ反発",
    ),
    yt(
      "macd_hist_flip",
      { fast: 12, slow: 26, signal: 9 },
      "JIN FX",
      "MACDヒスト転換（デッド/ゴールデン確認）",
    ),
    yt(
      "rsi_reversal",
      { period: 14, oversold: 30, overbought: 70 },
      "JIN FX",
      "RSI反転確認",
    ),
  );

  // —— 3. 水島 翔 ——
  // 水平線・ダウ・MTFが主。インジはほぼ使わない → 近似のみ
  out.push(
    yt(
      "bb_touch",
      { period: 20, mult: 2 },
      "水島 翔",
      "レンジ端近似（水平線ブレイクの代理・弱）",
    ),
    yt(
      "ma_cross",
      { fast: 20, slow: 60 },
      "水島 翔",
      "上位足方向の粗いトレンド代理",
    ),
    yt(
      "ema_cross",
      { fast: 12, slow: 48 },
      "水島 翔",
      "MTF方向の粗いEMA代理",
    ),
  );

  // —— 4. FXism 及川圭哉 ——
  // SMA5/12/20、75、BB基準20、パーフェクトオーダー近似
  out.push(
    yt(
      "ma_cross",
      { fast: 5, slow: 20 },
      "FXism 及川圭哉",
      "5SMA/20SMA（BB基準線）クロス",
    ),
    yt(
      "ma_cross",
      { fast: 5, slow: 12 },
      "FXism 及川圭哉",
      "5/12SMA 短期信号機",
    ),
    yt(
      "ma_cross",
      { fast: 12, slow: 75 },
      "FXism 及川圭哉",
      "12/75SMA 中期クロス",
    ),
    yt(
      "ma_cross",
      { fast: 20, slow: 75 },
      "FXism 及川圭哉",
      "20/75SMA 並び・PO近似",
    ),
    yt(
      "ma_bounce",
      { period: 20, kind: "sma", trendPeriod: 75 },
      "FXism 及川圭哉",
      "20SMA押し＋75SMA方向",
    ),
    yt(
      "ma_bounce",
      { period: 10, kind: "sma" },
      "FXism 及川圭哉",
      "10SMA（MTF短縮）押し戻り",
    ),
    yt(
      "bb_touch",
      { period: 20, mult: 2 },
      "FXism 及川圭哉",
      "ボリンジャー±2σ（基準線20）",
    ),
  );

  // —— 5. クロユキFX（full-watch pass extracts） ——
  // 200SMA傾きで目線固定＋押し目；スイングブレイク；停滞抜け
  out.push(
    yt(
      "ma_bounce",
      { period: 200, kind: "sma" },
      "クロユキFX",
      "200SMA傾き順張り・押し戻りバウンス",
    ),
    yt(
      "ma_bounce",
      { period: 20, kind: "sma", trendPeriod: 200 },
      "クロユキFX",
      "200SMA目線＋20SMA押し目",
    ),
    yt(
      "ma_bounce",
      { period: 50, kind: "sma", trendPeriod: 200 },
      "クロユキFX",
      "200SMA目線＋50SMA押し目",
    ),
    yt(
      "ma_cross",
      { fast: 20, slow: 200 },
      "クロユキFX",
      "20/200SMA 方向一致近似",
    ),
    yt(
      "ma_cross",
      { fast: 50, slow: 200 },
      "クロユキFX",
      "50/200SMA グランビル近似",
    ),
    yt(
      "swing_break",
      { lookback: 20, trendPeriod: 200, trendKind: "sma" },
      "クロユキFX",
      "押し安値/戻り高値ブレイク＋200SMA傾きフィルタ（ZOM9y/gUU56）",
    ),
    yt(
      "swing_break",
      { lookback: 12, trendPeriod: 200, trendKind: "sma" },
      "クロユキFX",
      "短めスイングブレイク＋200SMA（fyWBG スイングハイロー近似）",
    ),
    yt(
      "swing_break",
      { lookback: 20 },
      "クロユキFX",
      "スイングブレイク単体（傾きフィルタなし・対照）",
    ),
    yt(
      "swing_break",
      { lookback: 55, trendPeriod: 200, trendKind: "sma" },
      "クロユキFX",
      "広めスイング（4H相当のH1近似）＋200SMA",
    ),
    yt(
      "consol_break",
      { window: 5, maxRangeAtr: 1.2, atrPeriod: 14 },
      "クロユキFX",
      "停滞≥5本→実体抜け（GPDEm スキャル近似・H1）",
    ),
    yt(
      "consol_break",
      { window: 7, maxRangeAtr: 1.0, atrPeriod: 14 },
      "クロユキFX",
      "停滞7本・よりタイトなレンジ抜け",
    ),
    yt(
      "consol_break",
      { window: 5, maxRangeAtr: 1.5, atrPeriod: 14 },
      "クロユキFX",
      "停滞5本・緩めATR許容",
    ),
    yt(
      "ma_bounce",
      { period: 200, kind: "sma", trendPeriod: 200 },
      "クロユキFX",
      "200SMAタッチ＋傾き（DaHHu 目線必須のバウンス）",
    ),
    yt(
      "ma_bounce",
      { period: 200, kind: "ema", trendPeriod: 20 },
      "クロユキFX",
      "200W近似: H1 20EMA方向＋M1 200EMA付近（H1上で近似）",
    ),
    yt(
      "rsi_reversal",
      { period: 9, oversold: 30, overbought: 70 },
      "クロユキFX",
      "RSI9 トリプル/耳パターン近似（30/70帯）",
    ),
    yt(
      "rsi_reversal",
      { period: 9, oversold: 20, overbought: 80 },
      "クロユキFX",
      "RSI9 深め帯（20/80）",
    ),
  );

  // —— 6. 迷晴れFX ——
  // 環境認識＋レジサポ主体；20SMAランデブー、乖離警戒
  out.push(
    yt(
      "ma_bounce",
      { period: 20, kind: "sma" },
      "迷晴れFX",
      "20SMAランデブー（押し戻りタイミング）",
    ),
    yt(
      "ma_bounce",
      { period: 20, kind: "sma", trendPeriod: 75 },
      "迷晴れFX",
      "20SMA＋上位75近似の環境フィルタ",
    ),
    yt(
      "ma_cross",
      { fast: 20, slow: 75 },
      "迷晴れFX",
      "20/75SMA 環境の向き",
    ),
    yt(
      "rsi_reversal",
      { period: 14, oversold: 30, overbought: 70 },
      "迷晴れFX",
      "RSIは補助（環境優先の合流）",
    ),
    yt(
      "bb_touch",
      { period: 20, mult: 2 },
      "迷晴れFX",
      "端っこ警戒の代理（レンジ端）",
    ),
  );

  return dedupe(out);
}
