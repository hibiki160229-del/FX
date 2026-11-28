import { OHLCV_RATE_LIMIT } from "@/lib/analysis/loop-config";
import {
  clientKeyFromRequest,
  takeRateLimit,
} from "@/lib/analysis/rate-limit";
import { fetchUsdJpyOhlcv } from "@/lib/data/fetch-ohlcv";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ALLOWED_RANGES = new Set([
  "1d",
  "5d",
  "7d",
  "8d",
  "60d",
  "1mo",
  "3mo",
  "6mo",
  "1y",
  "2y",
  "5y",
  "ytd",
  "max",
]);
const ALLOWED_INTERVALS = new Set([
  "1m",
  "2m",
  "5m",
  "15m",
  "30m",
  "60m",
  "90m",
  "1h",
  "1d",
  "5d",
  "1wk",
  "1mo",
]);

export async function GET(request: Request) {
  const key = `ohlcv:${clientKeyFromRequest(request)}`;
  const rl = takeRateLimit(key, OHLCV_RATE_LIMIT.limit, OHLCV_RATE_LIMIT.windowMs);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: "リクエストが多すぎます。しばらくしてから再試行してください。",
        retryAfterMs: rl.retryAfterMs,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000) || 1),
        },
      },
    );
  }

  const { searchParams } = new URL(request.url);
  const rangeRaw = searchParams.get("range") ?? "1mo";
  const intervalRaw = searchParams.get("interval") ?? "1h";
  const range = ALLOWED_RANGES.has(rangeRaw) ? rangeRaw : "1mo";
  const interval = ALLOWED_INTERVALS.has(intervalRaw) ? intervalRaw : "1h";

  const payload = await fetchUsdJpyOhlcv(range, interval);
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "private, max-age=15",
    },
  });
}