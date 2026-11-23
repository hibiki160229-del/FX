import type { LiveQuote, ProviderStatus } from "./types";
import {
  fetchOandaCandleQuote,
  fetchOandaPricingQuote,
  isOandaConfigured,
} from "./oanda";

const g = globalThis as typeof globalThis & {
  __enmyakuLiveQuote?: LiveQuote | null;
};

export function cacheLiveQuote(quote: LiveQuote | null) {
  g.__enmyakuLiveQuote = quote;
}

export function getCachedLiveQuote(): LiveQuote | null {
  return g.__enmyakuLiveQuote ?? null;
}

/**
 * Resolve a live USD/JPY quote:
 * 1. OANDA REST pricing (practice)
 * 2. OANDA S5 candle mid (if pricing blocked)
 * Returns null when credentials missing or both paths fail.
 */
export async function resolveLiveQuote(): Promise<LiveQuote | null> {
  if (!isOandaConfigured()) return null;

  try {
    const quote = await fetchOandaPricingQuote();
    if (quote) {
      cacheLiveQuote(quote);
      return quote;
    }
  } catch {
    // fall through to candles
  }

  try {
    const quote = await fetchOandaCandleQuote("S5");
    if (quote) {
      cacheLiveQuote(quote);
      return quote;
    }
  } catch {
    // give up — caller falls back to Yahoo OHLCV close
  }

  return null;
}

export function providerStatusFromQuote(
  quote: LiveQuote | null,
): ProviderStatus {
  const configured = isOandaConfigured();
  if (!configured) {
    return {
      preferred: "oanda",
      oandaConfigured: false,
      oandaReachable: null,
      activeSource: "yahoo",
      mode: "ohlcv",
      detailJa:
        "OANDA 未設定 — Yahoo ポーリングを使用中。Secrets に OANDA_API_TOKEN / OANDA_ACCOUNT_ID を追加してください。",
    };
  }
  if (!quote) {
    return {
      preferred: "oanda",
      oandaConfigured: true,
      oandaReachable: false,
      activeSource: "yahoo",
      mode: "ohlcv",
      detailJa:
        "OANDA に接続できません — Yahoo にフォールバック中。api-fxpractice.oanda.com / stream-fxpractice.oanda.com を確認してください。",
    };
  }
  const modeJa =
    quote.mode === "stream"
      ? "ティックストリーム"
      : quote.mode === "candle"
        ? "S5足ポーリング"
        : "価格ポーリング";
  return {
    preferred: "oanda",
    oandaConfigured: true,
    oandaReachable: true,
    activeSource: "oanda",
    mode: quote.mode,
    detailJa: `OANDA デモ（${modeJa}）`,
  };
}
