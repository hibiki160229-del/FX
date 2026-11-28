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

  // —— 5. クロユキFX（学習対象に含む） ——
  // 200SMA傾きで目線固定＋押し目；H1方向一致は単一足では近似
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
