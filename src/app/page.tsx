import { HeroChartBackground } from "@/components/HeroChartBackground";
import { TradingDesk } from "@/components/TradingDesk";
import { fetchUsdJpyOhlcv } from "@/lib/data/fetch-ohlcv";
import {
  DESK_OHLCV_INTERVAL,
  DESK_OHLCV_RANGE,
  HERO_OHLCV_INTERVAL,
  HERO_OHLCV_RANGE,
} from "@/lib/realtime/config";

export default async function Home() {
  const [deskInitial, heroInitial] = await Promise.all([
    fetchUsdJpyOhlcv(DESK_OHLCV_RANGE, DESK_OHLCV_INTERVAL),
    fetchUsdJpyOhlcv(HERO_OHLCV_RANGE, HERO_OHLCV_INTERVAL),
  ]);

  return (
    <main className="page">
      <section className="hero" aria-label="円脈">
        <HeroChartBackground bars={heroInitial.bars} />
        <div className="hero__atmosphere" aria-hidden />
        <div className="hero__veil" aria-hidden />
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
            デスク表示中は約30秒ごとに1分足を更新し、買い／売りと利確・損切を再評価します。常時分析がルールを回し続けます。
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
        <TradingDesk initial={deskInitial} />
      </section>

      <footer className="footer">
        <p>
          円脈 ENMYAKU — 学習・検証用。リアルマネー・自動発注は対象外です。相場は
          Yahoo Finance のポーリング（ティック配信ではありません）。
        </p>
      </footer>
    </main>
  );
}
