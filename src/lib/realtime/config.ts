/**
 * Near-realtime desk defaults.
 * Prefer OANDA practice tick stream; Yahoo 1m poll remains the OHLCV backbone / fallback.
 */

/** Client chart / signal OHLCV poll while the desk tab is visible. */
export const DESK_POLL_MS = 30_000; // 30s (within 15–60s)

/** Pause OHLCV polling when the tab is hidden this long before the next tick. */
export const DESK_HIDDEN_POLL_MS = 120_000;

/** Live desk candle size / lookback (Yahoo 1m max ≈ 7d). */
export const DESK_OHLCV_RANGE = "5d";
export const DESK_OHLCV_INTERVAL = "1m";

/** Chart pane shows a recent window; signals still use the full poll payload. */
export const DESK_CHART_MAX_BARS = 720; // ~12h of 1m

/** Treat OHLCV mark as “live” if last server asOf is within this window. */
export const DESK_FRESH_MS = DESK_POLL_MS * 2;

/** OANDA tick age → still show as ライブ. */
export const OANDA_FRESH_MS = 5_000;

/** Client fallback poll to /api/pricing when SSE is unavailable. */
export const OANDA_POLL_MS = 1_000;

/** Hidden-tab pricing poll. */
export const OANDA_HIDDEN_POLL_MS = 5_000;

/** Hero backdrop can stay coarser — atmosphere, not trading. */
export const HERO_OHLCV_RANGE = "1mo";
export const HERO_OHLCV_INTERVAL = "1h";

export const INTERVAL_LABEL_JA: Record<string, string> = {
  "1m": "1分足",
  "2m": "2分足",
  "5m": "5分足",
  "15m": "15分足",
  "30m": "30分足",
  "60m": "1時間足",
  "1h": "1時間足",
  "1d": "日足",
};

export function intervalLabelJa(interval: string): string {
  return INTERVAL_LABEL_JA[interval] ?? interval;
}
