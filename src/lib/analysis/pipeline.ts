import { fetchUsdJpyOhlcv } from "@/lib/data/fetch-ohlcv";
import {
  DEFAULT_RULE_SET,
  type RuleDefinition,
  type RuleId,
  type SignalRuleSet,
} from "@/lib/signals";
import { backtestRule } from "./backtest";
import { extractWebCandidates } from "./extract";
import { checkFloors, compositeScore } from "./score";
import { searchCandidates } from "./search";
import { dedupe, seedCandidates } from "./seeds";
import {
  DEFAULT_SCORE_FLOORS,
  type AnalysisRunResult,
  type RankedCandidate,
  type RuleCandidate,
  type ScoreFloors,
} from "./types";
import { youtubeCandidates } from "./youtube";

export type PipelineOptions = {
  range?: string;
  interval?: string;
  floors?: ScoreFloors;
  /** Cap search grid size for latency. */
  maxCandidates?: number;
  includeWeb?: boolean;
  includeYoutube?: boolean;
};

function buildSuggestedRuleSet(ranked: RankedCandidate[]): SignalRuleSet {
  const bestById = new Map<RuleId, RankedCandidate>();
  for (const r of ranked) {
    if (!r.passed) continue;
    const prev = bestById.get(r.ruleId);
    if (!prev || r.score > prev.score) bestById.set(r.ruleId, r);
  }

  const rules: RuleDefinition[] = DEFAULT_RULE_SET.rules.map((base) => {
    const win = bestById.get(base.id);
    if (!win) {
      return { ...base, enabled: false };
    }
    return {
      id: base.id,
      labelJa: base.labelJa,
      enabled: true,
      params: win.params as never,
    } as RuleDefinition;
  });

  // If nothing passed floors, still enable the single highest-scoring rule.
  if (!rules.some((r) => r.enabled) && ranked[0]) {
    const top = ranked[0];
    return {
      version: 1,
      pair: "USD/JPY",
      rules: DEFAULT_RULE_SET.rules.map((base) =>
        base.id === top.ruleId
          ? ({
              ...base,
              enabled: true,
              params: top.params as never,
            } as RuleDefinition)
          : { ...base, enabled: false },
      ),
    };
  }

  return { version: 1, pair: "USD/JPY", rules };
}

export async function runAutoAnalysis(
  opts: PipelineOptions = {},
): Promise<AnalysisRunResult> {
  const range = opts.range ?? "3mo";
  const interval = opts.interval ?? "1h";
  const floors = opts.floors ?? DEFAULT_SCORE_FLOORS;
  const maxCandidates = opts.maxCandidates ?? 160;
  const includeWeb = opts.includeWeb ?? true;
  const includeYoutube = opts.includeYoutube ?? true;

  const ohlcv = await fetchUsdJpyOhlcv(range, interval);

  let web = {
    candidates: [] as RuleCandidate[],
    webHits: 0,
    attempted: false,
    noteJa: "Web抽出は無効。シード＋探索のみ。",
  };
  if (includeWeb) {
    web = await extractWebCandidates();
  }

  const yt = includeYoutube ? youtubeCandidates() : [];

  const pool = dedupe([
    ...seedCandidates(),
    ...searchCandidates(),
    ...web.candidates,
    ...yt,
  ]).slice(0, maxCandidates);

  const ranked: RankedCandidate[] = pool.map((c) => {
    const metrics = backtestRule(ohlcv.bars, c.ruleId, c.params);
    const { passed, failReasons } = checkFloors(metrics, floors);
    return {
      ...c,
      metrics,
      score: compositeScore(metrics),
      passed,
      failReasons,
    };
  });

  ranked.sort((a, b) => {
    if (a.passed !== b.passed) return a.passed ? -1 : 1;
    return b.score - a.score;
  });

  const ytNote =
    yt.length > 0
      ? `YouTube学習チャンネル由来 ${yt.length} 候補をシード投入。`
      : "YouTube候補は無効。";

  return {
    pair: "USD/JPY",
    interval,
    barCount: ohlcv.bars.length,
    source: ohlcv.source,
    asOf: Date.now(),
    floors,
    ranked,
    extraction: {
      attempted: web.attempted,
      webHits: web.webHits,
      youtube: yt.length > 0 ? "seeded" : "skipped",
      youtubeCandidates: yt.length,
      noteJa: `${web.noteJa} ${ytNote}`.trim(),
    },
    suggestedRuleSet: buildSuggestedRuleSet(ranked),
  };
}
