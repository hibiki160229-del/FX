import type { OhlcvBar } from "@/lib/types";
import type { LiveQuote, OhlcvResult } from "../types";
import {
  getOandaCredentials,
  OANDA_API_HOST,
  OANDA_INSTRUMENT,
  OANDA_PAIR_LABEL,
  oandaAuthHeaders,
} from "./config";

type OandaPriceBucket = { price?: string; liquidity?: number };

type OandaClientPrice = {
  type?: string;
  instrument?: string;
  time?: string;
  bids?: OandaPriceBucket[];
  asks?: OandaPriceBucket[];
  tradeable?: boolean;
  status?: string;
};

type OandaPricingResponse = {
  prices?: OandaClientPrice[];
};

type OandaCandle = {
  time?: string;
  volume?: number;
  complete?: boolean;
  mid?: { o?: string; h?: string; l?: string; c?: string };
};

type OandaCandlesResponse = {
  instrument?: string;
  granularity?: string;
  candles?: OandaCandle[];
};

function parsePx(s: string | undefined): number | null {
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** UNIX Accept-Datetime-Format returns fractional seconds as a string. */
export function parseOandaTime(raw: string | undefined): number {
  if (!raw) return Date.now();
  const asNum = Number(raw);
  if (Number.isFinite(asNum)) {
    // seconds (possibly fractional) → ms
    return asNum > 1e12 ? asNum : Math.round(asNum * 1000);
  }
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : Date.now();
}

export function quoteFromOandaPrice(
  price: OandaClientPrice,
  mode: LiveQuote["mode"],
): LiveQuote | null {
  const bid = parsePx(price.bids?.[0]?.price);
  const ask = parsePx(price.asks?.[0]?.price);
  if (bid == null || ask == null) return null;
  const mid = (bid + ask) / 2;
  if (!Number.isFinite(mid) || mid <= 0) return null;
  return {
    pair: OANDA_PAIR_LABEL,
    bid,
    ask,
    mid,
    time: parseOandaTime(price.time),
    source: "oanda",
    mode,
  };
}

/**
 * Snapshot mid/bid/ask via REST pricing (practice).
 * Prefer this when the streaming host is blocked or SSE cannot stay open.
 */
export async function fetchOandaPricingQuote(): Promise<LiveQuote | null> {
  const creds = getOandaCredentials();
  if (!creds) return null;

  const url = new URL(
    `${OANDA_API_HOST}/v3/accounts/${encodeURIComponent(creds.accountId)}/pricing`,
  );
  url.searchParams.set("instruments", OANDA_INSTRUMENT);

  const res = await fetch(url, {
    headers: oandaAuthHeaders(creds.token),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`oanda pricing ${res.status}`);
  }
  const json = (await res.json()) as OandaPricingResponse;
  const price = json.prices?.[0];
  if (!price) return null;
  return quoteFromOandaPrice(price, "poll");
}

/**
 * High-frequency candle poll — S5 / M1 mid close as a live proxy.
 */
export async function fetchOandaCandleQuote(
  granularity: "S5" | "M1" = "S5",
): Promise<LiveQuote | null> {
  const creds = getOandaCredentials();
  if (!creds) return null;

  const url = new URL(
    `${OANDA_API_HOST}/v3/instruments/${OANDA_INSTRUMENT}/candles`,
  );
  url.searchParams.set("granularity", granularity);
  url.searchParams.set("count", "1");
  url.searchParams.set("price", "M");

  const res = await fetch(url, {
    headers: oandaAuthHeaders(creds.token),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`oanda candles ${res.status}`);
  }
  const json = (await res.json()) as OandaCandlesResponse;
  const c = json.candles?.[json.candles.length - 1];
  const close = parsePx(c?.mid?.c);
  if (close == null) return null;
  return {
    pair: OANDA_PAIR_LABEL,
    bid: close,
    ask: close,
    mid: close,
    time: parseOandaTime(c?.time),
    source: "oanda",
    mode: "candle",
  };
}

/** Map Yahoo-style interval to OANDA granularity. */
export function yahooIntervalToOandaGranularity(
  interval: string,
): string | null {
  switch (interval) {
    case "1m":
      return "M1";
    case "2m":
      return "M2";
    case "5m":
      return "M5";
    case "15m":
      return "M15";
    case "30m":
      return "M30";
    case "60m":
    case "1h":
      return "H1";
    case "1d":
      return "D";
    default:
      return null;
  }
}

function countForRange(range: string, granularity: string): number {
  // OANDA max count is 5000; pick a sensible window.
  const map: Record<string, number> = {
    "1d": 1440,
    "5d": 5000,
    "1mo": 5000,
    "3mo": 5000,
  };
  if (granularity.startsWith("H") || granularity === "D") {
    return Math.min(map[range] ?? 500, 5000);
  }
  return Math.min(map[range] ?? 720, 5000);
}

/**
 * OHLCV via OANDA candles (practice) — Yahoo fallback path when Yahoo fails.
 */
export async function fetchOandaOhlcv(
  range: string,
  interval: string,
): Promise<OhlcvResult | null> {
  const creds = getOandaCredentials();
  if (!creds) return null;
  const granularity = yahooIntervalToOandaGranularity(interval);
  if (!granularity) return null;

  const url = new URL(
    `${OANDA_API_HOST}/v3/instruments/${OANDA_INSTRUMENT}/candles`,
  );
  url.searchParams.set("granularity", granularity);
  url.searchParams.set("count", String(countForRange(range, granularity)));
  url.searchParams.set("price", "M");

  const res = await fetch(url, {
    headers: oandaAuthHeaders(creds.token),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`oanda ohlcv ${res.status}`);
  }
  const json = (await res.json()) as OandaCandlesResponse;
  const bars: OhlcvBar[] = [];
  for (const c of json.candles ?? []) {
    const open = parsePx(c.mid?.o);
    const high = parsePx(c.mid?.h);
    const low = parsePx(c.mid?.l);
    const close = parsePx(c.mid?.c);
    if (
      open == null ||
      high == null ||
      low == null ||
      close == null ||
      !c.time
    ) {
      continue;
    }
    const tMs = parseOandaTime(c.time);
    bars.push({
      time: Math.floor(tMs / 1000),
      open,
      high,
      low,
      close,
      volume: c.volume ?? 0,
    });
  }
  if (bars.length < 40) return null;
  return {
    bars,
    source: "oanda",
    pair: OANDA_PAIR_LABEL,
    interval,
    asOf: Date.now(),
  };
}
