import { atr, bollinger, ema, macd, rsi, sma } from "@/lib/indicators";
import type { OhlcvBar, SignalHint } from "@/lib/types";
import {
  DEFAULT_RULE_SET,
  getRule,
  type SignalRuleSet,
} from "./definitions";

/**
 * Pure rule-based signal engine.
 * Pass a serializable `SignalRuleSet` (params / enabled flags) so a later
 * learner can swap parameters or promote rules without rewriting chart/broker.
 */
export function evaluateSignals(
  bars: OhlcvBar[],
  ruleSet: SignalRuleSet = DEFAULT_RULE_SET,
): SignalHint[] {
  if (bars.length < 40) return [];

  const i = bars.length - 1;
  const prev = i - 1;
  const hints: SignalHint[] = [];
  const close = bars[i].close;
  const at = bars[i].time;

  const maRule = getRule(ruleSet, "ma_cross");
  if (maRule?.enabled) {
    const { fast, slow } = maRule.params;
    const maFast = sma(bars, fast);
    const maSlow = sma(bars, slow);
    if (
      maFast[i] != null &&
      maSlow[i] != null &&
      maFast[prev] != null &&
      maSlow[prev] != null
    ) {
      const crossedUp =
        (maFast[prev] as number) <= (maSlow[prev] as number) &&
        (maFast[i] as number) > (maSlow[i] as number);
      const crossedDown =
        (maFast[prev] as number) >= (maSlow[prev] as number) &&
        (maFast[i] as number) < (maSlow[i] as number);

      if (crossedUp) {
        hints.push({
          id: "ma-golden",
          side: "long",
          title: "MA ゴールデンクロス",
          reason: `短期移動平均（${fast}）が長期（${slow}）を上抜けました。上昇トレンドの初動として買い優勢とみます。`,
          strength: 0.75,
          at,
        });
      }
      if (crossedDown) {
        hints.push({
          id: "ma-death",
          side: "short",
          title: "MA デッドクロス",
          reason: `短期移動平均（${fast}）が長期（${slow}）を下抜けました。下落トレンドの初動として売り優勢とみます。`,
          strength: 0.75,
          at,
        });
      }
    }
  }

  const emaRule = getRule(ruleSet, "ema_cross");
  if (emaRule?.enabled) {
    const { fast, slow } = emaRule.params;
    const eFast = ema(bars, fast);
    const eSlow = ema(bars, slow);
    if (
      eFast[i] != null &&
      eSlow[i] != null &&
      eFast[prev] != null &&
      eSlow[prev] != null
    ) {
      if (
        (eFast[prev] as number) <= (eSlow[prev] as number) &&
        (eFast[i] as number) > (eSlow[i] as number)
      ) {
        hints.push({
          id: "ema-bull",
          side: "long",
          title: "EMA 上昇クロス",
          reason: `EMA${fast} が EMA${slow} を上抜け。短期のモメンタムが強まっており、押し目買いを検討する局面です。`,
          strength: 0.65,
          at,
        });
      }
      if (
        (eFast[prev] as number) >= (eSlow[prev] as number) &&
        (eFast[i] as number) < (eSlow[i] as number)
      ) {
        hints.push({
          id: "ema-bear",
          side: "short",
          title: "EMA 下落クロス",
          reason: `EMA${fast} が EMA${slow} を下抜け。短期の勢いが弱まり、戻り売りを検討する局面です。`,
          strength: 0.65,
          at,
        });
      }
    }
  }

  const rsiRule = getRule(ruleSet, "rsi_reversal");
  if (rsiRule?.enabled) {
    const { period, oversold, overbought } = rsiRule.params;
    const rsiSeries = rsi(bars, period);
    if (rsiSeries[i] != null && rsiSeries[prev] != null) {
      const r = rsiSeries[i] as number;
      const rp = rsiSeries[prev] as number;
      if (r < oversold && r > rp) {
        hints.push({
          id: "rsi-oversold",
          side: "long",
          title: "RSI 売られすぎ反転",
          reason: `RSI が ${r.toFixed(1)} と売られすぎ圏（${oversold}）から上向きに転じました。反発ロングのヒントです。`,
          strength: 0.7,
          at,
        });
      }
      if (r > overbought && r < rp) {
        hints.push({
          id: "rsi-overbought",
          side: "short",
          title: "RSI 買われすぎ反転",
          reason: `RSI が ${r.toFixed(1)} と買われすぎ圏（${overbought}）から下向きに転じました。調整ショートのヒントです。`,
          strength: 0.7,
          at,
        });
      }
    }
  }

  const macdRule = getRule(ruleSet, "macd_hist_flip");
  if (macdRule?.enabled) {
    const { fast, slow, signal } = macdRule.params;
    const macdSeries = macd(bars, fast, slow, signal);
    const h = macdSeries[i].histogram;
    const hp = macdSeries[prev].histogram;
    if (h != null && hp != null) {
      if (hp <= 0 && h > 0) {
        hints.push({
          id: "macd-bull",
          side: "long",
          title: "MACD ヒストグラム転換（陽転）",
          reason:
            "MACD ヒストグラムがマイナスからプラスへ転換。買いモメンタムの回復を示唆します。",
          strength: 0.72,
          at,
        });
      }
      if (hp >= 0 && h < 0) {
        hints.push({
          id: "macd-bear",
          side: "short",
          title: "MACD ヒストグラム転換（陰転）",
          reason:
            "MACD ヒストグラムがプラスからマイナスへ転換。売りモメンタムの強まりを示唆します。",
          strength: 0.72,
          at,
        });
      }
    }
  }

  const bbRule = getRule(ruleSet, "bb_touch");
  if (bbRule?.enabled) {
    const { period, mult } = bbRule.params;
    const bb = bollinger(bars, period, mult);
    if (bb[i].lower != null && bb[i].upper != null) {
      if (close <= (bb[i].lower as number)) {
        hints.push({
          id: "bb-lower",
          side: "long",
          title: "ボリンジャー下バンド接触",
          reason:
            "終値が下バンド付近。短期的な割安・バウンスを意識したロング検討のヒントです。",
          strength: 0.55,
          at,
        });
      }
      if (close >= (bb[i].upper as number)) {
        hints.push({
          id: "bb-upper",
          side: "short",
          title: "ボリンジャー上バンド接触",
          reason:
            "終値が上バンド付近。短期的な過熱・戻りを意識したショート検討のヒントです。",
          strength: 0.55,
          at,
        });
      }
    }
  }

  const bounceRule = getRule(ruleSet, "ma_bounce");
  if (bounceRule?.enabled) {
    const { period, kind, trendPeriod } = bounceRule.params;
    const series = kind === "ema" ? ema(bars, period) : sma(bars, period);
    const ma = series[i];
    const maPrev = series[prev];
    if (ma != null && maPrev != null) {
      const low = bars[i].low;
      const high = bars[i].high;
      const prevClose = bars[prev].close;
      let trendOkLong = true;
      let trendOkShort = true;
      if (trendPeriod && trendPeriod > period) {
        const trend =
          kind === "ema" ? ema(bars, trendPeriod) : sma(bars, trendPeriod);
        const t = trend[i];
        const tPrev = trend[Math.max(0, i - 5)];
        if (t == null || tPrev == null) {
          trendOkLong = false;
          trendOkShort = false;
        } else {
          const slopingUp = t > tPrev;
          const slopingDown = t < tPrev;
          trendOkLong = close >= t && slopingUp;
          trendOkShort = close <= t && slopingDown;
        }
      }
      // Bounce: wick into MA then close back on trend side
      if (
        trendOkLong &&
        low <= (ma as number) &&
        close > (ma as number) &&
        prevClose <= (maPrev as number) * 1.001
      ) {
        hints.push({
          id: "ma-bounce-long",
          side: "long",
          title: "MA押し目バウンス",
          reason: `${kind.toUpperCase()}${period} への押し目から終値が上抜け。トレンド方向の押し目買いヒントです。`,
          strength: 0.78,
          at,
        });
      }
      if (
        trendOkShort &&
        high >= (ma as number) &&
        close < (ma as number) &&
        prevClose >= (maPrev as number) * 0.999
      ) {
        hints.push({
          id: "ma-bounce-short",
          side: "short",
          title: "MA戻りバウンス",
          reason: `${kind.toUpperCase()}${period} への戻りから終値が下抜け。トレンド方向の戻り売りヒントです。`,
          strength: 0.78,
          at,
        });
      }
    }
  }

  const swingRule = getRule(ruleSet, "swing_break");
  if (swingRule?.enabled) {
    const { lookback, trendPeriod, trendKind } = swingRule.params;
    if (i >= lookback + 1) {
      let priorHigh = -Infinity;
      let priorLow = Infinity;
      for (let j = i - lookback; j < i; j++) {
        if (bars[j].high > priorHigh) priorHigh = bars[j].high;
        if (bars[j].low < priorLow) priorLow = bars[j].low;
      }
      const prevClose = bars[prev].close;
      let trendOkLong = true;
      let trendOkShort = true;
      if (trendPeriod && trendPeriod > 0) {
        const kind = trendKind ?? "sma";
        const trend =
          kind === "ema" ? ema(bars, trendPeriod) : sma(bars, trendPeriod);
        const t = trend[i];
        const tPrev = trend[Math.max(0, i - 5)];
        if (t == null || tPrev == null) {
          trendOkLong = false;
          trendOkShort = false;
        } else {
          const flatTol = Math.abs(t) * 1e-5;
          if (Math.abs(t - tPrev) < flatTol) {
            trendOkLong = false;
            trendOkShort = false;
          } else {
            trendOkLong = close >= t && t > tPrev;
            trendOkShort = close <= t && t < tPrev;
          }
        }
      }
      if (trendOkLong && prevClose <= priorHigh && close > priorHigh) {
        hints.push({
          id: "swing-break-long",
          side: "long",
          title: "スイング高値ブレイク",
          reason: `直近${lookback}本の高値を終値で上抜け。押し安値／戻り高値構造の順張りブレイク近似です。`,
          strength: 0.8,
          at,
        });
      }
      if (trendOkShort && prevClose >= priorLow && close < priorLow) {
        hints.push({
          id: "swing-break-short",
          side: "short",
          title: "スイング安値ブレイク",
          reason: `直近${lookback}本の安値を終値で下抜け。押し安値ブレイク後の順張り近似です。`,
          strength: 0.8,
          at,
        });
      }
    }
  }

  const consolRule = getRule(ruleSet, "consol_break");
  if (consolRule?.enabled) {
    const { window, maxRangeAtr, atrPeriod } = consolRule.params;
    if (i >= window + 1 && i >= atrPeriod + 1) {
      const atrSeries = atr(bars, atrPeriod);
      const a = atrSeries[i];
      if (a != null && a > 0) {
        let hi = -Infinity;
        let lo = Infinity;
        for (let j = i - window; j < i; j++) {
          if (bars[j].high > hi) hi = bars[j].high;
          if (bars[j].low < lo) lo = bars[j].low;
        }
        const range = hi - lo;
        const open = bars[i].open;
        if (range <= maxRangeAtr * a) {
          if (close > hi && open <= hi) {
            hints.push({
              id: "consol-break-long",
              side: "long",
              title: "停滞ブレイク（上）",
              reason: `${window}本の停滞レンジを実体で上抜け。短期モメンタムの抜けヒントです。`,
              strength: 0.72,
              at,
            });
          }
          if (close < lo && open >= lo) {
            hints.push({
              id: "consol-break-short",
              side: "short",
              title: "停滞ブレイク（下）",
              reason: `${window}本の停滞レンジを実体で下抜け。短期モメンタムの抜けヒントです。`,
              strength: 0.72,
              at,
            });
          }
        }
      }
    }
  }

  const ibRule = getRule(ruleSet, "inside_bar_break");
  if (ibRule?.enabled && i >= 2) {
    const mother = bars[i - 2];
    const inside = bars[i - 1];
    const isInside =
      inside.high <= mother.high && inside.low >= mother.low;
    if (isInside) {
      const { maPeriod, maKind } = ibRule.params;
      let trendOkLong = true;
      let trendOkShort = true;
      if (maPeriod && maPeriod > 0) {
        const series =
          (maKind ?? "sma") === "ema"
            ? ema(bars, maPeriod)
            : sma(bars, maPeriod);
        const m = series[i];
        if (m == null) {
          trendOkLong = false;
          trendOkShort = false;
        } else {
          // Rayner: trade IB when price respects fast MA (momentum trend)
          trendOkLong = close >= m;
          trendOkShort = close <= m;
        }
      }
      if (trendOkLong && close > mother.high) {
        hints.push({
          id: "inside-bar-long",
          side: "long",
          title: "インサイドバー上抜け",
          reason:
            "インサイドバー形成後にマザー高値を終値ブレイク。モメンタム継続の順張りヒントです。",
          strength: 0.74,
          at,
        });
      }
      if (trendOkShort && close < mother.low) {
        hints.push({
          id: "inside-bar-short",
          side: "short",
          title: "インサイドバー下抜け",
          reason:
            "インサイドバー形成後にマザー安値を終値ブレイク。モメンタム継続の順張りヒントです。",
          strength: 0.74,
          at,
        });
      }
    }
  }

  const sqRule = getRule(ruleSet, "bb_squeeze_break");
  if (sqRule?.enabled) {
    const { period, mult, lookback } = sqRule.params;
    if (i >= lookback + 1 && i >= period) {
      const bb = bollinger(bars, period, mult);
      const widths: number[] = [];
      let valid = true;
      for (let j = i - lookback; j < i; j++) {
        const u = bb[j].upper;
        const l = bb[j].lower;
        if (u == null || l == null) {
          valid = false;
          break;
        }
        widths.push(u - l);
      }
      if (valid && widths.length === lookback) {
        const prevWidth = widths[widths.length - 1];
        const minWidth = Math.min(...widths);
        // Squeeze: prior bar width is the lookback minimum (Rayner BB sausage)
        if (prevWidth <= minWidth * 1.0001) {
          let hi = -Infinity;
          let lo = Infinity;
          for (let j = i - lookback; j < i; j++) {
            if (bars[j].high > hi) hi = bars[j].high;
            if (bars[j].low < lo) lo = bars[j].low;
          }
          if (close > hi) {
            hints.push({
              id: "bb-squeeze-long",
              side: "long",
              title: "BBスクイーズ上抜け",
              reason: `ボリンジャー幅が直近${lookback}本で最小後にレンジ上抜け。ボラ拡張ブレイクのヒントです。`,
              strength: 0.73,
              at,
            });
          }
          if (close < lo) {
            hints.push({
              id: "bb-squeeze-short",
              side: "short",
              title: "BBスクイーズ下抜け",
              reason: `ボリンジャー幅が直近${lookback}本で最小後にレンジ下抜け。ボラ拡張ブレイクのヒントです。`,
              strength: 0.73,
              at,
            });
          }
        }
      }
    }
  }

  return hints.sort((a, b) => b.strength - a.strength);
}

/** Latest non-neutral bias for UI badge. */
export function latestBias(hints: SignalHint[]): SignalHint | null {
  return hints.find((h) => h.side !== "neutral") ?? null;
}
