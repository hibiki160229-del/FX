import {
  ANALYSIS_INTERVAL_MS,
  TICK_RATE_LIMIT,
} from "@/lib/analysis/loop-config";
import {
  clientKeyFromRequest,
  takeRateLimit,
} from "@/lib/analysis/rate-limit";
import {
  startAnalysisScheduler,
  tickAnalysis,
} from "@/lib/analysis/scheduler";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/analysis/tick — run the loop if due (keepalive / manual).
 * Body (optional): { force?: boolean, includeWeb?: boolean }
 */
export async function POST(req: Request) {
  const key = `tick:${clientKeyFromRequest(req)}`;
  const rl = takeRateLimit(key, TICK_RATE_LIMIT.limit, TICK_RATE_LIMIT.windowMs);
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

  startAnalysisScheduler();

  let body: { force?: boolean; includeWeb?: boolean } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    // empty ok
  }

  const tick = await tickAnalysis({
    force: body.force === true,
    includeWeb: body.includeWeb !== false,
    autoPromote: true,
  });

  return NextResponse.json({
    ok: true,
    ran: tick.ran,
    skippedReason: tick.skippedReason ?? null,
    intervalMs: ANALYSIS_INTERVAL_MS,
    loop: tick.snapshot,
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/analysis/tick",
    method: "POST",
    descriptionJa:
      "期限到来時にバックグラウンド分析を実行し、通過ルールを自動採用します。",
    intervalMs: ANALYSIS_INTERVAL_MS,
  });
}