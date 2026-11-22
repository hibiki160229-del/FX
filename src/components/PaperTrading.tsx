"use client";

import { levelsForPosition } from "@/lib/alerts";
import {
  closePosition,
  equity,
  openMarket,
  unrealizedPnl,
} from "@/lib/paper/broker";
import { resetPaperState, savePaperState } from "@/lib/paper/storage";
import type { OhlcvBar, PaperState } from "@/lib/types";
import { useState } from "react";

type Props = {
  state: PaperState;
  mark: number;
  bars: OhlcvBar[];
  onChange: (next: PaperState) => void;
};

function yen(n: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(n);
}

export function PaperTrading({ state, mark, bars, onChange }: Props) {
  const [lots, setLots] = useState(1);
  const [flash, setFlash] = useState<string | null>(null);
  const upnl = unrealizedPnl(state.positions, mark);
  const eq = equity(state, mark);

  const commit = (next: PaperState, message?: string) => {
    savePaperState(next);
    onChange(next);
    if (message) {
      setFlash(message);
      window.setTimeout(() => setFlash(null), 2200);
    }
  };

  const trade = (side: "buy" | "sell") => {
    const size = Math.max(0.1, Number(lots) || 0.1);
    const next = openMarket(state, side, size, mark);
    if (next === state) {
      setFlash("注文を受け付けられませんでした（レートまたはロットを確認）");
      window.setTimeout(() => setFlash(null), 2200);
      return;
    }
    const levels = levelsForPosition(side, mark, bars);
    commit(
      next,
      side === "buy"
        ? `成行買い ${size} lot @ ${mark.toFixed(3)}（参考 利確 ${levels.takeProfit.toFixed(3)} / 損切 ${levels.stopLoss.toFixed(3)}）`
        : `成行売り ${size} lot @ ${mark.toFixed(3)}（参考 利確 ${levels.takeProfit.toFixed(3)} / 損切 ${levels.stopLoss.toFixed(3)}）`,
    );
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
          data-testid="paper-buy"
          onClick={() => trade("buy")}
        >
          成行買い
        </button>
        <button
          type="button"
          className="btn btn--sell"
          data-testid="paper-sell"
          onClick={() => trade("sell")}
        >
          成行売り
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          data-testid="paper-reset"
          onClick={() => commit(resetPaperState(), "口座をリセットしました")}
        >
          リセット
        </button>
      </div>
      {flash && <p className="paper__flash" role="status">{flash}</p>}

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
                const levels = levelsForPosition(p.side, p.entryPrice, bars);
                const hitTp =
                  p.side === "buy"
                    ? mark >= levels.takeProfit
                    : mark <= levels.takeProfit;
                const hitSl =
                  p.side === "buy"
                    ? mark <= levels.stopLoss
                    : mark >= levels.stopLoss;
                return (
                  <li key={p.id}>
                    <div className="paper__pos">
                      <div>
                        <strong>{p.side === "buy" ? "買" : "売"}</strong>{" "}
                        {p.lots} lot @ {p.entryPrice.toFixed(3)}
                        <span className={pnl >= 0 ? "is-up" : "is-down"}>
                          {" "}
                          {yen(pnl)}
                        </span>
                      </div>
                      <p className="paper__tpsl">
                        参考 利確{" "}
                        <span className={hitTp ? "is-up" : undefined}>
                          {levels.takeProfit.toFixed(3)}
                        </span>
                        {" / "}
                        損切{" "}
                        <span className={hitSl ? "is-down" : undefined}>
                          {levels.stopLoss.toFixed(3)}
                        </span>
                        <span className="paper__tpsl-r">
                          {" "}
                          · {levels.rewardR}R
                          {levels.method === "atr" ? " · ATR" : " · %"}
                        </span>
                        {hitTp && (
                          <span className="paper__hint is-up"> 利確圏</span>
                        )}
                        {hitSl && !hitTp && (
                          <span className="paper__hint is-down"> 損切圏</span>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      data-testid="paper-close"
                      onClick={() =>
                        commit(
                          closePosition(state, p.id, mark),
                          `決済 @ ${mark.toFixed(3)}`,
                        )
                      }
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
