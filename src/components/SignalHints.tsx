"use client";

import type { SignalHint } from "@/lib/types";

type Props = {
  hints: SignalHint[];
};

export function SignalHints({ hints }: Props) {
  if (hints.length === 0) {
    return (
      <p className="signal-empty">
        現在バーでは明確なルール条件は発火していません。自動分析で採用したルールが条件を満たすとここに表示されます。
      </p>
    );
  }

  return (
    <ul className="signal-list">
      {hints.map((h) => (
        <li key={h.id} className={`signal-item signal-item--${h.side}`}>
          <div className="signal-item__meta">
            <span className="signal-item__side">
              {h.side === "long" ? "ロングヒント" : "ショートヒント"}
            </span>
            <span className="signal-item__strength">
              強度 {(h.strength * 100).toFixed(0)}%
            </span>
          </div>
          <h3 className="signal-item__title">{h.title}</h3>
          <p className="signal-item__reason">{h.reason}</p>
        </li>
      ))}
    </ul>
  );
}
