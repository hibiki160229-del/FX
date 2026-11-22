"use client";

import {
  closePosition,
  equity,
  openMarket,
  unrealizedPnl,
} from "@/lib/paper/broker";
import { resetPaperState, savePaperState } from "@/lib/paper/storage";
import type { PaperState } from "@/lib/types";
import { useState } from "react";

type Props = {
  state: PaperState;
  mark: number;
  onChange: (next: PaperState) => void;
};

function yen(n: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(n);
}

export function PaperTrading({ state, mark, onChange }: Props) {
  const [lots, setLots] = useState(1);
  const upnl = unrealizedPnl(state.positions, mark);
  const eq = equity(state, mark);

  const commit = (next: PaperState) => {
    savePaperState(next);
    onChange(next);
  };

  return (
    <div className="paper">
      <div className="paper__stats">
        <div>
          <span className="paper__label">仮想残高</span>
          <strong>{yen(state.balance)}</strong>
        </div>
        <div>
          <span className="paper__label">評価額</span>
          <strong>{yen(eq)}</strong>
        </div>
        <div>
          <span className="paper__label">含み損益</span>
          <strong className={upnl >= 0 ? "is-up" : "is-down"}>{yen(upnl)}</strong>
        </div>
        <div>
          <span className="paper__label">参考レート</span>
          <strong>{mark.toFixed(3)}</strong>
        </div>
      </div>

      <div className="paper__actions">
        <label className="paper__lots">
          ロット
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={lots}
            onChange={(e) => setLots(Math.max(0.1, Number(e.target.value) || 0.1))}
          />
        </label>
        <button
          type="button"
          className="btn btn--buy"
          onClick={() => commit(openMarket(state, "buy", lots, mark))}
        >
          成行買い
        </button>
        <button
          type="button"
          className="btn btn--sell"
          onClick={() => commit(openMarket(state, "sell", lots, mark))}
        >
          成行売り
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => commit(resetPaperState())}
        >
          リセット
        </button>
      </div>

      <div className="paper__cols">
        <section>
          <h3>建玉</h3>
          {state.positions.length === 0 ? (
            <p className="paper__empty">建玉はありません</p>
          ) : (
            <ul className="paper__list">
              {state.positions.map((p) => {
                const dir = p.side === "buy" ? 1 : -1;
                const pnl =
                  (mark - p.entryPrice) * dir * (p.lots * 100_000);
                return (
                  <li key={p.id}>
                    <div>
                      <strong>{p.side === "buy" ? "買" : "売"}</strong>{" "}
                      {p.lots} lot @ {p.entryPrice.toFixed(3)}
                      <span className={pnl >= 0 ? "is-up" : "is-down"}>
                        {" "}
                        {yen(pnl)}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => commit(closePosition(state, p.id, mark))}
                    >
                      決済
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <h3>取引履歴</h3>
          {state.history.length === 0 ? (
            <p className="paper__empty">まだ取引がありません</p>
          ) : (
            <ul className="paper__list paper__list--log">
              {state.history.slice(0, 12).map((t) => (
                <li key={t.id}>
                  <span>
                    {t.note} {t.lots}lot @ {t.price.toFixed(3)}
                  </span>
                  <span className={t.pnl >= 0 ? "is-up" : "is-down"}>
                    {t.pnl === 0 ? "—" : yen(t.pnl)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
