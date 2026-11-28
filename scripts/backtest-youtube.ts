/**
 * Offline multi-TF backtest for YouTube / desk rule candidates on USD/JPY.
 * Floors: trades≥4, MDD≤25%, WR≥50%, totalReturn>0 (prefer n≥20).
 *
 * Yahoo max windows (as of 2026-11-28):
 *   1m → 7d–8d (use 7d; 60d rejected)
 *   5m/15m/30m → 60d (3mo rejected)
 *   1h / 4h(agg) → 1y (~6264 H1 bars)
 *   1d → 1y
 *
 * Run from repo root: npx --yes tsx scripts/backtest-youtube.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import { fetchUsdJpyOhlcv } from "../src/lib/data/fetch-ohlcv";
import { backtestRule } from "../src/lib/analysis/backtest";
import { checkFloors, compositeScore } from "../src/lib/analysis/score";
import { youtubeCandidates } from "../src/lib/analysis/youtube";
import {
  DEFAULT_SCORE_FLOORS,
  PREFERRED_MIN_TRADES,
} from "../src/lib/analysis/types";
import type { OhlcvBar } from "../src/lib/types";
import {
  DEFAULT_RULE_SET,
  RULE_SETS_BY_INTERVAL,
  type RuleId,
  type RuleParams,
} from "../src/lib/signals/definitions";

type TfSpec = {
  key: string;
  range: string;
  interval: string;
  note: string;
  agg4h?: boolean;
};

/** Longest Yahoo windows that succeed for USDJPY=X. */
export const BT_TF_SPECS: TfSpec[] = [
  { key: "1m", range: "7d", interval: "1m", note: "Yahoo 1m max ~7d (8d ok; 60d rejected)" },
  { key: "5m", range: "60d", interval: "5m", note: "Yahoo 5m max 60d" },
  { key: "15m", range: "60d", interval: "15m", note: "Yahoo 15m max 60d" },
  { key: "30m", range: "60d", interval: "30m", note: "Yahoo 30m max 60d" },
  { key: "1h", range: "1y", interval: "1h", note: "Yahoo 1h ~1y" },
  {
    key: "4h",
    range: "1y",
    interval: "1h",
    agg4h: true,
    note: "4h = aggregate 1h×4 over 1y",
  },
  { key: "1d", range: "1y", interval: "1d", note: "Yahoo 1d ~1y" },
];

function agg4h(bars: OhlcvBar[]): OhlcvBar[] {
  const out: OhlcvBar[] = [];
  for (let i = 0; i + 3 < bars.length; i += 4) {
    const chunk = bars.slice(i, i + 4);
    out.push({
      time: chunk[0].time,
      open: chunk[0].open,
      high: Math.max(...chunk.map((b) => b.high)),
      low: Math.min(...chunk.map((b) => b.low)),
      close: chunk[chunk.length - 1].close,
      volume: chunk.reduce((s, b) => s + (b.volume ?? 0), 0),
    });
  }
  return out;
}

type Cand = {
  note: string;
  ruleId: RuleId;
  params: RuleParams[RuleId];
  source: string;
};

function packCandidates(): Cand[] {
  const out: Cand[] = [];
  const seen = new Set<string>();
  for (const [tf, set] of Object.entries(RULE_SETS_BY_INTERVAL)) {
    if (tf === "60m") continue;
    for (const r of set.rules) {
      const key = `${r.id}:${JSON.stringify(r.params)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        note: `pack:${tf}:${r.enabled ? "on" : "off"}`,
        ruleId: r.id,
        params: r.params as RuleParams[RuleId],
        source: "pack",
      });
    }
  }
  for (const c of youtubeCandidates()) {
    const key = `${c.ruleId}:${JSON.stringify(c.params)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      note: c.note ?? c.id,
      ruleId: c.ruleId,
      params: c.params,
      source: c.channel ?? "youtube",
    });
  }
  return out;
}

