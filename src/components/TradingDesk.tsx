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
import { loadPaperState } from "@/lib/paper/storage";
import {
  DESK_CHART_MAX_BARS,
  DESK_FRESH_MS,
  DESK_HIDDEN_POLL_MS,
  DESK_OHLCV_INTERVAL,
  DESK_OHLCV_RANGE,
  DESK_POLL_MS,
  intervalLabelJa,
} from "@/lib/realtime/config";
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

export function TradingDesk({ initial }: Props) {
  const [payload, setPayload] = useState(initial);
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
    const id = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(id);
  }, []);

  const mark = payload.bars.at(-1)?.close ?? 0;
  const hints = useMemo(
    () => evaluateSignals(payload.bars, ruleSet),
    [payload.bars, ruleSet],
  );
  const entryAlerts = useMemo(
    () => buildEntryAlerts(hints, payload.bars, mark),
    [hints, payload.bars, mark],
  );
  const bias = latestBias(hints);
  const chartBars = useMemo(() => {
    if (payload.bars.length <= DESK_CHART_MAX_BARS) return payload.bars;
    return payload.bars.slice(-DESK_CHART_MAX_BARS);
  }, [payload.bars]);

  const ageMs = now - payload.asOf;
  const isLive = ageMs <= DESK_FRESH_MS;
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

  // Near-realtime poll while desk is open; slower when tab hidden.
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

  return (
    <div className="desk">
      <header className="desk__toolbar">
        <div className="desk__meta">
          <span className="desk__pair">USD/JPY</span>
          <span className="desk__price">{mark.toFixed(3)}</span>
          <span
            className={`desk__live ${isLive ? "is-live" : "is-stale"}`}
            title={
              isLive
                ? "デスク表示中は約30秒ごとに更新"
                : "データが古い可能性があります"
            }
          >
            <span className="desk__live-dot" aria-hidden />
            {isLive ? "ライブ" : "遅延"}
          </span>
          <span className="desk__updated">
            最終更新 {formatUpdatedAt(payload.asOf)}
          </span>
          <span
            className={`desk__source ${payload.source === "sample" ? "is-sample" : ""}`}
          >
            {payload.source === "yahoo" ? "市場データ" : "サンプルデータ"}
            · {intervalJa}
          </span>
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
        デスク表示中は約 {Math.round(DESK_POLL_MS / 1000)}{" "}
        秒ごとに {intervalJa}{" "}
        を再取得し、シグナル／エントリー（買い・売り・利確・損切）を再評価します。Yahoo
        ポーリング＋キャッシュのためティック配信ではありません。取得失敗時はサンプルへフォールバックします。
      </p>

      <EntryAlerts alerts={entryAlerts} />

      <IndicatorToggles value={indicators} onChange={setIndicators} />

      <div className="desk__chart-wrap">
        <CandlestickChart bars={chartBars} indicators={indicators} />
      </div>

      <section id="auto-analysis" className="desk__panel desk__panel--wide">
        <h2>常時自動分析</h2>
        <p className="desk__panel-lead">
          バックグラウンドで履歴データを定期評価し、通過したルールを自動でシグナルに載せます。エントリーアラートはチャート更新のたびに同じルール層から再計算されます。
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
              bars={payload.bars}
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
