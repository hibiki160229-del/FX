# 円脈 ENMYAKU

USD/JPY テクニカル分析＆ペーパー取引の Web アプリ（v1）。

## 機能

- USD/JPY ローソク足チャート（Yahoo Finance、失敗時はサンプル OHLCV）
- 指標トグル: MA / EMA / RSI / MACD / Bollinger
- **常時自動分析** — サーバー起動時にスケジューラが約30分周期で OHLCV 取得→バックテスト→通過ルール自動採用。UI に最終実行時刻を表示（手動「今すぐ再分析」は任意）
- ルールベースのシグナルヒント（日本語）— `src/lib/signals/` の純粋関数＋シリアライズ可能な定義
- ペーパー取引（残高・建玉・PnL・履歴、localStorage）

## 常時分析 API

| 経路 | 役割 |
|------|------|
| `instrumentation.ts` → `startAnalysisScheduler()` | プロセス内 interval（約1分チェック / 30分実行） |
| `GET /api/analysis/status` | 最終実行・次回予定・自動採用ルール |
| `POST /api/analysis/tick` | 期限到来時に実行（クライアント keepalive 兼用） |
| `POST /api/analyze` | 手動再実行（レート制限・最短1分ギャップ） |
| `GET /api/ohlcv` | キャッシュ付き OHLCV（レート制限） |

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
