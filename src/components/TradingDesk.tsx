"use client";

import { AutoAnalysis } from "@/components/AutoAnalysis";
import { CandlestickChart } from "@/components/CandlestickChart";
import { EntryAlerts } from "@/components/EntryAlerts";
import { IndicatorToggles } from "@/components/IndicatorToggles";
import { PaperTrading } from "@/components/PaperTrading";
import { SignalHints } from "@/components/SignalHints";
import { buildEntryAlerts } from "@/lib/alerts";
import { loadSignalRuleSet } from "@/lib/analysis";
import type { OhlcvPayload } from "@/lib/data/fetch-ohlcv";
import type { LiveQuote, ProviderStatus } from "@/lib/providers/types";
import { loadPaperState } from "@/lib/paper/storage";
import {
  applyLiveMark,
  DESK_CHART_MAX_BARS,
  DESK_FRESH_MS,
  DESK_HIDDEN_POLL_MS,
  DESK_OHLCV_INTERVAL,
  DESK_OHLCV_RANGE,
  DESK_POLL_MS,
  intervalLabelJa,
  OANDA_FRESH_MS,
  OANDA_HIDDEN_POLL_MS,
  OANDA_POLL_MS,
} from "@/lib/realtime";
import {
  DEFAULT_RULE_SET,
  evaluateSignals,
  latestBias,
  type SignalRuleSet,
} from "@/lib/signals";
import type { IndicatorState, PaperState } from "@/lib/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_INDICATORS: IndicatorState = {
  ma: true,
  ema: false,
  rsi: true,
  macd: false,
  bb: true,
};

type Props = {
  initial: OhlcvPayload;
};

type PricingApiResponse = {
  configured: boolean;
  quote: LiveQuote | null;
  status: ProviderStatus;
};

function formatUpdatedAt(ms: number) {
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleTimeString("ja-JP");
  }
}

function ohlcvSourceLabel(source: OhlcvPayload["source"]) {
  if (source === "oanda") return "OANDA デモ足";
  if (source === "yahoo") return "Yahoo 足";
  return "サンプルデータ";
}

