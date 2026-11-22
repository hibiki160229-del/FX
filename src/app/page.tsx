import { TradingDesk } from "@/components/TradingDesk";
import { fetchUsdJpyOhlcv } from "@/lib/data/fetch-ohlcv";

export default async function Home() {
  const initial = await fetchUsdJpyOhlcv("1mo", "1h");

  return (
    <main className="page">
      <section className="hero" aria-label="円脈">
        <div className="hero__atmosphere" aria-hidden />
        <div className="hero__grain" aria-hidden />
        <div className="hero__content">
          <p className="hero__brand">
            <span className="hero__brand-ja">円脈</span>
            <span className="hero__brand-en">ENMYAKU</span>
          </p>
          <h1 className="hero__headline">ドル円の流れを、静かに読む。</h1>
          <p className="hero__lead">
            履歴でルールを自動評価し、成績の良いシグナルだけを載せます。チャートと仮想取引もそのまま使えます。
          </p>
          <div className="hero__cta">
            <a className="btn btn--primary" href="#auto-analysis">
              自動分析を開く
            </a>
            <a className="btn btn--ghost" href="#desk">
              チャート・ペーパー取引へ
            </a>
          </div>
        </div>
      </section>

      <section id="desk" className="workspace">
        <TradingDesk initial={initial} />
      </section>

      <footer className="footer">
        <p>
          円脈 ENMYAKU — 学習・検証用。リアルマネー・自動発注は対象外です。
        </p>
      </footer>
    </main>
  );
}
