/**
 * Twelve Data — preferred OHLCV when TWELVE_DATA_API_KEY is set.
 * Yahoo remains the zero-secret fallback.
 *
 * Free Basic (as of 2026-11): 8 API credits/min, 800/day.
 * `/time_series` costs 1 credit per symbol. outputsize ≤ 5000;
 * longer history uses start_date/end_date paging windows.
 *
 * @see https://twelvedata.com/docs/market-data/time-series
 * @see https://twelvedata.com/pricing
 */

export const TWELVE_DATA_SYMBOL = "USD/JPY";
export const TWELVE_DATA_PAIR_LABEL = "USD/JPY" as const;
export const TWELVE_DATA_API_HOST = "https://api.twelvedata.com";

/** Max bars per /time_series response. */
export const TWELVE_DATA_MAX_OUTPUTSIZE = 5000;

/**
 * Free-tier rate limits (Basic). Paid plans differ; keep conservative
 * defaults so paging stays under 8 credits/min without a plan probe.
 */
export const TWELVE_DATA_FREE_CREDITS_PER_MIN = 8;
export const TWELVE_DATA_FREE_CREDITS_PER_DAY = 800;

/** Minimum gap between credits so we stay under 8/min (with small buffer). */
export const TWELVE_DATA_MIN_CREDIT_GAP_MS = Math.ceil(
  60_000 / TWELVE_DATA_FREE_CREDITS_PER_MIN,
) + 250;

export function getTwelveDataApiKey(): string | null {
  const key = process.env.TWELVE_DATA_API_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

export function isTwelveDataConfigured(): boolean {
  return getTwelveDataApiKey() != null;
}
