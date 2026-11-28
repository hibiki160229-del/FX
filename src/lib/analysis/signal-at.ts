import { atr, bollinger, ema, macd, rsi, sma } from "@/lib/indicators";
import type { OhlcvBar, SignalSide } from "@/lib/types";
import type { RuleDefinition, RuleId, RuleParams } from "@/lib/signals";

/** Compact side at bar `i` for one rule (no UI copy). */
export type BarSide = Exclude<SignalSide, "neutral">;

export function sideAtBar(
  bars: OhlcvBar[],
  i: number,
  rule: RuleDefinition,
): BarSide | null {
  if (i < 1 || i >= bars.length) return null;
  const prev = i - 1;

  switch (rule.id) {
    case "ma_cross": {
      const { fast, slow } = rule.params as RuleParams["ma_cross"];
      const maFast = sma(bars, fast);
      const maSlow = sma(bars, slow);
      if (
        maFast[i] == null ||
        maSlow[i] == null ||
        maFast[prev] == null ||
        maSlow[prev] == null
      ) {
        return null;
      }
      if (
        (maFast[prev] as number) <= (maSlow[prev] as number) &&
        (maFast[i] as number) > (maSlow[i] as number)
      ) {
        return "long";
      }
      if (
        (maFast[prev] as number) >= (maSlow[prev] as number) &&
        (maFast[i] as number) < (maSlow[i] as number)
      ) {
        return "short";
      }
      return null;
    }
    case "ema_cross": {
      const { fast, slow } = rule.params as RuleParams["ema_cross"];
      const eFast = ema(bars, fast);
      const eSlow = ema(bars, slow);
      if (
        eFast[i] == null ||
        eSlow[i] == null ||
        eFast[prev] == null ||
        eSlow[prev] == null
      ) {
        return null;
      }
      if (
        (eFast[prev] as number) <= (eSlow[prev] as number) &&
        (eFast[i] as number) > (eSlow[i] as number)
      ) {
        return "long";
      }
      if (
        (eFast[prev] as number) >= (eSlow[prev] as number) &&
        (eFast[i] as number) < (eSlow[i] as number)
      ) {
        return "short";
      }
      return null;
    }
    case "rsi_reversal": {
      const { period, oversold, overbought } =
        rule.params as RuleParams["rsi_reversal"];
      const series = rsi(bars, period);
      if (series[i] == null || series[prev] == null) return null;
      const r = series[i] as number;
      const rp = series[prev] as number;
      if (r < oversold && r > rp) return "long";
      if (r > overbought && r < rp) return "short";
      return null;
    }
    case "macd_hist_flip": {
      const { fast, slow, signal } =
        rule.params as RuleParams["macd_hist_flip"];
      const series = macd(bars, fast, slow, signal);
      const h = series[i].histogram;
      const hp = series[prev].histogram;
      if (h == null || hp == null) return null;
      if (hp <= 0 && h > 0) return "long";
      if (hp >= 0 && h < 0) return "short";
      return null;
    }
    case "bb_touch": {
      const { period, mult } = rule.params as RuleParams["bb_touch"];
      const bb = bollinger(bars, period, mult);
      if (bb[i].lower == null || bb[i].upper == null) return null;
      const close = bars[i].close;
      if (close <= (bb[i].lower as number)) return "long";
      if (close >= (bb[i].upper as number)) return "short";
      return null;
    }
    case "ma_bounce": {
      const { period, kind, trendPeriod } =
        rule.params as RuleParams["ma_bounce"];
      const series = kind === "ema" ? ema(bars, period) : sma(bars, period);
      const ma = series[i];
      const maPrev = series[prev];
      if (ma == null || maPrev == null) return null;
      const close = bars[i].close;
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
        if (t == null || tPrev == null) return null;
        trendOkLong = close >= t && t > tPrev;
        trendOkShort = close <= t && t < tPrev;
      }
      if (
        trendOkLong &&
        low <= ma &&
        close > ma &&
        prevClose <= maPrev * 1.001
      ) {
        return "long";
      }
      if (
        trendOkShort &&
        high >= ma &&
        close < ma &&
        prevClose >= maPrev * 0.999
      ) {
        return "short";
      }
      return null;
    }
    case "swing_break": {
      const { lookback, trendPeriod, trendKind } =
        rule.params as RuleParams["swing_break"];
      if (i < lookback + 1) return null;
      let priorHigh = -Infinity;
      let priorLow = Infinity;
      for (let j = i - lookback; j < i; j++) {
        if (bars[j].high > priorHigh) priorHigh = bars[j].high;
        if (bars[j].low < priorLow) priorLow = bars[j].low;
      }
      const close = bars[i].close;
      const prevClose = bars[prev].close;
      let trendOkLong = true;
      let trendOkShort = true;
      if (trendPeriod && trendPeriod > 0) {
        const kind = trendKind ?? "sma";
        const trend = kind === "ema" ? ema(bars, trendPeriod) : sma(bars, trendPeriod);
        const t = trend[i];
        const tPrev = trend[Math.max(0, i - 5)];
        if (t == null || tPrev == null) return null;
        // Kuroyuki: skip flat 200; require clear slope
        const flatTol = Math.abs(t) * 1e-5;
        if (Math.abs(t - tPrev) < flatTol) return null;
        trendOkLong = close >= t && t > tPrev;
        trendOkShort = close <= t && t < tPrev;
      }
      if (trendOkLong && prevClose <= priorHigh && close > priorHigh) {
        return "long";
      }
      if (trendOkShort && prevClose >= priorLow && close < priorLow) {
        return "short";
      }
      return null;
    }
    case "consol_break": {
      const { window, maxRangeAtr, atrPeriod } =
        rule.params as RuleParams["consol_break"];
      if (i < window + 1 || i < atrPeriod + 1) return null;
      const atrSeries = atr(bars, atrPeriod);
      const a = atrSeries[i];
      if (a == null || a <= 0) return null;
      // Consolidation over bars [i-window, i-1]
      let hi = -Infinity;
      let lo = Infinity;
      for (let j = i - window; j < i; j++) {
        if (bars[j].high > hi) hi = bars[j].high;
        if (bars[j].low < lo) lo = bars[j].low;
      }
      const range = hi - lo;
      if (range > maxRangeAtr * a) return null;
      const close = bars[i].close;
      const open = bars[i].open;
      // Body must clear the consolidation zone (Kuroyuki: 実体で抜け)
      if (close > hi && open <= hi) return "long";
      if (close < lo && open >= lo) return "short";
      return null;
    }
    case "inside_bar_break": {
      const { maPeriod, maKind } =
        rule.params as RuleParams["inside_bar_break"];
      if (i < 2) return null;
      const mother = bars[i - 2];
      const inside = bars[i - 1];
      if (inside.high > mother.high || inside.low < mother.low) return null;
      const close = bars[i].close;
      let trendOkLong = true;
      let trendOkShort = true;
      if (maPeriod && maPeriod > 0) {
        const series =
          (maKind ?? "sma") === "ema"
            ? ema(bars, maPeriod)
            : sma(bars, maPeriod);
        const m = series[i];
        if (m == null) return null;
        trendOkLong = close >= m;
        trendOkShort = close <= m;
      }
      if (trendOkLong && close > mother.high) return "long";
      if (trendOkShort && close < mother.low) return "short";
      return null;
    }
    case "bb_squeeze_break": {
      const { period, mult, lookback } =
        rule.params as RuleParams["bb_squeeze_break"];
      if (i < lookback + 1 || i < period) return null;
      const bb = bollinger(bars, period, mult);
      const widths: number[] = [];
      for (let j = i - lookback; j < i; j++) {
        const u = bb[j].upper;
        const l = bb[j].lower;
        if (u == null || l == null) return null;
        widths.push(u - l);
      }
      const prevWidth = widths[widths.length - 1];
      const minWidth = Math.min(...widths);
      if (prevWidth > minWidth * 1.0001) return null;
      let hi = -Infinity;
      let lo = Infinity;
      for (let j = i - lookback; j < i; j++) {
        if (bars[j].high > hi) hi = bars[j].high;
        if (bars[j].low < lo) lo = bars[j].low;
      }
      const close = bars[i].close;
      if (close > hi) return "long";
      if (close < lo) return "short";
      return null;
    }
    default:
      return null;
  }
}

