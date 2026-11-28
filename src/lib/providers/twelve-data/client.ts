import type { OhlcvBar } from "@/lib/types";
import type { OhlcvResult } from "../types";
import {
  getTwelveDataApiKey,
  TWELVE_DATA_API_HOST,
  TWELVE_DATA_FREE_CREDITS_PER_DAY,
  TWELVE_DATA_MAX_OUTPUTSIZE,
  TWELVE_DATA_MIN_CREDIT_GAP_MS,
  TWELVE_DATA_PAIR_LABEL,
  TWELVE_DATA_SYMBOL,
} from "./config";

type TwelveValue = {
  datetime?: string;
  open?: string;
  high?: string;
  low?: string;
  close?: string;
  volume?: string;
};

type TwelveTimeSeriesResponse = {
  meta?: { symbol?: string; interval?: string };
  values?: TwelveValue[];
  status?: string;
  code?: number | string;
  message?: string;
};

/** Yahoo-style interval → Twelve Data interval. */
export function yahooIntervalToTwelve(
  interval: string,
): string | null {
  switch (interval) {
    case "1m":
      return "1min";
    case "5m":
      return "5min";
    case "15m":
      return "15min";
    case "30m":
      return "30min";
    case "45m":
      return "45min";
    case "60m":
    case "1h":
      return "1h";
    case "2h":
      return "2h";
    case "4h":
      return "4h";
    case "1d":
      return "1day";
    case "1wk":
      return "1week";
    case "1mo":
      return "1month";
    default:
      return null;
  }
}

/** Approximate calendar minutes per bar for paging math. */
function minutesPerBar(twelveInterval: string): number {
  switch (twelveInterval) {
    case "1min":
      return 1;
    case "5min":
      return 5;
    case "15min":
      return 15;
    case "30min":
      return 30;
    case "45min":
      return 45;
    case "1h":
      return 60;
    case "2h":
      return 120;
    case "4h":
      return 240;
    case "1day":
      return 1440;
    case "1week":
      return 10080;
    case "1month":
      return 43200;
    default:
      return 60;
  }
}

/** Yahoo-style range → lookback days (prefer ~1y when Twelve Data is used). */
export function rangeToLookbackDays(range: string): number {
  const now = new Date();
  switch (range) {
    case "1d":
      return 1;
    case "5d":
      return 5;
    case "7d":
      return 7;
    case "8d":
      return 8;
    case "60d":
      return 60;
    case "1mo":
      return 30;
    case "3mo":
      return 90;
    case "6mo":
      return 180;
    case "1y":
      return 365;
    case "2y":
      return 730;
    case "5y":
      return 1825;
    case "ytd": {
      const start = Date.UTC(now.getUTCFullYear(), 0, 1);
      return Math.max(
        1,
        Math.ceil((Date.now() - start) / (24 * 60 * 60 * 1000)),
      );
    }
    case "max":
      // Cap 1m paging under free daily credits; ~1y is the preferred window.
      return 365;
    default:
      return 30;
  }
}

