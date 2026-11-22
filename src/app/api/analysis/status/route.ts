import { ANALYSIS_INTERVAL_MS } from "@/lib/analysis/loop-config";
import {
  isAnalysisSchedulerStarted,
  startAnalysisScheduler,
} from "@/lib/analysis/scheduler";
import {
  getLastAnalysisResult,
  getLoopSnapshot,
} from "@/lib/analysis/server-store";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/analysis/status — last-run snapshot for the always-on loop.
 */
export async function GET() {
  // Ensure the loop is armed even if instrumentation was skipped (some hosts).
  startAnalysisScheduler();
  const snapshot = getLoopSnapshot();
  const last = getLastAnalysisResult();
  return NextResponse.json({
    ok: true,
    loop: {
      intervalMs: ANALYSIS_INTERVAL_MS,
      schedulerStarted: isAnalysisSchedulerStarted(),
      ...snapshot,
    },
    result: last,
  });
}