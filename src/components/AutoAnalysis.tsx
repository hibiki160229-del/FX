"use client";

import {
  ANALYSIS_INTERVAL_MS,
  ANALYSIS_KEEPALIVE_MS,
  ANALYSIS_STATUS_POLL_MS,
  loadLastAnalysis,
  promoteCandidates,
  promoteSuggested,
  saveLastAnalysis,
  saveSignalRuleSet,
  type AnalysisLoopSnapshot,
  type AnalysisRunResult,
  type RankedCandidate,
} from "@/lib/analysis";
import type { SignalRuleSet } from "@/lib/signals";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  ruleSet: SignalRuleSet;
  onRuleSetChange: (next: SignalRuleSet) => void;
};

type StatusPayload = {
  ok: boolean;
  loop: AnalysisLoopSnapshot & {
    intervalMs: number;
    schedulerStarted: boolean;
  };
  result: AnalysisRunResult | null;
};

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function sourceLabel(s: RankedCandidate["source"]) {
  switch (s) {
    case "web":
      return "Web";
    case "search":
      return "探索";
    default:
      return "シード";
  }
}

function formatTs(ms: number | null) {
  if (ms == null) return "—";
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleString("ja-JP");
  }
}

function stateLabel(state: AnalysisLoopSnapshot["state"]) {
  switch (state) {
    case "running":
      return "分析実行中";
    case "ok":
      return "稼働中（最新成功）";
    case "error":
      return "稼働中（直近エラー）";
    default:
      return "待機中";
  }
}

