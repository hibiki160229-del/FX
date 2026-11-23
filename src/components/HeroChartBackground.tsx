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
        rightOffset: 2,
        barSpacing: 14,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      handleScroll: false,
      handleScale: false,
    });
    chartRef.current = chart;

    // Dense recent window — larger candles read as a dominant plane
    const slice = bars.length > 90 ? bars.slice(-90) : bars;

    const candle = chart.addSeries(CandlestickSeries, {
      upColor: "rgba(47, 212, 168, 0.78)",
      downColor: "rgba(255, 122, 110, 0.72)",
      borderUpColor: "rgba(110, 236, 196, 0.95)",
      borderDownColor: "rgba(255, 150, 138, 0.9)",
      wickUpColor: "rgba(47, 212, 168, 0.7)",
      wickDownColor: "rgba(255, 122, 110, 0.65)",
      lastValueVisible: false,
      priceLineVisible: false,
    });
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
    const e55 = ema(slice, 55);
    const trendFast = chart.addSeries(LineSeries, {
      color: "rgba(180, 236, 255, 0.78)",
      lineWidth: 2,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });
    const trendSlow = chart.addSeries(LineSeries, {
      color: "rgba(168, 224, 212, 0.45)",
      lineWidth: 2,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });
    const toLine = (series: (number | null)[]) =>
      slice
        .map((b, i) =>
          series[i] == null ? null : { time: b.time as Time, value: series[i]! },
        )
        .filter(Boolean) as { time: Time; value: number }[];
    trendFast.setData(toLine(e21));
    trendSlow.setData(toLine(e55));

    candle.priceScale().applyOptions({
      scaleMargins: { top: 0.12, bottom: 0.08 },
    });
    chart.timeScale().fitContent();

    let raf = 0;
    let start = 0;
    const tick = (ts: number) => {
      if (!start) start = ts;
      const t = (ts - start) / 1000;
      // Slow breathing of bar spacing — presence without distraction
      const spacing = 14 + Math.sin(t / 8) * 1.15;
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
