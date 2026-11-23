import { OHLCV_RATE_LIMIT } from "@/lib/analysis/loop-config";
import {
  clientKeyFromRequest,
  takeRateLimit,
} from "@/lib/analysis/rate-limit";
import {
  getCachedLiveQuote,
  isOandaConfigured,
  providerStatusFromQuote,
  resolveLiveQuote,
} from "@/lib/providers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Snapshot live USD/JPY quote (OANDA practice → null if unavailable). */
export async function GET(request: Request) {
  const key = `pricing:${clientKeyFromRequest(request)}`;
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

  const configured = isOandaConfigured();
  if (!configured) {
    return NextResponse.json({
      configured: false,
      quote: null,
      status: providerStatusFromQuote(null),
    });
  }

  let quote = getCachedLiveQuote();
  const stale =
    !quote || Date.now() - quote.time > 5_000;
  if (stale) {
    try {
      quote = await resolveLiveQuote();
    } catch {
      quote = getCachedLiveQuote();
    }
  }

  return NextResponse.json({
    configured: true,
    quote,
    status: providerStatusFromQuote(quote),
  });
}
