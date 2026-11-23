/** Always-on analysis loop defaults (heavy rule discovery). */

/**
 * Background re-run interval (server scheduler + client keepalive).
 * Near-realtime v1: 5 min — feasible on serverless/host; desk signals
 * refresh separately every DESK_POLL_MS via OHLCV poll.
 */
export const ANALYSIS_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/** Shortest gap between forced / manual re-runs. */
export const ANALYSIS_MIN_GAP_MS = 60 * 1000; // 1 minute

/** Analyze POST: max requests per client per window. */
export const ANALYZE_RATE_LIMIT = { limit: 3, windowMs: 60_000 };

/** OHLCV GET: max requests per client per window (desk polls ~2/min). */
export const OHLCV_RATE_LIMIT = { limit: 60, windowMs: 60_000 };

/** Tick / status keepalive: max per client per window. */
export const TICK_RATE_LIMIT = { limit: 30, windowMs: 60_000 };

/** Client status poll / keepalive while desk is open. */
export const ANALYSIS_STATUS_POLL_MS = 30_000;
export const ANALYSIS_KEEPALIVE_MS = 45_000;

/** Scheduler wake interval (checks due; actual run uses ANALYSIS_INTERVAL_MS). */
export const ANALYSIS_SCHEDULER_CHECK_MS = 30_000;

/** Rule discovery still uses hourly history for stable backtests. */
export const DEFAULT_ANALYSIS_RANGE = "3mo";
export const DEFAULT_ANALYSIS_INTERVAL = "1h";
export const DEFAULT_MAX_CANDIDATES = 120;
