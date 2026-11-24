import type { LiveQuote, ProviderStatus } from "./types";
import {
  fetchOandaCandleQuote,
  fetchOandaPricingQuote,
  isOandaConfigured,
} from "./oanda";
import { fetchYahooLiveQuote } from "./yahoo";

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
 * Resolve a live USD/JPY quote (best-effort near-realtime):
 * 1. Yahoo Finance chart meta poll — primary, zero secrets
 * 2. Optional OANDA practice REST / S5 — only when secrets are set
 * Returns null only if every available path fails.
 */
export async function resolveLiveQuote(): Promise<LiveQuote | null> {
  try {
    const yahoo = await fetchYahooLiveQuote();
    if (yahoo) {
      cacheLiveQuote(yahoo);
      return yahoo;
    }
  } catch {
    // fall through to optional OANDA
  }

  if (!isOandaConfigured()) return getCachedLiveQuote();

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
    // give up
  }

  return getCachedLiveQuote();
}

export function providerStatusFromQuote(
  quote: LiveQuote | null,
): ProviderStatus {
  const oandaConfigured = isOandaConfigured();

  if (quote?.source === "oanda") {
    const modeJa =
      quote.mode === "stream"
        ? "ティックストリーム"
        : quote.mode === "candle"
          ? "S5足ポーリング"
          : "価格ポーリング";
    return {
      preferred: "yahoo",
      oandaConfigured,
      oandaReachable: true,
      activeSource: "oanda",
      mode: quote.mode,
      detailJa: `OANDA デモ（${modeJa}・任意）`,
    };
  }

  if (quote?.source === "yahoo") {
    return {
      preferred: "yahoo",
      oandaConfigured,
      oandaReachable: null,
      activeSource: "yahoo",
      mode: quote.mode,
      detailJa: "Yahoo Finance 準リアルタイム（約1–5秒ポーリング・APIキー不要）",
    };
  }

  return {
    preferred: "yahoo",
    oandaConfigured,
    oandaReachable: oandaConfigured ? false : null,
    activeSource: null,
    mode: null,
    detailJa: oandaConfigured
      ? "価格取得失敗 — Yahoo / OANDA を再試行中"
      : "価格取得失敗 — Yahoo を再試行中（OANDA は任意・未設定でも動作）",
  };
}
