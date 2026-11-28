# 円脈 ENMYAKU

USD/JPY テクニカル分析＆ペーパー取引の Web アプリ（v1）。

## 機能

- USD/JPY ローソク足チャート（**Twelve Data** 優先・`TWELVE_DATA_API_KEY` 時／なければ **Yahoo** → 任意 OANDA → サンプル）
- **準リアルタイム** — Yahoo Finance の高頻度価格ポーリング（APIキー不要）をシグナル／エントリー（買い・売り・利確・損切）に反映。ツールバーに「Yahoo ライブ／ライブ／遅延」とアクティブソース表示
- 指標トグル: MA / EMA / RSI / MACD / Bollinger
- **常時自動分析** — 約 **5分** 周期で時間足 OHLCV 取得→バックテスト→通過ルール自動採用
- ルールベースのシグナルヒント（日本語）
- エントリーアラート（トースト／任意のブラウザ通知）
- ペーパー取引（残高・建玉・PnL・履歴、localStorage）

## ライブ価格（デフォルト・無料）

**Secrets 不要。** Yahoo Finance chart API（`USDJPY=X`）から mid を約2秒間隔で取得し、SSE（`/api/pricing/stream`）経由でデスクに配信します。

- 取引時間中は概ね1–5秒程度の鮮度
- bid/ask は mid から小さな半スプレッドを推定（チャート・アラート用）
- OHLCV 骨格: Twelve Data（キーあり）または Yahoo 1分足（約30秒ポーリング）

## Twelve Data（任意・推奨・長い 1m 履歴）

`TWELVE_DATA_API_KEY` があるとき OHLCV は Twelve Data `/time_series` を優先します。`outputsize` ≤ 5000 のため、長い履歴は `start_date` / `end_date` ウィンドウでページングします（1m はクレジットが許す範囲で **約1年** を目標）。

| 項目 | 内容 |
|------|------|
| `TWELVE_DATA_API_KEY` | Twelve Data API キー（任意・推奨） |
| Free Basic レート | **8 credits/分**・**800/日**（`/time_series` = 1 credit/symbol） |
| フォールバック | キーなし／失敗時は **Yahoo**（1m ≈ 7日） |

Cursor の App Secrets に同名を bind してから republish。**チャットにキーを貼らないでください。**

## OANDA デモ（任意・ソフト非推奨）

日本向け OANDA 口座では REST に Pro + Gold + 残高条件が必要な場合があり、**必須ではありません。** トークンがある場合のみ任意の追加ソースとして残しています。

| 名前 | 内容 |
|------|------|
| `OANDA_API_TOKEN` | Practice 用 Personal Access Token（任意） |
| `OANDA_ACCOUNT_ID` | Practice 口座 ID（任意） |

Cursor クライアントまたは [Secrets 設定](https://cursor.com/dashboard) で追加可能。**チャットにトークンを貼らないでください。**

未設定でも Yahoo ライブでそのまま動作します。

## データ鮮度

| 項目 | 実態 |
|------|------|
| 優先配信 | **Yahoo Finance** 価格ポーリング（SSE 経由・約2秒） |
| 任意追加 | OANDA Practice stream / REST / S5（Secrets がある場合のみ） |
| OHLCV 骨格 | Twelve Data（キー時）または Yahoo `5d` / `1m`（約30秒、キャッシュ TTL 15秒） |
| フォールバック | Twelve Data → Yahoo →（任意）OANDA 足 → サンプル |
| ルール発見 | 約5分周期・`3mo` / `1h` |

## API

| 経路 | 役割 |
|------|------|
| `GET /api/pricing` | 最新 mid/bid/ask + プロバイダ状態 |
| `GET /api/pricing/stream` | Yahoo（＋任意 OANDA）の SSE |
| `GET /api/ohlcv` | キャッシュ付き OHLCV |
| `instrumentation.ts` → `startAnalysisScheduler()` | 常時分析 |
| `GET /api/analysis/status` | 最終実行・次回予定 |
| `POST /api/analysis/tick` | 期限到来時実行（keepalive） |
| `POST /api/analyze` | 手動再実行 |

プロバイダ抽象: `src/lib/providers/`（Twelve Data / Yahoo / 任意 OANDA / sample）。デスク定数: `src/lib/realtime/`。

## 起動

```bash
npm install
npm run dev
```

ブラウザで http://localhost:3000 を開く。

## スコープ外（v1）

- ライブブローカー / 実資金 / 自動発注（ペーパーのみ）
- マルチペア
- OANDA 本番（fxTrade）エンドポイント