export function TradingDesk({ initial }: Props) {
  const [payload, setPayload] = useState(initial);
  const [liveQuote, setLiveQuote] = useState<LiveQuote | null>(null);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(
    null,
  );
  const [indicators, setIndicators] = useState<IndicatorState>(DEFAULT_INDICATORS);
  const [paper, setPaper] = useState<PaperState | null>(null);
  const [ruleSet, setRuleSet] = useState<SignalRuleSet>(DEFAULT_RULE_SET);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [pollError, setPollError] = useState<string | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    setPaper(loadPaperState());
    setRuleSet(loadSignalRuleSet());
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, []);

  const liveBars = useMemo(() => {
    if (!liveQuote) return payload.bars;
    return applyLiveMark(payload.bars, liveQuote, 60);
  }, [payload.bars, liveQuote]);

  const mark = liveQuote?.mid ?? liveBars.at(-1)?.close ?? 0;
  const hints = useMemo(
    () => evaluateSignals(liveBars, ruleSet),
    [liveBars, ruleSet],
  );
  const entryAlerts = useMemo(
    () => buildEntryAlerts(hints, liveBars, mark),
    [hints, liveBars, mark],
  );
  const bias = latestBias(hints);
  const chartBars = useMemo(() => {
    if (liveBars.length <= DESK_CHART_MAX_BARS) return liveBars;
    return liveBars.slice(-DESK_CHART_MAX_BARS);
  }, [liveBars]);

  const quoteAgeMs = liveQuote ? now - liveQuote.time : Number.POSITIVE_INFINITY;
  const oandaLive = Boolean(liveQuote && quoteAgeMs <= OANDA_FRESH_MS);
  const ohlcvAgeMs = now - payload.asOf;
  const ohlcvLive = ohlcvAgeMs <= DESK_FRESH_MS;
  const isLive = oandaLive || ohlcvLive;
  const updatedAt = liveQuote?.time ?? payload.asOf;
  const intervalJa = intervalLabelJa(payload.interval);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (!opts?.silent) setLoading(true);
    try {
      const qs = new URLSearchParams({
        range: DESK_OHLCV_RANGE,
        interval: DESK_OHLCV_INTERVAL,
      });
      const res = await fetch(`/api/ohlcv?${qs}`, { cache: "no-store" });
      if (!res.ok) {
        setPollError("相場データの取得に失敗しました");
        return;
      }
      const json = (await res.json()) as OhlcvPayload;
      setPayload(json);
      setPollError(null);
    } catch {
      setPollError("相場データの取得に失敗しました");
    } finally {
      inFlight.current = false;
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  // Near-realtime OHLCV poll while desk is open; slower when tab hidden.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const schedule = (ms: number) => {
      if (cancelled) return;
      timer = setTimeout(tick, ms);
    };

    const tick = () => {
      if (cancelled) return;
      const hidden =
        typeof document !== "undefined" &&
        document.visibilityState === "hidden";
      void refresh({ silent: true }).finally(() => {
        schedule(hidden ? DESK_HIDDEN_POLL_MS : DESK_POLL_MS);
      });
    };

    schedule(DESK_POLL_MS);

    const onVis = () => {
      if (document.visibilityState === "visible") {
        if (timer) clearTimeout(timer);
        void refresh({ silent: true }).finally(() => schedule(DESK_POLL_MS));
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  // OANDA practice stream (SSE) with REST poll fallback.
  useEffect(() => {
    let cancelled = false;
    let es: EventSource | null = null;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let polling = false;
    let sseErrors = 0;

    const applyPricing = (body: PricingApiResponse) => {
      if (cancelled) return;
      setProviderStatus(body.status);
      if (body.quote) setLiveQuote(body.quote);
    };

    const pollOnce = async () => {
      try {
        const res = await fetch("/api/pricing", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as PricingApiResponse;
        applyPricing(json);
        return json;
      } catch {
        return null;
      }
    };

    const schedulePoll = () => {
      if (cancelled || !polling) return;
      const hidden =
        typeof document !== "undefined" &&
        document.visibilityState === "hidden";
      pollTimer = setTimeout(() => {
        void pollOnce().finally(schedulePoll);
      }, hidden ? OANDA_HIDDEN_POLL_MS : OANDA_POLL_MS);
    };

    const startPoll = () => {
      if (polling) return;
      polling = true;
      if (es) {
        es.close();
        es = null;
      }
      void pollOnce().finally(schedulePoll);
    };

    const startSse = () => {
      try {
        es = new EventSource("/api/pricing/stream");
        es.addEventListener("quote", (ev) => {
          sseErrors = 0;
          try {
            const quote = JSON.parse((ev as MessageEvent).data) as LiveQuote;
            if (!cancelled) setLiveQuote(quote);
          } catch {
            // ignore
          }
        });
        es.addEventListener("status", (ev) => {
          sseErrors = 0;
          try {
            const status = JSON.parse(
              (ev as MessageEvent).data,
            ) as ProviderStatus;
            if (!cancelled) setProviderStatus(status);
          } catch {
            // ignore
          }
        });
        es.onerror = () => {
          sseErrors += 1;
          // EventSource auto-retries; after repeated failures switch to poll
          if (sseErrors >= 3) startPoll();
        };
      } catch {
        startPoll();
      }
    };

    void (async () => {
      const first = await pollOnce();
      if (cancelled) return;
      if (!first?.configured) {
        // Secrets missing — stay on Yahoo OHLCV only (no tight poll)
        return;
      }
      startSse();
    })();

    return () => {
      cancelled = true;
      polling = false;
      if (es) es.close();
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, []);

  const liveLabel = oandaLive
    ? liveQuote?.mode === "stream"
      ? "OANDA ティック"
      : liveQuote?.mode === "candle"
        ? "OANDA S5"
        : "OANDA ライブ"
    : isLive
      ? "ライブ"
      : "遅延";

  const feedNote =
    providerStatus?.detailJa ??
    "OANDA デモストリーム優先。未設定時は Yahoo 1分足ポーリング。";

  return (
    <div className="desk">
      <header className="desk__toolbar">
        <div className="desk__meta">
          <span className="desk__pair">USD/JPY</span>
          <span className="desk__price">{mark.toFixed(3)}</span>
          <span
            className={`desk__live ${isLive ? "is-live" : "is-stale"}`}
            title={feedNote}
          >
            <span className="desk__live-dot" aria-hidden />
            {liveLabel}
          </span>
          <span className="desk__updated">
            最終更新 {formatUpdatedAt(updatedAt)}
          </span>
          <span
            className={`desk__source ${payload.source === "sample" ? "is-sample" : ""}`}
          >
            {ohlcvSourceLabel(payload.source)}
            · {intervalJa}
          </span>
          {liveQuote && (
            <span className="desk__source desk__source--oanda">
              bid {liveQuote.bid.toFixed(3)} / ask {liveQuote.ask.toFixed(3)}
            </span>
          )}
          {bias && (
            <span className={`desk__bias desk__bias--${bias.side}`}>
              {bias.side === "long" ? "買い優勢" : "売り優勢"}
            </span>
          )}
          {entryAlerts[0] && (
            <a
              className={`desk__bias desk__bias--${entryAlerts[0].side}`}
              href="#entry-alerts"
            >
              {entryAlerts[0].labelJa}タイミングあり
            </a>
          )}
        </div>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => void refresh()}
          disabled={loading}
        >
          {loading ? "更新中…" : "データ更新"}
        </button>
      </header>

      {pollError && (
        <p className="desk__poll-error" role="status">
          {pollError}（前回データを表示中）
        </p>
      )}

      <p className="desk__freshness-note">
        {feedNote} ティック／高頻度価格はシグナルとエントリー（買い・売り・利確・損切）に即反映します。チャート足は約{" "}
        {Math.round(DESK_POLL_MS / 1000)} 秒ごとに再取得（{intervalJa}）。
      </p>

      <EntryAlerts alerts={entryAlerts} />

      <IndicatorToggles value={indicators} onChange={setIndicators} />

      <div className="desk__chart-wrap">
        <CandlestickChart bars={chartBars} indicators={indicators} />
      </div>

      <section id="auto-analysis" className="desk__panel desk__panel--wide">
        <h2>常時自動分析</h2>
        <p className="desk__panel-lead">
          バックグラウンドで履歴データを定期評価し、通過したルールを自動でシグナルに載せます。エントリーアラートはライブ価格更新のたびに同じルール層から再計算されます。
        </p>
        <AutoAnalysis ruleSet={ruleSet} onRuleSetChange={setRuleSet} />
      </section>

      <div className="desk__panels">
        <section className="desk__panel">
          <h2>シグナルヒント</h2>
          <p className="desk__panel-lead">
            自動分析で採用したルールに基づく短文説明。仮想取引の参考にしてください（自動発注はしません）。
          </p>
          <SignalHints hints={hints} />
        </section>

        <section className="desk__panel">
          <h2>ペーパー取引</h2>
          <p className="desk__panel-lead">
            仮想資金での成行売買。建玉には ATR／% ベースの参考利確・損切を表示します。
          </p>
          {paper ? (
            <PaperTrading
              state={paper}
              mark={mark}
              bars={liveBars}
              onChange={setPaper}
            />
          ) : (
            <p className="paper__empty">口座を準備中…</p>
          )}
        </section>
      </div>
    </div>
  );
}
