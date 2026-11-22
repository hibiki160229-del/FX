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
          <h1 className="hero__headline">
            ドル円の流れを、静かに読む。
            <span className="hero__headline-follow">
              感情は捨てろ、論理を信じろ。
            </span>
          </h1>
          <p className="hero__lead">
            常時分析が履歴でルールを回し続け、買い／売りタイミングと利確・損切を通知します。チャートと仮想取引もそのまま使えます。
          </p>
          <div className="hero__cta">
            <a className="btn btn--primary" href="#entry-alerts">
              エントリーアラートへ
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
