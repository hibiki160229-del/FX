"use client";

import {
  bollinger,
  ema,
  macd,
  rsi,
  sma,
} from "@/lib/indicators";
import type { IndicatorState, OhlcvBar } from "@/lib/types";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";
import { useEffect, useRef } from "react";

type Props = {
  bars: OhlcvBar[];
  indicators: IndicatorState;
};

export function CandlestickChart({ bars, indicators }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || bars.length === 0) return;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(232, 240, 242, 0.72)",
        fontFamily: "var(--font-body), sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(120, 170, 180, 0.08)" },
        horzLines: { color: "rgba(120, 170, 180, 0.08)" },
      },
      crosshair: {
        vertLine: { color: "rgba(168, 224, 212, 0.45)", width: 1 },
        horzLine: { color: "rgba(168, 224, 212, 0.45)", width: 1 },
      },
      rightPriceScale: {
        borderColor: "rgba(120, 170, 180, 0.18)",
      },
      timeScale: {
        borderColor: "rgba(120, 170, 180, 0.18)",
        timeVisible: true,
        secondsVisible: false,
      },
    });
    chartRef.current = chart;

    const candle = chart.addSeries(CandlestickSeries, {
      upColor: "#2fd4a8",
      downColor: "#ff7a6e",
      borderUpColor: "#2fd4a8",
      borderDownColor: "#ff7a6e",
      wickUpColor: "#2fd4a8",
      wickDownColor: "#ff7a6e",
    });
    candle.setData(
      bars.map((b) => ({
        time: b.time as Time,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      })),
    );

    const overlays: ISeriesApi<"Line">[] = [];

    if (indicators.ma) {
      const ma20 = sma(bars, 20);
      const ma50 = sma(bars, 50);
      const s20 = chart.addSeries(LineSeries, {
        color: "#a8e0d4",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        title: "MA20",
      });
      const s50 = chart.addSeries(LineSeries, {
        color: "#7ed4e8",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        title: "MA50",
      });
      s20.setData(
        bars
          .map((b, i) =>
            ma20[i] == null ? null : { time: b.time as Time, value: ma20[i]! },
          )
          .filter(Boolean) as { time: Time; value: number }[],
      );
      s50.setData(
        bars
          .map((b, i) =>
            ma50[i] == null ? null : { time: b.time as Time, value: ma50[i]! },
          )
          .filter(Boolean) as { time: Time; value: number }[],
      );
      overlays.push(s20, s50);
    }

    if (indicators.ema) {
      const e12 = ema(bars, 12);
      const e26 = ema(bars, 26);
      const s12 = chart.addSeries(LineSeries, {
        color: "#d4f5ec",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        title: "EMA12",
      });
      const s26 = chart.addSeries(LineSeries, {
        color: "#7ed4e8",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        title: "EMA26",
      });
      s12.setData(
        bars
          .map((b, i) =>
            e12[i] == null ? null : { time: b.time as Time, value: e12[i]! },
          )
          .filter(Boolean) as { time: Time; value: number }[],
      );
      s26.setData(
        bars
          .map((b, i) =>
            e26[i] == null ? null : { time: b.time as Time, value: e26[i]! },
          )
          .filter(Boolean) as { time: Time; value: number }[],
      );
      overlays.push(s12, s26);
    }

    if (indicators.bb) {
      const bb = bollinger(bars, 20, 2);
      const upper = chart.addSeries(LineSeries, {
        color: "rgba(158, 196, 210, 0.7)",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        title: "BB上",
      });
      const mid = chart.addSeries(LineSeries, {
        color: "rgba(158, 196, 210, 0.45)",
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        title: "BB中",
      });
      const lower = chart.addSeries(LineSeries, {
        color: "rgba(158, 196, 210, 0.7)",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        title: "BB下",
      });
      const toLine = (key: "upper" | "mid" | "lower") =>
        bars
          .map((b, i) =>
            bb[i][key] == null
              ? null
              : { time: b.time as Time, value: bb[i][key]! },
          )
          .filter(Boolean) as { time: Time; value: number }[];
      upper.setData(toLine("upper"));
      mid.setData(toLine("mid"));
      lower.setData(toLine("lower"));
      overlays.push(upper, mid, lower);
    }

    // Pane indicators: RSI / MACD use separate price scales
    if (indicators.rsi) {
      const r = rsi(bars, 14);
      const rsiSeries = chart.addSeries(LineSeries, {
        color: "#a8e0d4",
        lineWidth: 2,
        priceScaleId: "rsi",
        priceLineVisible: false,
        lastValueVisible: true,
        title: "RSI",
      });
      chart.priceScale("rsi").applyOptions({
        scaleMargins: { top: 0.72, bottom: 0.02 },
        borderVisible: false,
      });
      candle.priceScale().applyOptions({
        scaleMargins: { top: 0.08, bottom: 0.32 },
      });
      rsiSeries.setData(
        bars
          .map((b, i) =>
            r[i] == null ? null : { time: b.time as Time, value: r[i]! },
          )
          .filter(Boolean) as { time: Time; value: number }[],
      );
      overlays.push(rsiSeries);
    }

    if (indicators.macd) {
      const m = macd(bars);
      const hist = chart.addSeries(HistogramSeries, {
        priceScaleId: "macd",
        priceLineVisible: false,
        lastValueVisible: false,
        title: "MACD",
      });
      const macdLine = chart.addSeries(LineSeries, {
        color: "#7ed4e8",
        lineWidth: 2,
        priceScaleId: "macd",
        priceLineVisible: false,
        lastValueVisible: false,
      });
      const signal = chart.addSeries(LineSeries, {
        color: "#ff7a6e",
        lineWidth: 1,
        priceScaleId: "macd",
        priceLineVisible: false,
        lastValueVisible: false,
      });
      chart.priceScale("macd").applyOptions({
        scaleMargins: {
          top: indicators.rsi ? 0.82 : 0.72,
          bottom: 0.02,
        },
        borderVisible: false,
      });
      if (!indicators.rsi) {
        candle.priceScale().applyOptions({
          scaleMargins: { top: 0.08, bottom: 0.32 },
        });
      }
      hist.setData(
        bars
          .map((b, i) => {
            const h = m[i].histogram;
            if (h == null) return null;
            return {
              time: b.time as Time,
              value: h,
              color:
                h >= 0 ? "rgba(47, 212, 168, 0.55)" : "rgba(255, 122, 110, 0.55)",
            };
          })
          .filter(Boolean) as {
          time: Time;
          value: number;
          color: string;
        }[],
      );
      macdLine.setData(
        bars
          .map((b, i) =>
            m[i].macd == null
              ? null
              : { time: b.time as Time, value: m[i].macd! },
          )
          .filter(Boolean) as { time: Time; value: number }[],
      );
      signal.setData(
        bars
          .map((b, i) =>
            m[i].signal == null
              ? null
              : { time: b.time as Time, value: m[i].signal! },
          )
          .filter(Boolean) as { time: Time; value: number }[],
      );
      overlays.push(macdLine, signal);
    }

    chart.timeScale().fitContent();

    return () => {
      overlays.length = 0;
      chart.remove();
      chartRef.current = null;
    };
  }, [bars, indicators]);

  return (
    <div
      ref={containerRef}
      className="chart-canvas h-[min(62vh,560px)] w-full min-h-[320px]"
      aria-label="USD/JPY ローソク足チャート"
    />
  );
}
