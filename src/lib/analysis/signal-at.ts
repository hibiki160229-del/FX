import { bollinger, ema, macd, rsi, sma } from "@/lib/indicators";
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
    default:
      return (i) => sideAtBar(bars, i, def);
  }
}
