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

type CandleApi = ISeriesApi<"Candlestick">;

function linePoints(
  bars: OhlcvBar[],
  values: (number | null)[],
): { time: Time; value: number }[] {
  return bars
    .map((b, i) =>
      values[i] == null ? null : { time: b.time as Time, value: values[i]! },
    )
    .filter(Boolean) as { time: Time; value: number }[];
}

export function CandlestickChart({ bars, indicators }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<CandleApi | null>(null);
  const overlayRef = useRef<ISeriesApi<"Line" | "Histogram">[]>([]);
  const fittedRef = useRef(false);
  const indicatorKey = JSON.stringify(indicators);

  // Create chart shell once.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

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
    candleRef.current = candle;

    return () => {
      for (const s of overlayRef.current) {
        try {
          chart.removeSeries(s);
        } catch {
          /* already gone */
        }
      }
      overlayRef.current = [];
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      fittedRef.current = false;
    };
  }, []);

  // Rebuild indicator overlays when toggles change; refresh candle + overlays on new bars.
  useEffect(() => {
    const chart = chartRef.current;
    const candle = candleRef.current;
    if (!chart || !candle || bars.length === 0) return;

    for (const s of overlayRef.current) {
      try {
        chart.removeSeries(s);
      } catch {
        /* ignore */
      }
    }
    overlayRef.current = [];

    candle.setData(
      bars.map((b) => ({
        time: b.time as Time,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      })),
    );

    candle.priceScale().applyOptions({
      scaleMargins: {
        top: 0.08,
        bottom: indicators.rsi || indicators.macd ? 0.32 : 0.08,
      },
    });

    const overlays: ISeriesApi<"Line" | "Histogram">[] = [];

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
      s20.setData(linePoints(bars, ma20));
      s50.setData(linePoints(bars, ma50));
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
      s12.setData(linePoints(bars, e12));
      s26.setData(linePoints(bars, e26));
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
      upper.setData(
        bars
          .map((b, i) =>
            bb[i].upper == null
              ? null
              : { time: b.time as Time, value: bb[i].upper! },
          )
          .filter(Boolean) as { time: Time; value: number }[],
      );
      mid.setData(
        bars
          .map((b, i) =>
            bb[i].mid == null
              ? null
              : { time: b.time as Time, value: bb[i].mid! },
          )
          .filter(Boolean) as { time: Time; value: number }[],
      );
      lower.setData(
        bars
          .map((b, i) =>
            bb[i].lower == null
              ? null
              : { time: b.time as Time, value: bb[i].lower! },
          )
          .filter(Boolean) as { time: Time; value: number }[],
      );
      overlays.push(upper, mid, lower);
    }

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
      rsiSeries.setData(linePoints(bars, r));
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
      overlays.push(hist, macdLine, signal);
    }

    overlayRef.current = overlays;

    // Fit once so poll updates don't reset the user's zoom.
    if (!fittedRef.current) {
      chart.timeScale().fitContent();
      fittedRef.current = true;
    }
  }, [bars, indicators, indicatorKey]);

  return (
    <div
      ref={containerRef}
      className="chart-canvas h-[min(62vh,560px)] w-full min-h-[320px]"
      aria-label="USD/JPY ローソク足チャート"
    />
  );
}
