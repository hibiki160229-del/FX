/**
 * Fast floors check for enabled pack rules only (Yahoo or Twelve Data via fetchUsdJpyOhlcv).
 * Floors: trades≥4, MDD≤25%, WR≥50%, totalReturn>0 (prefer n≥20).
 */
import { mkdirSync, writeFileSync } from "fs";
import { fetchUsdJpyOhlcv } from "../src/lib/data/fetch-ohlcv";
import { backtestRule } from "../src/lib/analysis/backtest";
import { checkFloors, compositeScore } from "../src/lib/analysis/score";
import {
  DEFAULT_SCORE_FLOORS,
  PREFERRED_MIN_TRADES,
} from "../src/lib/analysis/types";
import type { OhlcvBar } from "../src/lib/types";
import {
  DEFAULT_RULE_SET,
  RULE_SETS_BY_INTERVAL,
} from "../src/lib/signals/definitions";
import {
  fetchTwelveDataOhlcv,
  isTwelveDataConfigured,
  TWELVE_DATA_FREE_CREDITS_PER_DAY,
  TWELVE_DATA_FREE_CREDITS_PER_MIN,
  TWELVE_DATA_MAX_OUTPUTSIZE,
} from "../src/lib/providers/twelve-data";

type TfSpec = {
  key: string;
  range: string;
  interval: string;
  note: string;
  agg4h?: boolean;
};

function yahooSpecs(): TfSpec[] {
  return [
    { key: "1m", range: "7d", interval: "1m", note: "Yahoo 1m ~7d" },
    { key: "5m", range: "60d", interval: "5m", note: "Yahoo 5m 60d" },
    { key: "15m", range: "60d", interval: "15m", note: "Yahoo 15m 60d" },
    { key: "30m", range: "60d", interval: "30m", note: "Yahoo 30m 60d" },
    { key: "1h", range: "1y", interval: "1h", note: "Yahoo 1h 1y" },
    {
      key: "4h",
      range: "1y",
      interval: "1h",
      agg4h: true,
      note: "4h agg from 1h 1y",
    },
    { key: "1d", range: "1y", interval: "1d", note: "Yahoo 1d 1y" },
  ];
}

function twelveSpecs(): TfSpec[] {
  return [
    {
      key: "1m",
      range: "1y",
      interval: "1m",
      note: `Twelve Data 1m ~1y (≤${TWELVE_DATA_MAX_OUTPUTSIZE}; free ${TWELVE_DATA_FREE_CREDITS_PER_MIN}/min ${TWELVE_DATA_FREE_CREDITS_PER_DAY}/day)`,
    },
    { key: "5m", range: "1y", interval: "5m", note: "Twelve Data 5m 1y" },
    { key: "15m", range: "1y", interval: "15m", note: "Twelve Data 15m 1y" },
    { key: "30m", range: "1y", interval: "30m", note: "Twelve Data 30m 1y" },
    { key: "1h", range: "1y", interval: "1h", note: "Twelve Data 1h 1y" },
    {
      key: "4h",
      range: "1y",
      interval: "1h",
      agg4h: true,
      note: "4h agg Twelve Data",
    },
    { key: "1d", range: "1y", interval: "1d", note: "Twelve Data 1d 1y" },
  ];
}

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

async function resolveProvider(): Promise<{
  useTwelve: boolean;
  note: string;
  specs: TfSpec[];
}> {
  if (!isTwelveDataConfigured()) {
    return {
      useTwelve: false,
      note: "TWELVE_DATA_API_KEY unset",
      specs: yahooSpecs(),
    };
  }
  try {
    const probe = await fetchTwelveDataOhlcv("1d", "1h");
    if (probe && probe.bars.length >= 40) {
      return {
        useTwelve: true,
        note: "Twelve Data probe OK",
        specs: twelveSpecs(),
      };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      useTwelve: false,
      note: `Twelve Data probe failed (${msg})`,
      specs: yahooSpecs(),
    };
  }
  return {
    useTwelve: false,
    note: "Twelve Data probe empty",
    specs: yahooSpecs(),
  };
}

async function main() {
  const { useTwelve, note, specs } = await resolveProvider();
  console.error(note);

  const floors = DEFAULT_SCORE_FLOORS;
  const datasets: Record<
    string,
    { bars: number; source: string; note: string; label: string }
  > = {};
  const barsByTf: Record<string, OhlcvBar[]> = {};

  for (const tf of specs) {
    const ohlcv = await fetchUsdJpyOhlcv(tf.range, tf.interval);
    const bars = tf.agg4h ? agg4h(ohlcv.bars) : ohlcv.bars;
    barsByTf[tf.key] = bars;
    datasets[tf.key] = {
      bars: bars.length,
      source: ohlcv.source,
      note: tf.note,
      label: `${tf.interval}_${tf.range}${tf.agg4h ? "_agg4h" : ""}`,
    };
    console.error(
      `loaded ${tf.key}: ${bars.length} src=${ohlcv.source}`,
    );
  }

  const actives: Array<{
    tf: string;
    ruleId: string;
    params: unknown;
    wr: number;
    ret: number;
    n: number;
    dd: number;
    score: number;
    passed: boolean;
    preferN: boolean;
    failReasons: string[];
  }> = [];

  for (const [tf, set] of Object.entries(RULE_SETS_BY_INTERVAL)) {
    if (tf === "60m" || !barsByTf[tf]) continue;
    for (const r of set.rules.filter((x) => x.enabled)) {
      const m = backtestRule(barsByTf[tf], r.id, r.params as never);
      const { passed, failReasons } = checkFloors(m, floors);
      actives.push({
        tf,
        ruleId: r.id,
        params: r.params,
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

  const summary = {
    meta: {
      floors,
      preferredMinTrades: PREFERRED_MIN_TRADES,
      provider: useTwelve ? "twelve_data" : "yahoo",
      providerNote: note,
      twelveDataLimits: {
        creditsPerMin: TWELVE_DATA_FREE_CREDITS_PER_MIN,
        creditsPerDay: TWELVE_DATA_FREE_CREDITS_PER_DAY,
        maxOutputsize: TWELVE_DATA_MAX_OUTPUTSIZE,
      },
      datasets,
      deskDefaults: DEFAULT_RULE_SET.rules
        .filter((r) => r.enabled)
        .map((r) => ({ id: r.id, params: r.params })),
    },
    activeKeeps: actives.filter((a) => a.passed),
    activeDrops: actives.filter((a) => !a.passed),
  };

  const outDir =
    "/cursor/stores/bc-b99bd4a7-78ba-47d8-af65-455fa72ffa8c/internal/yt-backtests";
  mkdirSync(outDir, { recursive: true });
  const path = `${outDir}/pass16-twelve-data-1m.json`;
  writeFileSync(path, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ ...summary, out: path }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
