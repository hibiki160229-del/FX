import type { RuleId, RuleParams } from "@/lib/signals";
import { DEFAULT_RULE_SET } from "@/lib/signals";
import type { RuleCandidate } from "./types";

const LABELS: Record<RuleId, string> = {
  ma_cross: "MAクロス",
  ema_cross: "EMAクロス",
  rsi_reversal: "RSI反転",
  macd_hist_flip: "MACDヒストグラム転換",
  bb_touch: "ボリンジャー接触",
};

function cand(
  ruleId: RuleId,
  params: RuleParams[RuleId],
  source: RuleCandidate["source"],
  note?: string,
): RuleCandidate {
  return {
    id: `${ruleId}:${JSON.stringify(params)}`,
    ruleId,
    labelJa: LABELS[ruleId],
    params,
    source,
    note,
  };
}

/** Curated seeds inspired by common USD/JPY TA articles (no live scrape required). */
export function seedCandidates(): RuleCandidate[] {
  const out: RuleCandidate[] = [];

  // Defaults from live SignalRuleSet
  for (const r of DEFAULT_RULE_SET.rules) {
    out.push(cand(r.id, r.params, "seed", "既定パラメータ"));
  }

  // Classic MA / EMA grids
  for (const [fast, slow] of [
    [5, 20],
    [10, 30],
    [10, 50],
    [20, 60],
    [50, 200],
  ] as const) {
    out.push(
      cand("ma_cross", { fast, slow }, "seed", `MA${fast}/${slow}`),
    );
    out.push(
      cand("ema_cross", { fast, slow }, "seed", `EMA${fast}/${slow}`),
    );
  }

  // RSI thresholds
  for (const [period, oversold, overbought] of [
    [7, 25, 75],
    [14, 20, 80],
    [14, 30, 70],
    [21, 30, 70],
  ] as const) {
    out.push(
      cand(
        "rsi_reversal",
        { period, oversold, overbought },
        "seed",
        `RSI${period} ${oversold}/${overbought}`,
      ),
    );
  }

  // MACD variants
  for (const [fast, slow, signal] of [
    [8, 17, 9],
    [12, 26, 9],
    [5, 35, 5],
  ] as const) {
    out.push(
      cand(
        "macd_hist_flip",
        { fast, slow, signal },
        "seed",
        `MACD ${fast}/${slow}/${signal}`,
      ),
    );
  }

  // Bollinger
  for (const [period, mult] of [
    [20, 2],
    [20, 2.5],
    [14, 2],
    [30, 2],
  ] as const) {
    out.push(
      cand("bb_touch", { period, mult }, "seed", `BB${period}×${mult}`),
    );
  }

  return dedupe(out);
}

export function dedupe(cands: RuleCandidate[]): RuleCandidate[] {
  const seen = new Set<string>();
  const out: RuleCandidate[] = [];
  for (const c of cands) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
  }
  return out;
}

export { LABELS };
