# 円脈 ENMYAKU

USD/JPY テクニカル分析＆ペーパー取引の Web アプリ（v1）。

## 機能

- USD/JPY ローソク足チャート（Yahoo Finance、失敗時はサンプル OHLCV）
- **準リアルタイム（v1）** — デスク表示中は約30秒ごとに **1分足** を再取得し、シグナル／エントリー（買い・売り・利確・損切）を再評価。ツールバーに「ライブ／遅延」と「最終更新」を表示
- 指標トグル: MA / EMA / RSI / MACD / Bollinger
- **常時自動分析** — サーバー起動時にスケジューラが約 **5分** 周期で時間足 OHLCV 取得→バックテスト→通過ルール自動採用（チャートの1分足ポーリングとは別）
- ルールベースのシグナルヒント（日本語）
- エントリーアラート（トースト／任意のブラウザ通知、同一 fingerprint は約5分クールダウン）
- ペーパー取引（残高・建玉・PnL・履歴、localStorage）

## データ鮮度の限界（重要）

| 項目 | 実態 |
|------|------|
| 配信方式 | **Yahoo Finance HTTP ポーリング＋短 TTL キャッシュ**（デフォルト 15秒） |
| ティック WS | **未対応** — 無料・安定なティックストリームが載るまでポーリング優先 |
| デスク足 | `5d` / `1m`（Yahoo の1分足はおおよそ最大7日程度） |
| デスク更新 | 表示中 **約30秒**（タブ非表示時は約120秒） |
| ルール発見 | **約5分** 周期・`3mo` / `1h`（重いバックテスト） |
| フォールバック | Yahoo 失敗時はサンプル OHLCV（UI に「サンプルデータ」表示） |
| サーバーレス | プロセス内 `setInterval` はインスタンス依存。クライアントの keepalive（`/api/analysis/tick`）で補完 |

真のティック配信が必要になったら、無料かつ信頼できるストリームを別途検討し、ポーリング経路はフォールバックとして残す想定です。

## 常時分析 API

| 経路 | 役割 |
|------|------|
| `instrumentation.ts` → `startAnalysisScheduler()` | プロセス内 interval（約30秒チェック / 5分実行） |
| `GET /api/analysis/status` | 最終実行・次回予定・自動採用ルール |
| `POST /api/analysis/tick` | 期限到来時に実行（クライアント keepalive 兼用） |
| `POST /api/analyze` | 手動再実行（レート制限・最短1分ギャップ） |
| `GET /api/ohlcv` | キャッシュ付き OHLCV（レート制限） |

設定定数: `src/lib/realtime/config.ts`（デスク）、`src/lib/analysis/loop-config.ts`（分析）。

## 起動

```bash
cd enmyaku
npm install
npm run dev
```

ブラウザで http://localhost:3000 を開く。

## シグナル基盤（後続向け）

- `src/lib/signals/definitions.ts` — シリアライズ可能なルール定義（params / enabled）
- `src/lib/signals/rules.ts` — `evaluateSignals(bars, ruleSet?)` 純粋評価
- チャート・ペーパーブローカーはルール定義に依存しない。後続の最適化・バックテストで params 差し替え／勝ちルール昇格が可能。

## スコープ外（v1）

- ライブブローカー / 実資金 / 自動発注（ペーパーのみ）
- マルチペア
- 真のティック WebSocket 配信
