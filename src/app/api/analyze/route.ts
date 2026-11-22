import {
  ANALYZE_RATE_LIMIT,
  DEFAULT_ANALYSIS_INTERVAL,
  DEFAULT_ANALYSIS_RANGE,
  DEFAULT_MAX_CANDIDATES,
} from "@/lib/analysis/loop-config";
import {
  clientKeyFromRequest,
  takeRateLimit,
} from "@/lib/analysis/rate-limit";
import { tickAnalysis } from "@/lib/analysis/scheduler";
import { getLastAnalysisResult } from "@/lib/analysis/server-store";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/analyze — on-demand analysis (also used as manual re-run).
 * Prefer the always-on loop (`/api/analysis/tick` + scheduler); this endpoint
 * forces a run (subject to min gap + rate limit) and auto-promotes by default.
 * Body (optional JSON): { range?, interval?, includeWeb?, autoPromote? }
 */
export async function POST(req: Request) {
  const key = `analyze:${clientKeyFromRequest(req)}`;
  const rl = takeRateLimit(
    key,
    ANALYZE_RATE_LIMIT.limit,
    ANALYZE_RATE_LIMIT.windowMs,
  );
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

  try {
    let body: {
      range?: string;
      interval?: string;
      includeWeb?: boolean;
      autoPromote?: boolean;
    } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      // empty body ok
    }

    const range =
      typeof body.range === "string" && body.range.length < 12
        ? body.range
        : DEFAULT_ANALYSIS_RANGE;
    const interval =
      typeof body.interval === "string" && body.interval.length < 8
        ? body.interval
        : DEFAULT_ANALYSIS_INTERVAL;
    const includeWeb = body.includeWeb !== false;
    const autoPromote = body.autoPromote !== false;

    const tick = await tickAnalysis({
      force: true,
      includeWeb,
      range,
      interval,
      autoPromote,
    });

    if (!tick.ran && tick.skippedReason === "min_gap") {
      const cached = getLastAnalysisResult();
      if (cached) {
        return NextResponse.json({
          ...cached,
          throttled: true,
          skippedReason: "min_gap",
          loop: tick.snapshot,
        });
      }
      return NextResponse.json(
        {
          error:
            "分析の再実行間隔が短すぎます。1分ほど待ってから再試行してください。",
          skippedReason: "min_gap",
          loop: tick.snapshot,
        },
        { status: 429 },
      );
    }

    if (!tick.ran && tick.skippedReason === "running") {
      return NextResponse.json(
        {
          error: "分析が実行中です。完了までお待ちください。",
          skippedReason: "running",
          loop: tick.snapshot,
        },
        { status: 409 },
      );
    }

    const result = getLastAnalysisResult();
    if (!result) {
      const err = tick.snapshot.lastError ?? "analyze failed";
      return NextResponse.json(
        { error: err, loop: tick.snapshot },
        { status: 500 },
      );
    }

    if (tick.snapshot.state === "error") {
      return NextResponse.json(
        {
          error: tick.snapshot.lastError ?? "analyze failed",
          loop: tick.snapshot,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ...result,
      loop: tick.snapshot,
      maxCandidates: DEFAULT_MAX_CANDIDATES,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "analyze failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/analyze",
    method: "POST",
    descriptionJa:
      "履歴OHLCVでルール候補をバックテストし、スコア順に返します（常時分析の手動再実行用）。",
  });
}