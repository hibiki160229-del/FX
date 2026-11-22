"use client";

import {
  loadLastAnalysis,
  promoteCandidates,
  promoteSuggested,
  saveLastAnalysis,
  saveSignalRuleSet,
  type AnalysisRunResult,
  type RankedCandidate,
} from "@/lib/analysis";
import type { SignalRuleSet } from "@/lib/signals";
import { useEffect, useState } from "react";

type Props = {
  ruleSet: SignalRuleSet;
  onRuleSetChange: (next: SignalRuleSet) => void;
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

export function AutoAnalysis({ ruleSet, onRuleSetChange }: Props) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisRunResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    const last = loadLastAnalysis();
    if (last) {
      setResult(last);
      const auto = new Set(
        last.ranked.filter((r) => r.passed).slice(0, 5).map((r) => r.id),
      );
      setSelected(auto);
    }
  }, []);

  const showFlash = (msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(null), 2400);
  };

  const run = async () => {
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
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(j?.error ?? `分析に失敗しました (${res.status})`);
      }
      const json = (await res.json()) as AnalysisRunResult;
      setResult(json);
      saveLastAnalysis(json);
      const auto = new Set(
        json.ranked.filter((r) => r.passed).slice(0, 5).map((r) => r.id),
      );
      setSelected(auto);
      showFlash(
        `分析完了 — ${json.ranked.filter((r) => r.passed).length} 件が基準通過`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "分析エラー");
    } finally {
      setRunning(false);
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

  return (
    <div className="auto">
      <div className="auto__intro">
        <p>
          履歴の USD/JPY
          で候補ルールを自動バックテストし、成績で並べます。チャートを読まずにシグナル用ルールを選べます。
        </p>
        <button
          type="button"
          className="btn btn--primary"
          onClick={run}
          disabled={running}
        >
          {running ? "分析中…" : "自動分析を実行"}
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
              {result.source === "yahoo" ? "市場データ" : "サンプル"}
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
              推奨パックを採用
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

      {!result && !running && (
        <p className="auto__empty">
          「自動分析を実行」で評価が始まります。上位ルールを採用すると、下のシグナルヒントとペーパー取引の判断材料が更新されます。
        </p>
      )}
    </div>
  );
}
