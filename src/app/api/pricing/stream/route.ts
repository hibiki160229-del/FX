import {
  cacheLiveQuote,
  consumeOandaPricingStream,
  getCachedLiveQuote,
  isOandaConfigured,
  providerStatusFromQuote,
  resolveLiveQuote,
  type LiveQuote,
} from "@/lib/providers";
import { YAHOO_SSE_POLL_MS } from "@/lib/realtime/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sseEncode(event: string, data: unknown): Uint8Array {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  return new TextEncoder().encode(payload);
}

/**
 * Server-Sent Events for near-realtime USD/JPY.
 * Primary: Yahoo Finance poll (zero secrets).
 * Optional: OANDA practice stream when secrets are set, then REST/S5, then Yahoo.
 */
export async function GET(request: Request) {
  const abort = new AbortController();
  request.signal.addEventListener("abort", () => abort.abort());
  const oandaConfigured = isOandaConfigured();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(sseEncode(event, data));
        } catch {
          abort.abort();
        }
      };

      send("status", {
        ...providerStatusFromQuote(null),
        detailJa: oandaConfigured
          ? "接続中…（任意の OANDA ストリームを試行、失敗時は Yahoo）"
          : "接続中…（Yahoo Finance ポーリング）",
      });

      const emitQuote = (quote: LiveQuote) => {
        cacheLiveQuote(quote);
        send("quote", quote);
        send("status", providerStatusFromQuote(quote));
      };

      // Optional OANDA stream upgrade when secrets exist
      if (oandaConfigured) {
        let streamOk = false;
        const result = await consumeOandaPricingStream({
          signal: abort.signal,
          onQuote: (q) => {
            streamOk = true;
            emitQuote(q);
          },
          onHeartbeat: () => {
            send("heartbeat", { t: Date.now() });
          },
          onError: (err) => {
            send("error", {
              messageJa: "OANDA ストリームエラー — Yahoo ポーリングに切替えます",
              detail: err instanceof Error ? err.message : "unknown",
            });
          },
        });

        if (abort.signal.aborted) {
          controller.close();
          return;
        }

        if (result === "ok" && streamOk) {
          // Stream ended cleanly after quotes — fall through to poll keep-alive
          send("status", {
            ...providerStatusFromQuote(getCachedLiveQuote()),
            detailJa:
              "OANDA ストリーム終了 — Yahoo / OANDA ポーリングで継続",
          });
        } else if (!streamOk) {
          send("status", {
            ...providerStatusFromQuote(null),
            detailJa:
              "OANDA ストリーム不可 — Yahoo 準リアルタイム（約2秒）にフォールバック",
            mode: "poll",
            preferred: "yahoo",
            activeSource: "yahoo",
          });
        }
      }

      // Yahoo-primary poll keep-alive (OANDA remains optional via stream above)
      while (!abort.signal.aborted) {
        try {
          const quote = await resolveLiveQuote();
          if (quote) emitQuote(quote);
          else {
            send("error", {
              messageJa: "ライブ価格を取得できません。OHLCV フォールバックを利用します。",
            });
          }
        } catch (err) {
          send("error", {
            messageJa: "価格ポーリング失敗",
            detail: err instanceof Error ? err.message : "unknown",
          });
        }
        await sleep(YAHOO_SSE_POLL_MS, abort.signal);
      }

      try {
        controller.close();
      } catch {
        // already closed
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const t = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true },
    );
  });
}
