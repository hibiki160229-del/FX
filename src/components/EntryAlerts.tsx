"use client";

import {
  shouldAnnounce,
  shouldAnnounceSide,
  type EntryAlert,
} from "@/lib/alerts";
import { useEffect, useRef, useState } from "react";

type Props = {
  alerts: EntryAlert[];
};

function formatPx(n: number) {
  return n.toFixed(3);
}

function methodLabel(a: EntryAlert) {
  if (a.method === "atr" && a.atr != null) {
    return `ATR(${a.atr.toFixed(3)}) × 損切1.5 / 利確3`;
  }
  return "価格比（損切0.3% / 利確0.6%）";
}

function notifyBrowser(alert: EntryAlert) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(`円脈 — ${alert.labelJa}エントリー`, {
      body: `エントリー ${formatPx(alert.entryPrice)} / 利確 ${formatPx(alert.takeProfit)} / 損切 ${formatPx(alert.stopLoss)}（${alert.rewardR}R）`,
      tag: alert.id,
      silent: false,
    });
  } catch {
    // Safari / insecure context may throw
  }
}

export function EntryAlerts({ alerts }: Props) {
  const [toast, setToast] = useState<EntryAlert | null>(null);
  const [notifState, setNotifState] = useState<
    "unsupported" | "default" | "denied" | "granted"
  >("unsupported");
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotifState("unsupported");
      return;
    }
    setNotifState(Notification.permission);
  }, []);

  useEffect(() => {
    if (alerts.length === 0) return;
    const primary = alerts[0];
    if (seenRef.current.has(primary.id)) return;

    // Fingerprint + soft side cooldown to limit noise
    if (!shouldAnnounce(primary.id)) {
      seenRef.current.add(primary.id);
      return;
    }
    if (!shouldAnnounceSide(primary.side)) {
      seenRef.current.add(primary.id);
      return;
    }

    seenRef.current.add(primary.id);
    setToast(primary);
    notifyBrowser(primary);
    const t = window.setTimeout(() => setToast(null), 7000);
    return () => window.clearTimeout(t);
  }, [alerts]);

  const requestNotif = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      const perm = await Notification.requestPermission();
      setNotifState(perm);
    } catch {
      setNotifState("denied");
    }
  };

  return (
    <div className="entry-alerts" id="entry-alerts">
      {toast && (
        <div
          className={`entry-toast entry-toast--${toast.side}`}
          role="status"
          aria-live="polite"
        >
          <div className="entry-toast__head">
            <strong>{toast.labelJa}タイミング</strong>
            <button
              type="button"
              className="entry-toast__close"
              aria-label="閉じる"
              onClick={() => setToast(null)}
            >
              ×
            </button>
          </div>
          <p className="entry-toast__title">{toast.title}</p>
          <p className="entry-toast__levels">
            利確 {formatPx(toast.takeProfit)} · 損切 {formatPx(toast.stopLoss)} ·{" "}
            {toast.rewardR}R
          </p>
        </div>
      )}

      <div
        className={
          alerts.length > 0
            ? `entry-banner entry-banner--${alerts[0].side}`
            : "entry-banner entry-banner--idle"
        }
        role="region"
        aria-label="エントリーアラート"
      >
        {alerts.length === 0 ? (
          <div className="entry-banner__idle">
            <span className="entry-banner__kicker">エントリー監視</span>
            <p>
              現在バーでは明確な買い／売りタイミングはありません。チャート更新のたびに再評価し、シグナルが揃うと利確・損切付きで表示します（同一内容の通知はクールダウンあり）。
            </p>
          </div>
        ) : (
          alerts.map((a) => (
            <article key={a.id} className="entry-banner__card">
              <div className="entry-banner__top">
                <span className={`entry-banner__side entry-banner__side--${a.side}`}>
                  {a.labelJa}エントリー
                </span>
                <span className="entry-banner__strength">
                  確度 {(a.strength * 100).toFixed(0)}%
                </span>
              </div>
              <h3 className="entry-banner__title">{a.title}</h3>
              <dl className="entry-banner__levels">
                <div>
                  <dt>エントリー</dt>
                  <dd>{formatPx(a.entryPrice)}</dd>
                </div>
                <div>
                  <dt>利確（TP）</dt>
                  <dd className="is-up">{formatPx(a.takeProfit)}</dd>
                </div>
                <div>
                  <dt>損切（SL）</dt>
                  <dd className="is-down">{formatPx(a.stopLoss)}</dd>
                </div>
                <div>
                  <dt>リスクリワード</dt>
                  <dd>{a.rewardR}R</dd>
                </div>
              </dl>
              <p className="entry-banner__method">{methodLabel(a)}</p>
              <ul className="entry-banner__reasons">
                {a.reasons.map((r) => (
                  <li key={r.slice(0, 48)}>{r}</li>
                ))}
              </ul>
            </article>
          ))
        )}

        <div className="entry-banner__notif">
          {notifState === "unsupported" ? (
            <span>この環境ではブラウザ通知に対応していません。</span>
          ) : notifState === "granted" ? (
            <span>ブラウザ通知：オン（新規エントリー時）</span>
          ) : notifState === "denied" ? (
            <span>ブラウザ通知は拒否されています（設定から変更できます）。</span>
          ) : (
            <button type="button" className="btn btn--ghost btn--sm" onClick={requestNotif}>
              ブラウザ通知を許可
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