function formatUtcDateTime(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

function parseBar(v: TwelveValue): OhlcvBar | null {
  if (!v.datetime) return null;
  const open = Number(v.open);
  const high = Number(v.high);
  const low = Number(v.low);
  const close = Number(v.close);
  if (
    !Number.isFinite(open) ||
    !Number.isFinite(high) ||
    !Number.isFinite(low) ||
    !Number.isFinite(close)
  ) {
    return null;
  }
  // Twelve datetime is UTC for forex (no Z); treat as UTC.
  const iso = /Z$|[+-]\d{2}:?\d{2}$/.test(v.datetime)
    ? v.datetime
    : `${v.datetime.replace(" ", "T")}Z`;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  const volume = v.volume != null ? Number(v.volume) : 0;
  return {
    time: Math.floor(ms / 1000),
    open,
    high,
    low,
    close,
    volume: Number.isFinite(volume) ? volume : 0,
  };
}

const g = globalThis as typeof globalThis & {
  __enmyakuTwelveCreditAt?: number[];
  __enmyakuTwelveAuthFailed?: boolean;
};

function creditTimestamps(): number[] {
  if (!g.__enmyakuTwelveCreditAt) g.__enmyakuTwelveCreditAt = [];
  return g.__enmyakuTwelveCreditAt;
}

function markAuthFailed(): void {
  g.__enmyakuTwelveAuthFailed = true;
}

function isAuthFailed(): boolean {
  return g.__enmyakuTwelveAuthFailed === true;
}

/** Pace requests under free-tier 8 credits/min. */
async function awaitCreditSlot(): Promise<void> {
  const stamps = creditTimestamps();
  const now = Date.now();
  // Drop stamps older than 60s.
  while (stamps.length > 0 && now - stamps[0]! >= 60_000) {
    stamps.shift();
  }
  if (stamps.length >= 8) {
    const wait = 60_000 - (now - stamps[0]!) + 50;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  } else if (stamps.length > 0) {
    const sinceLast = now - stamps[stamps.length - 1]!;
    if (sinceLast < TWELVE_DATA_MIN_CREDIT_GAP_MS) {
      await new Promise((r) =>
        setTimeout(r, TWELVE_DATA_MIN_CREDIT_GAP_MS - sinceLast),
      );
    }
  }
  stamps.push(Date.now());
  // Soft daily guard: keep last 24h count for diagnostics (not hard-block).
  while (stamps.length > TWELVE_DATA_FREE_CREDITS_PER_DAY) {
    stamps.shift();
  }
}

async function fetchWindow(
  apiKey: string,
  twelveInterval: string,
  startMs: number,
  endMs: number,
): Promise<OhlcvBar[]> {
  await awaitCreditSlot();
  const url = new URL(`${TWELVE_DATA_API_HOST}/time_series`);
  url.searchParams.set("symbol", TWELVE_DATA_SYMBOL);
  url.searchParams.set("interval", twelveInterval);
  url.searchParams.set("start_date", formatUtcDateTime(startMs));
  url.searchParams.set("end_date", formatUtcDateTime(endMs));
  url.searchParams.set("outputsize", String(TWELVE_DATA_MAX_OUTPUTSIZE));
  url.searchParams.set("timezone", "UTC");
  url.searchParams.set("order", "ASC");
  url.searchParams.set("apikey", apiKey);

  // Build request without logging the URL (contains apikey).
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "EnmyakuFX/1.0" },
    cache: "no-store",
  });
  const json = (await res.json()) as TwelveTimeSeriesResponse;
  if (!res.ok || json.status === "error" || json.code) {
    const code = Number(json.code ?? res.status);
    if (code === 401 || code === 403) markAuthFailed();
    // Never log URL/apikey; status code only.
    throw new Error(`twelve_data ${code}`);
  }
  const bars: OhlcvBar[] = [];
  for (const v of json.values ?? []) {
    const bar = parseBar(v);
    if (bar) bars.push(bar);
  }
  return bars;
}

function mergeUniqueSorted(chunks: OhlcvBar[][]): OhlcvBar[] {
  const byTime = new Map<number, OhlcvBar>();
  for (const chunk of chunks) {
    for (const b of chunk) byTime.set(b.time, b);
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

/**
 * Fetch USD/JPY OHLCV via Twelve Data with paging for long history.
 * Prefers ~1y for 1m when credits allow (free: 8/min, 800/day).
 */
export async function fetchTwelveDataOhlcv(
  range: string,
  interval: string,
): Promise<OhlcvResult | null> {
  const apiKey = getTwelveDataApiKey();
  if (!apiKey) return null;
  // Skip further calls after 401/403 until process restart / new key.
  if (isAuthFailed()) return null;

  const twelveInterval = yahooIntervalToTwelve(interval);
  if (!twelveInterval) return null;

  const days = rangeToLookbackDays(range);
  const endMs = Date.now();
  const startMs = endMs - days * 24 * 60 * 60 * 1000;
  const barMin = minutesPerBar(twelveInterval);
  // Window length in ms so each page stays ≤ 5000 bars (calendar upper bound).
  const windowMs = TWELVE_DATA_MAX_OUTPUTSIZE * barMin * 60 * 1000;
  // Overlap 1 bar to avoid gaps at page edges.
  const overlapMs = barMin * 60 * 1000;

  const chunks: OhlcvBar[][] = [];
  let pageEnd = endMs;
  let pages = 0;
  const stepMs = Math.max(windowMs - overlapMs, barMin * 60 * 1000);
  const maxPages = Math.min(
    TWELVE_DATA_FREE_CREDITS_PER_DAY,
    Math.ceil((endMs - startMs) / stepMs) + 2,
  );

  while (pageEnd > startMs && pages < maxPages) {
    const pageStart = Math.max(startMs, pageEnd - windowMs);
    const chunk = await fetchWindow(
      apiKey,
      twelveInterval,
      pageStart,
      pageEnd,
    );
    pages += 1;
    if (chunk.length === 0) break;
    chunks.push(chunk);
    if (pageStart <= startMs) break;
    // Slide window back with 1-bar overlap to avoid edge gaps.
    pageEnd = pageStart + overlapMs;
  }

  const bars = mergeUniqueSorted(chunks).filter(
    (b) => b.time * 1000 >= startMs - 60_000,
  );
  if (bars.length < 40) return null;

  return {
    bars,
    source: "twelve_data",
    pair: TWELVE_DATA_PAIR_LABEL,
    interval,
    asOf: Date.now(),
  };
}
