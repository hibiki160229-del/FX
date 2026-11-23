import type { LiveQuote } from "../types";
import { quoteFromOandaPrice } from "./client";
import {
  getOandaCredentials,
  OANDA_INSTRUMENT,
  OANDA_STREAM_HOST,
  oandaAuthHeaders,
} from "./config";

type StreamHandlers = {
  onQuote: (quote: LiveQuote) => void;
  onHeartbeat?: (time: number) => void;
  onError?: (err: unknown) => void;
  signal?: AbortSignal;
};

/**
 * Connect to OANDA practice pricing stream and parse newline-delimited JSON.
 * Yields at most ~4 prices/sec per instrument + heartbeats every ~5s.
 */
export async function consumeOandaPricingStream(
  handlers: StreamHandlers,
): Promise<"ok" | "unavailable" | "error"> {
  const creds = getOandaCredentials();
  if (!creds) return "unavailable";

  const url = new URL(
    `${OANDA_STREAM_HOST}/v3/accounts/${encodeURIComponent(creds.accountId)}/pricing/stream`,
  );
  url.searchParams.set("instruments", OANDA_INSTRUMENT);
  url.searchParams.set("snapshot", "true");

  let res: Response;
  try {
    res = await fetch(url, {
      headers: oandaAuthHeaders(creds.token),
      cache: "no-store",
      signal: handlers.signal,
    });
  } catch (err) {
    if (handlers.signal?.aborted) return "ok";
    handlers.onError?.(err);
    return "error";
  }

  if (!res.ok || !res.body) {
    handlers.onError?.(new Error(`oanda stream ${res.status}`));
    return res.status === 401 || res.status === 403 ? "unavailable" : "error";
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (handlers.signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        try {
          const msg = JSON.parse(line) as {
            type?: string;
            time?: string;
            bids?: { price?: string }[];
            asks?: { price?: string }[];
          };
          if (msg.type === "HEARTBEAT") {
            handlers.onHeartbeat?.(Date.now());
            continue;
          }
          if (msg.type === "PRICE" || (msg.bids && msg.asks)) {
            const quote = quoteFromOandaPrice(msg, "stream");
            if (quote) handlers.onQuote(quote);
          }
        } catch {
          // skip malformed chunk
        }
      }
    }
    return "ok";
  } catch (err) {
    if (handlers.signal?.aborted) return "ok";
    handlers.onError?.(err);
    return "error";
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}
