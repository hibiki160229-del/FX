/**
 * Offline backtest for YouTube-sourced rule candidates on USD/JPY.
 * Run from repo root: npx --yes tsx scripts/backtest-youtube.ts
 */
import { fetchUsdJpyOhlcv } from "../src/lib/data/fetch-ohlcv";
import { backtestRule } from "../src/lib/analysis/backtest";
import { checkFloors, compositeScore } from "../src/lib/analysis/score";
import { youtubeCandidates } from "../src/lib/analysis/youtube";
import { DEFAULT_SCORE_FLOORS } from "../src/lib/analysis/types";
import { DEFAULT_RULE_SET } from "../src/lib/signals/definitions";

async function main() {
  const ohlcv = await fetchUsdJpyOhlcv("6mo", "1h");
  const floors = DEFAULT_SCORE_FLOORS;
  const cands = youtubeCandidates();
  const ranked = cands.map((c) => {
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
  ranked.sort((a, b) =>
    a.passed !== b.passed ? (a.passed ? -1 : 1) : b.score - a.score,
  );

  const byChannel = new Map<string, typeof ranked>();
  for (const r of ranked) {
    const ch = r.channel ?? "?";
    if (!byChannel.has(ch)) byChannel.set(ch, []);
    byChannel.get(ch)!.push(r);
  }

  const summary = {
    bars: ohlcv.bars.length,
    source: ohlcv.source,
    interval: "1h",
    range: "6mo",
    floors,
    total: ranked.length,
    passed: ranked.filter((r) => r.passed).length,
    winners: ranked
      .filter((r) => r.passed)
      .map((r) => ({
        channel: r.channel,
        ruleId: r.ruleId,
        note: r.note,
        params: r.params,
        score: Number(r.score.toFixed(4)),
        totalReturn: Number(r.metrics.totalReturn.toFixed(4)),
        maxDrawdown: Number(r.metrics.maxDrawdown.toFixed(4)),
        winRate: Number(r.metrics.winRate.toFixed(4)),
        tradeCount: r.metrics.tradeCount,
        profitFactor: Number(r.metrics.profitFactor.toFixed(3)),
      })),
    dropped: ranked
      .filter((r) => !r.passed)
      .map((r) => ({
        channel: r.channel,
        ruleId: r.ruleId,
        note: r.note,
        params: r.params,
        score: Number(r.score.toFixed(4)),
        failReasons: r.failReasons,
        tradeCount: r.metrics.tradeCount,
        winRate: Number(r.metrics.winRate.toFixed(4)),
        totalReturn: Number(r.metrics.totalReturn.toFixed(4)),
        maxDrawdown: Number(r.metrics.maxDrawdown.toFixed(4)),
      })),
    byChannel: Object.fromEntries(
      [...byChannel.entries()].map(([ch, rows]) => [
        ch,
        {
          total: rows.length,
          passed: rows.filter((r) => r.passed).length,
          best: rows[0]
            ? {
                ruleId: rows[0].ruleId,
                note: rows[0].note,
                passed: rows[0].passed,
                score: Number(rows[0].score.toFixed(4)),
                failReasons: rows[0].failReasons,
              }
            : null,
        },
      ]),
    ),
    suggestedDefaults: DEFAULT_RULE_SET.rules.map((base) => {
      const win = ranked.find((r) => r.passed && r.ruleId === base.id);
      return win
        ? {
            id: base.id,
            enabled: true,
            params: win.params,
            from: win.channel,
            note: win.note,
            score: Number(win.score.toFixed(4)),
          }
        : { id: base.id, enabled: false, params: base.params, from: null };
    }),
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