/** Precompute indicator series once, then side lookups are O(1) per bar. */
export function makeSideLookup(
  bars: OhlcvBar[],
  ruleId: RuleId,
  params: RuleParams[RuleId],
): (i: number) => BarSide | null {
  const def = {
    id: ruleId,
    labelJa: "",
    enabled: true,
    params,
  } as RuleDefinition;

  // Cache series per rule type so repeated sideAtBar doesn't recompute.
  switch (ruleId) {
    case "ma_cross": {
      const { fast, slow } = params as RuleParams["ma_cross"];
      const maFast = sma(bars, fast);
      const maSlow = sma(bars, slow);
      return (i) => {
        if (i < 1) return null;
        const prev = i - 1;
        if (
          maFast[i] == null ||
          maSlow[i] == null ||
          maFast[prev] == null ||
          maSlow[prev] == null
        ) {
          return null;
        }
        if (
          (maFast[prev] as number) <= (maSlow[prev] as number) &&
          (maFast[i] as number) > (maSlow[i] as number)
        ) {
          return "long";
        }
        if (
          (maFast[prev] as number) >= (maSlow[prev] as number) &&
          (maFast[i] as number) < (maSlow[i] as number)
        ) {
          return "short";
        }
        return null;
      };
    }
    case "ema_cross": {
      const { fast, slow } = params as RuleParams["ema_cross"];
      const eFast = ema(bars, fast);
      const eSlow = ema(bars, slow);
      return (i) => {
        if (i < 1) return null;
        const prev = i - 1;
        if (
          eFast[i] == null ||
          eSlow[i] == null ||
          eFast[prev] == null ||
          eSlow[prev] == null
        ) {
          return null;
        }
        if (
          (eFast[prev] as number) <= (eSlow[prev] as number) &&
          (eFast[i] as number) > (eSlow[i] as number)
        ) {
          return "long";
        }
        if (
          (eFast[prev] as number) >= (eSlow[prev] as number) &&
          (eFast[i] as number) < (eSlow[i] as number)
        ) {
          return "short";
        }
        return null;
      };
    }
    case "rsi_reversal": {
      const { period, oversold, overbought } =
        params as RuleParams["rsi_reversal"];
      const series = rsi(bars, period);
      return (i) => {
        if (i < 1) return null;
        if (series[i] == null || series[i - 1] == null) return null;
        const r = series[i] as number;
        const rp = series[i - 1] as number;
        if (r < oversold && r > rp) return "long";
        if (r > overbought && r < rp) return "short";
        return null;
      };
    }
    case "macd_hist_flip": {
      const { fast, slow, signal } = params as RuleParams["macd_hist_flip"];
      const series = macd(bars, fast, slow, signal);
      return (i) => {
        if (i < 1) return null;
        const h = series[i].histogram;
        const hp = series[i - 1].histogram;
        if (h == null || hp == null) return null;
        if (hp <= 0 && h > 0) return "long";
        if (hp >= 0 && h < 0) return "short";
        return null;
      };
    }
    case "bb_touch": {
      const { period, mult } = params as RuleParams["bb_touch"];
      const bb = bollinger(bars, period, mult);
      return (i) => {
        if (i < 1) return null;
        if (bb[i].lower == null || bb[i].upper == null) return null;
        const close = bars[i].close;
        if (close <= (bb[i].lower as number)) return "long";
        if (close >= (bb[i].upper as number)) return "short";
        return null;
      };
    }
    case "ma_bounce": {
      const { period, kind, trendPeriod } =
        params as RuleParams["ma_bounce"];
      const series = kind === "ema" ? ema(bars, period) : sma(bars, period);
      const trendSeries =
        trendPeriod && trendPeriod > period
          ? kind === "ema"
            ? ema(bars, trendPeriod)
            : sma(bars, trendPeriod)
          : null;
      return (i) => {
        if (i < 1) return null;
        const prev = i - 1;
        const ma = series[i];
        const maPrev = series[prev];
        if (ma == null || maPrev == null) return null;
        const close = bars[i].close;
        const low = bars[i].low;
        const high = bars[i].high;
        const prevClose = bars[prev].close;
        let trendOkLong = true;
        let trendOkShort = true;
        if (trendSeries) {
          const t = trendSeries[i];
          const tPrev = trendSeries[Math.max(0, i - 5)];
          if (t == null || tPrev == null) return null;
          trendOkLong = close >= t && t > tPrev;
          trendOkShort = close <= t && t < tPrev;
        }
        if (
          trendOkLong &&
          low <= ma &&
          close > ma &&
          prevClose <= maPrev * 1.001
        ) {
          return "long";
        }
        if (
          trendOkShort &&
          high >= ma &&
          close < ma &&
          prevClose >= maPrev * 0.999
        ) {
          return "short";
        }
        return null;
      };
    }
    case "swing_break":
    case "consol_break":
    case "inside_bar_break":
    case "bb_squeeze_break":
      return (i) => sideAtBar(bars, i, def);
    default:
      return (i) => sideAtBar(bars, i, def);
  }
}
