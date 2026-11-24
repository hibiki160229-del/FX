import type { LiveQuote } from "../types";

/**
 * Lightweight Yahoo Finance chart meta → near-realtime USD/JPY mid.
 * Zero secrets. ~1–2s freshness during FX hours; use short range to keep payload small.
 *
 * @see https://query1.finance.yahoo.com/v8/finance/chart/USDJPY=X
 */

const YAHOO_CHART =
  "https://query1.finance.yahoo.com/v8/finance/chart/USDJPY=X";

/** Half-spread (price units) when Yahoo meta has no bid/ask — ~0.3 pip. */
const HALF_SPREAD = 0.003;

type YahooChartMeta = {
  regularMarketPrice?: number;
  regularMarketTime?: number;
  previousClose?: number;
  symbol?: string;
};

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: YahooChartMeta;
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: (number | null)[];
        }>;
      };
    }>;
  };
};

export async function fetchYahooLiveQuote(): Promise<LiveQuote | null> {
  const url = `${YAHOO_CHART}?interval=1m&range=5m`;
  const res = await fetch(url, {
    headers: { "User-Agent": "EnmyakuFX/1.0" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`yahoo quote ${res.status}`);

  const json = (await res.json()) as YahooChartResponse;
  const result = json.chart?.result?.[0];
  const meta = result?.meta;
  let mid = meta?.regularMarketPrice;
  let timeSec = meta?.regularMarketTime;

  if (
    (mid == null || !Number.isFinite(mid)) &&
    result?.timestamp &&
    result.indicators?.quote?.[0]?.close
  ) {
    const closes = result.indicators.quote[0].close;
    const ts = result.timestamp;
    for (let i = closes.length - 1; i >= 0; i--) {
      const c = closes[i];
      if (c != null && Number.isFinite(c)) {
        mid = c;
        timeSec = ts[i];
        break;
      }
    }
  }

  if (mid == null || !Number.isFinite(mid) || mid <= 0) return null;

  const timeMs =
    timeSec != null && Number.isFinite(timeSec)
      ? timeSec * 1000
      : Date.now();

  const rounded = Math.round(mid * 1000) / 1000;
  return {
    pair: "USD/JPY",
    bid: Math.round((rounded - HALF_SPREAD) * 1000) / 1000,
    ask: Math.round((rounded + HALF_SPREAD) * 1000) / 1000,
    mid: rounded,
    time: timeMs,
    source: "yahoo",
    mode: "poll",
  };
}