async function main() {
  const floors = DEFAULT_SCORE_FLOORS;
  const barsByTf: Record<string, OhlcvBar[]> = {};
  const datasets: Record<string, { bars: number; label: string; note: string }> =
    {};

  for (const tf of BT_TF_SPECS) {
    const ohlcv = await fetchUsdJpyOhlcv(tf.range, tf.interval);
    const bars = tf.agg4h ? agg4h(ohlcv.bars) : ohlcv.bars;
    barsByTf[tf.key] = bars;
    datasets[tf.key] = {
      bars: bars.length,
      label: `${tf.interval}_${tf.range}${tf.agg4h ? "_agg4h" : ""}`,
      note: tf.note,
    };
    console.error(`loaded ${tf.key}: ${bars.length} (${tf.note})`);
  }

  const cands = packCandidates();
  type Row = {
    note: string;
    source: string;
    ruleId: string;
    params: unknown;
    tf: string;
    wr: number;
    ret: number;
    n: number;
    dd: number;
    score: number;
    passed: boolean;
    preferN: boolean;
    failReasons: string[];
  };
  const rows: Row[] = [];

  for (const c of cands) {
    for (const tf of Object.keys(barsByTf)) {
      const m = backtestRule(barsByTf[tf], c.ruleId, c.params);
      const { passed, failReasons } = checkFloors(m, floors);
      rows.push({
        note: c.note,
        source: c.source,
        ruleId: c.ruleId,
        params: c.params,
        tf,
        wr: Number(m.winRate.toFixed(4)),
        ret: Number(m.totalReturn.toFixed(4)),
        n: m.tradeCount,
        dd: Number(m.maxDrawdown.toFixed(4)),
        score: Number(compositeScore(m).toFixed(4)),
        passed,
        preferN: passed && m.tradeCount >= PREFERRED_MIN_TRADES,
        failReasons,
      });
    }
  }

  // Enabled actives per pack TF
  const actives: Row[] = [];
  for (const [tf, set] of Object.entries(RULE_SETS_BY_INTERVAL)) {
    if (tf === "60m" || !barsByTf[tf]) continue;
    for (const r of set.rules.filter((x) => x.enabled)) {
      const m = backtestRule(barsByTf[tf], r.id, r.params as never);
      const { passed, failReasons } = checkFloors(m, floors);
      actives.push({
        note: `active:${tf}`,
        source: "active",
        ruleId: r.id,
        params: r.params,
        tf,
        wr: Number(m.winRate.toFixed(4)),
        ret: Number(m.totalReturn.toFixed(4)),
        n: m.tradeCount,
        dd: Number(m.maxDrawdown.toFixed(4)),
        score: Number(compositeScore(m).toFixed(4)),
        passed,
        preferN: passed && m.tradeCount >= PREFERRED_MIN_TRADES,
        failReasons,
      });
    }
  }

  const keeps = rows.filter((r) => r.passed).sort((a, b) => b.score - a.score);
  const activeKeeps = actives.filter((r) => r.passed);
  const activeDrops = actives.filter((r) => !r.passed);

  const summary = {
    meta: {
      floors,
      preferredMinTrades: PREFERRED_MIN_TRADES,
      datasets,
      candCount: cands.length,
      deskDefaults: DEFAULT_RULE_SET.rules
        .filter((r) => r.enabled)
        .map((r) => ({ id: r.id, params: r.params })),
    },
    activeKeeps,
    activeDrops,
    keepsTop: keeps.slice(0, 40),
    keepsByTf: Object.fromEntries(
      Object.keys(barsByTf).map((tf) => [
        tf,
        keeps.filter((k) => k.tf === tf).slice(0, 15),
      ]),
    ),
  };

  const outDir =
    "/cursor/stores/bc-b99bd4a7-78ba-47d8-af65-455fa72ffa8c/internal/yt-backtests";
  mkdirSync(outDir, { recursive: true });
  const path = `${outDir}/pass13-highwr-profit-1m.json`;
  writeFileSync(path, JSON.stringify(summary, null, 2));

  console.log(JSON.stringify({
    datasets,
    activeKeeps,
    activeDrops,
    keepCount: keeps.length,
    out: path,
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
