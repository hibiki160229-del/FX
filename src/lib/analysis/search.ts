import type { RuleId, RuleParams } from "@/lib/signals";
import { dedupe, LABELS } from "./seeds";
import type { RuleCandidate } from "./types";

function cand(
  ruleId: RuleId,
  params: RuleParams[RuleId],
  note: string,
): RuleCandidate {
  return {
    id: `${ruleId}:${JSON.stringify(params)}`,
    ruleId,
    labelJa: LABELS[ruleId],
    params,
    source: "search",
    note,
  };
}

/**
 * Compact grid search over built-in indicator params.
 * Kept deliberately small so one-click analysis stays interactive.
 */
export function searchCandidates(): RuleCandidate[] {
  const out: RuleCandidate[] = [];

  const maFast = [5, 8, 10, 12, 20];
  const maSlow = [20, 26, 40, 50, 60];
  for (const fast of maFast) {
    for (const slow of maSlow) {
      if (fast >= slow) continue;
      out.push(cand("ma_cross", { fast, slow }, `探索 MA${fast}/${slow}`));
      out.push(cand("ema_cross", { fast, slow }, `探索 EMA${fast}/${slow}`));
    }
  }

  for (const period of [7, 10, 14, 21]) {
    for (const [oversold, overbought] of [
      [20, 80],
      [25, 75],
      [30, 70],
      [35, 65],
    ] as const) {
      out.push(
        cand(
          "rsi_reversal",
          { period, oversold, overbought },
          `探索 RSI${period}`,
        ),
      );
    }
  }

  for (const [fast, slow, signal] of [
    [6, 13, 5],
    [8, 17, 9],
    [12, 26, 9],
    [12, 26, 5],
    [16, 32, 9],
  ] as const) {
    out.push(
      cand(
        "macd_hist_flip",
        { fast, slow, signal },
        `探索 MACD ${fast}/${slow}/${signal}`,
      ),
    );
  }

  for (const period of [10, 14, 20, 30]) {
    for (const mult of [1.5, 2, 2.5]) {
      out.push(
        cand("bb_touch", { period, mult }, `探索 BB${period}×${mult}`),
      );
    }
  }

  for (const period of [10, 20, 50, 200]) {
    for (const kind of ["sma", "ema"] as const) {
      out.push(
        cand("ma_bounce", { period, kind }, `探索 ${kind.toUpperCase()}${period}バウンス`),
      );
      if (period < 200) {
        out.push(
          cand(
            "ma_bounce",
            { period, kind, trendPeriod: 200 },
            `探索 ${kind.toUpperCase()}${period}+200トレンド`,
          ),
        );
      }
    }
  }

  for (const lookback of [12, 20, 34, 55]) {
    out.push(
      cand("swing_break", { lookback }, `探索 スイングLB${lookback}`),
    );
    out.push(
      cand(
        "swing_break",
        { lookback, trendPeriod: 200, trendKind: "sma" },
        `探索 スイングLB${lookback}+200SMA`,
      ),
    );
  }

  for (const window of [5, 7, 10]) {
    for (const maxRangeAtr of [1.0, 1.2, 1.5]) {
      out.push(
        cand(
          "consol_break",
          { window, maxRangeAtr, atrPeriod: 14 },
          `探索 停滞${window}/ATR×${maxRangeAtr}`,
        ),
      );
    }
  }

  out.push(
    cand("inside_bar_break", {}, "探索 IB単体"),
    cand(
      "inside_bar_break",
      { maPeriod: 10, maKind: "sma" },
      "探索 IB+SMA10",
    ),
    cand(
      "inside_bar_break",
      { maPeriod: 20, maKind: "sma" },
      "探索 IB+SMA20",
    ),
  );

  for (const lookback of [12, 20, 34]) {
    out.push(
      cand(
        "bb_squeeze_break",
        { period: 20, mult: 2, lookback },
        `探索 BBスクイーズLB${lookback}`,
      ),
    );
  }

  for (const lookback of [5, 10, 15, 20]) {
    out.push(cand("false_break", { lookback }, `探索 FB LB${lookback}`));
    out.push(
      cand(
        "false_break",
        { lookback, trendPeriod: 50, trendKind: "sma" },
        `探索 FB LB${lookback}+SMA50`,
      ),
    );
    out.push(
      cand(
        "false_break",
        { lookback, trendPeriod: 20, trendKind: "sma" },
        `探索 FB LB${lookback}+SMA20`,
      ),
    );
  }

  return dedupe(out);
}
