# 円脈 ENMYAKU

USD/JPY テクニカル分析＆ペーパー取引の Web アプリ（v1）。

## 機能

- USD/JPY ローソク足チャート（Yahoo Finance、失敗時はサンプル OHLCV）
- 指標トグル: MA / EMA / RSI / MACD / Bollinger
- ルールベースのシグナルヒント（日本語）— `src/lib/signals/` の純粋関数＋シリアライズ可能な定義
- ペーパー取引（残高・建玉・PnL・履歴、localStorage）

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

- ライブブローカー / 実資金 / 自動発注
- マルチペア
- Web/YouTube からのルール抽出 UI、バックテスト UI