function ruleSetsEqual(a: SignalRuleSet, b: SignalRuleSet) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function AutoAnalysis({ ruleSet, onRuleSetChange }: Props) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisRunResult | null>(null);
  const [loop, setLoop] = useState<StatusPayload["loop"] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const appliedAsOf = useRef<number | null>(null);
  const ruleSetRef = useRef(ruleSet);
  const onRuleSetChangeRef = useRef(onRuleSetChange);

  useEffect(() => {
    ruleSetRef.current = ruleSet;
  }, [ruleSet]);

  useEffect(() => {
    onRuleSetChangeRef.current = onRuleSetChange;
  }, [onRuleSetChange]);

  const showFlash = useCallback((msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(null), 2400);
  }, []);

  const applyServerRules = useCallback(
    (snapshot: AnalysisLoopSnapshot, analysis: AnalysisRunResult | null) => {
      if (analysis) {
        setResult(analysis);
        saveLastAnalysis(analysis);
        const auto = new Set(
          analysis.ranked.filter((r) => r.passed).slice(0, 5).map((r) => r.id),
        );
        setSelected(auto);
      }

      if (
        snapshot.autoPromoted &&
        snapshot.asOf != null &&
        snapshot.asOf !== appliedAsOf.current
      ) {
        const next = snapshot.activeRuleSet;
        if (!ruleSetsEqual(next, ruleSetRef.current)) {
          saveSignalRuleSet(next);
          onRuleSetChangeRef.current(next);
          showFlash(
            `常時分析がルールを更新 — ${snapshot.promotedCount} 件を自動採用`,
          );
        }
        appliedAsOf.current = snapshot.asOf;
      }
    },
    [showFlash],
  );

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/analysis/status", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as StatusPayload;
      setLoop(json.loop);
      applyServerRules(json.loop, json.result);
      if (json.loop.lastError && json.loop.state === "error") {
        setError(json.loop.lastError);
      } else {
        setError(null);
      }
    } catch {
      // keep local cache
    }
  }, [applyServerRules]);

  const keepaliveTick = useCallback(async () => {
    try {
      const res = await fetch("/api/analysis/tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) return;
      const json = (await res.json()) as {
        ran: boolean;
        loop: AnalysisLoopSnapshot;
      };
      setLoop((prev) =>
        prev
          ? {
              ...prev,
              ...json.loop,
              intervalMs: prev.intervalMs,
              schedulerStarted: prev.schedulerStarted,
            }
          : null,
      );
      if (json.ran) {
        await refreshStatus();
      }
    } catch {
      // ignore keepalive failures
    }
  }, [refreshStatus]);

  useEffect(() => {
    const last = loadLastAnalysis();
    if (last) {
      setResult(last);
      const auto = new Set(
        last.ranked.filter((r) => r.passed).slice(0, 5).map((r) => r.id),
      );
      setSelected(auto);
    }
    void refreshStatus().then(() => keepaliveTick());

    const statusId = window.setInterval(() => {
      void refreshStatus();
    }, ANALYSIS_STATUS_POLL_MS);
    const tickId = window.setInterval(() => {
      void keepaliveTick();
    }, ANALYSIS_KEEPALIVE_MS);
    const clockId = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => {
      window.clearInterval(statusId);
      window.clearInterval(tickId);
      window.clearInterval(clockId);
    };
    // Mount-once loop; callbacks stay stable via refs above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runManual = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          range: "3mo",
          interval: "1h",
          includeWeb: true,
          autoPromote: true,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as {
          error?: string;
          loop?: AnalysisLoopSnapshot;
        } | null;
        if (j?.loop) {
          setLoop((prev) =>
            prev
              ? {
                  ...prev,
                  ...j.loop!,
                  intervalMs: prev.intervalMs,
                  schedulerStarted: prev.schedulerStarted,
                }
              : null,
          );
        }
        throw new Error(j?.error ?? `分析に失敗しました (${res.status})`);
      }
      const json = (await res.json()) as AnalysisRunResult & {
        loop?: AnalysisLoopSnapshot;
        throttled?: boolean;
      };
      setResult(json);
      saveLastAnalysis(json);
      if (json.loop) {
        applyServerRules(json.loop, json);
        setLoop((prev) =>
          prev
            ? {
                ...prev,
                ...json.loop!,
                intervalMs: prev.intervalMs,
                schedulerStarted: prev.schedulerStarted,
              }
            : null,
        );
      } else {
        const next = promoteSuggested(json.suggestedRuleSet);
        onRuleSetChange(next);
      }
      const auto = new Set(
        json.ranked.filter((r) => r.passed).slice(0, 5).map((r) => r.id),
      );
      setSelected(auto);
      showFlash(
        json.throttled
          ? "直近の分析結果を表示中（再実行クールダウン）"
          : `再分析完了 — ${json.ranked.filter((r) => r.passed).length} 件通過・自動採用`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "分析エラー");
    } finally {
      setRunning(false);
      void refreshStatus();
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const promoteSelected = () => {
    if (!result) return;
    const winners = result.ranked.filter((r) => selected.has(r.id));
    if (winners.length === 0) {
      showFlash("採用する候補を選んでください");
      return;
    }
    const next = promoteCandidates(ruleSet, winners);
    saveSignalRuleSet(next);
    onRuleSetChange(next);
    showFlash(`${winners.length} 件のルールをシグナルに反映しました`);
  };

  const promotePack = () => {
    if (!result) return;
    const next = promoteSuggested(result.suggestedRuleSet);
    onRuleSetChange(next);
    showFlash("各ルール最良パラメータを一括採用しました");
  };

  const top = result?.ranked.slice(0, 12) ?? [];
  const activeSummary = ruleSet.rules
    .filter((r) => r.enabled)
    .map((r) => r.labelJa)
    .join(" · ");

  const intervalMs = loop?.intervalMs ?? ANALYSIS_INTERVAL_MS;
  const intervalMin = Math.max(1, Math.round(intervalMs / 60_000));
  const isBusy = running || loop?.state === "running";
  const nextLabel =
    loop?.nextRunAt != null
      ? loop.nextRunAt <= now
        ? "まもなく"
        : formatTs(loop.nextRunAt)
      : "—";

  return (
    <div className="auto">
      <div className="auto__loop" aria-live="polite">
        <div className="auto__loop-head">
          <span
            className={`auto__pulse ${isBusy ? "is-busy" : "is-on"}`}
            aria-hidden
          />
          <div>
            <strong className="auto__loop-title">常時分析</strong>
            <p className="auto__loop-state">
              {loop ? stateLabel(loop.state) : "接続中…"}
              {loop?.schedulerStarted ? " · サーバー周期あり" : ""}
            </p>
          </div>
        </div>
        <dl className="auto__loop-meta">
          <div>
            <dt>最終実行</dt>
            <dd>{formatTs(loop?.lastRunAt ?? result?.asOf ?? null)}</dd>
          </div>
          <div>
            <dt>次回予定</dt>
            <dd>{nextLabel}</dd>
          </div>
          <div>
            <dt>周期</dt>
            <dd>{intervalMin} 分</dd>
          </div>
          <div>
            <dt>自動採用</dt>
            <dd>
              {loop?.autoPromoted
                ? `${loop.promotedCount} 件反映済`
                : "待機"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="auto__intro">
        <p>
          サーバーが約 {intervalMin}{" "}
          分ごとに USD/JPY の時間足履歴でバックテスト→スコアリング→通過ルール自動採用を回します（チャートの1分足ポーリングとは別周期）。手動クリックは不要です。
        </p>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={runManual}
          disabled={isBusy}
        >
          {isBusy ? "分析中…" : "今すぐ再分析"}
        </button>
      </div>

      {flash && <p className="auto__flash">{flash}</p>}
      {error && <p className="auto__error">{error}</p>}

      <div className="auto__active">
        <span className="auto__label">現在のシグナルルール</span>
        <strong>{activeSummary || "（有効ルールなし）"}</strong>
      </div>

      {result && (
        <>
          <div className="auto__meta">
            <span>
              {result.barCount} 本 · {result.interval} ·{" "}
              {result.source === "oanda"
                ? "OANDA デモ"
                : result.source === "yahoo"
                  ? "市場データ"
                  : "サンプル"}
            </span>
            <span>
              下限: 取引≥{result.floors.minTrades} / DD≤
              {(result.floors.maxDrawdown * 100).toFixed(0)}% / 勝率≥
              {(result.floors.minWinRate * 100).toFixed(0)}%
            </span>
            <span>{result.extraction.noteJa}</span>
          </div>

          <div className="auto__actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={promotePack}
            >
              推奨パックを再適用
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={promoteSelected}
            >
              選択した候補を採用
            </button>
          </div>

          <ol className="auto__rank">
            {top.map((r, idx) => (
              <li
                key={r.id}
                className={`auto__row ${r.passed ? "is-pass" : "is-fail"}`}
              >
                <label className="auto__check">
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                  />
                  <span className="auto__rank-num">{idx + 1}</span>
                </label>
                <div className="auto__body">
                  <div className="auto__title-row">
                    <strong>{r.labelJa}</strong>
                    <span className="auto__badge">{sourceLabel(r.source)}</span>
                    {r.passed ? (
                      <span className="auto__badge auto__badge--ok">通過</span>
                    ) : (
                      <span className="auto__badge auto__badge--ng">未達</span>
                    )}
                  </div>
                  <p className="auto__note">{r.note ?? r.id}</p>
                  <dl className="auto__metrics">
                    <div>
                      <dt>スコア</dt>
                      <dd>{r.score.toFixed(3)}</dd>
                    </div>
                    <div>
                      <dt>リターン</dt>
                      <dd
                        className={
                          r.metrics.totalReturn >= 0 ? "is-up" : "is-down"
                        }
                      >
                        {pct(r.metrics.totalReturn)}
                      </dd>
                    </div>
                    <div>
                      <dt>最大DD</dt>
                      <dd>{pct(r.metrics.maxDrawdown)}</dd>
                    </div>
                    <div>
                      <dt>勝率</dt>
                      <dd>{pct(r.metrics.winRate)}</dd>
                    </div>
                    <div>
                      <dt>取引数</dt>
                      <dd>{r.metrics.tradeCount}</dd>
                    </div>
                  </dl>
                  {!r.passed && r.failReasons.length > 0 && (
                    <p className="auto__fail">{r.failReasons.join(" / ")}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </>
      )}

      {!result && !isBusy && (
        <p className="auto__empty">
          常時分析の初回実行を待っています。完了すると順位と自動採用ルールが表示されます。
        </p>
      )}
    </div>
  );
}
