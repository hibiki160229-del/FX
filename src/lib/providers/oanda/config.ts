/**
 * OANDA fxTrade Practice (demo) endpoints.
 * @see https://developer.oanda.com/rest-live-v20/development-guide/
 */

export const OANDA_INSTRUMENT = "USD_JPY";
export const OANDA_PAIR_LABEL = "USD/JPY" as const;

/** REST API — practice / demo */
export const OANDA_API_HOST = "https://api-fxpractice.oanda.com";

/** Streaming API — practice / demo (pricing stream) */
export const OANDA_STREAM_HOST = "https://stream-fxpractice.oanda.com";

/**
 * Env secrets (bind via Cursor app secrets — never commit values):
 * - OANDA_API_TOKEN — personal access token from OANDA practice account
 * - OANDA_ACCOUNT_ID — practice account id (e.g. 101-001-…)
 */
export function getOandaCredentials(): {
  token: string;
  accountId: string;
} | null {
  const token = process.env.OANDA_API_TOKEN?.trim();
  const accountId = process.env.OANDA_ACCOUNT_ID?.trim();
  if (!token || !accountId) return null;
  return { token, accountId };
}

export function isOandaConfigured(): boolean {
  return getOandaCredentials() != null;
}

export function oandaAuthHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Accept-Datetime-Format": "UNIX",
  };
}
