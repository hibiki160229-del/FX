/** Always-on analysis loop defaults. */

/** Background re-run interval (server scheduler + client keepalive). */
export const ANALYSIS_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

/** Shortest gap between forced / manual re-runs. */
export const ANALYSIS_MIN_GAP_MS = 60 * 1000; // 1 minute

/** Analyze POST: max requests per client per window. */
export const ANALYZE_RATE_LIMIT = { limit: 3, windowMs: 60_000 };

/** OHLCV GET: max requests per client per window. */
export const OHLCV_RATE_LIMIT = { limit: 30, windowMs: 60_000 };

/** Tick / status keepalive: max per client per window. */
export const TICK_RATE_LIMIT = { limit: 12, windowMs: 60_000 };

export const DEFAULT_ANALYSIS_RANGE = "3mo";
export const DEFAULT_ANALYSIS_INTERVAL = "1h";
export const DEFAULT_MAX_CANDIDATES = 120;
