import type { OhlcvBar } from "@/lib/types";
import { generateMockOhlcv } from "./mock-ohlcv";

export type OhlcvPayload = {
  bars: OhlcvBar[];
  source: "yahoo" | "sample";
  pair: "USD/JPY";
  interval: string;
  asOf: number;
};

type YahooChart = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
      };
    }>;
  };
};

export async function fetchUsdJpyOhlcv(
  range = "1mo",
  interval = "1h",
): Promise<OhlcvPayload> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/USDJPY=X?interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(range)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "EnmyakuFX/1.0" },
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error(`yahoo ${res.status}`);
    const json = (await res.json()) as YahooChart;
    const result = json.chart?.result?.[0];
    const ts = result?.timestamp;
    const q = result?.indicators?.quote?.[0];
    if (!ts || !q?.close) throw new Error("empty yahoo payload");

    const bars: OhlcvBar[] = [];
    for (let i = 0; i < ts.length; i++) {
      const open = q.open?.[i];
      const high = q.high?.[i];
      const low = q.low?.[i];
      const close = q.close?.[i];
      if (
        open == null ||
        high == null ||
        low == null ||
        close == null ||
        !Number.isFinite(open) ||
        !Number.isFinite(close)
      ) {
        continue;
      }
      bars.push({
        time: ts[i],
        open,
        high,
        low,
        close,
        volume: q.volume?.[i] ?? 0,
      });
    }
    if (bars.length < 40) throw new Error("too few bars");

    return {
      bars,
      source: "yahoo",
      pair: "USD/JPY",
      interval,
      asOf: Date.now(),
    };
  } catch {
    return {
      bars: generateMockOhlcv(240),
      source: "sample",
      pair: "USD/JPY",
      interval,
      asOf: Date.now(),
    };
  }
}
