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
      "ma_bounce",
      { period: 50, kind: "ema" },
      "Rayner Teo",
      "EMA50尊重押し（sWI9erEvABc / U0b1G2NoReg）",
    ),
    yt(
      "ma_bounce",
      { period: 50, kind: "sma" },
      "Rayner Teo",
      "SMA50尊重押し",
    ),
    yt(
      "ma_bounce",
      { period: 20, kind: "sma" },
      "Rayner Teo",
      "SMA20尊重フラッグ／ビルドアップ（bdh7Nnbi_oA）",
    ),
    yt(
      "ma_bounce",
      { period: 50, kind: "ema", trendPeriod: 200 },
      "Rayner Teo",
      "EMA50押し＋200トレンドフィルタ",
    ),
    yt(
      "ma_bounce",
      { period: 21, kind: "ema" },
      "水島 翔",
      "H1 21EMA目安（xJbcGrPSEF8 スキャル解説）",
    ),
    yt(
      "ma_bounce",
      { period: 21, kind: "sma" },
      "水島 翔",
      "SMA21（1_Jm1Z9ws1c MA講義・検証推奨）",
    ),
    yt(
      "ma_bounce",
      { period: 84, kind: "sma" },
      "水島 翔",
      "SMA84=上位足21相当（1_Jm1Z9ws1c）",
    ),
    yt(
      "ma_bounce",
      { period: 21, kind: "sma", trendPeriod: 84 },
      "水島 翔",
      "SMA21押し＋SMA84トレンド",
    ),
    yt(
      "ma_cross",
      { fast: 21, slow: 84 },
      "水島 翔",
      "SMA21/84ゴールデンクロス近似",
    ),
    yt(
      "consol_break",
      { window: 5, maxRangeAtr: 1.0, atrPeriod: 14 },
      "水島 翔",
      "5分レンジ抜け近似（xJbc / ZY0w 水平線＋実体抜け）",
    ),
    yt(
      "ma_bounce",
      { period: 20, kind: "sma" },
      "FXism 及川圭哉",
      "5分SMA20押し目（-cdkhy6roYM リオン式補助）",
    ),
    yt(
      "ma_bounce",
      { period: 75, kind: "sma" },
      "FXism 及川圭哉",
      "SMA75尊重（及川式・9k-zrrpumdw）",
    ),
    yt(
      "ma_bounce",
      { period: 25, kind: "sma" },
      "迷晴れ",
      "SMA25機能足アタッチ（w_lznnP0k24）",
    ),
    yt(
      "ma_bounce",
      { period: 25, kind: "sma", trendPeriod: 75 },
      "迷晴れ",
      "SMA25押し＋SMA75パーフェクトオーダー近似",
    ),
    yt(
      "ma_cross",
      { fast: 25, slow: 75 },
      "迷晴れ",
      "SMA25/75クロス（参考・遅延）",
    ),
    yt(
      "inside_bar_break",
      { maPeriod: 10, maKind: "sma" },
      "Rayner Teo",
      "インサイドバー→マザー抜け＋SMA10（N23YyEm9Mf4）",
    ),
    yt(
      "inside_bar_break",
      { maPeriod: 21, maKind: "sma" },
      "水島翔",
      "インサイドバー＋SMA21（TL合流・既定）",
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
      "bb_squeeze_break",
      { period: 20, mult: 2, lookback: 8 },
      "Rayner Teo",
      "BBスクイーズLB8（G_9gZS02xmA 迷晴れライフサイクル／4gUM ATR低ボラ対照）",
    ),
    yt(
      "bb_squeeze_break",
      { period: 20, mult: 2, lookback: 15 },
      "Rayner Teo",
      "BBスクイーズLB15対照",
    ),
    yt(
      "bb_touch",
      { period: 20, mult: 3 },
      "迷晴れ",
      "BB20×3σタッチ（G_9gZS02xmA・既定2.5優位）",
    ),
    yt(
      "consol_break",
      { window: 7, maxRangeAtr: 1.0, atrPeriod: 14 },
      "Rayner Teo",
      "ビルドアップ→ブレイク近似（xTd6nlbcIZc / _BBjCdVfRvU）",
    ),
    yt(
      "consol_break",
      { window: 10, maxRangeAtr: 1.0, atrPeriod: 14 },
      "Rayner Teo",
      "ビルドアップ≥10本（qgdsGbfN-So / dxWug-FsHo0 / eJOvSqcp_Jw）",
    ),
    yt(
      "consol_break",
      { window: 10, maxRangeAtr: 1.2, atrPeriod: 14 },
      "Rayner Teo",
      "ビルドアップ10本 ATR×1.2",
    ),
    yt(
      "swing_break",
      { lookback: 1 },
      "Rayner Teo",
      "前日高安ブレイク近似（jL0KRUEfFV4 platinum momentum）",
    ),
    yt(
      "swing_break",
      { lookback: 2 },
      "Rayner Teo",
      "直近2本高安ブレイク",
    ),
    yt(
      "swing_break",
      { lookback: 200 },
      "Rayner Teo",
      "Donchian200終値ブレイク近似（ggnIGZiDoFY futures trend）",
    ),
    yt(
      "swing_break",
      { lookback: 100 },
      "Rayner Teo",
      "Donchian100終値ブレイク近似",
    ),
    yt(
      "swing_break",
      { lookback: 55 },
      "Rayner Teo",
      "Donchian55終値ブレイク近似",
    ),
    yt(
      "macd_hist_flip",
      { fast: 12, slow: 26, signal: 9 },
      "Rayner Teo",
      "MACDヒスト転換トレンド確認（HUAALTnKyIM）",
    ),
    yt(
      "bb_touch",
      { period: 20, mult: 2.5, trendPeriod: 200 },
      "Rayner Teo",
      "BB2.5プルバック+200SMA（ybigcO913kc mean-rev・FX対照）",
    ),
    yt(
      "rsi_reversal",
      { period: 2, oversold: 10, overbought: 90 },
      "Rayner Teo",
      "Connors系 RSI2 極端帯（NheeZ94_Ajk mean-rev 対照・FX）",
    ),
    yt(
      "bb_touch",
      { period: 20, mult: 2.5, trendPeriod: 200 },
      "Rayner Teo",
      "BB20×2.5ストレッチ＋SMA200トレンド（CxFv_EUY0ZA株式系・FX対照）",
    ),
    yt(
      "bb_touch",
      { period: 20, mult: 2.5 },
      "Rayner Teo",
      "BB20×2.5ストレッチ単体（対照）",
    ),
    yt(
      "false_break",
      { lookback: 10 },
      "Rayner Teo",
      "フェイクブレイク反転 LB10（ScxDvXVX5yc / up0Emsq9MFg / GS3-fE94jvk）",
    ),
    yt(
      "false_break",
      { lookback: 20 },
      "Rayner Teo",
      "フェイクブレイク反転 LB20",
    ),
    yt(
      "false_break",
      { lookback: 12 },
      "Rayner Teo",
      "フェイクブレイク LB12（迷晴れ合戦跡 zSCh / Rion天井ピン QLri →既定）",
    ),
    yt(
      "false_break",
      { lookback: 20, trendPeriod: 20, trendKind: "sma" },
      "FXism",
      "天井ピン＋SMA20フィルタ対照（QLri・n=4 fragile）",
    ),
    yt(
      "false_break",
      { lookback: 10, trendPeriod: 50, trendKind: "sma" },
      "Rayner Teo",
      "フェイクブレイク＋SMA50トレンド（AoV合流）",
    ),
    yt(
      "false_break",
      { lookback: 10, trendPeriod: 20, trendKind: "sma" },
      "Rayner Teo",
      "フェイクブレイク＋SMA20強トレンド（15PaaZWXJr4）",
    ),
    yt(
      "ma_bounce",
      { period: 50, kind: "sma" },
      "Rayner Teo",
      "SMA50 AoV押し（ImxupRz_zQY）",
    ),
    yt(
      "swing_break",
      { lookback: 20 },
      "Rayner Teo",
      "強トレンド中ブレイク近似（15PaaZWXJr4 MA20ガイド対照）",
    ),
    yt(
      "ma_bounce",
      { period: 20, kind: "sma" },
      "Rayner Teo",
      "強トレンド=SMA20尊重の押し（PQxLrUZkZtY）",
    ),
    yt(
      "swing_break",
      { lookback: 12, trendPeriod: 20, trendKind: "sma" },
      "Rayner Teo",
      "強トレンド中のスイングブレイク＋SMA20近傍（PQxLr）",
    ),
    yt(
      "consol_break",
      { window: 5, maxRangeAtr: 1.0, atrPeriod: 14 },
      "Rayner Teo",
      "ダブルトップ/H&S等のビルドアップ抜け近似（DF9u / T5uZ）",
    ),
    yt(
      "consol_break",
      { window: 20, maxRangeAtr: 1.5, atrPeriod: 14 },
      "Rayner Teo",
      "ビルドアップ〜20本+20MA近似（OrGChv83PDI sniper）",
    ),
    yt(
      "consol_break",
      { window: 40, maxRangeAtr: 2.0, atrPeriod: 14 },
      "Rayner Teo",
      "ビルドアップ〜40本近似（OrGChv sniper）",
    ),
    yt(
      "consol_break",
      { window: 80, maxRangeAtr: 2.5, atrPeriod: 14 },
      "Rayner Teo",
      "ビルドアップ≥80本近似（OrGChv83PDI）",
    ),
    yt(
      "consol_break",
      { window: 20, maxRangeAtr: 1.2, atrPeriod: 14 },
      "Rayner Teo",
      "ビルドアップ20本 ATR×1.2（対照）",
    ),
    yt(
      "ma_bounce",
      { period: 20, kind: "ema" },
      "Rayner Teo",
      "初回押し目20EMA（OrGChv / 7dPta sniper pullback）",
    ),
    yt(
      "false_break",
      { lookback: 20, trendPeriod: 20, trendKind: "ema" },
      "Rayner Teo",
      "フェイクブレイク＋EMA20（OrGChv sniper合流）",
    ),
    yt(
      "rsi_reversal",
      { period: 14, oversold: 25, overbought: 80 },
      "FXism 及川圭哉",
      "RSI14 25/80（ahxEp95OjPo・ワイルダー70失敗回避）",
    ),
    yt(
      "ma_bounce",
      { period: 5, kind: "sma" },
      "Rayner Teo",
      "MAブレイク＝終値でSMA5超え（5PPwegRoBmY 押し目エントリトリガ）",
    ),
    yt(
      "ma_bounce",
      { period: 5, kind: "sma", trendPeriod: 50 },
      "Rayner Teo",
      "SMA5ブレイク＋SMA50トレンド（5PPweg / npNgx AoV）",
    ),
    yt(
      "ma_bounce",
      { period: 5, kind: "sma", trendPeriod: 200 },
      "Rayner Teo",
      "SMA5ブレイク＋SMA200フィルタ",
    ),
    yt(
      "swing_break",
      { lookback: 20 },
      "Rayner Teo",
      "Donchian20上下バンド終値ブレイク（rAVEsHLnr9o）",
    ),
    yt(
      "ma_bounce",
      { period: 100, kind: "sma" },
      "Rayner Teo",
      "弱トレンド深い押し＝SMA100 AoV（x95peuh08P4）",
    ),
    yt(
      "ma_bounce",
      { period: 100, kind: "ema" },
      "Rayner Teo",
      "弱トレンド深い押し＝EMA100 AoV",
    ),
    yt(
      "ma_bounce",
      { period: 20, kind: "ema", trendPeriod: 50 },
      "Rayner Teo",
      "強トレンド20EMA押し＋50EMA方向（KGSdkf / hvjOEWm）",
    ),
    yt(
      "ma_cross",
      { fast: 20, slow: 100 },
      "Rayner Teo",
      "SMA20/100 短期×中期（EbFUuSmuhVs トレンド定義）",
    ),
    yt(
      "ma_cross",
      { fast: 100, slow: 200 },
      "Rayner Teo",
      "SMA100/200 中期×長期（EbFUu）",
    ),
    yt(
      "ema_cross",
      { fast: 20, slow: 50 },
      "Rayner Teo",
      "EMA20/50 トレンド終焉・収縮（wYSyCuM72i0）",
    ),
    yt(
      "swing_break",
      { lookback: 20, trendPeriod: 100, trendKind: "sma" },
      "Rayner Teo",
      "Donchian20＋SMA100フィルタ",
    ),
    yt(
      "false_break",
      { lookback: 20, trendPeriod: 50, trendKind: "ema" },
      "Rayner Teo",
      "フェイクブレイク＋EMA50（wYSy / hvjOE）",
    ),
    yt(
      "ma_cross",
      { fast: 5, slow: 25 },
      "JIN FX",
      "SMA5/25ゴールデンクロス（nIYCWAlghhE TradingView応用）",
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
      "consol_break",
      { window: 8, maxRangeAtr: 1.5, atrPeriod: 14 },
      "迷晴れ",
      "小競り合い（fight-zone）後ブレイク近似（sfR6qoGVOso）→既定",
    ),
    yt(
      "consol_break",
      { window: 8, maxRangeAtr: 1.2, atrPeriod: 14 },
      "迷晴れ",
      "fight-zone 8本 ATR×1.2（n=4 fragile・DROP promote）",
    ),
    yt(
      "bb_touch",
      { period: 21, mult: 3 },
      "JIN",
      "JFX小林 BB21×3σ利確/逆張り（eQdSM・既定2.5優位）",
    ),
    yt(
      "ma_cross",
      { fast: 5, slow: 21 },
      "JIN",
      "JFX 5/21角度クロス（eQdSM・DROP wr32%）",
    ),
    yt(
      "bb_touch",
      { period: 20, mult: 2 },
      "FXism",
      "佐藤 BB20×2σ close突破トレンドフォロー（HlhPF・対照・既定2.5 mean-rev）",
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
