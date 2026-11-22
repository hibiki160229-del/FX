"use client";

import { AutoAnalysis } from "@/components/AutoAnalysis";
import { CandlestickChart } from "@/components/CandlestickChart";
import { IndicatorToggles } from "@/components/IndicatorToggles";
import { PaperTrading } from "@/components/PaperTrading";
import { SignalHints } from "@/components/SignalHints";
import { loadSignalRuleSet } from "@/lib/analysis";
import type { OhlcvPayload } from "@/lib/data/fetch-ohlcv";
import { loadPaperState } from "@/lib/paper/storage";
import {
  DEFAULT_RULE_SET,
  evaluateSignals,
  latestBias,
  type SignalRuleSet,
} from "@/lib/signals";
import type { IndicatorState, PaperState } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

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

export function TradingDesk({ initial }: Props) {
  const [payload, setPayload] = useState(initial);
  const [indicators, setIndicators] = useState<IndicatorState>(DEFAULT_INDICATORS);
  const [paper, setPaper] = useState<PaperState | null>(null);
  const [ruleSet, setRuleSet] = useState<SignalRuleSet>(DEFAULT_RULE_SET);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPaper(loadPaperState());
    setRuleSet(loadSignalRuleSet());
  }, []);

  const mark = payload.bars.at(-1)?.close ?? 0;
  const hints = useMemo(
    () => evaluateSignals(payload.bars, ruleSet),
    [payload.bars, ruleSet],
  );
  const bias = latestBias(hints);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ohlcv?range=1mo&interval=1h");
      if (res.ok) {
        const json = (await res.json()) as OhlcvPayload;
        setPayload(json);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="desk">
      <header className="desk__toolbar">
        <div className="desk__meta">
          <span className="desk__pair">USD/JPY</span>
          <span className="desk__price">{mark.toFixed(3)}</span>
          <span
            className={`desk__source ${payload.source === "sample" ? "is-sample" : ""}`}
          >
            {payload.source === "yahoo" ? "市場データ" : "サンプルデータ"}
            · 1時間足
          </span>
          {bias && (
            <span className={`desk__bias desk__bias--${bias.side}`}>
              {bias.side === "long" ? "買い優勢" : "売り優勢"}
            </span>
          )}
        </div>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={refresh}
          disabled={loading}
        >
          {loading ? "更新中…" : "データ更新"}
        </button>
      </header>

      <IndicatorToggles value={indicators} onChange={setIndicators} />

      <div className="desk__chart-wrap">
        <CandlestickChart bars={payload.bars} indicators={indicators} />
      </div>

      <section id="auto-analysis" className="desk__panel desk__panel--wide">
        <h2>常時自動分析</h2>
        <p className="desk__panel-lead">
          バックグラウンドで履歴データを定期評価し、通過したルールを自動でシグナルに載せます。チャート解釈は不要です。
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
            仮想資金での成行売買。残高・建玉・損益はブラウザに保存されます。シグナルと同じルール層を参照します。
          </p>
          {paper ? (
            <PaperTrading state={paper} mark={mark} onChange={setPaper} />
          ) : (
            <p className="paper__empty">口座を準備中…</p>
          )}
        </section>
      </div>
    </div>
  );
}
