# 円脈 ENMYAKU

USD/JPY テクニカル分析＆ペーパー取引の Web アプリ（v1）。

## 機能

- USD/JPY ローソク足チャート（Yahoo Finance、失敗時は OANDA デモ足 → サンプル）
- **準リアルタイム** — OANDA fxTrade Practice の価格ストリーム（失敗時は REST/S5 ポーリング）をシグナル／エントリー（買い・売り・利確・損切）に反映。ツールバーに「OANDA ティック／ライブ／遅延」
- 指標トグル: MA / EMA / RSI / MACD / Bollinger
- **常時自動分析** — 約 **5分** 周期で時間足 OHLCV 取得→バックテスト→通過ルール自動採用
- ルールベースのシグナルヒント（日本語）
- エントリーアラート（トースト／任意のブラウザ通知）
- ペーパー取引（残高・建玉・PnL・履歴、localStorage）

## OANDA デモ（Practice）セットアップ

真のティックに近い配信には **OANDA practice API トークン** と **口座 ID** が必要です。値はコードに書かず、Cursor の App Secrets に登録します。

### 1. トークンと口座 ID を発行

1. [OANDA](https://www.oanda.com/) で **fxTrade Practice（デモ）** 口座を開設
2. 管理画面 → **Manage API Access** で Personal Access Token を生成
3. Practice 口座の **Account ID**（例: `101-001-……`）を控える

### 2. Cursor Secrets に登録

アプリが読む環境変数名（このリポジトリ／publish-app で bind 済み）:

| 名前 | 内容 |
|------|------|
| `OANDA_API_TOKEN` | Practice 用 Personal Access Token |
| `OANDA_ACCOUNT_ID` | Practice 口座 ID |

Cursor クライアントまたは [Secrets 設定](https://cursor.com/dashboard) で上記 2 つを追加し、公開アプリを再デプロイすると有効になります。**チャットにトークンを貼らないでください。**

ローカル開発では `.env.local` に同じ名前で設定できます（git 管理外）:

```bash
OANDA_API_TOKEN=your_token_here
OANDA_ACCOUNT_ID=101-xxx-xxxxxx-xxx
```

未設定時は Yahoo 1分足ポーリングのみで動作します（UI に「OANDA 未設定」と表示）。

### 利用ホスト

| 用途 | ホスト |
|------|--------|
| REST（価格・足） | `https://api-fxpractice.oanda.com` |
| ストリーム | `https://stream-fxpractice.oanda.com` |

egress でこれらが遮断される環境ではストリームの代わりに REST 価格（約1秒）または S5 足ポーリングへ自動フォールバックします。それでも駄目な場合は Yahoo が最終フォールバックです。

## データ鮮度

| 項目 | 実態 |
|------|------|
| 優先配信 | **OANDA Practice pricing stream**（SSE 経由、最大約4 tick/秒） |
| ストリーム不可時 | OANDA REST pricing / S5 足を約1秒ポーリング |
| OHLCV 骨格 | Yahoo `5d` / `1m`（約30秒、キャッシュ TTL 15秒） |
| フォールバック | Yahoo → OANDA 足 → サンプル |
| ルール発見 | 約5分周期・`3mo` / `1h` |
| サーバーレス | 長寿命ストリームはインスタンス依存。クライアント SSE／keepalive で補完 |

## API

| 経路 | 役割 |
|------|------|
| `GET /api/pricing` | 最新 mid/bid/ask + プロバイダ状態 |
| `GET /api/pricing/stream` | OANDA ストリーム／ポーリングの SSE |
| `GET /api/ohlcv` | キャッシュ付き OHLCV |
| `instrumentation.ts` → `startAnalysisScheduler()` | 常時分析 |
| `GET /api/analysis/status` | 最終実行・次回予定 |
| `POST /api/analysis/tick` | 期限到来時実行（keepalive） |
| `POST /api/analyze` | 手動再実行 |

プロバイダ抽象: `src/lib/providers/`（OANDA / Yahoo / sample）。デスク定数: `src/lib/realtime/`。

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
