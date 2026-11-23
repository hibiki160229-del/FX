"use client";

import { ema } from "@/lib/indicators";
import type { OhlcvBar } from "@/lib/types";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  LineSeries,
  type IChartApi,
  type Time,
} from "lightweight-charts";
import { useEffect, useRef } from "react";

type Props = {
  bars: OhlcvBar[];
};

/** Full-bleed atmospheric USD/JPY chart behind the hero brand. Non-interactive. */
export function HeroChartBackground({ bars }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || bars.length === 0) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "transparent",
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      crosshair: {
        mode: 0,
        vertLine: { visible: false },
        horzLine: { visible: false },
      },
      rightPriceScale: {
        visible: false,
        borderVisible: false,
      },
      leftPriceScale: {
        visible: false,
        borderVisible: false,
      },
      timeScale: {
        visible: false,
        borderVisible: false,
        rightOffset: 4,
        barSpacing: 10,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      handleScroll: false,
      handleScale: false,
    });
    chartRef.current = chart;

    const candle = chart.addSeries(CandlestickSeries, {
      upColor: "rgba(47, 212, 168, 0.55)",
      downColor: "rgba(255, 122, 110, 0.5)",
      borderUpColor: "rgba(47, 212, 168, 0.72)",
      borderDownColor: "rgba(255, 122, 110, 0.65)",
      wickUpColor: "rgba(47, 212, 168, 0.45)",
      wickDownColor: "rgba(255, 122, 110, 0.4)",
      lastValueVisible: false,
      priceLineVisible: false,
    });

    const slice = bars.length > 120 ? bars.slice(-120) : bars;
    candle.setData(
      slice.map((b) => ({
        time: b.time as Time,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      })),
    );

    const e21 = ema(slice, 21);
    const trend = chart.addSeries(LineSeries, {
      color: "rgba(126, 212, 232, 0.55)",
      lineWidth: 2,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });
    trend.setData(
      slice
        .map((b, i) =>
          e21[i] == null ? null : { time: b.time as Time, value: e21[i]! },
        )
        .filter(Boolean) as { time: Time; value: number }[],
    );

    candle.priceScale().applyOptions({
      scaleMargins: { top: 0.18, bottom: 0.12 },
    });
    chart.timeScale().fitContent();

    let raf = 0;
    let start = 0;
    const tick = (ts: number) => {
      if (!start) start = ts;
      const t = (ts - start) / 1000;
      // Slow breathing of bar spacing — subtle depth, not distraction
      const spacing = 10 + Math.sin(t / 7) * 0.85;
      chart.timeScale().applyOptions({ barSpacing: spacing });
      raf = requestAnimationFrame(tick);
    };
    if (!reduced) {
      raf = requestAnimationFrame(tick);
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      chart.remove();
      chartRef.current = null;
    };
  }, [bars]);

  return (
    <div className="hero__chart" aria-hidden>
      <div ref={containerRef} className="hero__chart-canvas" />
    </div>
  );
}
