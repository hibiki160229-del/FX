import {
  ANALYSIS_INTERVAL_MS,
  ANALYSIS_MIN_GAP_MS,
  DEFAULT_ANALYSIS_INTERVAL,
  DEFAULT_ANALYSIS_RANGE,
  DEFAULT_MAX_CANDIDATES,
} from "./loop-config";
import { runAutoAnalysis } from "./pipeline";
import {
  beginRun,
  finishRunError,
  finishRunOk,
  getAnalysisStore,
  getLoopSnapshot,
  type AnalysisLoopSnapshot,
} from "./server-store";

export type TickOptions = {
  /** Bypass the normal interval (still respects min gap unless forceHard). */
  force?: boolean;
  /** Bypass min gap too (admin / first boot only). */
  forceHard?: boolean;
  includeWeb?: boolean;
  range?: string;
  interval?: string;
  autoPromote?: boolean;
};

export type TickResult = {
  ran: boolean;
  skippedReason?: "running" | "not_due" | "min_gap";
  snapshot: AnalysisLoopSnapshot;
};

const g = globalThis as typeof globalThis & {
  __enmyakuScheduler?: {
    started: boolean;
    timer: ReturnType<typeof setInterval> | null;
  };
};

function schedulerState() {
  if (!g.__enmyakuScheduler) {
    g.__enmyakuScheduler = { started: false, timer: null };
  }
  return g.__enmyakuScheduler;
}

function due(
  lastRunAt: number | null,
  intervalMs: number,
  now = Date.now(),
): boolean {
  if (lastRunAt == null) return true;
  return now - lastRunAt >= intervalMs;
}

/**
 * Run one analysis cycle if due (or forced). Auto-promotes winners by default.
 */
export async function tickAnalysis(
  opts: TickOptions = {},
): Promise<TickResult> {
  const store = getAnalysisStore();
  const force = opts.force === true;
  const forceHard = opts.forceHard === true;
  const autoPromote = opts.autoPromote !== false;
  const now = Date.now();

  if (store.state === "running") {
    return { ran: false, skippedReason: "running", snapshot: getLoopSnapshot() };
  }

  if (!forceHard) {
    if (!force && !due(store.lastRunAt, ANALYSIS_INTERVAL_MS, now)) {
      return {
        ran: false,
        skippedReason: "not_due",
        snapshot: getLoopSnapshot(),
      };
    }
    if (force && !due(store.lastRunAt, ANALYSIS_MIN_GAP_MS, now)) {
      return {
        ran: false,
        skippedReason: "min_gap",
        snapshot: getLoopSnapshot(),
      };
    }
  }

  if (!beginRun(store)) {
    return { ran: false, skippedReason: "running", snapshot: getLoopSnapshot() };
  }

  try {
    const result = await runAutoAnalysis({
      range: opts.range ?? DEFAULT_ANALYSIS_RANGE,
      interval: opts.interval ?? DEFAULT_ANALYSIS_INTERVAL,
      includeWeb: opts.includeWeb !== false,
      maxCandidates: DEFAULT_MAX_CANDIDATES,
    });
    const nextRunAt = Date.now() + ANALYSIS_INTERVAL_MS;
    finishRunOk(result, { autoPromote, nextRunAt }, store);
    return { ran: true, snapshot: getLoopSnapshot() };
  } catch (err) {
    const message = err instanceof Error ? err.message : "analysis failed";
    const nextRunAt = Date.now() + ANALYSIS_INTERVAL_MS;
    finishRunError(message, nextRunAt, store);
    return { ran: true, snapshot: getLoopSnapshot() };
  }
}

/** Start the in-process interval worker (idempotent). Safe for Node runtime only. */
export function startAnalysisScheduler() {
  const sched = schedulerState();
  if (sched.started) return;
  sched.started = true;

  const store = getAnalysisStore();
  if (store.nextRunAt == null) {
    store.nextRunAt = Date.now();
  }

  // Kick soon after boot without blocking register().
  void tickAnalysis({ forceHard: true }).catch(() => {
    /* logged via store */
  });

  sched.timer = setInterval(() => {
    void tickAnalysis().catch(() => {
      /* store captures error */
    });
  }, Math.min(ANALYSIS_INTERVAL_MS, 60_000));

  // Don't keep the process alive solely for the timer in some runtimes.
  if (typeof sched.timer === "object" && sched.timer && "unref" in sched.timer) {
    (sched.timer as NodeJS.Timeout).unref?.();
  }
}

export function stopAnalysisScheduler() {
  const sched = schedulerState();
  if (sched.timer) {
    clearInterval(sched.timer);
    sched.timer = null;
  }
  sched.started = false;
}

export function isAnalysisSchedulerStarted() {
  return schedulerState().started;
}
