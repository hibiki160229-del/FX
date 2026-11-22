import { runAutoAnalysis } from "@/lib/analysis";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/analyze — run historical backtest + param search + optional web extract.
 * Body (optional JSON): { range?, interval?, includeWeb? }
 */
export async function POST(req: Request) {
  try {
    let body: {
      range?: string;
      interval?: string;
      includeWeb?: boolean;
    } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      // empty body ok
    }

    const range =
      typeof body.range === "string" && body.range.length < 12
        ? body.range
        : "3mo";
    const interval =
      typeof body.interval === "string" && body.interval.length < 8
        ? body.interval
        : "1h";
    const includeWeb = body.includeWeb !== false;

    const result = await runAutoAnalysis({
      range,
      interval,
      includeWeb,
      maxCandidates: 120,
    });

    return NextResponse.json(result);
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
      "履歴OHLCVでルール候補をバックテストし、スコア順に返します。",
  });
}
