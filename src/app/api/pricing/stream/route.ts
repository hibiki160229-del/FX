import {
  cacheLiveQuote,
  consumeOandaPricingStream,
  isOandaConfigured,
  providerStatusFromQuote,
  resolveLiveQuote,
  type LiveQuote,
} from "@/lib/providers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** High-freq poll interval when stream host fails or is blocked. */
const POLL_MS = 1_000;

function sseEncode(event: string, data: unknown): Uint8Array {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  return new TextEncoder().encode(payload);
}

/**
 * Server-Sent Events for near-true realtime USD/JPY.
 * Prefers OANDA practice pricing stream; falls back to REST/candle poll.
 */
export async function GET(request: Request) {
  const configured = isOandaConfigured();
  if (!configured) {
    return new Response(
      JSON.stringify({
        error: "oanda_not_configured",
        messageJa:
          "OANDA が未設定です。Secrets に OANDA_API_TOKEN と OANDA_ACCOUNT_ID を追加してください。",
        status: providerStatusFromQuote(null),
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const abort = new AbortController();
  request.signal.addEventListener("abort", () => abort.abort());

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(sseEncode(event, data));
        } catch {
          abort.abort();
        }
      };

      send("status", providerStatusFromQuote(null));

      const emitQuote = (quote: LiveQuote) => {
        cacheLiveQuote(quote);
        send("quote", quote);
        send("status", providerStatusFromQuote(quote));
      };

      // 1) Try true pricing stream
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
            messageJa: "OANDA ストリームエラー — ポーリングに切替えます",
            detail: err instanceof Error ? err.message : "unknown",
          });
        },
      });

      if (abort.signal.aborted) {
        controller.close();
        return;
      }

      // 2) Stream ended or failed → high-freq REST / candle poll
      if (result !== "ok" || !streamOk) {
        send("status", {
          ...providerStatusFromQuote(null),
          detailJa:
            "ストリーム不可 — OANDA REST/S5 ポーリング（約1秒）にフォールバック",
          mode: "poll",
          oandaConfigured: true,
          oandaReachable: null,
          preferred: "oanda",
          activeSource: "oanda",
        });
      }

      while (!abort.signal.aborted) {
        try {
          const quote = await resolveLiveQuote();
          if (quote) emitQuote(quote);
          else {
            send("error", {
              messageJa:
                "OANDA 価格を取得できません。Yahoo フォールバックを利用してください。",
            });
          }
        } catch (err) {
          send("error", {
            messageJa: "OANDA ポーリング失敗",
            detail: err instanceof Error ? err.message : "unknown",
          });
        }
        await sleep(POLL_MS, abort.signal);
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
